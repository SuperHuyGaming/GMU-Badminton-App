const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../utils/redis", () => ({
	keys: jest.fn().mockResolvedValue([]),
	del: jest.fn().mockResolvedValue(1),
	get: jest.fn().mockResolvedValue(null),
	setex: jest.fn().mockResolvedValue("OK"),
	invalidateCacheTag: jest.fn().mockResolvedValue(),
	tagCacheKey: jest.fn().mockResolvedValue(),
}));

const tournamentRoutes = require("../routes/tournaments");
const Tournament = require("../models/Tournament");
const Notification = require("../models/Notification");

jest.mock("../models/Notification", () => ({
	create: jest.fn().mockResolvedValue({}),
}));

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

const createToken = (id, name = "Player") =>
	jwt.sign({ id, userId: id, role: "user", name }, JWT_SECRET);

const app = express();
app.use(express.json());

const mockIo = {
	emit: jest.fn(),
	to: jest.fn().mockReturnThis(),
};
app.set("io", mockIo);
app.use((req, res, next) => {
	req.io = mockIo;
	next();
});

app.use("/api/tournaments", tournamentRoutes);

describe("Problem 17: Atomic Tournament RSVP Capping & FIFO Waitlist Queue", () => {
	const tournamentId = "650000000000000000000501";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("1. Standard RSVP Under Capacity: adds user to attendees and increments rsvpCount", async () => {
		const u1 = "650000000000000000000001";
		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 4,
			rsvpCount: 0,
			attendees: [],
			waitlist: [],
			status: "active",
			save: jest.fn().mockResolvedValue(true),
			populate: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		const res = await request(app)
			.post(`/api/tournaments/${tournamentId}/rsvp`)
			.set("Authorization", `Bearer ${createToken(u1)}`);

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("Successfully RSVP'd");
		expect(res.body.isRsvped).toBe(true);
		expect(res.body.rsvpCount).toBe(1);
		expect(mockDoc.attendees).toContain(u1);
	});

	it("2. Capacity Enforcement: atomically diverts user to waitlist when tournament reaches maxCapacity", async () => {
		const u1 = "650000000000000000000001";
		const u2 = "650000000000000000000002";
		const u3 = "650000000000000000000003";

		// Full tournament (capacity = 2)
		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 2,
			rsvpCount: 2,
			attendees: [new mongoose.Types.ObjectId(u1), new mongoose.Types.ObjectId(u2)],
			waitlist: [],
			status: "active",
			save: jest.fn().mockResolvedValue(true),
			populate: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		const res = await request(app)
			.post(`/api/tournaments/${tournamentId}/rsvp`)
			.set("Authorization", `Bearer ${createToken(u3)}`);

		expect(res.status).toBe(200);
		expect(res.body.message).toContain("Tournament is full. You have been added to the waitlist.");
		expect(res.body.isRsvped).toBe(false);
		expect(res.body.isWaitlisted).toBe(true);
		expect(res.body.waitlistPosition).toBe(1);
		expect(mockDoc.waitlist.length).toBe(1);
		expect(mockDoc.waitlist[0].userId).toBe(u3);
		expect(mockDoc.status).toBe("sold_out");
	});

	it("3. FIFO Queue Ordering: preserves chronological registration order in waitlist", async () => {
		const u1 = "650000000000000000000001";
		const u2 = "650000000000000000000002";
		const u3 = "650000000000000000000003";
		const u4 = "650000000000000000000004";

		const tEarly = new Date(Date.now() - 60000);
		const tLate = new Date(Date.now() - 30000);

		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 2,
			rsvpCount: 2,
			attendees: [new mongoose.Types.ObjectId(u1), new mongoose.Types.ObjectId(u2)],
			waitlist: [
				{ userId: new mongoose.Types.ObjectId(u3), registeredAt: tEarly },
				{ userId: new mongoose.Types.ObjectId(u4), registeredAt: tLate },
			],
			status: "sold_out",
			save: jest.fn().mockResolvedValue(true),
			populate: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		// Check waitlist position for u3
		const res3 = await request(app)
			.get(`/api/tournaments/${tournamentId}/waitlist`)
			.set("Authorization", `Bearer ${createToken(u3)}`);

		expect(res3.status).toBe(200);
		expect(res3.body.waitlistCount).toBe(2);
		expect(res3.body.myPosition).toBe(1);

		// Check waitlist position for u4
		const res4 = await request(app)
			.get(`/api/tournaments/${tournamentId}/waitlist`)
			.set("Authorization", `Bearer ${createToken(u4)}`);

		expect(res4.status).toBe(200);
		expect(res4.body.myPosition).toBe(2);
	});

	it("4. Cancellation with FIFO Waitlist Auto-Promotion: promotes earliest waitlisted player", async () => {
		const u1 = "650000000000000000000001";
		const u2 = "650000000000000000000002";
		const uWait1 = "650000000000000000000003";
		const uWait2 = "650000000000000000000004";

		const t1 = new Date(Date.now() - 100000);
		const t2 = new Date(Date.now() - 50000);

		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 2,
			rsvpCount: 2,
			attendees: [new mongoose.Types.ObjectId(u1), new mongoose.Types.ObjectId(u2)],
			waitlist: [
				{ userId: new mongoose.Types.ObjectId(uWait1), registeredAt: t1 },
				{ userId: new mongoose.Types.ObjectId(uWait2), registeredAt: t2 },
			],
			status: "sold_out",
			save: jest.fn().mockResolvedValue(true),
			populate: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		// User 1 cancels RSVP
		const res = await request(app)
			.post(`/api/tournaments/${tournamentId}/cancel-rsvp`)
			.set("Authorization", `Bearer ${createToken(u1)}`);

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("RSVP removed");
		expect(res.body.isRsvped).toBe(false);

		// u1 removed from attendees
		expect(mockDoc.attendees.map((id) => id.toString())).not.toContain(u1);
		// uWait1 dequeued from waitlist and promoted to attendees
		expect(mockDoc.attendees.map((id) => id.toString())).toContain(uWait1);
		expect(mockDoc.waitlist.map((w) => w.userId.toString())).not.toContain(uWait1);
		// uWait2 remains on waitlist
		expect(mockDoc.waitlist.map((w) => w.userId.toString())).toContain(uWait2);

		// Notification created for promoted user
		expect(Notification.create).toHaveBeenCalledWith(
			expect.objectContaining({
				targetUserId: expect.anything(),
				message: expect.stringMatching(/promoted from the waitlist/i),
			})
		);

		// Socket event emitted
		expect(mockIo.emit).toHaveBeenCalledWith("tournament:waitlistPromoted", expect.anything());
	});

	it("5. Waitlist Self-Cancellation: removes player from waitlist without altering attendees", async () => {
		const u1 = "650000000000000000000001";
		const uWait = "650000000000000000000002";

		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 2,
			rsvpCount: 1,
			attendees: [new mongoose.Types.ObjectId(u1)],
			waitlist: [{ userId: new mongoose.Types.ObjectId(uWait), registeredAt: new Date() }],
			status: "active",
			save: jest.fn().mockResolvedValue(true),
			populate: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		// User on waitlist cancels via /cancel-rsvp
		const res = await request(app)
			.post(`/api/tournaments/${tournamentId}/cancel-rsvp`)
			.set("Authorization", `Bearer ${createToken(uWait)}`);

		expect(res.status).toBe(200);
		expect(res.body.message).toBe("Removed from tournament waitlist.");
		expect(res.body.isWaitlisted).toBe(false);
		expect(mockDoc.waitlist.length).toBe(0);
		expect(mockDoc.attendees.map((id) => id.toString())).toContain(u1);
	});

	it("6. Dedicated Waitlist Endpoints: join, fetch position, and leave", async () => {
		const uNew = "650000000000000000000007";
		const mockDoc = {
			_id: new mongoose.Types.ObjectId(tournamentId),
			tournamentName: "GMU Open 2026",
			maxCapacity: 2,
			rsvpCount: 2,
			attendees: [new mongoose.Types.ObjectId("650000000000000000000001"), new mongoose.Types.ObjectId("650000000000000000000002")],
			waitlist: [],
			status: "sold_out",
			save: jest.fn().mockResolvedValue(true),
		};

		jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

		// POST /api/tournaments/:id/waitlist
		const joinRes = await request(app)
			.post(`/api/tournaments/${tournamentId}/waitlist`)
			.set("Authorization", `Bearer ${createToken(uNew)}`);

		expect(joinRes.status).toBe(200);
		expect(joinRes.body.message).toBe("Added to waitlist");
		expect(joinRes.body.waitlistPosition).toBe(1);

		// DELETE /api/tournaments/:id/waitlist
		const leaveRes = await request(app)
			.delete(`/api/tournaments/${tournamentId}/waitlist`)
			.set("Authorization", `Bearer ${createToken(uNew)}`);

		expect(leaveRes.status).toBe(200);
		expect(leaveRes.body.message).toBe("Removed from waitlist");
		expect(leaveRes.body.waitlistCount).toBe(0);
	});
});
