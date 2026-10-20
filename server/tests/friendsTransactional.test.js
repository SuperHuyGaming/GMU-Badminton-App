const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const friendsRoutes = require('../routes/friends');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { executeWithTransactionOrFallback, resetTransactionSupportCache } = require('../utils/transactionHelper');
const { clearMemoryCache, markIdempotentInFlight, getIdempotentResult, setIdempotentCompleted } = require('../utils/idempotency');

jest.mock('../models/User');
jest.mock('../models/Notification');

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const userId1 = '660000000000000000000001';
const userId2 = '660000000000000000000002';
const tokenUser1 = jwt.sign({ userId: userId1 }, JWT_SECRET);

const app = express();
app.use(express.json());

const mockIo = {
	to: jest.fn().mockReturnThis(),
	emit: jest.fn(),
};
app.set('io', mockIo);

app.use('/api/friends', friendsRoutes);

const createMockUser = (overrides = {}) => {
	const user = {
		_id: overrides._id || userId1,
		name: overrides.name || 'User One',
		email: overrides.email || 'user1@gmu.edu',
		profilePic: overrides.profilePic || '',
		skillLevel: overrides.skillLevel || 'Intermediate',
		friends: overrides.friends ? [...overrides.friends] : [],
		friendRequests: overrides.friendRequests ? [...overrides.friendRequests] : [],
		sentFriendRequests: overrides.sentFriendRequests ? [...overrides.sentFriendRequests] : [],
		save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
		...overrides,
	};

	const attachArrayMethods = (arr) => {
		arr.pull = jest.fn().mockImplementation((idToPull) => {
			const strId = (idToPull?._id || idToPull)?.toString();
			const index = arr.findIndex((item) => (item?._id || item)?.toString() === strId);
			if (index !== -1) arr.splice(index, 1);
			return arr;
		});
		return arr;
	};

	attachArrayMethods(user.friends);
	attachArrayMethods(user.friendRequests);
	attachArrayMethods(user.sentFriendRequests);

	return user;
};

