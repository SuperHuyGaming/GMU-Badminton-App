const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const feedRoutes = require('../routes/feed');
const Post = require('../models/Post');
const User = require('../models/User');
const ActivityFeed = require('../models/ActivityFeed');
const Notification = require('../models/Notification');

jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/ActivityFeed');
jest.mock('../models/Notification');
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
const friendId = '660000000000000000000002';
const user2Id = '660000000000000000000003';
const adminId = '660000000000000000000009';
const postId = '660000000000000000000010';
const commentId = '660000000000000000000020';
const replyId = '660000000000000000000030';

const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'AuthorPlayer' }, JWT_SECRET);
const tokenFriend = jwt.sign({ id: friendId, userId: friendId, role: 'user', name: 'FriendPlayer' }, JWT_SECRET);
const tokenUser2 = jwt.sign({ id: user2Id, userId: user2Id, role: 'user', name: 'SecondPlayer' }, JWT_SECRET);
const tokenAdmin = jwt.sign({ id: adminId, userId: adminId, role: 'admin', name: 'AdminUser' }, JWT_SECRET);

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
app.use('/api/feed', feedRoutes);

describe('ADVERSARIAL STRESS-TEST SUITE: M1 Backend Social Features (J1, J7, J9, J10)', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				limit: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([
						{ _id: authorId, name: 'AuthorPlayer', profilePic: 'author.png', role: 'user', skillLevel: 'Intermediate', badges: [] },
						{ _id: friendId, name: 'FriendPlayer', profilePic: 'friend.png', role: 'user', skillLevel: 'Advanced', badges: ['Smash Champion'] },
					]),
				}),
				lean: jest.fn().mockResolvedValue([
					{ _id: authorId, name: 'AuthorPlayer', profilePic: 'author.png', role: 'user', skillLevel: 'Intermediate', badges: [] },
					{ _id: friendId, name: 'FriendPlayer', profilePic: 'friend.png', role: 'user', skillLevel: 'Advanced', badges: ['Smash Champion'] },
				]),
			}),
		});

		Notification.mockImplementation((data) => ({
			...data,
			save: jest.fn().mockResolvedValue(true),
		}));
	});

	// ==========================================
	// 1. J1: ADVERSARIAL REACTIONS STRESS TESTS
	// ==========================================
	describe('1. J1 Reactions: All 6 Facebook Emojis, POST and PUT, and Rapid Toggles', () => {
		const facebookEmojis = [
			{ emoji: '👍', type: 'like' },
			{ emoji: '❤️', type: 'love' },
			{ emoji: '🏸', type: 'smash' },
			{ emoji: '😮', type: 'wow' },
			{ emoji: '😂', type: 'haha' },
			{ emoji: '😢', type: 'sad' },
		];

		const endpoints = [
			{ method: 'post', path: (id) => `/api/forum/${id}/react` },
			{ method: 'put', path: (id) => `/api/forum/${id}/react` },
		];

		endpoints.forEach(({ method, path }) => {
			facebookEmojis.forEach(({ emoji, type }) => {
				it(`supports ${method.toUpperCase()} ${path(':id')} with emoji "${emoji}" mapped to type "${type}"`, async () => {
					const mockDoc = {
						_id: postId,
						authorId,
						authorName: 'AuthorPlayer',
						reactions: [],
						save: jest.fn().mockResolvedValue(true),
						toObject() {
							return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
						},
					};
					Post.findById.mockResolvedValue(mockDoc);

					const res = await request(app)
						[method](path(postId))
						.set('Authorization', `Bearer ${tokenFriend}`)
						.send({ emoji });

					expect(res.status).toBe(200);
					expect(mockDoc.save).toHaveBeenCalled();
					expect(mockDoc.reactions.length).toBe(1);
					expect(mockDoc.reactions[0].emoji).toBe(emoji);
					expect(mockDoc.reactions[0].reactionType).toBe(type);
					expect(res.body.action).toBe('added');
				});
			});
		});

		it('stress-tests rapid consecutive toggles and emoji switches on single post', async () => {
			const mockReactions = [];
			const mockDoc = {
				_id: postId,
				authorId,
				authorName: 'AuthorPlayer',
				reactions: mockReactions,
				save: jest.fn().mockImplementation(async function () {
					return true;
				}),
				toObject() {
					return { _id: this._id, authorId: this.authorId, reactions: [...this.reactions] };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			// Step 1: Add 👍
			let res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('added');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('👍');

			// Step 2: Toggle off 👍 (same emoji clicked)
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('removed');
			expect(mockDoc.reactions.length).toBe(0);

			// Step 3: Add ❤️
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '❤️' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('added');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('❤️');

			// Step 4: Rapid switch from ❤️ to 😮
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '😮' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('updated');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('😮');
			expect(mockDoc.reactions[0].reactionType).toBe('wow');

			// Step 5: Rapid switch from 😮 to 😂
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '😂' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('updated');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('😂');

			// Step 6: Rapid switch from 😂 to 😢
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '😢' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('updated');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('😢');

			// Step 7: Rapid switch from 😢 to 🏸
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '🏸' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('updated');
			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].emoji).toBe('🏸');
			expect(mockDoc.reactions[0].reactionType).toBe('smash');

			// Step 8: Toggle off 🏸
			res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '🏸' });
			expect(res.status).toBe(200);
			expect(res.body.action).toBe('removed');
			expect(mockDoc.reactions.length).toBe(0);
		});

		it('isolates reactions between multiple concurrent users', async () => {
			const mockReactions = [];
			const mockDoc = {
				_id: postId,
				authorId,
				authorName: 'AuthorPlayer',
				reactions: mockReactions,
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, reactions: [...this.reactions] };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			// User 1 reacts with 👍
			await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });

			// User 2 reacts with ❤️
			await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenUser2}`)
				.send({ emoji: '❤️' });

			expect(mockDoc.reactions.length).toBe(2);
			expect(mockDoc.reactions.find((r) => r.userId === friendId).emoji).toBe('👍');
			expect(mockDoc.reactions.find((r) => r.userId === user2Id).emoji).toBe('❤️');

			// User 1 removes reaction
			await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });

			expect(mockDoc.reactions.length).toBe(1);
			expect(mockDoc.reactions[0].userId).toBe(user2Id);
			expect(mockDoc.reactions[0].emoji).toBe('❤️');
		});

		it('adversarially rejects invalid emojis: poop emoji, text, null, numbers', async () => {
			const invalidInputs = [
				{ emoji: '💩' },
				{ emoji: '🍕' },
				{ emoji: 'invalid_reaction' },
				{ emoji: '' },
				{ emoji: null },
				{ emoji: 12345 },
				{},
			];

			for (const payload of invalidInputs) {
				const res = await request(app)
					.post(`/api/forum/${postId}/react`)
					.set('Authorization', `Bearer ${tokenFriend}`)
					.send(payload);

				expect(res.status).toBe(400);
				expect(res.body.message).toContain('Invalid emoji');
			}
		});

		it('adversarially rejects invalid or non-existent postId', async () => {
			// Malformed ObjectId
			const resMalformed = await request(app)
				.post('/api/forum/not-an-objectid/react')
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });
			expect(resMalformed.status).toBe(400);
			expect(resMalformed.body.message).toContain('Invalid post ID format');

			// Valid ObjectId but non-existent
			const nonExistentId = '660000000000000000000999';
			Post.findById.mockResolvedValue(null);
			ActivityFeed.findById.mockResolvedValue(null);

			const resNotFound = await request(app)
				.post(`/api/forum/${nonExistentId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });
			expect(resNotFound.status).toBe(404);
			expect(resNotFound.body.message).toContain('Post not found');
		});

		it('rejects unauthenticated react requests with 401', async () => {
			const res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.send({ emoji: '👍' });

			expect(res.status).toBe(401);
		});

		it('evaluates presence of Contract 1 response keys (success, action, userReaction, reactionCounts)', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				authorName: 'AuthorPlayer',
				reactions: [],
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '👍' });

			expect(res.status).toBe(200);

			console.log('--- CONTRACT 1 VERIFICATION ---');
			console.log('Response keys returned by server:', Object.keys(res.body));
			console.log('Has action:', 'action' in res.body, res.body.action);
			console.log('Has success:', 'success' in res.body, res.body.success);
			console.log('Has userReaction:', 'userReaction' in res.body, res.body.userReaction);
			console.log('Has reactionCounts:', 'reactionCounts' in res.body, res.body.reactionCounts);
			console.log('Full res.body:', JSON.stringify(res.body));
			console.log('-------------------------------');

			expect(res.body.action).toBe('added');
			expect(res.body.success).toBe(true);
			expect(res.body.userReaction).toBe('👍');
			expect(res.body.reactionCounts).toBeDefined();
			expect(res.body.reactionCounts['👍']).toBe(1);
		});
	});

	// ==========================================
	// 2. J7: REPOST & SHARE COUNT STRESS TESTS
	// ==========================================
	describe('2. J7 Reposts & Atomic Share Count Increment', () => {
		it('creates repost with originalPostId, increments original post shareCount atomically, and prevents media duplication', async () => {
			const originalPost = {
				_id: new mongoose.Types.ObjectId(postId),
				title: 'Original Tournament Champion Post',
				content: 'We won the state cup!',
				imageUrl: 'https://cdn.example.com/trophy.png',
				imageUrls: ['https://cdn.example.com/trophy.png', 'https://cdn.example.com/team.png'],
				shareCount: 14,
			};
			Post.findById.mockResolvedValue(originalPost);
			Post.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

			let capturedPostInstance = null;
			Post.mockImplementation(function (data) {
				capturedPostInstance = data;
				return {
					...data,
					_id: new mongoose.Types.ObjectId(),
					save: jest.fn().mockResolvedValue(true),
					toObject() {
						return { ...data, _id: this._id };
					},
				};
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({
					title: 'Repost: Original Tournament Champion Post',
					content: 'Look at this amazing victory!',
					originalPostId: postId,
					sharedThought: 'Proud of our team!',
					visibility: 'PUBLIC',
				});

			expect([200, 201]).toContain(res.status);

			// Verify atomic share count increment
			expect(Post.updateOne).toHaveBeenCalledWith(
				{ _id: originalPost._id },
				{ $inc: { shareCount: 1 } }
			);

			// Verify repost fields
			expect(capturedPostInstance.originalPostId).toEqual(originalPost._id);
			expect(capturedPostInstance.sharedThought).toBe('Proud of our team!');
			expect(capturedPostInstance.shareCount).toBe(0);

			// Crucial: NO media duplication from original post
			expect(capturedPostInstance.imageUrl).toBe('');
			expect(capturedPostInstance.imageUrls).toEqual([]);
		});

		it('sanitizes XSS payloads in sharedThought', async () => {
			const originalPost = {
				_id: new mongoose.Types.ObjectId(postId),
				title: 'Clean Original Post',
				content: 'Content',
				shareCount: 0,
			};
			Post.findById.mockResolvedValue(originalPost);
			Post.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

			let capturedPostInstance = null;
			Post.mockImplementation(function (data) {
				capturedPostInstance = data;
				return {
					...data,
					_id: new mongoose.Types.ObjectId(),
					save: jest.fn().mockResolvedValue(true),
					toObject() {
						return { ...data, _id: this._id };
					},
				};
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({
					title: 'Repost Test',
					content: 'Test content',
					originalPostId: postId,
					sharedThought: '<script>alert("xss")</script>Incredible match!',
				});

			expect([200, 201]).toContain(res.status);
			expect(capturedPostInstance.sharedThought).not.toContain('<script>');
		});

		it('handles non-existent originalPostId without crashing or incrementing', async () => {
			const fakeId = '660000000000000000000888';
			Post.findById.mockResolvedValue(null);
			Post.updateOne = jest.fn();

			let capturedPostInstance = null;
			Post.mockImplementation(function (data) {
				capturedPostInstance = data;
				return {
					...data,
					_id: new mongoose.Types.ObjectId(),
					save: jest.fn().mockResolvedValue(true),
					toObject() {
						return { ...data, _id: this._id };
					},
				};
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({
					title: 'Repost Test',
					content: 'Test content',
					originalPostId: fakeId,
					sharedThought: 'Thought on non-existent post',
				});

			expect([200, 201]).toContain(res.status);
			expect(Post.updateOne).not.toHaveBeenCalled();
			expect(capturedPostInstance.originalPostId).toBeNull();
		});

		it('rejects reposting an ONLY_ME post of another user with 403 Forbidden', async () => {
			const privatePost = {
				_id: new mongoose.Types.ObjectId(postId),
				title: 'Private Diary',
				content: 'My secret plans',
				authorId: authorId,
				visibility: 'ONLY_ME',
				shareCount: 0,
			};
			Post.findById.mockResolvedValue(privatePost);

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({
					title: 'Trying to repost private post',
					content: 'Look what I found',
					originalPostId: postId,
					sharedThought: 'Sneaky thought',
				});

			expect(res.status).toBe(403);
			expect(res.body.message).toContain('Cannot repost a private post');
		});

		it('allows author to repost their own ONLY_ME post', async () => {
			const privatePost = {
				_id: new mongoose.Types.ObjectId(postId),
				title: 'My Own Private Post',
				content: 'Notes for myself',
				authorId: authorId,
				visibility: 'ONLY_ME',
				shareCount: 0,
			};
			Post.findById.mockResolvedValue(privatePost);
			Post.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

			let capturedPostInstance = null;
			Post.mockImplementation(function (data) {
				capturedPostInstance = data;
				return {
					...data,
					_id: new mongoose.Types.ObjectId(),
					save: jest.fn().mockResolvedValue(true),
					toObject() {
						return { ...data, _id: this._id };
					},
				};
			});

			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Author Repost',
					content: 'Sharing my own notes',
					originalPostId: postId,
					sharedThought: 'My thought',
				});

			expect([200, 201]).toContain(res.status);
			expect(capturedPostInstance.originalPostId).toEqual(privatePost._id);
		});
	});

	// ==========================================
	// 3. J9: EDIT TIMESTAMPS STRESS TESTS
	// ==========================================
	describe('3. J9 Edit Timestamps (Post, Comment, Reply)', () => {
		it('updates post.isEdited = true and post.editedAt on PUT /api/forum/:postId', async () => {
			const beforeEditTime = Date.now();
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Original Title',
				content: 'Original Content',
				isEdited: false,
				editedAt: null,
				lastActivityAt: new Date(Date.now() - 100000),
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return {
						_id: this._id,
						authorId: this.authorId,
						title: this.title,
						content: this.content,
						isEdited: this.isEdited,
						editedAt: this.editedAt,
					};
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Updated Title',
					content: 'Updated Content',
				});

			expect(res.status).toBe(200);
			expect(mockDoc.isEdited).toBe(true);
			expect(mockDoc.editedAt).toBeInstanceOf(Date);
			expect(mockDoc.editedAt.getTime()).toBeGreaterThanOrEqual(beforeEditTime - 100);
			expect(mockDoc.lastActivityAt.getTime()).toBeGreaterThanOrEqual(beforeEditTime - 100);
		});

		it('forbids non-author non-admin from editing post', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Original Title',
				content: 'Original Content',
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ title: 'Hacked Title', content: 'Hacked Content' });

			expect(res.status).toBe(403);
			expect(mockDoc.save).not.toHaveBeenCalled();
		});

		it('updates comment.isEdited = true and comment.editedAt on PUT /api/forum/:postId/comments/:commentId', async () => {
			const beforeEditTime = Date.now();
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId: friendId,
				content: 'Initial Comment',
				isEdited: false,
				editedAt: null,
			};
			const mockDoc = {
				_id: postId,
				authorId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment),
				},
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, comments: [mockComment] };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ content: 'Edited Comment Content' });

			expect(res.status).toBe(200);
			expect(mockComment.isEdited).toBe(true);
			expect(mockComment.editedAt).toBeInstanceOf(Date);
			expect(mockComment.editedAt.getTime()).toBeGreaterThanOrEqual(beforeEditTime - 100);
		});

		it('forbids stranger from editing comment with 403', async () => {
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId: friendId,
				content: 'Initial Comment',
			};
			const mockDoc = {
				_id: postId,
				authorId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment),
				},
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({ content: 'Attempt unauthorized edit' });

			expect(res.status).toBe(403);
			expect(mockDoc.save).not.toHaveBeenCalled();
		});

		it('updates reply.isEdited = true and reply.editedAt on PUT /api/forum/:postId/comments/:commentId/replies/:replyId', async () => {
			const beforeEditTime = Date.now();
			const mockReply = {
				_id: new mongoose.Types.ObjectId(replyId),
				authorId: user2Id,
				content: 'Initial Reply',
				isEdited: false,
				editedAt: null,
			};
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId: friendId,
				replies: {
					id: jest.fn().mockReturnValue(mockReply),
				},
			};
			const mockDoc = {
				_id: postId,
				authorId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment),
				},
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, comments: [mockComment] };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/replies/${replyId}`)
				.set('Authorization', `Bearer ${tokenUser2}`)
				.send({ content: 'Edited Reply Content' });

			expect(res.status).toBe(200);
			expect(mockReply.isEdited).toBe(true);
			expect(mockReply.editedAt).toBeInstanceOf(Date);
			expect(mockReply.editedAt.getTime()).toBeGreaterThanOrEqual(beforeEditTime - 100);
		});

		it('forbids unauthorized user from editing reply with 403', async () => {
			const mockReply = {
				_id: new mongoose.Types.ObjectId(replyId),
				authorId: user2Id,
				content: 'Initial Reply',
			};
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId: friendId,
				replies: {
					id: jest.fn().mockReturnValue(mockReply),
				},
			};
			const mockDoc = {
				_id: postId,
				authorId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment),
				},
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/replies/${replyId}`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ content: 'Attempt unauthorized reply edit' });

			expect(res.status).toBe(403);
			expect(mockDoc.save).not.toHaveBeenCalled();
		});
	});

	// ==========================================
	// 4. J10: MEMBER SEARCH ADVERSARIAL TESTS
	// ==========================================
	describe('4. J10 Member Search (GET /api/forum/members)', () => {
		it('returns { users: [...] } shape with id, _id, name, profilePic, role, skillLevel, badges', async () => {
			const res = await request(app).get('/api/forum/members?q=Player');

			expect(res.status).toBe(200);
			expect(res.body).toHaveProperty('users');
			expect(Array.isArray(res.body.users)).toBe(true);
			expect(res.body.users.length).toBeGreaterThan(0);

			const firstUser = res.body.users[0];
			expect(firstUser).toHaveProperty('id');
			expect(firstUser).toHaveProperty('_id');
			expect(firstUser).toHaveProperty('name');
			expect(firstUser).toHaveProperty('profilePic');
			expect(firstUser).toHaveProperty('role');
			expect(firstUser).toHaveProperty('skillLevel');
			expect(firstUser).toHaveProperty('badges');
		});

		it('safely handles adversarial regex metacharacters in query parameter without ReDoS or crashing', async () => {
			const dangerousQueries = [
				'.*',
				'[a-z',
				'(((((((a+)+)+)+)+)+)+',
				'(',
				'+',
				'?',
				'*',
				'\\',
				'^admin$',
				'{1,100}',
				'|',
			];

			for (const q of dangerousQueries) {
				const res = await request(app).get(`/api/forum/members?q=${encodeURIComponent(q)}`);
				expect(res.status).toBe(200);
				expect(res.body).toHaveProperty('users');
				expect(Array.isArray(res.body.users)).toBe(true);
			}
		});

		it('handles case-insensitivity and empty or whitespace query strings', async () => {
			// Empty query string
			const resEmpty = await request(app).get('/api/forum/members?q=');
			expect(resEmpty.status).toBe(200);
			expect(Array.isArray(resEmpty.body.users)).toBe(true);

			// Whitespace query string
			const resWhitespace = await request(app).get('/api/forum/members?q=%20%20%20');
			expect(resWhitespace.status).toBe(200);
			expect(Array.isArray(resWhitespace.body.users)).toBe(true);

			// Check regex options passed to User.find
			const resUpper = await request(app).get('/api/forum/members?q=PLAYER');
			expect(resUpper.status).toBe(200);

			const findCall = User.find.mock.calls[User.find.mock.calls.length - 1][0];
			expect(findCall.name.$options).toBe('i');
			expect(findCall.hideFromSearch).toEqual({ $ne: true });
		});

		it('clamps limit query parameter between 1 and 50', async () => {
			const limitMock = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					limit: limitMock,
				}),
			});

			// Large limit -> clamped to 50
			await request(app).get('/api/forum/members?limit=999');
			expect(limitMock).toHaveBeenCalledWith(50);

			// Zero or negative limit -> clamped to 1
			await request(app).get('/api/forum/members?limit=-5');
			expect(limitMock).toHaveBeenCalledWith(1);

			// Non-numeric limit -> defaults to 10
			await request(app).get('/api/forum/members?limit=abc');
			expect(limitMock).toHaveBeenCalledWith(10);
		});
	});
});
