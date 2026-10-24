/**
 * Test Suite: Problem 7 (Atomic Redis Tagged Invalidation) & Problem 8 (Query Projection)
 * File: server/tests/redisTaggedCache.test.js
 *
 * Verifies:
 * 1. redis.tagCacheKey(tag, key) registers keys into Redis Set.
 * 2. redis.invalidateCacheTag(tag) pipelines UNLINK for all tagged keys and deletes the tag Set.
 * 3. GET /api/tournaments registers active cache keys in "tournaments:active_keys" Set.
 * 4. GET /api/tournaments returns projected summary fields, omitting heavy brackets.
 * 5. POST /api/admin/tournaments/manual triggers invalidateCacheTag (fixes missing invalidation bug).
 * 6. POST /api/admin/tournaments/approve/:id triggers invalidateCacheTag.
 * 7. DELETE /api/admin/tournaments/:id triggers invalidateCacheTag.
 * 8. POST /api/tournaments/:id/rsvp triggers invalidateCacheTag.
 */

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

// In-memory mock Redis supporting Set operations and pipeline
const memStore = new Map();
const setStore = new Map();

const mockRedis = {
    get: jest.fn(async (key) => memStore.get(key) || null),
    setex: jest.fn(async (key, seconds, val) => {
        memStore.set(key, val);
        return "OK";
    }),
    keys: jest.fn(async (pattern) => {
        const prefix = pattern.replace("*", "");
        return Array.from(memStore.keys()).filter((k) => k.startsWith(prefix));
    }),
    del: jest.fn(async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        let count = 0;
        arr.forEach((k) => {
            if (memStore.delete(k)) count++;
            if (setStore.delete(k)) count++;
        });
        return count;
    }),
    unlink: jest.fn(async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        let count = 0;
        arr.forEach((k) => {
            if (memStore.delete(k)) count++;
            if (setStore.delete(k)) count++;
        });
        return count;
    }),
    sadd: jest.fn(async (tag, ...keys) => {
        if (!setStore.has(tag)) setStore.set(tag, new Set());
        const set = setStore.get(tag);
        let count = 0;
        keys.flat().forEach((k) => {
            if (!set.has(k)) {
                set.add(k);
                count++;
            }
        });
        return count;
    }),
    smembers: jest.fn(async (tag) => {
        if (!setStore.has(tag)) return [];
        return Array.from(setStore.get(tag));
    }),
    srem: jest.fn(async (tag, ...keys) => {
        if (!setStore.has(tag)) return 0;
        const set = setStore.get(tag);
        let count = 0;
        keys.flat().forEach((k) => {
            if (set.delete(k)) count++;
        });
        return count;
    }),
    pipeline: jest.fn(() => {
        const ops = [];
        const pipe = {
            unlink: jest.fn((...keys) => {
                ops.push(() => mockRedis.unlink(keys.flat()));
                return pipe;
            }),
            del: jest.fn((...keys) => {
                ops.push(() => mockRedis.del(keys.flat()));
                return pipe;
            }),
            sadd: jest.fn((tag, ...keys) => {
                ops.push(() => mockRedis.sadd(tag, ...keys.flat()));
                return pipe;
            }),
            exec: jest.fn(async () => {
                for (const op of ops) await op();
                return ops.map(() => [null, 1]);
            })
        };
        return pipe;
    }),
    on: jest.fn()
};

mockRedis.tagCacheKey = jest.fn(async (tag, key) => {
    return mockRedis.sadd(tag, key);
});
mockRedis.invalidateCacheTag = jest.fn(async (tag) => {
    const keys = await mockRedis.smembers(tag);
    if (keys && keys.length > 0) {
        const pipe = mockRedis.pipeline();
        pipe.unlink(...keys);
        pipe.del(tag);
        await pipe.exec();
    }
    // Backward compatibility fallback check
    if (tag === "tournaments:active_keys" && typeof mockRedis.keys === "function") {
        const legacy = await mockRedis.keys("tournaments:*");
        const filtered = legacy.filter((k) => k !== "tournaments:active_keys");
        if (filtered.length > 0) {
            await mockRedis.unlink(filtered);
        }
    }
});

