/**
 * Challenger 2 Empirical Stress Test Suite: Milestone 1 (Project Titan)
 * File: server/tests/challenger_m1_link_temporal_stress.test.js
 *
 * Adversarial empirical testing of:
 * 1. Autonomous Link Healthcheck Crawler (server/utils/linkHealthChecker.js):
 *    - HTTP 404, HTTP 500, ECONNREFUSED, socket hangup (ECONNRESET), socket timeout (ECONNABORTED)
 *    - HTTP 405 Method Not Allowed with fallback to lightweight GET (200 OK, 404, timeouts)
 *    - Redirects and redirect loops
 *    - Malformed and non-HTTP URLs
 *    - Host club homepage fallback resolution matrix
 *    - Batch link healthcheck crawler execution and Redis eviction
 * 2. Strict Temporal Horizon & Directory Query Invariants (server/routes/tournaments.js):
 *    - Default public directory queries excluding archived and elapsed events
 *    - Explicit archive retrieval (?status=archived and ?includeArchived=true)
 *    - Direct ID lookup (GET /api/tournaments/:id) preserving historical match archives
 * 3. Cron Auto-Archival & Redis Cache Invalidation Under Concurrent Bursts:
 *    - cleanupArchivedTournaments bulk auto-archival and Redis key eviction
 *    - 50 concurrent burst requests during auto-archival execution
 *    - Stateful in-memory Redis cache hit, eviction, and fresh query validation
 * 4. Admin Link Healthcheck Security & Role Guard:
 *    - 401 Unauthorized for unauthenticated requests
 *    - 403 Forbidden for non-admin users
 *    - 200 OK with report statistics for authorized admins
 * 5. Memory Ceiling & Heap Stability Verification:
 *    - Verified heap memory bounds strictly < 200MB
 */

require('dotenv').config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const axios = require("axios");

// In-Memory Stateful Redis Mock for deterministic cache eviction testing
const mockRedisStore = new Map();
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
        const existed = mockRedisStore.delete(key);
        return existed ? 1 : 0;
    }),
    keys: jest.fn(async (pattern) => {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        const matching = [];
        for (const k of mockRedisStore.keys()) {
            if (regex.test(k)) matching.push(k);
        }
        return matching;
    })
}));

