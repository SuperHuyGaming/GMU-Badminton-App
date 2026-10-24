const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const TournamentMatch = require("../models/TournamentMatch");
const tournamentsRouter = require("../routes/tournaments");
const BracketLockCoordinator = require("../utils/bracketLockCoordinator");

describe("Problem 10: Bracket Optimistic Concurrency Control (OCC) & Locking", () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        // Mock socket broadcast on req
        app.use((req, res, next) => {
            req.io = {
                emit: jest.fn()
            };
            next();
        });
        app.use("/api/tournaments", tournamentsRouter);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("TournamentMatch schema enforces optimisticConcurrency and versionKey '__v'", () => {
        expect(TournamentMatch.schema.options.optimisticConcurrency).toBe(true);
        expect(TournamentMatch.schema.options.versionKey).toBe("__v");
        expect(TournamentMatch.schema.path("nextMatchId")).toBeDefined();
        expect(TournamentMatch.schema.path("nextMatchSlot")).toBeDefined();
        expect(TournamentMatch.schema.path("bracketSlotId")).toBeDefined();
        expect(TournamentMatch.schema.path("lock.isLocked")).toBeDefined();
    });

    test("POST /advance returns 400 if winner is invalid", async () => {
        const fakeMatchId = new mongoose.Types.ObjectId();
        const fakeTourneyId = new mongoose.Types.ObjectId();

        const res = await request(app)
            .post(`/api/tournaments/${fakeTourneyId}/matches/${fakeMatchId}/advance`)
            .send({ winner: "invalid_team" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test("POST /advance returns 404 if match is not found", async () => {
        jest.spyOn(TournamentMatch, "findById").mockResolvedValueOnce(null);

        const fakeMatchId = new mongoose.Types.ObjectId();
        const fakeTourneyId = new mongoose.Types.ObjectId();

        const res = await request(app)
            .post(`/api/tournaments/${fakeTourneyId}/matches/${fakeMatchId}/advance`)
            .send({ winner: "team1", expectedVersion: 0 });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    test("POST /advance returns 409 CONCURRENCY_CONFLICT if expectedVersion does not match current document __v", async () => {
        const mockMatch = {
            _id: new mongoose.Types.ObjectId(),
            __v: 3, // Current version is 3
            winner: null,
            matchStatus: "MATCH_IN_PROGRESS",
            team1GamesWon: 1,
            team2GamesWon: 1,
            team1: [{ name: "Player A" }],
            team2: [{ name: "Player B" }]
        };

        jest.spyOn(TournamentMatch, "findById").mockResolvedValueOnce(mockMatch);

        const fakeTourneyId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/tournaments/${fakeTourneyId}/matches/${mockMatch._id}/advance`)
            .send({ winner: "team1", expectedVersion: 2 }); // Stale version 2 submitted

        expect(res.status).toBe(409);
        expect(res.body.code).toBe("CONCURRENCY_CONFLICT");
        expect(res.body.currentVersion).toBe(3);
        expect(res.body.submittedVersion).toBe(2);
    });

    test("POST /advance returns 409 CONCURRENCY_CONFLICT when Mongoose throws VersionError on save", async () => {
        const mockMatch = {
            _id: new mongoose.Types.ObjectId(),
            __v: 0,
            winner: null,
            matchStatus: "COMPLETED",
            team1GamesWon: 2,
            team2GamesWon: 0,
            team1: [{ name: "Player A" }],
            team2: [{ name: "Player B" }],
            save: jest.fn().mockImplementation(() => {
                const err = new mongoose.Error.VersionError({ _doc: { _id: mockMatch._id } }, 1, ["winner"]);
                err.name = "VersionError";
                throw err;
            })
        };

        jest.spyOn(TournamentMatch, "findById")
            .mockResolvedValueOnce(mockMatch) // for initial find
            .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ _id: mockMatch._id, __v: 1 }) }); // for fresh find in catch

        const fakeTourneyId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/tournaments/${fakeTourneyId}/matches/${mockMatch._id}/advance`)
            .send({ winner: "team1", expectedVersion: 0 });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe("CONCURRENCY_CONFLICT");
        expect(res.body.error).toMatch(/conflict/i);
    });

    test("POST /advance successfully advances winner to next match feeder slot", async () => {
        const nextMatchId = new mongoose.Types.ObjectId();
        const mockNextMatch = {
            _id: nextMatchId,
            __v: 0,
            team1: [],
            team2: [],
            save: jest.fn().mockResolvedValue(true)
        };

        const mockMatch = {
            _id: new mongoose.Types.ObjectId(),
            tournamentId: new mongoose.Types.ObjectId(),
            bracketSlotId: "m-qf-1",
            __v: 0,
            winner: null,
            matchStatus: "MATCH_IN_PROGRESS",
            team1GamesWon: 2,
            team2GamesWon: 0,
            team1: [{ name: "Winner Player" }],
            team2: [{ name: "Loser Player" }],
            nextMatchId: nextMatchId,
            nextMatchSlot: "team1",
            save: jest.fn().mockResolvedValue(true)
        };

        jest.spyOn(TournamentMatch, "findById")
            .mockResolvedValueOnce(mockMatch)
            .mockResolvedValueOnce(mockNextMatch);

        const res = await request(app)
            .post(`/api/tournaments/${mockMatch.tournamentId}/matches/${mockMatch._id}/advance`)
            .send({ winner: "team1", expectedVersion: 0, umpireName: "Umpire John" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockMatch.winner).toBe("team1");
        expect(mockMatch.matchStatus).toBe("COMPLETED");
        expect(mockNextMatch.team1).toEqual([{ name: "Winner Player" }]);
        expect(mockMatch.save).toHaveBeenCalled();
        expect(mockNextMatch.save).toHaveBeenCalled();
    });

    test("BracketLockCoordinator acquires, refreshes, rejects collisions, and releases locks", async () => {
        const coordinator = new BracketLockCoordinator(null); // memory mode
        const matchId = "match-123";

        // 1. Acquire lock
        const acq1 = await coordinator.acquireLock(matchId, "Umpire Alice", "socket-1", 60);
        expect(acq1.success).toBe(true);
        expect(acq1.expiresAt).toBeGreaterThan(Date.now());

        // 2. Conflicting acquisition by another socket rejected
        const acq2 = await coordinator.acquireLock(matchId, "Umpire Bob", "socket-2", 60);
        expect(acq2.success).toBe(false);
        expect(acq2.lockedBy).toBe("Umpire Alice");

        // 3. Heartbeat refresh by same socket
        const refreshed = await coordinator.refreshLock(matchId, "socket-1", 60);
        expect(refreshed).toBe(true);

        // 4. Release lock by owner socket
        const released = await coordinator.releaseLock(matchId, "socket-1");
        expect(released).toBe(true);

        // 5. Subsequent acquisition by Bob now succeeds
        const acq3 = await coordinator.acquireLock(matchId, "Umpire Bob", "socket-2", 60);
        expect(acq3.success).toBe(true);
    });
});
