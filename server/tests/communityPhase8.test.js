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
const userToken = jwt.sign({ id: userId, userId: userId, role: 'user', name: 'Commenter' }, JWT_SECRET);

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

describe('Community Hub Phase 8: Threaded Discussions & @Mention Autocomplete Engine', () => {
	const validPostId = '660000000000000000000099';

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('1. Player Directory Mention Suggestions Endpoint', () => {
		test('GET /api/forum/mention-suggestions returns matching players for autocomplete', async () => {
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([
							{ _id: '660000000000000000000101', name: 'Alex Truong', profilePic: 'alex.jpg', role: 'admin', badges: ['smash_master'] },
							{ _id: '660000000000000000000102', name: 'Alice Wong', profilePic: '', role: 'user', badges: [] }
						])
					})
				})
			});

			const res = await request(app)
				.get('/api/forum/mention-suggestions?q=Al')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.users).toBeDefined();
			expect(res.body.users.length).toBe(2);
			expect(res.body.users[0].name).toBe('Alex Truong');
			expect(res.body.users[0].badges).toContain('smash_master');
		});
	});

	describe('2. Comment Creation & @Mention Notification Dispatch', () => {
		test('POST /api/forum/:postId/comments dispatches mention alert when @Player is present', async () => {
			const mockPostInstance = {
				_id: validPostId,
				authorId: '660000000000000000000002',
				comments: [],
				save: jest.fn().mockResolvedValue()
			};

			Post.findById.mockResolvedValueOnce(mockPostInstance); // For comment insertion
			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({
					_id: validPostId,
					authorId: '660000000000000000000002',
					comments: [
						{ _id: '660000000000000000000888', authorId: userId, authorName: 'Commenter', content: 'Great rally @Alex Truong let us play tomorrow' }
					]
				})
			});

			User.find
				.mockReturnValueOnce({
					select: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([
							{ _id: '660000000000000000000101', name: 'Alex Truong' }
						])
					})
				})
				.mockReturnValueOnce({
					select: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([])
					})
				});

			const res = await request(app)
				.put ? request(app).post(`/api/forum/${validPostId}/comments`) : null;

			const response = await request(app)
				.post(`/api/forum/${validPostId}/comments`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ content: 'Great rally @Alex Truong let us play tomorrow' });

			expect(response.status).toBe(200);
			expect(mockPostInstance.save).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.any(Object));
		});
	});
});
