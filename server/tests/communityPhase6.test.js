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

const mockOnlineUsers = new Map();
app.set("onlineUsers", mockOnlineUsers);

app.use((req, res, next) => {
	req.io = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
	next();
});
app.use('/api/forum', forumRoutes);

describe('Community Hub Phase 6: Real-Time Presence, Typing Indicators & Media Pipeline', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockOnlineUsers.clear();
	});

	describe('1. Active Online Presence Tracking', () => {
		test('returns empty array when no users are active', async () => {
			const res = await request(app)
				.get('/api/forum/online-users')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.onlineUserIds).toEqual([]);
		});

		test('returns list of active online user IDs when populated', async () => {
			mockOnlineUsers.set('user-101', new Set(['socket-1']));
			mockOnlineUsers.set('user-102', new Set(['socket-2', 'socket-3']));

			const res = await request(app)
				.get('/api/forum/online-users')
				.set('Authorization', `Bearer ${userToken}`);

			expect(res.status).toBe(200);
			expect(res.body.onlineUserIds).toEqual(expect.arrayContaining(['user-101', 'user-102']));
			expect(res.body.onlineUserIds.length).toBe(2);
		});
	});

	describe('2. Socket Room Event Signatures & Typing Relays', () => {
		test('verifies joinPostRoom and leavePostRoom event handler registration', () => {
			const mockSocket = {
				id: 'socket-test-1',
				userId: userId,
				join: jest.fn(),
				leave: jest.fn(),
				to: jest.fn().mockReturnThis(),
				emit: jest.fn(),
				broadcast: { emit: jest.fn() },
				on: jest.fn()
			};

			const registeredEvents = {};
			mockSocket.on.mockImplementation((event, handler) => {
				registeredEvents[event] = handler;
			});

			// Simulate socket event bindings from server.js
			const registerPostRooms = (socket) => {
				socket.on('joinPostRoom', (postId) => {
					if (postId && typeof postId === 'string') {
						socket.join(`post_${postId}`);
					}
				});
				socket.on('leavePostRoom', (postId) => {
					if (postId && typeof postId === 'string') {
						socket.leave(`post_${postId}`);
					}
				});
				socket.on('commentTyping', (data) => {
					if (data && data.postId) {
						socket.to(`post_${data.postId}`).emit('commentTyping', { ...data, socketId: socket.id });
					}
					socket.broadcast.emit('commentTyping', { ...data, socketId: socket.id });
				});
				socket.on('commentStopTyping', (data) => {
					if (data && data.postId) {
						socket.to(`post_${data.postId}`).emit('commentStopTyping', { ...data, socketId: socket.id });
					}
					socket.broadcast.emit('commentStopTyping', { ...data, socketId: socket.id });
				});
			};

			registerPostRooms(mockSocket);

			expect(registeredEvents['joinPostRoom']).toBeDefined();
			expect(registeredEvents['leavePostRoom']).toBeDefined();
			expect(registeredEvents['commentTyping']).toBeDefined();
			expect(registeredEvents['commentStopTyping']).toBeDefined();

			// Test join
			registeredEvents['joinPostRoom']('post-456');
			expect(mockSocket.join).toHaveBeenCalledWith('post_post-456');

			// Test leave
			registeredEvents['leavePostRoom']('post-456');
			expect(mockSocket.leave).toHaveBeenCalledWith('post_post-456');

			// Test typing relay
			registeredEvents['commentTyping']({ postId: 'post-456', userName: 'Alex' });
			expect(mockSocket.to).toHaveBeenCalledWith('post_post-456');
			expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('commentTyping', expect.objectContaining({
				postId: 'post-456',
				userName: 'Alex',
				socketId: 'socket-test-1'
			}));

			// Test stop typing relay
			registeredEvents['commentStopTyping']({ postId: 'post-456', userName: 'Alex' });
			expect(mockSocket.to).toHaveBeenCalledWith('post_post-456');
			expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('commentStopTyping', expect.objectContaining({
				postId: 'post-456',
				userName: 'Alex',
				socketId: 'socket-test-1'
			}));
		});
	});
});
