const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../models/ActivityFeed');
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
const authorId = '660000000000000000000001';
const playerId = '660000000000000000000002';
const adminId = '660000000000000000000099';
const postId = '660000000000000000000010';

const tokenPlayer = jwt.sign({ id: playerId, userId: playerId, role: 'user', name: 'RallyPartner' }, JWT_SECRET);
const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'PostAuthor' }, JWT_SECRET);
const tokenAdmin = jwt.sign({ id: adminId, userId: adminId, role: 'admin', name: 'AdminCoach' }, JWT_SECRET);

const app = express();
app.use(express.json());

const mockIo = {
	emit: jest.fn(),
	to: jest.fn().mockReturnThis(),
};
app.set('io', mockIo);
app.use((req, res, next) => {
	req.io = mockIo;
	next();
});
app.use('/api/forum', forumRoutes);

describe('Phase 2: Specialized Post Workflows (Matchmaking, Challenges, Q&A, Gear)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: authorId, name: 'PostAuthor', profilePic: 'pic1.png' },
					{ _id: playerId, name: 'RallyPartner', profilePic: 'pic2.png' },
					{ _id: adminId, name: 'AdminCoach', profilePic: 'admin.png' },
				]),
			}),
		});
		User.findById.mockImplementation((id) => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({
					_id: id,
					name: id === authorId ? 'PostAuthor' : id === playerId ? 'RallyPartner' : 'AdminCoach',
					profilePic: `pic_${id}.png`
				})
			}),
			lean: jest.fn().mockResolvedValue({
				_id: id,
				name: id === authorId ? 'PostAuthor' : id === playerId ? 'RallyPartner' : 'AdminCoach',
				profilePic: `pic_${id}.png`
			})
		}));
	});

	describe('1. Schema Validation for Phase 2 Categories & Subdocuments', () => {
		const RealPost = jest.requireActual('../models/Post');

		it('has extended category enum including find_partner, challenge_match, qa_forum, gear_exchange', () => {
			const categoryPath = RealPost.schema.path('category');
			expect(categoryPath).toBeDefined();
			expect(categoryPath.enumValues).toEqual(
				expect.arrayContaining([
					'general',
					'match_result',
					'gear_review',
					'meetup_rally',
					'training',
					'find_partner',
					'challenge_match',
					'qa_forum',
					'gear_exchange'
				])
			);
		});

		it('has subdocument schemas defined on Post model', () => {
			expect(RealPost.schema.path('playerMatchmaking.format')).toBeDefined();
			expect(RealPost.schema.path('playerMatchmaking.slotsNeeded')).toBeDefined();
			expect(RealPost.schema.path('challengeMatch.matchStatus')).toBeDefined();
			expect(RealPost.schema.path('qaDetails.isResolved')).toBeDefined();
			expect(RealPost.schema.path('gearDetails.gearType')).toBeDefined();
		});
	});

	describe('2. Player Matchmaking (find_partner / meetup_rally)', () => {
		it('creates a matchmaking post with playerMatchmaking subdocument', async () => {
			const saveMock = jest.fn().mockResolvedValue();
			Post.mockImplementation(function (data) {
				Object.assign(this, data);
				this._id = postId;
				this.save = saveMock;
				this.toObject = () => ({ ...this });
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Need 1 for Doubles at RAC Court 2',
					content: 'Playing tonight 7pm-9pm. Intermediate level.',
					category: 'find_partner',
					playerMatchmaking: {
						format: 'Doubles',
						preferredCourt: 'RAC Courts 1-3',
						skillLevelRequired: 'Intermediate',
						slotsNeeded: 2,
						timeWindow: '7:00 PM - 9:00 PM'
					}
				});

			expect(res.status).toBe(201);
			expect(saveMock).toHaveBeenCalled();
			expect(res.body.category).toBe('find_partner');
			expect(res.body.playerMatchmaking.slotsNeeded).toBe(2);
			expect(res.body.playerMatchmaking.format).toBe('Doubles');
		});

		it('handles RSVP toggle: adds user to rsvpList and notifies author', async () => {
			const postInstance = {
				_id: postId,
				authorId,
				authorName: 'PostAuthor',
				category: 'find_partner',
				playerMatchmaking: {
					slotsNeeded: 2,
					rsvpList: [],
					isFilled: false
				},
				save: jest.fn().mockResolvedValue(),
				toObject: function () { return { ...this }; }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.post(`/api/forum/${postId}/rsvp`)
				.set('Authorization', `Bearer ${tokenPlayer}`)
				.send();

			expect(res.status).toBe(200);
			expect(postInstance.save).toHaveBeenCalled();
			expect(postInstance.playerMatchmaking.rsvpList).toHaveLength(1);
			expect(postInstance.playerMatchmaking.rsvpList[0].userId).toBe(playerId);
			expect(postInstance.playerMatchmaking.rsvpList[0].status).toBe('confirmed');
			expect(postInstance.playerMatchmaking.isFilled).toBe(false); // 1 of 2
			expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.any(Object));
		});

		it('handles RSVP toggle off: removes user from rsvpList', async () => {
			const postInstance = {
				_id: postId,
				authorId,
				authorName: 'PostAuthor',
				category: 'find_partner',
				playerMatchmaking: {
					slotsNeeded: 1,
					rsvpList: [{ userId: playerId, userName: 'RallyPartner', status: 'confirmed' }],
					isFilled: true
				},
				save: jest.fn().mockResolvedValue(),
				toObject: function () { return { ...this }; }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.post(`/api/forum/${postId}/rsvp`)
				.set('Authorization', `Bearer ${tokenPlayer}`)
				.send();

			expect(res.status).toBe(200);
			expect(postInstance.playerMatchmaking.rsvpList).toHaveLength(0);
			expect(postInstance.playerMatchmaking.isFilled).toBe(false);
		});
	});

	describe('3. Scrimmage & Match Challenges (challenge_match)', () => {
		it('creates a challenge post with challengeMatch details', async () => {
			const saveMock = jest.fn().mockResolvedValue();
			Post.mockImplementation(function (data) {
				Object.assign(this, data);
				this._id = postId;
				this.save = saveMock;
				this.toObject = () => ({ ...this });
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Ranked Challenge: Singles Best of 3',
					content: 'Looking for Advanced level player. Bring Victor Master No 1 shuttles.',
					category: 'challenge_match',
					challengeMatch: {
						matchType: 'Ranked Ladder Challenge',
						gameFormat: 'Best of 3 to 21',
						stipulations: 'Bring feathers'
					}
				});

			expect(res.status).toBe(201);
			expect(res.body.category).toBe('challenge_match');
			expect(res.body.challengeMatch.matchType).toBe('Ranked Ladder Challenge');
			expect(res.body.challengeMatch.matchStatus).toBe('open');
		});

		it('accepts a challenge and updates matchStatus to accepted', async () => {
			const postInstance = {
				_id: postId,
				authorId,
				authorName: 'PostAuthor',
				category: 'challenge_match',
				challengeMatch: {
					matchType: 'Friendly Scrimmage',
					gameFormat: 'Best of 3 to 21',
					matchStatus: 'open',
					challengerTeam: [{ userId: authorId, userName: 'PostAuthor' }],
					acceptedBy: []
				},
				save: jest.fn().mockResolvedValue(),
				toObject: function () { return { ...this }; }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.put(`/api/forum/${postId}/accept-challenge`)
				.set('Authorization', `Bearer ${tokenPlayer}`)
				.send();

			expect(res.status).toBe(200);
			expect(postInstance.challengeMatch.matchStatus).toBe('accepted');
			expect(postInstance.challengeMatch.acceptedBy).toHaveLength(1);
			expect(postInstance.challengeMatch.acceptedBy[0].userId).toBe(playerId);
			expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.any(Object));
		});

		it('prevents author from accepting their own challenge', async () => {
			const postInstance = {
				_id: postId,
				authorId,
				category: 'challenge_match',
				challengeMatch: { matchStatus: 'open', acceptedBy: [] }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.put(`/api/forum/${postId}/accept-challenge`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send();

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('cannot accept your own challenge');
		});
	});

	describe('4. Q&A Forum & Accepted Answer (qa_forum)', () => {
		const commentId = '660000000000000000000055';

		it('allows author to mark a comment as the accepted solution', async () => {
			const mockComment = {
				_id: commentId,
				authorId: playerId,
				authorName: 'RallyPartner',
				content: 'Try using BG80 string at 26 lbs with high repulsion.'
			};

			const mockCommentsList = [mockComment];
			mockCommentsList.id = jest.fn().mockReturnValue(mockComment);

			const postInstance = {
				_id: postId,
				authorId,
				category: 'qa_forum',
				comments: mockCommentsList,
				qaDetails: {
					subtopic: 'Rackets & Strings',
					isResolved: false,
					acceptedCommentId: ''
				},
				save: jest.fn().mockResolvedValue(),
				toObject: function () { return { ...this }; }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/accept-answer`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send();

			expect(res.status).toBe(200);
			expect(postInstance.qaDetails.isResolved).toBe(true);
			expect(postInstance.qaDetails.acceptedCommentId).toBe(commentId);
			expect(postInstance.qaDetails.acceptedBy.userId).toBe(authorId);
			expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.any(Object));
		});

		it('prevents unauthorized user from marking accepted answer', async () => {
			const postInstance = {
				_id: postId,
				authorId,
				category: 'qa_forum',
				comments: { id: jest.fn() }
			};
			Post.findById.mockResolvedValue(postInstance);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/accept-answer`)
				.set('Authorization', `Bearer ${tokenPlayer}`)
				.send();

			expect(res.status).toBe(403);
			expect(res.body.message).toContain('Only the post author or an admin');
		});
	});

	describe('5. Racket & Gear Exchange (gear_exchange / gear_review)', () => {
		it('creates a gear listing post with gearDetails subdocument', async () => {
			const saveMock = jest.fn().mockResolvedValue();
			Post.mockImplementation(function (data) {
				Object.assign(this, data);
				this._id = postId;
				this.save = saveMock;
				this.toObject = () => ({ ...this });
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Yonex Astrox 100ZZ (4UG5) - Mint Condition',
					content: 'Strung with Exbolt 65 at 27 lbs. Barely used.',
					category: 'gear_exchange',
					gearDetails: {
						gearType: 'Racket',
						brand: 'Yonex',
						condition: 'Mint',
						tradeType: 'For Sale',
						price: 180,
						specs: {
							weightCode: '4U',
							gripSize: 'G5',
							balancePoint: 'Head Heavy',
							currentString: 'Exbolt 65 @ 27 lbs'
						}
					}
				});

			expect(res.status).toBe(201);
			expect(res.body.category).toBe('gear_exchange');
			expect(res.body.gearDetails.price).toBe(180);
			expect(res.body.gearDetails.brand).toBe('Yonex');
			expect(res.body.gearDetails.specs.weightCode).toBe('4U');
		});
	});
});
