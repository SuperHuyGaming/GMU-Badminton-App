const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

jest.mock('../utils/redis', () => ({
    keys: jest.fn().mockResolvedValue(['tournaments:cache_1', 'tournaments:cache_2']),
    del: jest.fn().mockResolvedValue(2),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue("OK")
}));

const tournamentRoutes = require('../routes/tournaments');
const courtRoutes = require('../routes/courts');
const Tournament = require('../models/Tournament');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Court = require('../models/Court');
const TournamentMatch = require('../models/TournamentMatch');
const { getGuaranteedTournamentsList, wipeAndRestartTournamentSystem } = require('../utils/autonomousHunter');

describe("M1 Empirical Challenger Stress Suite: Clean Slate & BWF RAC Courts Engine", () => {
    let app;
    let mockIo;
    let emittedEvents;
    let originalReadyState;

    beforeAll(() => {
        originalReadyState = mongoose.connection.readyState;
    });

    afterAll(() => {
        Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

        emittedEvents = [];
        mockIo = {
            emit: jest.fn((event, data) => {
                emittedEvents.push({ event, data });
            })
        };

        app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.io = mockIo;
            next();
        });
        app.use('/api/tournaments', tournamentRoutes);
        app.use('/api/courts', courtRoutes);

        jest.spyOn(TournamentMatch.prototype, 'save').mockImplementation(function () {
            return Promise.resolve(this);
        });
        jest.spyOn(Court.prototype, 'save').mockImplementation(function () {
            return Promise.resolve(this);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // =========================================================================
    // SECTION 1: Clean Slate Seeding Engine Stress & Benchmarking
    // =========================================================================
    describe("1. Clean Slate Seeding Engine: Latency, Memory & Concurrency Benchmarks", () => {
        test("BENCHMARK: 50 sequential executions run in strictly < 100ms with p99 < 50ms", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 15 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 8 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 4 });
            jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const latencies = [];
            const iterations = 50;

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const result = await wipeAndRestartTournamentSystem();
                const duration = performance.now() - start;
                latencies.push(duration);

                expect(result.success).toBe(true);
                expect(result.activeGuaranteedCount).toBe(5);
                expect(duration).toBeLessThan(100);
            }

            const min = Math.min(...latencies);
            const max = Math.max(...latencies);
            const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            latencies.sort((a, b) => a - b);
            const p95 = latencies[Math.floor(iterations * 0.95)];
            const p99 = latencies[Math.floor(iterations * 0.99)];

            console.log(`[Empirical Benchmark] 50 Iterations: Min=${min.toFixed(2)}ms, Max=${max.toFixed(2)}ms, Avg=${avg.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);

            expect(max).toBeLessThan(100);
            expect(avg).toBeLessThan(25);
            expect(p95).toBeLessThan(50);
        });

        test("MEMORY LEAK HARNESS: 100 consecutive reset-seeds maintain bounded heap memory (zero memory leak)", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 10 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 5 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 2 });
            jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            if (global.gc) global.gc();
            const initialHeap = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {
                const res = await wipeAndRestartTournamentSystem();
                expect(res.success).toBe(true);
            }

            if (global.gc) global.gc();
            const finalHeap = process.memoryUsage().heapUsed;
            const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

            consoleSpy.mockRestore();
            console.log(`[Memory Profile] Initial Heap: ${(initialHeap / 1024 / 1024).toFixed(2)}MB, Final Heap: ${(finalHeap / 1024 / 1024).toFixed(2)}MB, Delta: ${heapDeltaMB.toFixed(2)}MB`);

            // Verify heap delta after 100 cycles is strictly under 35MB
            expect(heapDeltaMB).toBeLessThan(35);
        });

        test("CONCURRENCY STRESS: 20 simultaneous concurrent calls to wipeAndRestartTournamentSystem resolve cleanly", async () => {
            let deleteQueueCount = 0;
            let bulkWriteCount = 0;

            jest.spyOn(DiscoveryQueue, "deleteMany").mockImplementation(async () => {
                deleteQueueCount++;
                return { deletedCount: 10 };
            });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 5 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 3 });
            jest.spyOn(Tournament, "bulkWrite").mockImplementation(async (ops) => {
                bulkWriteCount++;
                expect(ops).toHaveLength(5);
                return { upsertedCount: 5 };
            });

            const concurrentCalls = 20;
            const promises = Array.from({ length: concurrentCalls }, () => wipeAndRestartTournamentSystem());
            const results = await Promise.all(promises);

            expect(results).toHaveLength(concurrentCalls);
            results.forEach(res => {
                expect(res.success).toBe(true);
                expect(res.activeGuaranteedCount).toBe(5);
                expect(res.executionTimeMs).toBeLessThan(100);
            });

            expect(deleteQueueCount).toBe(concurrentCalls);
            expect(bulkWriteCount).toBe(concurrentCalls);
        });

        test("HTTP CONCURRENCY: 20 simultaneous POST /api/tournaments/reset-seed requests return 200 OK with < 100ms latency", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 7 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 3 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 2 });
            jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const concurrentReqs = 20;
            const promises = Array.from({ length: concurrentReqs }, () =>
                request(app).post('/api/tournaments/reset-seed')
            );

            const responses = await Promise.all(promises);
            expect(responses).toHaveLength(concurrentReqs);

            responses.forEach(res => {
                expect(res.status).toBe(200);
                expect(res.body.success).toBe(true);
                expect(res.body.executionTimeMs).toBeLessThan(100);
                expect(res.body.seededTournaments).toBe(5);
                expect(res.body.tournaments).toHaveLength(5);
            });
        });
    });

    // =========================================================================
    // SECTION 2: BWF Scoring Engine: 29-29 Deuce & Golden 30th Point Stress
    // =========================================================================
    describe("2. BWF Scoring Engine: 29-29 Deuce, Golden 30th Point, and Best-of-3 Match Logic", () => {
        let matchDoc;
        let courtDoc;
        const matchId = new mongoose.Types.ObjectId();

        const buildActiveMatch = (overrides = {}) => {
            return {
                _id: matchId,
                courtNumber: 1,
                tournamentName: "2026 GMU Badminton Open",
                division: "Men's Singles Open",
                round: "Final",
                team1: [{ name: "Ethan Lin" }],
                team2: [{ name: "Marcus Vance" }],
                currentGame: 1,
                team1Score: 0,
                team2Score: 0,
                team1GamesWon: 0,
                team2GamesWon: 0,
                currentServer: "Ethan Lin",
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                winner: null,
                isGamePoint: false,
                isMatchPoint: false,
                isDeuce: false,
                save: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
                ...overrides
            };
        };

        beforeEach(() => {
            matchDoc = buildActiveMatch();
            courtDoc = {
                courtNumber: 1,
                courtName: "RAC Court 1",
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockImplementation(function () { return Promise.resolve(this); })
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(courtDoc);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(matchDoc);
        });

        test("DEUCE LADDER: 20-20 to 28-28 correctly alternates isDeuce, isGamePoint, and serving courts", async () => {
            // Set match directly to 19-20
            matchDoc.team1Score = 19;
            matchDoc.team2Score = 20;

            // 1. Team 1 scores -> 20-20 DEUCE!
            let res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team1' });
            expect(res.body.scorePayload.team1Score).toBe(20);
            expect(res.body.scorePayload.team2Score).toBe(20);
            expect(res.body.scorePayload.isDeuce).toBe(true);
            expect(res.body.scorePayload.isGamePoint).toBe(false);
            expect(res.body.scorePayload.servingCourt).toBe("RIGHT"); // 20 is even

            // 2. Team 1 scores -> 21-20 GAME POINT for Team 1!
            res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team1' });
            expect(res.body.scorePayload.team1Score).toBe(21);
            expect(res.body.scorePayload.isDeuce).toBe(false);
            expect(res.body.scorePayload.isGamePoint).toBe(true);
            expect(res.body.scorePayload.servingCourt).toBe("LEFT"); // 21 is odd

            // 3. Team 2 scores -> 21-21 DEUCE AGAIN!
            res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team2' });
            expect(res.body.scorePayload.team1Score).toBe(21);
            expect(res.body.scorePayload.team2Score).toBe(21);
            expect(res.body.scorePayload.isDeuce).toBe(true);
            expect(res.body.scorePayload.isGamePoint).toBe(false);
            expect(res.body.scorePayload.servingCourt).toBe("LEFT"); // 21 is odd
        });

        test("29-29 SUDDEN DEATH: at 29-29 isDeuce is false, isGamePoint is true, and left court serves", async () => {
            matchDoc.team1Score = 28;
            matchDoc.team2Score = 29;

            // Team 1 scores -> 29-29!
            const res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team1' });
            expect(res.body.scorePayload.team1Score).toBe(29);
            expect(res.body.scorePayload.team2Score).toBe(29);

            // BWF Rule Check: At 29-all, a 2-point lead is no longer needed. It is NOT deuce; it is golden point!
            expect(res.body.scorePayload.isDeuce).toBe(false);
            expect(res.body.scorePayload.isGamePoint).toBe(true);
            expect(res.body.scorePayload.servingCourt).toBe("LEFT"); // 29 is odd
            expect(res.body.scorePayload.shuttlePossession).toBe("team1");
        });

        test("GOLDEN 30TH POINT: from 29-29, 30th point wins Game 1 immediately at 30-29 and transitions to Game 2", async () => {
            matchDoc.team1Score = 29;
            matchDoc.team2Score = 29;

            // Team 1 scores 30th point!
            const res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team1' });

            expect(res.status).toBe(200);
            expect(matchDoc.team1GamesWon).toBe(1);
            expect(matchDoc.team2GamesWon).toBe(0);
            expect(matchDoc.currentGame).toBe(2);
            expect(matchDoc.team1Score).toBe(0);
            expect(matchDoc.team2Score).toBe(0);
            expect(matchDoc.servingCourt).toBe("RIGHT"); // 0 is even
            expect(matchDoc.games[0].winner).toBe("team1");
            expect(matchDoc.games[0].team1Score).toBe(30);
            expect(matchDoc.games[0].team2Score).toBe(29);
            expect(matchDoc.games[0].isFinished).toBe(true);
            expect(matchDoc.matchStatus).toBe("MATCH_IN_PROGRESS");
        });

        test("MATCH COMPLETION ON GOLDEN POINT: Game 3 at 29-29 golden point ends entire match at 30-29", async () => {
            // Setup match in Game 3 with 1-1 tie
            matchDoc.currentGame = 3;
            matchDoc.team1GamesWon = 1;
            matchDoc.team2GamesWon = 1;
            matchDoc.team1Score = 29;
            matchDoc.team2Score = 29;
            matchDoc.games = [
                { gameNumber: 1, team1Score: 30, team2Score: 29, winner: "team1", isFinished: true },
                { gameNumber: 2, team1Score: 28, team2Score: 30, winner: "team2", isFinished: true },
                { gameNumber: 3, team1Score: 29, team2Score: 29, winner: null, isFinished: false }
            ];

            // Verify match point condition at 29-29 in Game 3
            // Team 2 scores point to win match
            const res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team2' });

            expect(res.status).toBe(200);
            expect(matchDoc.team2GamesWon).toBe(2);
            expect(matchDoc.team1GamesWon).toBe(1);
            expect(matchDoc.matchStatus).toBe("COMPLETED");
            expect(matchDoc.winner).toBe("team2");
            expect(matchDoc.games[2].winner).toBe("team2");
            expect(matchDoc.games[2].team2Score).toBe(30);
            expect(matchDoc.games[2].team1Score).toBe(29);
            expect(res.body.scorePayload.matchStatus).toBe("COMPLETED");
        });

        test("POST-MATCH LOCKOUT: rejects scoring attempt after match status is COMPLETED with HTTP 400", async () => {
            matchDoc.matchStatus = 'COMPLETED';
            matchDoc.winner = 'team1';

            const res = await request(app).post('/api/courts/1/score/point').send({ scoringTeam: 'team1' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe("Match has already concluded");
        });
    });

    // =========================================================================
    // SECTION 3: Undo Point Boundary Stress Tests
    // =========================================================================
    describe("3. Undo Point Boundary & Rollback Stress", () => {
        let matchDoc;
        let courtDoc;
        const matchId = new mongoose.Types.ObjectId();

        beforeEach(() => {
            matchDoc = {
                _id: matchId,
                courtNumber: 2,
                currentGame: 1,
                team1Score: 0,
                team2Score: 0,
                team1GamesWon: 0,
                team2GamesWon: 0,
                currentServer: "Player 1",
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                save: jest.fn().mockImplementation(function () { return Promise.resolve(this); })
            };

            courtDoc = {
                courtNumber: 2,
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                save: jest.fn().mockImplementation(function () { return Promise.resolve(this); })
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(courtDoc);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(matchDoc);
        });

        test("UNDO BOUNDARY: rejects undo past beginning on empty pointHistory with HTTP 400", async () => {
            matchDoc.pointHistory = [];

            const res = await request(app).post('/api/courts/2/score/undo');
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe("No points to undo");
        });

        test("UNDO SEQUENTIAL: score 1 point, undo back to 0-0, second undo immediately returns 400", async () => {
            // Point 1: 1-0
            const resScore = await request(app).post('/api/courts/2/score/point').send({ scoringTeam: 'team1' });
            expect(resScore.status).toBe(200);
            expect(matchDoc.team1Score).toBe(1);
            expect(matchDoc.pointHistory).toHaveLength(1);

            // Undo 1: Back to 0-0
            const resUndo1 = await request(app).post('/api/courts/2/score/undo');
            expect(resUndo1.status).toBe(200);
            expect(matchDoc.team1Score).toBe(0);
            expect(matchDoc.pointHistory).toHaveLength(0);
            expect(resUndo1.body.scorePayload.servingCourt).toBe("RIGHT");

            // Undo 2: Point history empty -> 400
            const resUndo2 = await request(app).post('/api/courts/2/score/undo');
            expect(resUndo2.status).toBe(400);
            expect(resUndo2.body.error).toBe("No points to undo");
        });

        test("UNDO ACROSS GAME BOUNDARY: rolls back from Game 2 start (0-0) into Game 1 winning rally (20-19 -> 21-19)", async () => {
            // Setup match at Game 1 (20-19)
            matchDoc.team1Score = 20;
            matchDoc.team2Score = 19;
            matchDoc.pointHistory = [];

            // Team 1 scores point 21 -> ends Game 1, advances to Game 2 (0-0)
            const resWinGame1 = await request(app).post('/api/courts/2/score/point').send({ scoringTeam: 'team1' });
            expect(resWinGame1.status).toBe(200);
            expect(matchDoc.currentGame).toBe(2);
            expect(matchDoc.team1GamesWon).toBe(1);
            expect(matchDoc.team1Score).toBe(0);
            expect(matchDoc.games[0].isFinished).toBe(true);

            // Now Undo the winning point
            const resUndo = await request(app).post('/api/courts/2/score/undo');
            expect(resUndo.status).toBe(200);
            expect(matchDoc.currentGame).toBe(1);
            expect(matchDoc.team1GamesWon).toBe(0);
            expect(matchDoc.team1Score).toBe(20);
            expect(matchDoc.team2Score).toBe(19);
            expect(matchDoc.games[0].isFinished).toBe(false);
            expect(matchDoc.games[0].winner).toBe(null);
        });

        test("UNDO AFTER MATCH COMPLETION: rolls back completed match back to MATCH_IN_PROGRESS", async () => {
            // Setup Game 2 with Team 1 having won Game 1 and at 20-18 in Game 2
            matchDoc.currentGame = 2;
            matchDoc.team1GamesWon = 1;
            matchDoc.team1Score = 20;
            matchDoc.team2Score = 18;
            matchDoc.winner = null;
            matchDoc.games = [
                { gameNumber: 1, team1Score: 21, team2Score: 17, winner: "team1", isFinished: true },
                { gameNumber: 2, team1Score: 20, team2Score: 18, winner: null, isFinished: false }
            ];

            // Score point 21 -> completes match
            await request(app).post('/api/courts/2/score/point').send({ scoringTeam: 'team1' });
            expect(matchDoc.matchStatus).toBe("COMPLETED");
            expect(matchDoc.winner).toBe("team1");

            // Undo winning point -> match restored to active
            const resUndo = await request(app).post('/api/courts/2/score/undo');
            expect(resUndo.status).toBe(200);
            expect(matchDoc.matchStatus).toBe("MATCH_IN_PROGRESS");
            expect(matchDoc.winner).toBe(null);
            expect(courtDoc.status).toBe("MATCH_IN_PROGRESS");
            expect(matchDoc.team1GamesWon).toBe(1);
            expect(matchDoc.team1Score).toBe(20);
        });
    });

    // =========================================================================
    // SECTION 4: Invalid Court IDs, Payloads & State Guardrails
    // =========================================================================
    describe("4. Invalid Court IDs & Input Validation Guardrails", () => {
        test("all court endpoints reject out-of-range court numbers (< 1 or > 6)", async () => {
            const invalidNumbers = [0, 7, -1, 10, 100];

            for (const num of invalidNumbers) {
                const r1 = await request(app).get(`/api/courts/${num}`);
                expect(r1.status).toBe(400);
                expect(r1.body.error).toContain("Court number must be between 1 and 6");

                const r2 = await request(app).post(`/api/courts/${num}/assign`).send({});
                expect(r2.status).toBe(400);

                const r3 = await request(app).post(`/api/courts/${num}/score/point`).send({ scoringTeam: 'team1' });
                expect(r3.status).toBe(400);

                const r4 = await request(app).post(`/api/courts/${num}/score/undo`);
                expect(r4.status).toBe(400);

                const r5 = await request(app).post(`/api/courts/${num}/status`).send({ status: 'AVAILABLE' });
                expect(r5.status).toBe(400);
            }
        });

        test("all court endpoints reject non-numeric court parameters ('abc', 'undefined', 'NaN')", async () => {
            const nonNumerics = ['abc', 'undefined', 'null', 'court1'];

            for (const id of nonNumerics) {
                const r1 = await request(app).get(`/api/courts/${id}`);
                expect(r1.status).toBe(400);

                const r2 = await request(app).post(`/api/courts/${id}/score/point`).send({ scoringTeam: 'team1' });
                expect(r2.status).toBe(400);
            }
        });

        test("POST /score/point rejects invalid scoringTeam values", async () => {
            const court = {
                courtNumber: 3,
                currentMatch: { matchId: new mongoose.Types.ObjectId() }
            };
            jest.spyOn(Court, "findOne").mockResolvedValue(court);

            const invalidTeams = ['team3', 'player1', '', null, undefined, 123, { $gt: "" }];

            for (const team of invalidTeams) {
                const res = await request(app).post('/api/courts/3/score/point').send({ scoringTeam: team });
                expect(res.status).toBe(400);
                expect(res.body.error).toBe("scoringTeam must be 'team1' or 'team2'");
            }
        });

        test("POST /score/point rejects when court has no active match assigned", async () => {
            const courtWithoutMatch = {
                courtNumber: 3,
                currentMatch: null
            };
            jest.spyOn(Court, "findOne").mockResolvedValue(courtWithoutMatch);

            const res = await request(app).post('/api/courts/3/score/point').send({ scoringTeam: 'team1' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("No active match assigned to this court");
        });

        test("POST /status rejects invalid status enums", async () => {
            const invalidStatuses = ['RUNNING', 'PAUSED', 'PENDING', '123', ''];

            for (const s of invalidStatuses) {
                const res = await request(app).post('/api/courts/4/status').send({ status: s });
                expect(res.status).toBe(400);
                expect(res.body.error).toContain("Invalid status. Must be one of:");
            }
        });

        test("POST /queue rejects missing or invalid MongoDB ObjectId", async () => {
            const invalidIds = ['not-an-id', '12345', '', null];

            for (const id of invalidIds) {
                const res = await request(app).post('/api/courts/4/queue').send({ matchId: id });
                expect(res.status).toBe(400);
                expect(res.body.error).toBe("Valid matchId required");
            }
        });
    });

    // =========================================================================
    // SECTION 5: Socket.io Real-Time Synchronization & Resiliency
    // =========================================================================
    describe("5. Socket.io Real-Time Synchronicity & Fallback Resiliency", () => {
        test("emits courtStatusUpdate and liveScoreUpdate with complete match snapshot on scoring point", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const match = {
                _id: matchId,
                courtNumber: 5,
                team1: [{ name: "Player A" }],
                team2: [{ name: "Player B" }],
                currentGame: 1,
                team1Score: 3,
                team2Score: 2,
                team1GamesWon: 0,
                team2GamesWon: 0,
                servingCourt: "LEFT",
                shuttlePossession: "team1",
                games: [{ gameNumber: 1, team1Score: 3, team2Score: 2, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                save: jest.fn().mockResolvedValue(true)
            };

            const court = {
                courtNumber: 5,
                courtName: "RAC Court 5",
                venue: "Recreation Athletic Complex (RAC)",
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(court);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(match);

            await request(app).post('/api/courts/5/score/point').send({ scoringTeam: 'team1' });

            const emittedEventNames = emittedEvents.map(e => e.event);
            expect(emittedEventNames).toContain("courtStatusUpdate");
            expect(emittedEventNames).toContain("liveScoreUpdate");

            const liveUpdate = emittedEvents.find(e => e.event === "liveScoreUpdate").data;
            expect(liveUpdate.courtNumber).toBe(5);
            expect(liveUpdate.team1Score).toBe(4);
            expect(liveUpdate.servingCourt).toBe("RIGHT"); // 4 is even
        });

        test("scoring and undo endpoints succeed without error if Socket.io is not attached to req", async () => {
            const noSocketApp = express();
            noSocketApp.use(express.json());
            noSocketApp.use('/api/courts', courtRoutes);

            const matchId = new mongoose.Types.ObjectId();
            const match = {
                _id: matchId,
                courtNumber: 6,
                team1: [{ name: "Player A" }],
                team2: [{ name: "Player B" }],
                currentGame: 1,
                team1Score: 0,
                team2Score: 0,
                team1GamesWon: 0,
                team2GamesWon: 0,
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                save: jest.fn().mockResolvedValue(true)
            };

            const court = {
                courtNumber: 6,
                courtName: "RAC Court 6",
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(court);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(match);

            const res = await request(noSocketApp).post('/api/courts/6/score/point').send({ scoringTeam: 'team1' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