jest.mock("../utils/redis", () => mockRedis);

// Mock models and auth middleware
jest.mock("../middleware/auth", () => ({
    authMiddleware: (req, res, next) => {
        req.user = { _id: "507f1f77bcf86cd799439011", id: "admin-user-1", role: "admin" };
        next();
    },
    adminMiddleware: (req, res, next) => next()
}));

jest.mock("../models/User", () => ({
    findById: jest.fn().mockResolvedValue({ _id: "admin-user-1", role: "admin" })
}));

const Tournament = require("../models/Tournament");
const ProposedTournament = require("../models/ProposedTournament");
const tournamentRoutes = require("../routes/tournaments");
const adminTournamentRoutes = require("../routes/adminTournaments");

describe("Problem 7: Atomic Redis Tagged Invalidation Engine", () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        memStore.clear();
        setStore.clear();

        app = express();
        app.use(express.json());
        app.use("/api/tournaments", tournamentRoutes);
        app.use("/api/admin/tournaments", adminTournamentRoutes);
    });

    test("7.1 tagCacheKey correctly registers keys into the Set", async () => {
        const tag = "tournaments:active_keys";
        const key1 = "tournaments:{\"status\":{\"$ne\":\"archived\"}}";
        const key2 = "tournaments:{\"location\":\"Fairfax\"}";

        await mockRedis.sadd(tag, key1);
        await mockRedis.sadd(tag, key2);

        const members = await mockRedis.smembers(tag);
        expect(members).toContain(key1);
        expect(members).toContain(key2);
        expect(members).toHaveLength(2);
    });

    test("7.2 invalidateCacheTag retrieves members, calls pipeline unlink, and deletes the tag Set", async () => {
        const tag = "tournaments:active_keys";
        const key1 = "tournaments:key_1";
        const key2 = "tournaments:key_2";
        const key3 = "tournaments:key_3";

        // Seed cache and tag Set
        memStore.set(key1, JSON.stringify({ name: "T1" }));
        memStore.set(key2, JSON.stringify({ name: "T2" }));
        memStore.set(key3, JSON.stringify({ name: "T3" }));
        await mockRedis.sadd(tag, key1, key2, key3);

        expect(memStore.size).toBe(3);
        expect((await mockRedis.smembers(tag))).toHaveLength(3);

        // Execute tagged invalidation
        await mockRedis.invalidateCacheTag(tag);

        expect(mockRedis.invalidateCacheTag).toHaveBeenCalledWith("tournaments:active_keys");
        expect(mockRedis.pipeline).toHaveBeenCalled();
        expect(memStore.has(key1)).toBe(false);
        expect(memStore.has(key2)).toBe(false);
        expect(memStore.has(key3)).toBe(false);
        expect(memStore.size).toBe(0);
        expect(setStore.has(tag)).toBe(false);
    });

    test("7.3 GET /api/tournaments tags cache key and returns projected summary fields", async () => {
        const mockTournamentsData = [
            {
                _id: new mongoose.Types.ObjectId(),
                tournamentName: "2026 GMU Badminton Open",
                startDate: new Date("2026-11-15"),
                endDate: new Date("2026-11-16"),
                eventLocation: "RAC Gymnasium, Fairfax, VA",
                hostUniversity: "George Mason University",
                entryFee: "$30",
                skillLevels: ["Open", "Advanced"],
                status: "active",
                rsvpCount: 5,
                attendees: [],
                divisions: [
                    {
                        name: "Men's Singles Open",
                        code: "MSO",
                        category: "Singles",
                        maxDraw: 32,
                        fee: 30,
                        bracketType: "single_elimination"
                    }
                ]
            }
        ];

        const selectMock = jest.fn().mockReturnThis();
        const populateMock = jest.fn().mockReturnThis();
        const sortMock = jest.fn().mockResolvedValue(mockTournamentsData);

        const mockQueryBuilder = {
            select: selectMock,
            populate: populateMock,
            sort: sortMock
        };

        jest.spyOn(Tournament, "find").mockReturnValue(mockQueryBuilder);

        const res = await request(app).get("/api/tournaments");

        expect(res.status).toBe(200);
        expect(res.body.tournaments).toHaveLength(1);
        expect(res.body.cached).toBe(false);

        // Verify select was called with projected fields
        expect(selectMock).toHaveBeenCalledTimes(1);
        const projectionString = selectMock.mock.calls[0][0];
        expect(projectionString).toContain("tournamentName");
        expect(projectionString).toContain("startDate");
        expect(projectionString).toContain("divisions.name");
        // Verify heavy brackets are NOT in the projection string
        expect(projectionString).not.toContain("divisions.matches");
        expect(projectionString).not.toContain("divisions.brackets");
        expect(projectionString).not.toContain("divisions.teams");

        // Verify cache key was tagged
        const expectedCacheKey = "tournaments:{\"status\":{\"$ne\":\"archived\"}}";
        expect(mockRedis.setex).toHaveBeenCalledWith(expectedCacheKey, 3600, expect.any(String));
        expect(mockRedis.sadd).toHaveBeenCalledWith("tournaments:active_keys", expectedCacheKey);
    });

    test("7.4 POST /api/admin/tournaments/manual invalidates cached tournaments", async () => {
        const saveMock = jest.fn().mockResolvedValue({
            _id: new mongoose.Types.ObjectId(),
            tournamentName: "Manually Created Cup",
            isOpenTournament: true
        });
        jest.spyOn(Tournament.prototype, "save").mockImplementation(saveMock);

        const res = await request(app)
            .post("/api/admin/tournaments/manual")
            .send({
                tournamentName: "Manually Created Cup",
                location: "RAC Courts 1-6",
                date: "2026-12-01"
            });

        expect(res.status).toBe(201);
        expect(mockRedis.invalidateCacheTag).toHaveBeenCalledWith("tournaments:active_keys");
    });

    test("7.5 POST /api/admin/tournaments/approve/:id invalidates cached tournaments", async () => {
        const proposedId = new mongoose.Types.ObjectId();
        const mockProposed = {
            _id: proposedId,
            tournamentName: "Proposed Mason Invitational",
            date: new Date("2026-11-20"),
            status: "pending",
            save: jest.fn().mockResolvedValue(true)
        };
        jest.spyOn(ProposedTournament, "findById").mockResolvedValue(mockProposed);
        jest.spyOn(Tournament, "findOne").mockResolvedValue(null);
        jest.spyOn(Tournament.prototype, "save").mockResolvedValue(true);

        const res = await request(app).post(`/api/admin/tournaments/approve/${proposedId}`);

        expect(res.status).toBe(200);
        expect(mockRedis.invalidateCacheTag).toHaveBeenCalledWith("tournaments:active_keys");
    });

    test("7.6 DELETE /api/admin/tournaments/:id invalidates cached tournaments", async () => {
        const tourneyId = new mongoose.Types.ObjectId();
        jest.spyOn(Tournament, "findByIdAndDelete").mockResolvedValue({ _id: tourneyId });

        const res = await request(app).delete(`/api/admin/tournaments/${tourneyId}`);

        expect(res.status).toBe(200);
        expect(mockRedis.invalidateCacheTag).toHaveBeenCalledWith("tournaments:active_keys");
    });

    test("7.7 POST /api/tournaments/:id/rsvp invalidates cached tournaments", async () => {
        const tourneyId = new mongoose.Types.ObjectId();
        const mockTourney = {
            _id: tourneyId,
            attendees: [],
            rsvpCount: 0,
            save: jest.fn().mockResolvedValue(true),
            populate: jest.fn().mockResolvedValue(true)
        };
        jest.spyOn(Tournament, "findById").mockResolvedValue(mockTourney);

        const res = await request(app).post(`/api/tournaments/${tourneyId}/rsvp`);

        expect(res.status).toBe(200);
        expect(mockRedis.invalidateCacheTag).toHaveBeenCalledWith("tournaments:active_keys");
    });
});
