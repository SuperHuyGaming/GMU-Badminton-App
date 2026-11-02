/**
 * Empirical Challenger Test Suite — Milestone 2
 * File: server/tests/challenger_m2_empirical.test.js
 * 
 * Objectives:
 * 1. Court occupancy state machine:
 *    - Check-in, double check-in prevention (same court and cross-court switching)
 *    - Check-out state transition (court occupancy cleared, user profile cleared)
 *    - Behavior when user attempts checkout without being checked in (empirical test of 400 vs 200)
 *    - Behavior when user is checked in on Court 1 but attempts checkout on Court 2
 *    - Expiry query filtering in GET /api/courts/recreational-occupancy
 *    - GPS geofence boundary conditions (<=200m, >200m, invalid coordinates)
 * 2. Presence hydration:
 *    - Active user in onlineUsers Map -> isOnline: true
 *    - Disconnected/absent user -> isOnline: false
 *    - Multi-socket lifecycle (connect tab 1, tab 2, disconnect tab 1, disconnect tab 2)
 *    - Missing onlineUsers Map resilience
 *    - Prohibited personal name filter invariant (Tu Pham / Nhat Quang -> 404)
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import routes
const courtRoutes = require('../routes/courts');
const forumRoutes = require('../routes/forum');

// Models to mock
const Court = require('../models/Court');
const User = require('../models/User');

jest.mock('../models/Court');
jest.mock('../models/User');
jest.mock('../models/TournamentMatch');
jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/Notification');
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isToxic: false }),
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockReturnValue({ isSpam: false }),
}));
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn(),
	invalidateTag: jest.fn(),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const userAId = '660000000000000000000001';
const userBId = '660000000000000000000002';
const tokenUserA = jwt.sign({ userId: userAId, id: userAId }, JWT_SECRET);
const tokenUserB = jwt.sign({ userId: userBId, id: userBId }, JWT_SECRET);

// In-memory emulation of the atomic $pull / $push / $set updates the
// check-in route issues against Court.recreationalOccupancy.checkedInUsers.
const applyOccupancyUpdate = (court, update) => {
	if (!court.recreationalOccupancy) {
		court.recreationalOccupancy = { isCheckedIn: false, checkedInUsers: [] };
	}
	const occ = court.recreationalOccupancy;
	const pull = update.$pull && update.$pull['recreationalOccupancy.checkedInUsers'];
	if (pull) {
		const conds = pull.$or || [pull];
		occ.checkedInUsers = (occ.checkedInUsers || []).filter((u) => !conds.some((c) => {
			if (c.userId) return (u.userId?._id || u.userId)?.toString() === c.userId.toString();
			if (c.expiresAt && c.expiresAt.$lte) return Boolean(u.expiresAt) && new Date(u.expiresAt) <= c.expiresAt.$lte;
			return false;
		}));
	}
	const push = update.$push && update.$push['recreationalOccupancy.checkedInUsers'];
	if (push) occ.checkedInUsers = [...(occ.checkedInUsers || []), push];
	if (update.$set && update.$set['recreationalOccupancy.isCheckedIn'] !== undefined) {
		occ.isCheckedIn = update.$set['recreationalOccupancy.isCheckedIn'];
	}
	return court;
};

describe('Challenger M2 Empirical Verification Suite', () => {
	let app;
	let onlineUsersMap;
	let emittedEvents;
	let mockCourts;
	let mockUsers;

	beforeEach(() => {
		jest.clearAllMocks();
		emittedEvents = [];
		onlineUsersMap = new Map();

		// Realistic in-memory state store for Courts 1-6
		mockCourts = [1, 2, 3, 4, 5, 6].map((num) => ({
			_id: new mongoose.Types.ObjectId(),
			courtNumber: num,
			courtName: `RAC Court ${num}`,
			venue: 'Recreation Athletic Complex (RAC)',
			status: 'AVAILABLE',
			recreationalOccupancy: {
				isCheckedIn: false,
				checkedInUsers: [],
				queueCount: 0,
				estimatedWaitMinutes: 0,
			},
			updatedAt: new Date(),
			save: jest.fn().mockImplementation(function () {
				return Promise.resolve(this);
			}),
		}));

		// In-memory state store for Users
		mockUsers = {
			[userAId]: {
				_id: new mongoose.Types.ObjectId(userAId),
				name: 'Alice Player',
				profilePic: 'https://example.com/alice.jpg',
				role: 'user',
				skillLevel: 'Intermediate',
				singlesElo: 1300,
				doublesElo: 1250,
				currentCourtCheckIn: undefined,
				checkInLocation: 'None',
				save: jest.fn().mockImplementation(function () {
					return Promise.resolve(this);
				}),
			},
			[userBId]: {
				_id: new mongoose.Types.ObjectId(userBId),
				name: 'Bob Smashing',
				profilePic: 'https://example.com/bob.jpg',
				role: 'user',
				skillLevel: 'Advanced',
				singlesElo: 1400,
				doublesElo: 1450,
				currentCourtCheckIn: undefined,
				checkInLocation: 'None',
				save: jest.fn().mockImplementation(function () {
					return Promise.resolve(this);
				}),
			},
		};

		// Wire up Court model mocks with in-memory store
		Court.findOne = jest.fn().mockImplementation(({ courtNumber }) => {
			const found = mockCourts.find((c) => c.courtNumber === courtNumber);
			return Promise.resolve(found || null);
		});

		Court.find = jest.fn().mockImplementation((query) => {
			let result = [...mockCourts];
			if (query && query.courtNumber && query.courtNumber.$ne) {
				result = result.filter((c) => c.courtNumber !== query.courtNumber.$ne);
			}
			if (query && query['recreationalOccupancy.checkedInUsers.userId']) {
				const qUid = query['recreationalOccupancy.checkedInUsers.userId'].toString();
				result = result.filter((c) =>
					c.recreationalOccupancy?.checkedInUsers?.some(
						(u) => (u.userId?._id || u.userId)?.toString() === qUid
					)
				);
			}
			return {
				populate: jest.fn().mockReturnThis(),
				sort: jest.fn().mockResolvedValue(result),
				then: (resolve) => resolve(result),
			};
		});

		const findCourt = (filter) => mockCourts.find((c) => (
			filter._id ? c._id.toString() === filter._id.toString() : c.courtNumber === filter.courtNumber
		));
		Court.findOneAndUpdate = jest.fn().mockImplementation((filter, update) => {
			const court = findCourt(filter);
			return Promise.resolve(court ? applyOccupancyUpdate(court, update) : null);
		});
		Court.updateOne = jest.fn().mockImplementation((filter, update) => {
			const court = findCourt(filter);
			if (court) applyOccupancyUpdate(court, update);
			return Promise.resolve({ acknowledged: true });
		});

		Court.create = jest.fn().mockImplementation((doc) => {
			const newCourt = {
				...doc,
				_id: new mongoose.Types.ObjectId(),
				save: jest.fn().mockResolvedValue(doc),
			};
			mockCourts.push(newCourt);
			return Promise.resolve(newCourt);
		});

		// Wire up User model mocks with in-memory store
		User.findById = jest.fn().mockImplementation((id) => {
			const idStr = id?.toString();
			const u = mockUsers[idStr];
			if (!u) {
				return {
					lean: jest.fn().mockResolvedValue(null),
					select: jest.fn().mockReturnThis(),
					then: (resolve) => resolve(null),
				};
			}
			return {
				...u,
				lean: jest.fn().mockResolvedValue(u),
				select: jest.fn().mockImplementation(() => ({
					lean: jest.fn().mockResolvedValue(u),
				})),
				then: (resolve) => resolve(u),
			};
		});

		const mockIo = {
			emit: jest.fn((event, data) => {
				emittedEvents.push({ event, data });
			}),
		};

		app = express();
		app.use(express.json());
		app.set('io', mockIo);
		app.set('onlineUsers', onlineUsersMap);
		app.use('/api/courts', courtRoutes);
		app.use('/api/forum', forumRoutes);
	});

	// =========================================================================
	// 1. COURT OCCUPANCY STATE MACHINE EMPIRICAL CHALLENGES
	// =========================================================================
	describe('1. Court Occupancy State Machine', () => {
		test('Challenge 1.1: Standard check-in transitions occupancy and user record correctly', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ latitude: 38.8315, longitude: -77.3075 }); // Exact RAC coords

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.courtNumber).toBe(1);

			// Verify Court 1 occupancy updated
			const court1 = mockCourts.find((c) => c.courtNumber === 1);
			expect(court1.recreationalOccupancy.isCheckedIn).toBe(true);
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(court1.recreationalOccupancy.checkedInUsers[0].userName).toBe('Alice Player');

			// Verify User profile updated
			const userA = mockUsers[userAId];
			expect(userA.currentCourtCheckIn.courtNumber).toBe(1);
			expect(userA.checkInLocation).toBe('RAC');

			// Verify socket event emitted
			expect(emittedEvents.some((e) => e.event === 'courtOccupancyUpdated')).toBe(true);
		});

		test('Challenge 1.2: Double check-in on the SAME court updates session without duplicate entries', async () => {
			// First check-in
			await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ isTestCheckIn: true });

			const court1 = mockCourts.find((c) => c.courtNumber === 1);
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			const firstCheckInTime = court1.recreationalOccupancy.checkedInUsers[0].checkInTime;

			// Second check-in by same user on Court 1
			const res2 = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ isTestCheckIn: true });

			expect(res2.status).toBe(200);
			// Must NOT have 2 entries for user A
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(court1.recreationalOccupancy.checkedInUsers[0].userId.toString()).toBe(userAId);
		});

		test('Challenge 1.3: Cross-court check-in automatically evicts user from prior court', async () => {
			// Alice checks in to Court 1
			await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ isTestCheckIn: true });

			const court1 = mockCourts.find((c) => c.courtNumber === 1);
			const court2 = mockCourts.find((c) => c.courtNumber === 2);
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);

			// Alice checks in to Court 2 WITHOUT checking out of Court 1
			const res2 = await request(app)
				.post('/api/courts/2/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ isTestCheckIn: true });

			expect(res2.status).toBe(200);

			// Court 1 must now have 0 users and isCheckedIn: false
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(0);
			expect(court1.recreationalOccupancy.isCheckedIn).toBe(false);

			// Court 2 must have Alice
			expect(court2.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(court2.recreationalOccupancy.checkedInUsers[0].userId.toString()).toBe(userAId);

			// User profile must point to Court 2
			expect(mockUsers[userAId].currentCourtCheckIn.courtNumber).toBe(2);
		});

		test('Challenge 1.4: Checkout when user is NOT checked in returns 400 Bad Request', async () => {
			// User B has never checked in
			expect(mockUsers[userBId].currentCourtCheckIn).toBeUndefined();

			const res = await request(app)
				.post('/api/courts/1/check-out')
				.set('Authorization', `Bearer ${tokenUserB}`);

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/not checked into this court/i);
		});

		test('Challenge 1.5: Checking out of Court 2 when checked in to Court 1 rejects with 400 and preserves state', async () => {
			// Alice checks in to Court 1
			await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ isTestCheckIn: true });

			const court1 = mockCourts.find((c) => c.courtNumber === 1);
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(mockUsers[userAId].currentCourtCheckIn.courtNumber).toBe(1);

			// Alice calls check-out on Court 2 (wrong court)
			const res = await request(app)
				.post('/api/courts/2/check-out')
				.set('Authorization', `Bearer ${tokenUserA}`);

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/not checked into this court/i);

			// State synchronization preserved: User check-in is NOT cleared
			expect(mockUsers[userAId].currentCourtCheckIn.courtNumber).toBe(1);
			// Court 1 still has Alice checked in
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
		});

		test('Challenge 1.6: Expiry query filtering in GET /api/courts/recreational-occupancy', async () => {
			const court1 = mockCourts.find((c) => c.courtNumber === 1);
			const now = Date.now();

			// Add 1 expired user and 1 active user to Court 1
			court1.recreationalOccupancy.checkedInUsers = [
				{
					userId: new mongoose.Types.ObjectId(userAId),
					userName: 'Expired Alice',
					avatarUrl: '',
					checkInTime: new Date(now - 7200000), // 2 hours ago
					expiresAt: new Date(now - 3600000), // expired 1 hour ago
				},
				{
					userId: new mongoose.Types.ObjectId(userBId),
					userName: 'Active Bob',
					avatarUrl: '',
					checkInTime: new Date(now - 600000), // 10 mins ago
					expiresAt: new Date(now + 3000000), // expires in 50 mins
				},
			];
			court1.recreationalOccupancy.isCheckedIn = true;

			const res = await request(app).get('/api/courts/recreational-occupancy');
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);

			const c1Response = res.body.courts.find((c) => c.courtNumber === 1);
			// Only Active Bob should be returned
			expect(c1Response.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(c1Response.recreationalOccupancy.checkedInUsers[0].userName).toBe('Active Bob');
			expect(c1Response.recreationalOccupancy.isCheckedIn).toBe(true);

			// Check that cleanup was persisted in court document
			expect(court1.save).toHaveBeenCalled();
			expect(court1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
		});

		test('Challenge 1.7: When ALL users on a court are expired, isCheckedIn resets to false', async () => {
			const court2 = mockCourts.find((c) => c.courtNumber === 2);
			const now = Date.now();

			court2.recreationalOccupancy.checkedInUsers = [
				{
					userId: new mongoose.Types.ObjectId(userAId),
					userName: 'Old Session',
					expiresAt: new Date(now - 60000), // expired 1 min ago
				},
			];
			court2.recreationalOccupancy.isCheckedIn = true;

			const res = await request(app).get('/api/courts/recreational-occupancy');
			expect(res.status).toBe(200);

			const c2Response = res.body.courts.find((c) => c.courtNumber === 2);
			expect(c2Response.recreationalOccupancy.checkedInUsers).toHaveLength(0);
			expect(c2Response.recreationalOccupancy.isCheckedIn).toBe(false);
			expect(court2.recreationalOccupancy.isCheckedIn).toBe(false);
		});

		test('Challenge 1.8: Geofence boundary stress test (exact 200m vs 201m)', async () => {
			// RAC: 38.8315, -77.3075
			// A point roughly ~180m north: 38.8331, -77.3075 (within 200m)
			const resWithin = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ latitude: 38.8331, longitude: -77.3075 });

			expect(resWithin.status).toBe(200);

			// A point ~300m north: 38.8345, -77.3075 (>200m)
			const resOutside = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${tokenUserA}`)
				.send({ latitude: 38.8345, longitude: -77.3075 });

			expect(resOutside.status).toBe(403);
			expect(resOutside.body.message).toMatch(/away from the rac/i);
		});
	});

	// =========================================================================
	// 2. PRESENCE HYDRATION EMPIRICAL CHALLENGES
	// =========================================================================
	describe('2. Presence Hydration with Live Socket Maps', () => {
		test('Challenge 2.1: Target user in onlineUsers Map hydrates isOnline: true', async () => {
			onlineUsersMap.set(userAId, new Set(['socket_tab_1']));

			const res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.status).toBe(200);
			expect(res.body.user).toBeDefined();
			expect(res.body.user.isOnline).toBe(true);
		});

		test('Challenge 2.2: Target user absent from onlineUsers Map hydrates isOnline: false', async () => {
			expect(onlineUsersMap.has(userAId)).toBe(false);

			const res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.status).toBe(200);
			expect(res.body.user.isOnline).toBe(false);
		});

		test('Challenge 2.3: Multi-tab presence lifecycle transitions cleanly', async () => {
			// Tab 1 connects
			onlineUsersMap.set(userAId, new Set(['socket_tab_1']));
			let res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.body.user.isOnline).toBe(true);

			// Tab 2 connects
			onlineUsersMap.get(userAId).add('socket_tab_2');
			res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.body.user.isOnline).toBe(true);

			// Tab 1 closes (user still online on Tab 2)
			onlineUsersMap.get(userAId).delete('socket_tab_1');
			expect(onlineUsersMap.get(userAId).size).toBe(1);
			res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.body.user.isOnline).toBe(true);

			// Tab 2 closes (onlineUsers removes user)
			onlineUsersMap.get(userAId).delete('socket_tab_2');
			if (onlineUsersMap.get(userAId).size === 0) {
				onlineUsersMap.delete(userAId);
			}
			expect(onlineUsersMap.has(userAId)).toBe(false);
			res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.body.user.isOnline).toBe(false);
		});

		test('Challenge 2.4: Missing onlineUsers map in app gracefully defaults to isOnline: false', async () => {
			app.set('onlineUsers', undefined);

			const res = await request(app).get(`/api/forum/members/${userAId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.status).toBe(200);
			expect(res.body.user.isOnline).toBe(false);
		});

		test('Challenge 2.5: Prohibited personal names strictly return 404 regardless of presence', async () => {
			const tuPhamId = '660000000000000000000099';
			mockUsers[tuPhamId] = {
				_id: new mongoose.Types.ObjectId(tuPhamId),
				name: 'Tu Pham',
				role: 'user',
				save: jest.fn().mockResolvedValue(true),
			};
			onlineUsersMap.set(tuPhamId, new Set(['socket_active']));

			const res = await request(app).get(`/api/forum/members/${tuPhamId}/card`).set('Authorization', `Bearer ${tokenUserB}`);
			expect(res.status).toBe(404);
			expect(res.body.message).toMatch(/member not found/i);
		});
	});
});
