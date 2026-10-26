const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/kafkaProducer', () => ({
	publishEvent: jest.fn().mockResolvedValue(),
}));
const mockAnalyzeContent = jest.fn();
jest.mock('../utils/aiModeration', () => ({
	analyzeContent: (...args) => mockAnalyzeContent(...args),
}));
jest.mock('../utils/spamDetector', () => ({
	evaluateSpamHeuristics: jest.fn().mockResolvedValue({ isSpam: false, score: 0 }),
}));

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const userId = '660000000000000000000001';
const otherUserId = '660000000000000000000002';
const thirdUserId = '660000000000000000000003';
const userToken = jwt.sign({ id: userId, userId: userId, role: 'user', name: 'TestPlayer' }, JWT_SECRET);
const otherToken = jwt.sign({ id: otherUserId, userId: otherUserId, role: 'user', name: 'OtherPlayer' }, JWT_SECRET);
const thirdToken = jwt.sign({ id: thirdUserId, userId: thirdUserId, role: 'user', name: 'ThirdPlayer' }, JWT_SECRET);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
	req.io = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
	next();
});
app.use('/api/forum', forumRoutes);

describe('Community Hub Phase 4: Social Sharing, URL Deep-Linking, Nested Discussions, and Moderation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockAnalyzeContent.mockResolvedValue({ isFlagged: false, score: 0 });

		User.findById.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({
					_id: userId,
					name: 'TestPlayer',
					role: 'user',
					badges: ['top_contributor'],
					stats: { winStreak: 3 },
					bookmarkedPosts: []
				})
			}),
			lean: jest.fn().mockResolvedValue({
				_id: userId,
				name: 'TestPlayer',
				role: 'user',
				badges: ['top_contributor'],
				stats: { winStreak: 3 },
				bookmarkedPosts: []
			})
		});

		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([
					{ _id: userId, name: 'TestPlayer', profilePic: 'pic1.jpg', role: 'admin', badges: ['club_executive'], stats: { winStreak: 5 } },
					{ _id: otherUserId, name: 'OtherPlayer', profilePic: 'pic2.jpg', role: 'user', badges: [], stats: { winStreak: 0 } },
					{ _id: thirdUserId, name: 'ThirdPlayer', profilePic: 'pic3.jpg', role: 'user', badges: ['tournament_director'], stats: { winStreak: 2 } },
				])
			})
		});
	});

	describe('1. Post Reporting and Auto-Quarantine Safety Pipeline', () => {
		it('allows an authenticated user to report another user\'s post with structured reason and details', async () => {
			const postId = '660000000000000000000010';
			const mockPost = {
				_id: postId,
				authorId: otherUserId,
				title: 'Post to report',
				reports: [],
				reportCount: 0,
				status: 'active',
				isFlagged: false,
				save: jest.fn().mockResolvedValue(true)
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${postId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'spam_advertising', details: 'Selling unauthorized merchandise' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.reportCount).toBe(1);
			expect(mockPost.reports.length).toBe(1);
			expect(mockPost.reports[0].reason).toBe('spam_advertising');
			expect(mockPost.save).toHaveBeenCalled();
		});

		it('prevents post authors from reporting their own post', async () => {
			const postId = '660000000000000000000010';
			const mockPost = {
				_id: postId,
				authorId: userId,
				reports: [],
				reportCount: 0,
				save: jest.fn()
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${postId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'spam_advertising' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/cannot report your own post/i);
			expect(mockPost.save).not.toHaveBeenCalled();
		});

		it('prevents duplicate reports from the same user on the same post', async () => {
			const postId = '660000000000000000000010';
			const mockPost = {
				_id: postId,
				authorId: otherUserId,
				reports: [{ reportedBy: userId, reason: 'spam_advertising', timestamp: new Date() }],
				reportCount: 1,
				save: jest.fn()
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${postId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'harassment_toxicity' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/already reported this post/i);
			expect(mockPost.save).not.toHaveBeenCalled();
		});

		it('automatically quarantines post when reportCount reaches 3', async () => {
			const postId = '660000000000000000000010';
			const mockPost = {
				_id: postId,
				authorId: otherUserId,
				reports: [
					{ reportedBy: otherUserId, reason: 'spam_advertising' },
					{ reportedBy: thirdUserId, reason: 'inappropriate_content' }
				],
				reportCount: 2,
				status: 'active',
				isFlagged: false,
				save: jest.fn().mockResolvedValue(true)
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${postId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'harassment_toxicity' });

			expect(res.status).toBe(200);
			expect(res.body.reportCount).toBe(3);
			expect(res.body.status).toBe('quarantined');
			expect(mockPost.status).toBe('quarantined');
			expect(mockPost.isFlagged).toBe(true);
			expect(res.body.message).toMatch(/quarantined for moderator review/i);
		});

		it('returns 400 for invalid ObjectId and 404 for missing post', async () => {
			const resInvalid = await request(app)
				.post('/api/forum/invalid-id/report')
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'spam' });
			expect(resInvalid.status).toBe(400);

			Post.findById.mockResolvedValue(null);
			const resMissing = await request(app)
				.post('/api/forum/660000000000000000000099/report')
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'spam' });
			expect(resMissing.status).toBe(404);
		});
	});

	describe('2. Comment and Reply Reporting Pipeline', () => {
		it('allows reporting an abusive comment and increments report count', async () => {
			const postId = '660000000000000000000010';
			const commentId = '660000000000000000000020';
			const mockComment = {
				_id: commentId,
				authorId: otherUserId,
				content: 'Inappropriate remark',
				reports: [],
				reportCount: 0,
				isFlagged: false
			};
			const mockPost = {
				_id: postId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment)
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Post.findById.mockResolvedValueOnce(mockPost);
			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({
					_id: postId,
					authorId: otherUserId,
					comments: [mockComment]
				})
			});

			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'Inappropriate or Offensive' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.reportCount).toBe(1);
			expect(mockComment.reports.length).toBe(1);
			expect(mockPost.save).toHaveBeenCalled();
		});

		it('prevents comment authors from reporting their own comment', async () => {
			const postId = '660000000000000000000010';
			const commentId = '660000000000000000000020';
			const mockComment = {
				_id: commentId,
				authorId: userId,
				reports: [],
				reportCount: 0
			};
			const mockPost = {
				_id: postId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment)
				},
				save: jest.fn()
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'Spam' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/cannot report your own comment/i);
		});

		it('flags comment when comment reports reach 3', async () => {
			const postId = '660000000000000000000010';
			const commentId = '660000000000000000000020';
			const mockComment = {
				_id: commentId,
				authorId: otherUserId,
				reports: [
					{ reportedBy: otherUserId, reason: 'Spam' },
					{ reportedBy: thirdUserId, reason: 'Toxicity' }
				],
				reportCount: 2,
				isFlagged: false
			};
			const mockPost = {
				_id: postId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment)
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Post.findById.mockResolvedValueOnce(mockPost);
			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({
					_id: postId,
					authorId: otherUserId,
					comments: [mockComment]
				})
			});

			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'Severe Abuse' });

			expect(res.status).toBe(200);
			expect(res.body.reportCount).toBe(3);
			expect(res.body.isFlagged).toBe(true);
			expect(mockComment.isFlagged).toBe(true);
		});

		it('allows reporting a nested reply and prevents self-reporting', async () => {
			const postId = '660000000000000000000010';
			const commentId = '660000000000000000000020';
			const replyId = '660000000000000000000030';
			const mockReply = {
				_id: replyId,
				authorId: otherUserId,
				reports: [],
				reportCount: 0,
				isFlagged: false
			};
			const mockComment = {
				_id: commentId,
				replies: {
					id: jest.fn().mockReturnValue(mockReply)
				}
			};
			const mockPost = {
				_id: postId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment)
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Post.findById.mockResolvedValueOnce(mockPost);
			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({
					_id: postId,
					comments: [{ ...mockComment, replies: [mockReply] }]
				})
			});

			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/replies/${replyId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'Harassment' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.reportCount).toBe(1);

			// Self report check
			mockReply.authorId = userId;
			Post.findById.mockResolvedValueOnce(mockPost);
			const resSelf = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/replies/${replyId}/report`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ reason: 'Harassment' });
			expect(resSelf.status).toBe(400);
			expect(resSelf.body.message).toMatch(/cannot report your own reply/i);
		});
	});

	describe('3. Single Post Fetching for URL Deep-Linking & Hydration', () => {
		it('returns hydrated post with authorRole, authorBadges, and authorStreak on GET /:postId', async () => {
			const postId = '660000000000000000000010';
			const rawPost = {
				_id: postId,
				title: 'Tournament tactics breakdown',
				content: 'Deep tactical overview for Mason Open',
				authorId: userId,
				status: 'active',
				comments: [
					{
						_id: '660000000000000000000021',
						authorId: otherUserId,
						content: 'Great insight!',
						replies: [
							{
								_id: '660000000000000000000031',
								authorId: thirdUserId,
								content: 'Agree, thanks for sharing.'
							}
						]
					}
				]
			};

			Post.findById.mockReturnValue({
				lean: jest.fn().mockResolvedValue(rawPost)
			});

			const res = await request(app).get(`/api/forum/${postId}`);
			expect(res.status).toBe(200);
			expect(res.body.title).toBe('Tournament tactics breakdown');
			expect(res.body.authorRole).toBe('admin');
			expect(res.body.authorBadges).toEqual(['club_executive']);
			expect(res.body.authorStreak).toBe(5);
			expect(res.body.comments[0].authorRole).toBe('user');
			expect(res.body.comments[0].replies[0].authorBadges).toEqual(['tournament_director']);
		});

		it('returns 404 for quarantined or deleted posts on GET /:postId', async () => {
			const postId = '660000000000000000000010';
			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({ _id: postId, status: 'quarantined' })
			});
			const resQuarantined = await request(app).get(`/api/forum/${postId}`);
			expect(resQuarantined.status).toBe(404);

			Post.findById.mockReturnValueOnce({
				lean: jest.fn().mockResolvedValue({ _id: postId, status: 'deleted' })
			});
			const resDeleted = await request(app).get(`/api/forum/${postId}`);
			expect(resDeleted.status).toBe(404);
		});

		it('returns 400 for invalid post ID format', async () => {
			const res = await request(app).get('/api/forum/not-a-valid-id');
			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/invalid post id/i);
		});
	});

	describe('4. Social Share & OpenGraph HTML Generator', () => {
		it('returns dynamic OpenGraph HTML with meta tags and client redirect on GET /share/:postId', async () => {
			const postId = '660000000000000000000010';
			const rawPost = {
				_id: postId,
				authorName: 'Alex Truong',
				content: 'Excited for the upcoming GMU tournament!',
				imageUrl: 'https://cloudinary.com/sample-racket.jpg',
				imageUrls: []
			};
			Post.findById.mockResolvedValue(rawPost);

			const res = await request(app).get(`/api/forum/share/${postId}`);
			expect(res.status).toBe(200);
			expect(res.headers['content-type']).toMatch(/text\/html/);
			expect(res.text).toContain('<meta property="og:title" content="Alex Truong on GMU Badminton" />');
			expect(res.text).toContain('<meta property="og:description" content="Excited for the upcoming GMU tournament!" />');
			expect(res.text).toContain('https://cloudinary.com/sample-racket.jpg');
			expect(res.text).toContain(`window.location.href`);
		});

		it('returns 404 for share preview of non-existent post', async () => {
			Post.findById.mockResolvedValue(null);
			const res = await request(app).get('/api/forum/share/660000000000000000000099');
			expect(res.status).toBe(404);
		});
	});

	describe('5. AI Moderation Screening Hook Integration', () => {
		it('rejects toxic comment submissions with 400 status', async () => {
			mockAnalyzeContent.mockResolvedValueOnce({
				isFlagged: true,
				reason: 'AI Moderation: Highly negative sentiment detected (Score: -6).'
			});

			const postId = '660000000000000000000010';
			Post.findById.mockResolvedValue({
				_id: postId,
				authorId: otherUserId,
				comments: []
			});

			const res = await request(app)
				.post(`/api/forum/${postId}/comments`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ content: 'Toxic abusive comment text' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/rejected: Spam or toxicity detected/i);
		});

		it('rejects toxic edited comment with 400 status', async () => {
			mockAnalyzeContent.mockResolvedValueOnce({
				isFlagged: true,
				reason: 'AI Moderation: Restricted language detected.'
			});

			const postId = '660000000000000000000010';
			const commentId = '660000000000000000000020';
			const mockComment = {
				_id: commentId,
				authorId: userId,
				content: 'Initial clean comment'
			};
			Post.findById.mockResolvedValue({
				_id: postId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment)
				}
			});

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ content: 'Toxic edited comment' });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/rejected: Spam or toxicity detected/i);
		});
	});
});
