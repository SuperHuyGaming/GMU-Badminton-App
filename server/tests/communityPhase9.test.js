const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');
const feedCache = require('../utils/feedCache');

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
const regularUserId = '660000000000000000000001';
const adminUserId = '660000000000000000000099';

const userToken = jwt.sign({ id: regularUserId, userId: regularUserId, role: 'user', name: 'Regular User' }, JWT_SECRET);
const adminToken = jwt.sign({ id: adminUserId, userId: adminUserId, role: 'admin', name: 'Admin Officer' }, JWT_SECRET);

const app = express();
app.use(express.json());

const mockIo = {
	emit: jest.fn(),
	to: jest.fn().mockReturnThis()
};

app.use((req, res, next) => {
	req.io = mockIo;
	next();
});
app.use('/api/forum', forumRoutes);

describe('Community Hub Phase 9: Admin Safety Dashboard, Moderation Queue & Feed Resolution', () => {
	const validPostId = '660000000000000000000111';
	const validFeedId = '660000000000000000000222';

	beforeEach(() => {
		jest.clearAllMocks();
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: regularUserId, name: 'Regular User', profilePic: 'user.jpg', role: 'user', badges: [] },
					{ _id: adminUserId, name: 'Admin Officer', profilePic: 'admin.jpg', role: 'admin', badges: ['admin'] }
				])
			})
		});
	});

	describe('1. ActivityFeed Fallback ID Resolution & Immediate Sync', () => {
		test('PUT /:postId/react succeeds when given an ActivityFeed _id by looking up referenceId', async () => {
			// Mock: Post.findById(validFeedId) is null, but ActivityFeed.findById(validFeedId) finds referenceId
			Post.findById.mockImplementation((id) => {
				if (id === validFeedId) return null;
				if (id === validPostId) {
					return {
						_id: validPostId,
						authorId: '660000000000000000000002',
						reactions: [],
						likedBy: [],
						toObject: () => ({ _id: validPostId, reactions: [{ userId: regularUserId, emoji: '💥', reactionType: 'smash' }] }),
						save: jest.fn().mockResolvedValue(true)
					};
				}
				return null;
			});

			ActivityFeed.findById.mockResolvedValue({
				_id: validFeedId,
				type: 'post',
				referenceId: validPostId
			});
			ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });

			const res = await request(app)
				.put(`/api/forum/${validFeedId}/react`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '💥' });

			expect(res.status).toBe(200);
			expect(ActivityFeed.findById).toHaveBeenCalledWith(validFeedId);
			expect(ActivityFeed.updateOne).toHaveBeenCalledWith(
				{ referenceId: validPostId },
				expect.objectContaining({
					$set: expect.objectContaining({
						reactions: expect.arrayContaining([
							expect.objectContaining({ emoji: '💥', userId: regularUserId })
						])
					})
				})
			);
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});

		test('PUT /:postId/like succeeds when given an ActivityFeed _id', async () => {
			Post.findById.mockImplementation((id) => {
				if (id === validFeedId) return null;
				if (id === validPostId) {
					return {
						_id: validPostId,
						authorId: '660000000000000000000002',
						likedBy: [],
						reactions: [],
						toObject: () => ({ _id: validPostId, likedBy: [regularUserId] }),
						save: jest.fn().mockResolvedValue(true)
					};
				}
				return null;
			});

			ActivityFeed.findById.mockResolvedValue({
				_id: validFeedId,
				type: 'post',
				referenceId: validPostId
			});
			ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });

			const res = await request(app)
				.put(`/api/forum/${validFeedId}/like`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ userName: 'Regular User' });

			expect(res.status).toBe(200);
			expect(ActivityFeed.findById).toHaveBeenCalledWith(validFeedId);
			expect(ActivityFeed.updateOne).toHaveBeenCalled();
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});
	});

	describe('2. Admin Moderation Queue Endpoints (GET /reports & PUT /reports/:postId/resolve)', () => {
		test('GET /api/forum/reports rejects non-admin users with 403 Forbidden', async () => {
			const res = await request(app)
				.get('/api/forum/reports')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/Admins only/i);
		});

		test('GET /api/forum/reports returns reported posts for admin token', async () => {
			Post.find.mockReturnValue({
				populate: jest.fn().mockReturnValue({
					sort: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([
							{
								_id: validPostId,
								title: 'Suspicious Offer',
								content: 'Free racket download link',
								status: 'active',
								isFlagged: false,
								reports: [{ reportedBy: { name: 'Player One' }, reason: 'Spam' }]
							}
						])
					})
				})
			});

			const res = await request(app)
				.get('/api/forum/reports')
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body.length).toBe(1);
			expect(res.body[0].title).toBe('Suspicious Offer');
		});

		test('PUT /api/forum/reports/:postId/resolve with "approve" dismisses reports and clears flag', async () => {
			const mockPost = {
				_id: validPostId,
				title: 'Reported Post',
				reports: [{ reason: 'Misunderstood joke' }],
				reportCount: 1,
				isFlagged: true,
				status: 'quarantined',
				save: jest.fn().mockResolvedValue(true),
				toObject: () => ({ _id: validPostId, title: 'Reported Post', isFlagged: false, status: 'active', reports: [] })
			};

			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/reports/${validPostId}/resolve`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ action: 'approve' });

			expect(res.status).toBe(200);
			expect(mockPost.status).toBe('active');
			expect(mockPost.isFlagged).toBe(false);
			expect(mockPost.reports).toEqual([]);
			expect(mockPost.save).toHaveBeenCalled();
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});

		test('PUT /api/forum/reports/:postId/resolve with "quarantine" moves post to quarantine and purges from ActivityFeed', async () => {
			const mockPost = {
				_id: validPostId,
				title: 'Offensive Post',
				isFlagged: false,
				status: 'active',
				save: jest.fn().mockResolvedValue(true)
			};

			Post.findById.mockResolvedValue(mockPost);
			ActivityFeed.deleteOne.mockResolvedValue({ deletedCount: 1 });

			const res = await request(app)
				.put(`/api/forum/reports/${validPostId}/resolve`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ action: 'quarantine' });

			expect(res.status).toBe(200);
			expect(mockPost.status).toBe('quarantined');
			expect(mockPost.isFlagged).toBe(true);
			expect(ActivityFeed.deleteOne).toHaveBeenCalledWith({ type: 'post', referenceId: validPostId });
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});

		test('PUT /api/forum/reports/:postId/resolve with "delete" soft-deletes post permanently', async () => {
			const mockPost = {
				_id: validPostId,
				title: 'Malicious Post',
				status: 'active',
				save: jest.fn().mockResolvedValue(true)
			};

			Post.findById.mockResolvedValue(mockPost);
			ActivityFeed.deleteOne.mockResolvedValue({ deletedCount: 1 });

			const res = await request(app)
				.put(`/api/forum/reports/${validPostId}/resolve`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ action: 'delete' });

			expect(res.status).toBe(200);
			expect(mockPost.status).toBe('deleted');
			expect(ActivityFeed.deleteOne).toHaveBeenCalledWith({ type: 'post', referenceId: validPostId });
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});
	});
});
