const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { evaluateSpamHeuristics, resetSpamDetectorState } = require('../utils/spamDetector');
const forumRoutes = require('../routes/forum');
const adminRoutes = require('../routes/admin');
const Post = require('../models/Post');
const User = require('../models/User');
const ActivityFeed = require('../models/ActivityFeed');

jest.mock('natural', () => ({
	BayesClassifier: jest.fn().mockImplementation(() => ({
		addDocument: jest.fn(),
		train: jest.fn(),
		classify: jest.fn((text) => {
			if (text.includes('free money')) return 'spam';
			return 'ham';
		}),
	})),
}));
jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/ActivityFeed');
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue(),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const user1Id = '660000000000000000000001';
const user2Id = '660000000000000000000002';
const user3Id = '660000000000000000000003';
const user4Id = '660000000000000000000004';
const adminId = '660000000000000000000099';

const tokenUser1 = jwt.sign({ id: user1Id, userId: user1Id, role: 'user', name: 'User One' }, JWT_SECRET);
const tokenUser2 = jwt.sign({ id: user2Id, userId: user2Id, role: 'user', name: 'User Two' }, JWT_SECRET);
const tokenUser3 = jwt.sign({ id: user3Id, userId: user3Id, role: 'user', name: 'User Three' }, JWT_SECRET);
const tokenUser4 = jwt.sign({ id: user4Id, userId: user4Id, role: 'user', name: 'User Four' }, JWT_SECRET);
const tokenAdmin = jwt.sign({ id: adminId, userId: adminId, role: 'admin', name: 'Admin User' }, JWT_SECRET);

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
app.use('/api/admin', adminRoutes);

