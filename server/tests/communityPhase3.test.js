const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const feedRoutes = require('../routes/feed');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');
const { parseDateRange } = require('../utils/dateRange');

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
app.use('/api/forum', forumRoutes);
app.use('/api/feed', feedRoutes);

describe('Community Hub Phase 3: Search Engine, Category Groups, and Date Range Filter', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		User.findById.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({
					_id: userId,
					name: 'TestPlayer',
					skillLevel: 'Intermediate',
					bookmarkedPosts: []
				})
			}),
			lean: jest.fn().mockResolvedValue({
				_id: userId,
				name: 'TestPlayer',
				skillLevel: 'Intermediate',
				bookmarkedPosts: []
			})
		});
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: userId, name: 'TestPlayer', profilePic: 'pic.png' }
				])
			})
		});
	});

	// ==========================================
	// 1. DATE RANGE ENGINE UNIT TESTS
	// ==========================================
	describe('1. Date Range Engine (parseDateRange)', () => {
		it('returns null bounds when no query is passed, empty object, null, or undefined', () => {
			expect(parseDateRange({})).toEqual({ start: null, end: null });
			expect(parseDateRange(null)).toEqual({ start: null, end: null });
			expect(parseDateRange(undefined)).toEqual({ start: null, end: null });
		});

		it('parses "today" as start of day (00:00:00) to end of day (23:59:59.999)', () => {
			const res = parseDateRange({ dateRange: 'today' });
			expect(res.start).toBeInstanceOf(Date);
			expect(res.end).toBeInstanceOf(Date);
			expect(res.start.getHours()).toBe(0);
			expect(res.start.getMinutes()).toBe(0);
			expect(res.start.getSeconds()).toBe(0);
			expect(res.end.getHours()).toBe(23);
			expect(res.end.getMinutes()).toBe(59);
			expect(res.end.getSeconds()).toBe(59);
			expect(res.end.getTime()).toBeGreaterThan(res.start.getTime());
		});

		it('parses "week" / "this_week" covering full 7-day range', () => {
			const res = parseDateRange({ dateRange: 'this_week' });
			expect(res.start).toBeInstanceOf(Date);
			expect(res.end).toBeInstanceOf(Date);
			const diffDays = Math.round((res.end - res.start) / (1000 * 60 * 60 * 24));
			expect(diffDays).toBe(7);
		});

		it('parses "month" covering the entire current month', () => {
			const res = parseDateRange({ dateRange: 'month' });
			expect(res.start).toBeInstanceOf(Date);
			expect(res.end).toBeInstanceOf(Date);
			expect(res.start.getDate()).toBe(1);
			expect(res.end.getHours()).toBe(23);
		});

		it('parses custom startDate and endDate strings', () => {
			const res = parseDateRange({ startDate: '2026-10-01', endDate: '2026-10-15' });
			expect(res.start).toBeInstanceOf(Date);
			expect(res.end).toBeInstanceOf(Date);
			expect(res.start.getFullYear()).toBe(2026);
			expect(res.start.getMonth()).toBe(9); // 0-indexed: October is 9
			expect(res.start.getDate()).toBe(1);
			expect(res.end.getDate()).toBe(15);
			expect(res.end.getHours()).toBe(23);
			expect(res.end.getMinutes()).toBe(59);
		});

		it('gracefully handles invalid custom date formats', () => {
			const res = parseDateRange({ startDate: 'not-a-date', endDate: 'invalid' });
			expect(res.start).toBeNull();
			expect(res.end).toBeNull();
		});

		it('auto-corrects inverted custom date ranges and preserves day boundaries', () => {
			const res = parseDateRange({ startDate: '2026-10-25', endDate: '2026-10-15' });
			expect(res.start).toBeInstanceOf(Date);
			expect(res.end).toBeInstanceOf(Date);
			expect(res.start.getDate()).toBe(15);
			expect(res.end.getDate()).toBe(25);
			expect(res.start.getHours()).toBe(0);
			expect(res.end.getHours()).toBe(23);
			expect(res.end.getTime()).toBeGreaterThan(res.start.getTime());
		});

		it('normalizes custom endDate strings without time to end of day', () => {
			const res = parseDateRange({ endDate: '10/25/2026' });
			expect(res.end).toBeInstanceOf(Date);
			expect(res.end.getHours()).toBe(23);
			expect(res.end.getMinutes()).toBe(59);
		});

		it('supports Date objects and numeric timestamps as custom bounds', () => {
			const startDateObj = new Date(2026, 9, 1, 0, 0, 0);
			const endDateObj = new Date(2026, 9, 15, 23, 59, 59);
			const resDates = parseDateRange({ startDate: startDateObj, endDate: endDateObj });
			expect(resDates.start).toBeInstanceOf(Date);
			expect(resDates.end).toBeInstanceOf(Date);
			expect(resDates.start.getTime()).toBe(startDateObj.getTime());
			expect(resDates.end.getTime()).toBe(endDateObj.getTime());

			const resNum = parseDateRange({ from: startDateObj.getTime(), to: endDateObj.getTime() });
			expect(resNum.start).toBeInstanceOf(Date);
			expect(resNum.end).toBeInstanceOf(Date);
			expect(resNum.start.getTime()).toBe(startDateObj.getTime());
		});

		it('supports direct string input and array dateRange parameters', () => {
			const resStr = parseDateRange('today');
			expect(resStr.start).toBeInstanceOf(Date);
			expect(resStr.end).toBeInstanceOf(Date);
			expect(resStr.start.getHours()).toBe(0);

			const resArr = parseDateRange({ dateRange: ['this_week', 'month'] });
			expect(resArr.start).toBeInstanceOf(Date);
			expect(resArr.end).toBeInstanceOf(Date);
		});
	});

	// ==========================================
	// 2. FORUM ROUTE FILTERING (GET /api/forum)
	// ==========================================
	describe('2. Forum Route Filtering (GET /api/forum)', () => {
		const mockChain = (results = [], total = 0) => {
			const chain = {
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue(results)
			};
			Post.find.mockReturnValue(chain);
			Post.countDocuments.mockResolvedValue(total);
			return chain;
		};

		it('filters by category aliases for find_partner', async () => {
			mockChain([{ _id: 'p1', title: 'Need 1 for Doubles', category: 'find_partner' }], 1);

			const res = await request(app).get('/api/forum?category=find_partner');
			expect(res.status).toBe(200);

			expect(Post.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: { $in: ['find_partner', 'meetup_rally'] }
				})
			);
		});

		it('filters by category aliases for gear_exchange', async () => {
			mockChain([{ _id: 'p2', title: 'Yonex 100ZZ', category: 'gear_exchange' }], 1);

			const res = await request(app).get('/api/forum?category=gear_exchange');
			expect(res.status).toBe(200);

			expect(Post.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: { $in: ['gear_exchange', 'gear_review'] }
				})
			);
		});

		it('filters by specific phase 2 categories like challenge_match and qa_forum', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum?category=challenge_match');
			expect(Post.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: 'challenge_match'
				})
			);

			await request(app).get('/api/forum?category=qa_forum');
			expect(Post.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: 'qa_forum'
				})
			);
		});

		it('does not filter by category when category=all', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum?category=all');
			const callArg = Post.find.mock.calls[0][0];
			expect(callArg.category).toBeUndefined();
		});

		it('applies search across title, content, author, court, and tags', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum?search=RACQUET');
			const callArg = Post.find.mock.calls[0][0];
			expect(callArg.$or).toBeDefined();
			expect(callArg.$or).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ title: { $regex: expect.any(RegExp) } }),
					expect.objectContaining({ content: { $regex: expect.any(RegExp) } }),
					expect.objectContaining({ authorName: { $regex: expect.any(RegExp) } }),
					expect.objectContaining({ tags: expect.any(RegExp) }),
					expect.objectContaining({ 'matchDetails.court': { $regex: expect.any(RegExp) } }),
					expect.objectContaining({ 'playerMatchmaking.preferredCourt': { $regex: expect.any(RegExp) } })
				])
			);
		});

		it('escapes regex special characters safely in search parameter', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum').query({ search: '[Court+1] (test)' });
			expect(Post.find).toHaveBeenCalled();
			const callArg = Post.find.mock.calls[0][0];
			expect(callArg.$or[0].title.$regex.source).toContain('\\[Court\\+1\\] \\(test\\)');
		});

		it('applies dateRange filter to createdAt', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum?dateRange=today');
			const callArg = Post.find.mock.calls[0][0];
			expect(callArg.createdAt).toBeDefined();
			expect(callArg.createdAt.$gte).toBeInstanceOf(Date);
			expect(callArg.createdAt.$lte).toBeInstanceOf(Date);
		});

		it('supports combined search, category, and dateRange', async () => {
			mockChain([], 0);

			await request(app).get('/api/forum?search=doubles&category=find_partner&dateRange=today');
			const callArg = Post.find.mock.calls[0][0];
			expect(callArg.category).toEqual({ $in: ['find_partner', 'meetup_rally'] });
			expect(callArg.$or).toBeDefined();
			expect(callArg.createdAt.$gte).toBeInstanceOf(Date);
		});
	});

	// ==========================================
	// 3. ACTIVITY FEED FILTERING (GET /api/feed)
	// ==========================================
	describe('3. Activity Feed Route Filtering (GET /api/feed)', () => {
		it('applies category filter with find_partner alias in latest feed', async () => {
			const mockFeedItem = {
				_id: new mongoose.Types.ObjectId(),
				type: 'post',
				category: 'find_partner',
				title: 'Doubles Rally Partner Needed',
				createdAt: new Date()
			};
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([mockFeedItem])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&category=find_partner')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.feed).toHaveLength(1);
			expect(ActivityFeed.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: { $in: ['find_partner', 'meetup_rally'] }
				})
			);
		});

		it('applies category filter with gear_exchange alias in latest feed', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&category=gear_exchange')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(ActivityFeed.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: { $in: ['gear_exchange', 'gear_review'] }
				})
			);
		});

		it('combines visibility and search regex under $and in feed matchStage', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&search=smash')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			expect(matchStage.$and).toBeDefined();
			expect(matchStage.$and).toHaveLength(2);
			// First item in $and is visibility $or
			expect(matchStage.$and[0].$or).toBeDefined();
			// Second item in $and is search $or
			expect(matchStage.$and[1].$or).toBeDefined();
			expect(matchStage.$and[1].$or).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ title: { $regex: expect.any(RegExp) } }),
					expect.objectContaining({ content: { $regex: expect.any(RegExp) } })
				])
			);
		});

		it('applies dateRange query to matchStage.createdAt in feed', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&dateRange=week')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			expect(matchStage.createdAt).toBeDefined();
			expect(matchStage.createdAt.$gte).toBeInstanceOf(Date);
			expect(matchStage.createdAt.$lte).toBeInstanceOf(Date);
		});

		it('passes filters into velocity ranking pipeline for foryou tab', async () => {
			ActivityFeed.aggregate.mockResolvedValue([
				{
					_id: new mongoose.Types.ObjectId(),
					title: 'Ranked Post',
					category: 'qa_forum',
					createdAt: new Date(),
					velocityScore: 10
				}
			]);

			const res = await request(app)
				.get('/api/feed?tab=foryou&category=qa_forum&search=grip')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(ActivityFeed.aggregate).toHaveBeenCalled();
			const pipeline = ActivityFeed.aggregate.mock.calls[0][0];
			const matchStep = pipeline.find(stage => stage.$match);
			expect(matchStep).toBeDefined();
			expect(matchStep.$match.category).toBe('qa_forum');
			expect(matchStep.$match.$and).toBeDefined();
		});

		it('filters by match_result category matching both category and type match', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&category=match_result')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			expect(matchStage.$and).toBeDefined();
			const matchResultClause = matchStage.$and.find(c => c.$or && c.$or.some(o => o.category === 'match_result'));
			expect(matchResultClause).toBeDefined();
			expect(matchResultClause.$or).toEqual(
				expect.arrayContaining([
					{ category: 'match_result' },
					{ type: 'match' }
				])
			);
		});

		it('excludes type match from general category filter', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&category=general')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			expect(matchStage.category).toBe('general');
			expect(matchStage.type).toEqual({ $ne: 'match' });
		});

		it('includes team1, team2, partner, and opponents in feed search regex', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&search=Alex')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			const searchClause = matchStage.$and.find(c => c.$or && c.$or.some(o => o.team1));
			expect(searchClause).toBeDefined();
			expect(searchClause.$or.some(o => o['matchDetails.partner'])).toBe(true);
			expect(searchClause.$or.some(o => o['matchDetails.opponents'])).toBe(true);
		});

		it('safely handles search query with special characters and trailing backslash', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			// 99 chars + trailing backslash: previously would break regex when sliced after escaping
			const dangerousSearch = 'a'.repeat(99) + '\\';
			const res = await request(app)
				.get(`/api/feed?tab=latest&search=${encodeURIComponent(dangerousSearch)}`)
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
		});

		it('searches by gearDetails.brand and gearDetails.gearType in feed and forum routes', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			const res = await request(app)
				.get('/api/feed?tab=latest&search=Yonex')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			const matchStage = ActivityFeed.find.mock.calls[0][0];
			const searchClause = matchStage.$and.find(c => c.$or && c.$or.some(o => o['gearDetails.brand']));
			expect(searchClause).toBeDefined();
			expect(searchClause.$or.some(o => o['gearDetails.gearType'])).toBe(true);

			// Check forum route as well
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});
			const forumRes = await request(app)
				.get('/api/forum?search=Yonex')
				.set('Authorization', `Bearer ${userToken}`);
			expect(forumRes.status).toBe(200);
			const forumQuery = Post.find.mock.calls[0][0];
			expect(forumQuery.$or.some(o => o['gearDetails.brand'])).toBe(true);
		});

		it('safely handles non-string search parameters without crashing with TypeError', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});

			// Object parameter: search[foo]=bar
			const resObj = await request(app)
				.get('/api/feed?tab=latest&search[foo]=bar')
				.set('Authorization', `Bearer ${userToken}`);
			expect(resObj.status).toBe(200);

			// Duplicate query param (array): search=first&search=second
			const resArr = await request(app)
				.get('/api/feed?tab=latest&search=first&search=second')
				.set('Authorization', `Bearer ${userToken}`);
			expect(resArr.status).toBe(200);

			// Forum route with object query param
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue([])
			});
			const resForumObj = await request(app)
				.get('/api/forum?search[foo]=bar')
				.set('Authorization', `Bearer ${userToken}`);
			expect(resForumObj.status).toBe(200);
		});
	});
});
