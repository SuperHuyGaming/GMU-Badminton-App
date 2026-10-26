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
	set: jest.fn().mockReturnValue('W/"test-etag-phase10"'),
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
const secondUserId = '660000000000000000000002';
const adminUserId = '660000000000000000000099';

const userToken = jwt.sign({ id: regularUserId, userId: regularUserId, role: 'user', name: 'Regular User' }, JWT_SECRET);
const secondUserToken = jwt.sign({ id: secondUserId, userId: secondUserId, role: 'user', name: 'Second User' }, JWT_SECRET);
const adminToken = jwt.sign({ id: adminUserId, userId: adminUserId, role: 'admin', name: 'Executive Admin' }, JWT_SECRET);

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

describe('Community Hub Phase 10: Master End-to-End Regression & Quality Gate Suite', () => {
	const validPostId = '660000000000000000000100';
	const validFeedId = '660000000000000000000200';
	const validCommentId = '660000000000000000000300';

	beforeEach(() => {
		jest.clearAllMocks();
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: regularUserId, name: 'Regular User', profilePic: 'user.jpg', role: 'user', badges: ['regular'] },
					{ _id: secondUserId, name: 'Second User', profilePic: 'second.jpg', role: 'user', badges: [] },
					{ _id: adminUserId, name: 'Executive Admin', profilePic: 'admin.jpg', role: 'admin', badges: ['admin', 'moderator'] }
				])
			})
		});
		User.findById.mockImplementation((id) => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue(
					id === adminUserId
						? { _id: adminUserId, name: 'Executive Admin', role: 'admin' }
						: { _id: regularUserId, name: 'Regular User', role: 'user' }
				)
			})
		}));
	});

	describe('1. Specialized Badminton Post Creation Workflows', () => {
		test('POST / creates a specialized gear review post with racket specs and invalidates feed cache', async () => {
			const savedPostData = {
				_id: validPostId,
				title: 'Yonex Astrox 88D Pro Review',
				content: 'Head-heavy power racket strung at 28 lbs with BG80.',
				category: 'gear_review',
				gearDetails: {
					gearType: 'Racket',
					brand: 'Yonex',
					condition: 'New',
					price: 230,
					specs: {
						weightGrip: '4U/G5',
						balancePoint: 'Head Heavy',
						stringTension: 28,
						currentString: 'BG80'
					}
				},
				authorId: regularUserId,
				authorName: 'Regular User',
				reactions: [],
				likedBy: [],
				comments: [],
				createdAt: new Date()
			};

			Post.mockImplementation(function (data) {
				Object.assign(this, data, { _id: validPostId });
				this.save = jest.fn().mockResolvedValue(this);
				this.toObject = jest.fn().mockReturnValue(savedPostData);
			});

			ActivityFeed.create = jest.fn().mockResolvedValue({ _id: validFeedId });

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					title: 'Yonex Astrox 88D Pro Review',
					content: 'Head-heavy power racket strung at 28 lbs with BG80.',
					category: 'gear_review',
					gearDetails: {
						gearType: 'Racket',
						brand: 'Yonex',
						condition: 'New',
						price: 230,
						specs: {
							weightGrip: '4U/G5',
							balancePoint: 'Head Heavy',
							stringTension: 28,
							currentString: 'BG80'
						}
					}
				});

			expect(res.status).toBe(201);
			expect(res.body.title).toBe('Yonex Astrox 88D Pro Review');
			expect(res.body.category).toBe('gear_review');
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('postCreated', expect.objectContaining({ title: 'Yonex Astrox 88D Pro Review' }));
		});

		test('POST / rejects posts missing a title with 400 Bad Request', async () => {
			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					content: 'Missing a title here',
					category: 'general'
				});

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/title is required/i);
		});

		test('POST / rejects unauthorized requests without JWT token with 401 Unauthorized', async () => {
			const res = await request(app)
				.post('/api/forum')
				.send({
					title: 'Sneaky post',
					content: 'No auth token provided'
				});

			expect(res.status).toBe(401);
		});
	});

	describe('2. Multi-Reaction Trio & Atomic Switching', () => {
		test('PUT /:postId/react atomically toggles and switches reactions', async () => {
			const mockPost = {
				_id: validPostId,
				authorId: secondUserId,
				reactions: [{ userId: regularUserId, emoji: '💥', reactionType: 'smash' }],
				likedBy: [],
				toObject: () => ({
					_id: validPostId,
					reactions: [{ userId: regularUserId, emoji: '🔥', reactionType: 'fire' }]
				}),
				save: jest.fn().mockResolvedValue(true)
			};

			Post.findById.mockImplementation((id) => (id === validPostId ? mockPost : null));
			ActivityFeed.findById.mockResolvedValue(null);
			ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });

			// Switch from Smash to Fire
			const res = await request(app)
				.put(`/api/forum/${validPostId}/react`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '🔥' });

			expect(res.status).toBe(200);
			expect(mockPost.save).toHaveBeenCalled();
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
				postId: validPostId,
				userId: regularUserId,
				reactions: expect.any(Array)
			}));
		});
	});

	describe('3. Threaded Comments & OP Q&A Verification', () => {
		test('PUT /:postId/comments/:commentId/accept-answer allows OP to accept an answer on a Q&A post', async () => {
			const mockComment = {
				_id: validCommentId,
				authorId: secondUserId,
				content: 'Use an attacking clear to push the opponent back.',
				replies: []
			};

			const mockPost = {
				_id: validPostId,
				authorId: regularUserId, // regularUser is the OP
				category: 'qa_forum',
				qaDetails: {
					isResolved: false,
					acceptedCommentId: ''
				},
				comments: [mockComment],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return {
						_id: this._id,
						authorId: this.authorId,
						category: this.category,
						qaDetails: this.qaDetails,
						comments: this.comments
					};
				}
			};
			mockPost.comments.id = (id) => (id === validCommentId ? mockComment : null);

			Post.findById.mockImplementation((id) => (id === validPostId ? mockPost : null));

			const res = await request(app)
				.put(`/api/forum/${validPostId}/comments/${validCommentId}/accept-answer`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({});

			expect(res.status).toBe(200);
			expect(mockPost.qaDetails.isResolved).toBe(true);
			expect(mockPost.qaDetails.acceptedCommentId).toBe(validCommentId);
			expect(mockPost.save).toHaveBeenCalled();
		});

		test('PUT /:postId/comments/:commentId/accept-answer forbids non-OP from accepting answers with 403', async () => {
			const mockComment = {
				_id: validCommentId,
				authorId: 'other-user',
				content: 'Some answer'
			};

			const mockPost = {
				_id: validPostId,
				authorId: regularUserId, // regularUser is OP
				category: 'qa_forum',
				qaDetails: {
					isResolved: false
				},
				comments: [mockComment]
			};
			mockPost.comments.id = (id) => (id === validCommentId ? mockComment : null);

			Post.findById.mockImplementation((id) => (id === validPostId ? mockPost : null));

			// secondUser tries to accept answer
			const res = await request(app)
				.put(`/api/forum/${validPostId}/comments/${validCommentId}/accept-answer`)
				.set('Authorization', `Bearer ${secondUserToken}`)
				.send({});

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/only the post author/i);
		});
	});

	describe('4. Matchmaking RSVPs & Match Challenges', () => {
		test('POST /:postId/rsvp toggles RSVP participation cleanly', async () => {
			const mockPost = {
				_id: validPostId,
				authorId: secondUserId,
				category: 'find_partner',
				playerMatchmaking: {
					slotsNeeded: 4,
					rsvpList: []
				},
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return {
						_id: this._id,
						playerMatchmaking: this.playerMatchmaking
					};
				}
			};

			Post.findById.mockImplementation((id) => (id === validPostId ? mockPost : null));
			ActivityFeed.findById.mockResolvedValue(null);
			ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });

			const res = await request(app)
				.post(`/api/forum/${validPostId}/rsvp`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({});

			expect(res.status).toBe(200);
			expect(mockPost.save).toHaveBeenCalled();
			expect(mockPost.playerMatchmaking.rsvpList).toContainEqual(
				expect.objectContaining({ userId: regularUserId, status: 'confirmed' })
			);
		});

		test('PUT /:postId/accept-challenge allows opponent to accept match challenge', async () => {
			const mockPost = {
				_id: validPostId,
				authorId: regularUserId, // regularUser created the challenge
				authorName: 'Regular User',
				challengeMatch: {
					matchType: 'Singles',
					matchStatus: 'open',
					challengerTeam: [{ userId: regularUserId, userName: 'Regular User' }],
					acceptedBy: []
				},
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return {
						_id: this._id,
						challengeMatch: this.challengeMatch
					};
				}
			};

			Post.findById.mockImplementation((id) => (id === validPostId ? mockPost : null));

			// secondUser accepts the challenge
			const res = await request(app)
				.put(`/api/forum/${validPostId}/accept-challenge`)
				.set('Authorization', `Bearer ${secondUserToken}`)
				.send({});

			expect(res.status).toBe(200);
			expect(mockPost.challengeMatch.matchStatus).toBe('accepted');
			expect(mockPost.challengeMatch.acceptedBy).toContainEqual(
				expect.objectContaining({ userId: secondUserId })
			);
			expect(mockPost.save).toHaveBeenCalled();
		});
	});

	describe('5. Admin Safety & Moderation Queue Access Control', () => {
		test('GET /reports strictly forbids non-admin users with 403 Forbidden', async () => {
			const res = await request(app)
				.get('/api/forum/reports')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/admins only/i);
		});

		test('GET /reports returns quarantined and flagged posts to verified admins', async () => {
			const flaggedPost = {
				_id: validPostId,
				title: 'Questionable Post',
				content: 'Check out spam link',
				status: 'quarantined',
				isFlagged: true,
				flagCount: 3,
				authorId: regularUserId,
				reports: [{ reportedBy: { name: 'Player One' }, reason: 'Spam / Advertising', createdAt: new Date() }]
			};

			Post.find.mockReturnValue({
				populate: jest.fn().mockReturnValue({
					sort: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([flaggedPost])
					})
				})
			});

			const res = await request(app)
				.get('/api/forum/reports')
				.set('Authorization', `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body[0].title).toBe('Questionable Post');
		});

		test('PUT /reports/:postId/resolve allows admin to approve post, dismissing flags and restoring to active', async () => {
			const flaggedPost = {
				_id: validPostId,
				status: 'quarantined',
				isFlagged: true,
				flagCount: 2,
				reports: [{ reason: 'Spam' }],
				save: jest.fn().mockResolvedValue(true),
				toObject: () => ({ _id: validPostId, status: 'active', isFlagged: false, reports: [] })
			};

			Post.findById.mockImplementation((id) => (id === validPostId ? flaggedPost : null));
			ActivityFeed.updateOne.mockResolvedValue({ modifiedCount: 1 });

			const res = await request(app)
				.put(`/api/forum/reports/${validPostId}/resolve`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ action: 'approve' });

			expect(res.status).toBe(200);
			expect(flaggedPost.status).toBe('active');
			expect(flaggedPost.isFlagged).toBe(false);
			expect(flaggedPost.reports).toEqual([]);
			expect(flaggedPost.save).toHaveBeenCalled();
			expect(feedCache.invalidateFeed).toHaveBeenCalled();
		});
	});
});
