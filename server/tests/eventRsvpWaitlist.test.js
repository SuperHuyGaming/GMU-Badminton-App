const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const forumRoutes = require('../routes/forum');
const Post = require('../models/Post');
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');
const { sendPushToUser } = require('../utils/pushNotifications');

jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../utils/pushNotifications', () => ({
	sendPushToUser: jest.fn().mockResolvedValue({ success: true, sentCount: 1 }),
	sendPushToAllUsers: jest.fn().mockResolvedValue()
}));
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"etag-rsvp"'),
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
const hostUserId = '660000000000000000000001';
const player1Id = '660000000000000000000002';
const player2Id = '660000000000000000000003';
const player3Id = '660000000000000000000004';

const hostToken = jwt.sign({ id: hostUserId, userId: hostUserId, role: 'user', name: 'Rally Host' }, JWT_SECRET);
const player1Token = jwt.sign({ id: player1Id, userId: player1Id, role: 'user', name: 'Player One' }, JWT_SECRET);
const player2Token = jwt.sign({ id: player2Id, userId: player2Id, role: 'user', name: 'Player Two' }, JWT_SECRET);
const player3Token = jwt.sign({ id: player3Id, userId: player3Id, role: 'user', name: 'Player Three' }, JWT_SECRET);

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

describe('Event RSVP & FIFO Waitlist Auto-Promotion Suite', () => {
	const postId = '660000000000000000000101';

	beforeEach(() => {
		jest.clearAllMocks();
		User.findById.mockImplementation((id) => ({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue({
					_id: id,
					name: `User ${id.slice(-4)}`,
					profilePic: `pic_${id.slice(-4)}.jpg`
				})
			})
		}));
		User.find.mockReturnValue({
			select: jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue([])
			})
		});
	});

	it('allows a player to RSVP to a rally within capacity bounds', async () => {
		const mockPost = {
			_id: postId,
			authorId: hostUserId,
			category: 'meetup_rally',
			playerMatchmaking: {
				slotsNeeded: 2,
				rsvpList: []
			},
			rsvp: {
				capacity: 2,
				attendees: [],
				waitlist: []
			},
			save: jest.fn().mockResolvedValue(true),
			toObject: function () {
				return { ...this };
			}
		};

		Post.findById.mockImplementation((id) => (id === postId ? mockPost : null));
		ActivityFeed.findById.mockResolvedValue(null);

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(200);
		expect(mockPost.save).toHaveBeenCalled();
		expect(mockPost.playerMatchmaking.rsvpList).toHaveLength(1);
		expect(mockPost.playerMatchmaking.rsvpList[0].status).toBe('confirmed');
		expect(mockPost.playerMatchmaking.rsvpList[0].userId).toBe(player1Id);
		expect(mockPost.rsvp.attendees).toContain(player1Id);
		expect(mockPost.playerMatchmaking.isFilled).toBe(false);
	});

	it('places a player on the waitlist when slotsNeeded capacity is reached', async () => {
		const mockPost = {
			_id: postId,
			authorId: hostUserId,
			category: 'meetup_rally',
			playerMatchmaking: {
				slotsNeeded: 1,
				rsvpList: [
					{ userId: player1Id, userName: 'Player One', status: 'confirmed' }
				]
			},
			rsvp: {
				capacity: 1,
				attendees: [player1Id],
				waitlist: []
			},
			save: jest.fn().mockResolvedValue(true),
			toObject: function () {
				return { ...this };
			}
		};

		Post.findById.mockImplementation((id) => (id === postId ? mockPost : null));

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player2Token}`)
			.send({});

		expect(res.status).toBe(200);
		expect(mockPost.playerMatchmaking.rsvpList).toHaveLength(2);
		const waitlisted = mockPost.playerMatchmaking.rsvpList.find(r => r.userId === player2Id);
		expect(waitlisted).toBeDefined();
		expect(waitlisted.status).toBe('waitlist');
		expect(mockPost.rsvp.waitlist).toContain(player2Id);
		expect(mockPost.playerMatchmaking.isFilled).toBe(true);
	});

	it('promotes the first waitlisted player (FIFO) when a confirmed attendee cancels', async () => {
		const mockPost = {
			_id: postId,
			authorId: hostUserId,
			category: 'meetup_rally',
			playerMatchmaking: {
				slotsNeeded: 1,
				rsvpList: [
					{ userId: player1Id, userName: 'Player One', status: 'confirmed' },
					{ userId: player2Id, userName: 'Player Two', status: 'waitlist' },
					{ userId: player3Id, userName: 'Player Three', status: 'waitlist' }
				]
			},
			rsvp: {
				capacity: 1,
				attendees: [player1Id],
				waitlist: [player2Id, player3Id]
			},
			save: jest.fn().mockResolvedValue(true),
			toObject: function () {
				return { ...this };
			}
		};

		Post.findById.mockImplementation((id) => (id === postId ? mockPost : null));

		// Player 1 cancels their confirmed RSVP
		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(200);
		expect(mockPost.save).toHaveBeenCalled();

		// Player 1 should be gone
		expect(mockPost.playerMatchmaking.rsvpList.find(r => r.userId === player1Id)).toBeUndefined();

		// Player 2 should be promoted from waitlist to confirmed (FIFO)
		const promotedEntry = mockPost.playerMatchmaking.rsvpList.find(r => r.userId === player2Id);
		expect(promotedEntry).toBeDefined();
		expect(promotedEntry.status).toBe('confirmed');

		// Player 3 should remain in waitlist
		const remainingWaitlisted = mockPost.playerMatchmaking.rsvpList.find(r => r.userId === player3Id);
		expect(remainingWaitlisted.status).toBe('waitlist');

		// Check post.rsvp attendees and waitlist
		expect(mockPost.rsvp.attendees).toContain(player2Id);
		expect(mockPost.rsvp.waitlist).not.toContain(player2Id);
		expect(mockPost.rsvp.waitlist).toContain(player3Id);

		// Verify targeted push notification was dispatched to promoted player
		expect(sendPushToUser).toHaveBeenCalledWith(
			player2Id,
			expect.objectContaining({
				title: expect.stringContaining("You're in!"),
				body: expect.stringContaining("promoted")
			})
		);

		// Verify socket events
		expect(mockIo.to).toHaveBeenCalledWith(player2Id);
		expect(mockIo.emit).toHaveBeenCalledWith(
			'waitlistPromoted',
			expect.objectContaining({ postId, userId: player2Id, status: 'confirmed' })
		);
		expect(mockIo.emit).toHaveBeenCalledWith(
			'rallyRsvpUpdated',
			expect.objectContaining({ postId, isFilled: true })
		);
	});

	it('rejects the rally host from RSVPing to their own post', async () => {
		const mockPost = {
			_id: postId,
			authorId: hostUserId,
			category: 'meetup_rally',
			playerMatchmaking: {
				slotsNeeded: 2,
				rsvpList: []
			},
			save: jest.fn().mockResolvedValue(true),
			toObject: function () { return { ...this }; }
		};

		Post.findById.mockImplementation((id) => (id === postId ? mockPost : null));

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${hostToken}`)
			.send({});

		expect(res.status).toBe(400);
		expect(res.body.message).toMatch(/cannot RSVP to your own post/i);
		expect(mockPost.save).not.toHaveBeenCalled();
	});

	it('rejects RSVP if the post is quarantined or deleted', async () => {
		const mockPost = {
			_id: postId,
			authorId: hostUserId,
			category: 'meetup_rally',
			status: 'quarantined',
			isFlagged: true,
			playerMatchmaking: { slotsNeeded: 2, rsvpList: [] }
		};

		Post.findById.mockImplementation((id) => (id === postId ? mockPost : null));

		const res = await request(app)
			.post(`/api/forum/${postId}/rsvp`)
			.set('Authorization', `Bearer ${player1Token}`)
			.send({});

		expect(res.status).toBe(403);
		expect(res.body.message).toMatch(/cannot RSVP/i);
	});
});
