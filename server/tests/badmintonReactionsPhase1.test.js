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
const reactorId = '660000000000000000000002';
const postId = '660000000000000000000010';

const tokenReactor = jwt.sign({ id: reactorId, userId: reactorId, role: 'user', name: 'SmashMaster' }, JWT_SECRET);
const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'PostAuthor' }, JWT_SECRET);

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

describe('Phase 1: Authentic Badminton Reaction Trio & Post Categorization', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: authorId, name: 'PostAuthor', profilePic: 'pic1.png' },
					{ _id: reactorId, name: 'SmashMaster', profilePic: 'pic2.png' },
				]),
			}),
		});
	});

	describe('1. Post Schema & Model Verification', () => {
		const RealPost = jest.requireActual('../models/Post');

		it('has the updated category enum with general default', () => {
			const categoryPath = RealPost.schema.path('category');
			expect(categoryPath).toBeDefined();
			expect(categoryPath.enumValues).toEqual(
				expect.arrayContaining(['general', 'match_result', 'gear_review', 'meetup_rally', 'training'])
			);
			expect(categoryPath.defaultValue).toBe('general');
		});

		it('has the matchDetails subdocument with all required fields', () => {
			expect(RealPost.schema.path('matchDetails.partner')).toBeDefined();
			expect(RealPost.schema.path('matchDetails.opponents')).toBeDefined();
			expect(RealPost.schema.path('matchDetails.score')).toBeDefined();
			expect(RealPost.schema.path('matchDetails.court')).toBeDefined();
			expect(RealPost.schema.path('matchDetails.winner')).toBeDefined();
		});

		it('has reactions array supporting reactionType and backward-compatible fields', () => {
			const reactionsPath = RealPost.schema.path('reactions');
			expect(reactionsPath).toBeDefined();
			expect(RealPost.schema.path('reactions.reactionType')).toBeDefined();
			expect(RealPost.schema.path('reactions.emoji')).toBeDefined();
			expect(RealPost.schema.path('reactions.userId')).toBeDefined();
			expect(RealPost.schema.path('reactions.userName')).toBeDefined();
			expect(RealPost.schema.path('reactions.createdAt')).toBeDefined();
		});

		it('defines compound indexes for performance and category querying', () => {
			const indexes = RealPost.schema.indexes();
			const statusPinnedIndex = indexes.find(
				([idx]) => idx.status === 1 && idx.isPinned === -1 && idx.createdAt === -1
			);
			const categoryIndex = indexes.find(
				([idx]) => idx.category === 1 && idx.createdAt === -1
			);
			const tagsIndex = indexes.find(
				([idx]) => idx.tags === 1 && idx.createdAt === -1
			);

			expect(statusPinnedIndex).toBeDefined();
			expect(categoryIndex).toBeDefined();
			expect(tagsIndex).toBeDefined();
		});
	});

	describe('2. Badminton Reaction Trio API (PUT /api/forum/:postId/react)', () => {
		it('allows reacting with 💥 Smash, saves reactionType smash, and notifies author', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				authorName: 'PostAuthor',
				reactions: [],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return {
						_id: this._id,
						authorId: this.authorId,
						authorName: this.authorName,
						reactions: this.reactions,
					};
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);
			Notification.mockImplementation(function (data) {
				return {
					...data,
					save: jest.fn().mockResolvedValue(true),
				};
			});

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '💥' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.save).toHaveBeenCalled();
			expect(mockPostDoc.reactions.length).toBe(1);
			expect(mockPostDoc.reactions[0]).toMatchObject({
				userId: reactorId,
				emoji: '💥',
				reactionType: 'smash',
			});

			// Verify author notification text: "SmashMaster smashed your post."
			expect(mockIo.to).toHaveBeenCalledWith(authorId);
			expect(mockIo.emit).toHaveBeenCalledWith(
				'newNotification',
				expect.objectContaining({
					message: expect.stringContaining('smashed your post.'),
				})
			);
		});

		it('allows reacting with 🧊 Ice Drop and creates specific notification', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				reactions: [],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '🧊' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.reactions[0].reactionType).toBe('ice_drop');
			expect(mockIo.emit).toHaveBeenCalledWith(
				'newNotification',
				expect.objectContaining({
					message: expect.stringContaining('dropped on your post.'),
				})
			);
		});

		it('allows reacting with ⚡ Clutch and creates specific notification', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				reactions: [],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '⚡' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.reactions[0].reactionType).toBe('clutch');
			expect(mockIo.emit).toHaveBeenCalledWith(
				'newNotification',
				expect.objectContaining({
					message: expect.stringContaining('marked your post as clutch.'),
				})
			);
		});

		it('toggles off reaction when clicking the same reaction again', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				reactions: [
					{ userId: reactorId, emoji: '💥', reactionType: 'smash' }
				],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return { _id: this._id, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '💥' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.reactions.length).toBe(0);
		});

		it('switches reaction without duplicates when clicking a different reaction', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				reactions: [
					{ userId: reactorId, emoji: '💥', reactionType: 'smash' }
				],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return { _id: this._id, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '⚡' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.reactions.length).toBe(1);
			expect(mockPostDoc.reactions[0].emoji).toBe('⚡');
			expect(mockPostDoc.reactions[0].reactionType).toBe('clutch');
		});

		it('rejects invalid emojis with 400 status', async () => {
			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '🍕' });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('Invalid emoji');
		});
	});

	describe('3. Category & Match Details Creation (POST & PUT /api/forum)', () => {
		it('creates post with category match_result and matchDetails', async () => {
			let savedPostData = null;
			Post.mockImplementation(function (data) {
				savedPostData = data;
				return {
					...data,
					_id: postId,
					save: jest.fn().mockResolvedValue(true),
					toObject: function () {
						return { ...data, _id: postId };
					},
				};
			});

			const payload = {
				title: 'Intense Singles Finals at RAC',
				content: 'Took the match in three thrilling sets!',
				category: 'match_result',
				matchDetails: {
					partner: 'Alex Wong',
					opponents: ['David Kim', 'Chris Lee'],
					score: '21-19, 18-21, 22-20',
					court: 'RAC Court 1',
					winner: 'Team Us',
				},
			};

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send(payload);

			expect(res.status).toBe(201);
			expect(savedPostData.category).toBe('match_result');
			expect(savedPostData.matchDetails).toMatchObject({
				partner: 'Alex Wong',
				opponents: ['David Kim', 'Chris Lee'],
				score: '21-19, 18-21, 22-20',
				court: 'RAC Court 1',
				winner: 'Team Us',
			});
		});

		it('rejects post creation with invalid category', async () => {
			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Bad Category Post',
					content: 'Testing invalid enum category',
					category: 'non_existent_category',
				});

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('Invalid category');
		});

		it('updates category and matchDetails via PUT /:postId', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				title: 'Old Title',
				content: 'Old Content',
				category: 'general',
				matchDetails: {},
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return {
						_id: this._id,
						title: this.title,
						content: this.content,
						category: this.category,
						matchDetails: this.matchDetails,
					};
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const updatePayload = {
				title: 'Updated Match Score',
				content: 'Corrected the 3rd set score',
				category: 'match_result',
				matchDetails: {
					score: '21-15, 21-17',
					court: 'Court 4',
				},
			};

			const res = await request(app)
				.put(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send(updatePayload);

			expect(res.status).toBe(200);
			expect(mockPostDoc.title).toBe('Updated Match Score');
			expect(mockPostDoc.category).toBe('match_result');
			expect(mockPostDoc.matchDetails.score).toBe('21-15, 21-17');
			expect(mockPostDoc.matchDetails.court).toBe('Court 4');
		});

		it('parses comma-separated opponents string into an array of trimmed names', async () => {
			let savedPostData = null;
			Post.mockImplementation(function (data) {
				savedPostData = data;
				return {
					...data,
					_id: postId,
					save: jest.fn().mockResolvedValue(true),
					toObject: function () {
						return { ...data, _id: postId };
					},
				};
			});

			const payload = {
				title: 'Doubles match with comma opponents',
				content: 'Great match today',
				category: 'match_result',
				matchDetails: {
					opponents: 'David Kim, Chris Lee ,  Mark Shen ',
				},
			};

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send(payload);

			expect(res.status).toBe(201);
			expect(savedPostData.matchDetails.opponents).toEqual(['David Kim', 'Chris Lee', 'Mark Shen']);
		});

		it('allows reacting with { reactionType: "clutch" } without emoji payload', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				reactions: [],
				save: jest.fn().mockResolvedValue(true),
				toObject: function () {
					return { _id: this._id, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ reactionType: 'clutch' });

			expect(res.status).toBe(200);
			expect(mockPostDoc.reactions[0].emoji).toBe('⚡');
			expect(mockPostDoc.reactions[0].reactionType).toBe('clutch');
		});

		it('supports case-insensitive category filtering in GET /api/forum', async () => {
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?category=MATCH_RESULT');
			expect(res.status).toBe(200);
			expect(Post.find).toHaveBeenCalledWith(
				expect.objectContaining({
					category: 'match_result',
				})
			);
		});
	});
});
