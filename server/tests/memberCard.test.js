const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const forumRoutes = require('../routes/forum');
const User = require('../models/User');

jest.mock('../models/User');
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
const targetUserId = '660000000000000000000010';
const callerUserId = '660000000000000000000020';
const callerToken = jwt.sign({ userId: callerUserId, id: callerUserId }, JWT_SECRET);
const selfToken = jwt.sign({ userId: targetUserId, id: targetUserId }, JWT_SECRET);

// Target user resolves via .lean(); the caller lookup (friendship status) via .select().lean()
const mockTargetUser = (targetDoc) => {
	User.findById = jest.fn().mockImplementation((id) => {
		if (id.toString() === targetUserId) {
			return { lean: jest.fn().mockResolvedValue(targetDoc) };
		}
		return {
			select: jest.fn().mockReturnThis(),
			lean: jest.fn().mockResolvedValue(null),
		};
	});
};

describe('Member Card API: GET /api/forum/members/:userId/card', () => {
	let app;
	let onlineUsersMap;

	beforeEach(() => {
		jest.clearAllMocks();
		onlineUsersMap = new Map();

		app = express();
		app.use(express.json());
		app.set('onlineUsers', onlineUsersMap);
		app.use('/api/forum', forumRoutes);
	});

	test('returns 401 when the request is unauthenticated', async () => {
		mockTargetUser({ _id: targetUserId, name: 'Sarah Connor' });
		const res = await request(app).get(`/api/forum/members/${targetUserId}/card`);
		expect(res.status).toBe(401);
		expect(User.findById).not.toHaveBeenCalled();
	});

	test('returns 404 for members who opted out via hideFromSearch', async () => {
		mockTargetUser({ _id: targetUserId, name: 'Private Player', hideFromSearch: true });

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(404);
		expect(res.body.message).toMatch(/member not found/i);
	});

	test('still returns the card to a hideFromSearch member viewing themselves', async () => {
		mockTargetUser({ _id: targetUserId, name: 'Private Player', hideFromSearch: true });

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${selfToken}`);
		expect(res.status).toBe(200);
		expect(res.body.user.friendshipStatus).toBe('self');
	});

	test('returns currentCourtCheckIn: null when the check-in has expired', async () => {
		mockTargetUser({
			_id: targetUserId,
			name: 'Expired Checker',
			currentCourtCheckIn: {
				courtNumber: 4,
				checkInTime: new Date(Date.now() - 7200000),
				expiresAt: new Date(Date.now() - 3600000),
			},
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(200);
		expect(res.body.user.currentCourtCheckIn).toBeNull();
	});

	test('returns 400 when userId format is not a valid ObjectId', async () => {
		const res = await request(app)
			.get('/api/forum/members/invalid-id/card')
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/invalid user id format/i);
	});

	test('returns 404 when target user is not found in database', async () => {
		mockTargetUser(null);

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(404);
		expect(res.body.message).toMatch(/member not found/i);
	});

	test('returns 404 when user matches prohibited personal names (Tu Pham / Nhat Quang)', async () => {
		mockTargetUser({
			_id: targetUserId,
			name: 'Tu Pham',
			role: 'user',
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(404);
		expect(res.body.message).toMatch(/member not found/i);
	});

	test('returns 200 with full user card, stats, ratings and offline presence', async () => {
		mockTargetUser({
			_id: targetUserId,
			name: 'Sarah Connor',
			role: 'user',
			skillLevel: 'Advanced',
			bio: 'Ready to smash!',
			singlesElo: 1450,
			doublesElo: 1420,
			preferredPlay: 'Singles',
			racket: 'Yonex Astrox 88D',
			homeUniversity: 'George Mason University',
			stats: { totalMatches: 10, winStreak: 3, highestWinStreak: 5 },
			badges: ['first_win'],
			currentCourtCheckIn: {
				courtNumber: 2,
				checkInTime: new Date(),
				expiresAt: new Date(Date.now() + 3600000),
			},
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(200);
		expect(res.body.user).toBeDefined();
		expect(res.body.user.name).toBe('Sarah Connor');
		expect(res.body.user.singlesElo).toBe(1450);
		expect(res.body.user.isOnline).toBe(false);
		expect(res.body.user.friendshipStatus).toBe('none');
		expect(res.body.user.stats.winStreak).toBe(3);
		expect(res.body.user.stats.winRate).toBe(65);
		expect(res.body.user.currentCourtCheckIn.courtNumber).toBe(2);
	});

	test('hydrates isOnline: true when user is active in onlineUsers presence map', async () => {
		onlineUsersMap.set(targetUserId, new Set(['socket_123']));

		mockTargetUser({
			_id: targetUserId,
			name: 'Alex Hunter',
			skillLevel: 'Intermediate',
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);
		expect(res.status).toBe(200);
		expect(res.body.user.isOnline).toBe(true);
	});

	test('returns friendshipStatus: "self" when caller is target user', async () => {
		mockTargetUser({
			_id: targetUserId,
			name: 'Alex Hunter',
			skillLevel: 'Intermediate',
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${selfToken}`);

		expect(res.status).toBe(200);
		expect(res.body.user.friendshipStatus).toBe('self');
	});

	test('returns friendshipStatus: "friends" when caller has target user in friends list', async () => {
		User.findById = jest.fn().mockImplementation((id) => {
			if (id.toString() === targetUserId) {
				return {
					lean: jest.fn().mockResolvedValue({
						_id: targetUserId,
						name: 'David Kim',
						skillLevel: 'Advanced',
					}),
				};
			}
			if (id.toString() === callerUserId) {
				return {
					select: jest.fn().mockReturnThis(),
					lean: jest.fn().mockResolvedValue({
						_id: callerUserId,
						friends: [new mongoose.Types.ObjectId(targetUserId)],
						sentFriendRequests: [],
						friendRequests: [],
					}),
				};
			}
			return { lean: jest.fn().mockResolvedValue(null) };
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);

		expect(res.status).toBe(200);
		expect(res.body.user.friendshipStatus).toBe('friends');
	});

	test('returns friendshipStatus: "pending_sent" when caller has sent a friend request', async () => {
		User.findById = jest.fn().mockImplementation((id) => {
			if (id.toString() === targetUserId) {
				return {
					lean: jest.fn().mockResolvedValue({
						_id: targetUserId,
						name: 'David Kim',
					}),
				};
			}
			if (id.toString() === callerUserId) {
				return {
					select: jest.fn().mockReturnThis(),
					lean: jest.fn().mockResolvedValue({
						_id: callerUserId,
						friends: [],
						sentFriendRequests: [new mongoose.Types.ObjectId(targetUserId)],
						friendRequests: [],
					}),
				};
			}
			return { lean: jest.fn().mockResolvedValue(null) };
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);

		expect(res.status).toBe(200);
		expect(res.body.user.friendshipStatus).toBe('pending_sent');
	});

	test('returns friendshipStatus: "pending_received" when caller received request from target', async () => {
		User.findById = jest.fn().mockImplementation((id) => {
			if (id.toString() === targetUserId) {
				return {
					lean: jest.fn().mockResolvedValue({
						_id: targetUserId,
						name: 'David Kim',
					}),
				};
			}
			if (id.toString() === callerUserId) {
				return {
					select: jest.fn().mockReturnThis(),
					lean: jest.fn().mockResolvedValue({
						_id: callerUserId,
						friends: [],
						sentFriendRequests: [],
						friendRequests: [new mongoose.Types.ObjectId(targetUserId)],
					}),
				};
			}
			return { lean: jest.fn().mockResolvedValue(null) };
		});

		const res = await request(app)
			.get(`/api/forum/members/${targetUserId}/card`)
			.set('Authorization', `Bearer ${callerToken}`);

		expect(res.status).toBe(200);
		expect(res.body.user.friendshipStatus).toBe('pending_received');
	});
});
