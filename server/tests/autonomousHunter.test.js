const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../utils/redis", () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK")
}));

jest.mock("../utils/aiParser", () => ({
    parseDiscoveredWebpage: jest.fn(),
    parseInstagramPost: jest.fn()
}));

const {
    levenshteinDistance,
    stringSimilarity,
    isDuplicateTournament,
    isSafeExternalUrl,
    processDiscoveryQueue,
    huntGoogleForTournaments,
    huntRegionalClubsAndEnqueue,
    runFullAutonomousHunt,
    getGuaranteedTournamentsList,
    ensureGuaranteedTournaments
} = require("../utils/autonomousHunter");

const {
    isDmvRegion,
    parseTournamentSoftwareHtml,
    crawlTournamentSoftware,
    huntTournamentSoftwareAndEnqueue,
    TS_BASE_URL
} = require("../utils/tournamentSoftwareCrawler");

const DiscoveryQueue = require("../models/DiscoveryQueue");
const ProposedTournament = require("../models/ProposedTournament");
const Tournament = require("../models/Tournament");
const adminTournamentsRoutes = require("../routes/adminTournaments");
const { parseDiscoveredWebpage } = require("../utils/aiParser");

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
app.use("/api/admin/tournaments", adminTournamentsRoutes);

describe("Autonomous Tournament Hunter Suite", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("1. Fuzzy Matching & Levenshtein Distance Algorithm", () => {
        test("computes exact distance 0 and similarity 1.0 for identical strings", () => {
            expect(levenshteinDistance("GMU Open", "GMU Open")).toBe(0);
            expect(stringSimilarity("GMU Open", "GMU Open")).toBe(1.0);
        });

        test("computes correct distance for single character edits", () => {
            expect(levenshteinDistance("kitten", "sitting")).toBe(3);
            expect(stringSimilarity("tournament", "tournamnt")).toBeGreaterThan(0.85);
        });

        test("handles empty and null strings safely", () => {
            expect(levenshteinDistance("", "abc")).toBe(3);
            expect(levenshteinDistance(null, "abc")).toBe(3);
            expect(stringSimilarity("", "abc")).toBe(0);
            expect(stringSimilarity(null, null)).toBe(0);
        });

        test("detects exact and normalized duplicate tournament names", () => {
            const existing = [{ tournamentName: "GMU Spring Open 2027" }];
            expect(isDuplicateTournament("gmu spring open 2027", existing)).toBe(true);
            expect(isDuplicateTournament("GMU Spring Open 2027!!", existing)).toBe(true);
        });

        test("detects fuzzy typos and variations above threshold", () => {
            const existing = [{ tournamentName: "Capital Badminton Open 2027" }];
            // Minor typo
            expect(isDuplicateTournament("Capital Badminton Opn 2027", existing, 0.75)).toBe(true);
            // Completely different event
            expect(isDuplicateTournament("Seattle West Coast Open", existing, 0.75)).toBe(false);
        });

        test("detects substring containment for long tournament titles", () => {
            const existing = [{ tournamentName: "Northern Virginia Badminton Championship" }];
            expect(isDuplicateTournament("Northern Virginia Badminton Championship 2027", existing)).toBe(true);
        });
    });

    describe("2. SSRF Protection & URL Validation", () => {
        test("allows legitimate public HTTPS tournament URLs", () => {
            expect(isSafeExternalUrl("https://usabadminton.tournamentsoftware.com/event/123")).toBe(true);
            expect(isSafeExternalUrl("https://capitalbadminton.com/tournaments")).toBe(true);
        });

        test("blocks localhost, loopback, and private IPv4 ranges", () => {
            expect(isSafeExternalUrl("http://localhost:5000/admin")).toBe(false);
            expect(isSafeExternalUrl("http://127.0.0.1:8080")).toBe(false);
            expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
            expect(isSafeExternalUrl("http://10.0.0.1/secrets")).toBe(false);
            expect(isSafeExternalUrl("http://192.168.1.1/router")).toBe(false);
            expect(isSafeExternalUrl("http://172.16.0.1/private")).toBe(false);
        });

        test("blocks invalid protocols and malformed strings", () => {
            expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
            expect(isSafeExternalUrl("ftp://tournament.com")).toBe(false);
            expect(isSafeExternalUrl("not a url")).toBe(false);
            expect(isSafeExternalUrl(null)).toBe(false);
        });
    });

    describe("3. TournamentSoftware.com Crawler & Parser", () => {
        test("identifies DMV geographic locations correctly", () => {
            expect(isDmvRegion("Fairfax, VA")).toBe(true);
            expect(isDmvRegion("College Park, Maryland")).toBe(true);
            expect(isDmvRegion("Washington DC")).toBe(true);
            expect(isDmvRegion("Philadelphia, PA")).toBe(true);
            expect(isDmvRegion("Raleigh, NC")).toBe(true);
            expect(isDmvRegion("ZIP: 22030")).toBe(true);
            expect(isDmvRegion("Los Angeles, CA")).toBe(false);
            expect(isDmvRegion("Dallas, TX")).toBe(false);
        });

        test("parses tournament HTML cards and extracts structured events", () => {
            const sampleHtml = `
                <div class="tournament-list">
                    <div class="media">
                        <div class="media-body">
                            <h4 class="media-heading">
                                <a href="/tournament/12345">2027 Capital Open Badminton Championships</a>
                            </h4>
                            <span class="location">Columbia, MD 21045</span>
                            <span class="dates">Oct 24 - 25, 2027</span>
                        </div>
                    </div>
                    <div class="media">
                        <div class="media-body">
                            <h4 class="media-heading">
                                <a href="/tournament/99999">San Diego Winter Classic</a>
                            </h4>
                            <span class="location">San Diego, CA</span>
                            <span class="dates">Dec 01, 2027</span>
                        </div>
                    </div>
                </div>
            `;

            const results = parseTournamentSoftwareHtml(sampleHtml, TS_BASE_URL);
            expect(results).toHaveLength(2);

            const dmvEvent = results.find(r => r.tournamentName.includes("Capital Open"));
            expect(dmvEvent).toBeDefined();
            expect(dmvEvent.isDmv).toBe(true);
            expect(dmvEvent.sourceUrl).toContain("12345");
            expect(dmvEvent.location).toContain("MD");

            const caEvent = results.find(r => r.tournamentName.includes("San Diego"));
            expect(caEvent).toBeDefined();
            expect(caEvent.isDmv).toBe(false);
        });

        test("handles empty or malformed HTML without throwing", () => {
            expect(parseTournamentSoftwareHtml("")).toEqual([]);
            expect(parseTournamentSoftwareHtml(null)).toEqual([]);
            expect(parseTournamentSoftwareHtml("<div>No tournaments here</div>")).toEqual([]);
        });
    });

    describe("4. Discovery Queue Processing & AI Evaluation", () => {
        test("processes discovery queue items and routes approved to ProposedTournament", async () => {
            const mockFind = jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([
                    {
                        sourceUrl: "https://example.com/tournament-1",
                        rawSnippet: "GMU Terrapin Classic DMV 2027",
                        sourceType: "GOOGLE_SEARCH",
                        status: "PENDING_AI_REVIEW",
                        save: jest.fn().mockResolvedValue(true)
                    }
                ])
            });

            jest.spyOn(Tournament, "find").mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
            });
            jest.spyOn(ProposedTournament, "find").mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
            });
            const mockCreateProposal = jest.spyOn(ProposedTournament, "create").mockResolvedValue({
                _id: "650000000000000000000088",
                tournamentName: "GMU Terrapin Classic DMV 2027",
                status: "pending"
            });

            parseDiscoveredWebpage.mockResolvedValue({
                isValidDmvTournament: true,
                tournamentName: "GMU Terrapin Classic DMV 2027",
                hostLocation: "Fairfax, VA",
                startDate: "2027-11-15",
                confidenceScore: 94
            });

            const summary = await processDiscoveryQueue(5);
            expect(summary.approved).toBe(1);
            expect(summary.rejected).toBe(0);
            expect(mockCreateProposal).toHaveBeenCalledWith(
                expect.objectContaining({
                    tournamentName: "GMU Terrapin Classic DMV 2027",
                    status: "pending",
                    confidenceScore: 94
                })
            );

            mockFind.mockRestore();
            mockCreateProposal.mockRestore();
        });

        test("rejects items failing AI DMV gatekeeper", async () => {
            const mockItem = {
                sourceUrl: "https://example.com/california-open",
                rawSnippet: "California State Open",
                sourceType: "GOOGLE_SEARCH",
                status: "PENDING_AI_REVIEW",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockItem])
            });
            jest.spyOn(Tournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
            jest.spyOn(ProposedTournament, "find").mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

            parseDiscoveredWebpage.mockResolvedValue({
                isValidDmvTournament: false
            });

            const summary = await processDiscoveryQueue(5);
            expect(summary.rejected).toBe(1);
            expect(mockItem.status).toBe("REJECTED_BY_AI");
            expect(mockItem.save).toHaveBeenCalled();
        });
    });

    describe("5. Admin Discovery Queue REST Endpoints", () => {
        test("GET /api/admin/tournaments/discovery-queue requires admin auth", async () => {
            const resNoAuth = await request(app).get("/api/admin/tournaments/discovery-queue");
            expect(resNoAuth.status).toBe(401);

            const resUser = await request(app)
                .get("/api/admin/tournaments/discovery-queue")
                .set("Authorization", `Bearer ${userToken}`);
            expect(resUser.status).toBe(403);
        });

        test("GET /api/admin/tournaments/discovery-queue returns queued items for admin", async () => {
            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([
                        {
                            _id: "650000000000000000000001",
                            sourceUrl: "https://usabadminton.tournamentsoftware.com/event/1",
                            status: "PENDING_AI_REVIEW"
                        }
                    ])
                })
            });
            jest.spyOn(DiscoveryQueue, "countDocuments").mockResolvedValue(1);

            const res = await request(app)
                .get("/api/admin/tournaments/discovery-queue")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.totalCount).toBe(1);
        });

        test("POST /api/admin/tournaments/discovery-queue/process triggers queue execution", async () => {
            jest.spyOn(DiscoveryQueue, "find").mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
            });

            const res = await request(app)
                .post("/api/admin/tournaments/discovery-queue/process")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ batchSize: 5 });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain("Discovery queue processing complete");
        });
    });

    describe("6. Guaranteed Active Tournaments Initializer", () => {
        test("returns 0 if mongoose is not connected", async () => {
            const count = await ensureGuaranteedTournaments();
            expect(count).toBe(0);
        });

        test("getGuaranteedTournamentsList returns 4 active upcoming tournaments", () => {
            const list = getGuaranteedTournamentsList();
            expect(list).toHaveLength(4);
            expect(list[0].tournamentName).toContain("2026 GMU Badminton Open");
            expect(list[0].isOpenTournament).toBe(true);
            expect(list[0].status).toBe("active");
            expect(new Date(list[0].startDate).getTime()).toBeGreaterThan(Date.now());
        });

        test("ensures guaranteed active tournaments are upserted when database is connected", async () => {
            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

            jest.spyOn(Tournament, "countDocuments").mockResolvedValue(2);
            const mockUpsert = jest.spyOn(Tournament, "findOneAndUpdate").mockResolvedValue({});

            const count = await ensureGuaranteedTournaments();
            expect(count).toBe(4);
            expect(mockUpsert).toHaveBeenCalledTimes(4);

            Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
        });
    });
});
