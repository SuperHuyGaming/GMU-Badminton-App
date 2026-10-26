const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const feedRoutes = require('../routes/feed');
const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');
const feedCache = require('../utils/feedCache');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
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
const userToken = jwt.sign({ id: userId, userId: userId, role: 'user', name: 'TestPlayer' }, JWT_SECRET);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
	req.io = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
	next();
});
app.use('/api/feed', feedRoutes);
app.use('/api/forum', forumRoutes);

describe('Community Hub Phase 5: Algorithmic Feed Tuning, Caching & Performance Architecture', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		feedCache.clear();
		feedCache.resetStats();

		ActivityFeed.find.mockReturnValue({
			sort: jest.fn().mockReturnValue({
				limit: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([])
				})
			})
		});

		User.findById.mockReturnValue({
			select: jest.fn().mockResolvedValue({
				_id: userId,
				name: 'TestPlayer',
				skillLevel: 'Intermediate',
				bookmarkedPosts: ['660000000000000000000099']
			}),
			lean: jest.fn().mockResolvedValue({
				_id: userId,
				name: 'TestPlayer',
				skillLevel: 'Intermediate',
				role: 'user',
				badges: [],
				stats: { winStreak: 2 }
			})
		});
	});

	describe('1. In-Memory Feed Cache Tier & ETag Optimization', () => {
		test('generates md5 ETag and stores cache entries with TTL', () => {
			const sampleData = { feed: [{ _id: '123', title: 'Test Post' }] };
			const etag = feedCache.set('test:key', sampleData, 30);
			expect(etag).toMatch(/^W\/"[a-f0-9]{32}"$/);

			const cached = feedCache.get('test:key');
			expect(cached).not.toBeNull();
			expect(cached.data).toEqual(sampleData);
			expect(cached.etag).toBe(etag);

			const stats = feedCache.getStats();
			expect(stats.hits).toBe(1);
			expect(stats.misses).toBe(0);
		});

		test('returns X-Feed-Cache: MISS on cold request, and X-Feed-Cache: HIT on warm request', async () => {
			const mockFeedItems = [
				{ _id: new mongoose.Types.ObjectId(), title: 'Cold Smash Rally', score: 10 }
			];
			ActivityFeed.aggregate.mockResolvedValue(mockFeedItems);

			// First request: Cold (MISS)
			const res1 = await request(app)
				.get('/api/feed?tab=top')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res1.status).toBe(200);
			expect(res1.headers['x-feed-cache']).toBe('MISS');
			const etag = res1.headers['etag'];
			expect(etag).toBeDefined();

			// Second request: Warm (HIT)
			const res2 = await request(app)
				.get('/api/feed?tab=top')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res2.status).toBe(200);
			expect(res2.headers['x-feed-cache']).toBe('HIT');
			expect(res2.headers['etag']).toBe(etag);
			expect(ActivityFeed.aggregate).toHaveBeenCalledTimes(1);
		});

		test('returns HTTP 304 Not Modified when client provides matching If-None-Match header', async () => {
			const mockFeedItems = [
				{ _id: new mongoose.Types.ObjectId(), title: 'Static Feed Item', score: 5 }
			];
			ActivityFeed.aggregate.mockResolvedValue(mockFeedItems);

			const res1 = await request(app)
				.get('/api/feed?tab=latest')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res1.status).toBe(200);
			const etag = res1.headers['etag'];

			// Subsequent request with matching ETag
			const res304 = await request(app)
				.get('/api/feed?tab=latest')
				.set('Authorization', `Bearer ${userToken}`)
				.set('If-None-Match', etag);

			expect(res304.status).toBe(304);
			expect(res304.text).toBe('');
		});

		test('invalidates cache when invalidateFeed is triggered', () => {
			feedCache.set('feed:user1:top:root', { feed: [] }, 30);
			feedCache.set('trending_tags', { tags: [] }, 120);
			feedCache.set('other:namespace', { data: 123 }, 30);

			expect(feedCache.get('feed:user1:top:root')).not.toBeNull();
			expect(feedCache.get('trending_tags')).not.toBeNull();

			const invalidatedCount = feedCache.invalidateFeed();
			expect(invalidatedCount).toBe(2);

			expect(feedCache.get('feed:user1:top:root')).toBeNull();
			expect(feedCache.get('trending_tags')).toBeNull();
			expect(feedCache.get('other:namespace')).not.toBeNull();
		});
	});

	describe('2. Trending Tags Aggregation Pipeline', () => {
		test('returns top 10 trending tags sorted by popularity from /api/feed/trending-tags', async () => {
			const mockAggregatedTags = [
				{ tag: 'badminton', count: 15 },
				{ tag: 'racquet', count: 9 },
				{ tag: 'yonex', count: 6 },
			];
			ActivityFeed.aggregate.mockResolvedValue(mockAggregatedTags);

			const res = await request(app).get('/api/feed/trending-tags');
			expect(res.status).toBe(200);
			expect(res.body.tags).toBeDefined();
			expect(res.body.tags.length).toBe(3);
			expect(res.body.tags[0]).toEqual({ tag: 'badminton', count: 15 });
			expect(res.headers['x-feed-cache']).toBe('MISS');

			// Second request should HIT cache
			const res2 = await request(app).get('/api/feed/trending-tags');
			expect(res2.status).toBe(200);
			expect(res2.headers['x-feed-cache']).toBe('HIT');
		});

		test('returns trending tags via /api/forum/trending-tags with parity', async () => {
			const mockTags = [{ tag: 'training', count: 8 }, { tag: 'doubles', count: 5 }];
			Post.aggregate.mockResolvedValue(mockTags);

			const res = await request(app).get('/api/forum/trending-tags');
			expect(res.status).toBe(200);
			expect(res.body.tags).toEqual(mockTags);
		});
	});

	describe('3. Algorithmic Feed Tuning & Invariant Protection', () => {
		test('excludes quarantined and flagged posts from feed queries', async () => {
			ActivityFeed.aggregate.mockResolvedValue([]);

			await request(app)
				.get('/api/feed?tab=foryou')
				.set('Authorization', `Bearer ${userToken}`);

			expect(ActivityFeed.aggregate).toHaveBeenCalled();
			const pipeline = ActivityFeed.aggregate.mock.calls[0][0];
			const matchStage = pipeline[0].$match;

			expect(matchStage.status).toEqual({ $nin: ['quarantined', 'deleted'] });
			expect(matchStage.isFlagged).toEqual({ $ne: true });
		});

		test('passes discoveryBoost and time decay calculation in aggregation pipeline', async () => {
			ActivityFeed.aggregate.mockResolvedValue([]);

			await request(app)
				.get('/api/feed?tab=foryou')
				.set('Authorization', `Bearer ${userToken}`);

			const pipeline = ActivityFeed.aggregate.mock.calls[0][0];

			// Inspect pipeline stages for ageInHours, safeAgeInHours, discoveryBoost, and velocityScore
			const addAgeStage = pipeline.find(stage => stage.$addFields && stage.$addFields.ageInHours);
			expect(addAgeStage).toBeDefined();

			const addBoostStage = pipeline.find(stage => stage.$addFields && stage.$addFields.discoveryBoost);
			expect(addBoostStage).toBeDefined();

			const addVelocityStage = pipeline.find(stage => stage.$addFields && stage.$addFields.velocityScore);
			expect(addVelocityStage).toBeDefined();
		});

		test('handles saved tab and queries bookmarked posts from User document', async () => {
			const bookmarkedId = '660000000000000000000099';
			const mockSavedItems = [
				{ _id: new mongoose.Types.ObjectId(), referenceId: bookmarkedId, title: 'My Bookmarked Post' }
			];

			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue(mockSavedItems)
					})
				})
			});

			const res = await request(app)
				.get('/api/feed?tab=saved')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.feed.length).toBe(1);
			expect(res.body.bookmarkedPosts).toContain(bookmarkedId);
		});

		test('rejects invalid cursor format with 400 Bad Request', async () => {
			const res = await request(app)
				.get('/api/feed?tab=foryou&cursor=invalid-cursor-id')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid cursor/i);
		});
	});
});
