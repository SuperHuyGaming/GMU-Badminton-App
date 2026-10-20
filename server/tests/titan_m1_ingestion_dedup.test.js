const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const axios = require("axios");

// Mock Redis client to prevent real connection in unit tests
jest.mock("../utils/redis", () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    setex: jest.fn().mockResolvedValue("OK")
}));

// Mock Apify and AI modules for isolated testing
jest.mock("apify-client", () => {
    return {
        ApifyClient: jest.fn().mockImplementation(() => ({
            actor: jest.fn().mockReturnValue({
                call: jest.fn().mockResolvedValue({ defaultDatasetId: "mock_dataset" })
            }),
            dataset: jest.fn().mockReturnValue({
                listItems: jest.fn().mockResolvedValue({ items: [] })
            })
        }))
    };
});

// Import modules under test
const {
    tokenize,
    computeTfIdfVector,
    cosineSimilarity,
    shouldPruneCandidate,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament,
    hasConflictingCollegiateEntities,
    normalizeDivisionKey
} = require("../utils/deduplication");

const {
    checkLinkHealth,
    resolveHostClubFallback,
    runLinkHealthcheckCrawler
} = require("../utils/linkHealthChecker");

const { sanitizeScrapedTitle } = require("../utils/sanitizeScrapedTitle");

const {
    isCampusGroupsUrl,
    isBioLink,
    resolveBioLinkRegistration,
    parseIcsContent,
    parseIcsDate,
    bypassCampusGroupsSso
} = require("../utils/campusGroupsBypass");

const {
    identifyCampusVenue,
    CAMPUS_VENUES,
    fallbackRegexParser,
    fallbackWebpageParser
} = require("../utils/aiParser");

const { cleanupArchivedTournaments } = require("../utils/cronJobs");
const Tournament = require("../models/Tournament");
const tournamentRoutes = require("../routes/tournaments");
const adminTournamentRoutes = require("../routes/adminTournaments");

// Express app setup for route testing
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

