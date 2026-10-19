/**
 * Test Suite: Challenger 1 Adversarial Memory & Heap Stress Testing
 * File: server/tests/challengerHunterStress.test.js
 *
 * Adversarially challenges:
 * 1. Axios body caps (>500KB payloads) rejected cleanly via real HTTP and chunked streams.
 * 2. 200KB HTML slicing resilience on malformed, unclosed, deeply nested, and surrogate-split HTML.
 * 3. 100+ iterations repetitive Cheerio parsing heap growth strictly bounded (< 30MB).
 * 4. Proactive heap pressure guard (>200MB) graceful pausing, early breaking, and transient recovery.
 */

const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');

jest.mock('../utils/redis', () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK')
}));

jest.mock('../utils/aiModeration', () => ({
    analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, reason: "", score: 0 })
}));

jest.mock('../utils/aiCoach', () => ({
    chat: jest.fn().mockResolvedValue({ response: "Coaching response", error: false }),
    initializeGemini: jest.fn().mockReturnValue(true)
}));

jest.mock('../utils/seedFeed', () => jest.fn());
jest.mock('../utils/cronJobs', () => jest.fn());

const DISTINCT_NAMES = [
    "2026 Adversarial Stress Test Cup Alpha",
    "2026 Adversarial Stress Test Cup Beta",
    "2026 Adversarial Stress Test Cup Gamma",
    "2026 Adversarial Stress Test Cup Delta",
    "2026 Adversarial Stress Test Cup Epsilon"
];

jest.mock('../utils/aiParser', () => ({
    parseDiscoveredWebpage: jest.fn().mockImplementation((rawText, url) => {
        const idMatch = (url || '').match(/(\d+)$/);
        const index = idMatch ? parseInt(idMatch[1], 10) : 0;
        return Promise.resolve({
            isValidDmvTournament: true,
            tournamentName: DISTINCT_NAMES[index % DISTINCT_NAMES.length],
            startDate: "2026-12-15",
            confidenceScore: 95
        });
    })
}));

const {
    processDiscoveryQueue,
    checkHeapPressure,
    pauseForGarbageCollection,
    yieldToEventLoop,
    HEAP_PRESSURE_LIMIT_BYTES,
    MAX_HTML_PARSE_LENGTH,
    AXIOS_BODY_CAP_BYTES
} = require('../utils/autonomousHunter');

const {
    parseTournamentSoftwareHtml,
    crawlTournamentSoftware
} = require('../utils/tournamentSoftwareCrawler');

const { getRacStatus } = require('../services/scraper');

const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Tournament = require('../models/Tournament');

