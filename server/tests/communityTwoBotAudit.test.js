// Two-bot end-to-end audit regressions: RSVP feed sync, friend-aware feed cache, visibility on feed
// items, and quarantine signalling on post creation.
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const feedRoutes = require('../routes/feed');
const friendsRoutes = require('../routes/friends');
const Post = require('../models/Post');
const User = require('../models/User');
const ActivityFeed = require('../models/ActivityFeed');
const Notification = require('../models/Notification');
const feedCache = require('../utils/feedCache');
const { evaluateSpamHeuristics } = require('../utils/spamDetector');
const { installPostStore, resetPostStore } = require('./helpers/inMemoryPostStore');
const { JWT_SECRET } = require('../config/jwtSecret');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/pushNotifications', () => ({
	sendPushToUser: jest.fn().mockResolvedValue({ success: true, sentCount: 1 }),
	sendPushToAllUsers: jest.fn().mockResolvedValue()
}));
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue(),
	publishEventInBackground: jest.fn(),
}));
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, score: 0 }),
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockResolvedValue({ isSpam: false, score: 0 }),
}));

const hostId = '680000000000000000000001';
const player1Id = '680000000000000000000002';
const player2Id = '680000000000000000000003';
const strangerId = '680000000000000000000004';
const postId = '680000000000000000000101';
const feedId = '680000000000000000000901';

const tokenFor = (id, name = `User ${id.slice(-2)}`) => jwt.sign({ id, userId: id, role: 'user', name }, JWT_SECRET);
const hostToken = tokenFor(hostId, 'Host');
const player1Token = tokenFor(player1Id, 'Player One');

const roomEmitter = { emit: jest.fn() };
const mockIo = {
	emit: jest.fn(),
	to: jest.fn().mockReturnValue(roomEmitter),
	except: jest.fn().mockReturnValue({ emit: jest.fn() }),
};

const app = express();
app.use(express.json());
app.set('io', mockIo);
app.use((req, res, next) => { req.io = mockIo; next(); });
app.use('/api/forum', forumRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/friends', friendsRoutes);

const leanUser = (id, extra = {}) => {
	const userObj = { _id: id, name: `User ${id.slice(-2)}`, profilePic: '', friends: [], ...extra };
	return {
		select: jest.fn().mockReturnValue({
			lean: jest.fn().mockResolvedValue(userObj)
		}),
		lean: jest.fn().mockResolvedValue(userObj)
	};
};

const rallyPost = (rsvpList, slotsNeeded = 2, overrides = {}) => ({
	_id: postId,
	authorId: hostId,
	authorName: 'Host',
	title: 'Doubles tonight',
	content: 'RAC courts',
	category: 'meetup_rally',
	visibility: 'PUBLIC',
	playerMatchmaking: { isEnabled: true, slotsNeeded, rsvpList, isFilled: false },
	rsvp: {
		capacity: slotsNeeded,
		attendees: rsvpList.filter(r => r.status === 'confirmed').map(r => r.userId),
		waitlist: rsvpList.filter(r => r.status === 'waitlist').map(r => r.userId)
	},
	save: jest.fn().mockResolvedValue(true),
	toObject: function () { const { save, toObject, ...rest } = this; return { ...rest }; },
	...overrides
});

beforeEach(() => {
	jest.clearAllMocks();
	feedCache.clear();
	User.findById.mockImplementation((id) => leanUser(String(id)));
	User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
	ActivityFeed.findById.mockResolvedValue(null);
	ActivityFeed.findOneAndUpdate.mockResolvedValue({ _id: feedId, referenceId: postId });
	ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });
	Notification.mockImplementation((data) => ({ ...data, save: jest.fn().mockResolvedValue(data) }));
	Notification.create = jest.fn().mockResolvedValue({});
	evaluateSpamHeuristics.mockResolvedValue({ isSpam: false, score: 0 });
});

afterEach(() => resetPostStore(Post));

