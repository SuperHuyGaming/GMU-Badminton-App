const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const scrapeRoutes = require("../routes/scrape");
const ProposedTournament = require("../models/ProposedTournament");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const userToken = jwt.sign(
    { id: "650000000000000000000001", role: "user", name: "Player User" },
    JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/scrape", scrapeRoutes);

describe("POST /api/scrape/submit-pending (Community Tournament Submission)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 401 when request is unauthenticated", async () => {
        const res = await request(app)
            .post("/api/scrape/submit-pending")
            .send({ tournamentName: "Unauthenticated Cup" });

        expect(res.status).toBe(401);
    });

    it("returns 400 when tournamentName is missing or whitespace only", async () => {
        const res = await request(app)
            .post("/api/scrape/submit-pending")
            .set("Authorization", `Bearer ${userToken}`)
            .send({ tournamentName: "   " });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/tournament name is required/i);
    });

    it("returns 400 when tournamentName exceeds 200 characters", async () => {
        const res = await request(app)
            .post("/api/scrape/submit-pending")
            .set("Authorization", `Bearer ${userToken}`)
            .send({ tournamentName: "A".repeat(201) });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/cannot exceed 200 characters/i);
    });

    it("saves submission as ProposedTournament with pending status and COMMUNITY_SUBMISSION sourceType", async () => {
        const saveSpy = jest.spyOn(ProposedTournament.prototype, "save").mockResolvedValue({
            _id: "650000000000000000000999"
        });

        const submissionData = {
            tournamentName: "<script>alert('xss')</script>2027 DMV Open",
            startDate: "2027-08-15T09:00:00.000Z",
            registrationDeadline: "2027-08-01T23:59:59.000Z",
            eventLocation: "Fairfax Badminton Club",
            hostUniversity: "GMU Badminton Club",
            registrationUrl: "https://example.com/register",
            flyerImageUrl: "https://example.com/flyer.jpg",
            originalCaption: "Excited to host the 2027 DMV Open!",
            skillLevels: ["Intermediate", "Advanced"]
        };

        const res = await request(app)
            .post("/api/scrape/submit-pending")
            .set("Authorization", `Bearer ${userToken}`)
            .send(submissionData);

        expect(res.status).toBe(201);
        expect(res.body.message).toMatch(/tournament submitted for admin approval/i);
        expect(res.body.proposal).toBeDefined();
        expect(res.body.proposal.sourceType).toBe("COMMUNITY_SUBMISSION");
        expect(res.body.proposal.status).toBe("pending");
        expect(res.body.proposal.tournamentName).not.toContain("<script>");
        expect(res.body.proposal.location).toBe("Fairfax Badminton Club");
        expect(res.body.proposal.registrationLink).toBe("https://example.com/register");
        expect(saveSpy).toHaveBeenCalled();
    });
});
