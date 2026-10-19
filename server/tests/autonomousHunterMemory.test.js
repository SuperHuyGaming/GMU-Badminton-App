/**
 * Test Suite: Autonomous Tournament Hunter Memory Bound & Heap Pressure Regression
 * File: server/tests/autonomousHunterMemory.test.js
 *
 * Verifies:
 * 1. inspectStartupMemory in server.js reports valid stats and detects memory configuration.
 * 2. Court schema possesses exactly one index on courtNumber with unique=true (no duplicates).
 * 3. processDiscoveryQueue executes within 200MB heap memory ceiling and activates heap pressure guard.
 * 4. Cheerio DOM parsing and HTML truncation maintain bounded memory growth across 50 iterations (< 30MB).
 * 5. runFullAutonomousHunt executes end-to-end cycle strictly below 200MB heap ceiling.
 */

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

const DISTINCT_TOURNAMENT_NAMES = [
    "2026 Mid-Atlantic Collegiate Championships",
    "2026 Northern Virginia Open Cup",
    "2026 Capital Badminton Classic",
    "2026 DC Metro Grand Prix",
    "2026 Patriot Invitational Tournament",
    "2026 Mason Gold Shuttlers Trophy",
    "2026 Old Dominion Badminton Showcase",
    "2026 Chesapeake Bay Smash Open",
    "2026 Potomac River Fall Classic",
    "2026 Blue Ridge Mountain Badminton Open"
];

jest.mock('../utils/aiParser', () => ({
    parseDiscoveredWebpage: jest.fn().mockImplementation((rawText, url) => {
        const idMatch = (url || '').match(/(\d+)$/);
        const index = idMatch ? parseInt(idMatch[1], 10) : 0;
        const name = DISTINCT_TOURNAMENT_NAMES[index % DISTINCT_TOURNAMENT_NAMES.length];
        return Promise.resolve({
            isValidDmvTournament: true,
            tournamentName: name,
            startDate: "2026-11-20",
            confidenceScore: 92
        });
    })
}));

const {
    processDiscoveryQueue,
    runFullAutonomousHunt,
    HEAP_PRESSURE_LIMIT_BYTES,
    MAX_HTML_PARSE_LENGTH,
    AXIOS_BODY_CAP_BYTES
} = require('../utils/autonomousHunter');

const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Tournament = require('../models/Tournament');
const Court = require('../models/Court');
const { inspectStartupMemory } = require('../server');

