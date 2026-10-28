const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const Notification = require('../models/Notification');
const forumRoutes = require('../routes/forum');

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

const userToken = jwt.sign({ id: userId, userId, role: 'user', name: 'StandardUser' }, JWT_SECRET);
const otherUserToken = jwt.sign({ id: otherUserId, userId: otherUserId, role: 'user', name: 'OtherUser' }, JWT_SECRET);
const adminToken = jwt.sign({ id: adminId, userId: adminId, role: 'admin', name: 'AdminUser' }, JWT_SECRET);

describe('Backend Notification Foundation & Real-Time Sockets (M1)', () => {
	let app;
	let mockIo;

	beforeEach(() => {
		jest.clearAllMocks();

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
	});

	describe('Compound Indexes & Model Integrity', () => {
		test('Notification model defines compound indexes for performance', () => {
			const actualNotification = jest.requireActual('../models/Notification');
			const indexes = actualNotification.schema.indexes();

			const hasTargetTimeIndex = indexes.some(
				([fields]) => fields.targetUserId === 1 && fields.time === -1
			);
			const hasTargetReadIndex = indexes.some(
				([fields]) => fields.targetUserId === 1 && fields.read === 1
			);

			expect(hasTargetTimeIndex).toBe(true);
			expect(hasTargetReadIndex).toBe(true);
		});
	});

	describe('GET /api/forum/notifications/:userId', () => {
		test('returns 401 when unauthenticated (no token)', async () => {
			const res = await request(app).get(`/api/forum/notifications/${userId}`);
			expect(res.status).toBe(401);
		});

		test('returns 400 when user ID format is invalid', async () => {
			const res = await request(app)
				.get('/api/forum/notifications/invalid-object-id')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid user id format/i);
		});

		test('returns 403 when non-admin accesses another user\'s notifications', async () => {
			const res = await request(app)
				.get(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/unauthorized/i);
		});

		test('returns 200 with sorted notifications for the authenticated user', async () => {
			const mockNotifications = [
				{
					_id: '661000000000000000000001',
					targetUserId: userId,
					message: 'Alice commented on your post',
					link: '/community?postId=660000000000000000000010',
					read: false,
					time: new Date('2026-10-28T00:30:00Z'),
				},
				{
					_id: '661000000000000000000002',
					targetUserId: userId,
					message: 'Bob liked your reply',
					link: '/community?postId=660000000000000000000010&highlight=661000000000000000000020',
					read: true,
					time: new Date('2026-10-28T00:20:00Z'),
				},
			];

			const limitMock = jest.fn().mockResolvedValue(mockNotifications);
			const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
			Notification.find.mockReturnValue({ sort: sortMock });

			const res = await request(app)
				.get(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body).toHaveLength(2);
			expect(res.body[0].message).toBe('Alice commented on your post');
			expect(Notification.find).toHaveBeenCalledWith({ targetUserId: userId });
			expect(sortMock).toHaveBeenCalledWith({ time: -1 });
			expect(limitMock).toHaveBeenCalledWith(30);
		});

		test('allows admin to fetch any user\'s notifications', async () => {
			const limitMock = jest.fn().mockResolvedValue([]);
			const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
			Notification.find.mockReturnValue({ sort: sortMock });

			const res = await request(app)
				.get(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(Notification.find).toHaveBeenCalledWith({ targetUserId: otherUserId });
		});

		test('returns 500 when database query throws an error', async () => {
			Notification.find.mockImplementation(() => {
				throw new Error('Database connection failed');
			});

			const res = await request(app)
				.get(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(500);
			expect(res.body.message).toMatch(/error fetching notifications/i);
		});
	});

	describe('PUT /api/forum/notifications/:userId/read', () => {
		test('returns 401 when unauthenticated', async () => {
			const res = await request(app).put(`/api/forum/notifications/${userId}/read`);
			expect(res.status).toBe(401);
		});

		test('returns 400 when user ID format is invalid', async () => {
			const res = await request(app)
				.put('/api/forum/notifications/invalid-id/read')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid user id format/i);
		});

		test('returns 403 when non-admin attempts to mark another user\'s notifications read', async () => {
			const res = await request(app)
				.put(`/api/forum/notifications/${otherUserId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/unauthorized/i);
			expect(Notification.updateMany).not.toHaveBeenCalled();
			expect(mockIo.emit).not.toHaveBeenCalled();
		});

		test('marks all unread as read, emits notificationsMarkedRead socket, and returns counts', async () => {
			Notification.updateMany.mockResolvedValue({
				acknowledged: true,
				modifiedCount: 4,
			});

			const res = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				success: true,
				markedReadCount: 4,
				unreadCount: 0,
			});

			expect(Notification.updateMany).toHaveBeenCalledWith(
				{ targetUserId: userId, read: false },
				{ read: true }
			);

			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsMarkedRead', {
				userId,
				unreadCount: 0,
			});
		});

		test('handles zero unread notifications gracefully (modifiedCount = 0)', async () => {
			Notification.updateMany.mockResolvedValue({
				acknowledged: true,
				modifiedCount: 0,
			});

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

		test('allows admin to mark another user\'s notifications as read', async () => {
			Notification.updateMany.mockResolvedValue({
				acknowledged: true,
				modifiedCount: 2,
			});

			const res = await request(app)
				.put(`/api/forum/notifications/${otherUserId}/read`)
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.markedReadCount).toBe(2);
			expect(mockIo.to).toHaveBeenCalledWith(otherUserId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsMarkedRead', {
				userId: otherUserId,
				unreadCount: 0,
			});
		});

		test('returns 500 when updateMany throws an error', async () => {
			Notification.updateMany.mockRejectedValue(new Error('Update failed'));

			const res = await request(app)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(500);
			expect(res.body.message).toMatch(/error updating notifications/i);
		});
	});

	describe('DELETE /api/forum/notifications/:userId', () => {
		test('returns 401 when unauthenticated', async () => {
			const res = await request(app).delete(`/api/forum/notifications/${userId}`);
			expect(res.status).toBe(401);
		});

		test('returns 400 when user ID format is invalid', async () => {
			const res = await request(app)
				.delete('/api/forum/notifications/invalid-id')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid user id format/i);
		});

		test('returns 403 when non-admin attempts to clear another user\'s notifications', async () => {
			const res = await request(app)
				.delete(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/unauthorized/i);
			expect(Notification.deleteMany).not.toHaveBeenCalled();
			expect(mockIo.emit).not.toHaveBeenCalled();
		});

		test('deletes all user notifications, emits notificationsCleared socket, and returns deletedCount', async () => {
			Notification.deleteMany.mockResolvedValue({
				acknowledged: true,
				deletedCount: 7,
			});

			const res = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				success: true,
				message: 'All notifications cleared.',
				deletedCount: 7,
			});

			expect(Notification.deleteMany).toHaveBeenCalledWith({ targetUserId: userId });
			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsCleared', { userId });
		});

		test('handles zero notifications cleared gracefully (deletedCount = 0)', async () => {
			Notification.deleteMany.mockResolvedValue({
				acknowledged: true,
				deletedCount: 0,
			});

			const res = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.deletedCount).toBe(0);
			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsCleared', { userId });
		});

		test('allows admin to clear notifications for any user', async () => {
			Notification.deleteMany.mockResolvedValue({
				acknowledged: true,
				deletedCount: 3,
			});

			const res = await request(app)
				.delete(`/api/forum/notifications/${otherUserId}`)
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.deletedCount).toBe(3);
			expect(mockIo.to).toHaveBeenCalledWith(otherUserId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsCleared', { userId: otherUserId });
		});

		test('returns 500 when deleteMany throws an error', async () => {
			Notification.deleteMany.mockRejectedValue(new Error('Delete error'));

			const res = await request(app)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(500);
			expect(res.body.message).toMatch(/error clearing notifications/i);
		});
	});

	describe('PUT /api/forum/notifications/single/:notifId/read', () => {
		const notifId = '661000000000000000000005';

		test('returns 401 when unauthenticated', async () => {
			const res = await request(app).put(`/api/forum/notifications/single/${notifId}/read`);
			expect(res.status).toBe(401);
		});

		test('returns 400 when notification ID format is invalid', async () => {
			const res = await request(app)
				.put('/api/forum/notifications/single/invalid-notif-id/read')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid notification id format/i);
		});

		test('returns 404 when notification does not exist', async () => {
			Notification.findById.mockResolvedValue(null);

			const res = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(404);
			expect(res.body.message).toMatch(/notification not found/i);
		});

		test('returns 403 when user attempts to mark another user\'s single notification read', async () => {
			const mockNotif = {
				_id: notifId,
				targetUserId: otherUserId,
				read: false,
				save: jest.fn(),
			};
			Notification.findById.mockResolvedValue(mockNotif);

			const res = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/unauthorized/i);
			expect(mockNotif.save).not.toHaveBeenCalled();
			expect(mockIo.emit).not.toHaveBeenCalled();
		});

		test('marks single notification as read, emits notificationRead socket, and returns notification', async () => {
			const mockNotif = {
				_id: notifId,
				targetUserId: userId,
				message: 'Match request accepted',
				read: false,
				save: jest.fn().mockResolvedValue(true),
			};
			Notification.findById.mockResolvedValue(mockNotif);

			const res = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(mockNotif.read).toBe(true);
			expect(mockNotif.save).toHaveBeenCalled();
			expect(res.body.success).toBe(true);
			expect(res.body.notification._id).toBe(notifId);

			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationRead', {
				notifId,
				read: true,
			});
		});

		test('allows admin to mark single notification read for any user', async () => {
			const mockNotif = {
				_id: notifId,
				targetUserId: otherUserId,
				read: false,
				save: jest.fn().mockResolvedValue(true),
			};
			Notification.findById.mockResolvedValue(mockNotif);

			const res = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(mockNotif.read).toBe(true);
			expect(mockIo.to).toHaveBeenCalledWith(otherUserId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationRead', {
				notifId,
				read: true,
			});
		});

		test('returns 500 when save throws an error', async () => {
			const mockNotif = {
				_id: notifId,
				targetUserId: userId,
				read: false,
				save: jest.fn().mockRejectedValue(new Error('Save failed')),
			};
			Notification.findById.mockResolvedValue(mockNotif);

			const res = await request(app)
				.put(`/api/forum/notifications/single/${notifId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(500);
			expect(res.body.message).toMatch(/error updating notification/i);
		});
	});

	describe('Socket Fallback Handling', () => {
		test('falls back to req.app.get("io") when req.io is not directly attached', async () => {
			const fallbackApp = express();
			fallbackApp.use(express.json());
			fallbackApp.set('io', mockIo);
			// Do NOT attach req.io to request middleware
			fallbackApp.use('/api/forum', forumRoutes);

			Notification.updateMany.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

			const res = await request(fallbackApp)
				.put(`/api/forum/notifications/${userId}/read`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(mockIo.to).toHaveBeenCalledWith(userId);
			expect(mockIo.emit).toHaveBeenCalledWith('notificationsMarkedRead', {
				userId,
				unreadCount: 0,
			});
		});

		test('does not throw when neither req.io nor app io is configured', async () => {
			const noSocketApp = express();
			noSocketApp.use(express.json());
			noSocketApp.use('/api/forum', forumRoutes);

			Notification.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 2 });

			const res = await request(noSocketApp)
				.delete(`/api/forum/notifications/${userId}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.deletedCount).toBe(2);
		});
	});
});
