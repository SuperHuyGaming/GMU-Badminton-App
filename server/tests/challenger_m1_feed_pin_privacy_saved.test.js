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
const coachId = '660000000000000000000004';
const adminId = '660000000000000000000009';

const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'AuthorPlayer' }, JWT_SECRET);
const tokenFriend = jwt.sign({ id: friendId, userId: friendId, role: 'user', name: 'FriendPlayer' }, JWT_SECRET);
const tokenStranger = jwt.sign({ id: strangerId, userId: strangerId, role: 'user', name: 'StrangerPlayer' }, JWT_SECRET);
const tokenCoach = jwt.sign({ id: coachId, userId: coachId, role: 'coach', name: 'CoachUser' }, JWT_SECRET);
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

describe('Adversarial Stress Test: J4, J5, J6, J8 Backend Implementation', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Default User.find mock
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				limit: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([
						{ _id: authorId, name: 'AuthorPlayer', profilePic: 'author.png', role: 'user', skillLevel: 'Intermediate', badges: [] },
						{ _id: friendId, name: 'FriendPlayer', profilePic: 'friend.png', role: 'user', skillLevel: 'Advanced', badges: [] },
						{ _id: strangerId, name: 'StrangerPlayer', profilePic: 'stranger.png', role: 'user', skillLevel: 'Beginner', badges: [] },
						{ _id: coachId, name: 'CoachUser', profilePic: 'coach.png', role: 'coach', skillLevel: 'Advanced', badges: [] },
						{ _id: adminId, name: 'AdminUser', profilePic: 'admin.png', role: 'admin', skillLevel: 'Pro', badges: ['Staff'] },
					]),
				}),
				lean: jest.fn().mockResolvedValue([
					{ _id: authorId, name: 'AuthorPlayer', profilePic: 'author.png', role: 'user', skillLevel: 'Intermediate', badges: [] },
					{ _id: friendId, name: 'FriendPlayer', profilePic: 'friend.png', role: 'user', skillLevel: 'Advanced', badges: [] },
					{ _id: strangerId, name: 'StrangerPlayer', profilePic: 'stranger.png', role: 'user', skillLevel: 'Beginner', badges: [] },
					{ _id: coachId, name: 'CoachUser', profilePic: 'coach.png', role: 'coach', skillLevel: 'Advanced', badges: [] },
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
	// 1. J4 FEED SORTING & PIN PRIORITY ANCHORING
	// ==========================================
	describe('1. J4 Feed Sorting Stress Tests', () => {
		it('tab=top: strictly ranks pinned posts above unpinned regardless of engagement score, then by engagement score (reactions + comments*2)', async () => {
			const postPinnedLow = {
				_id: '660000000000000000000101',
				title: 'Pinned Megathread (0 score)',
				reactions: [],
				comments: [],
				isPinned: true,
				createdAt: new Date('2026-10-01T00:00:00Z'),
			};
			const postPinnedHigh = {
				_id: '660000000000000000000102',
				title: 'Pinned Tournament Notice (high score)',
				reactions: [{ emoji: '👍' }, { emoji: '❤️' }],
				comments: [{ content: 'c1' }], // 2 + 1*2 = 4
				isPinned: true,
				createdAt: new Date('2026-10-02T00:00:00Z'),
			};
			const postUnpinnedViral = {
				_id: '660000000000000000000103',
				title: 'Unpinned Viral Post (massive score)',
				reactions: [{ emoji: '👍' }, { emoji: '❤️' }, { emoji: '🏸' }, { emoji: '😮' }], // 4
				comments: [{ content: 'c1' }, { content: 'c2' }, { content: 'c3' }], // 3*2 = 6 => total 10
				isPinned: false,
				createdAt: new Date('2026-10-05T00:00:00Z'),
			};
			const postUnpinnedMedium = {
				_id: '660000000000000000000104',
				title: 'Unpinned Medium Post',
				reactions: [{ emoji: '👍' }], // 1
				comments: [{ content: 'c1' }], // 1*2 = 2 => total 3
				isPinned: false,
				createdAt: new Date('2026-10-03T00:00:00Z'),
			};
			const postUnpinnedZero = {
				_id: '660000000000000000000105',
				title: 'Unpinned Zero Engagement',
				reactions: [],
				comments: [],
				isPinned: false,
				createdAt: new Date('2026-10-04T00:00:00Z'),
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							// Return unsorted from database mock to test route in-memory sorting
							lean: jest.fn().mockResolvedValue([
								postUnpinnedMedium,
								postPinnedLow,
								postUnpinnedViral,
								postUnpinnedZero,
								postPinnedHigh,
							]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=top');
			expect(res.status).toBe(200);
			expect(res.body.length).toBe(5);

			// Expected order:
			// 1. postPinnedHigh (pinned, score = 4)
			// 2. postPinnedLow (pinned, score = 0) -> MUST be higher than postUnpinnedViral (score 10)!
			// 3. postUnpinnedViral (unpinned, score = 10)
			// 4. postUnpinnedMedium (unpinned, score = 3)
			// 5. postUnpinnedZero (unpinned, score = 0)
			expect(res.body[0]._id).toBe(postPinnedHigh._id);
			expect(res.body[1]._id).toBe(postPinnedLow._id);
			expect(res.body[2]._id).toBe(postUnpinnedViral._id);
			expect(res.body[3]._id).toBe(postUnpinnedMedium._id);
			expect(res.body[4]._id).toBe(postUnpinnedZero._id);
		});

		it('tab=top: breaks ties using newer createdAt timestamp', async () => {
			const postTiedOlder = {
				_id: '660000000000000000000111',
				title: 'Older Post with Score 4',
				reactions: [{ emoji: '👍' }, { emoji: '❤️' }], // 2
				comments: [{ content: 'c1' }], // 2 => total 4
				isPinned: false,
				createdAt: new Date('2026-10-01T10:00:00Z'),
			};
			const postTiedNewer = {
				_id: '660000000000000000000112',
				title: 'Newer Post with Score 4',
				reactions: [{ emoji: '🏸' }, { emoji: '🔥' }, { emoji: '😮' }, { emoji: '👏' }], // 4 + 0 = 4
				comments: [],
				isPinned: false,
				createdAt: new Date('2026-10-02T10:00:00Z'),
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([postTiedOlder, postTiedNewer]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=top');
			expect(res.status).toBe(200);
			expect(res.body[0]._id).toBe(postTiedNewer._id);
			expect(res.body[1]._id).toBe(postTiedOlder._id);
		});

		it('tab=top: handles missing/null reactions and comments arrays without NaN crash', async () => {
			const postCorrupt = {
				_id: '660000000000000000000121',
				title: 'Corrupt Arrays Post',
				reactions: null,
				comments: undefined,
				isPinned: false,
				createdAt: new Date('2026-10-01T00:00:00Z'),
			};
			const postNormal = {
				_id: '660000000000000000000122',
				title: 'Normal Post with 1 Reaction',
				reactions: [{ emoji: '👍' }],
				comments: [],
				isPinned: false,
				createdAt: new Date('2026-10-02T00:00:00Z'),
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([postCorrupt, postNormal]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=top');
			expect(res.status).toBe(200);
			expect(res.body[0]._id).toBe(postNormal._id);
			expect(res.body[1]._id).toBe(postCorrupt._id);
		});

		it('tab=recent_activity: queries MongoDB with sort { isPinned: -1, lastActivityAt: -1, createdAt: -1 }', async () => {
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=recent_activity');
			expect(res.status).toBe(200);
			const sortArg = Post.find().sort.mock.calls[0][0];
			expect(sortArg.isPinned).toBe(-1);
			expect(sortArg.lastActivityAt).toBe(-1);
			expect(sortArg.createdAt).toBe(-1);
		});

		it('tab=latest: queries MongoDB with sort { isPinned: -1, createdAt: -1, timestamp: -1 }', async () => {
			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([]),
						}),
					}),
				}),
			});

			const res = await request(app).get('/api/forum?tab=latest');
			expect(res.status).toBe(200);
			const sortArg = Post.find().sort.mock.calls[0][0];
			expect(sortArg.isPinned).toBe(-1);
			expect(sortArg.createdAt).toBe(-1);
		});
	});

	// ==========================================
	// 2. J5 PINNING HIERARCHY & AUTHORIZATION
	// ==========================================
	describe('2. J5 Pinning Hierarchy Authorization Tests', () => {
		const targetPostId = '660000000000000000000201';

		it('allows author of the post to pin their post', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId,
				title: 'Author Post',
				isPinned: false,
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, isPinned: this.isPinned };
				},
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.isPinned).toBe(true);
			expect(mockPost.isPinned).toBe(true);
			expect(mockPost.save).toHaveBeenCalled();
			expect(mockIo.emit).toHaveBeenCalledWith('postUpdated', expect.anything());
		});

		it('allows author of the post to unpin their post (toggle off)', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId,
				title: 'Author Post',
				isPinned: true,
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, isPinned: this.isPinned };
				},
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(res.body.isPinned).toBe(false);
			expect(mockPost.isPinned).toBe(false);
		});

		it('allows administrator to pin any user post', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId: strangerId,
				title: 'Stranger Post',
				isPinned: false,
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, authorId: this.authorId, isPinned: this.isPinned };
				},
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`)
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.status).toBe(200);
			expect(res.body.isPinned).toBe(true);
			expect(mockPost.isPinned).toBe(true);
		});

		it('rejects random non-author non-admin user with 403 Forbidden', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId,
				title: 'Author Post',
				isPinned: false,
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`)
				.set('Authorization', `Bearer ${tokenStranger}`);

			expect(res.status).toBe(403);
			expect(res.body.message).toContain('Only administrators and post authors can pin posts');
			expect(mockPost.save).not.toHaveBeenCalled();
		});

		it('rejects non-admin elevated roles (e.g. coach) from pinning others posts with 403 Forbidden', async () => {
			const mockPost = {
				_id: targetPostId,
				authorId,
				title: 'Author Post',
				isPinned: false,
				save: jest.fn(),
			};
			Post.findById.mockResolvedValue(mockPost);

			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`)
				.set('Authorization', `Bearer ${tokenCoach}`);

			expect(res.status).toBe(403);
			expect(mockPost.save).not.toHaveBeenCalled();
		});

		it('rejects unauthenticated pinning requests with 401 Unauthorized', async () => {
			const res = await request(app)
				.put(`/api/forum/${targetPostId}/pin`);

			expect(res.status).toBe(401);
		});

		it('returns 400 Bad Request for malformed post IDs', async () => {
			const res = await request(app)
				.put('/api/forum/invalid-object-id/pin')
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('Invalid post ID format');
		});

		it('returns 404 Not Found if post does not exist', async () => {
			Post.findById.mockResolvedValue(null);
			ActivityFeed.findById.mockResolvedValue(null);

			const nonExistentId = '660000000000000000000999';
			const res = await request(app)
				.put(`/api/forum/${nonExistentId}/pin`)
				.set('Authorization', `Bearer ${tokenAdmin}`);

			expect(res.status).toBe(404);
			expect(res.body.message).toContain('Post not found');
		});
	});

	// ==========================================
	// 3. J6 PRIVACY VISIBILITY ENFORCEMENT
	// ==========================================
	describe('3. J6 Privacy Visibility Enforcement Tests', () => {
		const privPostId = '660000000000000000000301';

		beforeEach(() => {
			User.findById.mockImplementation((id) => {
				const idStr = id ? id.toString() : '';
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

		// PUBLIC
		it('PUBLIC post: accessible to unauthenticated users, author, friend, stranger, and admin in GET /api/forum/:postId', async () => {
			const publicPost = {
				_id: privPostId,
				authorId,
				title: 'Public Community Tourney',
				visibility: 'PUBLIC',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility };
				},
			};
			Post.findById.mockResolvedValue(publicPost);

			// Unauthenticated
			const resAnon = await request(app).get(`/api/forum/${privPostId}`);
			expect(resAnon.status).toBe(200);

			// Stranger
			const resStranger = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenStranger}`);
			expect(resStranger.status).toBe(200);

			// Friend
			const resFriend = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenFriend}`);
			expect(resFriend.status).toBe(200);

			// Author
			const resAuthor = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`);
			expect(resAuthor.status).toBe(200);

			// Admin
			const resAdmin = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAdmin}`);
			expect(resAdmin.status).toBe(200);
		});

		// FRIENDS_ONLY
		it('FRIENDS_ONLY post: accessible to author, admin, and mutual friends; blocked (403) from non-friends and unauthenticated users', async () => {
			const friendsPost = {
				_id: privPostId,
				authorId,
				title: 'Friends Only Practice Session',
				visibility: 'FRIENDS_ONLY',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility };
				},
			};
			Post.findById.mockResolvedValue(friendsPost);

			// 1. Author -> 200 OK
			const resAuthor = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`);
			expect(resAuthor.status).toBe(200);

			// 2. Admin -> 200 OK
			const resAdmin = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAdmin}`);
			expect(resAdmin.status).toBe(200);

			// 3. Mutual Friend -> 200 OK
			const resFriend = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenFriend}`);
			expect(resFriend.status).toBe(200);

			// 4. Stranger (non-friend) -> 403 Forbidden
			const resStranger = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenStranger}`);
			expect(resStranger.status).toBe(403);
			expect(resStranger.body.message).toContain('only visible to friends');

			// 5. Unauthenticated user -> 403 Forbidden
			const resAnon = await request(app).get(`/api/forum/${privPostId}`);
			expect(resAnon.status).toBe(403);
			expect(resAnon.body.message).toContain('only visible to friends');
		});

		// ONLY_ME
		it('ONLY_ME post: accessible strictly to author and admin; blocked (403) from mutual friends, non-friends, and unauthenticated users', async () => {
			const privatePost = {
				_id: privPostId,
				authorId,
				title: 'My Private Drill Notes',
				visibility: 'ONLY_ME',
				toObject() {
					return { _id: this._id, authorId: this.authorId, visibility: this.visibility };
				},
			};
			Post.findById.mockResolvedValue(privatePost);

			// 1. Author -> 200 OK
			const resAuthor = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`);
			expect(resAuthor.status).toBe(200);

			// 2. Admin -> 200 OK
			const resAdmin = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenAdmin}`);
			expect(resAdmin.status).toBe(200);

			// 3. Mutual Friend -> 403 Forbidden
			const resFriend = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenFriend}`);
			expect(resFriend.status).toBe(403);
			expect(resFriend.body.message).toContain('This post is private');

			// 4. Stranger -> 403 Forbidden
			const resStranger = await request(app)
				.get(`/api/forum/${privPostId}`)
				.set('Authorization', `Bearer ${tokenStranger}`);
			expect(resStranger.status).toBe(403);
			expect(resStranger.body.message).toContain('This post is private');

			// 5. Unauthenticated user -> 403 Forbidden
			const resAnon = await request(app).get(`/api/forum/${privPostId}`);
			expect(resAnon.status).toBe(403);
			expect(resAnon.body.message).toContain('This post is private');
		});

		// Feed list privacy & search exclusion
		it('filters out FRIENDS_ONLY and ONLY_ME posts in GET /api/forum during search query execution', async () => {
			const publicPost = { _id: '660000000000000000000311', title: 'Secret Public Announcement', visibility: 'PUBLIC', authorId };
			const friendsOnlyPost = { _id: '660000000000000000000312', title: 'Secret Friends Game', visibility: 'FRIENDS_ONLY', authorId };
			const onlyMePost = { _id: '660000000000000000000313', title: 'Secret Diary Entry', visibility: 'ONLY_ME', authorId };

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([publicPost, friendsOnlyPost, onlyMePost]),
						}),
					}),
				}),
			});

			// Stranger searches for "Secret"
			const resStranger = await request(app)
				.get('/api/forum?search=Secret')
				.set('Authorization', `Bearer ${tokenStranger}`);

			expect(resStranger.status).toBe(200);
			// Stranger must ONLY see publicPost; friendsOnlyPost and onlyMePost must be stripped!
			expect(resStranger.body.length).toBe(1);
			expect(resStranger.body[0]._id).toBe(publicPost._id);
		});

		it('allows author to see all their own posts (including ONLY_ME and FRIENDS_ONLY) in GET /api/forum', async () => {
			const publicPost = { _id: '660000000000000000000311', title: 'Secret Public', visibility: 'PUBLIC', authorId };
			const friendsOnlyPost = { _id: '660000000000000000000312', title: 'Secret Friends', visibility: 'FRIENDS_ONLY', authorId };
			const onlyMePost = { _id: '660000000000000000000313', title: 'Secret Diary', visibility: 'ONLY_ME', authorId };

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([publicPost, friendsOnlyPost, onlyMePost]),
						}),
					}),
				}),
			});

			const resAuthor = await request(app)
				.get('/api/forum?search=Secret')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(resAuthor.status).toBe(200);
			expect(resAuthor.body.length).toBe(3);
		});
	});

	// ==========================================
	// 4. J8 SAVED POSTS & BOOKMARKS
	// ==========================================
	describe('4. J8 Saved Posts & Bookmarking Tests', () => {
		const targetPostId = '660000000000000000000401';

		it('saves post on first POST /api/forum/:postId/save and unsaves on second call (idempotent toggle)', async () => {
			const mockUser = {
				_id: authorId,
				bookmarkedPosts: [],
				savedPosts: [],
				save: jest.fn().mockResolvedValue(true),
			};
			User.findById.mockResolvedValue(mockUser);

			// 1. First save call
			const resSave = await request(app)
				.post(`/api/forum/${targetPostId}/save`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(resSave.status).toBe(200);
			expect(resSave.body.isSaved).toBe(true);
			expect(resSave.body.isBookmarked).toBe(true);
			expect(mockUser.savedPosts).toContain(targetPostId);
			expect(mockUser.bookmarkedPosts).toContain(targetPostId);

			// 2. Second save call (unsave toggle)
			const resUnsave = await request(app)
				.post(`/api/forum/${targetPostId}/save`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(resUnsave.status).toBe(200);
			expect(resUnsave.body.isSaved).toBe(false);
			expect(resUnsave.body.isBookmarked).toBe(false);
			expect(mockUser.savedPosts).not.toContain(targetPostId);
			expect(mockUser.bookmarkedPosts).not.toContain(targetPostId);
		});

		it('supports PUT /api/forum/:postId/save and PUT /api/forum/:postId/bookmark aliases', async () => {
			const mockUser = {
				_id: authorId,
				bookmarkedPosts: [],
				savedPosts: [],
				save: jest.fn().mockResolvedValue(true),
			};
			User.findById.mockResolvedValue(mockUser);

			const resPut = await request(app)
				.put(`/api/forum/${targetPostId}/save`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(resPut.status).toBe(200);
			expect(resPut.body.isSaved).toBe(true);

			const resPutBookmark = await request(app)
				.put(`/api/forum/${targetPostId}/bookmark`)
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(resPutBookmark.status).toBe(200);
			expect(resPutBookmark.body.isSaved).toBe(false); // Toggled off
		});

		it('GET /api/forum/saved: returns 401 when unauthenticated', async () => {
			const res = await request(app).get('/api/forum/saved');
			expect(res.status).toBe(401);
		});

		it('GET /api/forum/saved: returns only active saved posts, excluding quarantined or deleted posts', async () => {
			const activeSavedId = '660000000000000000000411';
			const quarantinedSavedId = '660000000000000000000412';

			User.findById.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue({
						_id: authorId,
						savedPosts: [activeSavedId, quarantinedSavedId],
						bookmarkedPosts: [activeSavedId, quarantinedSavedId],
					}),
				}),
			});

			const activePost = {
				_id: activeSavedId,
				title: 'Active Saved Tournament Guide',
				status: 'active',
				isFlagged: false,
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue([activePost]),
				}),
			});

			const res = await request(app)
				.get('/api/forum/saved')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body.length).toBe(1);
			expect(res.body[0]._id).toBe(activeSavedId);

			// Verify Post.find filter arguments excluded quarantined and deleted posts
			const filterArg = Post.find.mock.calls[0][0];
			expect(filterArg.status).toEqual({ $nin: ['quarantined', 'deleted'] });
			expect(filterArg.isFlagged).toEqual({ $ne: true });
		});

		it('GET /api/forum?tab=saved: returns 401 when unauthenticated', async () => {
			const res = await request(app).get('/api/forum?tab=saved');
			expect(res.status).toBe(401);
			expect(res.body.message).toContain('Authentication required');
		});

		it('GET /api/forum?tab=saved: returns saved posts for authenticated user', async () => {
			User.findById.mockReturnValue({
				select: jest.fn().mockReturnValue({
					lean: jest.fn().mockResolvedValue({
						_id: authorId,
						savedPosts: [targetPostId],
						bookmarkedPosts: [targetPostId],
					}),
				}),
				lean: jest.fn().mockResolvedValue({
					_id: authorId,
					savedPosts: [targetPostId],
					bookmarkedPosts: [targetPostId],
				}),
			});

			const mockSavedPost = {
				_id: targetPostId,
				title: 'Saved Post Feed View',
				authorId,
				visibility: 'PUBLIC',
			};

			Post.find.mockReturnValue({
				sort: jest.fn().mockReturnValue({
					skip: jest.fn().mockReturnValue({
						limit: jest.fn().mockReturnValue({
							lean: jest.fn().mockResolvedValue([mockSavedPost]),
						}),
					}),
				}),
			});

			const res = await request(app)
				.get('/api/forum?tab=saved')
				.set('Authorization', `Bearer ${tokenAuthor}`);

			expect(res.status).toBe(200);
			expect(res.body.length).toBe(1);
			expect(res.body[0]._id).toBe(targetPostId);
		});
	});
});
