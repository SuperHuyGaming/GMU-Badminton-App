const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"abc123"'),
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
const userId = '660000000000000000000001';
const userToken = jwt.sign({ id: userId, userId: userId, role: 'user', name: 'TestPlayer' }, JWT_SECRET);

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

describe('Community Hub Phase 7: Interactive Reactions, Who Reacted Modal & Badminton Gamification', () => {
	const validPostId = '660000000000000000000099';

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('1. Reaction API (PUT /react and PUT /reaction)', () => {
		test('adds a Smash reaction and emits reactionUpdated socket event', async () => {
			const mockPostInstance = {
				_id: validPostId,
				authorId: '660000000000000000000002',
				reactions: [],
				save: jest.fn().mockResolvedValue(),
				toObject: function () {
					return {
						_id: this._id,
						authorId: this.authorId,
						reactions: this.reactions
					};
				}
			};

			Post.findById.mockResolvedValue(mockPostInstance);
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([
						{ _id: '660000000000000000000002', name: 'Author', profilePic: 'author.jpg', role: 'user' },
						{ _id: userId, name: 'TestPlayer', profilePic: 'player.jpg', role: 'user' }
					])
				})
			});

			const res = await request(app)
				.put(`/api/forum/${validPostId}/react`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '💥', reactionType: 'smash' });

			expect(res.status).toBe(200);
			expect(mockPostInstance.reactions.length).toBe(1);
			expect(mockPostInstance.reactions[0].emoji).toBe('💥');
			expect(mockPostInstance.save).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
				postId: validPostId,
				action: 'added',
				userId: userId
			}));
		});

		test('toggles off reaction when clicking the same emoji again', async () => {
			const mockPostInstance = {
				_id: validPostId,
				authorId: '660000000000000000000002',
				reactions: [
					{ userId: userId, userName: 'TestPlayer', emoji: '💥', reactionType: 'smash' }
				],
				save: jest.fn().mockResolvedValue(),
				toObject: function () {
					return {
						_id: this._id,
						authorId: this.authorId,
						reactions: this.reactions
					};
				}
			};

			Post.findById.mockResolvedValue(mockPostInstance);
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([])
				})
			});

			const res = await request(app)
				.put(`/api/forum/${validPostId}/reaction`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '💥' });

			expect(res.status).toBe(200);
			expect(mockPostInstance.reactions.length).toBe(0);
			expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
				postId: validPostId,
				action: 'removed'
			}));
		});

		test('switches reaction atomically when clicking a different emoji (Smash to Clutch)', async () => {
			const mockPostInstance = {
				_id: validPostId,
				authorId: '660000000000000000000002',
				reactions: [
					{ userId: userId, userName: 'TestPlayer', emoji: '💥', reactionType: 'smash' }
				],
				save: jest.fn().mockResolvedValue(),
				toObject: function () {
					return {
						_id: this._id,
						authorId: this.authorId,
						reactions: this.reactions
					};
				}
			};

			Post.findById.mockResolvedValue(mockPostInstance);
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([])
				})
			});

			const res = await request(app)
				.put(`/api/forum/${validPostId}/react`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '⚡', reactionType: 'clutch' });

			expect(res.status).toBe(200);
			expect(mockPostInstance.reactions.length).toBe(1);
			expect(mockPostInstance.reactions[0].emoji).toBe('⚡');
			expect(mockPostInstance.reactions[0].reactionType).toBe('clutch');
			expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
				action: 'updated'
			}));
		});

		test('returns 400 Bad Request for unapproved emoji characters', async () => {
			const res = await request(app)
				.put(`/api/forum/${validPostId}/react`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ emoji: '👽' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/Invalid emoji/i);
		});
	});
});
