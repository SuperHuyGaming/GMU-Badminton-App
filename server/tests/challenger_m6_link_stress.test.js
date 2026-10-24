/**
 * challenger_m6_link_stress.test.js
 *
 * Empirical Adversarial Stress Test Suite: Milestone 6
 * Focus: Link Health Probing & Fallback Routing Resilience
 *
 * Probes:
 * 1. Link health prober resilience under extreme inputs:
 *    - null URLs, undefined, empty strings, non-string types, non-HTTP protocols,
 *      javascript: URI, private IP ranges (127.0.0.1, 169.254.169.254, 0.0.0.0, [::1]),
 *      massive response payloads (>50KB cap on GET fallback), socket hang-ups (immediate destroy, partial write),
 *      and network timeouts.
 *    - Verifies that verifyLinkHealth never crashes the process, never throws unhandled errors,
 *      and returns appropriate expired/warning status.
 * 2. Fallback resolution coverage:
 *    - Test host club fallback resolution across all target DMV clubs:
 *      GMU, UMD, CBA, NVBC, GW, Georgetown, JHU, UVA, VT, VCU.
 *    - Test unmapped clubs, empty objects, null/undefined inputs, and text inference.
 *    - Verify fallback URLs are valid HTTPS endpoints and never undefined/null.
 *    - Test checkAndUpdateTournamentLink document mutation.
 * 3. Pre-flight hook integration:
 *    - Verify that hunter queue processing (processDiscoveryQueue) handles links that fail
 *      pre-flight probing (404, 500, timeouts, socket hang-ups, invalid protocols, unexpected exceptions)
 *      without crashing or discarding the tournament candidate.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');

// In-Memory Redis Mock with tagged invalidation support
const mockRedisStore = new Map();
const mockTaggedSets = new Map();

jest.mock('../utils/redis', () => ({
    get: jest.fn(async (key) => mockRedisStore.get(key) || null),
    set: jest.fn(async (key, val) => {
        mockRedisStore.set(key, val);
        return 'OK';
    }),
    setex: jest.fn(async (key, ttl, val) => {
        mockRedisStore.set(key, val);
        return 'OK';
    }),
    del: jest.fn(async (key) => {
        const existed = mockRedisStore.delete(key);
        return existed ? 1 : 0;
    }),
    keys: jest.fn(async (pattern) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        const matching = [];
        for (const k of mockRedisStore.keys()) {
            if (regex.test(k)) matching.push(k);
        }
        return matching;
    }),
    sadd: jest.fn(async (tag, key) => {
        if (!mockTaggedSets.has(tag)) mockTaggedSets.set(tag, new Set());
        mockTaggedSets.get(tag).add(key);
        return 1;
    }),
    tagCacheKey: jest.fn(async (tag, key) => {
        if (!mockTaggedSets.has(tag)) mockTaggedSets.set(tag, new Set());
        mockTaggedSets.get(tag).add(key);
        return 1;
    }),
    invalidateCacheTag: jest.fn(async (tag) => {
        const set = mockTaggedSets.get(tag);
        if (set) {
            for (const key of set) {
                mockRedisStore.delete(key);
            }
            mockTaggedSets.delete(tag);
        }
        return 1;
    })
}));

// Mock AI parser for hunter queue testing
jest.mock('../utils/aiParser', () => ({
    parseDiscoveredWebpage: jest.fn(),
    parseInstagramPost: jest.fn(),
    parseMultimodalFlyer: jest.fn(),
    fallbackRegexParser: jest.fn(),
    fallbackWebpageParser: jest.fn()
}));

const {
    verifyLinkHealth,
    resolveHostClubFallback,
    checkAndUpdateTournamentLink,
    runTournamentLinkHealthcheck
} = require('../utils/linkHealthChecker');

const {
    processDiscoveryQueue,
    isSafeExternalUrl
} = require('../utils/autonomousHunter');

const { parseDiscoveredWebpage } = require('../utils/aiParser');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Tournament = require('../models/Tournament');

describe('Empirical Adversarial Stress Test: Link Health & Fallback Routing', () => {
    let activeServers = [];
    let memUsageSpy;

    beforeAll(() => {
        memUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
            rss: 50 * 1024 * 1024,
            heapTotal: 60 * 1024 * 1024,
            heapUsed: 40 * 1024 * 1024,
            external: 10 * 1024 * 1024,
            arrayBuffers: 1024 * 1024
        });
    });

    afterAll(() => {
        if (memUsageSpy) {
            memUsageSpy.mockRestore();
        }
    });

    // Helper to spin up ephemeral HTTP servers for real TCP/HTTP testing
    function createEphemeralServer(handler) {
        return new Promise((resolve, reject) => {
            const server = http.createServer(handler);
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                activeServers.push(server);
                resolve({ server, url: `http://127.0.0.1:${port}` });
            });
            server.on('error', reject);
        });
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisStore.clear();
        mockTaggedSets.clear();
        Object.defineProperty(mongoose.connection, 'readyState', {
            value: 1,
            configurable: true
        });
    });

    afterEach(async () => {
        for (const s of activeServers) {
            await new Promise((r) => s.close(r));
        }
        activeServers = [];
    });

    // =========================================================================
    // SECTION 1: LINK HEALTH PROBER RESILIENCE UNDER EXTREME INPUTS
    // =========================================================================
    describe('1. Link Health Prober Resilience Under Extreme & Hostile Inputs', () => {
        test('1.1 Extreme non-string, null, undefined, and empty inputs return expired without crashing', async () => {
            const invalidInputs = [
                null,
                undefined,
                '',
                '   ',
                0,
                404,
                NaN,
                {},
                [],
                { url: 'http://example.com' },
                false,
                true,
                () => {},
                Symbol('url')
            ];

            for (const input of invalidInputs) {
                const result = await verifyLinkHealth(input);
                expect(result).toBeDefined();
                expect(result.linkStatus).toBe('expired');
                expect(result.isAlive).toBe(false);
                expect(result.statusCode).toBe(0);
                expect(result.error).toBe('Invalid URL format');
            }
        });

        test('1.2 Non-HTTP protocols, javascript: URIs, and dangerous schemes are safely rejected', async () => {
            const dangerousSchemes = [
                'ftp://files.badminton.org/entry_form.pdf',
                'file:///etc/passwd',
                'file:///C:/Windows/System32/drivers/etc/hosts',
                'javascript:alert(document.cookie)',
                'javascript:fetch("https://evil.com")',
                'data:text/html,<script>alert("XSS")</script>',
                'mailto:admin@gmubadminton.org',
                'tel:+17035551234',
                'blob:https://example.com/83942048-2839-4820',
                'gopher://gopher.example.com',
                'ws://live.badminton.org/scores'
            ];

            for (const url of dangerousSchemes) {
                const result = await verifyLinkHealth(url);
                expect(result.linkStatus).toBe('expired');
                expect(result.isAlive).toBe(false);
                expect(result.statusCode).toBe(0);
                expect(result.error).toBe('Invalid URL format');
            }
        });

        test('1.3 Malformed HTTP strings and incomplete URIs do not throw unhandled exceptions', async () => {
            const malformedUrls = [
                'http://',
                'https://',
                'http://???',
                'http://...',
                'http:// invalid domain.com',
                'https://:8080',
                'http://[invalid-ipv6]'
            ];

            for (const url of malformedUrls) {
                const result = await verifyLinkHealth(url, 500);
                expect(result.linkStatus).toBe('expired');
                expect(result.isAlive).toBe(false);
                expect(result.statusCode).toBe(0);
                expect(typeof result.error).toBe('string');
            }
        });

        test('1.4 Private IP addresses and SSRF targets fail cleanly without hanging', async () => {
            // Test non-listening local port (instant ECONNREFUSED)
            const resultRefused = await verifyLinkHealth('http://127.0.0.1:59999/status', 500);
            expect(resultRefused.linkStatus).toBe('expired');
            expect(resultRefused.isAlive).toBe(false);
            expect(resultRefused.statusCode).toBe(0);
            expect(resultRefused.error).toMatch(/ECONNREFUSED|connect/i);

            // Cloud metadata IP (169.254.169.254) with tight timeout
            const resultMetadata = await verifyLinkHealth('http://169.254.169.254/latest/meta-data/', 300);
            expect(resultMetadata.linkStatus).toBe('expired');
            expect(resultMetadata.isAlive).toBe(false);
            expect(resultMetadata.statusCode).toBe(0);

            // Zero address
            const resultZero = await verifyLinkHealth('http://0.0.0.0:59998/', 300);
            expect(resultZero.linkStatus).toBe('expired');
            expect(resultZero.isAlive).toBe(false);
        });

        test('1.5 Empirical TCP Stress: Socket hang-up and abrupt TCP RST are caught cleanly', async () => {
            // Server that immediately destroys incoming socket on connection
            const { url: hangupUrl } = await createEphemeralServer((req, res) => {
                req.socket.destroy();
            });

            const resultHangup = await verifyLinkHealth(hangupUrl, 1000);
            expect(resultHangup.linkStatus).toBe('expired');
            expect(resultHangup.isAlive).toBe(false);
            expect(resultHangup.statusCode).toBe(0);
            expect(resultHangup.error).toMatch(/socket hang up|ECONNRESET/i);

            // Server that writes partial header then destroys socket
            const { url: partialUrl } = await createEphemeralServer((req, res) => {
                res.write('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n');
                setTimeout(() => req.socket.destroy(), 10);
            });

            const resultPartial = await verifyLinkHealth(partialUrl, 1000);
            expect(resultPartial.linkStatus).toBe('expired');
            expect(resultPartial.isAlive).toBe(false);
            expect(resultPartial.statusCode).toBe(0);
        });

        test('1.6 Empirical Payload Stress: Massive response payloads on 405 GET fallback are capped without OOM', async () => {
            // Server returns 405 on HEAD to trigger GET fallback, then streams 5MB payload
            const { url: massiveUrl } = await createEphemeralServer((req, res) => {
                if (req.method === 'HEAD') {
                    res.writeHead(405, { 'Allow': 'GET' });
                    res.end();
                    return;
                }
                // GET request: stream huge payload > 50KB cap
                res.writeHead(200, {
                    'Content-Type': 'text/html',
                    'Content-Length': `${5 * 1024 * 1024}`
                });
                const chunk = Buffer.alloc(64 * 1024, 'A');
                // Write enough to exceed 50KB
                res.write(chunk);
                res.write(chunk);
                res.end();
            });

            const result = await verifyLinkHealth(massiveUrl, 2000);
            // Axios enforces maxContentLength: 50 * 1024 on GET fallback
            expect(result.linkStatus).toBe('expired');
            expect(result.isAlive).toBe(false);
            expect(result.error).toMatch(/maxContentLength|size.*exceeded/i);
        });

        test('1.7 Empirical Timeout Stress: Socket freeze / hanging server is aborted by timeoutMs', async () => {
            // Server accepts connection and never responds
            const { url: freezeUrl } = await createEphemeralServer((req, res) => {
                // Do nothing: deliberately freeze
            });

            const start = Date.now();
            const result = await verifyLinkHealth(freezeUrl, 250);
            const elapsed = Date.now() - start;

            expect(result.linkStatus).toBe('expired');
            expect(result.isAlive).toBe(false);
            expect(result.statusCode).toBe(0);
            expect(result.error).toMatch(/timeout.*exceeded/i);
            expect(elapsed).toBeLessThan(2000); // Must not hang indefinitely
        });

        test('1.8 Complete HTTP Status Code Matrix Probing', async () => {
            // Test 200 OK
            const { url: okUrl } = await createEphemeralServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('OK');
            });
            const res200 = await verifyLinkHealth(okUrl);
            expect(res200.linkStatus).toBe('valid');
            expect(res200.isAlive).toBe(true);
            expect(res200.statusCode).toBe(200);

            // Test 302 Redirect to 200 OK
            const { url: redirUrl } = await createEphemeralServer((req, res) => {
                if (req.url === '/redirect') {
                    res.writeHead(302, { 'Location': '/target' });
                    res.end();
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('Arrived');
                }
            });
            const res302 = await verifyLinkHealth(`${redirUrl}/redirect`);
            expect(res302.linkStatus).toBe('valid');
            expect(res302.isAlive).toBe(true);

            // Test 404 Not Found
            const { url: notFoundUrl } = await createEphemeralServer((req, res) => {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('Not Found');
            });
            const res404 = await verifyLinkHealth(notFoundUrl);
            expect(res404.linkStatus).toBe('expired');
            expect(res404.isAlive).toBe(false);
            expect(res404.statusCode).toBe(404);

            // Test 405 Method Not Allowed with successful GET fallback
            const { url: method405Url } = await createEphemeralServer((req, res) => {
                if (req.method === 'HEAD') {
                    res.writeHead(405, { 'Allow': 'GET' });
                    res.end();
                } else if (req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('GET OK');
                }
            });
            const res405Ok = await verifyLinkHealth(method405Url);
            expect(res405Ok.linkStatus).toBe('valid');
            expect(res405Ok.isAlive).toBe(true);
            expect(res405Ok.statusCode).toBe(200);

            // Test 405 Method Not Allowed with 404 GET fallback
            const { url: method405FailUrl } = await createEphemeralServer((req, res) => {
                if (req.method === 'HEAD') {
                    res.writeHead(405, { 'Allow': 'GET' });
                    res.end();
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('Not Found on GET');
                }
            });
            const res405Fail = await verifyLinkHealth(method405FailUrl);
            expect(res405Fail.linkStatus).toBe('expired');
            expect(res405Fail.isAlive).toBe(false);
            expect(res405Fail.statusCode).toBe(404);

            // Test 500 Internal Server Error
            const { url: serverErrorUrl } = await createEphemeralServer((req, res) => {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('Error');
            });
            const res500 = await verifyLinkHealth(serverErrorUrl);
            expect(res500.linkStatus).toBe('expired');
            expect(res500.isAlive).toBe(false);
            expect(res500.statusCode).toBe(500);
        });

        test('1.9 Process Stability Under Concurrent Adversarial Probes', async () => {
            const probeUrls = [
                null,
                '',
                'javascript:void(0)',
                'ftp://files.example.com',
                'http://127.0.0.1:59990',
                'http://169.254.169.254/latest',
                'http://[invalid-host]',
                'https://'
            ];

            // Run 40 concurrent probes in parallel
            const promises = [];
            for (let i = 0; i < 40; i++) {
                const target = probeUrls[i % probeUrls.length];
                promises.push(verifyLinkHealth(target, 150));
            }

            const results = await Promise.all(promises);
            expect(results).toHaveLength(40);
            for (const r of results) {
                expect(r.linkStatus).toBe('expired');
                expect(r.isAlive).toBe(false);
            }
        });
    });

    // =========================================================================
    // SECTION 2: FALLBACK RESOLUTION COVERAGE ACROSS DMV CLUBS & EDGE CASES
    // =========================================================================
    describe('2. Fallback Resolution Coverage Across Target DMV Clubs & Edge Cases', () => {
        const TARGET_CLUBS_MATRIX = [
            {
                clubName: 'GMU (George Mason University)',
                input: { hostClubHandle: '@gmu_badminton' },
                expectedFallback: 'https://linktr.ee/gmubadminton'
            },
            {
                clubName: 'GMU Alias Handle',
                input: { hostClubHandle: 'gmubadminton' },
                expectedFallback: 'https://linktr.ee/gmubadminton'
            },
            {
                clubName: 'UMD (University of Maryland)',
                input: { hostClubHandle: '@umd_badminton' },
                expectedFallback: 'https://linktr.ee/umd_badminton'
            },
            {
                clubName: 'UMD Alias Handle',
                input: { hostClubHandle: 'umdclubbadminton' },
                expectedFallback: 'https://linktr.ee/umd_badminton'
            },
            {
                clubName: 'CBA (Capital Badminton Academy)',
                input: { hostClubHandle: '@cba_badminton' },
                expectedFallback: 'https://www.capitalbadminton.com'
            },
            {
                clubName: 'CBA Alias Handle',
                input: { hostClubHandle: 'capitalbadminton' },
                expectedFallback: 'https://www.capitalbadminton.com'
            },
            {
                clubName: 'NVBC (Northern Virginia Badminton Club)',
                input: { hostClubHandle: '@nvbadminton' },
                expectedFallback: 'https://novabadmintonacademy.com'
            },
            {
                clubName: 'NVBC Alias Handle',
                input: { hostClubHandle: 'novabadminton' },
                expectedFallback: 'https://novabadmintonacademy.com'
            },
            {
                clubName: 'GW (George Washington University)',
                input: { hostClubHandle: '@gwbadminton' },
                expectedFallback: 'https://linktr.ee/gwbadminton'
            },
            {
                clubName: 'Georgetown University',
                input: { hostClubHandle: '@georgetownbadminton' },
                expectedFallback: 'https://linktr.ee/georgetownbadminton'
            },
            {
                clubName: 'JHU (Johns Hopkins University)',
                input: { hostClubHandle: '@jhubadminton' },
                expectedFallback: 'https://linktr.ee/jhubadminton'
            },
            {
                clubName: 'UVA (University of Virginia)',
                input: { hostClubHandle: '@uvabadminton' },
                expectedFallback: 'https://linktr.ee/uvabadminton'
            },
            {
                clubName: 'VT (Virginia Tech)',
                input: { hostClubHandle: '@vtechbadminton' },
                expectedFallback: 'https://linktr.ee/vtechbadminton'
            },
            {
                clubName: 'VCU (Virginia Commonwealth University)',
                input: { hostClubHandle: '@vcu.badminton' },
                expectedFallback: 'https://linktr.ee/vcu.badminton'
            }
        ];

        test('2.1 Resolves verified HTTPS fallback URLs across all 10 target DMV clubs by handle', () => {
            for (const { clubName, input, expectedFallback } of TARGET_CLUBS_MATRIX) {
                const fallback = resolveHostClubFallback(input);
                expect(fallback).toBe(expectedFallback);
                expect(fallback.startsWith('https://')).toBe(true);
                expect(typeof fallback).toBe('string');
                expect(fallback.length).toBeGreaterThan(10);
            }
        });

        test('2.2 Resolves verified fallbacks by venue and university text inference when handle is missing', () => {
            const textInferenceCases = [
                {
                    tournament: { tournamentName: '2026 Mason Fall Open', eventLocation: 'RAC Gym, Fairfax VA' },
                    expected: 'https://linktr.ee/gmubadminton'
                },
                {
                    tournament: { tournamentName: 'Mid-Atlantic Open', eventLocation: 'Capital Badminton Academy, Columbia MD' },
                    expected: 'https://www.capitalbadminton.com'
                },
                {
                    tournament: { tournamentName: '2026 NVBC Smash Invitational', eventLocation: 'Ashburn, VA' },
                    expected: 'https://novabadmintonacademy.com'
                },
                {
                    tournament: { tournamentName: 'Terrapin Classic', eventLocation: 'SPH Building, College Park, MD' },
                    expected: 'https://linktr.ee/umd_badminton'
                }
            ];

            for (const { tournament, expected } of textInferenceCases) {
                const fallback = resolveHostClubFallback(tournament);
                expect(fallback).toBe(expected);
                expect(fallback.startsWith('https://')).toBe(true);
            }
        });

        test('2.3 Unmapped clubs, empty objects, undefined, and malformed inputs return safe HTTPS fallback', () => {
            const edgeCases = [
                {},
                undefined,
                { hostClubHandle: '' },
                { tournamentName: 'Random Unmapped High School Tournament', eventLocation: 'Nowhere, USA' },
                { hostClubHandle: '@@extra_at_symbol' },
                { sourceUrl: '' },
                { hostUniversity: 'Unknown College' }
            ];

            for (const input of edgeCases) {
                const fallback = resolveHostClubFallback(input);
                expect(fallback).toBeDefined();
                expect(fallback).not.toBeNull();
                expect(typeof fallback).toBe('string');
                expect(fallback.startsWith('https://')).toBe(true);
            }
        });

        test('2.3b Adversarial boundary probe: resolveHostClubFallback(null) safely resolves to default fallback with null-guard', () => {
            // Verified: with null-guard applied, explicit null safely resolves to default fallback without throwing TypeError
            expect(() => resolveHostClubFallback(null)).not.toThrow();
            expect(resolveHostClubFallback(null)).toBe('https://linktr.ee/gmubadminton');
        });

        test('2.4 SourceUrl preservation when tournament has valid HTTPS source but unmapped club', () => {
            const validSourceCase = {
                tournamentName: 'Mid-Atlantic Badminton Cup',
                sourceUrl: 'https://www.instagram.com/p/DB123456789/'
            };

            const fallback = resolveHostClubFallback(validSourceCase);
            expect(fallback).toBe('https://www.instagram.com/p/DB123456789/');
            expect(fallback.startsWith('https://')).toBe(true);
        });

        test('2.5 checkAndUpdateTournamentLink properly mutates document on link failure', async () => {
            // Mock tournament with broken 404 registration link
            const mockDoc = {
                tournamentName: '2026 George Mason Open',
                hostClubHandle: '@gmu_badminton',
                registrationUrl: 'https://example.com/dead-link-404',
                linkStatus: 'unchecked',
                linkStatusCode: null,
                linkLastChecked: null,
                fallbackRegistrationUrl: '',
                save: jest.fn().mockResolvedValue(true)
            };

            // Spy on verifyLinkHealth
            jest.spyOn(axios, 'head').mockResolvedValue({ status: 404 });

            const updated = await checkAndUpdateTournamentLink(mockDoc);
            expect(updated.linkStatus).toBe('expired');
            expect(updated.linkStatusCode).toBe(404);
            expect(updated.fallbackRegistrationUrl).toBe('https://linktr.ee/gmubadminton');
            expect(updated.linkLastChecked).toBeInstanceOf(Date);
            expect(mockDoc.save).toHaveBeenCalled();
        });

        test('2.6 checkAndUpdateTournamentLink handles document with missing registrationUrl', async () => {
            const mockDoc = {
                tournamentName: '2026 CBA Championship',
                hostClubHandle: '@cba_badminton',
                registrationUrl: '',
                save: jest.fn().mockResolvedValue(true)
            };

            const updated = await checkAndUpdateTournamentLink(mockDoc);
            expect(updated.linkStatus).toBe('unchecked');
            expect(updated.fallbackRegistrationUrl).toBe('https://www.capitalbadminton.com');
            expect(mockDoc.save).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // SECTION 3: PRE-FLIGHT HOOK INTEGRATION IN AUTONOMOUS HUNTER
    // =========================================================================
    describe('3. Pre-Flight Hook Integration in Autonomous Hunter (processDiscoveryQueue)', () => {
        test('3.1 Pre-flight 404 detection enqueues proposal with status: pending and expired link without discarding candidate', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 UMD Terrapin Open',
                hostLocation: 'College Park, MD',
                startDate: '2026-11-14T09:00:00.000Z',
                endDate: '2026-11-15T18:00:00.000Z',
                registrationLink: 'https://umdclubbadminton.com/broken-reg-404',
                confidenceScore: 94
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 UMD Terrapin Open</h1><p>badminton tournament</p></body></html>'
            });
            // Simulate 404 response on registration link pre-flight
            jest.spyOn(axios, 'head').mockResolvedValue({ status: 404 });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://umdclubbadminton.com/news',
                rawSnippet: 'Announcing 2026 UMD Terrapin Open badminton tournament!',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            // Candidate must NOT be dropped or rejected
            expect(result.approved).toBe(1);
            expect(result.rejected).toBe(0);
            expect(mockQueueItem.status).toBe('APPROVED_BY_AI');

            // Proposal must exist in ProposedTournament with status: 'pending'
            expect(capturedProposal).toBeDefined();
            expect(capturedProposal.tournamentName).toBe('2026 UMD Terrapin Open');
            expect(capturedProposal.status).toBe('pending');
            expect(capturedProposal.linkStatus).toBe('expired');
            expect(capturedProposal.linkStatusCode).toBe(404);
            // Fallback resolved to UMD Linktree
            expect(capturedProposal.fallbackRegistrationUrl).toBe('https://linktr.ee/umd_badminton');
        });

        test('3.2 Pre-flight network timeout (ECONNABORTED) does not discard candidate', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 NVBC Winter Smash',
                hostLocation: 'Ashburn, VA',
                startDate: '2026-12-19T09:00:00.000Z',
                registrationLink: 'https://novabadmintonacademy.com/slow-timeout-portal',
                confidenceScore: 91
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 NVBC Winter Smash</h1><p>badminton tournament</p></body></html>'
            });
            // Simulate timeout on HEAD request
            const timeoutError = new Error('timeout of 3000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            jest.spyOn(axios, 'head').mockRejectedValue(timeoutError);

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://novabadmintonacademy.com/events',
                rawSnippet: 'NVBC Winter Smash open badminton tournament December 2026.',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(mockQueueItem.status).toBe('APPROVED_BY_AI');
            expect(capturedProposal).toBeDefined();
            expect(capturedProposal.linkStatus).toBe('expired');
            expect(capturedProposal.fallbackRegistrationUrl).toBe('https://novabadmintonacademy.com');
            expect(capturedProposal.status).toBe('pending');
        });

        test('3.3 Pre-flight socket hangup (ECONNRESET) preserves tournament candidate', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 Capital Badminton Summer Cup',
                hostLocation: 'Columbia, MD',
                startDate: '2026-11-28T09:00:00.000Z',
                registrationLink: 'https://capitalbadminton.com/hangup-link',
                confidenceScore: 89
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 Capital Badminton Summer Cup</h1><p>badminton tournament</p></body></html>'
            });

            const hangupError = new Error('socket hang up');
            hangupError.code = 'ECONNRESET';
            jest.spyOn(axios, 'head').mockRejectedValue(hangupError);

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://capitalbadminton.com/tournaments',
                rawSnippet: 'Capital Badminton Summer Cup July 2026 badminton tournament',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal.linkStatus).toBe('expired');
            expect(capturedProposal.fallbackRegistrationUrl).toBe('https://www.capitalbadminton.com');
            expect(capturedProposal.status).toBe('pending');
        });

        test('3.4 Pre-flight hook handles non-HTTP registration URLs (javascript:, ftp:) safely', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 GMU Intramural Open',
                hostLocation: 'RAC Gym, Fairfax, VA',
                startDate: '2026-11-20T09:00:00.000Z',
                registrationLink: 'javascript:void(0)',
                confidenceScore: 88
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 GMU Intramural Open</h1><p>badminton tournament</p></body></html>'
            });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://example.com/gmu-intramural',
                rawSnippet: 'GMU Intramural Open badminton competition at RAC Gym.',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal.linkStatus).toBe('expired');
            expect(capturedProposal.linkStatusCode).toBe(0);
            expect(capturedProposal.fallbackRegistrationUrl).toBe('https://linktr.ee/gmubadminton');
            expect(capturedProposal.status).toBe('pending');
        });

        test('3.5 Pre-flight hook recovers cleanly when link prober encounters an unexpected thrown exception', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 Mid-Atlantic Collegiate Championships',
                hostLocation: 'Columbia, MD',
                startDate: '2026-10-24T09:00:00.000Z',
                registrationLink: 'https://example.com/exploding-prober',
                confidenceScore: 92
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 Mid-Atlantic Collegiate Championships</h1><p>badminton tournament</p></body></html>'
            });

            // Simulate catastrophic unexpected throw in axios.head
            jest.spyOn(axios, 'head').mockImplementation(() => {
                throw new Error('FATAL_UNEXPECTED_HTTP_CLIENT_CORRUPTION');
            });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://example.com/ts',
                rawSnippet: 'Mid-Atlantic Collegiate Championships badminton tournament.',
                sourceType: 'TOURNAMENT_SOFTWARE',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            // Should complete without throwing or crashing
            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal).toBeDefined();
            // Candidate is safely enqueued with pending status
            expect(capturedProposal.status).toBe('pending');
        });

        test('3.6 Pre-flight hook with healthy registration URL marks linkStatus: valid', async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: '2026 George Mason Open',
                hostLocation: 'Fairfax, VA',
                startDate: '2026-11-07T09:00:00.000Z',
                registrationLink: 'https://linktr.ee/gmubadminton',
                confidenceScore: 95
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 George Mason Open</h1><p>badminton tournament</p></body></html>'
            });
            // Simulate 200 OK on HEAD
            jest.spyOn(axios, 'head').mockResolvedValue({ status: 200 });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: 'https://linktr.ee/gmubadminton',
                rawSnippet: 'Official 2026 GMU Badminton Open registration.',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal.linkStatus).toBe('valid');
            expect(capturedProposal.linkStatusCode).toBe(200);
            expect(capturedProposal.fallbackRegistrationUrl).toBe('');
            expect(capturedProposal.status).toBe('pending');
        });

        test('3.7 Batch processing with mixed health links processes all items completely', async () => {
            const queueItems = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    sourceUrl: 'https://capitalbadminton.com/item1',
                    rawSnippet: '2026 CBA Item 1 badminton tournament',
                    sourceType: 'GOOGLE_SEARCH',
                    status: 'PENDING_AI_REVIEW',
                    save: jest.fn().mockResolvedValue(true)
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    sourceUrl: 'https://novabadmintonacademy.com/item2',
                    rawSnippet: '2026 NVBC Item 2 badminton tournament',
                    sourceType: 'GOOGLE_SEARCH',
                    status: 'PENDING_AI_REVIEW',
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            let callCount = 0;
            parseDiscoveredWebpage.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        isValidDmvTournament: true,
                        tournamentName: '2026 CBA Batch Event',
                        hostLocation: 'Columbia, MD',
                        startDate: '2026-10-24T09:00:00.000Z',
                        registrationLink: 'https://capitalbadminton.com/healthy-link',
                        confidenceScore: 90
                    });
                } else {
                    return Promise.resolve({
                        isValidDmvTournament: true,
                        tournamentName: '2026 NVBC Batch Event',
                        hostLocation: 'Ashburn, VA',
                        startDate: '2026-12-19T09:00:00.000Z',
                        registrationLink: 'https://novabadmintonacademy.com/dead-link',
                        confidenceScore: 90
                    });
                }
            });

            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><p>badminton tournament</p></body></html>'
            });

            let headCallCount = 0;
            jest.spyOn(axios, 'head').mockImplementation(() => {
                headCallCount++;
                if (headCallCount === 1) {
                    return Promise.resolve({ status: 200 }); // Healthy
                } else {
                    return Promise.resolve({ status: 404 }); // Expired
                }
            });

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(queueItems)
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            const createdProposals = [];
            jest.spyOn(ProposedTournament, 'create').mockImplementation((doc) => {
                createdProposals.push(doc);
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const batchResult = await processDiscoveryQueue(2);

            expect(batchResult.approved).toBe(2);
            expect(batchResult.rejected).toBe(0);
            expect(createdProposals).toHaveLength(2);

            // Item 1: Valid
            expect(createdProposals[0].tournamentName).toBe('2026 CBA Batch Event');
            expect(createdProposals[0].linkStatus).toBe('valid');

            // Item 2: Expired with fallback
            expect(createdProposals[1].tournamentName).toBe('2026 NVBC Batch Event');
            expect(createdProposals[1].linkStatus).toBe('expired');
            expect(createdProposals[1].fallbackRegistrationUrl).toBe('https://novabadmintonacademy.com');
        });
    });
});