const redis = require("../utils/redis");
const {
    verifyLinkHealth,
    checkLinkHealth,
    resolveHostClubFallback,
    checkAndUpdateTournamentLink,
    runTournamentLinkHealthcheck
} = require("../utils/linkHealthChecker");
const { cleanupArchivedTournaments } = require("../utils/cronJobs");
const Tournament = require("../models/Tournament");
const tournamentRoutes = require("../routes/tournaments");
const adminTournamentRoutes = require("../routes/adminTournaments");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const adminToken = jwt.sign(
    { id: "650000000000000000000099", userId: "650000000000000000000099", role: "admin", name: "Admin" },
    JWT_SECRET
);
const userToken = jwt.sign(
    { id: "650000000000000000000001", userId: "650000000000000000000001", role: "user", name: "Player" },
    JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/admin/tournaments", adminTournamentRoutes);

describe("Challenger 2 Empirical Stress Test: Link Crawler & Temporal Horizon", () => {
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
        Object.defineProperty(mongoose.connection, "readyState", {
            value: 1,
            configurable: true
        });
        jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    });

    // =========================================================================
    // 1. Link Healthcheck Crawler Adversarial Network Simulation
    // =========================================================================
    describe("1. Link Healthcheck Crawler Adversarial Network Simulation", () => {
        test("1.1 HTTP 404 Not Found via HEAD marks linkStatus as expired with statusCode 404", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 404,
                headers: {},
                data: ""
            });

            const res = await verifyLinkHealth("https://nvbadmintonacademy.com/events/past-open-404");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(404);
        });

        test("1.2 HTTP 404 Not Found thrown as AxiosError marks linkStatus as expired", async () => {
            const err = new Error("Request failed with status code 404");
            err.response = { status: 404 };
            jest.spyOn(axios, "head").mockRejectedValueOnce(err);

            const res = await checkLinkHealth("https://capitalbadminton.com/tournaments/dead-form-404");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(404);
        });

        test("1.3 HTTP 500 Internal Server Error marks linkStatus as expired with statusCode 500", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 500,
                headers: {},
                data: ""
            });

            const res = await verifyLinkHealth("https://example-club.org/server-error-500");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(500);
        });

        test("1.4 Network ECONNREFUSED marks linkStatus as expired with statusCode 0 and error string", async () => {
            const connErr = new Error("connect ECONNREFUSED 127.0.0.1:8080");
            connErr.code = "ECONNREFUSED";
            jest.spyOn(axios, "head").mockRejectedValueOnce(connErr);

            const res = await verifyLinkHealth("http://localhost:8080/tournament-form");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(0);
            expect(res.error).toContain("ECONNREFUSED");
        });

        test("1.5 Socket Hangup (ECONNRESET) marks linkStatus as expired gracefully without crash", async () => {
            const resetErr = new Error("socket hang up");
            resetErr.code = "ECONNRESET";
            jest.spyOn(axios, "head").mockRejectedValueOnce(resetErr);

            const res = await verifyLinkHealth("https://flaky-server.org/hangup");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(0);
            expect(res.error).toBe("socket hang up");
        });

        test("1.6 Socket Timeout (ECONNABORTED / timeout of 5000ms exceeded) marks linkStatus as expired", async () => {
            const timeoutErr = new Error("timeout of 5000ms exceeded");
            timeoutErr.code = "ECONNABORTED";
            jest.spyOn(axios, "head").mockRejectedValueOnce(timeoutErr);

            const res = await verifyLinkHealth("https://very-slow-server.com/register", 5000);
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(0);
            expect(res.error).toContain("timeout");
        });

        test("1.7 HTTP 405 Method Not Allowed on HEAD triggers GET fallback returning 200 OK (marked valid)", async () => {
            // HEAD returns 405
            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 405,
                headers: {},
                data: ""
            });
            // GET fallback returns 200 OK
            const getSpy = jest.spyOn(axios, "get").mockResolvedValueOnce({
                status: 200,
                headers: { "content-type": "text/html" },
                data: "<html>Registration Open</html>"
            });

            const res = await verifyLinkHealth("https://docs.google.com/forms/d/e/1FAIpQLScGMU/viewform");
            expect(res.linkStatus).toBe("valid");
            expect(res.isAlive).toBe(true);
            expect(res.statusCode).toBe(200);
            expect(getSpy).toHaveBeenCalledWith(
                "https://docs.google.com/forms/d/e/1FAIpQLScGMU/viewform",
                expect.objectContaining({
                    maxContentLength: 50 * 1024,
                    maxBodyLength: 50 * 1024
                })
            );
        });

        test("1.8 HTTP 405 Method Not Allowed on HEAD with failing GET fallback (404) marks expired", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 405 });
            jest.spyOn(axios, "get").mockResolvedValueOnce({ status: 404 });

            const res = await verifyLinkHealth("https://custom-forms.com/deleted-405-then-404");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(404);
        });

        test("1.9 HTTP 405 Method Not Allowed on HEAD where GET fallback throws timeout marks expired", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 405 });
            const timeoutErr = new Error("timeout of 5000ms exceeded");
            timeoutErr.code = "ECONNABORTED";
            jest.spyOn(axios, "get").mockRejectedValueOnce(timeoutErr);

            const res = await verifyLinkHealth("https://custom-forms.com/timeout-get");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.statusCode).toBe(0);
        });

        test("1.10 Redirect loop (ERR_TOO_MANY_REDIRECTS) is caught and handled safely", async () => {
            const redirectErr = new Error("Maximum number of redirects exceeded");
            redirectErr.code = "ERR_TOO_MANY_REDIRECTS";
            jest.spyOn(axios, "head").mockRejectedValueOnce(redirectErr);

            const res = await verifyLinkHealth("https://looping-redirects.com/tournament");
            expect(res.linkStatus).toBe("expired");
            expect(res.isAlive).toBe(false);
            expect(res.error).toContain("redirects");
        });

        test("1.11 Malformed, empty, and non-HTTP URLs return expired without throwing unhandled exceptions", async () => {
            const badInputs = [
                "",
                null,
                undefined,
                "javascript:void(0)",
                "ftp://files.example.com/sheet.pdf",
                "not-a-valid-url"
            ];

            for (const input of badInputs) {
                const res = await verifyLinkHealth(input);
                expect(res.linkStatus).toBe("expired");
                expect(res.isAlive).toBe(false);
                expect(res.statusCode).toBe(0);
            }
        });
    });

    // =========================================================================
    // 2. Host Club Homepage Fallback Resolution Matrix
    // =========================================================================
    describe("2. Host Club Homepage Fallback Resolution Matrix", () => {
        test("2.1 Direct handle @gmu_badminton maps to Linktree", () => {
            expect(resolveHostClubFallback({ hostClubHandle: "@gmu_badminton" }))
                .toBe("https://linktr.ee/gmubadminton");
            expect(resolveHostClubFallback({ hostClubHandle: "gmubadminton" }))
                .toBe("https://linktr.ee/gmubadminton");
        });

        test("2.2 Direct handle @umd_badminton maps to Linktree", () => {
            expect(resolveHostClubFallback({ hostClubHandle: "@umd_badminton" }))
                .toBe("https://linktr.ee/umd_badminton");
            expect(resolveHostClubFallback({ hostClubHandle: "umdclubbadminton" }))
                .toBe("https://linktr.ee/umd_badminton");
        });

        test("2.3 Regional training hubs @cba_badminton and @nvbadminton map to official websites", () => {
            expect(resolveHostClubFallback({ hostClubHandle: "@cba_badminton" }))
                .toBe("https://www.capitalbadminton.com");
            expect(resolveHostClubFallback({ hostClubHandle: "capitalbadminton" }))
                .toBe("https://www.capitalbadminton.com");
            expect(resolveHostClubFallback({ hostClubHandle: "@nvbadminton" }))
                .toBe("https://novabadmintonacademy.com");
            expect(resolveHostClubFallback({ hostClubHandle: "novabadminton" }))
                .toBe("https://novabadmintonacademy.com");
        });

        test("2.4 Arbitrary collegiate handle dynamically constructs Linktree bio fallback", () => {
            expect(resolveHostClubFallback({ hostClubHandle: "@uvabadminton" }))
                .toBe("https://linktr.ee/uvabadminton");
            expect(resolveHostClubFallback({ hostClubHandle: "@vtechbadminton" }))
                .toBe("https://linktr.ee/vtechbadminton");
            expect(resolveHostClubFallback({ hostClubHandle: "@gwbadminton" }))
                .toBe("https://linktr.ee/gwbadminton");
        });

        test("2.5 Textual inference maps GMU / RAC Gym keywords to GMU Linktree", () => {
            const tourney = {
                tournamentName: "Patriot Smash 2026",
                eventLocation: "Recreation Athletic Complex (RAC Gym), Fairfax, VA",
                hostUniversity: "George Mason University"
            };
            expect(resolveHostClubFallback(tourney)).toBe("https://linktr.ee/gmubadminton");
        });

        test("2.6 Textual inference maps Capital Badminton / Columbia keywords to CBA homepage", () => {
            const tourney = {
                tournamentName: "DMV Mid-Atlantic Open",
                eventLocation: "Columbia, MD",
                sourceUrl: "https://www.capitalbadminton.com/news/123"
            };
            expect(resolveHostClubFallback(tourney)).toBe("https://www.capitalbadminton.com");
        });

        test("2.7 Textual inference maps Ashburn / Northern Virginia keywords to NVBC homepage", () => {
            const tourney = {
                tournamentName: "2026 Ashburn Winter Open",
                eventLocation: "Ashburn, VA",
                tournamentDetails: "Northern Virginia Badminton Academy"
            };
            expect(resolveHostClubFallback(tourney)).toBe("https://novabadmintonacademy.com");
        });

        test("2.8 Fallback when metadata is empty or undefined defaults safely to GMU Linktree", () => {
            expect(resolveHostClubFallback({})).toBe("https://linktr.ee/gmubadminton");
            expect(resolveHostClubFallback(undefined)).toBe("https://linktr.ee/gmubadminton");
            expect(resolveHostClubFallback()).toBe("https://linktr.ee/gmubadminton");
            // Adversarial edge case: null argument throws TypeError because default param only catches undefined
            expect(() => resolveHostClubFallback(null)).toThrow(TypeError);
        });
    });

    // =========================================================================
    // 3. Tournament Document Link Mutation & Batch Healthcheck Crawler
    // =========================================================================
    describe("3. Tournament Document Link Mutation & Batch Healthcheck Crawler", () => {
        test("3.1 checkAndUpdateTournamentLink assigns fallback and expired status when link fails", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 404 });

            const mockTourney = {
                tournamentName: "2026 GMU Badminton Open",
                registrationUrl: "https://forms.gle/dead-link-404",
                hostClubHandle: "@gmu_badminton",
                save: jest.fn().mockResolvedValue(true)
            };

            const updated = await checkAndUpdateTournamentLink(mockTourney);
            expect(updated.linkStatus).toBe("expired");
            expect(updated.linkStatusCode).toBe(404);
            expect(updated.fallbackRegistrationUrl).toBe("https://linktr.ee/gmubadminton");
            expect(mockTourney.save).toHaveBeenCalled();
        });

        test("3.2 checkAndUpdateTournamentLink preserves empty fallback when link is alive (200 OK)", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 200 });

            const mockTourney = {
                tournamentName: "2026 UMD Terrapin Cup",
                registrationUrl: "https://docs.google.com/forms/d/live-form/viewform",
                hostClubHandle: "@umd_badminton",
                save: jest.fn().mockResolvedValue(true)
            };

            const updated = await checkAndUpdateTournamentLink(mockTourney);
            expect(updated.linkStatus).toBe("valid");
            expect(updated.linkStatusCode).toBe(200);
            expect(updated.fallbackRegistrationUrl).toBe("");
            expect(mockTourney.save).toHaveBeenCalled();
        });

        test("3.3 checkAndUpdateTournamentLink marks unchecked with fallback when registrationUrl is missing", async () => {
            const mockTourney = {
                tournamentName: "Announced Open Without Link",
                registrationUrl: "",
                hostClubHandle: "@gmu_badminton",
                save: jest.fn().mockResolvedValue(true)
            };

            const updated = await checkAndUpdateTournamentLink(mockTourney);
            expect(updated.linkStatus).toBe("unchecked");
            expect(updated.fallbackRegistrationUrl).toBe("https://linktr.ee/gmubadminton");
            expect(mockTourney.save).toHaveBeenCalled();
        });

        test("3.4 runTournamentLinkHealthcheck processes batch, tallies statistics, and evicts Redis keys", async () => {
            // Populate Redis with sample keys
            await redis.set("tournaments:{\"status\":{\"$ne\":\"archived\"}}", "cached_json");
            await redis.set("tournaments:search_gmu", "cached_search");

            const batch = [
                {
                    _id: "t1",
                    tournamentName: "Healthy GMU Open",
                    registrationUrl: "https://link-1-alive.com",
                    hostClubHandle: "@gmu_badminton",
                    save: jest.fn().mockResolvedValue(true)
                },
                {
                    _id: "t2",
                    tournamentName: "Broken UMD Cup",
                    registrationUrl: "https://link-2-broken-404.com",
                    hostClubHandle: "@umd_badminton",
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            const mockQuery = {
                limit: jest.fn().mockResolvedValue(batch)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            // Mock first head as 200, second head as 404
            jest.spyOn(axios, "head")
                .mockResolvedValueOnce({ status: 200 })
                .mockResolvedValueOnce({ status: 404 });

            const result = await runTournamentLinkHealthcheck(10);
            expect(result.checkedCount).toBe(2);
            expect(result.validCount).toBe(1);
            expect(result.expiredCount).toBe(1);

            // Verify Redis cache keys were evicted
            const remainingKeys = await redis.keys("tournaments:*");
            expect(remainingKeys).toHaveLength(0);
        });
    });

    // =========================================================================
    // 4. Strict Temporal Horizon & Directory Query Invariants
    // =========================================================================
    describe("4. Strict Temporal Horizon & Directory Query Invariants", () => {
        test("4.1 Default public directory query GET /api/tournaments executes with status ne archived", async () => {
            const activeTournaments = [
                {
                    _id: new mongoose.Types.ObjectId("650000000000000000000101"),
                    tournamentName: "2026 Future GMU Open",
                    status: "active",
                    startDate: new Date("2026-11-07T09:00:00.000Z"),
                    endDate: new Date("2026-11-08T18:00:00.000Z"),
                    attendees: []
                }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(activeTournaments)
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(1);
            expect(res.body.tournaments[0].tournamentName).toBe("2026 Future GMU Open");

            // Assert that find was called with { status: { $ne: 'archived' } }
            expect(findSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: { $ne: "archived" }
                })
            );
        });

        test("4.2 Proactive auto-archive in GET /api/tournaments updates elapsed events where endDate < now", async () => {
            const updateSpy = jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 2 });
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([
                    {
                        _id: new mongoose.Types.ObjectId("650000000000000000000102"),
                        tournamentName: "2026 Live Open",
                        status: "active",
                        attendees: []
                    }
                ])
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);
            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: { $ne: "archived" },
                    $or: [
                        { endDate: { $lt: expect.any(Date) } },
                        { endDate: null, startDate: { $lt: expect.any(Date) } }
                    ]
                }),
                expect.objectContaining({
                    $set: { status: "archived", isOpenTournament: false }
                })
            );
        });

        test("4.3 Explicit status=archived query bypasses filter and retrieves archived tournaments", async () => {
            const archivedTournaments = [
                {
                    _id: new mongoose.Types.ObjectId("650000000000000000000999"),
                    tournamentName: "2025 Historic GMU Open",
                    status: "archived",
                    startDate: new Date("2025-11-01T09:00:00.000Z"),
                    endDate: new Date("2025-11-02T18:00:00.000Z"),
                    attendees: []
                }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(archivedTournaments)
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments?status=archived");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(1);
            expect(res.body.tournaments[0].tournamentName).toBe("2025 Historic GMU Open");
            expect(findSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "archived"
                })
            );
        });

        test("4.4 Explicit includeArchived=true query does not apply status filter", async () => {
            const allTournaments = [
                { _id: new mongoose.Types.ObjectId(), tournamentName: "Active Open", status: "active", attendees: [] },
                { _id: new mongoose.Types.ObjectId(), tournamentName: "Past Open", status: "archived", attendees: [] }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(allTournaments)
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments?includeArchived=true");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(2);

            // Verify query does not have query.status set
            const calledQuery = findSpy.mock.calls[0][0];
            expect(calledQuery.status).toBeUndefined();
        });

        test("4.5 Direct ID lookup GET /api/tournaments/:id preserves historical match records and division draws", async () => {
            const historicId = new mongoose.Types.ObjectId("650000000000000000000888");
            const historicTournament = {
                _id: historicId,
                tournamentName: "2024 Mid-Atlantic Collegiate Championship",
                status: "archived",
                eventLocation: "RAC Gymnasium Court 1-6",
                divisions: [
                    { name: "Men's Singles Open", code: "MS_OPEN", maxDraw: 32 },
                    { name: "Mixed Doubles A", code: "XD_A", maxDraw: 16 }
                ],
                attendees: [{ _id: "u1", name: "Champion Player" }]
            };

            const mockQuery = {
                populate: jest.fn().mockResolvedValue(historicTournament)
            };
            const findByIdSpy = jest.spyOn(Tournament, "findById").mockReturnValue(mockQuery);

            const res = await request(app).get(`/api/tournaments/${historicId}`);
            expect(res.status).toBe(200);
            expect(res.body.tournament).toBeDefined();
            expect(res.body.tournament.tournamentName).toBe("2024 Mid-Atlantic Collegiate Championship");
            expect(res.body.tournament.status).toBe("archived");
            expect(res.body.tournament.divisions).toHaveLength(2);
            expect(findByIdSpy).toHaveBeenCalledWith(historicId.toString());
        });

        test("4.6 Direct ID lookup returns 400 for malformed ObjectId string", async () => {
            const res = await request(app).get("/api/tournaments/not-a-valid-mongo-id");
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("Invalid tournament ID");
        });

        test("4.7 Direct ID lookup returns 404 when tournament does not exist", async () => {
            const nonExistentId = new mongoose.Types.ObjectId("650000000000000000000777");
            const mockQuery = {
                populate: jest.fn().mockResolvedValue(null)
            };
            jest.spyOn(Tournament, "findById").mockReturnValue(mockQuery);

            const res = await request(app).get(`/api/tournaments/${nonExistentId}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toContain("Tournament not found");
        });
    });

    // =========================================================================
    // 5. Cron Auto-Archival & Redis Eviction Under Concurrent Bursts
    // =========================================================================
    describe("5. Cron Auto-Archival & Redis Eviction Under Concurrent Bursts", () => {
        test("5.1 cleanupArchivedTournaments updates elapsed events and evicts all tournaments:* Redis keys", async () => {
            // Seed Redis with cache keys
            await redis.set("tournaments:{\"status\":{\"$ne\":\"archived\"}}", JSON.stringify([{ id: 1 }]));
            await redis.set("tournaments:month_2026-11", JSON.stringify([{ id: 2 }]));

            const updateSpy = jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 3 });

            const result = await cleanupArchivedTournaments();
            expect(result.modifiedCount).toBe(3);
            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: { $ne: "archived" }
                }),
                expect.objectContaining({
                    $set: { status: "archived", isOpenTournament: false }
                })
            );

            // Verify Redis keys were evicted
            const keys = await redis.keys("tournaments:*");
            expect(keys).toHaveLength(0);
        });

        test("5.2 Rapid sequential queries properly hit Redis cache, then refresh after eviction", async () => {
            const activeTourney = {
                _id: new mongoose.Types.ObjectId("650000000000000000000555"),
                tournamentName: "2026 Cacheable Open",
                status: "active",
                attendees: []
            };

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([activeTourney])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            // Request 1: Cache Miss -> calls DB and writes to Redis
            const res1 = await request(app).get("/api/tournaments");
            expect(res1.status).toBe(200);
            expect(res1.body.cached).toBe(false);
            expect(findSpy).toHaveBeenCalledTimes(1);

            // Request 2: Cache Hit -> served from Redis without DB call
            const res2 = await request(app).get("/api/tournaments");
            expect(res2.status).toBe(200);
            expect(res2.body.cached).toBe(true);
            expect(findSpy).toHaveBeenCalledTimes(1); // No new DB call

            // Cron runs and evicts cache
            await cleanupArchivedTournaments();

            // Request 3: After Eviction -> Cache Miss -> fresh DB call
            const res3 = await request(app).get("/api/tournaments");
            expect(res3.status).toBe(200);
            expect(res3.body.cached).toBe(false);
            expect(findSpy).toHaveBeenCalledTimes(2); // New DB call triggered!
        });

        test("5.3 50 concurrent burst requests execute cleanly without unhandled rejections or crashes", async () => {
            const tourneys = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    tournamentName: "Concurrent Open",
                    status: "active",
                    attendees: []
                }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(tourneys)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);
            jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 0 });

            // Launch 50 concurrent requests simultaneously
            const promises = Array.from({ length: 50 }, () =>
                request(app).get("/api/tournaments")
            );

            const results = await Promise.all(promises);
            for (const res of results) {
                expect(res.status).toBe(200);
                expect(res.body.tournaments).toBeDefined();
            }
        });
    });

    // =========================================================================
    // 6. Admin Link Healthcheck Security & Role Guards
    // =========================================================================
    describe("6. Admin Link Healthcheck Security & Role Guards", () => {
        test("6.1 POST /api/admin/tournaments/link-healthcheck rejects unauthenticated request with 401", async () => {
            const res = await request(app)
                .post("/api/admin/tournaments/link-healthcheck")
                .send({ batchSize: 20 });
            expect(res.status).toBe(401);
        });

        test("6.2 POST /api/admin/tournaments/link-healthcheck rejects non-admin player with 403", async () => {
            const res = await request(app)
                .post("/api/admin/tournaments/link-healthcheck")
                .set("Authorization", `Bearer ${userToken}`)
                .send({ batchSize: 20 });
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/Access denied|Forbidden/i);
        });

        test("6.3 POST /api/admin/tournaments/link-healthcheck allows authorized admin and returns stats", async () => {
            const batch = [
                {
                    _id: "t_admin_1",
                    tournamentName: "2026 Verified GMU Open",
                    registrationUrl: "https://gmu.edu/sports/badminton",
                    hostClubHandle: "@gmu_badminton",
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            const mockQuery = {
                limit: jest.fn().mockResolvedValue(batch)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 200 });

            const res = await request(app)
                .post("/api/admin/tournaments/link-healthcheck")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ batchSize: 25 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.checked).toBe(1);
            expect(res.body.healthy).toBe(1);
            expect(res.body.expired).toBe(0);
        });
    });

    // =========================================================================
    // 7. Memory Ceiling & Heap Stability Verification
    // =========================================================================
    describe("7. Memory Ceiling & Heap Stability Verification", () => {
        test("7.1 100 rapid link healthcheck cycles execute strictly within bounded heap (<200MB)", async () => {
            // Trigger GC if available
            if (typeof global.gc === "function") {
                global.gc();
            }

            const initialHeap = process.memoryUsage().heapUsed;

            jest.spyOn(axios, "head").mockImplementation(() =>
                Promise.resolve({ status: 200, headers: {}, data: "" })
            );

            // Execute 100 link health checks
            for (let i = 0; i < 100; i++) {
                await verifyLinkHealth(`https://tournament-test-${i}.org/register`);
            }

            if (typeof global.gc === "function") {
                global.gc();
            }

            const finalHeap = process.memoryUsage().heapUsed;
            const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);
            const totalHeapMb = finalHeap / (1024 * 1024);

            console.log(`[Challenger 2 Memory] Initial: ${(initialHeap / 1024 / 1024).toFixed(2)}MB, Final: ${totalHeapMb.toFixed(2)}MB, Delta: ${heapDeltaMb.toFixed(2)}MB`);

            // Verify heap bounds: total heap must remain well below 200MB
            expect(totalHeapMb).toBeLessThan(200);
            // Verify heap delta is modest (<30MB for 100 operations)
            expect(heapDeltaMb).toBeLessThan(30);
        });
    });
});
