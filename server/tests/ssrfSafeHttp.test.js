/**
 * server/tests/ssrfSafeHttp.test.js
 *
 * Unit and integration tests for safeHttp (safeRequest), linkHealthChecker,
 * and autonomousHunter SSRF protections without real external network requests.
 */

const http = require('http');
const dns = require('dns');
const axios = require('axios');
const { safeRequest, MAX_REDIRECT_HOPS } = require('../utils/safeHttp');
const { verifyLinkHealth } = require('../utils/linkHealthChecker');
const { isSafeExternalUrl } = require('../utils/autonomousHunter');

describe('SSRF Protection Suite: safeHttp, linkHealthChecker & autonomousHunter', () => {
    let warnSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        if (warnSpy) {
            warnSpy.mockRestore();
        }
    });

    describe('1. Local Proof: Ephemeral HTTP Server SSRF Enforcement', () => {
        let localServer;
        let serverPort;
        let receivedRequests = 0;

        beforeAll((done) => {
            localServer = http.createServer((req, res) => {
                receivedRequests += 1;
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('private data');
            });
            localServer.listen(0, '127.0.0.1', () => {
                serverPort = localServer.address().port;
                done();
            });
        });

        afterAll((done) => {
            if (localServer) {
                localServer.close(done);
            } else {
                done();
            }
        });

        test('blocks verifyLinkHealth and safeRequest from reaching 127.0.0.1 server (0 requests received)', async () => {
            const targetUrl = `http://127.0.0.1:${serverPort}/sensitive-admin`;

            // 1. verifyLinkHealth should mark as expired with statusCode 0
            const healthRes = await verifyLinkHealth(targetUrl);
            expect(healthRes.linkStatus).toBe('expired');
            expect(healthRes.isAlive).toBe(false);
            expect(healthRes.statusCode).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith(`[LinkHealth] SSRF blocked: ${targetUrl}`);

            // 2. safeRequest should throw ESSRFBLOCKED
            await expect(safeRequest(targetUrl)).rejects.toMatchObject({
                code: 'ESSRFBLOCKED'
            });

            // 3. Local server must have received exactly 0 requests
            expect(receivedRequests).toBe(0);
        });
    });

    describe('2. Blocked IP Literals (Loopback, Link-Local, Private, Integer/Hex IPs)', () => {
        const blockedUrls = [
            'http://169.254.169.254/latest/meta-data/',
            'http://127.0.0.2/',
            'http://[::1]/',
            'http://2130706433/',
            'http://0x7f000001/',
            'http://10.0.0.5/',
            'http://192.168.1.1/',
            'http://100.64.0.1/',
            'http://0.0.0.0/'
        ];

        test.each(blockedUrls)('blocks verifyLinkHealth for %s without opening outbound socket', async (url) => {
            const headSpy = jest.spyOn(axios, 'head');
            const getSpy = jest.spyOn(axios, 'get');

            const res = await verifyLinkHealth(url);
            expect(res.linkStatus).toBe('expired');
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith(`[LinkHealth] SSRF blocked: ${url}`);

            expect(headSpy).not.toHaveBeenCalled();
            expect(getSpy).not.toHaveBeenCalled();
        });

        test.each(blockedUrls)('rejects safeRequest with ESSRFBLOCKED for %s without calling axios', async (url) => {
            const headSpy = jest.spyOn(axios, 'head');
            const getSpy = jest.spyOn(axios, 'get');

            await expect(safeRequest(url)).rejects.toMatchObject({
                code: 'ESSRFBLOCKED'
            });

            expect(headSpy).not.toHaveBeenCalled();
            expect(getSpy).not.toHaveBeenCalled();
        });
    });

    describe('3. DNS Resolution to Private IPs (Rebinding & Private Answers)', () => {
        test('blocks hostname resolving to RFC 1918 private IP (10.0.0.5)', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '10.0.0.5', family: 4 }
            ]);
            jest.spyOn(dns, 'lookup').mockImplementation((host, opts, cb) => {
                cb(null, [{ address: '10.0.0.5', family: 4 }]);
            });

            const headSpy = jest.spyOn(axios, 'head');
            const getSpy = jest.spyOn(axios, 'get');

            const healthRes = await verifyLinkHealth('http://evil.example.test/tournaments');
            expect(healthRes.linkStatus).toBe('expired');
            expect(healthRes.isAlive).toBe(false);
            expect(healthRes.statusCode).toBe(0);
            expect(warnSpy).toHaveBeenCalledWith('[LinkHealth] SSRF blocked: http://evil.example.test/tournaments');

            await expect(safeRequest('http://evil.example.test/tournaments')).rejects.toMatchObject({
                code: 'ESSRFBLOCKED'
            });

            expect(headSpy).not.toHaveBeenCalled();
            expect(getSpy).not.toHaveBeenCalled();
        });
    });

    describe('4. Redirect Handling & SSRF Protection Across Hops', () => {
        test('blocks redirect to cloud metadata (169.254.169.254) with axios called exactly once', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({
                status: 302,
                headers: { location: 'http://169.254.169.254/latest/meta-data/' },
                data: ''
            });

            await expect(safeRequest('http://public.example.com/redirect-to-metadata')).rejects.toMatchObject({
                code: 'ESSRFBLOCKED'
            });

            expect(getSpy).toHaveBeenCalledTimes(1);
        });

        test('blocks relative redirect to host resolving to private IP with axios called once', async () => {
            jest.spyOn(dns.promises, 'lookup').mockImplementation(async (hostname) => {
                if (hostname === 'public.example.com') {
                    return [{ address: '93.184.216.34', family: 4 }];
                }
                return [{ address: '192.168.1.10', family: 4 }];
            });

            const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({
                status: 302,
                headers: { location: 'http://internal.example.com/admin' },
                data: ''
            });

            await expect(safeRequest('http://public.example.com/step1')).rejects.toMatchObject({
                code: 'ESSRFBLOCKED'
            });

            expect(getSpy).toHaveBeenCalledTimes(1);
        });

        test('throws ETOOMANYREDIRECTS when exceeding MAX_REDIRECT_HOPS (6 chained redirects)', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            const getSpy = jest.spyOn(axios, 'get').mockImplementation(async (url) => {
                const urlObj = new URL(url);
                const step = parseInt(urlObj.searchParams.get('step') || '0', 10);
                return {
                    status: 302,
                    headers: { location: `http://public.example.com/loop?step=${step + 1}` },
                    data: ''
                };
            });

            await expect(safeRequest('http://public.example.com/loop?step=0')).rejects.toMatchObject({
                code: 'ETOOMANYREDIRECTS'
            });

            // 1 initial request + 5 redirects = 6 requests total before failing on 6th redirect
            expect(getSpy).toHaveBeenCalledTimes(MAX_REDIRECT_HOPS + 1);
        });

        test('cross-host redirect drops Cookie and Authorization headers', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            const getSpy = jest.spyOn(axios, 'get')
                .mockResolvedValueOnce({
                    status: 302,
                    headers: { location: 'https://other-domain.org/landing' },
                    data: ''
                })
                .mockResolvedValueOnce({
                    status: 200,
                    headers: {},
                    data: 'Welcome'
                });

            const initialHeaders = {
                Cookie: 'session=secret-cookie',
                Authorization: 'Bearer secret-token',
                'X-Custom-Tracking': 'public-id'
            };

            const response = await safeRequest('https://initial-domain.com/login', {
                headers: initialHeaders
            });

            expect(response.status).toBe(200);
            expect(getSpy).toHaveBeenCalledTimes(2);

            // Second hop must NOT include Cookie or Authorization
            const secondHopConfig = getSpy.mock.calls[1][1];
            expect(secondHopConfig.headers.Cookie).toBeUndefined();
            expect(secondHopConfig.headers.cookie).toBeUndefined();
            expect(secondHopConfig.headers.Authorization).toBeUndefined();
            expect(secondHopConfig.headers.authorization).toBeUndefined();
            expect(secondHopConfig.headers['X-Custom-Tracking']).toBe('public-id');
        });

        test('303 redirect rewrites method to GET and drops body payload', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            const postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                status: 303,
                headers: { location: 'https://initial-domain.com/confirmation' },
                data: ''
            });

            const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({
                status: 200,
                headers: {},
                data: 'Order Confirmed'
            });

            const response = await safeRequest('https://initial-domain.com/submit', {
                method: 'POST',
                data: { secret: 'payload' },
                headers: { 'Content-Type': 'application/json', 'Content-Length': '20' }
            });

            expect(response.status).toBe(200);
            expect(postSpy).toHaveBeenCalledTimes(1);
            expect(getSpy).toHaveBeenCalledTimes(1);

            const secondHopConfig = getSpy.mock.calls[0][1];
            expect(secondHopConfig.method).toBe('GET');
            expect(secondHopConfig.data).toBeUndefined();
            expect(secondHopConfig.headers['Content-Type']).toBeUndefined();
            expect(secondHopConfig.headers['content-type']).toBeUndefined();
        });
    });

    describe('5. isSafeExternalUrl Matrix', () => {
        const testCases = [
            // IP literals & representations
            { url: 'http://169.254.169.254/latest/meta-data/', expected: false },
            { url: 'http://127.0.0.1/', expected: false },
            { url: 'http://127.0.0.2/', expected: false },
            { url: 'http://[::1]/', expected: false },
            { url: 'http://2130706433/', expected: false },
            { url: 'http://0x7f000001/', expected: false },
            { url: 'http://10.0.0.5/', expected: false },
            { url: 'http://192.168.1.1/', expected: false },
            { url: 'http://100.64.0.1/', expected: false },
            { url: 'http://0.0.0.0/', expected: false },
            { url: 'http://localhost/', expected: false },
            { url: 'http://app.localhost:3000/', expected: false },

            // Protocols
            { url: 'ftp://ftp.tournamentsoftware.com/data', expected: false },
            { url: 'javascript:alert(1)', expected: false },
            { url: 'file:///etc/shadow', expected: false },
            { url: '', expected: false },
            { url: null, expected: false },
            { url: 'not-a-valid-url', expected: false },

            // Valid public URLs
            { url: 'https://www.tournamentsoftware.com/tournament/12345', expected: true },
            { url: 'https://linktr.ee/gmubadminton', expected: true },
            { url: 'https://capitalbadminton.com/tournaments', expected: true },
            { url: 'https://novabadmintonacademy.com/events', expected: true }
        ];

        test.each(testCases)('isSafeExternalUrl evaluates $url -> $expected', ({ url, expected }) => {
            expect(isSafeExternalUrl(url)).toBe(expected);
        });
    });

    describe('6. Happy Path & 405 Method Not Allowed Fallback Handling', () => {
        test('happy path: public IP with 200 OK returns valid response', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            jest.spyOn(axios, 'head').mockResolvedValueOnce({
                status: 200,
                headers: {},
                data: ''
            });

            const res = await verifyLinkHealth('https://capitalbadminton.com/tournaments');
            expect(res.linkStatus).toBe('valid');
            expect(res.isAlive).toBe(true);
            expect(res.statusCode).toBe(200);
            expect(warnSpy).not.toHaveBeenCalled();
        });

        test('HEAD returns 405 Method Not Allowed; fallback GET returns 200 OK (marked valid)', async () => {
            jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
                { address: '93.184.216.34', family: 4 }
            ]);

            jest.spyOn(axios, 'head').mockResolvedValueOnce({
                status: 405,
                headers: {},
                data: ''
            });

            jest.spyOn(axios, 'get').mockResolvedValueOnce({
                status: 200,
                headers: {},
                data: '<html>Registration Open</html>'
            });

            const res = await verifyLinkHealth('https://novabadmintonacademy.com/registration-form');
            expect(res.linkStatus).toBe('valid');
            expect(res.isAlive).toBe(true);
            expect(res.statusCode).toBe(200);
            expect(warnSpy).not.toHaveBeenCalled();
        });
    });
});
