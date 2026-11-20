const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const sift = require('sift');

const feedRoutes = require('../routes/feed');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');

jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"etag-test"'),
	clear: jest.fn(),
	invalidateFeed: jest.fn()
}));
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue()
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';

const authorId = '660000000000000000000001';
const friendId = '660000000000000000000002';
const strangerId = '660000000000000000000003';

const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'AuthorPlayer' }, JWT_SECRET);
const tokenFriend = jwt.sign({ id: friendId, userId: friendId, role: 'user', name: 'FriendPlayer' }, JWT_SECRET);
const tokenStranger = jwt.sign({ id: strangerId, userId: strangerId, role: 'user', name: 'StrangerPlayer' }, JWT_SECRET);

const app = express();
app.use(express.json());
app.use('/api/feed', feedRoutes);

// Plain JS function copied directly from client/src/pages/Forum.jsx line ~61
const matchesCategory = (item, cat) => {
	if (!cat || cat === 'all') return true;
	const itemCat = item.category || (item.type === 'match' ? 'match_result' : 'general');
	if (cat === 'find_partner') return itemCat === 'find_partner' || itemCat === 'meetup_rally' || itemCat === 'challenge_match';
	if (cat === 'gear_exchange') return itemCat === 'gear_exchange' || itemCat === 'gear_review';
	if (cat === 'general') return itemCat === 'general' || itemCat === 'qa_forum' || itemCat === 'training' || itemCat === 'match_result';
	return itemCat === cat;
};

const makeId = (n) => `660000000000000000000${String(n).padStart(3, '0')}`;
const authorObjId = new mongoose.Types.ObjectId(authorId);

const seedPosts = [
	// Categorized posts for every category
	{ _id: makeId(1), title: 'Find Partner Post', category: 'find_partner', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(2), title: 'Meetup Rally Post', category: 'meetup_rally', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(3), title: 'Challenge Match Post', category: 'challenge_match', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(4), title: 'Gear Exchange Post', category: 'gear_exchange', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(5), title: 'Gear Review Post', category: 'gear_review', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(6), title: 'General Forum Post', category: 'general', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(7), title: 'QA Forum Post', category: 'qa_forum', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(8), title: 'Training Post', category: 'training', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(9), title: 'Match Result Post', category: 'match_result', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(10), title: 'Custom Announcements Post', category: 'announcements', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },

	// Uncategorized type "post" (missing category and null category)
	{ _id: makeId(11), title: 'Uncategorized Post Missing Field', type: 'post', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(12), title: 'Uncategorized Post Null Field', category: null, type: 'post', visibility: 'PUBLIC', authorId: authorObjId },

	// Uncategorized type "match"
	{ _id: makeId(13), title: 'Uncategorized Match Missing Field', type: 'match', visibility: 'PUBLIC', authorId: authorObjId },
	{ _id: makeId(14), title: 'Uncategorized Match Null Field', category: null, type: 'match', visibility: 'PUBLIC', authorId: authorObjId },

	// Type "match" with category "general"
	{ _id: makeId(15), title: 'Type Match With Category General', category: 'general', type: 'match', visibility: 'PUBLIC', authorId: authorObjId },

	// Privacy posts: FRIENDS_ONLY and ONLY_ME
	{ _id: makeId(16), title: 'Secret Friends General Post', category: 'general', type: 'post', visibility: 'FRIENDS_ONLY', authorId: authorObjId },
	{ _id: makeId(17), title: 'Secret Only Me General Post', category: 'general', type: 'post', visibility: 'ONLY_ME', authorId: authorObjId },
	{ _id: makeId(18), title: 'Secret Friends Match Post', category: 'match_result', type: 'post', visibility: 'FRIENDS_ONLY', authorId: authorObjId },
	{ _id: makeId(19), title: 'Secret Only Me Match Post', category: 'match_result', type: 'post', visibility: 'ONLY_ME', authorId: authorObjId },
	{ _id: makeId(20), title: 'Secret Friends Uncategorized Match', type: 'match', visibility: 'FRIENDS_ONLY', authorId: authorObjId },
	{ _id: makeId(21), title: 'Secret Only Me Uncategorized Match', type: 'match', visibility: 'ONLY_ME', authorId: authorObjId }
];

