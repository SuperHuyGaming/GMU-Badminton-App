// server/tests/feedback.test.js
require("dotenv").config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const feedbackRoutes = require("../routes/feedback");
const Feedback = require("../models/Feedback");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const regularUserId = "650000000000000000000001";
const regularUserToken = jwt.sign(
	{ id: regularUserId, userId: regularUserId, role: "user", username: "RegularPlayer", email: "player@gmu.edu" },
	JWT_SECRET
);
const adminId = "650000000000000000000002";
const adminToken = jwt.sign(
	{ id: adminId, userId: adminId, role: "admin", username: "AppAdmin", email: "admin@gmu.edu" },
	JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/feedback", feedbackRoutes);

describe("Feedback & Error Reporting API", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /api/feedback/upload (Picture & Screenshot Uploads)", () => {
		it("uploads an image file and returns an imageUrl", async () => {
			const dummyPngBuffer = Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			);

			const res = await request(app)
				.post("/api/feedback/upload")
				.attach("image", dummyPngBuffer, "screenshot.png");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.imageUrl).toBeDefined();
			expect(typeof res.body.imageUrl).toBe("string");
		});

		it("returns 400 if no image file is provided in request", async () => {
			const res = await request(app).post("/api/feedback/upload");
			expect(res.status).toBe(400);
			expect(res.body.message).toContain("No image file provided");
		});

		it("returns 400 if non-image file format is uploaded", async () => {
			const textBuffer = Buffer.from("hello text file", "utf8");
			const res = await request(app)
				.post("/api/feedback/upload")
				.attach("image", textBuffer, "badfile.txt");

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Invalid file format");
		});
	});

	describe("POST /api/feedback (Public & Authenticated Submissions)", () => {
		it("allows a guest user to submit a bug report with attached screenshots", async () => {
			let saved = null;
			jest.spyOn(Feedback.prototype, "save").mockImplementation(function () {
				saved = this.toObject();
				return Promise.resolve(saved);
			});

			const res = await request(app)
				.post("/api/feedback")
				.send({
					type: "bug",
					title: "Courts tab fails to load on mobile",
					description: "When opening the courts tab on iOS Safari, the spinner keeps turning.",
					severity: "high",
					pageUrl: "/courts",
					userName: "Guest Tester",
					userEmail: "guest@example.com",
					images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
				});

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.message).toContain("Thank you for your feedback");
			expect(saved).toBeDefined();
			expect(saved.title).toBe("Courts tab fails to load on mobile");
			expect(saved.images).toHaveLength(1);
			expect(saved.images[0]).toContain("sample.jpg");
		});

		it("associates submission with authenticated user and handles multiple images", async () => {
			let createdPayload = null;
			jest.spyOn(Feedback.prototype, "save").mockImplementation(function () {
				createdPayload = this.toObject();
				return Promise.resolve(createdPayload);
			});

			const res = await request(app)
				.post("/api/feedback")
				.set("Authorization", `Bearer ${regularUserToken}`)
				.send({
					type: "feature",
					title: "Add doubles tournament bracket format",
					description: "Would love to see round robin pools before single elimination brackets.",
					pageUrl: "/tournaments",
					images: [
						"https://example.com/mock-bracket-1.png",
						"https://example.com/mock-bracket-2.png",
						"https://example.com/mock-bracket-3.png",
						"https://example.com/mock-bracket-4.png",
						"https://example.com/mock-bracket-5.png", // exceeds max 4
					],
				});

			expect(res.status).toBe(201);
			expect(createdPayload).toBeDefined();
			expect(createdPayload.user.toString()).toBe(regularUserId);
			expect(createdPayload.type).toBe("feature");
			expect(createdPayload.status).toBe("pending");
			expect(createdPayload.images).toHaveLength(4); // capped at 4
		});

		it("rejects submission if title is missing or too short", async () => {
			const res = await request(app)
				.post("/api/feedback")
				.send({
					type: "bug",
					title: "ab",
					description: "Something is broken here and there.",
				});

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Title must be at least 3 characters");
		});

		it("rejects submission if description is missing or too short", async () => {
			const res = await request(app)
				.post("/api/feedback")
				.send({
					type: "bug",
					title: "Buttons are unclickable",
					description: "bad",
				});

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Description must be at least 5 characters");
		});

		it("rejects submission if userEmail format is invalid", async () => {
			const res = await request(app)
				.post("/api/feedback")
				.send({
					type: "feedback",
					title: "Great platform update",
					description: "The new UI is much smoother and responsive.",
					userEmail: "not-an-email",
				});

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("valid email address");
		});

		it("sanitizes script tags in title, description, and pageUrl", async () => {
			let saved = null;
			jest.spyOn(Feedback.prototype, "save").mockImplementation(function () {
				saved = this.toObject();
				return Promise.resolve(saved);
			});

			const res = await request(app)
				.post("/api/feedback")
				.send({
					type: "bug",
					title: "Malicious <script>alert('xss')</script> Bug",
					description: "Testing sanitization <img src=x onerror=alert(1)> description details",
					pageUrl: "/tournaments?test=<script>bad()</script>",
				});

			expect(res.status).toBe(201);
			expect(saved.title).not.toContain("<script>");
			expect(saved.description).not.toContain("<img src=x");
			expect(saved.pageUrl).not.toContain("<script>");
		});
	});

	describe("Admin Feedback Management Routes", () => {
		describe("Security & Role Checks", () => {
			it("returns 401 when unauthenticated user calls admin endpoint", async () => {
				const res = await request(app).get("/api/feedback/admin");
				expect(res.status).toBe(401);
			});

			it("returns 403 when non-admin user calls admin endpoint", async () => {
				const res = await request(app)
					.get("/api/feedback/admin")
					.set("Authorization", `Bearer ${regularUserToken}`);
				expect(res.status).toBe(403);
			});
		});

		describe("GET /api/feedback/admin", () => {
			it("fetches feedback list and counts for authorized admin", async () => {
				const mockFeedbackList = [
					{
						_id: "650000000000000000000101",
						type: "bug",
						title: "Bracket score update delay",
						status: "pending",
						severity: "high",
						images: ["https://example.com/screenshot1.png"],
						createdAt: new Date(),
					},
					{
						_id: "650000000000000000000102",
						type: "feature",
						title: "Dark mode contrast in scoreboard",
						status: "resolved",
						severity: "medium",
						images: [],
						createdAt: new Date(),
					},
				];

				const mockQuery = {
					populate: jest.fn().mockReturnThis(),
					sort: jest.fn().mockResolvedValue(mockFeedbackList),
				};
				jest.spyOn(Feedback, "find").mockReturnValue(mockQuery);
				jest.spyOn(Feedback, "countDocuments")
					.mockResolvedValueOnce(2) // total
					.mockResolvedValueOnce(1) // pending
					.mockResolvedValueOnce(0) // in_progress
					.mockResolvedValueOnce(1) // resolved
					.mockResolvedValueOnce(0); // dismissed

				const res = await request(app)
					.get("/api/feedback/admin")
					.set("Authorization", `Bearer ${adminToken}`);

				expect(res.status).toBe(200);
				expect(res.body.feedback).toHaveLength(2);
				expect(res.body.counts.total).toBe(2);
				expect(res.body.counts.pending).toBe(1);
				expect(res.body.counts.resolved).toBe(1);
			});

			it("applies status and type filters to query", async () => {
				const mockQuery = {
					populate: jest.fn().mockReturnThis(),
					sort: jest.fn().mockResolvedValue([]),
				};
				const findSpy = jest.spyOn(Feedback, "find").mockReturnValue(mockQuery);
				jest.spyOn(Feedback, "countDocuments").mockResolvedValue(0);

				await request(app)
					.get("/api/feedback/admin?status=pending&type=bug")
					.set("Authorization", `Bearer ${adminToken}`);

				expect(findSpy).toHaveBeenCalledWith(
					expect.objectContaining({ status: "pending", type: "bug" })
				);
			});
		});

		describe("PATCH /api/feedback/admin/:id", () => {
			it("updates feedback status, admin notes, and images", async () => {
				const mockDoc = {
					_id: "650000000000000000000105",
					status: "pending",
					adminNotes: "",
					images: [],
					save: jest.fn().mockResolvedValue(true),
				};
				jest.spyOn(Feedback, "findById").mockResolvedValue(mockDoc);

				const res = await request(app)
					.patch("/api/feedback/admin/650000000000000000000105")
					.set("Authorization", `Bearer ${adminToken}`)
					.send({
						status: "in_progress",
						adminNotes: "Investigating WebSocket reconnect event on courts tab.",
						images: ["https://example.com/resolved-fix.png"],
					});

				expect(res.status).toBe(200);
				expect(res.body.success).toBe(true);
				expect(mockDoc.status).toBe("in_progress");
				expect(mockDoc.adminNotes).toContain("Investigating WebSocket");
				expect(mockDoc.images).toHaveLength(1);
				expect(mockDoc.save).toHaveBeenCalled();
			});

			it("rejects invalid status", async () => {
				const mockDoc = {
					_id: "650000000000000000000105",
					status: "pending",
					save: jest.fn(),
				};
				jest.spyOn(Feedback, "findById").mockResolvedValue(mockDoc);

				const res = await request(app)
					.patch("/api/feedback/admin/650000000000000000000105")
					.set("Authorization", `Bearer ${adminToken}`)
					.send({ status: "invalid_status" });

				expect(res.status).toBe(400);
				expect(res.body.message).toContain("Invalid status value");
			});

			it("returns 404 if feedback report does not exist", async () => {
				jest.spyOn(Feedback, "findById").mockResolvedValue(null);

				const res = await request(app)
					.patch("/api/feedback/admin/650000000000000000000999")
					.set("Authorization", `Bearer ${adminToken}`)
					.send({ status: "resolved" });

				expect(res.status).toBe(404);
			});

			it("returns 400 for invalid ObjectId format", async () => {
				const res = await request(app)
					.patch("/api/feedback/admin/not-a-valid-id")
					.set("Authorization", `Bearer ${adminToken}`)
					.send({ status: "resolved" });

				expect(res.status).toBe(400);
				expect(res.body.message).toContain("Invalid feedback ID format");
			});
		});

		describe("DELETE /api/feedback/admin/:id", () => {
			it("permanently deletes feedback report", async () => {
				jest.spyOn(Feedback, "findByIdAndDelete").mockResolvedValue({
					_id: "650000000000000000000105",
				});

				const res = await request(app)
					.delete("/api/feedback/admin/650000000000000000000105")
					.set("Authorization", `Bearer ${adminToken}`);

				expect(res.status).toBe(200);
				expect(res.body.success).toBe(true);
				expect(res.body.message).toContain("permanently deleted");
			});

			it("returns 404 when deleting nonexistent feedback report", async () => {
				jest.spyOn(Feedback, "findByIdAndDelete").mockResolvedValue(null);

				const res = await request(app)
					.delete("/api/feedback/admin/650000000000000000000999")
					.set("Authorization", `Bearer ${adminToken}`);

				expect(res.status).toBe(404);
			});

			it("returns 400 for invalid ObjectId format", async () => {
				const res = await request(app)
					.delete("/api/feedback/admin/bad-id")
					.set("Authorization", `Bearer ${adminToken}`);

				expect(res.status).toBe(400);
			});
		});
	});
});
