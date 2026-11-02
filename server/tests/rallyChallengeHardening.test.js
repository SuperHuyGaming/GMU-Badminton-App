const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const Match = require('../models/Match');
const User = require('../models/User');
const { installPostStore, resetPostStore } = require('./helpers/inMemoryPostStore');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/pushNotifications', () => ({
	sendPushToUser: jest.fn().mockResolvedValue({ success: true, sentCount: 1 }),
	sendPushToAllUsers: jest.fn().mockResolvedValue()
}));
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"etag-hardening"'),
	invalidateFeed: jest.fn(),
	clear: jest.fn(),
	resetStats: jest.fn(),
	getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, invalidations: 0, size: 0 })
}));
jest.mock('../utils/kafkaProducer', () => ({ publishEvent: jest.fn().mockResolvedValue() }));
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, score: 0 }),
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockResolvedValue({ isSpam: false, score: 0 }),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const hostId = '670000000000000000000001';
const playerIds = ['670000000000000000000002', '670000000000000000000003', '670000000000000000000004', '670000000000000000000005'];
const postId = '670000000000000000000101';

const tokenFor = (id, name = `User ${id.slice(-2)}`) => jwt.sign({ id, userId: id, role: 'user', name }, JWT_SECRET);
const hostToken = tokenFor(hostId, 'Host');

const roomEmitter = { emit: jest.fn() };
const mockIo = { emit: jest.fn(), to: jest.fn().mockReturnValue(roomEmitter) };

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.io = mockIo; next(); });
app.use('/api/forum', forumRoutes);

let friendsByUser = {};

const rallyPost = (overrides = {}) => ({
	_id: postId,
	authorId: hostId,
	authorName: 'Host',
	title: 'Rally',
	content: 'Rally tonight',
	category: 'meetup_rally',
	visibility: 'PUBLIC',
	playerMatchmaking: { slotsNeeded: 1, rsvpList: [], isFilled: false },
	rsvp: { capacity: 1, attendees: [], waitlist: [] },
	...overrides
});

const challengePost = (overrides = {}) => ({
	_id: postId,
	authorId: hostId,
	authorName: 'Host',
	category: 'challenge_match',
	visibility: 'PUBLIC',
	challengeMatch: {
		matchType: 'Singles',
		gameFormat: 'Best of 3 to 21',
		matchStatus: 'open',
		challengerTeam: [{ userId: hostId, userName: 'Host' }],
		acceptedBy: [],
		linkedMatchId: ''
	},
	...overrides
});

const confirmed = (post) => post.playerMatchmaking.rsvpList.filter(r => r.status === 'confirmed');
const waitlisted = (post) => post.playerMatchmaking.rsvpList.filter(r => r.status === 'waitlist');

let matchSaveSpy;

beforeEach(() => {
	jest.clearAllMocks();
	friendsByUser = {};
	User.findById.mockImplementation((id) => ({
		select: jest.fn().mockReturnValue({
			lean: jest.fn().mockResolvedValue({
				_id: id,
				name: `User ${String(id).slice(-2)}`,
				profilePic: '',
				friends: friendsByUser[String(id)] || []
			})
		})
	}));
	User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
	matchSaveSpy = jest.spyOn(Match.prototype, 'save').mockImplementation(function () { return Promise.resolve(this); });
});

afterEach(() => {
	resetPostStore(Post);
	matchSaveSpy.mockRestore();
});

