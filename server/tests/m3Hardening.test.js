// server/tests/m3Hardening.test.js
// Comment reaction validation/atomicity and post media + link preview persistence.
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const User = require('../models/User');

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
const authorId = '670000000000000000000001';
const reactorId = '670000000000000000000002';
const postId = '670000000000000000000010';
const commentId = '670000000000000000000020';

const tokenAuthor = jwt.sign({ id: authorId, userId: authorId, role: 'user', name: 'Author' }, JWT_SECRET);
const tokenReactor = jwt.sign({ id: reactorId, userId: reactorId, role: 'user', name: 'Reactor' }, JWT_SECRET);

const mockIo = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
const app = express();
app.use(express.json());
app.use((req, res, next) => {
	req.io = mockIo;
	next();
});
app.use('/api/forum', forumRoutes);

/**
 * In-memory stand-in for Post.updateOne that honours the guarded filters used by the comment
 * reaction handler, so we can verify the toggle never produces duplicate reactions.
 */
const buildCommentStore = (initialReactions = []) => {
	const store = {
		_id: postId,
		authorId,
		comments: [{ _id: commentId, authorId, content: 'Nice rally', reactions: [...initialReactions] }],
	};

	const comment = () => store.comments[0];
	const matchesFilter = (filter) => {
		const elem = filter.comments.$elemMatch;
		if (String(elem._id) !== commentId) return false;
		const reactions = comment().reactions;
		if (elem.reactions) {
			const { userId, emoji } = elem.reactions.$elemMatch;
			return reactions.some((r) => r.userId === userId && (
				typeof emoji === 'string' ? r.emoji === emoji : r.emoji !== emoji.$ne
			));
		}
		if (elem['reactions.userId']) {
			return !reactions.some((r) => r.userId === elem['reactions.userId'].$ne);
		}
		return false;
	};

	Post.updateOne.mockImplementation(async (filter, update) => {
		if (!matchesFilter(filter)) return { matchedCount: 0, modifiedCount: 0 };
		const c = comment();
		if (update.$pull) {
			const { userId } = update.$pull['comments.$[c].reactions'];
			c.reactions = c.reactions.filter((r) => r.userId !== userId);
		} else if (update.$set) {
			const userId = filter.comments.$elemMatch.reactions.$elemMatch.userId;
			c.reactions.forEach((r) => {
				if (r.userId === userId) {
					r.emoji = update.$set['comments.$[c].reactions.$[r].emoji'];
					r.reactionType = update.$set['comments.$[c].reactions.$[r].reactionType'];
				}
			});
		} else if (update.$push) {
			c.reactions.push({ ...update.$push['comments.$[c].reactions'] });
		}
		return { matchedCount: 1, modifiedCount: 1 };
	});

	Post.findById.mockImplementation(() => ({
		lean: jest.fn().mockImplementation(async () => JSON.parse(JSON.stringify(store))),
	}));

	return store;
};