const feedSyncCalls = () => ActivityFeed.findOneAndUpdate.mock.calls.filter(
	([filter, update]) => filter && String(filter.referenceId) === postId && update && update.$set && 'playerMatchmaking' in update.$set
);

describe('Bug 1: RSVPs are mirrored onto the ActivityFeed row the host reloads', () => {
	it('syncs the feed copy, clears cached feeds and emits ids the client can match on join', async () => {
		installPostStore(Post, rallyPost([], 2));
		feedCache.set(`feed:${hostId}:0:foryou:root`, { feed: [{ _id: feedId }] }, 30);

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(200);

		const syncs = feedSyncCalls();
		expect(syncs).toHaveLength(1);
		const [filter, update] = syncs[0];
		expect(filter).toEqual({ type: 'post', referenceId: postId });
		expect(update.$set.playerMatchmaking.rsvpList).toEqual([
			expect.objectContaining({ userId: player1Id, status: 'confirmed' })
		]);
		expect(update.$set.rsvp.attendees).toEqual([player1Id]);

		// The host's cached 0/2 feed page is gone
		expect(feedCache.get(`feed:${hostId}:0:foryou:root`)).toBeNull();

		const rsvpEmit = mockIo.emit.mock.calls.find(([event]) => event === 'rallyRsvpUpdated');
		expect(rsvpEmit).toBeDefined();
		expect(rsvpEmit[1]).toEqual(expect.objectContaining({
			postId,
			referenceId: postId,
			feedId,
			action: 'joined',
			userId: player1Id,
			confirmedCount: 1,
			waitlistCount: 0,
			slotsNeeded: 2
		}));

		const postUpdatedEmit = mockIo.emit.mock.calls.find(([event]) => event === 'postUpdated');
		expect(postUpdatedEmit[1]).toEqual(expect.objectContaining({ postId, referenceId: postId, feedId }));
		expect(res.body).toEqual(expect.objectContaining({ postId, referenceId: postId, feedId, visibility: 'PUBLIC' }));
	});

	it('syncs the feed copy after a cancellation promotes the next waitlisted player', async () => {
		installPostStore(Post, rallyPost([
			{ userId: player1Id, userName: 'Player One', status: 'confirmed' },
			{ userId: player2Id, userName: 'Player Two', status: 'waitlist' }
		], 1));

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(200);
		const [, update] = feedSyncCalls().pop();
		expect(update.$set.playerMatchmaking.rsvpList).toEqual([
			expect.objectContaining({ userId: player2Id, status: 'confirmed' })
		]);
		expect(update.$set.playerMatchmaking.isFilled).toBe(true);
		expect(update.$set.rsvp.waitlist).toEqual([]);

		const rsvpEmit = mockIo.emit.mock.calls.find(([event]) => event === 'rallyRsvpUpdated');
		expect(rsvpEmit[1]).toEqual(expect.objectContaining({ action: 'left', promoted: [player2Id], feedId }));
	});

	it('still answers with the post id when the feed row is missing', async () => {
		ActivityFeed.findOneAndUpdate.mockResolvedValue(null);
		installPostStore(Post, rallyPost([], 2));

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(200);
		const rsvpEmit = mockIo.emit.mock.calls.find(([event]) => event === 'rallyRsvpUpdated');
		expect(rsvpEmit[1]).toEqual(expect.objectContaining({ postId, referenceId: postId, feedId: null }));
	});
});

