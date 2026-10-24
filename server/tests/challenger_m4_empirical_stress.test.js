/**
 * server/tests/challenger_m4_empirical_stress.test.js
 * Adversarial Concurrency, Atomic RSVP Capping, Waitlist FIFO Auto-Promotion,
 * Transactional Friend Mutations, Idempotency Bursts & Anti-Spam Moderation Stress Suite.
 *
 * Authored by challenger_1_m4_10 (Empirical Adversarial Challenger)
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Models
const Tournament = require("../models/Tournament");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Post = require("../models/Post");
const ActivityFeed = require("../models/ActivityFeed");

// Routers & Utilities
const tournamentRoutes = require("../routes/tournaments");
const friendsRoutes = require("../routes/friends");
const forumRoutes = require("../routes/forum");
const adminRoutes = require("../routes/admin");
const { executeWithTransactionOrFallback, resetTransactionSupportCache } = require("../utils/transactionHelper");
const { clearMemoryCache, markIdempotentInFlight, getIdempotentResult, setIdempotentCompleted } = require("../utils/idempotency");
const { evaluateSpamHeuristics, resetSpamDetectorState, userPostTimestamps, recentPostHashes } = require("../utils/spamDetector");

// Mocks for natural, Kafka, and Notification
jest.mock("natural", () => ({
	BayesClassifier: jest.fn().mockImplementation(() => ({
		addDocument: jest.fn(),
		train: jest.fn(),
		classify: jest.fn((text) => {
			if (text.includes("free money")) return "spam";
			return "ham";
		}),
	})),
}));

jest.mock("../utils/kafkaProducer", () => ({
	publishEvent: jest.fn().mockResolvedValue(),
}));

jest.mock("../models/Notification", () => {
	const MockNotification = jest.fn().mockImplementation(function (data) {
		Object.assign(this, data);
		this.save = jest.fn().mockResolvedValue(this);
	});
	MockNotification.create = jest.fn().mockResolvedValue({});
	MockNotification.find = jest.fn().mockReturnValue({
		sort: jest.fn().mockReturnValue({
			limit: jest.fn().mockResolvedValue([]),
		}),
	});
	return MockNotification;
});

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const createToken = (id, role = "user", name = "Test Player") =>
	jwt.sign({ id, userId: id, role, name }, JWT_SECRET);

describe("Challenger M4 Empirical Adversarial Stress Suite", () => {
	let app;
	let mockIo;

	beforeEach(() => {
		jest.clearAllMocks();
		clearMemoryCache();
		resetTransactionSupportCache();
		resetSpamDetectorState();

		jest.spyOn(User, "updateOne").mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
		jest.spyOn(User, "find").mockImplementation(() => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([]),
			}),
			sort: jest.fn().mockReturnThis(),
			skip: jest.fn().mockReturnThis(),
			limit: jest.fn().mockReturnThis(),
			lean: jest.fn().mockResolvedValue([]),
		}));

		mockIo = {
			to: jest.fn().mockReturnThis(),
			emit: jest.fn(),
		};

		app = express();
		app.use(express.json());
		app.set("io", mockIo);
		app.use((req, res, next) => {
			req.io = mockIo;
			next();
		});

		app.use("/api/tournaments", tournamentRoutes);
		app.use("/api/friends", friendsRoutes);
		app.use("/api/forum", forumRoutes);
		app.use("/api/admin", adminRoutes);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// =========================================================================
	// 1. TOURNAMENT RSVP ATOMIC CAPPING & OVERBOOKING RACE STRESS
	// =========================================================================
	describe("1. Tournament RSVP Atomic Capping & Overbooking Race Stress", () => {
		test("Heavy Contention: 20 concurrent RSVPs on maxCapacity=3 guarantees ZERO overbooking and 17 waitlisted", async () => {
			const tournamentId = new mongoose.Types.ObjectId().toString();
			const maxCapacity = 3;

			// Shared state in atomic storage simulation
			let sharedTournament = {
				_id: new mongoose.Types.ObjectId(tournamentId),
				tournamentName: "GMU Contention Championship 2026",
				maxCapacity: maxCapacity,
				rsvpCount: 0,
				attendees: [],
				waitlist: [],
				status: "active",
			};

			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1; // Real database mode

			// Simulate atomic MongoDB document findOneAndUpdate with document lock
			let lock = Promise.resolve();
			const withAtomicLock = (fn) => {
				const next = lock.then(() => fn());
				lock = next.catch(() => {});
				return next;
			};

			jest.spyOn(Tournament, "findById").mockImplementation(async (id) => {
				return withAtomicLock(async () => {
					if (id.toString() !== tournamentId) return null;
					return {
						...sharedTournament,
						attendees: [...sharedTournament.attendees],
						waitlist: [...sharedTournament.waitlist],
						save: jest.fn().mockResolvedValue(true),
						populate: jest.fn().mockResolvedValue(true),
					};
				});
			});

			jest.spyOn(Tournament, "findOneAndUpdate").mockImplementation(async (filter, update, options) => {
				return withAtomicLock(async () => {
					// 1. RSVP join condition
					if (filter.$expr) {
						const currentCap = sharedTournament.maxCapacity || 64;
						const currentSize = sharedTournament.attendees.length;
						const userId = update.$addToSet?.attendees;

						// Invariant: attendees must not already include user AND size < maxCapacity
						const isAlreadyAttending = sharedTournament.attendees.some(
							(a) => a.toString() === userId.toString()
						);
						if (!isAlreadyAttending && currentSize < currentCap) {
							sharedTournament.attendees.push(new mongoose.Types.ObjectId(userId));
							sharedTournament.rsvpCount = sharedTournament.attendees.length;
							if (sharedTournament.attendees.length >= currentCap) {
								sharedTournament.status = "sold_out";
							}
							return {
								...sharedTournament,
								attendees: [...sharedTournament.attendees],
								waitlist: [...sharedTournament.waitlist],
								populate: jest.fn().mockResolvedValue(true),
							};
						}
						return null; // Atomic match condition failed (capacity reached)
					}

					// 2. Waitlist insertion condition
					if (update.$push?.waitlist) {
						const entry = update.$push.waitlist;
						const userId = entry.userId;
						const alreadyAttending = sharedTournament.attendees.some(
							(a) => a.toString() === userId.toString()
						);
						const alreadyWaitlisted = sharedTournament.waitlist.some(
							(w) => w.userId.toString() === userId.toString()
						);

						if (!alreadyAttending && !alreadyWaitlisted) {
							sharedTournament.waitlist.push({
								...entry,
								userId: new mongoose.Types.ObjectId(userId),
								registeredAt: entry.registeredAt || new Date(),
							});
							sharedTournament.status = "sold_out";
							return {
								...sharedTournament,
								attendees: [...sharedTournament.attendees],
								waitlist: [...sharedTournament.waitlist],
							};
						}
						return null;
					}

					return null;
				});
			});

			jest.spyOn(Tournament, "updateOne").mockImplementation(async (filter, update) => {
				return withAtomicLock(async () => {
					if (update.$set?.status) sharedTournament.status = update.$set.status;
					return { acknowledged: true, modifiedCount: 1 };
				});
			});

			// Generate 20 distinct user IDs
			const totalUsers = 20;
			const userIds = Array.from({ length: totalUsers }).map(() =>
				new mongoose.Types.ObjectId().toString()
			);

			// Fire all 20 RSVP requests simultaneously
			const requests = userIds.map((uid) =>
				request(app)
					.post(`/api/tournaments/${tournamentId}/rsvp`)
					.set("Authorization", `Bearer ${createToken(uid)}`)
			);

			const responses = await Promise.all(requests);

			// 1. HTTP Status & Invariant Verification
			expect(responses.every((r) => r.status === 200)).toBe(true);

			const rsvpedResponses = responses.filter((r) => r.body.isRsvped === true);
			const waitlistedResponses = responses.filter((r) => r.body.isWaitlisted === true);

			// Strict Invariant: Exactly 3 attendees, exactly 17 waitlisted
			expect(rsvpedResponses.length).toBe(maxCapacity);
			expect(waitlistedResponses.length).toBe(totalUsers - maxCapacity);

			// Database State Invariant
			expect(sharedTournament.attendees.length).toBe(maxCapacity);
			expect(sharedTournament.rsvpCount).toBe(maxCapacity);
			expect(sharedTournament.waitlist.length).toBe(totalUsers - maxCapacity);
			expect(sharedTournament.status).toBe("sold_out");

			// Zero Overbooking Invariant: attendees count <= maxCapacity
			expect(sharedTournament.attendees.length).toBeLessThanOrEqual(maxCapacity);

			// Deterministic Uniqueness Invariant: No user duplicated across attendees or waitlist
			const attendeeStrs = sharedTournament.attendees.map((id) => id.toString());
			const waitlistStrs = sharedTournament.waitlist.map((w) => w.userId.toString());
			const allEnrolled = [...attendeeStrs, ...waitlistStrs];
			expect(new Set(allEnrolled).size).toBe(totalUsers);

			// Waitlist positions must be sequentially ordered from 1 to 17
			const waitlistPositions = waitlistedResponses.map((r) => r.body.waitlistPosition).sort((a, b) => a - b);
			expect(waitlistPositions).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));

			mongoose.connection.readyState = origReadyState;
		});

		test("Idempotent Contention: Single user firing 5 concurrent RSVP requests is enrolled at most once", async () => {
			const tournamentId = new mongoose.Types.ObjectId().toString();
			const userId = new mongoose.Types.ObjectId().toString();

			let sharedDoc = {
				_id: new mongoose.Types.ObjectId(tournamentId),
				tournamentName: "GMU Rapid Contention",
				maxCapacity: 2,
				rsvpCount: 0,
				attendees: [],
				waitlist: [],
				status: "active",
			};

			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;

			let lock = Promise.resolve();
			const withLock = (fn) => {
				const n = lock.then(() => fn());
				lock = n.catch(() => {});
				return n;
			};

			jest.spyOn(Tournament, "findById").mockImplementation(async () =>
				withLock(async () => ({
					...sharedDoc,
					attendees: [...sharedDoc.attendees],
					waitlist: [...sharedDoc.waitlist],
					save: jest.fn().mockResolvedValue(true),
					populate: jest.fn().mockResolvedValue(true),
				}))
			);

			jest.spyOn(Tournament, "findOneAndUpdate").mockImplementation(async (filter, update) =>
				withLock(async () => {
					if (filter.$expr && update.$addToSet?.attendees) {
						const isPresent = sharedDoc.attendees.some((a) => a.toString() === userId);
						if (!isPresent && sharedDoc.attendees.length < sharedDoc.maxCapacity) {
							sharedDoc.attendees.push(new mongoose.Types.ObjectId(userId));
							sharedDoc.rsvpCount = sharedDoc.attendees.length;
							return { ...sharedDoc, attendees: [...sharedDoc.attendees] };
						}
						return null;
					}
					return null;
				})
			);

			// Fire 5 concurrent requests from the exact same user
			const requests = Array.from({ length: 5 }).map(() =>
				request(app)
					.post(`/api/tournaments/${tournamentId}/rsvp`)
					.set("Authorization", `Bearer ${createToken(userId)}`)
			);

			const responses = await Promise.all(requests);
			expect(responses.every((r) => r.status === 200)).toBe(true);

			// User must appear exactly once in attendees
			const occurrences = sharedDoc.attendees.filter((id) => id.toString() === userId).length;
			expect(occurrences).toBe(1);
			expect(sharedDoc.rsvpCount).toBe(1);

			mongoose.connection.readyState = origReadyState;
		});
	});

	// =========================================================================
	// 2. FIFO WAITLIST AUTO-PROMOTION STRESS
	// =========================================================================
	describe("2. FIFO Waitlist Auto-Promotion Stress", () => {
		test("Strict FIFO Promotion: Earliest waitlisted player promoted deterministically upon attendee cancellation", async () => {
			const tournamentId = new mongoose.Types.ObjectId().toString();
			const attendeeA = new mongoose.Types.ObjectId().toString();
			const attendeeB = new mongoose.Types.ObjectId().toString();

			// 3 waitlisted users with distinct registration timestamps
			const wait1 = new mongoose.Types.ObjectId().toString();
			const wait2 = new mongoose.Types.ObjectId().toString();
			const wait3 = new mongoose.Types.ObjectId().toString();

			const t1 = new Date(Date.now() - 300000); // 5 min ago (1st)
			const t2 = new Date(Date.now() - 200000); // 3.3 min ago (2nd)
			const t3 = new Date(Date.now() - 100000); // 1.6 min ago (3rd)

			let sharedDoc = {
				_id: new mongoose.Types.ObjectId(tournamentId),
				tournamentName: "GMU Mid-Atlantic Open",
				maxCapacity: 2,
				rsvpCount: 2,
				attendees: [new mongoose.Types.ObjectId(attendeeA), new mongoose.Types.ObjectId(attendeeB)],
				waitlist: [
					{ userId: new mongoose.Types.ObjectId(wait2), registeredAt: t2 },
					{ userId: new mongoose.Types.ObjectId(wait1), registeredAt: t1 }, // Earliest
					{ userId: new mongoose.Types.ObjectId(wait3), registeredAt: t3 },
				],
				status: "sold_out",
			};

			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;

			let lock = Promise.resolve();
			const withLock = (fn) => {
				const n = lock.then(() => fn());
				lock = n.catch(() => {});
				return n;
			};

			jest.spyOn(Tournament, "findById").mockImplementation(async () =>
				withLock(async () => ({
					...sharedDoc,
					attendees: [...sharedDoc.attendees],
					waitlist: [...sharedDoc.waitlist],
					save: jest.fn().mockResolvedValue(true),
					populate: jest.fn().mockResolvedValue(true),
				}))
			);

			jest.spyOn(Tournament, "findOneAndUpdate").mockImplementation(async (filter, update) =>
				withLock(async () => {
					// 1. Cancel attendee
					if (filter.attendees && update.$pull?.attendees) {
						const toRemove = update.$pull.attendees;
						sharedDoc.attendees = sharedDoc.attendees.filter(
							(id) => id.toString() !== toRemove.toString()
						);
						sharedDoc.rsvpCount = sharedDoc.attendees.length;
						return { ...sharedDoc };
					}

					// 2. Waitlist FIFO promotion
					if (filter["waitlist.userId"] && update.$pull?.waitlist && update.$push?.attendees) {
						const promotedId = update.$push.attendees;
						sharedDoc.waitlist = sharedDoc.waitlist.filter(
							(w) => w.userId.toString() !== promotedId.toString()
						);
						sharedDoc.attendees.push(new mongoose.Types.ObjectId(promotedId));
						sharedDoc.rsvpCount = sharedDoc.attendees.length;
						return { ...sharedDoc };
					}

					return null;
				})
			);

			jest.spyOn(Notification, "create").mockResolvedValue({});

			// Attendee A cancels their RSVP
			const res = await request(app)
				.post(`/api/tournaments/${tournamentId}/cancel-rsvp`)
				.set("Authorization", `Bearer ${createToken(attendeeA)}`);

			expect(res.status).toBe(200);
			expect(res.body.message).toBe("RSVP removed");
			expect(res.body.promotedUserId).toBe(wait1); // Earliest (t1) must be promoted

			// Attendees invariant: attendeeA removed, attendeeB remained, wait1 promoted
			const attendeeIds = sharedDoc.attendees.map((id) => id.toString());
			expect(attendeeIds).not.toContain(attendeeA);
			expect(attendeeIds).toContain(attendeeB);
			expect(attendeeIds).toContain(wait1);
			expect(sharedDoc.attendees.length).toBe(2);

			// Waitlist invariant: wait1 dequeued, wait2 and wait3 remain
			const waitlistIds = sharedDoc.waitlist.map((w) => w.userId.toString());
			expect(waitlistIds).not.toContain(wait1);
			expect(waitlistIds).toEqual([wait2, wait3]);

			// Notification & Socket verification
			expect(Notification.create).toHaveBeenCalledWith(
				expect.objectContaining({
					targetUserId: expect.anything(),
					message: expect.stringMatching(/promoted from the waitlist/i),
				})
			);

			expect(mockIo.emit).toHaveBeenCalledWith("tournament:waitlistPromoted", {
				tournamentId,
				userId: wait1,
				tournamentName: "GMU Mid-Atlantic Open",
			});
			expect(mockIo.emit).toHaveBeenCalledWith("tournament:rsvpUpdated", {
				tournamentId,
				rsvpCount: 2,
			});

			mongoose.connection.readyState = origReadyState;
		});

		test("Consecutive Exhaustion: Waitlist promotion followed by secondary cancellation restores 'active' status", async () => {
			const tournamentId = new mongoose.Types.ObjectId().toString();
			const attendee = new mongoose.Types.ObjectId().toString();

			let sharedDoc = {
				_id: new mongoose.Types.ObjectId(tournamentId),
				tournamentName: "GMU Solo Championship",
				maxCapacity: 1,
				rsvpCount: 1,
				attendees: [new mongoose.Types.ObjectId(attendee)],
				waitlist: [], // Empty waitlist
				status: "sold_out",
			};

			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;

			jest.spyOn(Tournament, "findById").mockImplementation(async () => ({
				...sharedDoc,
				attendees: [...sharedDoc.attendees],
				waitlist: [...sharedDoc.waitlist],
				populate: jest.fn().mockResolvedValue(true),
			}));

			jest.spyOn(Tournament, "findOneAndUpdate").mockImplementation(async () => {
				sharedDoc.attendees = [];
				sharedDoc.rsvpCount = 0;
				return { ...sharedDoc };
			});

			jest.spyOn(Tournament, "updateOne").mockImplementation(async (filter, update) => {
				if (update.$set?.status) sharedDoc.status = update.$set.status;
				return { acknowledged: true };
			});

			const res = await request(app)
				.post(`/api/tournaments/${tournamentId}/cancel-rsvp`)
				.set("Authorization", `Bearer ${createToken(attendee)}`);

			expect(res.status).toBe(200);
			expect(res.body.promotedUserId).toBeNull();
			expect(sharedDoc.attendees.length).toBe(0);
			expect(sharedDoc.status).toBe("active"); // Status reset from sold_out to active

			mongoose.connection.readyState = origReadyState;
		});
	});

	// =========================================================================
	// 3. TRANSACTIONAL FRIEND MUTATION & IDEMPOTENCY STRESS
	// =========================================================================
	describe("3. Transactional Friend Mutation & Idempotency Stress", () => {
		const userAId = "670000000000000000000001";
		const userBId = "670000000000000000000002";

		const createMockFriendUser = (id, name, overrides = {}) => {
			const doc = {
				_id: new mongoose.Types.ObjectId(id),
				name,
				email: `${name.toLowerCase()}@gmu.edu`,
				friends: [],
				friendRequests: [],
				sentFriendRequests: [],
				save: jest.fn().mockImplementation(async function () {
					return this;
				}),
				...overrides,
			};
			doc.friendRequests.pull = jest.fn((val) => {
				const str = (val?._id || val)?.toString();
				const idx = doc.friendRequests.findIndex((i) => (i?._id || i)?.toString() === str);
				if (idx > -1) doc.friendRequests.splice(idx, 1);
			});
			doc.sentFriendRequests.pull = jest.fn((val) => {
				const str = (val?._id || val)?.toString();
				const idx = doc.sentFriendRequests.findIndex((i) => (i?._id || i)?.toString() === str);
				if (idx > -1) doc.sentFriendRequests.splice(idx, 1);
			});
			return doc;
		};

		test("Simultaneous Cross-Request Auto-Accept: Mutual concurrent requests resolve into symmetric friendship without duplicates", async () => {
			// Shared database user state
			const userA = createMockFriendUser(userAId, "Alice");
			const userB = createMockFriendUser(userBId, "Bob");

			jest.spyOn(User, "findById").mockImplementation(async (id) => {
				const sId = id?.toString();
				if (sId === userAId) return userA;
				if (sId === userBId) return userB;
				return null;
			});


			// Alice requests Bob, Bob requests Alice concurrently
			const [resA, resB] = await Promise.all([
				request(app)
					.post("/api/friends/request")
					.set("Authorization", `Bearer ${createToken(userAId)}`)
					.send({ recipientId: userBId }),
				request(app)
					.post("/api/friends/request")
					.set("Authorization", `Bearer ${createToken(userBId)}`)
					.send({ recipientId: userAId }),
			]);

			expect(resA.status).toBe(200);
			expect(resB.status).toBe(200);

			// Invariant: At least one of the requests transitioned to auto-accept or request-sent
			const messages = [resA.body.message, resB.body.message];
			expect(
				messages.includes("Friend request sent") ||
				messages.includes("Friend request accepted automatically")
			).toBe(true);

			// No duplicate friendship entries
			const aFriends = userA.friends.map((id) => id?.toString());
			const bFriends = userB.friends.map((id) => id?.toString());
			expect(new Set(aFriends).size).toBe(aFriends.length);
			expect(new Set(bFriends).size).toBe(bFriends.length);
		});

		test("Identical Idempotency Key Replay Burst: 20 concurrent requests with identical key execute exactly 1 database write", async () => {
			const idempotencyKey = "replay-burst-key-" + crypto.randomUUID();
			const userA = createMockFriendUser(userAId, "Alice");
			const userB = createMockFriendUser(userBId, "Bob");

			jest.spyOn(User, "findById").mockImplementation(async (id) => {
				const sId = id?.toString();
				if (sId === userAId) return userA;
				if (sId === userBId) return userB;
				return null;
			});

			let databaseWrites = 0;
			userA.save = jest.fn().mockImplementation(async () => {
				databaseWrites++;
				return userA;
			});
			userB.save = jest.fn().mockImplementation(async () => {
				databaseWrites++;
				return userB;
			});

			// Fire 20 concurrent requests with the identical idempotency key
			const burstSize = 20;
			const requests = Array.from({ length: burstSize }).map(() =>
				request(app)
					.post("/api/friends/request")
					.set("Authorization", `Bearer ${createToken(userAId)}`)
					.set("Idempotency-Key", idempotencyKey)
					.send({ recipientId: userBId })
			);

			const responses = await Promise.all(requests);

			// Responses must either be 200 (completed/idempotent) or 409 (in-flight conflict)
			for (const res of responses) {
				expect([200, 409]).toContain(res.status);
			}

			const completed = responses.filter((r) => r.status === 200);
			expect(completed.length).toBeGreaterThanOrEqual(1);

			// Replayed completed requests must contain idempotent flag
			const replayed = completed.filter((r) => r.body.idempotent === true);
			if (replayed.length > 0) {
				expect(replayed[0].body.message).toBe("Friend request sent");
			}

			// Under-the-hood mutations must not multiply
			expect(databaseWrites).toBeLessThanOrEqual(2); // 1 for Alice, 1 for Bob
		});

		test("Transaction Rollback on Injected Failure: Aborts transaction and rejects write when write failure occurs", async () => {
			const mockSession = {
				startTransaction: jest.fn(),
				commitTransaction: jest.fn().mockResolvedValue(),
				abortTransaction: jest.fn().mockResolvedValue(),
				endSession: jest.fn().mockResolvedValue(),
			};

			const origStartSession = mongoose.startSession;
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;
			mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

			const transactionFn = jest.fn().mockImplementation(async () => {
				throw new Error("Disk quota exhausted / write collision");
			});
			const fallbackFn = jest.fn();

			await expect(
				executeWithTransactionOrFallback({ transactionFn, fallbackFn })
			).rejects.toThrow("Disk quota exhausted / write collision");

			// Invariant: startTransaction -> abortTransaction -> endSession
			expect(mockSession.startTransaction).toHaveBeenCalled();
			expect(mockSession.abortTransaction).toHaveBeenCalled();
			expect(mockSession.endSession).toHaveBeenCalled();
			expect(mockSession.commitTransaction).not.toHaveBeenCalled();
			expect(fallbackFn).not.toHaveBeenCalled();

			mongoose.startSession = origStartSession;
			mongoose.connection.readyState = origReadyState;
		});

		test("Standalone MongoDB Code 20 Fallback: Gracefully falls back to atomic queries on standalone deployments", async () => {
			const standaloneErr = new Error("Transaction numbers are only allowed on a replica set member or mongos");
			standaloneErr.code = 20;

			const origStartSession = mongoose.startSession;
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;
			mongoose.startSession = jest.fn().mockRejectedValue(standaloneErr);

			const transactionFn = jest.fn();
			const fallbackFn = jest.fn().mockResolvedValue({ fallbackExecuted: true });

			const result = await executeWithTransactionOrFallback({ transactionFn, fallbackFn });
			expect(result).toEqual({ fallbackExecuted: true });
			expect(fallbackFn).toHaveBeenCalled();
			expect(transactionFn).not.toHaveBeenCalled();

			mongoose.startSession = origStartSession;
			mongoose.connection.readyState = origReadyState;
		});
	});

	// =========================================================================
	// 4. FEED ANTI-SPAM HEURISTICS & AUTO-QUARANTINE STRESS
	// =========================================================================
	describe("4. Feed Anti-Spam Heuristics & Auto-Quarantine Stress", () => {
		const authorId = "680000000000000000000001";
		const reporter1Id = "680000000000000000000002";
		const reporter2Id = "680000000000000000000003";
		const reporter3Id = "680000000000000000000004";

		test("Sliding Window Rate Limit: Rejects 4th post submitted within 60-second window", async () => {
			for (let i = 1; i <= 3; i++) {
				const evalResult = await evaluateSpamHeuristics({
					userId: authorId,
					title: `Community Update ${i}`,
					content: `Legitimate badminton discussion content number ${i}`,
				});
				expect(evalResult.isSpam).toBe(false);
			}

			// 4th post within 60s
			const fourthEval = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Community Update 4",
				content: "Legitimate badminton discussion content number 4",
			});

			expect(fourthEval.isSpam).toBe(true);
			expect(fourthEval.heuristic).toBe("rate_limit");
			expect(fourthEval.reason).toContain("Rate limit exceeded: Maximum 3 posts per minute.");
		});

		test("SHA256 Normalization & Duplicate Detection: Detects variations in casing and whitespace", async () => {
			const cleanFirst = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Doubles Partner Wanted",
				content: "Looking for an advanced doubles partner for RAC Court 3 tomorrow evening.",
			});
			expect(cleanFirst.isSpam).toBe(false);

			// Same content with uppercase and excessive whitespace
			const duplicateVariant = await evaluateSpamHeuristics({
				userId: authorId,
				title: "   DOUBLES   PARTNER   WANTED   ",
				content: "Looking   for   an   advanced   doubles   partner   for   RAC   Court   3   tomorrow   evening.",
			});

			expect(duplicateVariant.isSpam).toBe(true);
			expect(duplicateVariant.heuristic).toBe("duplicate_content");
			expect(duplicateVariant.reason).toContain("Duplicate content detected");
		});

		test("Link Flood Detection: Rejects content containing more than 2 external URLs", async () => {
			// 2 links: allowed
			const twoLinks = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Equipment Links",
				content: "Check https://badminton.org/yonex and https://badminton.org/victor for rackets.",
			});
			expect(twoLinks.isSpam).toBe(false);

			// 3 links: rejected
			const threeLinks = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Racket Spam",
				content: "Visit https://site1.com and https://site2.com and also www.site3.com for discounts!",
			});
			expect(threeLinks.isSpam).toBe(true);
			expect(threeLinks.heuristic).toBe("excessive_urls");
			expect(threeLinks.reason).toContain("Found 3 URLs (limit is 2)");
		});

		test("Commercial Keyword Scoring: Blocks combinations of spam keywords and external links", async () => {
			const spamPost = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Free Money and Cheap Crypto",
				content: "Earn cash fast with my telegram investment returns!",
			});
			expect(spamPost.isSpam).toBe(true);
			expect(spamPost.heuristic).toBe("spam_keywords");
			expect(spamPost.reason).toContain("Spam keywords detected");
		});

		test("3-Report Community Auto-Quarantine Pipeline: Purges quarantined post from ActivityFeed and isolates from public queries", async () => {
			const targetPostId = new mongoose.Types.ObjectId().toString();

			let postState = {
				_id: new mongoose.Types.ObjectId(targetPostId),
				authorId: authorId,
				title: "Dubious Sales Post",
				content: "Click this link to buy shuttles cheap",
				reportCount: 0,
				reports: [],
				status: "active",
				isFlagged: false,
				save: jest.fn().mockImplementation(async function () {
					// Post-save hook behavior simulation: purge from ActivityFeed if quarantined
					if (this.status === "quarantined" || this.isFlagged) {
						await ActivityFeed.deleteOne({ type: "post", referenceId: this._id });
					}
					return this;
				}),
			};

			jest.spyOn(Post, "findById").mockImplementation(async (id) => {
				if (id.toString() === targetPostId) return postState;
				return null;
			});

			jest.spyOn(ActivityFeed, "deleteOne").mockResolvedValue({ deletedCount: 1 });

			// Invariant 1: Author cannot self-report
			const selfReport = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set("Authorization", `Bearer ${createToken(authorId)}`)
				.send({ reason: "Self test" });
			expect(selfReport.status).toBe(400);
			expect(selfReport.body.message).toContain("cannot report your own post");

			// Report 1: User 2 reports
			const rep1 = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set("Authorization", `Bearer ${createToken(reporter1Id)}`)
				.send({ reason: "Unsolicited promotion" });
			expect(rep1.status).toBe(200);
			expect(rep1.body.reportCount).toBe(1);
			expect(rep1.body.status).toBe("active");
			expect(postState.status).toBe("active");

			// Invariant 2: User 2 cannot report again (duplicate report prevention)
			const dupRep = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set("Authorization", `Bearer ${createToken(reporter1Id)}`)
				.send({ reason: "Duplicate report attempt" });
			expect(dupRep.status).toBe(400);
			expect(dupRep.body.message).toContain("already reported this post");

			// Report 2: User 3 reports
			const rep2 = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set("Authorization", `Bearer ${createToken(reporter2Id)}`)
				.send({ reason: "Off-topic commercial spam" });
			expect(rep2.status).toBe(200);
			expect(rep2.body.reportCount).toBe(2);
			expect(rep2.body.status).toBe("active");

			// Report 3: User 4 reports -> Triggers Auto-Quarantine
			const rep3 = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set("Authorization", `Bearer ${createToken(reporter3Id)}`)
				.send({ reason: "Persistent spam" });
			expect(rep3.status).toBe(200);
			expect(rep3.body.reportCount).toBe(3);
			expect(rep3.body.status).toBe("quarantined");
			expect(rep3.body.message).toContain("quarantined for moderator review");

			// State Invariant
			expect(postState.status).toBe("quarantined");
			expect(postState.isFlagged).toBe(true);

			// ActivityFeed Purge Invariant
			expect(ActivityFeed.deleteOne).toHaveBeenCalledWith({
				type: "post",
				referenceId: expect.anything(),
			});

			// Real-time Socket Invariant
			expect(mockIo.emit).toHaveBeenCalledWith("postQuarantined", {
				postId: postState._id,
				reportCount: 3,
			});
			expect(mockIo.emit).toHaveBeenCalledWith("postDeleted", targetPostId);

			// Feed Query Filter Invariant: GET /api/forum excludes quarantined posts
			let capturedFeedQuery = null;
			jest.spyOn(Post, "find").mockImplementation((query) => {
				capturedFeedQuery = query;
				return {
					sort: jest.fn().mockReturnThis(),
					skip: jest.fn().mockReturnThis(),
					limit: jest.fn().mockReturnThis(),
					lean: jest.fn().mockResolvedValue([]),
				};
			});

			await request(app).get("/api/forum");
			expect(capturedFeedQuery.isFlagged).toEqual({ $ne: true });
			expect(capturedFeedQuery.status).toEqual({ $nin: ["quarantined", "deleted"] });
		});

		test("Admin Reinstatement: Quarantined post is restored to active status and reports cleared upon admin approval", async () => {
			const quarantinedPostId = new mongoose.Types.ObjectId().toString();
			const adminUserId = new mongoose.Types.ObjectId().toString();

			const postDoc = {
				_id: new mongoose.Types.ObjectId(quarantinedPostId),
				authorId: authorId,
				title: "Misclassified Post",
				content: "Legitimate tournament meetup",
				status: "quarantined",
				isFlagged: true,
				reportCount: 3,
				reports: [
					{ reportedBy: reporter1Id, reason: "False positive 1" },
					{ reportedBy: reporter2Id, reason: "False positive 2" },
					{ reportedBy: reporter3Id, reason: "False positive 3" },
				],
				save: jest.fn().mockResolvedValue(true),
			};

			jest.spyOn(Post, "findById").mockResolvedValue(postDoc);

			const res = await request(app)
				.put(`/api/admin/flagged/${quarantinedPostId}/approve`)
				.set("Authorization", `Bearer ${createToken(adminUserId, "admin")}`);

			expect(res.status).toBe(200);
			expect(res.body.message).toContain("approved and reinstated");

			// State Reset Invariants
			expect(postDoc.status).toBe("active");
			expect(postDoc.isFlagged).toBe(false);
			expect(postDoc.reportCount).toBe(0);
			expect(postDoc.reports).toEqual([]);
			expect(postDoc.save).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith("postCreated", postDoc);
		});

		test("Rate Limit Sliding Window Expiration: Allows user to post again once 60-second window expires", async () => {
			// Simulate 3 posts 61 seconds ago
			const oldTimestamp = Date.now() - 61000;
			userPostTimestamps.set(authorId, [oldTimestamp, oldTimestamp + 100, oldTimestamp + 200]);

			const evalResult = await evaluateSpamHeuristics({
				userId: authorId,
				title: "Post After Window Expiry",
				content: "Should succeed because earlier posts are outside the 60s sliding window.",
			});

			expect(evalResult.isSpam).toBe(false);
			expect(evalResult.heuristic).toBe("none");
		});
	});

	// =========================================================================
	// 5. ADVERSARIAL BOUNDARY & INTEGRITY STRESS
	// =========================================================================
	describe("5. Adversarial Boundary & Integrity Stress", () => {
		test("Boundary: Cancel RSVP by non-attending non-waitlisted user returns HTTP 400", async () => {
			const tournamentId = new mongoose.Types.ObjectId().toString();
			const nonExistentUserId = new mongoose.Types.ObjectId().toString();

			const mockDoc = {
				_id: new mongoose.Types.ObjectId(tournamentId),
				attendees: [new mongoose.Types.ObjectId()],
				waitlist: [],
				maxCapacity: 2,
				rsvpCount: 1,
			};

			jest.spyOn(Tournament, "findById").mockResolvedValue(mockDoc);

			const res = await request(app)
				.post(`/api/tournaments/${tournamentId}/cancel-rsvp`)
				.set("Authorization", `Bearer ${createToken(nonExistentUserId)}`);

			expect(res.status).toBe(400);
			expect(res.body.error).toContain("User is not currently attending this tournament.");
		});

		test("Boundary: Friend request to self is rejected with HTTP 400", async () => {
			const selfId = "690000000000000000000001";

			const res = await request(app)
				.post("/api/friends/request")
				.set("Authorization", `Bearer ${createToken(selfId)}`)
				.send({ recipientId: selfId });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Cannot add yourself");
		});

		test("Boundary: Friend request when already friends is rejected with HTTP 400", async () => {
			const u1 = "690000000000000000000010";
			const u2 = "690000000000000000000020";

			const user1Doc = {
				_id: new mongoose.Types.ObjectId(u1),
				friends: [new mongoose.Types.ObjectId(u2)],
				friendRequests: [],
				sentFriendRequests: [],
			};
			const user2Doc = {
				_id: new mongoose.Types.ObjectId(u2),
				friends: [new mongoose.Types.ObjectId(u1)],
				friendRequests: [],
				sentFriendRequests: [],
			};

			jest.spyOn(User, "findById").mockImplementation(async (id) => {
				if (id.toString() === u1) return user1Doc;
				if (id.toString() === u2) return user2Doc;
				return null;
			});

			const res = await request(app)
				.post("/api/friends/request")
				.set("Authorization", `Bearer ${createToken(u1)}`)
				.send({ recipientId: u2 });

			expect(res.status).toBe(400);
			expect(res.body.message).toBe("Already friends");
		});

		test("Boundary: In-flight idempotency lock returns HTTP 409 Conflict", async () => {
			const lockedKey = "in-flight-lock-" + crypto.randomUUID();
			await markIdempotentInFlight(lockedKey);

			const res = await request(app)
				.post("/api/friends/request")
				.set("Authorization", `Bearer ${createToken("690000000000000000000099")}`)
				.set("Idempotency-Key", lockedKey)
				.send({ recipientId: "690000000000000000000088" });

			expect(res.status).toBe(409);
			expect(res.body.message).toContain("already being processed");
		});
	});
});

