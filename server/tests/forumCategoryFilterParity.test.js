const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const sift = require('sift');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const User = require('../models/User');

jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue()
}));
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, score: 0 })
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockResolvedValue({ isSpam: false, score: 0 })
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';

const authorId = '670000000000000000000001';
const friendId = '670000000000000000000002';
const strangerId = '670000000000000000000003';

const tokenFor = (id) => jwt.sign({ id, userId: id, role: 'user', name: `User${id.slice(-1)}` }, JWT_SECRET);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
	req.io = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
	next();
});
app.use('/api/forum', forumRoutes);

// Same logic as matchesCategory in client/src/pages/Forum.jsx (forum posts have no `type`).
const matchesCategory = (item, cat) => {
	if (!cat || cat === 'all') return true;
	const itemCat = item.category || (item.type === 'match' ? 'match_result' : 'general');
	if (cat === 'find_partner') return itemCat === 'find_partner' || itemCat === 'meetup_rally' || itemCat === 'challenge_match';
	if (cat === 'gear_exchange') return itemCat === 'gear_exchange' || itemCat === 'gear_review';
	if (cat === 'general') return itemCat === 'general' || itemCat === 'qa_forum' || itemCat === 'training' || itemCat === 'match_result';
	return itemCat === cat;
};

const id = (n) => `680000000000000000000${String(n).padStart(3, '0')}`;
const pub = { visibility: 'PUBLIC', authorId };

const seedPosts = [
	{ _id: id(1), title: 'Find partner', category: 'find_partner', ...pub },
	{ _id: id(2), title: 'Meetup rally', category: 'meetup_rally', ...pub },
	{ _id: id(3), title: 'Challenge match', category: 'challenge_match', ...pub },
	{ _id: id(4), title: 'Gear exchange', category: 'gear_exchange', ...pub },
	{ _id: id(5), title: 'Gear review', category: 'gear_review', ...pub },
	{ _id: id(6), title: 'General chat', category: 'general', ...pub },
	{ _id: id(7), title: 'QA question', category: 'qa_forum', ...pub },
	{ _id: id(8), title: 'Training drills', category: 'training', ...pub },
	{ _id: id(9), title: 'Match result', category: 'match_result', ...pub },
	{ _id: id(10), title: 'Legacy missing category', ...pub },
	{ _id: id(11), title: 'Legacy null category', category: null, ...pub },
	{ _id: id(12), title: 'Legacy empty category', category: '', ...pub },
	{ _id: id(13), title: 'Legacy no visibility', category: 'general', authorId },
	{ _id: id(20), title: 'Secret friends general', category: 'general', visibility: 'FRIENDS_ONLY', authorId },
	{ _id: id(21), title: 'Secret only me general', category: 'general', visibility: 'ONLY_ME', authorId },
	{ _id: id(22), title: 'Secret friends legacy', visibility: 'FRIENDS_ONLY', authorId },
	{ _id: id(23), title: 'Secret only me legacy', visibility: 'ONLY_ME', authorId },
	{ _id: id(24), title: 'Secret friends challenge', category: 'challenge_match', visibility: 'FRIENDS_ONLY', authorId },
	{ _id: id(25), title: 'Secret only me challenge', category: 'challenge_match', visibility: 'ONLY_ME', authorId }
];

const friendsOf = {
	[authorId]: [friendId],
	[friendId]: [authorId],
	[strangerId]: []
};

let capturedQuery;

// Runs the exact Mongo filter the route built against the seed data, bypassing the
// route's in-memory visibility post-filter, so the query itself is what is tested.
const queryMatches = () => seedPosts.filter(sift(capturedQuery)).map(p => p._id).sort();
const expectedIds = (predicate) => seedPosts.filter(predicate).map(p => p._id).sort();

const isVisibleTo = (viewerId) => (post) => {
	const vis = post.visibility || 'PUBLIC';
	if (vis === 'PUBLIC') return true;
	if (!viewerId) return false;
	if (post.authorId === viewerId) return true;
	if (vis === 'FRIENDS_ONLY') return (friendsOf[viewerId] || []).includes(post.authorId);
	return false;
};

const getForum = (qs, viewerId) => {
	const req = request(app).get(`/api/forum?${qs}`);
	return viewerId ? req.set('Authorization', `Bearer ${tokenFor(viewerId)}`) : req;
};

describe('GET /api/forum category filter parity with client Forum.jsx', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		capturedQuery = undefined;

		User.findById.mockImplementation((userId) => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({ _id: userId, friends: friendsOf[String(userId)] || [] })
			})
		}));
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
			lean: jest.fn().mockResolvedValue([])
		});

		Post.find.mockImplementation((query) => {
			capturedQuery = query;
			const matched = seedPosts.filter(sift(query));
			const chain = {
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue(matched)
			};
			return chain;
		});
		Post.countDocuments.mockResolvedValue(seedPosts.length);
	});

	const categories = ['general', 'find_partner', 'gear_exchange', 'match_result', 'challenge_match', 'qa_forum', 'training', 'meetup_rally'];

	describe.each(categories)('category=%s', (cat) => {
		it.each([
			['the author', authorId],
			['a friend', friendId],
			['a stranger', strangerId],
			['an anonymous visitor', null]
		])('returns exactly matchesCategory ∩ visibility for %s', async (_label, viewerId) => {
			const res = await getForum(`category=${cat}&limit=50`, viewerId);
			expect(res.status).toBe(200);
			expect(queryMatches()).toEqual(
				expectedIds(p => matchesCategory(p, cat) && isVisibleTo(viewerId)(p))
			);
		});
	});

	it('find_partner includes challenge_match posts', async () => {
		await getForum('category=find_partner', authorId);
		expect(queryMatches()).toEqual(expect.arrayContaining([id(1), id(2), id(3), id(24), id(25)]));
	});

	it('general includes uncategorized posts (missing, null, and empty category)', async () => {
		await getForum('category=general', authorId);
		expect(queryMatches()).toEqual(expect.arrayContaining([id(10), id(11), id(12)]));
	});

	it('keeps the visibility $or as its own clause inside $and for category=general', async () => {
		await getForum('category=general', strangerId);
		expect(capturedQuery.$or).toBeUndefined();
		expect(capturedQuery.$and).toHaveLength(2);
		expect(capturedQuery.$and[0].$or).toEqual(expect.arrayContaining([{ visibility: 'PUBLIC' }]));
	});

	it('combines general category, search, and visibility without leaking private posts', async () => {
		await getForum('category=general&search=secret', strangerId);
		expect(capturedQuery.$and).toHaveLength(3);
		expect(queryMatches()).toEqual([]);

		await getForum('category=general&search=secret', friendId);
		expect(queryMatches()).toEqual([id(20), id(22)].sort());

		await getForum('category=general&search=secret', authorId);
		expect(queryMatches()).toEqual([id(20), id(21), id(22), id(23)].sort());
	});

	it('combines find_partner category and search for a stranger', async () => {
		await getForum('category=find_partner&search=challenge', strangerId);
		expect(queryMatches()).toEqual([id(3)]);
	});

	it('leaves the plain visibility $or in place when no category or search is given', async () => {
		await getForum('', strangerId);
		expect(capturedQuery.$and).toBeUndefined();
		expect(queryMatches()).toEqual(expectedIds(isVisibleTo(strangerId)));
	});
});
