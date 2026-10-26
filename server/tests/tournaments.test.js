const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../utils/redis", () => ({
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue("OK")
}));

const tournamentRoutes = require("../routes/tournaments");
const Tournament = require("../models/Tournament");
const TournamentMatch = require("../models/TournamentMatch");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const userId = "650000000000000000000001";
const userToken = jwt.sign(
    { id: userId, userId: userId, role: "user", name: "Player One" },
    JWT_SECRET
);
const adminId = "650000000000000000000002";
const adminToken = jwt.sign(
    { id: adminId, userId: adminId, role: "admin", name: "Admin User" },
    JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/tournaments", tournamentRoutes);

describe("Public Tournaments API & RSVP System", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /api/tournaments", () => {
        it("returns all tournaments sorted by startDate", async () => {
            const mockTournaments = [
                {
                    _id: "650000000000000000000101",
                    tournamentName: "GMU Open 2027",
                    startDate: new Date("2027-04-10"),
                    eventLocation: "RAC Fairfax",
                    attendees: []
                },
                {
                    _id: "650000000000000000000102",
                    tournamentName: "UMD Spring Classic",
                    startDate: new Date("2027-05-15"),
                    eventLocation: "College Park MD",
                    attendees: []
                }
            ];

            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(mockTournaments)
            };
            jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toHaveLength(2);
            expect(res.body.tournaments[0].tournamentName).toBe("GMU Open 2027");
            expect(res.body.cached).toBe(false);
        });

        it("filters tournaments by skill level, location, and search", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?location=Fairfax&skillLevel=Advanced&search=GMU");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                eventLocation: { $regex: "Fairfax", $options: "i" },
                skillLevels: "Advanced"
            }));
        });

        it("filters upcoming tournaments when upcoming=true", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?upcoming=true");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                $or: expect.arrayContaining([
                    expect.objectContaining({ endDate: expect.any(Object) }),
                    expect.objectContaining({ startDate: expect.any(Object) })
                ])
            }));
        });

        it("supports multi-skill filtering with skills parameter", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?skills=Beginner,Advanced");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                skillLevels: { $in: ["Beginner", "Advanced"] }
            }));
        });

        it("supports compound text search with badminton synonym expansion for GMU", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?search=GMU");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                $text: { $search: expect.stringMatching(/GMU.*George Mason|George Mason/i) }
            }));
        });

        it("falls back to regex search for short prefix matching (< 3 characters)", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?search=GM");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                $or: expect.arrayContaining([
                    expect.objectContaining({ tournamentName: { $regex: "GM", $options: "i" } }),
                    expect.objectContaining({ hostUniversity: { $regex: "GM", $options: "i" } })
                ])
            }));
        });

        it("supports badminton synonym expansion in short prefix matching (< 3 characters) for VT", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            await request(app).get("/api/tournaments?search=VT");

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                $or: expect.arrayContaining([
                    expect.objectContaining({ tournamentName: { $regex: "VT", $options: "i" } }),
                    expect.objectContaining({ hostUniversity: { $regex: "Virginia Tech", $options: "i" } })
                ])
            }));
        });

        it("safely escapes regex control characters in search query and location", async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue([])
            };
            const findSpy = jest.spyOn(Tournament, "find").mockReturnValue(mockQuery);

            const res = await request(app).get("/api/tournaments?search=(*&location=Fairfax (RAC)");

            expect(res.status).toBe(200);
            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                eventLocation: { $regex: "Fairfax \\(RAC\\)", $options: "i" },
                $or: expect.arrayContaining([
                    expect.objectContaining({ tournamentName: { $regex: "\\(\\\*", $options: "i" } }),
                ])
            }));
        });

        it("serves cached tournaments from Redis when available", async () => {
            const redis = require("../utils/redis");
            const cachedList = [{ _id: "cached_1", tournamentName: "Cached Tourney" }];
            redis.get.mockResolvedValueOnce(JSON.stringify(cachedList));

            const res = await request(app).get("/api/tournaments");
            expect(res.status).toBe(200);
            expect(res.body.tournaments).toEqual(cachedList);
            expect(res.body.cached).toBe(true);
        });
    });

    describe("POST /api/tournaments/:id/rsvp", () => {
        it("returns 401 when unauthenticated", async () => {
            const res = await request(app).post("/api/tournaments/650000000000000000000101/rsvp");
            expect(res.status).toBe(401);
        });

        it("returns 400 for invalid tournament ID", async () => {
            const res = await request(app)
                .post("/api/tournaments/invalid-id/rsvp")
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/invalid tournament id/i);
        });

        it("returns 404 when tournament does not exist", async () => {
            jest.spyOn(Tournament, "findById").mockResolvedValue(null);

            const res = await request(app)
                .post("/api/tournaments/650000000000000000000999/rsvp")
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found/i);
        });

        it("toggles RSVP ON when user is not currently an attendee", async () => {
            const mockTournamentDoc = {
                _id: new mongoose.Types.ObjectId("650000000000000000000101"),
                tournamentName: "GMU Spring Open",
                attendees: [],
                rsvpCount: 0,
                save: jest.fn().mockResolvedValue(true),
                populate: jest.fn().mockResolvedValue(true)
            };
            jest.spyOn(Tournament, "findById").mockResolvedValue(mockTournamentDoc);

            const res = await request(app)
                .post("/api/tournaments/650000000000000000000101/rsvp")
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Successfully RSVP'd");
            expect(res.body.isRsvped).toBe(true);
            expect(res.body.rsvpCount).toBe(1);
            expect(mockTournamentDoc.save).toHaveBeenCalled();
        });

        it("toggles RSVP OFF when user is already in attendees", async () => {
            const mockTournamentDoc = {
                _id: new mongoose.Types.ObjectId("650000000000000000000101"),
                tournamentName: "GMU Spring Open",
                attendees: [new mongoose.Types.ObjectId(userId)],
                rsvpCount: 1,
                save: jest.fn().mockResolvedValue(true),
                populate: jest.fn().mockResolvedValue(true)
            };
            jest.spyOn(Tournament, "findById").mockResolvedValue(mockTournamentDoc);

            const res = await request(app)
                .post("/api/tournaments/650000000000000000000101/rsvp")
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("RSVP removed");
            expect(res.body.isRsvped).toBe(false);
            expect(res.body.rsvpCount).toBe(0);
            expect(mockTournamentDoc.save).toHaveBeenCalled();
        });
    });

    describe("DELETE /api/tournaments/:id", () => {
        it("returns 401 when unauthenticated", async () => {
            const res = await request(app)
                .delete("/api/tournaments/650000000000000000000101");

            expect(res.status).toBe(401);
        });

        it("returns 403 when authenticated as regular user (non-admin)", async () => {
            const res = await request(app)
                .delete("/api/tournaments/650000000000000000000101")
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admin/i);
        });

        it("returns 400 for invalid tournament ID", async () => {
            const res = await request(app)
                .delete("/api/tournaments/invalid-id-format")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/invalid tournament id/i);
        });

        it("returns 404 when tournament does not exist", async () => {
            jest.spyOn(Tournament, "findByIdAndDelete").mockResolvedValue(null);

            const res = await request(app)
                .delete("/api/tournaments/650000000000000000000999")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/not found/i);
        });

        it("deletes tournament successfully when requested by admin", async () => {
            const tourneyId = "650000000000000000000101";
            jest.spyOn(Tournament, "findByIdAndDelete").mockResolvedValue({
                _id: new mongoose.Types.ObjectId(tourneyId),
                tournamentName: "GMU Spring Open"
            });

            const res = await request(app)
                .delete(`/api/tournaments/${tourneyId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted successfully/i);
            expect(res.body._id).toBe(tourneyId);
        });
    });

    describe("GET /api/tournaments/:tournamentId/matches", () => {
        it("returns 400 for invalid tournamentId format", async () => {
            const res = await request(app).get("/api/tournaments/not-an-objectid/matches");
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("Invalid tournament ID format");
        });

        it("returns bracket matches sorted by matchNumber and round", async () => {
            const tourneyId = "650000000000000000000101";
            const mockMatches = [
                { _id: "m-1", tournamentId: tourneyId, round: "R16", matchNumber: 1 },
                { _id: "m-2", tournamentId: tourneyId, round: "QF", matchNumber: 2 }
            ];

            const sortSpy = jest.fn().mockResolvedValue(mockMatches);
            jest.spyOn(TournamentMatch, "find").mockReturnValue({ sort: sortSpy });

            const res = await request(app).get(`/api/tournaments/${tourneyId}/matches?division=Singles&round=R16`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.matches).toEqual(mockMatches);
            expect(TournamentMatch.find).toHaveBeenCalledWith({
                tournamentId: tourneyId,
                division: "Singles",
                round: "R16"
            });
            expect(sortSpy).toHaveBeenCalledWith({ matchNumber: 1, round: 1 });
        });
    });

    describe("User.rsvpedTournaments Synchronization Pipeline", () => {
        it("synchronizes User.rsvpedTournaments with $addToSet when joining RSVP", async () => {
            const tourneyId = "650000000000000000000101";
            const mockTourney = {
                _id: tourneyId,
                status: "active",
                maxCapacity: 64,
                rsvpCount: 0,
                attendees: [],
                save: jest.fn().mockResolvedValue(true),
                populate: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Tournament, "findById").mockResolvedValue(mockTourney);
            jest.spyOn(Tournament, "findOneAndUpdate").mockResolvedValue(mockTourney);
            const userUpdateSpy = jest.spyOn(User, "updateOne").mockResolvedValue({ acknowledged: true });

            const res = await request(app)
                .post(`/api/tournaments/${tourneyId}/rsvp`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(userUpdateSpy).toHaveBeenCalledWith(
                { _id: userId },
                { $addToSet: { rsvpedTournaments: tourneyId } }
            );
        });

        it("synchronizes User.rsvpedTournaments with $pull when cancelling RSVP", async () => {
            const tourneyId = "650000000000000000000101";
            jest.spyOn(Tournament, "findOneAndUpdate").mockResolvedValue({
                _id: tourneyId,
                rsvpCount: 0
            });
            const userUpdateSpy = jest.spyOn(User, "updateOne").mockResolvedValue({ acknowledged: true });

            const res = await request(app)
                .post(`/api/tournaments/${tourneyId}/cancel-rsvp`)
                .set("Authorization", `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(userUpdateSpy).toHaveBeenCalledWith(
                { _id: userId },
                { $pull: { rsvpedTournaments: tourneyId } }
            );
        });
    });

    describe("POST /api/tournaments/reset-seed Security & Gate Tests", () => {
        it("strictly returns 401 when unauthenticated", async () => {
            const res = await request(app).post("/api/tournaments/reset-seed");
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/no token|authorization denied/i);
        });

        it("strictly returns 403 when authenticated as regular user (non-admin)", async () => {
            const res = await request(app)
                .post("/api/tournaments/reset-seed")
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.status).toBe(403);
            expect(res.body.message).toMatch(/admins only/i);
        });
    });
});

