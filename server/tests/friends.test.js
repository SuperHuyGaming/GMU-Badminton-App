const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const friendsRoutes = require('../routes/friends');
const User = require('../models/User');
const Notification = require('../models/Notification');

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

describe('Friends Backend Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Notification.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(data),
        }));
    });

    describe('GET /api/friends/:userId', () => {
        it('requires authentication', async () => {
            const res = await request(app).get(`/api/friends/${userId1}`);
            expect(res.statusCode).toBe(401);
        });

        it('returns 400 for invalid user ID format', async () => {
            const res = await request(app)
                .get('/api/friends/invalid_id')
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Invalid user ID format');
        });

        it('returns 403 if trying to view another user friend requests', async () => {
            const res = await request(app)
                .get(`/api/friends/${userId2}`)
                .set('Authorization', `Bearer ${tokenUser1}`);
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('Unauthorized');
        });

        it('returns 404 if user does not exist', async () => {
            User.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(null),
                    }),
                }),
            });

            const res = await request(app)
                .get(`/api/friends/${userId1}`)
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(404);
        });

        it('returns friends, friendRequests, and sentFriendRequests for owner', async () => {
            const mockUser = {
                friends: [{ _id: userId2, name: 'User Two' }],
                friendRequests: [],
                sentFriendRequests: [],
            };

            User.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            const res = await request(app)
                .get(`/api/friends/${userId1}`)
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockUser);
        });
    });

    describe('POST /api/friends/request', () => {
        it('requires authentication', async () => {
            const res = await request(app).post('/api/friends/request').send({ recipientId: userId2 });
            expect(res.statusCode).toBe(401);
        });

        it('returns 400 if recipientId is missing or invalid', async () => {
            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: 'not-valid' });
            expect(res.statusCode).toBe(400);
        });

        it('returns 400 if attempting to add oneself', async () => {
            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId1 });
            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Cannot add yourself');
        });

        it('returns 404 if user not found', async () => {
            User.findById.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 if already friends', async () => {
            const requester = createMockUser({ _id: userId1 });
            const recipient = createMockUser({ _id: userId2, friends: [userId1] });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Already friends');
        });

        it('returns 400 if request already sent', async () => {
            const requester = createMockUser({ _id: userId1 });
            const recipient = createMockUser({ _id: userId2, friendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Request already sent');
        });

        it('auto-accepts if the other user already sent a pending request', async () => {
            const requester = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const recipient = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request accepted automatically');
            expect(requester.friends).toContain(userId2);
            expect(recipient.friends).toContain(userId1);
            expect(requester.save).toHaveBeenCalled();
            expect(recipient.save).toHaveBeenCalled();
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestAccepted', expect.objectContaining({ userId: userId1 }));
        });

        it('successfully sends friend request, saves notification, and emits socket events', async () => {
            const requester = createMockUser({ _id: userId1, name: 'Alice' });
            const recipient = createMockUser({ _id: userId2, name: 'Bob' });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request sent');
            expect(recipient.friendRequests).toContain(userId1);
            expect(requester.sentFriendRequests).toContain(userId2);
            expect(requester.save).toHaveBeenCalled();
            expect(recipient.save).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith(userId2);
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestReceived', expect.objectContaining({ requesterId: userId1 }));
        });

        it('supports friendId parameter as alternative to recipientId', async () => {
            const requester = createMockUser({ _id: userId1 });
            const recipient = createMockUser({ _id: userId2 });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ friendId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request sent');
        });
    });

    describe('POST /api/friends/accept', () => {
        it('requires authentication', async () => {
            const res = await request(app).post('/api/friends/accept').send({ requesterId: userId2 });
            expect(res.statusCode).toBe(401);
        });

        it('returns 400 if requesterId is missing or invalid', async () => {
            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: 'invalid' });
            expect(res.statusCode).toBe(400);
        });

        it('returns 404 if user or requester not found', async () => {
            User.findById.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 if no pending request from the specified user', async () => {
            const user = createMockUser({ _id: userId1, friendRequests: [] });
            const requester = createMockUser({ _id: userId2 });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(requester);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No pending friend request from this user');
            expect(user.save).not.toHaveBeenCalled();
        });

        it('successfully accepts pending friend request and emits socket events', async () => {
            const user = createMockUser({ _id: userId1, name: 'Alice', friendRequests: [userId2] });
            const requester = createMockUser({ _id: userId2, name: 'Bob', sentFriendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(requester);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request accepted');
            expect(user.friendRequests.pull).toHaveBeenCalledWith(userId2);
            expect(requester.sentFriendRequests.pull).toHaveBeenCalledWith(userId1);
            expect(user.friends).toContain(userId2);
            expect(requester.friends).toContain(userId1);
            expect(user.save).toHaveBeenCalled();
            expect(requester.save).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith(userId2);
            expect(mockIo.to).toHaveBeenCalledWith(userId1);
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestAccepted', expect.objectContaining({ userId: userId1 }));
        });

        it('supports friendId parameter as alternative to requesterId', async () => {
            const user = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const requester = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(requester);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ friendId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request accepted');
        });
    });

    describe('POST /api/friends/decline and /api/friends/reject', () => {
        it('returns 400 if target ID is invalid', async () => {
            const res = await request(app)
                .post('/api/friends/decline')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ targetId: 'bad_id' });
            expect(res.statusCode).toBe(400);
        });

        it('successfully declines friend request and emits friendRequestDeclined', async () => {
            const user = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const target = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(target);

            const res = await request(app)
                .post('/api/friends/decline')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ targetId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request declined');
            expect(user.friendRequests.pull).toHaveBeenCalledWith(userId2);
            expect(target.sentFriendRequests.pull).toHaveBeenCalledWith(userId1);
            expect(user.friends).not.toContain(userId2);
            expect(user.save).toHaveBeenCalled();
            expect(target.save).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith(userId2);
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestDeclined', { userId: userId1 });
        });

        it('reject alias works identically to decline', async () => {
            const user = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const target = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(target);

            const res = await request(app)
                .post('/api/friends/reject')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request declined');
            expect(user.save).toHaveBeenCalled();
            expect(target.save).toHaveBeenCalled();
        });
    });

    describe('POST /api/friends/remove', () => {
        it('removes mutual friendship and emits friendRemoved', async () => {
            const user = createMockUser({ _id: userId1, friends: [userId2] });
            const friend = createMockUser({ _id: userId2, friends: [userId1] });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(friend);

            const res = await request(app)
                .post('/api/friends/remove')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ friendId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend removed');
            expect(user.friends.pull).toHaveBeenCalledWith(userId2);
            expect(friend.friends.pull).toHaveBeenCalledWith(userId1);
            expect(user.save).toHaveBeenCalled();
            expect(friend.save).toHaveBeenCalled();
            expect(mockIo.to).toHaveBeenCalledWith(userId1);
            expect(mockIo.to).toHaveBeenCalledWith(userId2);
            expect(mockIo.emit).toHaveBeenCalledWith('friendRemoved', { friendId: userId2 });
        });
    });

    describe('Defensive Edge Cases & Remediation', () => {
        it('GET /:userId filters out null entries in friends array', async () => {
            const mockUser = {
                friends: [null, { _id: userId2, name: 'Valid Friend' }],
                friendRequests: [null],
                sentFriendRequests: [],
            };

            User.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockUser),
                    }),
                }),
            });

            const res = await request(app)
                .get(`/api/friends/${userId1}`)
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.friends).toHaveLength(1);
            expect(res.body.friends[0]._id).toBe(userId2);
            expect(res.body.friendRequests).toHaveLength(0);
        });

        it('POST /request prevents duplicate sentFriendRequests when ID already present', async () => {
            const requester = createMockUser({ _id: userId1, sentFriendRequests: [userId2] });
            const recipient = createMockUser({ _id: userId2, friendRequests: [] });

            User.findById
                .mockResolvedValueOnce(requester)
                .mockResolvedValueOnce(recipient);

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Request already sent');
            expect(requester.sentFriendRequests.filter(id => id.toString() === userId2)).toHaveLength(1);
        });

        it('POST /accept clears bidirectional request queues', async () => {
            const user = createMockUser({
                _id: userId1,
                friendRequests: [userId2],
                sentFriendRequests: [userId2],
                friends: [],
            });
            const requester = createMockUser({
                _id: userId2,
                friendRequests: [userId1],
                sentFriendRequests: [userId1],
                friends: [],
            });

            User.findById
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(requester);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(user.friends).toContain(userId2);
            expect(requester.friends).toContain(userId1);
            expect(user.friendRequests).not.toContain(userId2);
            expect(user.sentFriendRequests).not.toContain(userId2);
            expect(requester.friendRequests).not.toContain(userId1);
            expect(requester.sentFriendRequests).not.toContain(userId1);
        });

        it('POST /decline rejects self-decline with 400', async () => {
            const res = await request(app)
                .post('/api/friends/decline')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ targetId: userId1 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Cannot decline yourself');
        });
    });
});
