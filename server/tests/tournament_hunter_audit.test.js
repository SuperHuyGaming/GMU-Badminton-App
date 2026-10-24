/**
 * tournament_hunter_audit.test.js
 *
 * Programmatic Verification & Audit Harness for Milestone 6:
 * (1) Zero unapproved tournaments are exposed on the public /api/tournaments endpoint
 *     (pending/rejected proposals in ProposedTournament never leak into the public feed;
 *     only approved tournaments with isOpenTournament: true appear).
 * (2) Link health verification correctly flags unreachable URLs (404, DNS error, timeout)
 *     with linkStatus: 'expired' and assigns verified host club fallbacks (GMU, UMD, CBA, NVBC).
 * (3) New discoveries without dates are safely enqueued as pending proposals with TBD markers
 *     (date: null / "TBD") and confidenceScore: 75 rather than dropped or fabricated.
 */

require('dotenv').config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const axios = require("axios");

// In-Memory Redis Mock with tagged key invalidation support
const mockRedisStore = new Map();
const mockTaggedSets = new Map();

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

// Mock AI parser to avoid network API calls in test environment
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
const {
    verifyLinkHealth,
    resolveHostClubFallback,
    checkAndUpdateTournamentLink
} = require("../utils/linkHealthChecker");
const { processDiscoveryQueue } = require("../utils/autonomousHunter");
const { parseDiscoveredWebpage } = require("../utils/aiParser");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_badminton_key_2026";
const adminId = "650000000000000000000099";
const userId = "650000000000000000000001";

const adminToken = jwt.sign(
    { id: adminId, userId: adminId, role: "admin", name: "Club Director" },
    JWT_SECRET
);

