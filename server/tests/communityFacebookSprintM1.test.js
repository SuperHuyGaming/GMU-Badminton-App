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
const strangerId = '660000000000000000000003';
const adminId = '660000000000000000000009';
const postId = '660000000000000000000010';
const commentId = '660000000000000000000020';
const replyId = '660000000000000000000030';

const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'AuthorPlayer' }, JWT_SECRET);
const tokenFriend = jwt.sign({ id: friendId, userId: friendId, role: 'user', name: 'FriendPlayer' }, JWT_SECRET);
const tokenStranger = jwt.sign({ id: strangerId, userId: strangerId, role: 'user', name: 'StrangerPlayer' }, JWT_SECRET);
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

describe('Milestone 1 (M1): Backend Models, Indexes, & Facebook-Style Social Hub APIs', () => {
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
					{ _id: strangerId, name: 'StrangerPlayer', profilePic: 'stranger.png', role: 'user', skillLevel: 'Beginner', badges: [] },
					{ _id: adminId, name: 'AdminUser', profilePic: 'admin.png', role: 'admin', skillLevel: 'Pro', badges: ['Staff'] },
				]),
			}),
		});

		Notification.mockImplementation((data) => ({
			...data,
			save: jest.fn().mockResolvedValue(true),
		}));
	});

	// ==========================================
	// 1. SCHEMAS, MODELS, & COMPOUND INDEXES
	// ==========================================
	describe('1. Schema & Compound Index Verification', () => {
		const RealPost = jest.requireActual('../models/Post');
		const RealUser = jest.requireActual('../models/User');
		const RealActivityFeed = jest.requireActual('../models/ActivityFeed');

		it('verifies Post schema contains lastActivityAt, editedAt, originalPostId, sharedThought, shareCount', () => {
			expect(RealPost.schema.path('lastActivityAt')).toBeDefined();
			expect(RealPost.schema.path('editedAt')).toBeDefined();
			expect(RealPost.schema.path('originalPostId')).toBeDefined();
			expect(RealPost.schema.path('sharedThought')).toBeDefined();
			expect(RealPost.schema.path('shareCount')).toBeDefined();
		});

		it('verifies comments and replies subdocuments contain editedAt timestamps', () => {
			expect(RealPost.schema.path('comments.editedAt')).toBeDefined();
			expect(RealPost.schema.path('comments.replies.editedAt')).toBeDefined();
		});

		it('verifies Post compound indexes { isPinned: -1, lastActivityAt: -1 } and { status: 1, isPinned: -1, lastActivityAt: -1 }', () => {
			const indexes = RealPost.schema.indexes();
			const pinnedActivityIndex = indexes.find(
				([idx]) => idx.isPinned === -1 && idx.lastActivityAt === -1
			);
			const statusPinnedActivityIndex = indexes.find(
				([idx]) => idx.status === 1 && idx.isPinned === -1 && idx.lastActivityAt === -1
			);
			expect(pinnedActivityIndex).toBeDefined();
			expect(statusPinnedActivityIndex).toBeDefined();
		});

		it('verifies User schema contains savedPosts array ref Post', () => {
			const savedPostsPath = RealUser.schema.path('savedPosts');
			expect(savedPostsPath).toBeDefined();
		});

		it('verifies ActivityFeed schema contains lastActivityAt, originalPostId, sharedThought, and compound index', () => {
			expect(RealActivityFeed.schema.path('lastActivityAt')).toBeDefined();
			expect(RealActivityFeed.schema.path('originalPostId')).toBeDefined();
			expect(RealActivityFeed.schema.path('sharedThought')).toBeDefined();
			expect(RealActivityFeed.schema.path('shareCount')).toBeDefined();
			expect(RealActivityFeed.schema.path('isEdited')).toBeDefined();
			expect(RealActivityFeed.schema.path('editedAt')).toBeDefined();

			const indexes = RealActivityFeed.schema.indexes();
			const pinnedActivityIndex = indexes.find(
				([idx]) => idx.isPinned === -1 && idx.lastActivityAt === -1
			);
			expect(pinnedActivityIndex).toBeDefined();
		});
	});

	// ==========================================
	// 2. J1: REACTIONS PICKER API & MAPPING
	// ==========================================
	describe('2. J1 Reactions Dock API (POST & PUT /api/forum/:id/react)', () => {
		const emojisToTest = [
			{ emoji: '👍', expectedType: 'like' },
			{ emoji: '❤️', expectedType: 'love' },
			{ emoji: '🏸', expectedType: 'smash' },
			{ emoji: '😮', expectedType: 'wow' },
			{ emoji: '😂', expectedType: 'haha' },
			{ emoji: '😢', expectedType: 'sad' },
		];

		emojisToTest.forEach(({ emoji, expectedType }) => {
			it(`handles POST /api/forum/:postId/react for ${emoji} mapping to ${expectedType}`, async () => {
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
					.send({ emoji });

				expect(res.status).toBe(200);
				expect(mockDoc.save).toHaveBeenCalled();
				expect(mockDoc.reactions.length).toBe(1);
				expect(mockDoc.reactions[0]).toMatchObject({
					userId: friendId,
					emoji,
					reactionType: expectedType,
				});
				expect(res.body.action).toBe('added');
				expect(res.body.reaction.reactionType).toBe(expectedType);
				expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
					postId,
					action: 'added',
					userId: friendId,
				}));
			});
		});

		it('toggles reaction off (action: removed) when same emoji is sent again', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				authorName: 'AuthorPlayer',
				reactions: [{ userId: friendId, emoji: '❤️', reactionType: 'love' }],
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '❤️' });

			expect(res.status).toBe(200);
			expect(res.body.action).toBe('removed');
			expect(mockDoc.reactions.length).toBe(0);
			expect(mockIo.emit).toHaveBeenCalledWith('reactionUpdated', expect.objectContaining({
				action: 'removed',
			}));
		});

		it('updates reaction (action: updated) when a different emoji is sent', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				authorName: 'AuthorPlayer',
				reactions: [{ userId: friendId, emoji: '👍', reactionType: 'like', createdAt: new Date() }],
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, reactions: this.reactions };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '🔥' });

			expect(res.status).toBe(200);
			expect(res.body.action).toBe('updated');
			expect(mockDoc.reactions[0].emoji).toBe('🔥');
			expect(mockDoc.reactions[0].reactionType).toBe('smash');
		});

		it('rejects unsupported emojis with 400 Bad Request', async () => {
			const res = await request(app)
				.post(`/api/forum/${postId}/react`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ emoji: '🍕' });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('Invalid emoji');
		});
	});

	// ==========================================
	// 3. J3: COMMENT REPLIES & TIMESTAMPS
	// ==========================================
	describe('3. J3 Threaded Comment Replies & Timestamps', () => {
		it('updates parent post.lastActivityAt when a reply is added via POST /api/forum/:postId/comments/:commentId/replies', async () => {
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId,
				content: 'Great smash match!',
				replies: [],
			};
			const mockDoc = {
				_id: postId,
				authorId,
				comments: {
					id: jest.fn().mockReturnValue(mockComment),
				},
				lastActivityAt: new Date(Date.now() - 3600000),
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, comments: [mockComment] };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const beforeTime = Date.now();
			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/replies`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ content: 'I agree, the drop shot was clutch!' });

			expect(res.status).toBe(200);
			expect(mockComment.replies.length).toBe(1);
			expect(mockDoc.lastActivityAt.getTime()).toBeGreaterThanOrEqual(beforeTime - 100);
			expect(mockDoc.save).toHaveBeenCalled();
		});

		it('sets comment.isEdited = true and comment.editedAt on PUT /:postId/comments/:commentId', async () => {
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId: friendId,
				content: 'Original comment text',
				isEdited: false,
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

			const beforeTime = Date.now();
			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ content: 'Updated comment text with insights' });

			expect(res.status).toBe(200);
			expect(mockComment.isEdited).toBe(true);
			expect(mockComment.editedAt).toBeDefined();
			expect(new Date(mockComment.editedAt).getTime()).toBeGreaterThanOrEqual(beforeTime - 100);
		});

		it('sets reply.isEdited = true and reply.editedAt on PUT /:postId/comments/:commentId/replies/:replyId', async () => {
			const mockReply = {
				_id: new mongoose.Types.ObjectId(replyId),
				authorId: friendId,
				content: 'Initial reply text',
				isEdited: false,
			};
			const mockComment = {
				_id: new mongoose.Types.ObjectId(commentId),
				authorId,
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

			const beforeTime = Date.now();
			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/replies/${replyId}`)
				.set('Authorization', `Bearer ${tokenFriend}`)
				.send({ content: 'Edited reply text' });

			expect(res.status).toBe(200);
			expect(mockReply.isEdited).toBe(true);
			expect(mockReply.editedAt).toBeDefined();
			expect(new Date(mockReply.editedAt).getTime()).toBeGreaterThanOrEqual(beforeTime - 100);
		});
	});

	// ==========================================
	// 4. J4: SMART FEED SORTING
	// ==========================================
	describe('4. J4 Smart Feed Sorting & Tab Handling', () => {
		beforeEach(() => {
			User.findById.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue({
						_id: authorId,
						skillLevel: 'Intermediate',
						bookmarkedPosts: [postId],
						savedPosts: [postId],
						friends: [friendId],
					}),
				}),
				lean: jest.fn().mockResolvedValue({
					_id: authorId,
					skillLevel: 'Intermediate',
					bookmarkedPosts: [postId],
					savedPosts: [postId],
					friends: [friendId],
				}),
			});
		});

		it('supports tab=recent_activity sorting by { isPinned: -1, lastActivityAt: -1 } in GET /api/feed', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([
							{ _id: postId, title: 'Active Post', lastActivityAt: new Date() },
						]),
					}),
				}),
			});

			const res = await request(app)
				.get('/api/feed?tab=recent_activity')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(ActivityFeed.find).toHaveBeenCalled();
			const sortArg = ActivityFeed.find().sort.mock.calls[0][0];
			expect(sortArg.isPinned).toBe(-1);
			expect(sortArg.lastActivityAt).toBe(-1);
		});

		it('supports tab=latest sorting by { isPinned: -1, createdAt: -1 } in GET /api/feed', async () => {
			ActivityFeed.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([]),
					}),
				}),
			});

			const res = await request(app)
				.get('/api/feed?tab=latest')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			const sortArg = ActivityFeed.find().sort.mock.calls[0][0];
			expect(sortArg.isPinned).toBe(-1);
			expect(sortArg.createdAt).toBe(-1);
		});

		it('supports tab=top with engagement scoring in GET /api/feed using aggregate pipeline', async () => {
			ActivityFeed.aggregate.mockResolvedValue([
				{ _id: postId, title: 'Top Post', score: 25 },
			]);

			const res = await request(app)
				.get('/api/feed?tab=top')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(ActivityFeed.aggregate).toHaveBeenCalled();
			const pipeline = ActivityFeed.aggregate.mock.calls[0][0];
			const sortStage = pipeline.find((s) => s.$sort);
			expect(sortStage.$sort.isPinned).toBe(-1);
			expect(sortStage.$sort.score).toBe(-1);
		});

		it('supports tab=top in GET /api/forum sorting by reactions + comments * 2', async () => {
			const postLow = {
				_id: '660000000000000000000011',
				title: 'Low Engagement',
				reactions: [{ emoji: '👍' }],
				comments: [],
				isPinned: false,
			};
			const postHigh = {
				_id: '660000000000000000000012',
				title: 'High Engagement',
				reactions: [{ emoji: '👍' }, { emoji: '❤️' }],
				comments: [{ content: 'c1' }, { content: 'c2' }], // 2 + 2 * 2 = 6
				isPinned: false,
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([postLow, postHigh]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=top');
			expect(res.status).toBe(200);
			expect(res.body[0]._id).toBe(postHigh._id);
			expect(res.body[1]._id).toBe(postLow._id);
		});
	});

	// ==========================================
	// 5. J5: PINNING HIERARCHY & AUTHORIZATION
	// ==========================================
	describe('5. J5 Post Pinning Hierarchy Authorization (PUT /api/forum/:postId/pin)', () => {
		it('rejects author of the post from pinning with 403 Forbidden if not admin', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				isPinned: false,
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/pin`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toContain('Only administrators can pin or unpin posts');
			expect(mockDoc.save).not.toHaveBeenCalled();
		});

		it('allows admin to toggle isPinned for any post', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				isPinned: true,
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, isPinned: this.isPinned };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/pin`)
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.status).toBe(200);
			expect(res.body.isPinned).toBe(false);
			expect(mockDoc.isPinned).toBe(false);
		});

		it('blocks non-author non-admin users from pinning with 403 Forbidden', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				isPinned: false,
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}/pin`)
				.set('Authorization', `Bearer ${tokenStranger}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toContain('Only administrators can pin or unpin posts');
			expect(mockDoc.save).not.toHaveBeenCalled();
		});
	});

	// ==========================================
	// 6. J6: AUDIENCE & PRIVACY ENFORCEMENT
	// ==========================================
	describe('6. J6 Audience & Privacy Visibility Enforcement', () => {
		beforeEach(() => {
			User.findById.mockImplementation((id) => {
				const idStr = id.toString();
				if (idStr === authorId) {
					return {
						select: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue({ _id: authorId, friends: [friendId] }),
						}),
						lean: jest.fn().mockResolvedValue({ _id: authorId, friends: [friendId] }),
					};
				}
				if (idStr === friendId) {
					return {
						select: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue({ _id: friendId, friends: [authorId] }),
						}),
						lean: jest.fn().mockResolvedValue({ _id: friendId, friends: [authorId] }),
					};
				}
				return {
					select: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue({ _id: strangerId, friends: [] }),
					}),
					lean: jest.fn().mockResolvedValue({ _id: strangerId, friends: [] }),
				};
			});
		});

		it('allows author and friends to view FRIENDS_ONLY post in GET /api/forum/:postId', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Friends Only Rally',
				visibility: 'FRIENDS_ONLY',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility, title: this.title };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			// Friend request -> 200 OK
			const resFriend = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenFriend}`);
			expect(resFriend.status).toBe(200);

			// Author request -> 200 OK
			const resAuthor = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`);
			expect(resAuthor.status).toBe(200);
		});

		it('blocks strangers from viewing FRIENDS_ONLY post in GET /api/forum/:postId with 403', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Friends Only Rally',
				visibility: 'FRIENDS_ONLY',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			const resStranger = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenStranger}`);
			expect(resStranger.status).toBe(403);
			expect(resStranger.body.message).toContain('only visible to friends');
		});

		it('strictly restricts ONLY_ME posts to author in GET /api/forum/:postId', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Private Journal',
				visibility: 'ONLY_ME',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility };
				},
			};
			Post.findById.mockResolvedValue(mockDoc);

			// Stranger -> 403
			const resStranger = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenStranger}`);
			expect(resStranger.status).toBe(403);

			// Friend -> 403
			const resFriend = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenFriend}`);
			expect(resFriend.status).toBe(403);

			// Author -> 200 OK
			const resAuthor = await request(app)
				.get(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`);
			expect(resAuthor.status).toBe(200);
		});

		it('filters out FRIENDS_ONLY posts for non-friends in GET /api/forum', async () => {
			const publicPost = { _id: '660000000000000000000091', visibility: 'PUBLIC', authorId };
			const friendsOnlyPost = { _id: '660000000000000000000092', visibility: 'FRIENDS_ONLY', authorId };
			const onlyMePost = { _id: '660000000000000000000093', visibility: 'ONLY_ME', authorId };

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([publicPost, friendsOnlyPost, onlyMePost]),
						}),
					}),
				}),
			});

			const resStranger = await request(app)
				.get('/api/forum')
				.set('Authorization', `Bearer ${tokenStranger}`);

			expect(resStranger.status).toBe(200);
			expect(resStranger.body.length).toBe(1);
			expect(resStranger.body[0]._id).toBe(publicPost._id);
		});
	});

	// ==========================================
	// 7. J7: REPOST & SHARE WITH THOUGHTS
	// ==========================================
	describe('7. J7 Repost & Share Without Media Duplication', () => {
		it('creates repost with originalPostId, sharedThought, and atomically increments shareCount', async () => {
			const originalPostDoc = {
				_id: new mongoose.Types.ObjectId(postId),
				title: 'Epic Tournament Highlights',
				content: 'Check out the final match!',
				shareCount: 5,
				imageUrl: 'https://images.unsplash.com/photo-tournament',
				imageUrls: ['https://images.unsplash.com/photo-tournament'],
			};
			Post.findById.mockResolvedValue(originalPostDoc);
			Post.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

			let savedPostData = null;
			Post.mockImplementation(function (data) {
				savedPostData = data;
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
					title: 'Repost: Epic Tournament Highlights',
					content: 'Incredible rally by the team!',
					originalPostId: postId,
					sharedThought: 'Incredible rally by the team!',
					visibility: 'PUBLIC',
				});

			expect([200, 201]).toContain(res.status);
			expect(Post.updateOne).toHaveBeenCalledWith(
				{ _id: originalPostDoc._id },
				{ $inc: { shareCount: 1 } }
			);
			expect(savedPostData.originalPostId).toEqual(originalPostDoc._id);
			expect(savedPostData.sharedThought).toBe('Incredible rally by the team!');
			expect(savedPostData.imageUrl).toBe(''); // No media duplication
			expect(savedPostData.imageUrls).toEqual([]);
		});
	});

	// ==========================================
	// 8. J8: SAVED POSTS & BOOKMARKS
	// ==========================================
	describe('8. J8 Saved Posts & Bookmarking Synchronization', () => {
		it('syncs bookmarkedPosts and savedPosts in User document upon bookmark toggle', async () => {
			const mockUser = {
				_id: authorId,
				bookmarkedPosts: [],
				savedPosts: [],
				save: jest.fn().mockResolvedValue(true),
			};
			User.findById.mockResolvedValue(mockUser);

			const res = await request(app)
				.put(`/api/forum/${postId}/bookmark`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(res.body.isBookmarked).toBe(true);
			expect(res.body.isSaved).toBe(true);
			expect(mockUser.bookmarkedPosts).toContain(postId);
			expect(mockUser.savedPosts).toContain(postId);
			expect(mockUser.save).toHaveBeenCalled();
		});

		it('supports POST /api/forum/:postId/bookmark alias', async () => {
			const mockUser = {
				_id: authorId,
				bookmarkedPosts: [],
				savedPosts: [],
				save: jest.fn().mockResolvedValue(true),
			};
			User.findById.mockResolvedValue(mockUser);

			const res = await request(app)
				.post(`/api/forum/${postId}/bookmark`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(res.body.isBookmarked).toBe(true);
			expect(res.body.isSaved).toBe(true);
			expect(mockUser.bookmarkedPosts).toContain(postId);
			expect(mockUser.savedPosts).toContain(postId);
		});

		it('returns user saved posts via GET /api/forum/saved', async () => {
			User.findById.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue({
						_id: authorId,
						savedPosts: [postId],
						bookmarkedPosts: [postId],
					}),
				}),
			});

			const mockSavedPost = {
				_id: postId,
				title: 'Saved Drill Guide',
				authorId,
				authorName: 'AuthorPlayer',
				status: 'active',
				isFlagged: false,
			};
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([mockSavedPost]),
				}),
			});

			const res = await request(app)
				.get('/api/forum/saved')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body.length).toBe(1);
			expect(res.body[0]._id).toBe(postId);
		});
	});

	// ==========================================
	// 9. J9: POST EDIT TRANSPARENCY
	// ==========================================
	describe('9. J9 Post Edit Transparency (PUT /api/forum/:postId)', () => {
		it('sets isEdited = true and editedAt timestamp on post update', async () => {
			const mockDoc = {
				_id: postId,
				authorId,
				title: 'Original Title',
				content: 'Original Content',
				isEdited: false,
				editedAt: null,
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

			const beforeTime = Date.now();
			const res = await request(app)
				.put(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Updated Title',
					content: 'Updated Content with edits',
				});

			expect(res.status).toBe(200);
			expect(mockDoc.isEdited).toBe(true);
			expect(mockDoc.editedAt).toBeDefined();
			expect(new Date(mockDoc.editedAt).getTime()).toBeGreaterThanOrEqual(beforeTime - 100);
		});
	});

	// ==========================================
	// 10. J10: MEMBER MENTION SEARCH
	// ==========================================
	describe('10. J10 Member Mention Autocomplete Search (GET /api/forum/members)', () => {
		it('queries members with regex and returns { users: [...] } with profile info', async () => {
			const res = await request(app).get('/api/forum/members?q=Player');

			expect(res.status).toBe(200);
			expect(res.body.users).toBeDefined();
			expect(Array.isArray(res.body.users)).toBe(true);
			expect(res.body.users.length).toBeGreaterThan(0);
			expect(res.body.users[0]).toHaveProperty('id');
			expect(res.body.users[0]).toHaveProperty('name');
			expect(res.body.users[0]).toHaveProperty('skillLevel');
		});
	});
});