describe('Bug 2: friendship changes invalidate both users\' cached feeds', () => {
	const mockFriendUser = (id, overrides = {}) => {
		const user = {
			_id: id,
			name: `User ${id.slice(-2)}`,
			friends: [],
			friendRequests: [],
			sentFriendRequests: [],
			save: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
			...overrides
		};
		for (const key of ['friends', 'friendRequests', 'sentFriendRequests']) {
			user[key] = [...user[key]];
			user[key].pull = jest.fn((target) => {
				const idx = user[key].findIndex(item => String(item) === String(target));
				if (idx !== -1) user[key].splice(idx, 1);
			});
		}
		return user;
	};

	const seedCaches = () => {
		feedCache.set(`feed:${hostId}:0:foryou:root`, { feed: [] }, 30);
		feedCache.set(`feed:${player1Id}:0:latest:root`, { feed: [] }, 30);
		feedCache.set(`feed:${strangerId}:0:foryou:root`, { feed: [] }, 30);
	};

	const expectOnlyPairInvalidated = () => {
		expect(feedCache.get(`feed:${hostId}:0:foryou:root`)).toBeNull();
		expect(feedCache.get(`feed:${player1Id}:0:latest:root`)).toBeNull();
		expect(feedCache.get(`feed:${strangerId}:0:foryou:root`)).not.toBeNull();
	};

	it('on accept', async () => {
		seedCaches();
		const me = mockFriendUser(player1Id, { friendRequests: [hostId] });
		const requester = mockFriendUser(hostId, { sentFriendRequests: [player1Id] });
		User.findById.mockResolvedValueOnce(me).mockResolvedValueOnce(requester);

		const res = await request(app)
			.post('/api/friends/accept')
			.set('Authorization', `Bearer ${player1Token}`)
			.send({ requesterId: hostId });

		expect(res.status).toBe(200);
		expectOnlyPairInvalidated();
	});

	it('on auto-accept through a crossing request', async () => {
		seedCaches();
		const me = mockFriendUser(player1Id, { friendRequests: [hostId] });
		const other = mockFriendUser(hostId, { sentFriendRequests: [player1Id] });
		User.findById.mockResolvedValueOnce(me).mockResolvedValueOnce(other);

		const res = await request(app)
			.post('/api/friends/request')
			.set('Authorization', `Bearer ${player1Token}`)
			.send({ recipientId: hostId });

		expect(res.status).toBe(200);
		expect(res.body.message).toBe('Friend request accepted automatically');
		expectOnlyPairInvalidated();
	});

	it('on unfriend', async () => {
		seedCaches();
		const me = mockFriendUser(player1Id, { friends: [hostId] });
		const friend = mockFriendUser(hostId, { friends: [player1Id] });
		User.findById.mockResolvedValueOnce(me).mockResolvedValueOnce(friend);

		const res = await request(app)
			.post('/api/friends/remove')
			.set('Authorization', `Bearer ${player1Token}`)
			.send({ friendId: hostId });

		expect(res.status).toBe(200);
		expectOnlyPairInvalidated();
	});

	it('keys the feed cache on the friend list, so a new friend never gets a stale page', async () => {
		let friends = [];
		User.findById.mockImplementation(() => ({ select: jest.fn().mockImplementation(() => Promise.resolve({ skillLevel: 'Beginner', friends, bookmarkedPosts: [], savedPosts: [] })) }));
		ActivityFeed.find.mockReturnValue({
			sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })
		});

		const first = await request(app).get('/api/feed?tab=latest').set('Authorization', `Bearer ${player1Token}`);
		const second = await request(app).get('/api/feed?tab=latest').set('Authorization', `Bearer ${player1Token}`);
		expect(first.headers['x-feed-cache']).toBe('MISS');
		expect(second.headers['x-feed-cache']).toBe('HIT');

		friends = [hostId];
		const afterFriendship = await request(app).get('/api/feed?tab=latest').set('Authorization', `Bearer ${player1Token}`);
		expect(afterFriendship.headers['x-feed-cache']).toBe('MISS');
		const friendsOnlyClause = ActivityFeed.find.mock.calls.pop()[0].$or.find(c => c.visibility === 'FRIENDS_ONLY');
		expect(friendsOnlyClause.authorId.$in.map(String)).toContain(hostId);
	});
});

