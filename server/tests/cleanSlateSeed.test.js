const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

jest.mock('../utils/redis', () => ({
    keys: jest.fn().mockResolvedValue(['tournaments:query1']),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue("OK")
}));

const tournamentRoutes = require('../routes/tournaments');
const Tournament = require('../models/Tournament');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const { getGuaranteedTournamentsList, wipeAndRestartTournamentSystem } = require('../utils/autonomousHunter');

const app = express();
app.use(express.json());
app.use('/api/tournaments', tournamentRoutes);

describe("R1: Tournament Clean Slate & Verified Data Seeding Suite", () => {
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
    });

    describe("1. Verified 2026/2027 Tournament Dataset & Division Matrix", () => {
        test("seeds all 5 verified collegiate and regional tournaments with normalized ISO dates", () => {
            const list = getGuaranteedTournamentsList();
            expect(list).toHaveLength(5);

            const names = list.map(t => t.tournamentName);
            expect(names).toContain("2026 GMU Badminton Open");
            expect(names).toContain("2026 Mid-Atlantic Collegiate Championships");
            expect(names).toContain("2026 Snowpeak DC Open");
            expect(names).toContain("2026 NVBC Spring Open");
            expect(names).toContain("2027 GMU Winter Collegiate Invitational");

            list.forEach(t => {
                expect(t.isOpenTournament).toBe(true);
                expect(t.status).toBe("active");
                expect(t.eventLocation).toBeDefined();
                expect(t.hostUniversity).toBeDefined();
                expect(new Date(t.startDate).toISOString()).toBeDefined();
                expect(new Date(t.endDate).toISOString()).toBeDefined();
                expect(new Date(t.registrationDeadline).toISOString()).toBeDefined();
                expect(new Date(t.startDate).getTime()).toBeLessThan(new Date(t.endDate).getTime());
                expect(new Date(t.registrationDeadline).getTime()).toBeLessThan(new Date(t.startDate).getTime());
            });
        });

        test("each verified tournament contains comprehensive division matrices (MS, WS, MD, WD, XD, Collegiate Flights)", () => {
            const list = getGuaranteedTournamentsList();

            const gmuOpen = list.find(t => t.tournamentName === "2026 GMU Badminton Open");
            expect(gmuOpen.divisions).toBeDefined();
            expect(gmuOpen.divisions.length).toBeGreaterThanOrEqual(8);

            const divisionCodes = gmuOpen.divisions.map(d => d.code);
            expect(divisionCodes).toContain("MS_OPEN");
            expect(divisionCodes).toContain("WS_OPEN");
            expect(divisionCodes).toContain("MD_OPEN");
            expect(divisionCodes).toContain("WD_OPEN");
            expect(divisionCodes).toContain("XD_OPEN");
            expect(divisionCodes).toContain("COL_FLIGHT_A");
            expect(divisionCodes).toContain("COL_FLIGHT_B");
            expect(divisionCodes).toContain("COL_FLIGHT_C");

            gmuOpen.divisions.forEach(d => {
                expect(d.name).toBeDefined();
                expect(d.maxDraw).toBeGreaterThan(0);
                expect(d.fee).toBeDefined();
                expect(d.feeAmount).toBeGreaterThan(0);
                expect(d.bracketType).toBeDefined();
            });

            const midAtlantic = list.find(t => t.tournamentName === "2026 Mid-Atlantic Collegiate Championships");
            expect(midAtlantic.divisions.some(d => d.code === "COL_DIV_1_TEAM")).toBe(true);

            const invitational2027 = list.find(t => t.tournamentName === "2027 GMU Winter Collegiate Invitational");
            expect(invitational2027.divisions.some(d => d.code === "COL_TEAM_A")).toBe(true);
            expect(new Date(invitational2027.startDate).getFullYear()).toBe(2027);
        });
    });

    describe("2. Clean Slate Purge & Seeding Engine Performance (< 100ms)", () => {
        test("wipeAndRestartTournamentSystem executes atomic bulkWrite and invalidates Redis cache in < 100ms", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 12 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 5 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 3 });
            const mockBulkWrite = jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const startTime = Date.now();
            const result = await wipeAndRestartTournamentSystem();
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(100);
            expect(result.success).toBe(true);
            expect(result.executionTimeMs).toBeLessThan(100);
            expect(result.clearedDiscoveryQueue).toBe(12);
            expect(result.clearedProposedTournaments).toBe(5);
            expect(result.purgedTournaments).toBe(3);
            expect(result.activeGuaranteedCount).toBe(5);
            expect(result.tournaments).toHaveLength(5);
            expect(mockBulkWrite).toHaveBeenCalled();
        });

        test("wipeAndRestartTournamentSystem does not inject seed tournaments when forceSeed is false (production mode)", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 2 });
            const mockBulkWrite = jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({});

            const result = await wipeAndRestartTournamentSystem({ forceSeed: false });

            expect(result.success).toBe(true);
            expect(result.activeGuaranteedCount).toBe(0);
            expect(result.tournaments).toEqual([]);
            expect(mockBulkWrite).not.toHaveBeenCalled();
        });

        test("wipeAndRestartTournamentSystem forces seeding when forceSeed is true", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            const mockBulkWrite = jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const result = await wipeAndRestartTournamentSystem({ forceSeed: true });

            expect(result.success).toBe(true);
            expect(result.activeGuaranteedCount).toBe(5);
            expect(mockBulkWrite).toHaveBeenCalled();
        });

        test("handles disconnected database safely without leaking unhandled rejections", async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

            const res = await wipeAndRestartTournamentSystem();
            expect(res.success).toBe(false);
            expect(res.message).toBe("Database not connected");
            expect(res.executionTimeMs).toBe(0);
        });
    });

    describe("3. POST /api/tournaments/reset-seed Endpoint Verification", () => {
        test("POST /api/tournaments/reset-seed executes in < 100ms and returns execution metrics", async () => {
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 9 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 2 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 4 });
            jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const res = await request(app).post('/api/tournaments/reset-seed');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.executionTimeMs).toBeLessThan(100);
            expect(res.body.purged.discoveryQueue).toBe(9);
            expect(res.body.purged.proposedTournaments).toBe(2);
            expect(res.body.purged.staleTournaments).toBe(4);
            expect(res.body.seededTournaments).toBe(5);
            expect(res.body.tournaments).toHaveLength(5);
            expect(res.body.tournaments[0].tournamentName).toBe("2026 GMU Badminton Open");
        });

        test("POST /api/tournaments/reset-seed does not seed fake tournaments in production mode", async () => {
            const originalEnv = process.env.NODE_ENV;
            try {
                process.env.NODE_ENV = 'production';
                jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 0 });
                jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
                jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 1 });
                const mockBulkWrite = jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({});

                const res = await request(app).post('/api/tournaments/reset-seed');

                expect(res.status).toBe(200);
                expect(res.body.success).toBe(true);
                expect(res.body.seededTournaments).toBe(0);
                expect(res.body.tournaments).toHaveLength(0);
                expect(mockBulkWrite).not.toHaveBeenCalled();
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        test("returns 500 if database is disconnected during reset-seed", async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

            const res = await request(app).post('/api/tournaments/reset-seed');
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain("Database not connected");
        });
    });

    describe("4. Standalone CLI Seeding Script (cleanSlateSeedTournaments.js)", () => {
        test("executes cleanly and connects without deprecated Mongoose options", async () => {
            const cleanSlateSeed = require('../scripts/cleanSlateSeedTournaments');
            const connectSpy = jest.spyOn(mongoose, 'connect').mockResolvedValue(true);
            const disconnectSpy = jest.spyOn(mongoose, 'disconnect').mockResolvedValue(true);
            jest.spyOn(DiscoveryQueue, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(ProposedTournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(Tournament, "deleteMany").mockResolvedValue({ deletedCount: 0 });
            jest.spyOn(Tournament, "bulkWrite").mockResolvedValue({ upsertedCount: 5 });

            const result = await cleanSlateSeed();

            expect(connectSpy).toHaveBeenCalled();
            const connectArgs = connectSpy.mock.calls[0];
            expect(connectArgs[1]).toBeUndefined();
            expect(result.success).toBe(true);
            expect(disconnectSpy).toHaveBeenCalled();
        });

        test("handles connection failure cleanly without unhandled rejection", async () => {
            const cleanSlateSeed = require('../scripts/cleanSlateSeedTournaments');
            jest.spyOn(mongoose, 'connect').mockRejectedValue(new Error("Connection refused"));
            const disconnectSpy = jest.spyOn(mongoose, 'disconnect').mockResolvedValue(true);
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
                throw new Error(`process.exit:${code}`);
            });

            await expect(cleanSlateSeed()).rejects.toThrow("process.exit:1");
            expect(disconnectSpy).toHaveBeenCalled();
            exitSpy.mockRestore();
        });
    });
});