describe('Feed Category Filter Parity with Client Forum.jsx', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		User.findById.mockImplementation((id) => {
			const idStr = id ? id.toString() : '';
			if (idStr === authorId) {
				return {
					select: jest.fn().mockReturnValue({
						_id: authorId,
						skillLevel: 'Intermediate',
						friends: [friendId]
					}),
					_id: authorId,
					friends: [friendId]
				};
			}
			if (idStr === friendId) {
				return {
					select: jest.fn().mockReturnValue({
						_id: friendId,
						skillLevel: 'Intermediate',
						friends: [authorId]
					}),
					_id: friendId,
					friends: [authorId]
				};
			}
			return {
				select: jest.fn().mockReturnValue({
					_id: strangerId,
					skillLevel: 'Beginner',
					friends: []
				}),
				_id: strangerId,
				friends: []
			};
		});

		ActivityFeed.find.mockImplementation((matchStage) => {
			const filterFn = sift(matchStage);
			const matched = seedPosts.filter(filterFn);
			return {
				sort: jest.fn().mockReturnThis(),
				limit: jest.fn().mockImplementation((limitCount) => ({
					lean: jest.fn().mockResolvedValue(matched.slice(0, limitCount))
				})),
				lean: jest.fn().mockResolvedValue(matched)
			};
		});
	});

	// Helper for addAndCondition direct tests
	describe('addAndCondition helper', () => {
		it('safely moves visibility $or into $and when $and does not yet exist', () => {
			const stage = {
				status: { $nin: ['deleted'] },
				$or: [{ visibility: 'PUBLIC' }, { authorId }]
			};
			const condition = { $or: [{ category: 'general' }, { category: null }] };

			feedRoutes.addAndCondition(stage, condition);

			expect(stage.$or).toBeUndefined();
			expect(stage.$and).toBeDefined();
			expect(stage.$and).toHaveLength(2);
			expect(stage.$and[0]).toEqual({ $or: [{ visibility: 'PUBLIC' }, { authorId }] });
			expect(stage.$and[1]).toEqual(condition);
		});

		it('appends condition to existing $and array without modifying existing clauses', () => {
			const stage = {
				status: { $nin: ['deleted'] },
				$and: [{ $or: [{ visibility: 'PUBLIC' }] }]
			};
			const condition = { $or: [{ title: /test/i }] };

			feedRoutes.addAndCondition(stage, condition);

			expect(stage.$and).toHaveLength(2);
			expect(stage.$and[0]).toEqual({ $or: [{ visibility: 'PUBLIC' }] });
			expect(stage.$and[1]).toEqual(condition);
		});

		it('initializes $and with condition if stage has no $or or $and', () => {
			const stage = { status: 'active' };
			const condition = { category: 'general' };

			feedRoutes.addAndCondition(stage, condition);

			expect(stage.$and).toEqual([condition]);
		});

		it('no-ops when condition is null or undefined', () => {
			const stage = { $or: [{ visibility: 'PUBLIC' }] };
			feedRoutes.addAndCondition(stage, null);
			expect(stage.$or).toBeDefined();
			expect(stage.$and).toBeUndefined();
		});
	});

	// 1. Each category returns exactly the posts matchesCategory would accept
	describe('1. Parity assertion for all categories', () => {
		const testCategories = [
			'find_partner',
			'meetup_rally',
			'challenge_match',
			'gear_exchange',
			'gear_review',
			'general',
			'qa_forum',
			'training',
			'match_result',
			'announcements',
			'all'
		];

		const publicPosts = seedPosts.filter(p => p.visibility === 'PUBLIC');

		testCategories.forEach((cat) => {
			it(`category="${cat}": server returns exactly the posts client matchesCategory accepts`, async () => {
				const res = await request(app)
					.get(`/api/feed?tab=latest&category=${cat}`)
					.set('Authorization', `Bearer ${tokenAuthor}`);

				expect(res.status).toBe(200);

				const returnedIds = res.body.feed.map(item => item._id || item.postId);
				const expectedIds = publicPosts
					.filter(p => matchesCategory(p, cat))
					.map(p => p._id);

				// Author's own private posts may be in server results if they match,
				// so let's verify every public post returned matches the client rule,
				// and every expected public post is included
				const returnedPublicIds = returnedIds.filter(id => publicPosts.some(p => p._id === id));
				expect(returnedPublicIds.sort()).toEqual(expectedIds.sort());
			});
		});
	});

	// 2. find_partner includes challenge_match
	describe('2. find_partner includes challenge_match', () => {
		it('returns find_partner, meetup_rally, and challenge_match posts', async () => {
			const res = await request(app)
				.get('/api/feed?tab=latest&category=find_partner')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const returnedTitles = res.body.feed.map(item => item.title);

			expect(returnedTitles).toContain('Find Partner Post');
			expect(returnedTitles).toContain('Meetup Rally Post');
			expect(returnedTitles).toContain('Challenge Match Post');
			expect(returnedTitles).not.toContain('Gear Exchange Post');
			expect(returnedTitles).not.toContain('General Forum Post');
		});
	});

	// 3. general includes uncategorized type "match" posts
	describe('3. general includes uncategorized type "match" posts', () => {
		it('includes uncategorized type "match" posts and uncategorized type "post" posts', async () => {
			const res = await request(app)
				.get('/api/feed?tab=latest&category=general')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const returnedTitles = res.body.feed.map(item => item.title);

			// Uncategorized type "match"
			expect(returnedTitles).toContain('Uncategorized Match Missing Field');
			expect(returnedTitles).toContain('Uncategorized Match Null Field');

			// Uncategorized type "post"
			expect(returnedTitles).toContain('Uncategorized Post Missing Field');
			expect(returnedTitles).toContain('Uncategorized Post Null Field');

			// General aliases
			expect(returnedTitles).toContain('General Forum Post');
			expect(returnedTitles).toContain('QA Forum Post');
			expect(returnedTitles).toContain('Training Post');
			expect(returnedTitles).toContain('Match Result Post');

			// Does not include find_partner or gear_exchange
			expect(returnedTitles).not.toContain('Find Partner Post');
			expect(returnedTitles).not.toContain('Gear Exchange Post');
		});
	});

	// 4. match_result excludes a type "match" post whose category is "general"
	describe('4. match_result excludes a type "match" post whose category is "general"', () => {
		it('includes match_result and uncategorized matches, but excludes type "match" with category "general"', async () => {
			const res = await request(app)
				.get('/api/feed?tab=latest&category=match_result')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const returnedTitles = res.body.feed.map(item => item.title);

			expect(returnedTitles).toContain('Match Result Post');
			expect(returnedTitles).toContain('Uncategorized Match Missing Field');
			expect(returnedTitles).toContain('Uncategorized Match Null Field');

			// Strictly excludes type "match" with category "general"
			expect(returnedTitles).not.toContain('Type Match With Category General');

			// Excludes uncategorized type "post"
			expect(returnedTitles).not.toContain('Uncategorized Post Missing Field');
			expect(returnedTitles).not.toContain('General Forum Post');
		});
	});

	// 5. PRIVACY: category=general, match_result AND with a search term combined
	describe('5. Privacy visibility enforcement across category and search', () => {
		const privacyQueries = [
			{ category: 'general', search: '' },
			{ category: 'match_result', search: '' },
			{ category: 'general', search: 'Secret' },
			{ category: 'match_result', search: 'Secret' }
		];

		privacyQueries.forEach(({ category, search }) => {
			const queryStr = search ? `category=${category}&search=${search}` : `category=${category}`;

			it(`stranger never sees FRIENDS_ONLY or ONLY_ME for ${queryStr}`, async () => {
				const res = await request(app)
					.get(`/api/feed?tab=latest&${queryStr}`)
					.set('Authorization', `Bearer ${tokenStranger}`);

				expect(res.status).toBe(200);
				const returned = res.body.feed;

				returned.forEach(item => {
					expect(item.visibility).not.toBe('FRIENDS_ONLY');
					expect(item.visibility).not.toBe('ONLY_ME');
				});
			});

			it(`friend sees FRIENDS_ONLY but never sees ONLY_ME for ${queryStr}`, async () => {
				const res = await request(app)
					.get(`/api/feed?tab=latest&${queryStr}`)
					.set('Authorization', `Bearer ${tokenFriend}`);

				expect(res.status).toBe(200);
				const returned = res.body.feed;

				returned.forEach(item => {
					expect(item.visibility).not.toBe('ONLY_ME');
				});

				// Friend should see author's friends-only posts that match the filters
				const friendsOnlyReturned = returned.filter(i => i.visibility === 'FRIENDS_ONLY');
				if (category === 'general') {
					expect(friendsOnlyReturned.some(i => i.title.includes('General'))).toBe(true);
				}
				if (category === 'match_result') {
					expect(friendsOnlyReturned.some(i => i.title.includes('Match'))).toBe(true);
				}
			});

			it(`author sees their own FRIENDS_ONLY and ONLY_ME for ${queryStr}`, async () => {
				const res = await request(app)
					.get(`/api/feed?tab=latest&${queryStr}`)
					.set('Authorization', `Bearer ${tokenAuthor}`);

				expect(res.status).toBe(200);
				const returned = res.body.feed;

				const onlyMeReturned = returned.filter(i => i.visibility === 'ONLY_ME');
				expect(onlyMeReturned.length).toBeGreaterThan(0);
				onlyMeReturned.forEach(item => {
					expect(item.authorId.toString()).toBe(authorId);
				});

				const friendsOnlyReturned = returned.filter(i => i.visibility === 'FRIENDS_ONLY');
				expect(friendsOnlyReturned.length).toBeGreaterThan(0);
			});
		});
	});

	// 6. category + search together still applies both filters
	describe('6. Combined category and search filtering', () => {
		it('applies both category and search filters simultaneously', async () => {
			const res = await request(app)
				.get('/api/feed?tab=latest&category=find_partner&search=Rally')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const returnedTitles = res.body.feed.map(item => item.title);

			// Matches find_partner AND contains "Rally"
			expect(returnedTitles).toContain('Meetup Rally Post');

			// Matches find_partner but does not contain "Rally"
			expect(returnedTitles).not.toContain('Find Partner Post');
			expect(returnedTitles).not.toContain('Challenge Match Post');

			// Matches search term "Post" but not find_partner category
			expect(returnedTitles).not.toContain('General Forum Post');
		});

		it('applies general category filter and search term safely', async () => {
			const res = await request(app)
				.get('/api/feed?tab=latest&category=general&search=QA')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const returnedTitles = res.body.feed.map(item => item.title);

			expect(returnedTitles).toEqual(['QA Forum Post']);
		});
	});
});
