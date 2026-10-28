const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const Notification = require('../models/Notification');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"abc123"'),
	invalidateFeed: jest.fn(),
	clear: jest.fn(),
	resetStats: jest.fn(),
	getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, invalidations: 0, size: 0 })
}));
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue(),
}));
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, score: 0 }),
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockResolvedValue({ isSpam: false, score: 0 }),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const userId = '660000000000000000000001';
const otherUserId = '660000000000000000000002';
const adminId = '660000000000000000000099';

const userToken = jwt.sign({ id: userId, userId, role: 'user', name: 'ChallengerUser' }, JWT_SECRET);
const otherUserToken = jwt.sign({ id: otherUserId, userId: otherUserId, role: 'user', name: 'OtherUser' }, JWT_SECRET);
const adminToken = jwt.sign({ id: adminId, userId: adminId, role: 'admin', name: 'AdminUser' }, JWT_SECRET);

describe('Empirical Challenger: Notification System Stress & Boundary Testing (Milestone M1)', () => {
	let app;
	let mockIo;
	let inMemoryNotifs;

	beforeEach(() => {
		jest.clearAllMocks();
		inMemoryNotifs = [];

		mockIo = {
			emit: jest.fn(),
			to: jest.fn().mockReturnThis(),
		};

		app = express();
		app.use(express.json());
		app.set('io', mockIo);
		app.use((req, res, next) => {
			req.io = mockIo;
			next();
		});
		app.use('/api/forum', forumRoutes);

		// Wire dynamic stateful mock implementations for Notification model
		Notification.find.mockImplementation((query) => {
			let results = inMemoryNotifs.filter(n => !query.targetUserId || n.targetUserId === query.targetUserId);
			return {
				sort: jest.fn().mockImplementation((sortObj) => ({
					limit: jest.fn().mockImplementation((limitNum) => {
						const sorted = [...results].sort((a, b) => {
							if (sortObj.time === -1) return new Date(b.time) - new Date(a.time);
							return new Date(a.time) - new Date(b.time);
						});
						return Promise.resolve(sorted.slice(0, limitNum));
					})
				}))
			};
		});

		Notification.updateMany.mockImplementation((query, update) => {
			let modifiedCount = 0;
			inMemoryNotifs.forEach((n) => {
				const matchesTarget = !query.targetUserId || n.targetUserId === query.targetUserId;
				const matchesRead = query.read === undefined || n.read === query.read;
				if (matchesTarget && matchesRead) {
					if (update.read !== undefined && n.read !== update.read) {
						n.read = update.read;
						modifiedCount++;
					}
				}
			});
			return Promise.resolve({ acknowledged: true, modifiedCount });
		});

		Notification.deleteMany.mockImplementation((query) => {
			const initialLength = inMemoryNotifs.length;
			inMemoryNotifs = inMemoryNotifs.filter((n) => {
				if (query.targetUserId && n.targetUserId === query.targetUserId) return false;
				return true;
			});
			const deletedCount = initialLength - inMemoryNotifs.length;
			return Promise.resolve({ acknowledged: true, deletedCount });
		});

		Notification.findById.mockImplementation((id) => {
			const notif = inMemoryNotifs.find((n) => n._id.toString() === id.toString());
			if (!notif) return Promise.resolve(null);
			return Promise.resolve({
				...notif,
				save: jest.fn().mockImplementation(function() {
					notif.read = this.read;
					return Promise.resolve(this);
				})
			});
		});
	});

	// =========================================================================
	// 1. Schema Indexes & Registration Verification
	// =========================================================================
	describe('1. Schema Indexes Verification', () => {
		test('Notification.schema has exact compound indexes registered', () => {
			const actualNotification = jest.requireActual('../models/Notification');
			const indexes = actualNotification.schema.indexes();

			expect(Array.isArray(indexes)).toBe(true);
			expect(indexes.length).toBeGreaterThanOrEqual(2);

			const targetTimeIndex = indexes.find(
				([fields]) => fields.targetUserId === 1 && fields.time === -1
			);
			expect(targetTimeIndex).toBeDefined();

			const targetReadIndex = indexes.find(
				([fields]) => fields.targetUserId === 1 && fields.read === 1
			);
			expect(targetReadIndex).toBeDefined();
		});

		test('Notification.schema enforces required fields and default values', () => {
			const actualNotification = jest.requireActual('../models/Notification');
			const paths = actualNotification.schema.paths;

			expect(paths.targetUserId.isRequired).toBe(true);
			expect(paths.message.isRequired).toBe(true);
			expect(paths.link.isRequired).toBe(true);
			expect(paths.read.defaultValue).toBe(false);
			expect(typeof paths.time.defaultValue).toBe('function');
		});
	});

	// =========================================================================
	// 2. Boundary Condition: Empty Notifications
	// =========================================================================
	describe('2. Boundary Condition: Empty Notifications (0 items in DB)', () => {
		test('GET /notifications/:userId with 0 notifications returns 200 []', async () => {
			const res = await request(app)
				.get(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body).toHaveLength(0);
		});

		test('PUT /notifications/:userId/read with 0 notifications returns 200 with markedReadCount: 0', async () => {
			const res = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				success: true,
				markedReadCount: 0,
				unreadCount: 0,
			});
			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsMarkedRead', {
				userId,
				unreadCount: 0,
			});
		});

		test('DELETE /notifications/:userId with 0 notifications returns 200 with deletedCount: 0', async () => {
			const res = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				success: true,
				message: 'All notifications cleared.',
				deletedCount: 0,
			});
			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsCleared', { userId });
		});
	});

	// =========================================================================
	// 3. Boundary Condition: Multiple Calls to Mark-Read (Idempotency & State Transitions)
	// =========================================================================
	describe('3. Boundary Condition: Multiple Calls to Mark-Read', () => {
		beforeEach(() => {
			// Populate 4 unread notifications for userId, plus 2 for otherUserId
			inMemoryNotifs = [
				{ _id: '661000000000000000000001', targetUserId: userId, message: 'Comment 1', link: '/community?postId=10', read: false, time: new Date('2026-10-28T00:10:00Z') },
				{ _id: '661000000000000000000002', targetUserId: userId, message: 'Comment 2', link: '/community?postId=11', read: false, time: new Date('2026-10-28T00:11:00Z') },
				{ _id: '661000000000000000000003', targetUserId: userId, message: 'Comment 3', link: '/community?postId=12', read: false, time: new Date('2026-10-28T00:12:00Z') },
				{ _id: '661000000000000000000004', targetUserId: userId, message: 'Comment 4', link: '/community?postId=13', read: false, time: new Date('2026-10-28T00:13:00Z') },
				{ _id: '661000000000000000000005', targetUserId: otherUserId, message: 'Other user notif', link: '/community?postId=99', read: false, time: new Date('2026-10-28T00:14:00Z') },
			];
		});

		test('sequential calls to mark-read transition state from unread to read and remain idempotent', async () => {
			// First call: should mark all 4 as read
			const res1 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res1.status).toBe(200);
			expect(res1.body.markedReadCount).toBe(4);
			expect(res1.body.unreadCount).toBe(0);

			// Second call: already read, should return markedReadCount: 0
			const res2 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res2.status).toBe(200);
			expect(res2.body.markedReadCount).toBe(0);
			expect(res2.body.unreadCount).toBe(0);

			// Third call: still markedReadCount: 0
			const res3 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res3.status).toBe(200);
			expect(res3.body.markedReadCount).toBe(0);
			expect(res3.body.unreadCount).toBe(0);

			// Verify otherUserId's notification was NOT touched
			const otherNotif = inMemoryNotifs.find(n => n.targetUserId === otherUserId);
			expect(otherNotif.read).toBe(false);

			// Now add 1 new unread notification for userId
			inMemoryNotifs.push({
				_id: '661000000000000000000006',
				targetUserId: userId,
				message: 'New incoming comment',
				link: '/community?postId=20',
				read: false,
				time: new Date()
			});

			// Fourth call: marks newly arrived notification as read
			const res4 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res4.status).toBe(200);
			expect(res4.body.markedReadCount).toBe(1);
			expect(res4.body.unreadCount).toBe(0);

			// Fifth call: returns 0 again
			const res5 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res5.status).toBe(200);
			expect(res5.body.markedReadCount).toBe(0);
		});

		test('concurrent burst of 10 mark-read requests executes without race condition crashes', async () => {
			const promises = Array.from({ length: 10 }, () =>
				request(app)
					.put(`/api/forum/notifications/${userId}/read`)
					.set('Authorization', `Bearer ${userToken}`)
			);

			const results = await Promise.all(promises);
			for (const res of results) {
				expect(res.status).toBe(200);
				expect(res.body.success).toBe(true);
				expect(res.body.unreadCount).toBe(0);
			}

			// Sum of modifiedCount across all concurrent calls must equal exactly the 4 initial unread items
			const totalModified = results.reduce((sum, res) => sum + res.body.markedReadCount, 0);
			expect(totalModified).toBe(4);

			// All user's notifications in memory should now be read
			const userNotifs = inMemoryNotifs.filter(n => n.targetUserId === userId);
			expect(userNotifs.every(n => n.read === true)).toBe(true);
		});

		test('single mark-read on already-read notification remains idempotent and returns 200', async () => {
			const notifId = '661000000000000000000001';

			// First call: marks it read
			const res1 = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res1.status).toBe(200);
			expect(res1.body.notification.read).toBe(true);

			// Second call on the same notification: already read, should succeed smoothly
			const res2 = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(res2.status).toBe(200);
			expect(res2.body.notification.read).toBe(true);
		});
	});

	// =========================================================================
	// 4. Boundary Condition: Multiple Calls to Clear-All (Idempotency & State Transitions)
	// =========================================================================
	describe('4. Boundary Condition: Multiple Calls to Clear-All', () => {
		beforeEach(() => {
			inMemoryNotifs = [
				{ _id: '661000000000000000000001', targetUserId: userId, message: 'Msg 1', link: '/community?postId=1', read: true, time: new Date() },
				{ _id: '661000000000000000000002', targetUserId: userId, message: 'Msg 2', link: '/community?postId=2', read: false, time: new Date() },
				{ _id: '661000000000000000000003', targetUserId: userId, message: 'Msg 3', link: '/community?postId=3', read: false, time: new Date() },
				{ _id: '661000000000000000000099', targetUserId: otherUserId, message: 'Other user message', link: '/community?postId=99', read: false, time: new Date() },
			];
		});

		test('sequential calls to clear-all purge user records and subsequent calls return deletedCount: 0 cleanly', async () => {
			// First clear: deletes 3 notifications
			const res1 = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res1.status).toBe(200);
			expect(res1.body.deletedCount).toBe(3);

			// Second clear: 0 remaining
			const res2 = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res2.status).toBe(200);
			expect(res2.body.deletedCount).toBe(0);

			// Third clear: still 0
			const res3 = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res3.status).toBe(200);
			expect(res3.body.deletedCount).toBe(0);

			// Verify otherUserId's notifications were preserved
			expect(inMemoryNotifs.length).toBe(1);
			expect(inMemoryNotifs[0].targetUserId).toBe(otherUserId);
		});

		test('concurrent burst of 10 clear-all requests deletes items exactly once without crashing', async () => {
			const promises = Array.from({ length: 10 }, () =>
				request(app)
					.delete(`/api/forum/notifications/${userId}`)
					.set('Authorization', `Bearer ${userToken}`)
			);

			const results = await Promise.all(promises);
			for (const res of results) {
				expect(res.status).toBe(200);
				expect(res.body.success).toBe(true);
			}

			const totalDeleted = results.reduce((sum, res) => sum + res.body.deletedCount, 0);
			expect(totalDeleted).toBe(3);

			// Memory check: 0 user notifications left
			const remaining = inMemoryNotifs.filter(n => n.targetUserId === userId);
			expect(remaining).toHaveLength(0);
		});

		test('interleaving mark-read and clear-all operations maintains consistent state', async () => {
			// 1. Mark read on 2 unread items
			const markRes1 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(markRes1.status).toBe(200);
			expect(markRes1.body.markedReadCount).toBe(2);

			// 2. Clear all 3 items
			const clearRes1 = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(clearRes1.status).toBe(200);
			expect(clearRes1.body.deletedCount).toBe(3);

			// 3. Mark read after clear returns 0
			const markRes2 = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(markRes2.status).toBe(200);
			expect(markRes2.body.markedReadCount).toBe(0);

			// 4. Clear all again returns 0
			const clearRes2 = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(clearRes2.status).toBe(200);
			expect(clearRes2.body.deletedCount).toBe(0);

			// 5. Fetch notifications returns []
			const getRes = await request(app)
				.get(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(getRes.status).toBe(200);
			expect(getRes.body).toHaveLength(0);
		});
	});

	// =========================================================================
	// 5. Security & Malformed Input Boundary Attacks
	// =========================================================================
	describe('5. Security & Input Boundaries', () => {
		test.each([
			['empty string', '%20'],
			['short id', '12345'],
			['invalid hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
			['special characters', encodeURIComponent('!@#$%^&*()')],
			['null string', 'null'],
			['undefined string', 'undefined'],
		])('rejects invalid userId format "%s" with 400 on mark-read and clear-all', async (label, malformedId) => {
			const putRes = await request(app)
				.put(`/api/forum/notifications/${malformedId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(putRes.status).toBe(400);
			expect(putRes.body.message).toMatch(/invalid user id format/i);

			const delRes = await request(app)
				.delete(`/api/forum/notifications/${malformedId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(delRes.status).toBe(400);
			expect(delRes.body.message).toMatch(/invalid user id format/i);
		});

		test('user A cannot mark read or clear user B notifications (403 forbidden)', async () => {
			inMemoryNotifs = [
				{ _id: '661000000000000000000005', targetUserId: otherUserId, message: 'Private notif', link: '/community?postId=99', read: false, time: new Date() }
			];

			// User A tries to mark User B read
			const putRes = await request(app)
				.put(`/api/forum/notifications/${otherUserId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(putRes.status).toBe(403);
			expect(inMemoryNotifs[0].read).toBe(false);

			// User A tries to delete User B notifications
			const delRes = await request(app)
				.delete(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(delRes.status).toBe(403);
			expect(inMemoryNotifs).toHaveLength(1);
		});

		test('admin user can mark-read and clear-all on behalf of other users', async () => {
			inMemoryNotifs = [
				{ _id: '661000000000000000000005', targetUserId: otherUserId, message: 'User 2 notif', link: '/community?postId=99', read: false, time: new Date() }
			];

			// Admin marks otherUserId read
			const putRes = await request(app)
				.put(`/api/forum/notifications/${otherUserId}/read`)
				.set('Authorization', `Bearer ${adminToken}`);
			expect(putRes.status).toBe(200);
			expect(putRes.body.markedReadCount).toBe(1);
			expect(inMemoryNotifs[0].read).toBe(true);

			// Admin clears otherUserId notifications
			const delRes = await request(app)
				.delete(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${adminToken}`);
			expect(delRes.status).toBe(200);
			expect(delRes.body.deletedCount).toBe(1);
			expect(inMemoryNotifs).toHaveLength(0);
		});
	});

	// =========================================================================
	// 6. Socket Room Isolation & Event Payload Contracts
	// =========================================================================
	describe('6. Socket Room Isolation & Payload Verification', () => {
		test('socket events emit strictly to the target user room and never broadcast to other users', async () => {
			inMemoryNotifs = [
				{ _id: '661000000000000000000001', targetUserId: userId, message: 'Msg', link: '/community?postId=1', read: false, time: new Date() }
			];

			await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.to).not.toHaveBeenCalledWith(otherUserId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsMarkedRead', {
				userId,
				unreadCount: 0,
			});

			mockIo.to.mockClear();
			mockIo.emit.mockClear();

			await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.to).not.toHaveBeenCalledWith(otherUserId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsCleared', { userId });
		});
	});

	// =========================================================================
	// 7. Volume Pressure & Limit (30) Boundary Testing
	// =========================================================================
	describe('7. Volume Pressure & Sorting Boundary Testing', () => {
		test('GET /notifications/:userId limits results to 30 newest items when 50 exist in DB', async () => {
			inMemoryNotifs = Array.from({ length: 50 }, (_, i) => ({
				_id: new mongoose.Types.ObjectId().toString(),
				targetUserId: userId,
				message: `Notification #${i + 1}`,
				link: `/community?postId=${i + 1}`,
				read: i % 2 === 0,
				time: new Date(Date.now() - (50 - i) * 60000), // oldest is i=0, newest is i=49
			}));

			const res = await request(app)
				.get(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(30);

			// First item must be the newest (#50)
			expect(res.body[0].message).toBe('Notification #50');
			// 30th item must be #21
			expect(res.body[29].message).toBe('Notification #21');
		});
	});

	// =========================================================================
	// 8. Interleaved Race Condition Stress (Concurrent Mark-Read & Clear-All)
	// =========================================================================
	describe('8. Interleaved Race Condition Stress', () => {
		test('concurrent interleaved burst of mark-read and clear-all requests resolves deterministically', async () => {
			inMemoryNotifs = Array.from({ length: 20 }, (_, i) => ({
				_id: new mongoose.Types.ObjectId().toString(),
				targetUserId: userId,
				message: `Race item #${i + 1}`,
				link: `/community?postId=${i + 1}`,
				read: false,
				time: new Date(),
			}));

			const operations = [
				request(app).put(`/api/forum/notifications/${userId}/read`).set('Authorization', `Bearer ${userToken}`),
				request(app).delete(`/api/forum/notifications/${userId}`).set('Authorization', `Bearer ${userToken}`),
				request(app).put(`/api/forum/notifications/${userId}/read`).set('Authorization', `Bearer ${userToken}`),
				request(app).delete(`/api/forum/notifications/${userId}`).set('Authorization', `Bearer ${userToken}`),
			];

			const results = await Promise.all(operations);
			for (const res of results) {
				expect(res.status).toBe(200);
				expect(res.body.success).toBe(true);
			}

			// Final state: all cleared
			expect(inMemoryNotifs.filter(n => n.targetUserId === userId)).toHaveLength(0);
		});
	});

	// =========================================================================
	// 9. Graceful Degradation Without Sockets
	// =========================================================================
	describe('9. Graceful Degradation Without Sockets', () => {
		test('endpoints execute successfully when neither req.io nor app io is configured', async () => {
			const bareApp = express();
			bareApp.use(express.json());
			bareApp.use('/api/forum', forumRoutes);

			inMemoryNotifs = [
				{ _id: '661000000000000000000001', targetUserId: userId, message: 'No socket test', link: '/community?postId=1', read: false, time: new Date() }
			];

			const putRes = await request(bareApp)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(putRes.status).toBe(200);
			expect(putRes.body.markedReadCount).toBe(1);

			const delRes = await request(bareApp)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);
			expect(delRes.status).toBe(200);
			expect(delRes.body.deletedCount).toBe(1);
		});
	});
});