describe('Autonomous Hunter Memory & Heap Pressure Test Suite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('1. Startup Memory Inspection & Environment Detection', () => {
        test('inspectStartupMemory reports valid heap stats and detects low-heap environment', () => {
            const stats = inspectStartupMemory();
            expect(stats).toBeDefined();
            expect(stats.heapLimitMB).toBeGreaterThan(0);
            expect(stats.heapUsedMB).toBeGreaterThan(0);
            expect(stats.rssMB).toBeGreaterThan(0);
            expect(typeof stats.isRender).toBe('boolean');
        });
    });

    describe('2. Mongoose Court Model Schema Index Audit', () => {
        test('Court schema possesses exactly one index on courtNumber with unique=true (no duplicates)', () => {
            const indexes = Court.schema.indexes();
            const courtNumberIndexes = indexes.filter(([keys]) => keys.courtNumber !== undefined);
            
            // Must have exactly 1 index descriptor for courtNumber, and it must be unique
            expect(courtNumberIndexes).toHaveLength(1);
            expect(courtNumberIndexes[0][0]).toEqual({ courtNumber: 1 });
            expect(courtNumberIndexes[0][1]).toEqual({ unique: true });
        });
    });

    describe('3. Discovery Queue Processing Heap Bounds (< 200MB)', () => {
        test('processDiscoveryQueue executes 10 items without exceeding 200MB heapUsed and passes Axios caps', async () => {
            const sampleHtml = '<html><body><h1>2026 DMV Tournament</h1><p>Welcome to Open</p></body></html>';
            const axiosSpy = jest.spyOn(axios, 'get').mockResolvedValue({
                data: sampleHtml
            });

            const mockItems = Array.from({ length: 10 }, (_, i) => ({
                sourceUrl: `https://example.com/tournament-${i}`,
                rawSnippet: `DMU Badminton Championship 2026 Event ${i}`,
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            }));

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockItems)
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'create').mockResolvedValue({ _id: 'mock_proposal_id' });

            const initialHeapMB = process.memoryUsage().heapUsed / (1024 * 1024);
            const result = await processDiscoveryQueue(10);
            const peakHeapMB = process.memoryUsage().heapUsed / (1024 * 1024);

            expect(result.approved).toBe(10);
            expect(peakHeapMB).toBeLessThan(200);
            expect(peakHeapMB - initialHeapMB).toBeLessThan(35);

            // Verify Axios body caps were passed
            expect(axiosSpy).toHaveBeenCalled();
            const lastCallConfig = axiosSpy.mock.calls[0][1];
            expect(lastCallConfig.maxContentLength).toBe(AXIOS_BODY_CAP_BYTES);
            expect(lastCallConfig.maxBodyLength).toBe(AXIOS_BODY_CAP_BYTES);

            axiosSpy.mockRestore();
        });

        test('proactive heap pressure guard pauses processing when heap exceeds 200MB', async () => {
            const mockItems = Array.from({ length: 5 }, (_, i) => ({
                sourceUrl: `https://example.com/pressure-test-${i}`,
                rawSnippet: `Event ${i}`,
                sourceType: 'GOOGLE_SEARCH',
                status: 'PENDING_AI_REVIEW',
                save: jest.fn().mockResolvedValue(true)
            }));

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockItems)
            });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            // Simulate high heap pressure (> 200MB)
            const memSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 210 * 1024 * 1024,
                heapTotal: 250 * 1024 * 1024,
                rss: 300 * 1024 * 1024,
                external: 10 * 1024 * 1024
            });

            const result = await processDiscoveryQueue(5);
            memSpy.mockRestore();

            // Verify execution completed gracefully without throwing an unhandled OOM error
            expect(result).toBeDefined();
            expect(result.pausedDueToHeapPressure).toBe(true);
            expect(result.approved).toBeLessThanOrEqual(mockItems.length);
        });
    });

    describe('4. Cheerio DOM Dereferencing & Large HTML Truncation Memory Stability', () => {
        test('50 consecutive Cheerio parse iterations with 200KB HTML maintain bounded heap growth (< 30MB)', async () => {
            if (global.gc) global.gc();
            const startHeap = process.memoryUsage().heapUsed;

            const largeHtml = '<div>' + '<p>Tournament information paragraph</p>'.repeat(5000) + '</div>';

            for (let i = 0; i < 50; i++) {
                const truncated = largeHtml.slice(0, MAX_HTML_PARSE_LENGTH);
                let $ = cheerio.load(truncated);
                $('script, style').remove();
                const text = $('body').text().slice(0, 500);
                expect(text.length).toBeGreaterThan(0);
                $ = null; // Explicit dereferencing
                await new Promise(r => setImmediate(r)); // Yield microtask
            }

            if (global.gc) global.gc();
            const endHeap = process.memoryUsage().heapUsed;
            const heapDeltaMB = (endHeap - startHeap) / (1024 * 1024);

            expect(heapDeltaMB).toBeLessThan(30);
        });
    });

    describe('5. End-to-End runFullAutonomousHunt Memory Boundary', () => {
        test('runFullAutonomousHunt completes end-to-end cycle strictly below 200MB heapUsed', async () => {
            const sampleHtml = '<html><body><div class="media"><a href="/tournament/123">2026 Mid-Atlantic Open</a><span class="location">Virginia</span></div></body></html>';
            const axiosSpy = jest.spyOn(axios, 'get').mockResolvedValue({
                data: sampleHtml
            });

            jest.spyOn(DiscoveryQueue, 'find').mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
            });
            jest.spyOn(DiscoveryQueue, 'findOne').mockResolvedValue(null);
            jest.spyOn(DiscoveryQueue, 'create').mockResolvedValue({ _id: 'mock_doc' });
            jest.spyOn(Tournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            const result = await runFullAutonomousHunt();
            const peakHeapMB = process.memoryUsage().heapUsed / (1024 * 1024);

            expect(result).toHaveProperty('regionalClubs');
            expect(result).toHaveProperty('tournamentSoftware');
            expect(result).toHaveProperty('googleSearch');
            expect(result).toHaveProperty('queueProcessing');
            expect(peakHeapMB).toBeLessThan(200);

            axiosSpy.mockRestore();
        });
    });
});