describe('Bug 3: feed items and post responses expose visibility', () => {
	const mockFeedFind = (items) => {
		ActivityFeed.find.mockReturnValue({
			sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(items) }) })
		});
	};

	beforeEach(() => {
		User.findById.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ skillLevel: 'Beginner', friends: [], bookmarkedPosts: [], savedPosts: [] }) }));
	});

	it('every feed item carries visibility (legacy rows default to PUBLIC) and its post id', async () => {
		mockFeedFind([
			{ _id: feedId, type: 'post', referenceId: postId, authorId: hostId, visibility: 'FRIENDS_ONLY', title: 'Friends rally' },
			{ _id: '680000000000000000000902', type: 'post', referenceId: '680000000000000000000102', authorId: hostId, title: 'Legacy row' },
			{ _id: '680000000000000000000903', type: 'match', referenceId: '680000000000000000000777', authorId: hostId, visibility: 'ONLY_ME' }
		]);

		const res = await request(app).get('/api/feed?tab=latest').set('Authorization', `Bearer ${hostToken}`);

		expect(res.status).toBe(200);
		expect(res.body.feed.map(i => i.visibility)).toEqual(['FRIENDS_ONLY', 'PUBLIC', 'ONLY_ME']);
		expect(res.body.feed[0].postId).toBe(postId);
		expect(res.body.feed[2].postId).toBeUndefined();
	});

	it('create stores the requested visibility on the post and its feed row and returns it', async () => {
		let saved = null;
		Post.mockImplementation(function (data) {
			Object.assign(this, data);
			this._id = postId;
			this.save = jest.fn().mockImplementation(async () => { saved = this; return this; });
			this.toObject = function () { const { save, toObject, ...rest } = this; return { ...rest }; };
		});

		const res = await request(app)
			.post('/api/forum')
			.set('Authorization', `Bearer ${hostToken}`)
			.send({ title: 'Friends only rally', content: 'Just us', visibility: 'FRIENDS_ONLY' });

		expect(res.status).toBe(201);
		expect(saved.visibility).toBe('FRIENDS_ONLY');
		expect(res.body.visibility).toBe('FRIENDS_ONLY');
		expect(res.body.quarantined).toBe(false);
		expect(res.body).toEqual(expect.objectContaining({ postId, referenceId: postId, feedId }));
		const [, feedRow] = ActivityFeed.findOneAndUpdate.mock.calls[0];
		expect(feedRow.visibility).toBe('FRIENDS_ONLY');
		expect(feedRow.pendingReview).toBe(false);
		// Private post: never broadcast to everyone
		expect(mockIo.emit).not.toHaveBeenCalledWith('postCreated', expect.anything());
	});

	it('create rejects an unknown visibility with 400 instead of a 500 validation crash', async () => {
		const res = await request(app)
			.post('/api/forum')
			.set('Authorization', `Bearer ${hostToken}`)
			.send({ title: 'x', content: 'y', visibility: 'EVERYONE' });
		expect(res.status).toBe(400);
		expect(res.body.message).toContain('Invalid visibility');
	});

	it('editing visibility updates the ActivityFeed copy and the response', async () => {
		installPostStore(Post, rallyPost([], 2, { category: 'general', playerMatchmaking: undefined }));

		const res = await request(app)
			.put(`/api/forum/${postId}`)
			.set('Authorization', `Bearer ${hostToken}`)
			.send({ title: 'Doubles tonight', content: 'RAC courts', visibility: 'ONLY_ME' });

		expect(res.status).toBe(200);
		expect(res.body.visibility).toBe('ONLY_ME');
		const feedUpdate = ActivityFeed.updateOne.mock.calls.find(([filter]) => String(filter.referenceId) === postId);
		expect(feedUpdate[1].$set.visibility).toBe('ONLY_ME');
	});
});

