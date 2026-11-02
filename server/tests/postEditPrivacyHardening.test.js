const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const User = require('../models/User');
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
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"etag-edit-privacy"'),
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

const hostId = '670000000000000000000001';
const friendId = '670000000000000000000002';
const opponentId = '670000000000000000000003';
const postId = '670000000000000000000101';

const tokenFor = (id, name = `User ${id.slice(-2)}`) => jwt.sign({ id, userId: id, role: 'user', name }, JWT_SECRET);
const hostToken = tokenFor(hostId, 'Host');

const roomEmitter = { emit: jest.fn() };
const exceptEmitter = { emit: jest.fn() };
const mockIo = {
	emit: jest.fn(),
	to: jest.fn().mockReturnValue(roomEmitter),
	except: jest.fn().mockReturnValue(exceptEmitter)
};

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.io = mockIo; next(); });
app.use('/api/forum', forumRoutes);

let friendsByUser = {};

const editable = (post) => {
	post.save = jest.fn().mockResolvedValue(true);
	post.toObject = function () { const { save, toObject, ...rest } = this; return { ...rest }; };
	return post;
};

const challengePost = (challengeMatch, overrides = {}) => editable({
	_id: postId,
	authorId: hostId,
	authorName: 'Host',
	title: 'Challenge',
	content: 'Who wants a game?',
	category: 'challenge_match',
	visibility: 'PUBLIC',
	challengeMatch: {
		isEnabled: true,
		matchType: 'Singles',
		gameFormat: 'Best of 3 to 21',
		stipulations: '',
		matchStatus: 'open',
		challengerTeam: [{ userId: hostId, userName: 'Host', avatarUrl: '' }],
		acceptedBy: [],
		linkedMatchId: '',
		...challengeMatch
	},
	...overrides
});

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
});

afterEach(() => resetPostStore(Post));

const edit = (body) => request(app)
	.put(`/api/forum/${postId}`)
	.set('Authorization', `Bearer ${hostToken}`)
	.send({ title: 'Challenge', content: 'Who wants a game?', ...body });

describe('challengeMatch edit hardening', () => {
	it('keeps server-owned status, opponents and linked match when the author edits an accepted challenge', async () => {
		const post = challengePost({
			matchStatus: 'accepted',
			acceptedBy: [{ userId: opponentId, userName: 'Opp', avatarUrl: '' }],
			linkedMatchId: 'match-123'
		});
		installPostStore(Post, post);

		const res = await edit({
			challengeMatch: {
				matchType: 'Doubles',
				stipulations: 'Loser buys shuttles',
				matchStatus: 'completed',
				acceptedBy: [],
				linkedMatchId: 'forged',
				challengerTeam: [{ userId: friendId, userName: 'Swapped' }]
			}
		});

		expect(res.status).toBe(200);
		expect(post.challengeMatch.matchType).toBe('Doubles');
		expect(post.challengeMatch.stipulations).toBe('Loser buys shuttles');
		expect(post.challengeMatch.matchStatus).toBe('accepted');
		expect(post.challengeMatch.acceptedBy).toEqual([{ userId: opponentId, userName: 'Opp', avatarUrl: '' }]);
		expect(post.challengeMatch.linkedMatchId).toBe('match-123');
		expect(post.challengeMatch.challengerTeam).toEqual([{ userId: hostId, userName: 'Host', avatarUrl: '' }]);
		expect(post.challengeMatch.isEnabled).toBe(true);
	});

	it('lets the author change the challenger team while the challenge is still open', async () => {
		const post = challengePost({});
		installPostStore(Post, post);

		const res = await edit({
			challengeMatch: {
				matchType: 'Doubles',
				challengerTeam: [{ userId: hostId, userName: 'Host' }, { userId: friendId, userName: 'Partner' }]
			}
		});

		expect(res.status).toBe(200);
		expect(post.challengeMatch.challengerTeam.map(c => c.userId)).toEqual([hostId, friendId]);
		expect(post.challengeMatch.matchStatus).toBe('open');
	});
});

describe('qaDetails edit hardening', () => {
	it('only lets an edit change the subtopic, not the accepted answer', async () => {
		const post = editable({
			_id: postId,
			authorId: hostId,
			title: 'Q',
			content: 'Which racket?',
			category: 'qa_forum',
			visibility: 'PUBLIC',
			qaDetails: { isEnabled: true, subtopic: 'General', isResolved: true, acceptedCommentId: 'c1', acceptedBy: { userId: hostId, userName: 'Host' } }
		});
		installPostStore(Post, post);

		const res = await edit({ title: 'Q', content: 'Which racket?', qaDetails: { subtopic: 'Gear', isResolved: false, acceptedCommentId: '' } });

		expect(res.status).toBe(200);
		expect(post.qaDetails.subtopic).toBe('Gear');
		expect(post.qaDetails.isResolved).toBe(true);
		expect(post.qaDetails.acceptedCommentId).toBe('c1');
	});
});

describe('private post socket scoping', () => {
	it('emits FRIENDS_ONLY post updates only to the author and their friends', async () => {
		friendsByUser[hostId] = [friendId];
		const post = challengePost({}, { visibility: 'FRIENDS_ONLY' });
		installPostStore(Post, post);

		const res = await edit({ challengeMatch: { stipulations: 'Bring water' } });

		expect(res.status).toBe(200);
		expect(mockIo.emit).not.toHaveBeenCalledWith('postUpdated', expect.anything());
		expect(mockIo.to).toHaveBeenCalledWith(expect.arrayContaining([hostId, friendId]));
		expect(roomEmitter.emit).toHaveBeenCalledWith('postUpdated', expect.objectContaining({ _id: postId }));
	});

	it('removes a post from everyone else when it is switched from PUBLIC to ONLY_ME', async () => {
		const post = challengePost({});
		installPostStore(Post, post);

		const res = await edit({ visibility: 'ONLY_ME' });

		expect(res.status).toBe(200);
		expect(mockIo.except).toHaveBeenCalledWith([hostId]);
		expect(exceptEmitter.emit).toHaveBeenCalledWith('postDeleted', postId);
		expect(mockIo.emit).not.toHaveBeenCalledWith('postUpdated', expect.anything());
		expect(mockIo.to).toHaveBeenCalledWith([hostId]);
	});

	it('still broadcasts updates for public posts', async () => {
		const post = challengePost({});
		installPostStore(Post, post);

		const res = await edit({ challengeMatch: { stipulations: 'Bring water' } });

		expect(res.status).toBe(200);
		expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.objectContaining({ _id: postId }));
		expect(mockIo.except).not.toHaveBeenCalled();
	});
});