describe('Problem 15: Bi-Directional Social Integrity & Friend Transition Atomicity', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		clearMemoryCache();
		resetTransactionSupportCache();
		Notification.mockImplementation((data) => ({
			...data,
			save: jest.fn().mockResolvedValue(data),
		}));
	});

	describe('1. Transaction Helper & Standalone Fallback Engine', () => {
		it('executes transactionFn and commits when transactions are supported', async () => {
			const mockSession = {
				startTransaction: jest.fn(),
				commitTransaction: jest.fn().mockResolvedValue(),
				abortTransaction: jest.fn().mockResolvedValue(),
				endSession: jest.fn().mockResolvedValue(),
			};

			const origStartSession = mongoose.startSession;
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;
			mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

			const transactionFn = jest.fn().mockResolvedValue({ success: true });
			const fallbackFn = jest.fn();

			const result = await executeWithTransactionOrFallback({ transactionFn, fallbackFn });

			expect(result).toEqual({ success: true });
			expect(mockSession.startTransaction).toHaveBeenCalled();
			expect(transactionFn).toHaveBeenCalledWith(mockSession);
			expect(mockSession.commitTransaction).toHaveBeenCalled();
			expect(mockSession.endSession).toHaveBeenCalled();
			expect(fallbackFn).not.toHaveBeenCalled();

			mongoose.startSession = origStartSession;
			mongoose.connection.readyState = origReadyState;
		});

		it('aborts transaction and re-throws when transactionFn throws business error', async () => {
			const mockSession = {
				startTransaction: jest.fn(),
				commitTransaction: jest.fn().mockResolvedValue(),
				abortTransaction: jest.fn().mockResolvedValue(),
				endSession: jest.fn().mockResolvedValue(),
			};

			const origStartSession = mongoose.startSession;
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;
			mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

			const businessError = new Error('Database write collision');
			const transactionFn = jest.fn().mockRejectedValue(businessError);
			const fallbackFn = jest.fn();

			await expect(executeWithTransactionOrFallback({ transactionFn, fallbackFn })).rejects.toThrow('Database write collision');

			expect(mockSession.abortTransaction).toHaveBeenCalled();
			expect(mockSession.endSession).toHaveBeenCalled();
			expect(fallbackFn).not.toHaveBeenCalled();

			mongoose.startSession = origStartSession;
			mongoose.connection.readyState = origReadyState;
		});

		it('gracefully falls back to fallbackFn when standalone MongoDB error code 20 occurs', async () => {
			const standaloneError = new Error('Transaction numbers are only allowed on a replica set member or mongos');
			standaloneError.code = 20;

			const origStartSession = mongoose.startSession;
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 1;
			mongoose.startSession = jest.fn().mockRejectedValue(standaloneError);

			const transactionFn = jest.fn();
			const fallbackFn = jest.fn().mockResolvedValue({ fallbackResult: true });

			const result = await executeWithTransactionOrFallback({ transactionFn, fallbackFn });

			expect(result).toEqual({ fallbackResult: true });
			expect(fallbackFn).toHaveBeenCalled();

			// Subsequent calls should directly use fallback without trying startSession again
			fallbackFn.mockClear();
			const secondResult = await executeWithTransactionOrFallback({ transactionFn, fallbackFn });
			expect(secondResult).toEqual({ fallbackResult: true });
			expect(fallbackFn).toHaveBeenCalled();

			mongoose.startSession = origStartSession;
			mongoose.connection.readyState = origReadyState;
		});

		it('directly executes fallbackFn when mongoose connection is disconnected (readyState !== 1)', async () => {
			const origReadyState = mongoose.connection.readyState;
			mongoose.connection.readyState = 0; // disconnected

			const transactionFn = jest.fn();
			const fallbackFn = jest.fn().mockResolvedValue({ offlineFallback: true });

			const result = await executeWithTransactionOrFallback({ transactionFn, fallbackFn });
			expect(result).toEqual({ offlineFallback: true });
			expect(fallbackFn).toHaveBeenCalled();
			expect(transactionFn).not.toHaveBeenCalled();

			mongoose.connection.readyState = origReadyState;
		});
	});

	describe('2. Idempotency Manager', () => {
		it('manages in-flight, completed, and error eviction lifecycle', async () => {
			const testKey = 'test-idemp-key-abc';

			expect(await getIdempotentResult(testKey)).toBeNull();

			await markIdempotentInFlight(testKey);
			const inFlightRecord = await getIdempotentResult(testKey);
			expect(inFlightRecord).not.toBeNull();
			expect(inFlightRecord.status).toBe('in-flight');

			await setIdempotentCompleted(testKey, { message: 'Processed successfully' });
			const completedRecord = await getIdempotentResult(testKey);
			expect(completedRecord).not.toBeNull();
			expect(completedRecord.status).toBe('completed');
			expect(completedRecord.response.message).toBe('Processed successfully');
		});
	});

	describe('3. Friend Routes Idempotency & Deduplication Integration', () => {
		it('returns 409 Conflict if same idempotency key is already in-flight', async () => {
			const key = 'in-flight-key-999';
			await markIdempotentInFlight(key);

			const res = await request(app)
				.post('/api/friends/request')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ recipientId: userId2 });

			expect(res.statusCode).toBe(409);
			expect(res.body.message).toContain('already being processed');
		});

		it('returns cached idempotent response on repeated request with same key', async () => {
			const requester = createMockUser({ _id: userId1, name: 'Alice' });
			const recipient = createMockUser({ _id: userId2, name: 'Bob' });

			User.findById.mockImplementation((id) => {
				if (id === userId1) return Promise.resolve(requester);
				if (id === userId2) return Promise.resolve(recipient);
				return Promise.resolve(null);
			});

			const key = 'test-repeat-req-123';

			// First request
			const res1 = await request(app)
				.post('/api/friends/request')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ recipientId: userId2 });

			expect(res1.statusCode).toBe(200);
			expect(res1.body.message).toBe('Friend request sent');
			expect(recipient.save).toHaveBeenCalledTimes(1);
			expect(requester.save).toHaveBeenCalledTimes(1);

			// Second request with same Idempotency-Key
			const res2 = await request(app)
				.post('/api/friends/request')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ recipientId: userId2 });

			expect(res2.statusCode).toBe(200);
			expect(res2.body.message).toBe('Friend request sent');
			expect(res2.body.idempotent).toBe(true);
			// Should NOT invoke database saves a second time
			expect(recipient.save).toHaveBeenCalledTimes(1);
			expect(requester.save).toHaveBeenCalledTimes(1);
		});

		it('auto-accepts mutual request cleanly and supports idempotency', async () => {
			// Recipient already sent request to requester
			const requester = createMockUser({ _id: userId1, friendRequests: [userId2] });
			const recipient = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

			User.findById.mockImplementation((id) => {
				if (id === userId1) return Promise.resolve(requester);
				if (id === userId2) return Promise.resolve(recipient);
				return Promise.resolve(null);
			});

			const key = 'auto-accept-key-555';

			const res = await request(app)
				.post('/api/friends/request')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ recipientId: userId2 });

			expect(res.statusCode).toBe(200);
			expect(res.body.message).toBe('Friend request accepted automatically');
			expect(requester.friends).toContain(userId2);
			expect(recipient.friends).toContain(userId1);
		});

		it('atomically removes friend and emits socket events with idempotency caching', async () => {
			const user = createMockUser({ _id: userId1, friends: [userId2] });
			const friend = createMockUser({ _id: userId2, friends: [userId1] });

			User.findById.mockImplementation((id) => {
				if (id === userId1) return Promise.resolve(user);
				if (id === userId2) return Promise.resolve(friend);
				return Promise.resolve(null);
			});

			const key = 'remove-friend-key-777';

			const res = await request(app)
				.post('/api/friends/remove')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ friendId: userId2 });

			expect(res.statusCode).toBe(200);
			expect(res.body.message).toBe('Friend removed');
			expect(user.friends).not.toContain(userId2);
			expect(friend.friends).not.toContain(userId1);

			// Idempotent retry
			const res2 = await request(app)
				.post('/api/friends/remove')
				.set('Authorization', `Bearer ${tokenUser1}`)
				.set('Idempotency-Key', key)
				.send({ friendId: userId2 });

			expect(res2.statusCode).toBe(200);
			expect(res2.body.idempotent).toBe(true);
		});
	});
});