describe('Problem 16: Feed Anti-Spam & Automated Community Quarantine', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		resetSpamDetectorState();
	});

	describe('1. Spam Detection Heuristics Unit Engine', () => {
		it('allows clean, normal badminton community posts', async () => {
			const res = await evaluateSpamHeuristics({
				userId: user1Id,
				title: 'Casual games at RAC Court 2 this Saturday',
				content: 'Hey everyone, looking for 2 players for doubles from 10am to 12pm. Bring feather shuttles!',
			});
			expect(res.isSpam).toBe(false);
			expect(res.heuristic).toBe('none');
		});

		it('detects duplicate content posted within sliding window', async () => {
			const postData = {
				userId: user1Id,
				title: 'Identical repeated title',
				content: 'This is identical content posted twice by the same user to flood the feed.',
			};

			const first = await evaluateSpamHeuristics(postData);
			expect(first.isSpam).toBe(false);

			const second = await evaluateSpamHeuristics(postData);
			expect(second.isSpam).toBe(true);
			expect(second.heuristic).toBe('duplicate_content');
			expect(second.reason).toContain('Duplicate content detected');
		});

		it('detects excessive URLs (>2 external links)', async () => {
			const res = await evaluateSpamHeuristics({
				userId: user2Id,
				title: 'Check out these three racket websites',
				content: 'Link 1: https://example.com/racket1 and Link 2: https://example.com/racket2 plus Link 3: https://example.com/racket3',
			});
			expect(res.isSpam).toBe(true);
			expect(res.heuristic).toBe('excessive_urls');
			expect(res.reason).toContain('Excessive links detected');
		});

		it('enforces sliding-window rate limit (max 3 posts per 60 seconds per user)', async () => {
			const postA = { userId: user3Id, title: 'Post 1', content: 'Message 1 with distinct text' };
			const postB = { userId: user3Id, title: 'Post 2', content: 'Message 2 with distinct text' };
			const postC = { userId: user3Id, title: 'Post 3', content: 'Message 3 with distinct text' };
			const postD = { userId: user3Id, title: 'Post 4', content: 'Message 4 with distinct text' };

			expect((await evaluateSpamHeuristics(postA)).isSpam).toBe(false);
			expect((await evaluateSpamHeuristics(postB)).isSpam).toBe(false);
			expect((await evaluateSpamHeuristics(postC)).isSpam).toBe(false);

			const fourth = await evaluateSpamHeuristics(postD);
			expect(fourth.isSpam).toBe(true);
			expect(fourth.heuristic).toBe('rate_limit');
			expect(fourth.reason).toContain('Rate limit exceeded');
		});

		it('detects commercial spam keywords', async () => {
			const res = await evaluateSpamHeuristics({
				userId: user4Id,
				title: 'Free Money Opportunity',
				content: 'Earn cash fast and buy cheap crypto right now at casino investment returns!',
			});
			expect(res.isSpam).toBe(true);
			expect(res.heuristic).toBe('spam_keywords');
		});
	});

	describe('2. Post Creation & Quarantine Submission Route', () => {
		it('quarantines posts containing commercial spam keywords and returns HTTP 201 review notice', async () => {
			let savedDoc = null;
			Post.mockImplementation(function (data) {
				Object.assign(this, data);
				this._id = '660000000000000000000111';
				this.save = jest.fn().mockImplementation(async () => {
					savedDoc = this;
					return this;
				});
				this.toObject = jest.fn().mockReturnValue(this);
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.send({
					title: 'Free Money Fast',
					content: 'Earn cash fast and buy cheap crypto here!',
					targetDate: 'General',
				});

			expect(res.statusCode).toBe(201);
			expect(res.body.message).toContain('submitted for review');
			expect(savedDoc.status).toBe('quarantined');
			expect(savedDoc.isFlagged).toBe(true);
		});
	});

	describe('3. Community Post Reporting & 3-Report Auto-Quarantine Trigger', () => {
		const targetPostId = '660000000000000000000888';

		it('blocks author from reporting their own post (HTTP 400)', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId: user1Id,
				reports: [],
				reportCount: 0,
				status: 'active',
				isFlagged: false,
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set('Authorization', `Bearer ${tokenUser1}`)
				.send({ reason: 'Self reporting test' });

			expect(res.statusCode).toBe(400);
			expect(res.body.message).toContain('cannot report your own post');
		});

		it('blocks duplicate report from the same user (HTTP 400)', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId: user1Id,
				reports: [{ reportedBy: user2Id, reason: 'Duplicate test', timestamp: new Date() }],
				reportCount: 1,
				status: 'active',
				isFlagged: false,
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set('Authorization', `Bearer ${tokenUser2}`)
				.send({ reason: 'Duplicate report attempt' });

			expect(res.statusCode).toBe(400);
			expect(res.body.message).toContain('already reported this post');
		});

		it('increments reportCount on 1st and 2nd reports while maintaining active status', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId: user1Id,
				reports: [],
				reportCount: 0,
				status: 'active',
				isFlagged: false,
				save: jest.fn().mockResolvedValue(true),
			};
			Post.findById.mockResolvedValue(mockPost);

			// First report by User 2
			const res1 = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set('Authorization', `Bearer ${tokenUser2}`)
				.send({ reason: 'Inappropriate language' });

			expect(res1.statusCode).toBe(200);
			expect(res1.body.reportCount).toBe(1);
			expect(res1.body.status).toBe('active');
			expect(mockPost.status).toBe('active');
			expect(mockPost.isFlagged).toBe(false);

			// Second report by User 3
			const res2 = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set('Authorization', `Bearer ${tokenUser3}`)
				.send({ reason: 'Offensive comments' });

			expect(res2.statusCode).toBe(200);
			expect(res2.body.reportCount).toBe(2);
			expect(res2.body.status).toBe('active');
			expect(mockPost.status).toBe('active');
			expect(mockPost.isFlagged).toBe(false);
		});

		it('automatically quarantines post upon 3rd distinct report and emits socket events', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId: user1Id,
				reports: [
					{ reportedBy: user2Id, reason: 'Report 1', timestamp: new Date() },
					{ reportedBy: user3Id, reason: 'Report 2', timestamp: new Date() },
				],
				reportCount: 2,
				status: 'active',
				isFlagged: false,
				save: jest.fn().mockResolvedValue(true),
			};
			Post.findById.mockResolvedValue(mockPost);

			// Third report by User 4
			const res = await request(app)
				.post(`/api/forum/${targetPostId}/report`)
				.set('Authorization', `Bearer ${tokenUser4}`)
				.send({ reason: 'Harassment/Spam' });

			expect(res.statusCode).toBe(200);
			expect(res.body.reportCount).toBe(3);
			expect(res.body.status).toBe('quarantined');
			expect(res.body.message).toContain('quarantined for moderator review');
			expect(mockPost.status).toBe('quarantined');
			expect(mockPost.isFlagged).toBe(true);

			// Verify socket notifications were emitted
			expect(mockIo.emit).toHaveBeenCalledWith('postQuarantined', {
				postId: targetPostId,
				reportCount: 3,
			});
			expect(mockIo.emit).toHaveBeenCalledWith('postDeleted', targetPostId);
		});
	});

	describe('4. Feed Query Isolation', () => {
		it('strictly isolates public feed queries from quarantined and deleted posts', async () => {
			let capturedQuery = null;
			Post.find = jest.fn().mockImplementation((q) => {
				capturedQuery = q;
				return {
					sort: jest.fn().mockReturnThis(),
					skip: jest.fn().mockReturnThis(),
					limit: jest.fn().mockReturnThis(),
					lean: jest.fn().mockResolvedValue([]),
				};
			});

			await request(app).get('/api/forum');

			expect(capturedQuery).toBeDefined();
			expect(capturedQuery.isFlagged).toEqual({ $ne: true });
			expect(capturedQuery.status).toEqual({ $nin: ['quarantined', 'deleted'] });
		});
	});

	describe('5. Admin Review, Reinstatement & Deletion', () => {
		const quarantinedId = '660000000000000000000555';

		it('fetches quarantined posts including reports population for admin review', async () => {
			const mockFlagged = [{ _id: quarantinedId, status: 'quarantined', reportCount: 3 }];
			Post.find = jest.fn().mockImplementation((q) => {
				return {
					populate: jest.fn().mockReturnValue({
						sort: jest.fn().mockResolvedValue(mockFlagged),
					}),
				};
			});

			const res = await request(app)
				.get('/api/admin/flagged')
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.statusCode).toBe(200);
			expect(res.body).toEqual(mockFlagged);
		});

		it('reinstates quarantined post to active status and clears reports upon admin approval', async () => {
			const mockQuarantinedPost = {
				_id: quarantinedId,
				status: 'quarantined',
				isFlagged: true,
				reportCount: 3,
				reports: [{ reportedBy: user2Id, reason: 'Test' }],
				save: jest.fn().mockResolvedValue(true),
			};
			Post.findById.mockResolvedValue(mockQuarantinedPost);

			const res = await request(app)
				.put(`/api/admin/flagged/${quarantinedId}/approve`)
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.statusCode).toBe(200);
			expect(res.body.message).toContain('approved and reinstated');
			expect(mockQuarantinedPost.isFlagged).toBe(false);
			expect(mockQuarantinedPost.status).toBe('active');
			expect(mockQuarantinedPost.reportCount).toBe(0);
			expect(mockQuarantinedPost.reports).toEqual([]);
			expect(mockQuarantinedPost.save).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('postCreated', mockQuarantinedPost);
		});

		it('permanently marks post as deleted and removes from ActivityFeed', async () => {
			const deletedPost = { _id: quarantinedId, status: 'deleted' };
			Post.findByIdAndUpdate.mockResolvedValue(deletedPost);
			ActivityFeed.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

			const res = await request(app)
				.delete(`/api/admin/posts/${quarantinedId}`)
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.statusCode).toBe(200);
			expect(res.body.message).toContain('permanently deleted');
			expect(ActivityFeed.deleteOne).toHaveBeenCalledWith({
				type: 'post',
				referenceId: quarantinedId,
			});
			expect(mockIo.emit).toHaveBeenCalledWith('postDeleted', quarantinedId);
		});
	});
});