const userToken = jwt.sign(
    { id: userId, userId: userId, role: "user", name: "Student Player" },
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

describe("Milestone 6: Tournament Hunter & Ingestion Audit Suite", () => {
    let originalReadyState;
    let memUsageSpy;

    beforeAll(() => {
        originalReadyState = mongoose.connection.readyState;
        memUsageSpy = jest.spyOn(process, "memoryUsage").mockReturnValue({
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
        Object.defineProperty(mongoose.connection, "readyState", {
            value: originalReadyState,
            configurable: true
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisStore.clear();
        mockTaggedSets.clear();
        Object.defineProperty(mongoose.connection, "readyState", {
            value: 1,
            configurable: true
        });
        jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 0 });
        jest.spyOn(User, "find").mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
    });

    // =========================================================================
    // AUDIT REQUIREMENT 1: Public Feed Isolation & Zero Unapproved Exposure
    // =========================================================================
    describe("Audit 1: Zero Unapproved Tournaments on Public Endpoint (/api/tournaments)", () => {
        test("1.1 When only pending/rejected proposals exist in ProposedTournament, GET /api/tournaments returns 0 tournaments", async () => {
            const pendingProposals = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    tournamentName: "2026 Scraped Unapproved Open",
                    status: "pending",
                    confidenceScore: 88,
                    location: "RAC Gym",
                    date: new Date("2026-11-07")
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    tournamentName: "2026 Rejected Garbage Entry",
                    status: "rejected",
                    confidenceScore: 40,
                    location: "Unknown",
                    date: null
                }
            ];

            // ProposedTournament has proposals, but Tournament collection has 0 documents
            jest.spyOn(ProposedTournament, "find").mockReturnValue({
                sort: jest.fn().mockResolvedValue(pendingProposals)
            });

            const emptyQuery = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            jest.spyOn(Tournament, "find").mockReturnValue(emptyQuery);

            const res = await request(app).get("/api/tournaments");

            expect(res.status).toBe(200);
            expect(res.body.tournaments).toBeDefined();
            expect(res.body.tournaments).toHaveLength(0);

            // Verify that ProposedTournament was NEVER queried by the public route
            expect(ProposedTournament.find).not.toHaveBeenCalled();
            expect(Tournament.find).toHaveBeenCalled();
        });

        test("1.2 Only approved tournaments with isOpenTournament: true appear in public feed", async () => {
            const liveTournaments = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    tournamentName: "2026 Verified GMU Badminton Open",
                    eventLocation: "Recreation Athletic Complex (RAC), Fairfax, VA",
                    startDate: new Date("2026-11-07T09:00:00.000Z"),
                    endDate: new Date("2026-11-08T18:00:00.000Z"),
                    isOpenTournament: true,
                    status: "active",
                    registrationUrl: "https://linktr.ee/gmubadminton"
                }
            ];

            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(liveTournaments)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments");

            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(1);
            expect(res.body.tournaments[0].tournamentName).toBe("2026 Verified GMU Badminton Open");
            expect(res.body.tournaments[0].isOpenTournament).toBe(true);
        });

        test("1.3 Admin approval transitions proposal and safely publishes to Tournament model", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            const mockProposal = {
                _id: proposalId,
                tournamentName: "2026 Mid-Atlantic Collegiate Championships",
                location: "Capital Badminton Academy, Columbia, MD",
                date: new Date("2026-11-21T09:00:00.000Z"),
                registrationLink: "https://www.tournamentsoftware.com/tournament/123",
                sourceUrl: "https://www.tournamentsoftware.com/tournament/123",
                scrapedImageUrls: ["https://example.com/flyer.jpg"],
                skillLevels: ["Open", "Flight A", "Flight B"],
                rawCaption: "Official Mid-Atlantic collegiate draw",
                status: "pending",
                confidenceScore: 92,
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(mockProposal);
            jest.spyOn(Tournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            
            const savedTournament = {
                _id: new mongoose.Types.ObjectId().toString(),
                tournamentName: mockProposal.tournamentName,
                isOpenTournament: true,
                status: "active"
            };
            jest.spyOn(Tournament.prototype, "save").mockResolvedValue(savedTournament);

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(mockProposal.status).toBe("approved");
            expect(mockProposal.approvedBy).toBe(adminId);
            expect(mockProposal.approvedAt).toBeInstanceOf(Date);
            expect(mockIo.emit).toHaveBeenCalledWith("tournamentApproved", expect.anything());
        }, 15000);

        test("1.4 Admin rejection marks proposal as rejected and never creates a live tournament", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            const mockProposal = {
                _id: proposalId,
                tournamentName: "Spam Non-Badminton Event",
                status: "pending",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(mockProposal);
            const tournamentSaveSpy = jest.spyOn(Tournament.prototype, "save");

            const res = await request(app)
                .post(`/api/admin/tournaments/reject/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Non-collegiate out of state advertisement" });

            expect(res.status).toBe(200);
            expect(mockProposal.status).toBe("rejected");
            expect(mockProposal.rejectionReason).toBe("Non-collegiate out of state advertisement");
            expect(mockProposal.rejectedAt).toBeInstanceOf(Date);
            expect(tournamentSaveSpy).not.toHaveBeenCalled();
        });

        test("1.5 Non-admin user cannot access review queue or approve proposals", async () => {
            const resGet = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${userToken}`);
            expect(resGet.status).toBe(403);

            const fakeId = new mongoose.Types.ObjectId().toString();
            const resPost = await request(app)
                .post(`/api/admin/tournaments/approve/${fakeId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(resPost.status).toBe(403);
        });
    });

    // =========================================================================
    // AUDIT REQUIREMENT 2: Link Health Verification & Verified Fallback Routing
    // =========================================================================
    describe("Audit 2: Automated Link Health Verification & Host Club Fallback Routing", () => {
        test("2.1 verifyLinkHealth flags HTTP 404 with linkStatus: 'expired' and statusCode: 404", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 404,
                headers: {}
            });

            const result = await verifyLinkHealth("https://example.com/broken-google-form", 3000);

            expect(result.linkStatus).toBe("expired");
            expect(result.isAlive).toBe(false);
            expect(result.statusCode).toBe(404);
        });

        test("2.2 verifyLinkHealth flags DNS error (ENOTFOUND) and network timeout (ECONNABORTED)", async () => {
            const dnsErr = new Error("getaddrinfo ENOTFOUND invalid-club-domain.org");
            dnsErr.code = "ENOTFOUND";
            jest.spyOn(axios, "head").mockRejectedValueOnce(dnsErr);

            const resultDns = await verifyLinkHealth("https://invalid-club-domain.org/register", 3000);
            expect(resultDns.linkStatus).toBe("expired");
            expect(resultDns.isAlive).toBe(false);
            expect(resultDns.statusCode).toBe(0);

            const timeoutErr = new Error("timeout of 3000ms exceeded");
            timeoutErr.code = "ECONNABORTED";
            jest.spyOn(axios, "head").mockRejectedValueOnce(timeoutErr);

            const resultTimeout = await verifyLinkHealth("https://slow-server.com/form", 3000);
            expect(resultTimeout.linkStatus).toBe("expired");
            expect(resultTimeout.isAlive).toBe(false);
        });

        test("2.3 verifyLinkHealth handles HTTP 405 Method Not Allowed via GET fallback", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 405 });
            jest.spyOn(axios, "get").mockResolvedValueOnce({ status: 200 });

            const result = await verifyLinkHealth("https://forms.gle/test-405-redirect", 3000);
            expect(result.linkStatus).toBe("valid");
            expect(result.isAlive).toBe(true);
            expect(result.statusCode).toBe(200);
        });

        test("2.4 Verified host club fallback routing for GMU, UMD, CBA, and NVBC", () => {
            // GMU Handle / Venue
            const gmuFallback1 = resolveHostClubFallback({ hostClubHandle: "@gmu_badminton" });
            expect(gmuFallback1).toBe("https://linktr.ee/gmubadminton");

            const gmuFallback2 = resolveHostClubFallback({ eventLocation: "RAC Gym, George Mason University" });
            expect(gmuFallback2).toBe("https://linktr.ee/gmubadminton");

            // UMD Handle / Venue
            const umdFallback1 = resolveHostClubFallback({ hostClubHandle: "@umd_badminton" });
            expect(umdFallback1).toBe("https://linktr.ee/umd_badminton");

            const umdFallback2 = resolveHostClubFallback({ hostUniversity: "University of Maryland Club Badminton" });
            expect(umdFallback2).toBe("https://linktr.ee/umd_badminton");

            // Capital Badminton Academy
            const cbaFallback1 = resolveHostClubFallback({ hostClubHandle: "@cba_badminton" });
            expect(cbaFallback1).toBe("https://www.capitalbadminton.com");

            const cbaFallback2 = resolveHostClubFallback({ tournamentName: "CBA Columbia Open Championships" });
            expect(cbaFallback2).toBe("https://www.capitalbadminton.com");

            // Northern Virginia Badminton Club
            const nvbcFallback1 = resolveHostClubFallback({ hostClubHandle: "@nvbadminton" });
            expect(nvbcFallback1).toBe("https://novabadmintonacademy.com");

            const nvbcFallback2 = resolveHostClubFallback({ eventLocation: "Northern Virginia Badminton Club, Ashburn VA" });
            expect(nvbcFallback2).toBe("https://novabadmintonacademy.com");
        });

        test("2.5 checkAndUpdateTournamentLink automatically assigns fallback when link fails", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({ status: 404 });

            const mockTourney = {
                tournamentName: "2026 Mason Smash Open",
                hostClubHandle: "@gmu_badminton",
                registrationUrl: "https://forms.gle/expired_gmu_form",
                linkStatus: "unchecked",
                fallbackRegistrationUrl: "",
                save: jest.fn().mockResolvedValue(true)
            };

            await checkAndUpdateTournamentLink(mockTourney);

            expect(mockTourney.linkStatus).toBe("expired");
            expect(mockTourney.linkStatusCode).toBe(404);
            expect(mockTourney.fallbackRegistrationUrl).toBe("https://linktr.ee/gmubadminton");
            expect(mockTourney.save).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // AUDIT REQUIREMENT 3: Dateless Discovery Safety Retention & TBD Enqueueing
    // =========================================================================
    describe("Audit 3: Dateless Discovery Safety Retention & Review Enqueueing", () => {
        test("3.1 New discoveries without dates are safely enqueued with date: null and confidence: 75", async () => {
            // Mock AI returning a valid upcoming tournament announcement that lacks an explicit date
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: "2026 Mason Fall Badminton Open",
                hostLocation: "Recreation Athletic Complex (RAC), Fairfax, VA",
                startDate: null, // Dateless!
                endDate: null,
                registrationDeadline: null,
                entryFee: "$25",
                confidenceScore: 92,
                skillLevels: ["Open", "Flight A", "Flight B"]
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, "get").mockResolvedValue({
                data: "<html><body><h1>2026 Mason Fall Badminton Open</h1><p>Badminton open championship</p></body></html>"
            });
            jest.spyOn(axios, "head").mockResolvedValue({ status: 200 });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: "https://example.com/tournaments/gmu-fall-open",
                rawSnippet: "Save the date! GMU Badminton Open 2026 coming to the RAC! Date announcement soon.",
                sourceType: "GOOGLE_SEARCH",
                status: "PENDING_AI_REVIEW",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, "create").mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal).toBeDefined();
            expect(capturedProposal.tournamentName).toBe("2026 Mason Fall Badminton Open");
            expect(capturedProposal.date).toBeNull(); // Must be null, NOT fabricated
            expect(capturedProposal.confidenceScore).toBe(75); // Penalized confidence score for dateless events
            expect(capturedProposal.status).toBe("pending"); // Awaiting admin date confirmation
        }, 15000);

        test("3.2 Dateless proposals appear in admin review queue with confidence 75 and display as TBD", async () => {
            const datelessProposal = {
                _id: new mongoose.Types.ObjectId(),
                tournamentName: "2026 UVA Invitational",
                date: null,
                location: "Memorial Gymnasium, Charlottesville, VA",
                confidenceScore: 75,
                status: "pending"
            };

            jest.spyOn(ProposedTournament, "find").mockReturnValue({
                sort: jest.fn().mockResolvedValue([datelessProposal])
            });

            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].tournamentName).toBe("2026 UVA Invitational");
            expect(res.body[0].date).toBeNull();
            expect(res.body[0].confidenceScore).toBe(75);
        });

        test("3.3 Admin can edit dateless proposal with confirmed date via PUT and approve to live status", async () => {
            const proposalId = new mongoose.Types.ObjectId().toString();
            const mockProposal = {
                _id: proposalId,
                tournamentName: "2026 UVA Invitational",
                date: null,
                location: "Memorial Gymnasium",
                confidenceScore: 75,
                status: "pending",
                skillLevels: ["Open"],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(mockProposal);

            // Step 1: Admin edits the proposal with confirmed date
            const editRes = await request(app)
                .put(`/api/admin/tournaments/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    date: "2026-11-14T09:00:00.000Z",
                    confidenceScore: 95
                });

            expect(editRes.status).toBe(200);
            expect(mockProposal.date).toEqual(new Date("2026-11-14T09:00:00.000Z"));
            expect(mockProposal.confidenceScore).toBe(95);

            // Step 2: Admin approves the verified proposal
            jest.spyOn(Tournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(Tournament.prototype, "save").mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                tournamentName: mockProposal.tournamentName,
                startDate: mockProposal.date,
                isOpenTournament: true
            });

            const approveRes = await request(app)
                .post(`/api/admin/tournaments/approve/${proposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(approveRes.status).toBe(200);
            expect(mockProposal.status).toBe("approved");
        }, 15000);
    });

    // =========================================================================
    // AUDIT REQUIREMENT 4: Pre-Flight Health Hook & Resilient Ingestion
    // =========================================================================
    describe("Audit 4: Pre-Flight Health Probing Hook in Autonomous Hunter", () => {
        test("4.1 processDiscoveryQueue evaluates link health pre-flight and marks expired with fallback", async () => {
            const mockExtracted = {
                isValidDmvTournament: true,
                tournamentName: "2026 CBA Fall Classic",
                hostLocation: "Columbia, MD",
                startDate: "2026-10-24T09:00:00.000Z",
                endDate: "2026-10-25T18:00:00.000Z",
                registrationLink: "https://capitalbadminton.com/dead-link-404",
                confidenceScore: 90
            };

            parseDiscoveredWebpage.mockResolvedValue(mockExtracted);
            jest.spyOn(axios, "get").mockResolvedValue({
                data: "<html><body><h1>2026 CBA Fall Classic</h1><p>badminton tournament</p></body></html>"
            });
            // Simulate 404 response on registration link pre-flight
            jest.spyOn(axios, "head").mockResolvedValue({ status: 404 });

            const mockQueueItem = {
                _id: new mongoose.Types.ObjectId(),
                sourceUrl: "https://capitalbadminton.com/news",
                rawSnippet: "Announcing the 2026 CBA Fall Classic! Register online.",
                sourceType: "GOOGLE_SEARCH",
                status: "PENDING_AI_REVIEW",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockQueueItem])
            });
            jest.spyOn(Tournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            let capturedProposal = null;
            jest.spyOn(ProposedTournament, "create").mockImplementation((doc) => {
                capturedProposal = doc;
                return Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() });
            });

            const result = await processDiscoveryQueue(1);

            expect(result.approved).toBe(1);
            expect(capturedProposal).toBeDefined();
            expect(capturedProposal.linkStatus).toBe("expired");
            expect(capturedProposal.linkStatusCode).toBe(404);
            expect(capturedProposal.fallbackRegistrationUrl).toBe("https://www.capitalbadminton.com");
        }, 15000);
    });
});
