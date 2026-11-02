const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const { installPostStore, resetPostStore } = require('./helpers/inMemoryPostStore');
const Match = require('../models/Match');

afterEach(() => resetPostStore(Post));
// Scheduled matches are persisted without a live DB: resolve save() with the document itself
jest.spyOn(Match.prototype, 'save').mockImplementation(function () { return Promise.resolve(this); });
const User = require('../models/User');
const { sendPushToUser } = require('../utils/pushNotifications');

jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../models/ActivityFeed');
jest.mock('../utils/pushNotifications', () => ({
	sendPushToUser: jest.fn().mockResolvedValue({ success: true, sentCount: 1 }),
	sendPushToAllUsers: jest.fn().mockResolvedValue()
}));
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"etag-match"'),
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
const challengerId = '660000000000000000000001';
const opponentId = '660000000000000000000002';
const thirdPartyId = '660000000000000000000003';

const challengerToken = jwt.sign({ id: challengerId, userId: challengerId, role: 'user', name: 'Challenger Player' }, JWT_SECRET);
const opponentToken = jwt.sign({ id: opponentId, userId: opponentId, role: 'user', name: 'Opponent Player' }, JWT_SECRET);
const thirdPartyToken = jwt.sign({ id: thirdPartyId, userId: thirdPartyId, role: 'user', name: 'Third Party' }, JWT_SECRET);

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

describe('Challenge Match Acceptance & Downstream Match Creation Suite', () => {
	const postId = '660000000000000000000102';

	beforeEach(() => {
		jest.clearAllMocks();
		User.findById.mockImplementation((id) => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({
					_id: id,
					name: `Player ${id.slice(-4)}`,
					profilePic: `pic_${id.slice(-4)}.jpg`
				})
			})
		}));
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([])
			})
		});
	});

	describe('Match Model Schema Validations', () => {
		it('allows a match to be instantiated with status: scheduled and no initial scores', async () => {
			const scheduledMatch = new Match({
				team1: [new mongoose.Types.ObjectId(challengerId)],
				team2: [new mongoose.Types.ObjectId(opponentId)],
				matchType: 'singles',
				status: 'scheduled',
				challengeMetadata: {
					postId: new mongoose.Types.ObjectId(postId),
					acceptedAt: new Date()
				}
			});

			let validationError;
			try {
				await scheduledMatch.validate();
			} catch (err) {
				validationError = err;
			}
			expect(validationError).toBeUndefined();
			expect(scheduledMatch.status).toBe('scheduled');
			expect(scheduledMatch.team1Score).toBeUndefined();
			expect(scheduledMatch.team2Score).toBeUndefined();
			expect(scheduledMatch.winner).toBeUndefined();
			expect(scheduledMatch.challengeMetadata.postId.toString()).toBe(postId);
		});

		it('requires team1Score, team2Score, and winner when status is pending or confirmed', async () => {
			const pendingMatch = new Match({
				team1: [new mongoose.Types.ObjectId(challengerId)],
				team2: [new mongoose.Types.ObjectId(opponentId)],
				matchType: 'singles',
				status: 'pending'
			});

			let validationError;
			try {
				await pendingMatch.validate();
			} catch (err) {
				validationError = err;
			}
			expect(validationError).toBeDefined();
			expect(validationError.errors.team1Score).toBeDefined();
			expect(validationError.errors.team2Score).toBeDefined();
			expect(validationError.errors.winner).toBeDefined();
		});
	});

	describe('PUT /api/forum/:postId/accept-challenge', () => {
		it('prevents author from accepting their own challenge', async () => {
			const mockPost = {
				_id: postId,
				authorId: challengerId,
				category: 'challenge_match',
				challengeMatch: {
					matchStatus: 'open',
					challengerTeam: [{ userId: challengerId, userName: 'Challenger' }],
					acceptedBy: []
				}
			};

			installPostStore(Post, mockPost);

			const res = await request(app)
				.put(`/api/forum/${postId}/accept-challenge`)
				.set('Authorization', `Bearer ${challengerToken}`)
				.send({});

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/cannot accept your own challenge/i);
		});

		it('accepts challenge and automatically provisions downstream scheduled match', async () => {
			const mockPost = {
				_id: postId,
				authorId: challengerId,
				authorName: 'Challenger Player',
				category: 'challenge_match',
				targetDate: '2026-11-15T18:00:00Z',
				challengeMatch: {
					matchType: 'Friendly Scrimmage',
					gameFormat: 'Best of 3 to 21',
					stipulations: 'Bring Aerosensa 30 shuttles',
					matchStatus: 'open',
					challengerTeam: [{ userId: challengerId, userName: 'Challenger Player', avatarUrl: '' }],
					acceptedBy: []
				},
				save: jest.fn().mockResolvedValue(true),
				toObject: function () { return { ...this }; }
			};

			installPostStore(Post, mockPost);

			const res = await request(app)
				.put(`/api/forum/${postId}/accept-challenge`)
				.set('Authorization', `Bearer ${opponentToken}`)
				.send({});

			expect(res.status).toBe(200);
			expect(mockPost.challengeMatch.matchStatus).toBe('accepted');
			expect(mockPost.challengeMatch.acceptedBy).toHaveLength(1);
			expect(mockPost.challengeMatch.acceptedBy[0].userId).toBe(opponentId);
			expect(mockPost.challengeMatch.linkedMatchId).toBeDefined();
			expect(mockPost.challengeMatch.linkedMatchId).not.toBe('');
			expect(Post.findOneAndUpdate).toHaveBeenCalled();

			// Verify push notification to challenger
			expect(sendPushToUser).toHaveBeenCalledWith(
				challengerId,
				expect.objectContaining({
					title: expect.stringContaining('Challenge Accepted'),
					body: expect.stringContaining('accepted your match challenge')
				})
			);

			// Verify socket broadcasts
			expect(mockIo.emit).toHaveBeenCalledWith(
				'challengeMatchCreated',
				expect.objectContaining({
					matchId: mockPost.challengeMatch.linkedMatchId,
					postId
				})
			);
			expect(mockIo.emit).toHaveBeenCalledWith(
				'challengeStatusChanged',
				expect.objectContaining({
					postId,
					matchStatus: 'accepted',
					linkedMatchId: mockPost.challengeMatch.linkedMatchId
				})
			);
		});

		it('rejects a 3rd party from accepting an already accepted challenge', async () => {
			const mockPost = {
				_id: postId,
				authorId: challengerId,
				category: 'challenge_match',
				challengeMatch: {
					matchStatus: 'accepted',
					challengerTeam: [{ userId: challengerId }],
					acceptedBy: [{ userId: opponentId, userName: 'Opponent Player' }]
				}
			};

			installPostStore(Post, mockPost);

			const res = await request(app)
				.put(`/api/forum/${postId}/accept-challenge`)
				.set('Authorization', `Bearer ${thirdPartyToken}`)
				.send({});

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/already been accepted/i);
		});
	});
});
