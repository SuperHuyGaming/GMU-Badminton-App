const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const calendarRoutes = require("../routes/calendar");
const User = require("../models/User");
const Tournament = require("../models/Tournament");

const app = express();
app.use(express.json());
app.use("/api/calendar", calendarRoutes);

describe("Calendar Feed ICS API (GET /api/calendar/feed/:userId.ics)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 400 Bad Request for invalid userId format", async () => {
        const res = await request(app).get("/api/calendar/feed/not-a-valid-object-id.ics");
        expect(res.status).toBe(400);
        expect(res.text).toContain("Invalid user ID format");
    });

    it("returns 404 when user does not exist", async () => {
        const validId = "650000000000000000000001";
        jest.spyOn(User, "findById").mockResolvedValue(null);

        const res = await request(app).get(`/api/calendar/feed/${validId}.ics`);
        expect(res.status).toBe(404);
        expect(res.text).toContain("User not found");
    });

    it("returns empty VCALENDAR when user has no RSVPs and is in no attendees list", async () => {
        const validId = "650000000000000000000002";
        jest.spyOn(User, "findById").mockResolvedValue({
            _id: validId,
            rsvpedTournaments: []
        });
        jest.spyOn(Tournament, "find").mockResolvedValue([]);

        const res = await request(app).get(`/api/calendar/feed/${validId}.ics`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/calendar");
        expect(res.text).toContain("BEGIN:VCALENDAR");
        expect(res.text).toContain("END:VCALENDAR");
    });

    it("generates ICS feed querying both user.rsvpedTournaments and attendees: userId with t.startDate", async () => {
        const userId = "650000000000000000000003";
        const tourneyId1 = "650000000000000000000101";
        const tourneyId2 = "650000000000000000000102";

        jest.spyOn(User, "findById").mockResolvedValue({
            _id: userId,
            rsvpedTournaments: [tourneyId1]
        });

        const mockStartDate = new Date("2027-05-20T10:00:00.000Z");
        const mockEndDate = new Date("2027-05-20T18:00:00.000Z");

        const findSpy = jest.spyOn(Tournament, "find").mockResolvedValue([
            {
                _id: tourneyId1,
                tournamentName: "2027 GMU Spring Invitational",
                hostUniversity: "George Mason University",
                eventLocation: "RAC Gym Court 1-6",
                startDate: mockStartDate,
                endDate: mockEndDate,
                registrationUrl: "https://gmu.edu/badminton-register",
                attendees: [userId]
            },
            {
                _id: tourneyId2,
                tournamentName: "2027 Mid-Atlantic Open",
                hostUniversity: "University of Maryland",
                eventLocation: "College Park",
                startDate: mockStartDate,
                endDate: mockEndDate,
                registrationUrl: "https://umd.edu/badminton",
                attendees: [userId]
            }
        ]);

        const res = await request(app).get(`/api/calendar/feed/${userId}.ics`);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/calendar");
        expect(res.text).toContain("BEGIN:VCALENDAR");
        expect(res.text).toContain("2027 GMU Spring Invitational");
        expect(res.text).toContain("2027 Mid-Atlantic Open");

        // Verify query supports both rsvpedTournaments and attendees
        expect(findSpy).toHaveBeenCalledWith({
            $or: [
                { _id: { $in: [tourneyId1] } },
                { attendees: userId }
            ]
        });
    });
});