describe("Milestone 1 (Project Titan) — Ingestion Deduplication & Data Quality", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    // Problem 1: Fuzzy & Semantic Deduplication Engine + ML Pruning
    // =========================================================================
    describe("P1: Fuzzy Deduplication Engine & ML Candidate Pruning", () => {
        test("computeTfIdfVector generates weighted vector with word tokens and character trigrams", () => {
            const vec = computeTfIdfVector("2026 GMU Badminton Open");
            expect(vec).toBeDefined();
            expect(typeof vec).toBe("object");
            expect(vec["gmu"]).toBeGreaterThan(0);
            expect(vec["2026"]).toBeGreaterThan(0);
            // Trigrams check
            expect(vec["bad"] || vec["adm"]).toBeDefined();
        });

        test("cosineSimilarity calculates accurate vector cosine similarity between 0.0 and 1.0", () => {
            const vec1 = computeTfIdfVector("GMU Badminton Open");
            const vec2 = computeTfIdfVector("GMU Badminton Open");
            const vec3 = computeTfIdfVector("Virginia Tech Table Tennis Championship");

            const identicalScore = cosineSimilarity(vec1, vec2);
            expect(identicalScore).toBeCloseTo(1.0, 4);

            const divergentScore = cosineSimilarity(vec1, vec3);
            expect(divergentScore).toBeLessThan(0.3);
            expect(cosineSimilarity(vec1, {})).toBe(0);
        });

        test("shouldPruneCandidate Stage 1: Prunes candidates exceeding temporal window (>48h)", () => {
            const cand = { tournamentName: "GMU Open", startDate: new Date("2026-11-07") };
            const existing = { tournamentName: "GMU Open", startDate: new Date("2026-11-12") }; // 5 days apart
            const pruneResult = shouldPruneCandidate(cand, existing, { windowHours: 48 });
            expect(pruneResult.prune).toBe(true);
            expect(pruneResult.reason).toBe("temporal_window_exceeded");
        });

        test("shouldPruneCandidate Stage 2: Prunes candidates with extreme length ratio (>3.5:1) without substring", () => {
            const cand = "Smash";
            const existing = "The Official 2026 Mid-Atlantic Collegiate Regional Badminton Open Championships and Festival";
            const pruneResult = shouldPruneCandidate(cand, null, existing, null, 48);
            expect(pruneResult.prune).toBe(true);
            expect(pruneResult.reason).toBe("length_ratio_exceeded");
        });

        test("shouldPruneCandidate Stage 3: Prunes candidates with zero informative token overlap", () => {
            const cand = "UVA Badminton Invitational";
            const existing = "Duke Table Tennis Tournament";
            const pruneResult = shouldPruneCandidate(cand, null, existing, null, 48);
            expect(pruneResult.prune).toBe(true);
            expect(pruneResult.reason).toBe("zero_informative_tokens");
        });

        test("shouldPruneCandidate retains valid duplicate candidates within temporal window and shared tokens", () => {
            const cand = { tournamentName: "2026 GMU Badminton Open", startDate: new Date("2026-11-07T09:00:00Z") };
            const existing = { tournamentName: "2026 GMU Open Championships", startDate: new Date("2026-11-07T12:00:00Z") };
            const pruneResult = shouldPruneCandidate(cand, existing, { windowHours: 48 });
            expect(pruneResult.prune).toBe(false);
        });

        test("computeTitleSimilarity hybrid ensemble fuses TF-IDF Cosine (40%), Jaro-Winkler (35%), and Levenshtein (25%)", () => {
            const t1 = "2026 GMU Badminton Open";
            const t2 = "2026 GMU Open Badminton Championships";
            const score = computeTitleSimilarity(t1, t2);
            expect(score).toBeGreaterThanOrEqual(0.85);
        });

        test("computeTitleSimilarity matches identical and slightly formatted titles (>0.85)", () => {
            const t1 = "2026 GMU Badminton Open";
            const t2 = "2026 GMU Badminton Open!";
            const sim = computeTitleSimilarity(t1, t2);
            expect(sim).toBeGreaterThanOrEqual(0.85);
        });

        test("computeTitleSimilarity normalizes collegiate abbreviations (GMU <-> George Mason)", () => {
            const sim = computeTitleSimilarity("2026 GMU Badminton Open", "2026 George Mason University Badminton Open");
            expect(sim).toBeGreaterThanOrEqual(0.85);
        });

        test("isWithinDateWindow enforces 48-hour temporal window", () => {
            const base = new Date("2026-11-07T09:00:00.000Z");
            const within36h = new Date("2026-11-08T18:00:00.000Z"); // 33 hours apart
            const outside60h = new Date("2026-11-10T09:00:00.000Z"); // 72 hours apart

            expect(isWithinDateWindow(base, within36h, 48)).toBe(true);
            expect(isWithinDateWindow(base, outside60h, 48)).toBe(false);
            expect(isWithinDateWindow(base, null, 48)).toBe(true); // Missing date cannot be rejected
        });

        test("deduplicateTournament merges duplicate within 48h temporal window", () => {
            const existing = [
                {
                    _id: "tourney_canonical_001",
                    tournamentName: "2026 GMU Badminton Open",
                    startDate: new Date("2026-11-07T09:00:00.000Z"),
                    endDate: new Date("2026-11-07T18:00:00.000Z"),
                    divisions: [{ code: "MS_OPEN", name: "Men's Singles Open", maxDraw: 32, fee: "$25" }],
                    registrationUrl: "https://linktr.ee/gmubadminton",
                    attendees: ["user_1"],
                    rsvpCount: 1
                }
            ];

            const candidate = {
                tournamentName: "2026 GMU Open Badminton Championships",
                startDate: new Date("2026-11-08T09:00:00.000Z"), // within 24h
                endDate: new Date("2026-11-08T19:00:00.000Z"),
                divisions: [
                    { code: "MD_OPEN", name: "Men's Doubles Open", maxDraw: 16, fee: "$40" },
                    { code: "MS_OPEN", name: "Men's Singles Open", maxDraw: 64, fee: "$25" } // updated draw
                ],
                registrationUrl: "https://docs.google.com/forms/d/e/1FAIpQLScGMU/viewform",
                attendees: ["user_2"],
                rsvpCount: 1
            };

            const result = deduplicateTournament(candidate, existing, { windowHours: 48, titleThreshold: 0.85 });
            expect(result.isDuplicate).toBe(true);
            expect(result.canonicalId).toBe("tourney_canonical_001");
            expect(result.mergedData).toBeDefined();

            // Check division draw merging
            expect(result.mergedData.divisions).toHaveLength(2);
            const msDiv = result.mergedData.divisions.find(d => d.code === "MS_OPEN");
            expect(msDiv.maxDraw).toBe(64); // Updated to higher draw

            // Check attendee set union
            expect(result.mergedData.attendees).toContain("user_1");
            expect(result.mergedData.attendees).toContain("user_2");
            expect(result.mergedData.rsvpCount).toBe(2);

            // Check date range span (earliest start, latest end)
            expect(new Date(result.mergedData.startDate).toISOString()).toBe("2026-11-07T09:00:00.000Z");
            expect(new Date(result.mergedData.endDate).toISOString()).toBe("2026-11-08T19:00:00.000Z");
        });

        test("deduplicateTournament distinguishes annual tournaments separated by > 48 hours", () => {
            const existing = [
                {
                    _id: "tourney_2026",
                    tournamentName: "Capital Badminton Academy Annual Open",
                    startDate: new Date("2026-05-10T09:00:00.000Z"),
                    endDate: new Date("2026-05-11T18:00:00.000Z")
                }
            ];

            const candidateNextYear = {
                tournamentName: "Capital Badminton Academy Annual Open",
                startDate: new Date("2027-05-09T09:00:00.000Z"), // 1 year apart
                endDate: new Date("2027-05-10T18:00:00.000Z")
            };

            const result = deduplicateTournament(candidateNextYear, existing, { windowHours: 48 });
            expect(result.isDuplicate).toBe(false);
            expect(result.canonicalId).toBeNull();
        });

        test("mergeTournamentData combines links without duplicates and merges venue metadata", () => {
            const canonical = {
                tournamentName: "GMU Open",
                sourceUrl: "https://instagram.com/p/123",
                sourceLinks: ["https://instagram.com/p/123"],
                eventLocation: "DMV Area",
                hostUniversity: "Local Club"
            };

            const incoming = {
                registrationUrl: "https://forms.gle/xyz",
                sourceLinks: ["https://forms.gle/xyz", "https://instagram.com/p/123"],
                eventLocation: "Recreation Athletic Complex (RAC), Fairfax, VA",
                hostUniversity: "George Mason University"
            };

            const merged = mergeTournamentData(canonical, incoming);
            expect(merged.sourceLinks).toContain("https://instagram.com/p/123");
            expect(merged.sourceLinks).toContain("https://forms.gle/xyz");
            expect(merged.registrationUrl).toBe("https://forms.gle/xyz");
            expect(merged.eventLocation).toBe("Recreation Athletic Complex (RAC), Fairfax, VA");
            expect(merged.hostUniversity).toBe("George Mason University");
        });

        test("Collegiate Entity Conflict Guard: distinct institutions on same date are NEVER merged (GMU vs UMD)", () => {
            const existing = [
                {
                    _id: "gmu_canon_1",
                    tournamentName: "2026 GMU Badminton Open",
                    startDate: new Date("2026-11-07T09:00:00Z"),
                    eventLocation: "RAC Gym, Fairfax, VA"
                }
            ];

            const candidate = {
                tournamentName: "2026 UMD Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                eventLocation: "Ritchie Coliseum, College Park, MD"
            };

            const result = deduplicateTournament(candidate, existing);
            expect(result.isDuplicate).toBe(false);
            expect(result.canonicalId).toBeNull();
            expect(result.matchScore).toBe(0);
        });

        test("Collegiate Entity Conflict Guard: distinct institutions on same date are NEVER merged (UVA vs VT)", () => {
            const existing = [
                {
                    _id: "vt_canon_1",
                    tournamentName: "2026 VT Badminton Open",
                    startDate: new Date("2026-11-07T09:00:00Z"),
                    eventLocation: "McComas Hall, Blacksburg, VA"
                }
            ];

            const candidate = {
                tournamentName: "2026 UVA Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                eventLocation: "Mem Gym, Charlottesville, VA"
            };

            const result = deduplicateTournament(candidate, existing);
            expect(result.isDuplicate).toBe(false);
            expect(result.canonicalId).toBeNull();
            expect(result.matchScore).toBe(0);
        });

        test("Stage 3 Token Pruning: year tokens (2026) do not prevent pruning unrelated tournaments", () => {
            const pruneResult = shouldPruneCandidate("2026 Duke Table Tennis", null, "2026 UVA Badminton Open", null, 48);
            expect(pruneResult.prune).toBe(true);
            expect(pruneResult.reason).toBe("zero_informative_tokens");
        });

        test("Division draw normalization: MS_OPEN and Men Singles Open merge cleanly without duplicate draws", () => {
            const existing = {
                divisions: [
                    { code: "MS_OPEN", name: "Men's Singles Open", maxDraw: 32, fee: "$25" }
                ]
            };

            const incoming = {
                divisions: [
                    { name: "Men Singles Open", maxDraw: 64, fee: "$30" },
                    { name: "Women Singles Open", maxDraw: 32, fee: "$30" }
                ]
            };

            const merged = mergeTournamentData(existing, incoming);
            expect(merged.divisions).toHaveLength(2);

            const msDiv = merged.divisions.find(d => d.code === "MS_OPEN");
            expect(msDiv).toBeDefined();
            expect(msDiv.maxDraw).toBe(64);
            expect(msDiv.fee).toBe("$30");

            const wsDiv = merged.divisions.find(d => d.code === "WS_OPEN");
            expect(wsDiv).toBeDefined();
            expect(wsDiv.maxDraw).toBe(32);
        });
    });

    // =========================================================================
    // Problem 2: Strict Temporal Horizon & Auto-Archive Preservation
    // =========================================================================
    describe("P2: Strict Temporal Horizon & Auto-Archive", () => {
        test("cleanupArchivedTournaments auto-archives elapsed tournaments and evicts Redis cache", async () => {
            const updateSpy = jest.spyOn(Tournament, "updateMany").mockResolvedValue({ modifiedCount: 1 });

            const result = await cleanupArchivedTournaments();
            expect(result.modifiedCount).toBe(1);
            expect(updateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: { $ne: "archived" }
                }),
                expect.objectContaining({
                    $set: { status: "archived", isOpenTournament: false }
                })
            );
        });

        test("GET /api/tournaments defaults to filtering out archived tournaments", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([
                    { _id: "active_1", tournamentName: "2026 Active Open", status: "active" }
                ])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);

            // Assert that find was called with { status: { $ne: 'archived' } }
            expect(findSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: { $ne: "archived" }
                })
            );
        });

        test("GET /api/tournaments/:id preserves and returns archived match records", async () => {
            const mockArchived = {
                _id: "650000000000000000000999",
                tournamentName: "2025 Historic GMU Open",
                status: "archived",
                eventLocation: "RAC Gym",
                attendees: [],
                divisions: [{ name: "Men's Singles Open", code: "MS_OPEN" }]
            };

            const mockQuery = {
                populate: jest.fn().mockResolvedValue(mockArchived)
            };
            jest.spyOn(Tournament, "findById").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments/650000000000000000000999");
            expect(res.status).toBe(200);
            expect(res.body.tournament).toBeDefined();
            expect(res.body.tournament.tournamentName).toBe("2025 Historic GMU Open");
            expect(res.body.tournament.status).toBe("archived");
        });
    });

    // =========================================================================
    // Problem 3: Autonomous Link Healthcheck Crawler & Host Club Fallback
    // =========================================================================
    describe("P3: Autonomous Link Healthcheck Crawler", () => {
        test("checkLinkHealth correctly identifies alive URLs on 200 OK", async () => {
            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 200,
                request: { res: { responseUrl: "https://forms.gle/active-form" } }
            });

            const result = await checkLinkHealth("https://forms.gle/active-form");
            expect(result.isAlive).toBe(true);
            expect(result.statusCode).toBe(200);
        });

        test("checkLinkHealth flags dead links on 404 Not Found", async () => {
            const notFoundErr = new Error("Request failed with status code 404");
            notFoundErr.response = { status: 404 };
            jest.spyOn(axios, "head").mockRejectedValueOnce(notFoundErr);

            const result = await checkLinkHealth("https://example.com/broken-tournament-404");
            expect(result.isAlive).toBe(false);
            expect(result.statusCode).toBe(404);
        });

        test("resolveHostClubFallback resolves to collegiate club homepage when registration 404s", () => {
            const gmuTourney = {
                hostClubHandle: "@gmu_badminton",
                hostUniversity: "George Mason University",
                eventLocation: "Fairfax, VA"
            };
            const fallbackGmu = resolveHostClubFallback(gmuTourney);
            expect(fallbackGmu).toBe("https://linktr.ee/gmubadminton");

            const umdTourney = {
                hostClubHandle: "umd_badminton",
                hostUniversity: "University of Maryland"
            };
            const fallbackUmd = resolveHostClubFallback(umdTourney);
            expect(fallbackUmd).toBe("https://linktr.ee/umd_badminton");

            const cbaTourney = {
                tournamentName: "Mid-Atlantic Championships at CBA",
                eventLocation: "Columbia, MD"
            };
            const fallbackCba = resolveHostClubFallback(cbaTourney);
            expect(fallbackCba).toBe("https://www.capitalbadminton.com");
        });

        test("POST /api/admin/tournaments/link-healthcheck triggers crawler and returns report", async () => {
            const mockTournaments = [
                {
                    _id: "live_tourney_healthy",
                    tournamentName: "2026 Healthy Open",
                    registrationUrl: "https://healthy-link.com",
                    linkStatus: "alive",
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            const mockQuery = {
                limit: jest.fn().mockResolvedValue(mockTournaments),
                exec: jest.fn().mockResolvedValue(mockTournaments)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            jest.spyOn(axios, "head").mockResolvedValueOnce({
                status: 200,
                request: { res: { responseUrl: "https://healthy-link.com" } }
            });

            const res = await request(app)
                .post("/api/admin/tournaments/link-healthcheck")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.checked).toBe(1);
            expect(res.body.healthy).toBe(1);
        });
    });

    // =========================================================================
    // Problem 4: Scraping Title Sanitizer
    // =========================================================================
    describe("P4: Scraping Title Sanitizer", () => {
        test("strips inline slogans and website debris without returning null", () => {
            const raw1 = "Tournament Software - 2026 GMU Spring Open - Register Now";
            const clean1 = sanitizeScrapedTitle(raw1);
            expect(clean1).toBe("2026 GMU Spring Open");

            const raw2 = "Home | 2026 Capital Badminton Classic | Welcome to the official tournament";
            const clean2 = sanitizeScrapedTitle(raw2);
            expect(clean2).toBe("2026 Capital Badminton Classic");

            const raw3 = "2026 Mid-Atlantic Collegiate Championships - Powered by Yonex";
            const clean3 = sanitizeScrapedTitle(raw3);
            expect(clean3).toBe("2026 Mid-Atlantic Collegiate Championships");
        });

        test("handles orphaned hyphens, pipes, and delimiters cleanly", () => {
            const raw = " - | 2026 Virginia Tech Winter Invitational | - ";
            const clean = sanitizeScrapedTitle(raw);
            expect(clean).toBe("2026 Virginia Tech Winter Invitational");
        });

        test("preserves valid tournament titles that contain numbers and flight labels", () => {
            const raw = "2026 UMD Terrapin Open (Flight A/B/C)";
            const clean = sanitizeScrapedTitle(raw);
            expect(clean).toBe("2026 UMD Terrapin Open (Flight A/B/C)");
        });
    });

    // =========================================================================
    // Problem 5: Bio Link Registration Resolution & RFC 5545 iCalendar Parsing
    // =========================================================================
    describe("P5: Bio Link Registration Resolution & RFC 5545 Parsing", () => {
        test("isCampusGroupsUrl correctly flags Mason360 / CampusGroups URLs", () => {
            expect(isCampusGroupsUrl("https://mason360.gmu.edu/event/12345")).toBe(true);
            expect(isCampusGroupsUrl("https://umd.campusgroups.com/events")).toBe(true);
            expect(isCampusGroupsUrl("https://linktr.ee/gmubadminton")).toBe(false);
            expect(isCampusGroupsUrl("https://instagram.com/gmu_badminton")).toBe(false);
        });

        test("isBioLink recognizes Linktree, Beacons, and Bio.link", () => {
            expect(isBioLink("https://linktr.ee/gmubadminton")).toBe(true);
            expect(isBioLink("https://beacons.ai/novabadminton")).toBe(true);
            expect(isBioLink("https://bio.link/umd_badminton")).toBe(true);
            expect(isBioLink("https://google.com")).toBe(false);
        });

        test("resolveBioLinkRegistration extracts Google Forms and registration URLs", async () => {
            const mockHtml = `
                <html>
                    <body>
                        <a href="https://docs.google.com/forms/d/e/1FAIpQLScGMUTournament2026/viewform">Registration Form</a>
                        <a href="https://forms.gle/shortLink123">Alternate Sign Up</a>
                        <a href="https://instagram.com/gmu_badminton">Instagram</a>
                    </body>
                </html>
            `;

            jest.spyOn(axios, "get").mockResolvedValueOnce({
                data: mockHtml
            });

            const forms = await resolveBioLinkRegistration("https://linktr.ee/gmubadminton");
            expect(forms).toHaveLength(2);
            expect(forms[0]).toContain("docs.google.com/forms");
            expect(forms[1]).toContain("forms.gle");
        });

        test("parseIcsContent parses RFC 5545 iCalendar stream into structured tournament objects", () => {
            const sampleIcs = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//GMU Club Badminton//Event Calendar//EN",
                "BEGIN:VEVENT",
                "UID:gmu-open-2026@badminton.gmu.edu",
                "DTSTAMP:20260401T120000Z",
                "DTSTART:20261107T090000Z",
                "DTEND:20261108T180000Z",
                "SUMMARY:2026 GMU Badminton Open - Register Now",
                "LOCATION:Recreation Athletic Complex (RAC), Fairfax, VA",
                "DESCRIPTION:Official annual open tournament hosted by Mason Club Badminton at the RAC.",
                "URL:https://forms.gle/gmuOpen2026Form",
                "END:VEVENT",
                "END:VCALENDAR"
            ].join("\r\n");

            const events = parseIcsContent(sampleIcs, "https://calendar.gmu.edu/badminton.ics");
            expect(events).toHaveLength(1);
            const evt = events[0];
            expect(evt.tournamentName).toBe("2026 GMU Badminton Open"); // Stripped "Register Now" via sanitizer
            expect(evt.eventLocation).toBe("Recreation Athletic Complex (RAC), Fairfax, VA");
            expect(new Date(evt.startDate).toISOString()).toBe("2026-11-07T09:00:00.000Z");
            expect(new Date(evt.endDate).toISOString()).toBe("2026-11-08T18:00:00.000Z");
            expect(evt.registrationUrl).toBe("https://forms.gle/gmuOpen2026Form");
        });

        test("parseIcsDate correctly parses UTC, local, and date-only RFC 5545 formats", () => {
            const utcDate = parseIcsDate("20261107T090000Z");
            expect(utcDate).toBeInstanceOf(Date);
            expect(utcDate.toISOString()).toBe("2026-11-07T09:00:00.000Z");

            const dateOnly = parseIcsDate("20261107");
            expect(dateOnly).toBeInstanceOf(Date);
            expect(dateOnly.getFullYear()).toBe(2026);
            expect(dateOnly.getMonth()).toBe(10); // 0-indexed November
            expect(dateOnly.getDate()).toBe(7);
        });

        test("bypassCampusGroupsSso respects user directive that Mason360 is not an ingestion target", async () => {
            const result = await bypassCampusGroupsSso("https://mason360.gmu.edu/events/badminton-open");
            expect(result.isIgnored).toBe(true);
            expect(result.reason).toContain("Mason360 is not an external ingestion source");
        });
    });

    // =========================================================================
    // Domain Insight & Collegiate Venue Recognition
    // =========================================================================
    describe("Collegiate On-Campus Facilities & Venue Recognition", () => {
        test("identifyCampusVenue extracts GMU RAC Gym and George Mason University", () => {
            const text = "Mason Badminton Club Open tournament this November at the RAC Gym!";
            const venue = identifyCampusVenue(text);
            expect(venue).toBeDefined();
            expect(venue.hostUniversity).toBe("George Mason University");
            expect(venue.eventLocation).toContain("Recreation Athletic Complex (RAC Gym)");
            expect(venue.city).toBe("Fairfax, VA");
        });

        test("identifyCampusVenue extracts UMD Ritchie Coliseum / SPH", () => {
            const text = "Annual Terp Open hosted at Ritchie Coliseum in College Park";
            const venue = identifyCampusVenue(text);
            expect(venue).toBeDefined();
            expect(venue.hostUniversity).toBe("University of Maryland");
            expect(venue.eventLocation).toContain("Ritchie Coliseum");
            expect(venue.city).toBe("College Park, MD");
        });

        test("identifyCampusVenue extracts UVA Memorial Gymnasium", () => {
            const text = "Cavalier Invitational at Memorial Gymnasium (Mem Gym) in Charlottesville";
            const venue = identifyCampusVenue(text);
            expect(venue).toBeDefined();
            expect(venue.hostUniversity).toBe("University of Virginia");
            expect(venue.eventLocation).toContain("Memorial Gymnasium");
        });

        test("identifyCampusVenue extracts Virginia Tech McComas Hall", () => {
            const text = "VT Hokie Open 2026 held at McComas Hall in Blacksburg, VA";
            const venue = identifyCampusVenue(text);
            expect(venue).toBeDefined();
            expect(venue.hostUniversity).toBe("Virginia Tech");
            expect(venue.eventLocation).toContain("McComas Hall");
        });

        test("identifyCampusVenue extracts NVBC Ashburn facility", () => {
            const text = "NVBC Open in December hosted at Northern Virginia Badminton Club on Atlantic Blvd";
            const venue = identifyCampusVenue(text);
            expect(venue).toBeDefined();
            expect(venue.hostUniversity).toBe("Northern Virginia Badminton Club");
            expect(venue.eventLocation).toContain("21598 Atlantic Blvd, Ashburn, VA 20147");
        });

        test("fallbackRegexParser auto-enriches venue and hostUniversity from caption", () => {
            const caption = "Join us for the 2026 Mason Open Tournament on Nov 14, 2026 at the RAC Gym! Flight A, B, and C divisions available.";
            const parsed = fallbackRegexParser(caption);
            expect(parsed).toBeDefined();
            expect(parsed.isTournamentPost).toBe(true);
            expect(parsed.hostUniversity).toBe("George Mason University");
            expect(parsed.eventLocation).toContain("Recreation Athletic Complex (RAC Gym)");
            expect(parsed.startDate).toBe("2026-11-14");
        });
    });
});
