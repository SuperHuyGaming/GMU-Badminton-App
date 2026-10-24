/**
 * challenger_m6_feed_dateless_stress.test.js
 *
 * Empirical Adversarial Stress Test Suite for Milestone 6:
 * (1) Public feed leak stress: Attempt to inject proposals with various statuses
 *     ('pending', 'rejected', 'approved', malformed, null dates, future dates, malicious payloads)
 *     into ProposedTournament and verify that GET /api/tournaments NEVER returns any of them.
 * (2) Concurrent state transitions: Test concurrent approvals, rejections, and direct queries
 *     to confirm atomicity and cache invalidation consistency.
 * (3) Dateless edge cases: Test proposals with missing dates, invalid date formats, "TBD" text,
 *     empty objects, and confirm they remain safely in ProposedTournament without crashing
 *     the admin queue or polluting the public feed.
 */

require('dotenv').config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// In-Memory Redis Mock with tagged key invalidation and eviction tracking
const mockRedisStore = new Map();
const mockTaggedSets = new Map();
let mockCacheInvalidationCallCount = 0;

jest.mock("../utils/redis", () => ({
    get: jest.fn(async (key) => mockRedisStore.get(key) || null),
    set: jest.fn(async (key, val) => {
        mockRedisStore.set(key, val);
        return "OK";
    }),
    setex: jest.fn(async (key, ttl, val) => {
        mockRedisStore.set(key, val);
        return "OK";
    }),
    del: jest.fn(async (key) => {
        const keys = Array.isArray(key) ? key : [key];
        let count = 0;
        for (const k of keys) {
            if (mockRedisStore.delete(k)) count++;
        }
        mockCacheInvalidationCallCount++;
        return count;
    }),
    keys: jest.fn(async (pattern) => {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
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
        mockCacheInvalidationCallCount++;
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

// Mock AI parser
jest.mock("../utils/aiParser", () => ({
    parseDiscoveredWebpage: jest.fn(),
    parseInstagramPost: jest.fn(),
    parseMultimodalFlyer: jest.fn(),
    fallbackRegexParser: jest.fn(),
    fallbackWebpageParser: jest.fn()
}));

const tournamentRoutes = require("../routes/tournaments");
const adminTournamentsRoutes = require("../routes/adminTournaments");
const Tournament = require("../models/Tournament");
const ProposedTournament = require("../models/ProposedTournament");
const DiscoveryQueue = require("../models/DiscoveryQueue");
const User = require("../models/User");
const { processDiscoveryQueue } = require("../utils/autonomousHunter");
const { parseDiscoveredWebpage } = require("../utils/aiParser");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_badminton_key_2026";
const adminId = "650000000000000000000099";
const userId = "650000000000000000000001";

const adminToken = jwt.sign(
    { id: adminId, userId: adminId, role: "admin", name: "Auditor Admin" },
    JWT_SECRET
);
const userToken = jwt.sign(
    { id: userId, userId: userId, role: "user", name: "Auditor Player" },
    JWT_SECRET
);

// Setup Express application
const app = express();
app.use(express.json());

const mockIo = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis()
};

app.use((req, res, next) => {
    req.io = mockIo;
    next();
});
app.set("io", mockIo);

app.use("/api/tournaments", tournamentRoutes);
app.use("/api/admin/tournaments", adminTournamentsRoutes);

describe("Milestone 6 Empirical Challenger Stress Suite: Feed Isolation & Dateless Invariants", () => {
    // In-memory persistent data stores for empirical simulation
    let proposedDb = new Map();
    let liveDb = new Map();
    let originalReadyState;

    beforeAll(() => {
        originalReadyState = mongoose.connection.readyState;
    });

    afterAll(() => {
        Object.defineProperty(mongoose.connection, "readyState", {
            value: originalReadyState,
            configurable: true
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisStore.clear();
        mockTaggedSets.clear();
        mockCacheInvalidationCallCount = 0;
        proposedDb.clear();
        liveDb.clear();

        Object.defineProperty(mongoose.connection, "readyState", {
            value: 1,
            configurable: true
        });

        // Mock User and DiscoveryQueue
        jest.spyOn(User, "find").mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
        jest.spyOn(Tournament, "updateMany").mockImplementation(async (filter, update) => {
            let modified = 0;
            for (const [id, doc] of liveDb.entries()) {
                if (filter.status && filter.status.$ne && doc.status === filter.status.$ne) continue;
                if (filter.$or) {
                    const now = new Date();
                    const matchesEnd = doc.endDate && new Date(doc.endDate) < now;
                    const matchesStart = !doc.endDate && doc.startDate && new Date(doc.startDate) < now;
                    if (matchesEnd || matchesStart) {
                        doc.status = update.$set.status;
                        doc.isOpenTournament = update.$set.isOpenTournament;
                        modified++;
                    }
                }
            }
            return { modifiedCount: modified };
        });

        // Mock ProposedTournament Mongoose Operations
        jest.spyOn(ProposedTournament, "find").mockImplementation((filter = {}) => {
            const matches = [];
            for (const doc of proposedDb.values()) {
                let ok = true;
                if (filter.status && doc.status !== filter.status) ok = false;
                if (ok) matches.push(doc);
            }
            return {
                sort: jest.fn().mockImplementation((sortObj) => {
                    const sorted = [...matches].sort((a, b) => {
                        const scoreA = a.confidenceScore ?? 0;
                        const scoreB = b.confidenceScore ?? 0;
                        return sortObj?.confidenceScore === -1 ? scoreB - scoreA : scoreA - scoreB;
                    });
                    return Promise.resolve(sorted);
                }),
                lean: jest.fn().mockResolvedValue(matches)
            };
        });

        jest.spyOn(ProposedTournament, "findById").mockImplementation(async (id) => {
            const doc = proposedDb.get(id.toString());
            if (!doc) return null;
            return {
                ...doc,
                save: jest.fn().mockImplementation(async function () {
                    proposedDb.set(id.toString(), { ...this });
                    return this;
                })
            };
        });

        jest.spyOn(ProposedTournament, "create").mockImplementation(async (docData) => {
            const _id = docData._id ? docData._id.toString() : new mongoose.Types.ObjectId().toString();
            const record = { ...docData, _id };
            proposedDb.set(_id, record);
            return record;
        });

        // Mock Tournament Mongoose Operations
        jest.spyOn(Tournament, "find").mockImplementation((query = {}) => {
            const results = [];
            for (const doc of liveDb.values()) {
                let match = true;
                if (query.status && typeof query.status === 'string' && doc.status !== query.status) {
                    match = false;
                } else if (query.status && query.status.$ne && doc.status === query.status.$ne) {
                    match = false;
                }
                if (query.eventLocation && query.eventLocation.$regex) {
                    const regex = new RegExp(query.eventLocation.$regex, query.eventLocation.$options || "i");
                    if (!regex.test(doc.eventLocation || "")) match = false;
                }
                if (query.skillLevels && doc.skillLevels && !doc.skillLevels.includes(query.skillLevels)) {
                    match = false;
                }
                if (query.$or) {
                    const anyMatch = query.$or.some(cond => {
                        if (cond.endDate && cond.endDate.$gte) {
                            return doc.endDate && new Date(doc.endDate) >= cond.endDate.$gte;
                        }
                        if (cond.startDate && cond.startDate.$gte) {
                            return doc.startDate && new Date(doc.startDate) >= cond.startDate.$gte;
                        }
                        return false;
                    });
                    if (!anyMatch) match = false;
                }
                if (query.startDate) {
                    if (query.startDate.$gte && (!doc.startDate || new Date(doc.startDate) < query.startDate.$gte)) {
                        match = false;
                    }
                    if (query.startDate.$lte && (!doc.startDate || new Date(doc.startDate) > query.startDate.$lte)) {
                        match = false;
                    }
                    if (query.startDate.$lt && (!doc.startDate || new Date(doc.startDate) >= query.startDate.$lt)) {
                        match = false;
                    }
                }
                if (match) results.push({ ...doc });
            }

            const builder = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockImplementation((sortObj) => {
                    const sorted = [...results].sort((a, b) => {
                        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                        return sortObj?.startDate === 1 ? dateA - dateB : dateB - dateA;
                    });
                    return Promise.resolve(sorted);
                }),
                lean: jest.fn().mockResolvedValue(results),
                then: (resolve) => resolve(results)
            };
            return builder;
        });

        jest.spyOn(Tournament, "findById").mockImplementation((id) => {
            const found = liveDb.get(id.toString());
            return {
                populate: jest.fn().mockResolvedValue(found ? { ...found } : null),
                then: (resolve) => resolve(found ? { ...found } : null)
            };
        });

        jest.spyOn(Tournament, "findByIdAndUpdate").mockImplementation(async (id, update) => {
            const existing = liveDb.get(id.toString());
            if (!existing) return null;
            const updated = { ...existing, ...update.$set };
            liveDb.set(id.toString(), updated);
            return updated;
        });

        jest.spyOn(Tournament, "findByIdAndDelete").mockImplementation(async (id) => {
            const existing = liveDb.get(id.toString());
            if (!existing) return null;
            liveDb.delete(id.toString());
            return existing;
        });

        jest.spyOn(Tournament.prototype, "save").mockImplementation(async function () {
            const id = this._id ? this._id.toString() : new mongoose.Types.ObjectId().toString();
            this._id = id;
            liveDb.set(id, { ...this.toObject ? this.toObject() : this });
            return this;
        });
    });

    // =========================================================================
    // SECTION 1: PUBLIC FEED LEAK STRESS & PROPOSAL BARRIER
    // =========================================================================
    describe("Section 1: Public Feed Leak Stress (Adversarial Proposal Injection)", () => {
        test("1.1 Multi-status proposal barrage: 10 adversarial proposals never leak to GET /api/tournaments", async () => {
            // Seed ProposedTournament with 10 varied proposals across different status, date, and score values
            const adversarialProposals = [
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Adversarial Proposal Pending 1",
                    status: "pending",
                    confidenceScore: 99,
                    date: new Date("2026-11-15T09:00:00Z"),
                    location: "RAC Gym",
                    sourceUrl: "https://instagram.com/p/111"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Adversarial Proposal Rejected 2",
                    status: "rejected",
                    confidenceScore: 30,
                    date: new Date("2026-12-01T09:00:00Z"),
                    location: "Unknown",
                    sourceUrl: "https://instagram.com/p/222"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Orphan Proposal Status Approved But No Tournament 3",
                    status: "approved",
                    confidenceScore: 95,
                    date: new Date("2026-11-20T09:00:00Z"),
                    location: "RAC Gym",
                    sourceUrl: "https://instagram.com/p/333"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Malformed Status Proposal 4",
                    status: "INVALID_STATUS_UNKNOWN",
                    confidenceScore: 0,
                    date: null,
                    location: "TBD",
                    sourceUrl: "https://instagram.com/p/444"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Null Status Proposal 5",
                    status: null,
                    confidenceScore: 50,
                    date: null,
                    location: "TBD",
                    sourceUrl: "https://instagram.com/p/555"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Past Date Proposal 6",
                    status: "pending",
                    confidenceScore: 80,
                    date: new Date("2020-01-01T00:00:00Z"),
                    location: "CBA",
                    sourceUrl: "https://instagram.com/p/666"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Far Future Proposal 7",
                    status: "pending",
                    confidenceScore: 75,
                    date: new Date("2035-08-01T00:00:00Z"),
                    location: "NVBC",
                    sourceUrl: "https://instagram.com/p/777"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Dateless Proposal 8",
                    status: "pending",
                    confidenceScore: 75,
                    date: null,
                    location: "RAC Gym",
                    sourceUrl: "https://instagram.com/p/888"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "Zero Confidence Proposal 9",
                    status: "pending",
                    confidenceScore: 0,
                    date: new Date("2026-11-25T00:00:00Z"),
                    location: "TBD",
                    sourceUrl: "https://instagram.com/p/999"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "<script>alert('xss-proposal')</script>",
                    status: "pending",
                    confidenceScore: 85,
                    date: new Date("2026-11-30T00:00:00Z"),
                    location: "<img src=x onerror=alert(1)>",
                    sourceUrl: "https://instagram.com/p/xss"
                }
            ];

            for (const p of adversarialProposals) {
                proposedDb.set(p._id, p);
            }
            expect(proposedDb.size).toBe(10);
            expect(liveDb.size).toBe(0);

            // Test various public endpoints & parameter filters
            const endpoints = [
                "/api/tournaments",
                "/api/tournaments?upcoming=true",
                "/api/tournaments?weekend=true",
                "/api/tournaments?search=Proposal",
                "/api/tournaments?search=RAC",
                "/api/tournaments?status=pending",
                "/api/tournaments?status=rejected",
                "/api/tournaments?status=approved",
                "/api/tournaments?includeArchived=true",
                "/api/tournaments?month=2026-11"
            ];

            for (const url of endpoints) {
                const res = await request(app).get(url);
                expect(res.status).toBe(200);
                expect(res.body.tournaments).toBeDefined();
                expect(res.body.tournaments).toHaveLength(0); // MUST NEVER leak any proposed items
            }
        });

        test("1.2 Direct ID traversal attack: GET /api/tournaments/:proposalId returns 404 for ProposedTournament IDs", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "Secret Unapproved Tournament",
                status: "pending",
                confidenceScore: 95
            });

            const res = await request(app).get(`/api/tournaments/${proposalId}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found/i);
        });

        test("1.3 Public feed serves only verified live tournaments without cross-contaminating proposals", async () => {
            // 1 valid live tournament in Tournament model
            const liveId = new mongoose.Types.ObjectId().toString();
            liveDb.set(liveId, {
                _id: liveId,
                tournamentName: "Verified 2026 GMU Badminton Open",
                eventLocation: "RAC Gymnasium, Fairfax, VA",
                startDate: new Date("2026-11-07T09:00:00Z"),
                endDate: new Date("2026-11-08T18:00:00Z"),
                isOpenTournament: true,
                status: "active"
            });

            // 5 pending proposals in ProposedTournament
            for (let i = 1; i <= 5; i++) {
                const pId = new mongoose.Types.ObjectId().toString();
                proposedDb.set(pId, {
                    _id: pId,
                    tournamentName: `Scraped Pending Proposal #${i}`,
                    status: "pending",
                    confidenceScore: 80 + i
                });
            }

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(1);
            expect(res.body.tournaments[0].tournamentName).toBe("Verified 2026 GMU Badminton Open");
            expect(res.body.tournaments[0]._id).toBe(liveId);
        });
    });

    // =========================================================================
    // SECTION 2: CONCURRENT STATE TRANSITIONS & CACHE INVALIDATION
    // =========================================================================
    describe("Section 2: Concurrent State Transitions & Cache Invalidation Consistency", () => {
        test("2.1 Concurrent Approvals: 5 simultaneous approvals on same proposal do not create duplicate live tournaments", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            const proposalDoc = {
                _id: proposalId,
                tournamentName: "2026 Mid-Atlantic Collegiate Championship",
                location: "Capital Badminton Academy",
                date: new Date("2026-11-21T09:00:00Z"),
                registrationLink: "https://tournamentsoftware.com/123",
                sourceUrl: "https://tournamentsoftware.com/123",
                sourceLinks: ["https://tournamentsoftware.com/123"],
                scrapedImageUrls: [],
                skillLevels: ["Open", "Flight A"],
                rawCaption: "Official Draw",
                status: "pending",
                confidenceScore: 92
            };
            proposedDb.set(proposalId, proposalDoc);

            // Fire 5 concurrent approvals on the same proposal
            const promises = Array.from({ length: 5 }, () =>
                request(app)
                    .post(`/api/admin/tournaments/approve/${proposalId}`)
                    .set("Authorization", `Bearer ${adminToken}`)
            );

            const responses = await Promise.all(promises);

            // Assert: Exactly 1 request succeeds with 200 (or if raced, deduplication updates canonical)
            const successful = responses.filter(r => r.status === 200);
            expect(successful.length).toBeGreaterThanOrEqual(1);

            // In liveDb, there MUST be at most 1 live tournament for this proposal!
            expect(liveDb.size).toBe(1);

            const liveTourney = Array.from(liveDb.values())[0];
            expect(liveTourney.tournamentName).toBe("2026 Mid-Atlantic Collegiate Championship");
            expect(liveTourney.isOpenTournament).toBe(true);

            // The proposal must be approved
            const finalProposal = proposedDb.get(proposalId);
            expect(finalProposal.status).toBe("approved");

            // Cache invalidation was triggered
            expect(mockCacheInvalidationCallCount).toBeGreaterThan(0);
        });

        test("2.2 Concurrent Approve and Reject Race: Handled safely without ghost entries", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "Contested Proposal Approval vs Reject",
                location: "RAC Gym",
                date: new Date("2026-12-05T09:00:00Z"),
                registrationLink: "https://linktr.ee/gmubadminton",
                sourceUrl: "https://linktr.ee/gmubadminton",
                status: "pending",
                confidenceScore: 80
            });

            // Fire concurrent approve and reject requests
            const [approveRes, rejectRes] = await Promise.all([
                request(app)
                    .post(`/api/admin/tournaments/approve/${proposalId}`)
                    .set("Authorization", `Bearer ${adminToken}`),
                request(app)
                    .post(`/api/admin/tournaments/reject/${proposalId}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .send({ reason: "Duplicate or invalid collegiate event" })
            ]);

            // Both requests complete with valid HTTP status codes (200 or 400)
            expect([200, 400]).toContain(approveRes.status);
            expect([200, 400]).toContain(rejectRes.status);

            // Proposal status is deterministic ('approved' or 'rejected')
            const finalProposal = proposedDb.get(proposalId);
            expect(["approved", "rejected"]).toContain(finalProposal.status);

            // Verify public endpoint remains consistent
            const publicRes = await request(app).get("/api/tournaments");
            expect(publicRes.status).toBe(200);
            if (finalProposal.status === "rejected" && liveDb.size === 0) {
                expect(publicRes.body.tournaments).toHaveLength(0);
            }
        });

        test("2.3 Read-During-Approval: 10 concurrent public reads during approval receive clean state", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "2026 NOVA Open Championships",
                location: "Northern Virginia Badminton Club",
                date: new Date("2026-12-12T09:00:00Z"),
                registrationLink: "https://novabadmintonacademy.com",
                sourceUrl: "https://novabadmintonacademy.com",
                status: "pending",
                confidenceScore: 90
            });

            // Warm up cache with an empty live feed
            await request(app).get("/api/tournaments");
            expect(mockRedisStore.size).toBeGreaterThan(0);

            // Concurrently approve and run 10 public reads
            const readPromises = Array.from({ length: 10 }, () => request(app).get("/api/tournaments"));
            const approvePromise = request(app)
                .post(`/api/admin/tournaments/approve/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            const [approveRes, ...readResponses] = await Promise.all([approvePromise, ...readPromises]);

            expect(approveRes.status).toBe(200);
            for (const r of readResponses) {
                expect(r.status).toBe(200);
                expect(r.body.tournaments).toBeDefined();
            }

            // Post-approval: Cache has been invalidated and fresh query returns the newly approved tournament
            const freshRes = await request(app).get("/api/tournaments");
            expect(freshRes.status).toBe(200);
            expect(freshRes.body.tournaments).toHaveLength(1);
            expect(freshRes.body.tournaments[0].tournamentName).toBe("2026 NOVA Open Championships");
        });

        test("2.4 Deletion Cache Invalidation: Admin deletion purges live tournament and evicts cache", async () => {
            const liveId = new mongoose.Types.ObjectId().toString();
            liveDb.set(liveId, {
                _id: liveId,
                tournamentName: "Tournament To Be Deleted",
                eventLocation: "Fairfax",
                startDate: new Date("2026-11-15T09:00:00Z"),
                status: "active",
                isOpenTournament: true
            });

            // Cache it
            await request(app).get("/api/tournaments");
            expect(liveDb.size).toBe(1);

            // Admin deletes the tournament
            const delRes = await request(app)
                .delete(`/api/admin/tournaments/${liveId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(delRes.status).toBe(200);
            expect(liveDb.size).toBe(0);

            // Verify cache eviction
            const publicRes = await request(app).get("/api/tournaments");
            expect(publicRes.status).toBe(200);
            expect(publicRes.body.tournaments).toHaveLength(0);
        });
    });

    // =========================================================================
    // SECTION 3: DATELESS EDGE CASES & REVIEW QUEUE INVARIANTS
    // =========================================================================
    describe("Section 3: Dateless Edge Cases & Review Queue Resilience", () => {
        test("3.1 Admin review queue safely displays dateless proposals without crashing", async () => {
            const datelessProposals = [
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "2026 UVA Spring Invitational (Date TBD)",
                    date: null,
                    location: "Memorial Gym, Charlottesville, VA",
                    confidenceScore: 75,
                    status: "pending"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "2026 Virginia Tech Smash (Undefined Date)",
                    date: undefined,
                    location: "War Memorial Hall, Blacksburg, VA",
                    confidenceScore: 70,
                    status: "pending"
                },
                {
                    _id: new mongoose.Types.ObjectId().toString(),
                    tournamentName: "2026 GMU Badminton Gala (Explicit Confirmed Date)",
                    date: new Date("2026-11-28T09:00:00Z"),
                    location: "RAC Gym, Fairfax, VA",
                    confidenceScore: 95,
                    status: "pending"
                }
            ];

            for (const p of datelessProposals) {
                proposedDb.set(p._id, p);
            }

            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);

            // Sorting invariant: confidenceScore descending (95 -> 75 -> 70)
            expect(res.body[0].confidenceScore).toBe(95);
            expect(res.body[1].confidenceScore).toBe(75);
            expect(res.body[1].date).toBeNull();
            expect(res.body[2].confidenceScore).toBe(70);

            // Confirm none of these leak to public feed
            const publicRes = await request(app).get("/api/tournaments");
            expect(publicRes.status).toBe(200);
            expect(publicRes.body.tournaments).toHaveLength(0);
        });

        test("3.2 Admin PUT route validates inputs and rejects invalid field payloads", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "Unedited Dateless Proposal",
                date: null,
                confidenceScore: 75,
                status: "pending"
            });

            // 1. Empty tournament name is rejected with 400
            const emptyNameRes = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ tournamentName: "   " });
            expect(emptyNameRes.status).toBe(400);
            expect(emptyNameRes.body.message).toMatch(/cannot be empty/i);

            // 2. Out-of-bounds confidence scores (<0 or >100) rejected with 400
            const invalidScoreRes1 = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ confidenceScore: 150 });
            expect(invalidScoreRes1.status).toBe(400);

            const invalidScoreRes2 = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ confidenceScore: -10 });
            expect(invalidScoreRes2.status).toBe(400);

            // 3. Valid date assignment succeeds with 200
            const validDateRes = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    date: "2026-11-20T09:00:00Z",
                    confidenceScore: 92
                });
            expect(validDateRes.status).toBe(200);
            expect(validDateRes.body.proposedTournament.confidenceScore).toBe(92);
        });

        test("3.3 Direct Approval of Dateless Proposal: Handled gracefully without crashing public feed or date queries", async () => {
            // Admin directly approves a proposal that still has date: null
            const datelessProposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(datelessProposalId, {
                _id: datelessProposalId,
                tournamentName: "2026 Collegiate Winter Open (Date TBD)",
                date: null,
                location: "RAC Gym",
                registrationLink: "https://linktr.ee/gmubadminton",
                sourceUrl: "https://linktr.ee/gmubadminton",
                status: "pending",
                confidenceScore: 75
            });

            const approveRes = await request(app)
                .post(`/api/admin/tournaments/approve/${datelessProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(approveRes.status).toBe(200);
            expect(liveDb.size).toBe(1);

            const createdLive = Array.from(liveDb.values())[0];
            expect(createdLive.tournamentName).toBe("2026 Collegiate Winter Open (Date TBD)");
            expect(createdLive.startDate).toBeNull();
            expect(createdLive.isOpenTournament).toBe(true);

            // Public general listing: must return the tournament without crashing
            const generalRes = await request(app).get("/api/tournaments");
            expect(generalRes.status).toBe(200);
            expect(generalRes.body.tournaments).toHaveLength(1);
            expect(generalRes.body.tournaments[0].startDate).toBeNull();

            // Public upcoming filter (?upcoming=true): dateless tournament is safely excluded from upcoming
            const upcomingRes = await request(app).get("/api/tournaments?upcoming=true");
            expect(upcomingRes.status).toBe(200);
            expect(upcomingRes.body.tournaments).toHaveLength(0);

            // Public weekend filter (?weekend=true): dateless tournament is safely excluded
            const weekendRes = await request(app).get("/api/tournaments?weekend=true");
            expect(weekendRes.status).toBe(200);
            expect(weekendRes.body.tournaments).toHaveLength(0);

            // Public month filter (?month=2026-11): dateless tournament is safely excluded
            const monthRes = await request(app).get("/api/tournaments?month=2026-11");
            expect(monthRes.status).toBe(200);
            expect(monthRes.body.tournaments).toHaveLength(0);
        });

        test("3.4 Autonomous Hunter Ingestion: Discovered dateless tournaments enqueued with confidence 75 and date: null", async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: "2026 George Washington Open",
                hostLocation: "Lerner Health and Wellness Center, Washington DC",
                startDate: null, // No explicit date in post
                endDate: null,
                registrationDeadline: null,
                entryFee: "$20",
                confidenceScore: 90,
                skillLevels: ["Open", "Flight B"]
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            const axios = require("axios");
            jest.spyOn(axios, "get").mockResolvedValue({
                data: "<html><body><h1>2026 George Washington Open</h1><p>Date coming soon!</p></body></html>"
            });
            jest.spyOn(axios, "head").mockResolvedValue({ status: 200 });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: "https://example.com/gw-open",
                rawSnippet: "Save the date! GW Open coming soon to Lerner Health!",
                sourceType: "GOOGLE_SEARCH",
                status: "PENDING_AI_REVIEW",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, "create").mockImplementation((doc) => {
                capturedProposal = doc;
                proposedDb.set(doc._id ? doc._id.toString() : "hunter_p1", doc);
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal).toBeDefined();
            expect(capturedProposal.tournamentName).toBe("2026 George Washington Open");
            expect(capturedProposal.date).toBeNull();
            expect(capturedProposal.confidenceScore).toBe(75); // Penalized to 75 for dateless
            expect(capturedProposal.status).toBe("pending");

            // Verify the newly enqueued proposal is in the admin queue, but NOT in the public feed
            const adminQueueRes = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(adminQueueRes.status).toBe(200);
            const foundInAdmin = adminQueueRes.body.find(p => p.tournamentName === "2026 George Washington Open");
            expect(foundInAdmin).toBeDefined();
            expect(foundInAdmin.date).toBeNull();

            // Verify ZERO leak into public feed
            const publicRes = await request(app).get("/api/tournaments");
            expect(publicRes.status).toBe(200);
            const foundInPublic = publicRes.body.tournaments.find(t => t.tournamentName === "2026 George Washington Open");
            expect(foundInPublic).toBeUndefined();
        });

        test("3.5 Malformed Date String Resiliency: PUT with 'TBD' date handled gracefully without server crash", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "Malformed Date Proposal",
                date: null,
                confidenceScore: 75,
                status: "pending"
            });

            // Admin submits an invalid text string for date
            const malformedDateRes = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    date: "TBD_UNKNOWN_DATE"
                });

            // The server must respond without crashing (either 200 with Invalid Date / preserved, or 400/500 error)
            expect([200, 400, 500]).toContain(malformedDateRes.status);

            // Confirm that the proposal remains in ProposedTournament and still does not crash the review queue
            const queueRes = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(queueRes.status).toBe(200);

            // Public feed remains 100% clean
            const publicRes = await request(app).get("/api/tournaments");
            expect(publicRes.status).toBe(200);
            expect(publicRes.body.tournaments).toHaveLength(0);
        });

        test("3.6 Repeated Approval Guard: Attempting to approve an already-approved proposal returns 400", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            proposedDb.set(proposalId, {
                _id: proposalId,
                tournamentName: "2026 Already Approved Event",
                date: new Date("2026-11-20T09:00:00Z"),
                location: "RAC Gym",
                status: "approved", // already approved
                confidenceScore: 90
            });

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already approved/i);
        });

        test("3.7 Authorization & Security Barrier: Unauthenticated or regular players are strictly forbidden", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();

            // Unauthenticated
            const unauthGet = await request(app).get("/api/admin/tournaments/proposed");
            expect(unauthGet.status).toBe(401);

            const unauthApprove = await request(app).post(`/api/admin/tournaments/approve/${fakeId}`);
            expect(unauthApprove.status).toBe(401);

            // Regular Player (Forbidden)
            const playerGet = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${userToken}`);
            expect(playerGet.status).toBe(403);

            const playerApprove = await request(app)
                .post(`/api/admin/tournaments/approve/${fakeId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(playerApprove.status).toBe(403);

            const playerReject = await request(app)
                .post(`/api/admin/tournaments/reject/${fakeId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(playerReject.status).toBe(403);

            const playerPut = await request(app)
                .put(`/api/admin/tournaments/${fakeId}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ tournamentName: "Hacked Tournament" });
            expect(playerPut.status).toBe(403);
        });
    });
});