describe('Rally RSVP atomicity', () => {
	it('confirms exactly one player when several race for the last slot', async () => {
		const post = rallyPost();
		installPostStore(Post, post);
		const staleRally = JSON.parse(JSON.stringify(post));
		Post.findById.mockImplementation(() => JSON.parse(JSON.stringify(staleRally)));

		const responses = await Promise.all(playerIds.slice(0, 3).map(id =>
			request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${tokenFor(id)}`).send({})
		));

		responses.forEach(r => expect(r.status).toBe(200));
		expect(confirmed(post)).toHaveLength(1);
		expect(waitlisted(post)).toHaveLength(2);
		expect(post.playerMatchmaking.isFilled).toBe(true);
		expect(post.rsvp.attendees).toEqual([confirmed(post)[0].userId]);
		expect(post.rsvp.waitlist).toHaveLength(2);
	});

	it('creates a single entry when the same user RSVPs twice concurrently', async () => {
		const post = rallyPost({ playerMatchmaking: { slotsNeeded: 3, rsvpList: [], isFilled: false } });
		installPostStore(Post, post);
		// Both requests read the post before either write lands (worst-case interleaving)
		const staleSnapshot = JSON.parse(JSON.stringify(post));
		Post.findById.mockImplementation(() => JSON.parse(JSON.stringify(staleSnapshot)));
		const token = tokenFor(playerIds[0]);

		await Promise.all([
			request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${token}`).send({}),
			request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${token}`).send({})
		]);

		expect(post.playerMatchmaking.rsvpList.filter(r => r.userId === playerIds[0])).toHaveLength(1);
		expect(post.rsvp.attendees).toEqual([playerIds[0]]);
	});

	it('never overbooks when confirmed players cancel concurrently and the waitlist is promoted', async () => {
		const [a, b, c, d] = playerIds;
		const post = rallyPost({
			playerMatchmaking: {
				slotsNeeded: 2,
				isFilled: true,
				rsvpList: [
					{ userId: a, status: 'confirmed' },
					{ userId: b, status: 'confirmed' },
					{ userId: c, status: 'waitlist' },
					{ userId: d, status: 'waitlist' }
				]
			},
			rsvp: { capacity: 2, attendees: [a, b], waitlist: [c, d] }
		});
		installPostStore(Post, post);

		await Promise.all([a, b].map(id =>
			request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${tokenFor(id)}`).send({})
		));

		expect(confirmed(post).map(r => r.userId).sort()).toEqual([c, d].sort());
		expect(waitlisted(post)).toHaveLength(0);
		expect(post.rsvp.attendees.sort()).toEqual([c, d].sort());
		expect(post.rsvp.waitlist).toEqual([]);
		expect(post.playerMatchmaking.isFilled).toBe(true);
	});
});

describe('Visibility enforcement on RSVP / accept-challenge', () => {
	it('returns 404 when a non-author RSVPs to an ONLY_ME rally', async () => {
		const post = rallyPost({ visibility: 'ONLY_ME' });
		installPostStore(Post, post);

		const res = await request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${tokenFor(playerIds[0])}`).send({});
		expect(res.status).toBe(404);
		expect(post.playerMatchmaking.rsvpList).toHaveLength(0);
	});

	it('returns 404 when a non-friend accepts a FRIENDS_ONLY challenge', async () => {
		const post = challengePost({ visibility: 'FRIENDS_ONLY' });
		installPostStore(Post, post);

		const res = await request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${tokenFor(playerIds[0])}`).send({});
		expect(res.status).toBe(404);
		expect(post.challengeMatch.matchStatus).toBe('open');
		expect(matchSaveSpy).not.toHaveBeenCalled();
	});

	it('lets a friend RSVP to a FRIENDS_ONLY rally and only emits to involved users', async () => {
		friendsByUser[hostId] = [playerIds[0]];
		const post = rallyPost({ visibility: 'FRIENDS_ONLY' });
		installPostStore(Post, post);

		const res = await request(app).post(`/api/forum/${postId}/rsvp`).set('Authorization', `Bearer ${tokenFor(playerIds[0])}`).send({});
		expect(res.status).toBe(200);
		expect(confirmed(post)).toHaveLength(1);
		expect(mockIo.emit).not.toHaveBeenCalledWith('rallyRsvpUpdated', expect.anything());
		expect(mockIo.emit).not.toHaveBeenCalledWith('postUpdated', expect.anything());
		expect(mockIo.to).toHaveBeenCalledWith(expect.arrayContaining([hostId, playerIds[0]]));
		expect(roomEmitter.emit).toHaveBeenCalledWith('rallyRsvpUpdated', expect.objectContaining({ postId }));
	});
});

