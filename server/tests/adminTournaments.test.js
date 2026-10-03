const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const adminTournamentsRoutes = require("../routes/adminTournaments");
const ProposedTournament = require("../models/ProposedTournament");
const Tournament = require("../models/Tournament");
const {
    parseScrapedTournamentMessage,
    handleMessage,
    TOPIC,
    GROUP_ID
} = require("../utils/kafkaConsumer");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

const adminId = "650000000000000000000099";
const userId = "650000000000000000000001";
const sampleProposalId = "650000000000000000000010";

const adminToken = jwt.sign(
    { id: adminId, userId: adminId, role: "admin", name: "Club Admin" },
    JWT_SECRET
);

const userToken = jwt.sign(
    { id: userId, userId: userId, role: "user", name: "Regular Player" },
    JWT_SECRET
);

// Setup Express application with mock socket
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

app.use("/api/admin/tournaments", adminTournamentsRoutes);

describe("Admin Tournaments API & Proposed Tournament System", () => {
    let mockSaveTournament;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSaveTournament = jest.spyOn(Tournament.prototype, "save").mockImplementation(function () {
            if (!this._id) {
                this._id = new mongoose.Types.ObjectId();
            }
            return Promise.resolve(this);
        });
    });

    afterEach(() => {
        mockSaveTournament.mockRestore();
        jest.restoreAllMocks();
    });

    describe("1. Authentication & Role-Based Authorization", () => {
        it("returns 401 on GET /proposed when unauthenticated", async () => {
            const res = await request(app).get("/api/admin/tournaments/proposed");
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/no token/i);
        });

        it("returns 401 on GET /proposed with an invalid token", async () => {
            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", "Bearer invalid-token-xyz");
            expect(res.status).toBe(401);
        });

        it("returns 403 on GET /proposed when authenticated as regular user", async () => {
            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admins only/i);
        });

        it("returns 401 on POST /approve/:id when unauthenticated", async () => {
            const res = await request(app).post(`/api/admin/tournaments/approve/${sampleProposalId}`);
            expect(res.status).toBe(401);
        });

        it("returns 403 on POST /approve/:id when authenticated as regular user", async () => {
            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${sampleProposalId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admins only/i);
        });

        it("returns 401 on POST /reject/:id when unauthenticated", async () => {
            const res = await request(app).post(`/api/admin/tournaments/reject/${sampleProposalId}`);
            expect(res.status).toBe(401);
        });

        it("returns 403 on POST /reject/:id when authenticated as regular user", async () => {
            const res = await request(app)
                .post(`/api/admin/tournaments/reject/${sampleProposalId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admins only/i);
        });

        it("returns 401 on PUT /:id when unauthenticated", async () => {
            const res = await request(app).put(`/api/admin/tournaments/${sampleProposalId}`);
            expect(res.status).toBe(401);
        });

        it("returns 403 on PUT /:id when authenticated as regular user", async () => {
            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${userToken}`)
                .send({ tournamentName: "Hacked Tournament" });
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admins only/i);
        });
    });

    describe("2. GET /api/admin/tournaments/proposed", () => {
        it("returns 200 and all pending proposals sorted by confidenceScore descending", async () => {
            const mockProposals = [
                {
                    _id: "650000000000000000000001",
                    tournamentName: "DMV High Confidence Open",
                    confidenceScore: 95,
                    status: "pending"
                },
                {
                    _id: "650000000000000000000002",
                    tournamentName: "DMV Medium Confidence Open",
                    confidenceScore: 75,
                    status: "pending"
                }
            ];

            const sortMock = jest.fn().mockResolvedValue(mockProposals);
            jest.spyOn(ProposedTournament, "find").mockReturnValue({ sort: sortMock });

            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
            expect(res.body[0].confidenceScore).toBe(95);
            expect(ProposedTournament.find).toHaveBeenCalledWith({ status: "pending" });
            expect(sortMock).toHaveBeenCalledWith({ confidenceScore: -1 });
        });

        it("returns 500 when database error occurs during fetch", async () => {
            jest.spyOn(ProposedTournament, "find").mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error("Database disconnected"))
            });

            const res = await request(app)
                .get("/api/admin/tournaments/proposed")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(500);
            expect(res.body.message).toMatch(/server error/i);
        });
    });

    describe("3. POST /api/admin/tournaments/approve/:id", () => {
        it("returns 400 when proposal ID has an invalid format", async () => {
            const res = await request(app)
                .post("/api/admin/tournaments/approve/not-a-valid-id")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/invalid proposed tournament id format/i);
        });

        it("returns 404 when proposal is not found", async () => {
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/not found/i);
        });

        it("returns 400 when proposal is already approved", async () => {
            const existingApproved = new ProposedTournament({
                tournamentName: "Already Approved Open",
                sourceUrl: "https://example.com/tournament",
                status: "approved"
            });
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(existingApproved);

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/already approved/i);
        });

        it("successfully approves proposal, creates Tournament with isOpenTournament: true, and emits event", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "GMU Fall Open 2026",
                location: "RAC Court 3",
                date: new Date("2026-11-20T10:00:00Z"),
                registrationDeadline: new Date("2026-11-15T23:59:59Z"),
                registrationLink: "https://tournamentsoftware.com/gmu2026",
                sourceUrl: "https://instagram.com/p/samplepost",
                scrapedImageUrls: ["https://cdn.example.com/flyer1.png"],
                sourceLinks: ["https://linktr.ee/gmu_badminton"],
                skillLevels: ["Open", "A", "B"],
                rawCaption: "Annual GMU Fall Open Championship!",
                confidenceScore: 88,
                status: "pending"
            });
            proposalDoc.save = jest.fn().mockResolvedValue(proposalDoc);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/approved and published successfully/i);

            // Mandatory Invariant Verification
            expect(res.body.tournament).toBeDefined();
            expect(res.body.tournament.isOpenTournament).toBe(true);
            expect(res.body.tournament.tournamentName).toBe("GMU Fall Open 2026");
            expect(res.body.tournament.eventLocation).toBe("RAC Court 3");
            expect(res.body.tournament.hostUniversity).toBe("Local Club");
            expect(res.body.tournament.registrationUrl).toBe("https://tournamentsoftware.com/gmu2026");
            expect(res.body.tournament.flyerImageUrl).toBe("https://cdn.example.com/flyer1.png");
            expect(res.body.tournament.rsvpCount).toBe(0);

            // Proposal State Transition Verification
            expect(proposalDoc.status).toBe("approved");
            expect(proposalDoc.approvedAt).toBeDefined();
            expect(proposalDoc.approvedBy.toString()).toBe(adminId);
            expect(proposalDoc.createdTournamentId).toBeDefined();
            expect(proposalDoc.save).toHaveBeenCalled();

            // Real-Time Socket Emission Verification
            expect(mockIo.emit).toHaveBeenCalledWith("tournamentApproved", expect.objectContaining({
                isOpenTournament: true,
                tournamentName: "GMU Fall Open 2026"
            }));
        });

        it("falls back to defaults when optional proposal fields are missing during approval", async () => {
            const minimalProposal = new ProposedTournament({
                tournamentName: "Minimal Tournament",
                sourceUrl: "https://example.com/min",
                status: "pending"
            });
            minimalProposal.save = jest.fn().mockResolvedValue(minimalProposal);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(minimalProposal);

            const res = await request(app)
                .post(`/api/admin/tournaments/approve/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.tournament.isOpenTournament).toBe(true);
            expect(res.body.tournament.eventLocation).toBe("TBD");
            expect(res.body.tournament.registrationUrl).toBe("https://example.com/min");
            expect(res.body.tournament.flyerImageUrl).toBe("");
        });
    });

    describe("4. POST /api/admin/tournaments/reject/:id", () => {
        it("returns 400 when proposal ID has an invalid format", async () => {
            const res = await request(app)
                .post("/api/admin/tournaments/reject/invalid-id")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/invalid proposed tournament id format/i);
        });

        it("returns 404 when proposal is not found", async () => {
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/admin/tournaments/reject/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/not found/i);
        });

        it("successfully rejects proposal with a custom rejection reason", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Spam Post Tournament",
                sourceUrl: "https://example.com/spam",
                status: "pending"
            });
            proposalDoc.save = jest.fn().mockResolvedValue(proposalDoc);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .post(`/api/admin/tournaments/reject/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ reason: "Duplicate posting from previous week" });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/rejected/i);
            expect(proposalDoc.status).toBe("rejected");
            expect(proposalDoc.rejectedAt).toBeDefined();
            expect(proposalDoc.rejectionReason).toBe("Duplicate posting from previous week");
            expect(proposalDoc.save).toHaveBeenCalled();
        });

        it("defaults rejection reason to 'Rejected by admin' when body reason is omitted", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Spam Post Tournament",
                sourceUrl: "https://example.com/spam",
                status: "pending"
            });
            proposalDoc.save = jest.fn().mockResolvedValue(proposalDoc);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .post(`/api/admin/tournaments/reject/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(proposalDoc.rejectionReason).toBe("Rejected by admin");
        });
    });

    describe("5. PUT /api/admin/tournaments/:id", () => {
        it("returns 400 when proposal ID has an invalid format", async () => {
            const res = await request(app)
                .put("/api/admin/tournaments/bad-format-id")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ tournamentName: "Updated Name" });

            expect(res.status).toBe(400);
        });

        it("returns 404 when proposal is not found", async () => {
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(null);

            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ tournamentName: "Updated Name" });

            expect(res.status).toBe(404);
        });

        it("returns 400 when updated tournament name is empty", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Original Name",
                sourceUrl: "https://example.com/test",
                status: "pending"
            });
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ tournamentName: "   " });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/cannot be empty/i);
        });

        it("returns 400 when confidenceScore is outside [0, 100]", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Original Name",
                sourceUrl: "https://example.com/test",
                status: "pending"
            });
            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ confidenceScore: 150 });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/between 0 and 100/i);
        });

        it("updates AI structured fields and applies XSS sanitization", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Original Name",
                sourceUrl: "https://example.com/test",
                location: "Old Gym",
                entryFee: "$20",
                status: "pending"
            });
            proposalDoc.save = jest.fn().mockResolvedValue(proposalDoc);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    tournamentName: "Clean Title <script>alert('xss')</script>",
                    location: "EagleBank Arena",
                    entryFee: "$35",
                    registrationLink: "https://register.com",
                    skillLevels: ["Level A", "<script>bad</script>Level B"],
                    date: "2026-12-01T00:00:00Z",
                    registrationDeadline: "2026-11-25T00:00:00Z",
                    confidenceScore: 92
                });

            expect(res.status).toBe(200);
            expect(proposalDoc.tournamentName).not.toContain("<script>");
            expect(proposalDoc.location).toBe("EagleBank Arena");
            expect(proposalDoc.entryFee).toBe("$35");
            expect(proposalDoc.registrationLink).toBe("https://register.com");
            expect(proposalDoc.skillLevels[1]).not.toContain("<script>");
            expect(proposalDoc.confidenceScore).toBe(92);
            expect(proposalDoc.save).toHaveBeenCalled();
        });

        it("supports updating fields passed within nested aiStructuredData object", async () => {
            const proposalDoc = new ProposedTournament({
                tournamentName: "Original Name",
                sourceUrl: "https://example.com/test",
                status: "pending"
            });
            proposalDoc.save = jest.fn().mockResolvedValue(proposalDoc);

            jest.spyOn(ProposedTournament, "findById").mockResolvedValue(proposalDoc);

            const res = await request(app)
                .put(`/api/admin/tournaments/${sampleProposalId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    aiStructuredData: {
                        tournamentName: "Nested Structured Name",
                        location: "RAC Fieldhouse"
                    }
                });

            expect(res.status).toBe(200);
            expect(proposalDoc.tournamentName).toBe("Nested Structured Name");
            expect(proposalDoc.location).toBe("RAC Fieldhouse");
        });
    });

    describe("6. ProposedTournament Model Schema & Validation", () => {
        it("requires tournamentName", async () => {
            const doc = new ProposedTournament({
                sourceUrl: "https://example.com"
            });
            let validationError;
            try {
                await doc.validate();
            } catch (err) {
                validationError = err;
            }
            expect(validationError).toBeDefined();
            expect(validationError.errors.tournamentName).toBeDefined();
        });

        it("requires sourceUrl", async () => {
            const doc = new ProposedTournament({
                tournamentName: "Tourney Without Source"
            });
            let validationError;
            try {
                await doc.validate();
            } catch (err) {
                validationError = err;
            }
            expect(validationError).toBeDefined();
            expect(validationError.errors.sourceUrl).toBeDefined();
        });

        it("sets schema defaults correctly", () => {
            const doc = new ProposedTournament({
                tournamentName: "Defaults Test",
                sourceUrl: "https://example.com"
            });
            expect(doc.status).toBe("pending");
            expect(doc.confidenceScore).toBe(0);
            expect(doc.location).toBe("TBD");
            expect(doc.rawCaption).toBe("");
            expect(doc.scrapedImageUrls).toEqual([]);
            expect(doc.sourceLinks).toEqual([]);
        });

        it("enforces confidenceScore min and max boundaries", async () => {
            const invalidAbove = new ProposedTournament({
                tournamentName: "Over Confident",
                sourceUrl: "https://example.com",
                confidenceScore: 101
            });
            await expect(invalidAbove.validate()).rejects.toThrow();

            const invalidBelow = new ProposedTournament({
                tournamentName: "Under Confident",
                sourceUrl: "https://example.com",
                confidenceScore: -1
            });
            await expect(invalidBelow.validate()).rejects.toThrow();

            const validBoundary = new ProposedTournament({
                tournamentName: "Boundary Confident",
                sourceUrl: "https://example.com",
                confidenceScore: 100
            });
            await expect(validBoundary.validate()).resolves.toBeUndefined();
        });

        it("enforces status enum validation", async () => {
            const invalidStatus = new ProposedTournament({
                tournamentName: "Enum Test",
                sourceUrl: "https://example.com",
                status: "in-review"
            });
            await expect(invalidStatus.validate()).rejects.toThrow();
        });

        it("correctly gets and sets aiStructuredData virtual", () => {
            const doc = new ProposedTournament({
                tournamentName: "Virtual Test",
                sourceUrl: "https://example.com",
                location: "Old Location"
            });

            expect(doc.aiStructuredData.tournamentName).toBe("Virtual Test");
            expect(doc.aiStructuredData.location).toBe("Old Location");

            doc.aiStructuredData = {
                tournamentName: "New Virtual Title",
                location: "New Hall",
                entryFee: "$50"
            };

            expect(doc.tournamentName).toBe("New Virtual Title");
            expect(doc.location).toBe("New Hall");
            expect(doc.entryFee).toBe("$50");
        });

        it("correctly gets and sets rawScrapedData virtual", () => {
            const doc = new ProposedTournament({
                tournamentName: "Scraped Virtual Test",
                sourceUrl: "https://example.com",
                rawCaption: "Initial Caption"
            });

            expect(doc.rawScrapedData.rawCaption).toBe("Initial Caption");

            doc.rawScrapedData = {
                rawCaption: "Updated Scraped Flyer Text",
                scrapedImageUrls: ["https://cdn.com/img.jpg"],
                sourceLinks: ["https://instagram.com/post"]
            };

            expect(doc.rawCaption).toBe("Updated Scraped Flyer Text");
            expect(doc.scrapedImageUrls).toEqual(["https://cdn.com/img.jpg"]);
            expect(doc.sourceLinks).toEqual(["https://instagram.com/post"]);
        });
    });

    describe("7. Kafka Consumer Stub & Message Processing", () => {
        it("exports required Kafka configuration constants", () => {
            expect(TOPIC).toBe("tournament-scraping");
            expect(GROUP_ID).toBe("gmu-tournament-scraping-group");
        });

        it("parseScrapedTournamentMessage successfully parses a standard scraped payload", () => {
            const rawMessage = JSON.stringify({
                tournamentName: "DC Open 2026",
                sourceUrl: "https://instagram.com/p/dcopen",
                confidenceScore: 89,
                location: "Washington Badminton Club",
                entryFee: "$30",
                rawCaption: "Join us for DC Open!",
                scrapedImageUrls: ["https://cdn.com/dc.jpg"],
                sourceLinks: ["https://linktr.ee/dcbadminton"]
            });

            const parsed = parseScrapedTournamentMessage(rawMessage);
            expect(parsed.tournamentName).toBe("DC Open 2026");
            expect(parsed.sourceUrl).toBe("https://instagram.com/p/dcopen");
            expect(parsed.confidenceScore).toBe(89);
            expect(parsed.location).toBe("Washington Badminton Club");
            expect(parsed.entryFee).toBe("$30");
            expect(parsed.status).toBe("pending");
        });

        it("parseScrapedTournamentMessage extracts nested aiStructuredData and clamps confidenceScore", () => {
            const nestedPayload = {
                sourceUrl: "https://example.com/event",
                confidenceScore: 125, // should clamp to 100
                aiStructuredData: {
                    tournamentName: "Northern VA Open",
                    location: "Fairfax High Fieldhouse",
                    entryFee: "$25"
                },
                rawScrapedData: {
                    rawCaption: "Flyer text..."
                }
            };

            const parsed = parseScrapedTournamentMessage(nestedPayload);
            expect(parsed.tournamentName).toBe("Northern VA Open");
            expect(parsed.location).toBe("Fairfax High Fieldhouse");
            expect(parsed.confidenceScore).toBe(100);
            expect(parsed.rawCaption).toBe("Flyer text...");
        });

        it("parseScrapedTournamentMessage throws when tournamentName is missing", () => {
            expect(() => {
                parseScrapedTournamentMessage({ sourceUrl: "https://example.com" });
            }).toThrow(/missing required field: tournamentname/i);
        });

        it("parseScrapedTournamentMessage throws when sourceUrl is missing", () => {
            expect(() => {
                parseScrapedTournamentMessage({ tournamentName: "No URL" });
            }).toThrow(/missing required field: sourceurl/i);
        });

        it("parseScrapedTournamentMessage throws when message is not valid JSON", () => {
            expect(() => {
                parseScrapedTournamentMessage("invalid-not-json{");
            }).toThrow();
        });

        it("handleMessage successfully persists a ProposedTournament document", async () => {
            const mockSave = jest.spyOn(ProposedTournament.prototype, "save").mockImplementation(function () {
                this._id = new mongoose.Types.ObjectId();
                return Promise.resolve(this);
            });

            const message = {
                value: Buffer.from(JSON.stringify({
                    tournamentName: "Richmond Spring Open",
                    sourceUrl: "https://richmondbadminton.com",
                    confidenceScore: 94
                }))
            };

            const result = await handleMessage({
                topic: "tournament-scraping",
                partition: 0,
                message
            });

            expect(result).toBeDefined();
            expect(result.tournamentName).toBe("Richmond Spring Open");
            expect(mockSave).toHaveBeenCalled();
            mockSave.mockRestore();
        });

        it("handleMessage returns null gracefully on invalid message without throwing", async () => {
            const message = {
                value: Buffer.from("invalid-bad-json")
            };

            const result = await handleMessage({
                topic: "tournament-scraping",
                partition: 0,
                message
            });

            expect(result).toBeNull();
        });
    });
});