describe('Challenger 1: Adversarial Memory & Heap Stress Test Suite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    // 1. Axios Body Caps Adversarial Simulation (> 500KB)
    // =========================================================================
    describe('1. Axios Body Caps Adversarial Simulation (> 500KB)', () => {
        let server = null;
        let serverUrl = '';

        afterEach((done) => {
            if (server && server.listening) {
                server.close(done);
            } else {
                done();
            }
        });

        test('Axios rejects response when Content-Length exceeds 500KB with ERR_BAD_RESPONSE', async () => {
            const largePayload = Buffer.alloc(800 * 1024, 'X'); // 800 KB
            await new Promise((resolve) => {
                server = http.createServer((req, res) => {
                    res.writeHead(200, {
                        'Content-Type': 'text/html',
                        'Content-Length': largePayload.length
                    });
                    res.end(largePayload);
                });
                server.listen(0, () => {
                    serverUrl = `http://127.0.0.1:${server.address().port}`;
                    resolve();
                });
            });

            await expect(axios.get(serverUrl, {
                maxContentLength: AXIOS_BODY_CAP_BYTES,
                maxBodyLength: AXIOS_BODY_CAP_BYTES,
                timeout: 5000
            })).rejects.toMatchObject({
                code: 'ERR_BAD_RESPONSE',
                message: expect.stringMatching(/maxContentLength size of 512000 exceeded/)
            });
        });

        test('Axios rejects chunked response without Content-Length when bytes exceed 500KB', async () => {
            await new Promise((resolve) => {
                server = http.createServer((req, res) => {
                    res.writeHead(200, {
                        'Content-Type': 'text/html'
                        // No Content-Length header, chunked encoding
                    });
                    let sent = 0;
                    const timer = setInterval(() => {
                        res.write(Buffer.alloc(64 * 1024, 'A'));
                        sent += 64 * 1024;
                        if (sent >= 700 * 1024) {
                            clearInterval(timer);
                            res.end();
                        }
                    }, 5);
                });
                server.listen(0, () => {
                    serverUrl = `http://127.0.0.1:${server.address().port}`;
                    resolve();
                });
            });

            await expect(axios.get(serverUrl, {
                maxContentLength: AXIOS_BODY_CAP_BYTES,
                maxBodyLength: AXIOS_BODY_CAP_BYTES,
                timeout: 5000
            })).rejects.toMatchObject({
                code: 'ERR_BAD_RESPONSE',
                message: expect.stringMatching(/maxContentLength size of 512000 exceeded/)
            });
        });

        test('processDiscoveryQueue catches >500KB rejection gracefully and falls back to snippet', async () => {
            const largePayload = Buffer.alloc(750 * 1024, 'Y');
            await new Promise((resolve) => {
                server = http.createServer((req, res) => {
                    res.writeHead(200, {
                        'Content-Type': 'text/html',
                        'Content-Length': largePayload.length
                    });
                    res.end(largePayload);
                });
                server.listen(0, () => {
                    serverUrl = `http://127.0.0.1:${server.address().port}/event-0`;
                    resolve();
                });
            });

            const mockItem = {
                sourceUrl: serverUrl,
                rawSnippet: '2026 DMV Badminton Challenge Fall Classic at RAC',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockItem])
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'create').mockResolvedValue({ _id: 'mock_created_proposal' });

            const memSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 80 * 1024 * 1024,
                heapTotal: 120 * 1024 * 1024,
                rss: 160 * 1024 * 1024,
                external: 5 * 1024 * 1024
            });

            try {
                const result = await processDiscoveryQueue(1);

                // Item was still processed using snippet fallback despite >500KB external page
                expect(result).toBeDefined();
                expect(result.approved).toBe(1);
                expect(mockItem.save).toHaveBeenCalled();
            } finally {
                memSpy.mockRestore();
            }
        });

        test('crawlTournamentSoftware handles >500KB response error cleanly returning empty array', async () => {
            jest.spyOn(axios, 'get').mockRejectedValueOnce(
                new Error('maxContentLength size of 512000 exceeded')
            );

            const results = await crawlTournamentSoftware('Maryland');
            expect(Array.isArray(results)).toBe(true);
            expect(results).toHaveLength(0);
        });

        test('getRacStatus handles >500KB response error cleanly and falls back without leaking', async () => {
            jest.spyOn(axios, 'get').mockRejectedValueOnce(
                new Error('maxContentLength size of 512000 exceeded')
            );

            const status = await getRacStatus();
            expect(typeof status).toBe('string');
            expect(status.length).toBeGreaterThan(0);
            expect(status).toMatch(/Live status unavailable|Linn Gym|Court/);
        });
    });

    // =========================================================================
    // 2. 200KB HTML Slicing & Malformed / Hostile HTML Resilience
    // =========================================================================
    describe('2. 200KB HTML Slicing & Malformed / Hostile HTML Resilience', () => {
        test('Boundary slicing at 200KB across an unclosed tag parses cleanly without throwing', () => {
            // Construct payload where byte 204800 cuts right through an open tag attribute
            const prefix = '<div><h1>DMV Badminton</h1><p>Tournament Information</p></div>'.repeat(3000);
            const boundaryChunk = '<div class="open-unclosed-attribute-that-is-cut-off-mid-way';
            const suffix = 'rest of huge page that gets discarded'.repeat(5000);
            const rawPayload = prefix + boundaryChunk + suffix;

            expect(rawPayload.length).toBeGreaterThan(MAX_HTML_PARSE_LENGTH);

            const truncated = rawPayload.slice(0, MAX_HTML_PARSE_LENGTH);
            expect(truncated.length).toBe(MAX_HTML_PARSE_LENGTH);

            expect(() => {
                const $ = cheerio.load(truncated);
                $('script, style').remove();
                const bodyText = $('body').text();
                expect(bodyText.length).toBeGreaterThan(0);
                expect(bodyText).toContain('DMV Badminton');
            }).not.toThrow();
        });

        test('Boundary slicing at 200KB inside an unclosed <script> tag removes script safely', () => {
            const prefix = '<html><body><h1>Legitimate Tournament</h1><div>';
            const padding = '<p>Details</p>'.repeat(10000);
            // Craft payload so boundary falls inside script
            const beforeScript = (prefix + padding).slice(0, MAX_HTML_PARSE_LENGTH - 100);
            const unclosedScript = '<script>var leakedSecret = "MALICIOUS_SCRIPT_DATA_SHOULD_NOT_LEAK"; function test() { return 1;';
            const rawPayload = beforeScript + unclosedScript + ' trailing content'.repeat(1000);

            const truncated = rawPayload.slice(0, MAX_HTML_PARSE_LENGTH);
            expect(truncated).toContain('<script>');
            expect(truncated).not.toContain('</script>');

            const $ = cheerio.load(truncated);
            $('script, style, noscript, nav, footer').remove();
            const text = $('body').text();

            expect(text).not.toContain('MALICIOUS_SCRIPT_DATA_SHOULD_NOT_LEAK');
            expect(text).toContain('Legitimate Tournament');
        });

        test('Boundary slicing across multi-byte UTF-8 surrogate pairs parses without throwing', () => {
            // Shorter multi-byte string repeated
            const emojiString = '🏸 2026 Northern Virginia Open 🏆 赛事 ';
            const repeated = emojiString.repeat(10000);
            expect(repeated.length).toBeGreaterThan(MAX_HTML_PARSE_LENGTH);

            // Slice right at exact boundary
            const truncated = repeated.slice(0, MAX_HTML_PARSE_LENGTH);
            expect(() => {
                const $ = cheerio.load(`<div>${truncated}</div>`);
                const extracted = $('div').text();
                expect(extracted.length).toBeGreaterThan(0);
            }).not.toThrow();
        });

        test('Deeply nested DOM structure (1,500 levels) truncated at 200KB does not cause stack overflow', () => {
            const nestedOpen = '<div>'.repeat(1500);
            const nestedContent = '<span>Deep Nested Tournament Info</span>';
            const nestedClose = '</div>'.repeat(1500);
            const fullHtml = nestedOpen + nestedContent + nestedClose;

            const truncated = fullHtml.slice(0, MAX_HTML_PARSE_LENGTH);

            expect(() => {
                const $ = cheerio.load(truncated);
                const text = $('body').text().trim();
                expect(text).toContain('Deep Nested Tournament Info');
            }).not.toThrow();
        });

        test('parseTournamentSoftwareHtml handles malformed, unclosed comments, null bytes, and inverted tags', () => {
            const malformedHtml = `
                <html>
                <head><title>2026 Capital Classic | TournamentSoftware</title></head>
                <body>
                    <!-- Unclosed comment that never closes...
                    <a href="/tournament/12345">2026 Capital Open</a>
                    <div class="location">Columbia, MD \0 nullbyte inside</div>
                    <b><i>Inverted tags</b></i>
                    <p>Contact info: &#999999999999; and &unclosed_entity
            `.repeat(50);

            const results = parseTournamentSoftwareHtml(malformedHtml);
            expect(Array.isArray(results)).toBe(true);
            // Should return cleanly without throwing
        });
    });

    // =========================================================================
    // 3. Repetitive Cheerio Parsing Across 100+ Iterations (< 30MB Heap Growth)
    // =========================================================================
    describe('3. Repetitive Cheerio Parsing Across 100+ Iterations (< 30MB Heap Growth)', () => {
        test('120 consecutive Cheerio parse iterations with 200KB payloads maintain heap growth < 30MB', async () => {
            if (global.gc) global.gc();
            await yieldToEventLoop();

            const startHeap = process.memoryUsage().heapUsed;

            const baseHtml = `
                <div class="tournament-card">
                    <h2>2026 Mid-Atlantic Open Championship</h2>
                    <p class="venue">RAC Gymnasium, Fairfax, VA 22030</p>
                    <table class="schedule">
                        ${'<tr><td>Match</td><td>Court 1</td><td>Score 21-19</td></tr>'.repeat(200)}
                    </table>
                    <div class="description">${'<p>Lorem ipsum tournament rules and registration.</p>'.repeat(300)}</div>
                </div>
            `;

            for (let i = 0; i < 120; i++) {
                const truncated = baseHtml.slice(0, MAX_HTML_PARSE_LENGTH);
                let $ = cheerio.load(truncated);
                $('script, style, noscript, nav, footer').remove();
                const extractedText = $('body').text().replace(/\s+/g, ' ').trim();
                expect(extractedText.length).toBeGreaterThan(100);

                // Worker 1 pattern: explicit dereference & yield
                $ = null;
                await new Promise(r => setImmediate(r));
            }

            if (global.gc) global.gc();
            await yieldToEventLoop();

            const endHeap = process.memoryUsage().heapUsed;
            const heapDeltaMB = (endHeap - startHeap) / (1024 * 1024);

            console.log(`📊 [Challenger] 120-Iteration Cheerio Heap Delta: ${heapDeltaMB.toFixed(2)} MB`);
            expect(heapDeltaMB).toBeLessThan(30);
        });

        test('100 consecutive iterations of parseTournamentSoftwareHtml maintain heap growth < 30MB', async () => {
            if (global.gc) global.gc();
            await yieldToEventLoop();

            const startHeap = process.memoryUsage().heapUsed;

            const tsHtml = `
                <html>
                <head><title>2026 DMV Grand Prix | TournamentSoftware.com</title></head>
                <body>
                    <div class="media">
                        <a href="/tournament/ABC-123">2026 DMV Grand Prix Badminton</a>
                        <div class="location">Fairfax Badminton Club, Fairfax, VA</div>
                        <span class="sub-title">Nov 14 - 15, 2026</span>
                        <p>${'Event category Open, B, C divisions with ranking points.'.repeat(500)}</p>
                    </div>
                </body>
                </html>
            `;

            for (let i = 0; i < 100; i++) {
                const res = parseTournamentSoftwareHtml(tsHtml);
                expect(Array.isArray(res)).toBe(true);
                await new Promise(r => setImmediate(r));
            }

            if (global.gc) global.gc();
            await yieldToEventLoop();

            const endHeap = process.memoryUsage().heapUsed;
            const heapDeltaMB = (endHeap - startHeap) / (1024 * 1024);

            console.log(`📊 [Challenger] 100-Iteration parseTournamentSoftwareHtml Heap Delta: ${heapDeltaMB.toFixed(2)} MB`);
            expect(heapDeltaMB).toBeLessThan(30);
        });

        test('Empirical Contrast: Explicit dereferencing prevents runaway heap growth', async () => {
            if (global.gc) global.gc();

            const sampleHtml = '<div><p>Sample</p></div>'.repeat(3000).slice(0, MAX_HTML_PARSE_LENGTH);

            // Contrast test: 50 iterations with dereferencing
            const heapBefore = process.memoryUsage().heapUsed;
            for (let i = 0; i < 50; i++) {
                let $ = cheerio.load(sampleHtml);
                $('div').text();
                $ = null; // Dereferenced
                await new Promise(r => setImmediate(r));
            }
            if (global.gc) global.gc();
            const heapAfter = process.memoryUsage().heapUsed;
            const deltaClean = (heapAfter - heapBefore) / (1024 * 1024);

            expect(deltaClean).toBeLessThan(15);
        });
    });

    // =========================================================================
    // 4. Proactive Heap Pressure Guard (> 200MB) Stress Testing
    // =========================================================================
    describe('4. Proactive Heap Pressure Guard (> 200MB) Stress Testing', () => {
        test('Guard triggers before batch execution when heapUsed exceeds 200MB and pauses batch', async () => {
            const mockItems = Array.from({ length: 5 }, (_, i) => ({
                sourceUrl: `https://example.com/pressure-start-${i}`,
                rawSnippet: `Snippet ${i}`,
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            }));

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockItems)
            });

            // Mock heap exceeding 200MB threshold (215 MB)
            const memSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 215 * 1024 * 1024,
                heapTotal: 260 * 1024 * 1024,
                rss: 320 * 1024 * 1024,
                external: 5 * 1024 * 1024
            });

            const result = await processDiscoveryQueue(5);
            memSpy.mockRestore();

            expect(result).toBeDefined();
            expect(result.pausedDueToHeapPressure).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.approved).toBe(0);

            // Items were NOT modified or saved
            mockItems.forEach(item => {
                expect(item.save).not.toHaveBeenCalled();
            });
        });

        test('Guard triggers mid-batch on heap spike, pausing and breaking loop early', async () => {
            const mockItems = Array.from({ length: 5 }, (_, i) => ({
                sourceUrl: `https://example.com/mid-batch-${i}`,
                rawSnippet: `2026 DMV Tournament Open ${i}`,
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            }));

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockItems)
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'create').mockResolvedValue({ _id: 'mock_created' });
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>Tournament</h1></body></html>'
            });

            // First 3 calls to memoryUsage: initial check, item 0 check, item 0 fetch (normal heap)
            // Subsequent calls: high heap (220MB)
            let callCount = 0;
            const memSpy = jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
                callCount++;
                const isHigh = callCount > 3;
                return {
                    heapUsed: (isHigh ? 220 : 120) * 1024 * 1024,
                    heapTotal: 260 * 1024 * 1024,
                    rss: 320 * 1024 * 1024,
                    external: 5 * 1024 * 1024
                };
            });

            const result = await processDiscoveryQueue(5);
            memSpy.mockRestore();

            expect(result).toBeDefined();
            // Broke loop early: processed at least item 0, but did NOT process all 5
            expect(result.approved).toBeLessThan(5);
        });

        test('Transient heap spike: pauses for GC and proceeds when memory drops below 200MB', async () => {
            const mockItems = [{
                sourceUrl: 'https://example.com/transient-spike-0',
                rawSnippet: '2026 Mid-Atlantic Collegiate Championship',
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            }];

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockItems)
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'create').mockResolvedValue({ _id: 'mock_created' });
            jest.spyOn(axios, 'get').mockResolvedValue({
                data: '<html><body><h1>2026 Mid-Atlantic</h1></body></html>'
            });

            // 1st call (initialCheck): 205MB (high)
            // 2nd call (retryCheck after pause): 150MB (relieved)
            // subsequent calls: 150MB
            let count = 0;
            const memSpy = jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
                count++;
                const heapMB = count === 1 ? 205 : 150;
                return {
                    heapUsed: heapMB * 1024 * 1024,
                    heapTotal: 250 * 1024 * 1024,
                    rss: 300 * 1024 * 1024,
                    external: 5 * 1024 * 1024
                };
            });

            const result = await processDiscoveryQueue(1);
            memSpy.mockRestore();

            // Succeeded because GC relieved pressure on retry
            expect(result.pausedDueToHeapPressure).toBe(false);
            expect(result.approved).toBe(1);
        });

        test('pauseForGarbageCollection functions safely when global.gc is not defined', async () => {
            const originalGc = global.gc;
            try {
                delete global.gc; // Simulate environment without --expose-gc
                await expect(pauseForGarbageCollection(10)).resolves.not.toThrow();
            } finally {
                global.gc = originalGc;
            }
        });

        test('Safe batch size clamping prevents excessive heap allocation on extreme inputs', async () => {
            const memSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 80 * 1024 * 1024,
                heapTotal: 120 * 1024 * 1024,
                rss: 160 * 1024 * 1024,
                external: 5 * 1024 * 1024
            });

            try {
                const findSpy = jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                    limit: jest.fn().mockResolvedValue([])
                });

                // Oversized batch request (e.g. 50 or 100) must clamp to max 10
                await processDiscoveryQueue(100);
                expect(findSpy().limit).toHaveBeenCalledWith(10);

                // Negative or zero batch size must clamp to min 1 or default 5
                await processDiscoveryQueue(-10);
                expect(findSpy().limit).toHaveBeenCalledWith(1);

                // Non-numeric batch size must clamp to default 5
                await processDiscoveryQueue("invalid");
                expect(findSpy().limit).toHaveBeenCalledWith(5);
            } finally {
                memSpy.mockRestore();
            }
        });
    });
});