describe('Bug 5: quarantined posts signal the author and stay private to them', () => {
	const mockNewPost = () => {
		Post.mockImplementation(function (data) {
			Object.assign(this, data);
			this._id = postId;
			this.save = jest.fn().mockResolvedValue(this);
			this.toObject = function () { const { save, toObject, ...rest } = this; return { ...rest }; };
		});
	};

	it('returns 201 with quarantined: true, a human message and a pending post for the author', async () => {
		mockNewPost();
		evaluateSpamHeuristics.mockResolvedValue({ isSpam: true, reason: 'Rate limit exceeded', heuristic: 'rate_limit' });

		const res = await request(app)
			.post('/api/forum')
			.set('Authorization', `Bearer ${hostToken}`)
			.send({ title: 'Fourth post', content: 'Within a minute', visibility: 'FRIENDS_ONLY' });

		expect(res.status).toBe(201);
		expect(res.body.message).toContain('submitted for review');
		expect(res.body.quarantined).toBe(true);
		expect(res.body.pendingReview).toBe(true);
		expect(res.body.reviewMessage).toBe('Your post is being reviewed and will appear once approved.');
		expect(res.body.post).toEqual(expect.objectContaining({
			_id: postId,
			status: 'quarantined',
			isFlagged: true,
			quarantined: true,
			pendingReview: true,
			visibility: 'FRIENDS_ONLY',
			title: 'Fourth post'
		}));

		// Feed row exists for the author but is flagged pending; nothing is broadcast to anyone
		const [, feedRow] = ActivityFeed.findOneAndUpdate.mock.calls[0];
		expect(feedRow.pendingReview).toBe(true);
		expect(mockIo.emit).not.toHaveBeenCalledWith('postCreated', expect.anything());
		expect(roomEmitter.emit).not.toHaveBeenCalledWith('postCreated', expect.anything());
	});

	it('GET /api/feed hides pendingReview rows from everyone except their author', async () => {
		User.findById.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ skillLevel: 'Beginner', friends: [], bookmarkedPosts: [], savedPosts: [] }) }));
		ActivityFeed.find.mockReturnValue({
			sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })
		});

		await request(app).get('/api/feed?tab=latest').set('Authorization', `Bearer ${tokenFor(strangerId)}`);
		const query = ActivityFeed.find.mock.calls[0][0];
		expect(query.$nor).toHaveLength(1);
		expect(query.$nor[0].pendingReview).toBe(true);
		const excludedAuthors = query.$nor[0].authorId.$nin.map(String);
		expect(excludedAuthors).toContain(strangerId);
		expect(excludedAuthors).not.toContain(hostId);
	});

	it('trending tags ignore pendingReview rows', async () => {
		ActivityFeed.aggregate.mockResolvedValue([]);
		await request(app).get('/api/feed/trending-tags');
		for (const [pipeline] of ActivityFeed.aggregate.mock.calls) {
			expect(pipeline[0].$match.pendingReview).toEqual({ $ne: true });
		}
	});

	it('post-save hook preserves/upserts ActivityFeed entry with pendingReview: true when quarantined', async () => {
		const RealPost = jest.requireActual('../models/Post');
		const hook = RealPost.schema.s.hooks._posts.get('save')[0].fn;

		const quarantinedDoc = {
			_id: postId,
			authorId: hostId,
			authorName: 'Host',
			title: 'Quarantined post',
			content: 'Some text',
			status: 'quarantined',
			isFlagged: true,
			category: 'general',
			createdAt: new Date(),
		};

		await hook(quarantinedDoc);

		expect(ActivityFeed.deleteOne).not.toHaveBeenCalledWith({ type: 'post', referenceId: postId });
		expect(ActivityFeed.findOneAndUpdate).toHaveBeenCalledWith(
			{ type: 'post', referenceId: postId },
			expect.objectContaining({
				pendingReview: true,
				title: 'Quarantined post'
			}),
			expect.anything()
		);
	});

	it('post-save hook deletes ActivityFeed entry when doc is deleted', async () => {
		const RealPost = jest.requireActual('../models/Post');
		const hook = RealPost.schema.s.hooks._posts.get('save')[0].fn;

		const deletedDoc = {
			_id: postId,
			status: 'deleted'
		};

		await hook(deletedDoc);

		expect(ActivityFeed.deleteOne).toHaveBeenCalledWith({ type: 'post', referenceId: postId });
	});
});