describe('M3 hardening', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([]),
			}),
		});
	});

	describe('Comment reactions (POST/PUT /:postId/comments/:commentId/react)', () => {
		it('rejects an emoji outside the allowed list with 400 and never writes', async () => {
			buildCommentStore();
			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '<img src=x onerror=alert(1)>' });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain('Invalid emoji');
			expect(Post.updateOne).not.toHaveBeenCalled();
		});

		it('rejects a non-string emoji with 400', async () => {
			buildCommentStore();
			const res = await request(app)
				.put(`/api/forum/${postId}/comments/${commentId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: { $ne: null } });

			expect(res.status).toBe(400);
			expect(Post.updateOne).not.toHaveBeenCalled();
		});

		it('adds a reaction atomically and whitelists an unknown reactionType', async () => {
			const store = buildCommentStore();
			const res = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '❤️', reactionType: 'x'.repeat(5000) });

			expect(res.status).toBe(200);
			expect(res.body.action).toBe('added');
			expect(res.body.reactions).toHaveLength(1);
			expect(res.body.reactions[0]).toMatchObject({ userId: reactorId, emoji: '❤️', reactionType: 'love' });
			expect(store.comments[0].reactions).toHaveLength(1);
			expect(mockIo.emit).toHaveBeenCalledWith('commentReactionUpdated', expect.objectContaining({
				postId,
				commentId,
				action: 'added',
			}));
		});

		it('switches emoji in place and toggles off on repeat', async () => {
			const store = buildCommentStore([{ userId: reactorId, userName: 'Reactor', emoji: '👍', reactionType: 'like' }]);

			const switched = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '😂' });
			expect(switched.body.action).toBe('changed');
			expect(store.comments[0].reactions).toEqual([
				expect.objectContaining({ userId: reactorId, emoji: '😂', reactionType: 'haha' }),
			]);

			const removed = await request(app)
				.post(`/api/forum/${postId}/comments/${commentId}/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '😂' });
			expect(removed.body.action).toBe('removed');
			expect(store.comments[0].reactions).toHaveLength(0);
		});

		it('never produces two reactions for the same user under a concurrent double-tap', async () => {
			const store = buildCommentStore();
			await Promise.all([
				request(app)
					.post(`/api/forum/${postId}/comments/${commentId}/react`)
					.set('Authorization', `Bearer ${tokenReactor}`)
					.send({ emoji: '🔥' }),
				request(app)
					.post(`/api/forum/${postId}/comments/${commentId}/react`)
					.set('Authorization', `Bearer ${tokenReactor}`)
					.send({ emoji: '🔥' }),
			]);

			const mine = store.comments[0].reactions.filter((r) => r.userId === reactorId);
			expect(mine.length).toBeLessThanOrEqual(1);

			// The push step must always be guarded against an existing reaction by this user
			const pushCalls = Post.updateOne.mock.calls.filter(([, update]) => update.$push);
			pushCalls.forEach(([filter]) => {
				expect(filter.comments.$elemMatch['reactions.userId']).toEqual({ $ne: reactorId });
			});
		});

		it('returns 404 when the comment does not exist', async () => {
			buildCommentStore();
			const res = await request(app)
				.post(`/api/forum/${postId}/comments/670000000000000000000099/react`)
				.set('Authorization', `Bearer ${tokenReactor}`)
				.send({ emoji: '👍' });

			expect(res.status).toBe(404);
			expect(Post.updateOne).not.toHaveBeenCalled();
		});
	});

	describe('Post media and link preview persistence', () => {
		let savedPostData;
		beforeEach(() => {
			savedPostData = null;
			Post.mockImplementation(function (data) {
				savedPostData = data;
				return {
					...data,
					_id: postId,
					save: jest.fn().mockResolvedValue(true),
					toObject: () => ({ ...data, _id: postId }),
				};
			});
		});

		it('persists Cloudinary video/audio URLs and sanitized link previews on create', async () => {
			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Match highlights',
					content: 'Check the clip',
					videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4',
					audioUrl: 'https://res.cloudinary.com/demo/video/upload/v1/voice.mp3',
					linkPreviews: [
						{ url: 'https://bwfbadminton.com/news', title: 'BWF News', description: 'd', image: 'https://bwfbadminton.com/a.png', siteName: 'BWF' },
						{ url: 'javascript:alert(1)', title: 'bad' },
						{ url: 'https://example.com/2', title: 't'.repeat(1000), image: 'data:image/png;base64,AAAA' },
						{ url: 'https://example.com/3' },
						{ url: 'https://example.com/4' },
					],
				});

			expect(res.status).toBe(201);
			expect(savedPostData.videoUrl).toBe('https://res.cloudinary.com/demo/video/upload/v1/clip.mp4');
			expect(savedPostData.audioUrl).toBe('https://res.cloudinary.com/demo/video/upload/v1/voice.mp3');
			expect(savedPostData.linkPreviews).toHaveLength(3);
			expect(savedPostData.linkPreviews[0]).toMatchObject({
				url: 'https://bwfbadminton.com/news',
				title: 'BWF News',
				image: 'https://bwfbadminton.com/a.png',
				siteName: 'BWF',
				domain: 'bwfbadminton.com',
			});
			expect(savedPostData.linkPreviews.map((p) => p.url)).not.toContain('javascript:alert(1)');
			expect(savedPostData.linkPreviews[1].title.length).toBeLessThanOrEqual(300);
			expect(savedPostData.linkPreviews[1].image).toBe('');
		});

		it('ignores non-Cloudinary media URLs on create', async () => {
			const res = await request(app)
				.post('/api/forum')
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'Sneaky media',
					content: 'Hosted elsewhere',
					videoUrl: 'https://evil.example.com/video.mp4',
					audioUrl: 'http://res.cloudinary.com/demo/audio.mp3',
					linkPreviews: 'not-an-array',
				});

			expect(res.status).toBe(201);
			expect(savedPostData.videoUrl).toBe('');
			expect(savedPostData.audioUrl).toBe('');
			expect(savedPostData.linkPreviews).toEqual([]);
		});

		it('updates media and link previews on edit, ignoring invalid media URLs', async () => {
			const mockPostDoc = {
				_id: postId,
				authorId,
				title: 'Old',
				content: 'Old',
				videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1/old.mp4',
				audioUrl: 'https://res.cloudinary.com/demo/video/upload/v1/old.mp3',
				linkPreviews: [],
				save: jest.fn().mockResolvedValue(true),
				toObject() {
					return { _id: this._id, title: this.title, content: this.content, videoUrl: this.videoUrl, audioUrl: this.audioUrl, linkPreviews: this.linkPreviews };
				},
			};
			Post.findById.mockResolvedValue(mockPostDoc);

			const res = await request(app)
				.put(`/api/forum/${postId}`)
				.set('Authorization', `Bearer ${tokenAuthor}`)
				.send({
					title: 'New',
					content: 'New',
					videoUrl: 'https://evil.example.com/new.mp4',
					audioUrl: '',
					linkPreviews: [{ url: 'https://example.com/x', title: 'X', image: 'javascript:alert(1)' }],
				});

			expect(res.status).toBe(200);
			expect(mockPostDoc.videoUrl).toBe('https://res.cloudinary.com/demo/video/upload/v1/old.mp4');
			expect(mockPostDoc.audioUrl).toBe('');
			expect(mockPostDoc.linkPreviews).toEqual([
				expect.objectContaining({ url: 'https://example.com/x', title: 'X', image: '' }),
			]);
		});
	});
});