describe('Challenge accept atomicity', () => {
	it('creates exactly one Match when two opponents accept concurrently', async () => {
		const post = challengePost();
		installPostStore(Post, post);
		const staleChallenge = JSON.parse(JSON.stringify(post));
		Post.findById.mockImplementation(() => JSON.parse(JSON.stringify(staleChallenge)));

		const responses = await Promise.all(playerIds.slice(0, 2).map(id =>
			request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${tokenFor(id)}`).send({})
		));

		expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
		expect(matchSaveSpy).toHaveBeenCalledTimes(1);
		expect(post.challengeMatch.acceptedBy).toHaveLength(1);
		expect(post.challengeMatch.matchStatus).toBe('accepted');
		expect(post.challengeMatch.linkedMatchId).toBeTruthy();
	});

	it('creates one Match when the same opponent double-submits', async () => {
		const post = challengePost();
		installPostStore(Post, post);
		const token = tokenFor(playerIds[0]);

		const responses = await Promise.all([
			request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${token}`).send({}),
			request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${token}`).send({})
		]);

		responses.forEach(r => expect(r.status).toBe(200));
		expect(matchSaveSpy).toHaveBeenCalledTimes(1);
		expect(post.challengeMatch.acceptedBy).toHaveLength(1);
	});

	it('reverts the claim and returns 500 when Match creation fails', async () => {
		const post = challengePost();
		installPostStore(Post, post);
		matchSaveSpy.mockImplementationOnce(() => Promise.reject(new Error('db down')));

		const res = await request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${tokenFor(playerIds[0])}`).send({});

		expect(res.status).toBe(500);
		expect(post.challengeMatch.matchStatus).toBe('open');
		expect(post.challengeMatch.acceptedBy).toHaveLength(0);
		expect(post.challengeMatch.linkedMatchId).toBe('');
	});

	it('repairs a legacy accepted challenge with no linked Match for the acceptor', async () => {
		const post = challengePost();
		post.challengeMatch.matchStatus = 'accepted';
		post.challengeMatch.acceptedBy = [{ userId: playerIds[0], userName: 'P' }];
		installPostStore(Post, post);

		const res = await request(app).put(`/api/forum/${postId}/accept-challenge`).set('Authorization', `Bearer ${tokenFor(playerIds[0])}`).send({});

		expect(res.status).toBe(200);
		expect(matchSaveSpy).toHaveBeenCalledTimes(1);
		expect(post.challengeMatch.linkedMatchId).toBeTruthy();
		expect(res.body.challengeMatch.linkedMatchId).toBe(post.challengeMatch.linkedMatchId);
	});
});

describe('Editing a rally keeps RSVP state server-owned', () => {
	const editablePost = (overrides) => {
		const post = rallyPost(overrides);
		post.save = jest.fn().mockResolvedValue(true);
		post.toObject = function () { const { save, toObject, ...rest } = this; return { ...rest }; };
		return post;
	};

	it('ignores a client-supplied rsvpList on edit', async () => {
		const [a] = playerIds;
		const post = editablePost({
			playerMatchmaking: { slotsNeeded: 2, isFilled: false, rsvpList: [{ userId: a, userName: 'A', status: 'confirmed' }] },
			rsvp: { capacity: 2, attendees: [a], waitlist: [] }
		});
		installPostStore(Post, post);

		const res = await request(app)
			.put(`/api/forum/${postId}`)
			.set('Authorization', `Bearer ${hostToken}`)
			.send({
				title: 'Rally',
				content: 'Rally tonight',
				playerMatchmaking: {
					slotsNeeded: 2,
					isFilled: true,
					rsvpList: [{ userId: playerIds[3], userName: 'Injected', status: 'confirmed' }]
				}
			});

		expect(res.status).toBe(200);
		expect(post.playerMatchmaking.rsvpList).toEqual([{ userId: a, userName: 'A', status: 'confirmed' }]);
		expect(post.playerMatchmaking.isFilled).toBe(false);
	});

	it('promotes waitlisted players FIFO when the author raises capacity', async () => {
		const [a, b, c, d] = playerIds;
		const post = editablePost({
			playerMatchmaking: {
				slotsNeeded: 1,
				isFilled: true,
				rsvpList: [
					{ userId: a, status: 'confirmed' },
					{ userId: b, status: 'waitlist' },
					{ userId: c, status: 'waitlist' },
					{ userId: d, status: 'waitlist' }
				]
			},
			rsvp: { capacity: 1, attendees: [a], waitlist: [b, c, d] }
		});
		installPostStore(Post, post);

		const res = await request(app)
			.put(`/api/forum/${postId}`)
			.set('Authorization', `Bearer ${hostToken}`)
			.send({ title: 'Rally', content: 'Rally tonight', playerMatchmaking: { slotsNeeded: 3 } });

		expect(res.status).toBe(200);
		expect(confirmed(post).map(r => r.userId)).toEqual([a, b, c]);
		expect(waitlisted(post).map(r => r.userId)).toEqual([d]);
		expect(post.rsvp.attendees).toEqual([a, b, c]);
		expect(post.rsvp.waitlist).toEqual([d]);
		expect(post.playerMatchmaking.isFilled).toBe(true);
		expect(res.body.playerMatchmaking.isFilled).toBe(true);
	});
});
