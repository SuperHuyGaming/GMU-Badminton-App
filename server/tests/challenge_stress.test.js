const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const friendsRoutes = require('../routes/friends');
const matchmakingRoutes = require('../routes/matchmaking');
const User = require('../models/User');
const Notification = require('../models/Notification');

jest.mock('../models/User');
jest.mock('../models/Notification');

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const userId1 = '660000000000000000000001';
const userId2 = '660000000000000000000002';
const userId3 = '660000000000000000000003';
const tokenUser1 = jwt.sign({ userId: userId1 }, JWT_SECRET);
const tokenUser2 = jwt.sign({ userId: userId2 }, JWT_SECRET);

const app = express();
app.use(express.json());

const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
};
app.set('io', mockIo);

app.use('/api/friends', friendsRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

const createMockUser = (overrides = {}) => {
    const user = {
        _id: overrides._id || userId1,
        name: overrides.name || 'Test User',
        email: overrides.email || 'test@gmu.edu',
        profilePic: overrides.profilePic || '',
        skillLevel: overrides.skillLevel || 'Intermediate',
        friends: overrides.friends ? [...overrides.friends] : [],
        friendRequests: overrides.friendRequests ? [...overrides.friendRequests] : [],
        sentFriendRequests: overrides.sentFriendRequests ? [...overrides.sentFriendRequests] : [],
        homeUniversity: overrides.homeUniversity || 'George Mason University',
        save: jest.fn().mockImplementation(function () { return Promise.resolve(this); }),
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

describe('CHALLENGER 1: Empirical Concurrency & Edge Stress Suite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Notification.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(data),
        }));
    });

    describe('1. Unauthorized & Invalid /accept Calls', () => {
        it('CHALLENGE 1.1: Rejects /accept when user has NO pending request from requester', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [] });
            const user2 = createMockUser({ _id: userId2 });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No pending friend request from this user');
            expect(user1.save).not.toHaveBeenCalled();
            expect(user2.save).not.toHaveBeenCalled();
            expect(mockIo.emit).not.toHaveBeenCalled();
        });

        it('CHALLENGE 1.2: Rejects /accept when a request exists from user3, but user2 is passed', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [userId3] });
            const user2 = createMockUser({ _id: userId2 });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No pending friend request from this user');
            expect(user1.friends).toHaveLength(0);
        });

        it('CHALLENGE 1.3: Rejects /accept if target user ID is non-existent in database', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [userId2] });
            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('User not found');
        });

        it('CHALLENGE 1.4: Rejects /accept with malformed or non-ObjectId requesterId', async () => {
            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: 'not-valid-id' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Valid requester ID is required');
        });
    });

    describe('2. Self-Addition & Self-Interaction Stress', () => {
        it('CHALLENGE 2.1: Rejects self-addition via /request (recipientId === requesterId)', async () => {
            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId1 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Cannot add yourself');
            expect(User.findById).not.toHaveBeenCalled();
        });

        it('CHALLENGE 2.2: Rejects self-addition via /request aliases (friendId or targetId)', async () => {
            const res1 = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ friendId: userId1 });
            expect(res1.statusCode).toBe(400);
            expect(res1.body.message).toBe('Cannot add yourself');

            const res2 = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ targetId: userId1 });
            expect(res2.statusCode).toBe(400);
            expect(res2.body.message).toBe('Cannot add yourself');
        });

        it('CHALLENGE 2.3: Rejects self-accept if user tries to accept themselves without pending request', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [] });
            User.findById.mockResolvedValue(user1);

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId1 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No pending friend request from this user');
        });
    });

    describe('3. Concurrency, Duplicate Prevention & Array Integrity', () => {
        it('CHALLENGE 3.1: Sequential duplicate /request is rejected with 400 and arrays not duplicated', async () => {
            const user1 = createMockUser({ _id: userId1, sentFriendRequests: [] });
            const user2 = createMockUser({ _id: userId2, friendRequests: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Request already sent');
            expect(user2.friendRequests.filter(id => id.toString() === userId1)).toHaveLength(1);
        });

        it('CHALLENGE 3.2: Rejects /request if already friends with 400', async () => {
            const user1 = createMockUser({ _id: userId1 });
            const user2 = createMockUser({ _id: userId2, friends: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('Already friends');
        });

        // Robustness: Friends array containing null/unpopulated references
        it('CHALLENGE 3.6: Robustness when friends array contains null/unpopulated references (succeeds with 200)', async () => {
            const user1 = createMockUser({ _id: userId1, friends: [null] });
            const user2 = createMockUser({ _id: userId2, friends: [null] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(200);
        });

        it('CHALLENGE 3.3: Double /accept attempt fails on second call and does not duplicate friend list', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [userId2], friends: [] });
            const user2 = createMockUser({ _id: userId2, sentFriendRequests: [userId1], friends: [] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            // First accept
            const res1 = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });
            expect(res1.statusCode).toBe(200);
            expect(user1.friends).toContain(userId2);
            expect(user1.friendRequests).not.toContain(userId2);

            // Second accept attempt immediately after
            const res2 = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });
            expect(res2.statusCode).toBe(400);
            expect(res2.body.message).toBe('No pending friend request from this user');
            expect(user1.friends.filter(id => id.toString() === userId2)).toHaveLength(1);
        });

        it('CHALLENGE 3.4: Auto-accept mutual request cleans up friendRequests and does not duplicate friends', async () => {
            // User 2 already sent request to User 1
            const user1 = createMockUser({ _id: userId1, friendRequests: [userId2], sentFriendRequests: [] });
            const user2 = createMockUser({ _id: userId2, friendRequests: [], sentFriendRequests: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            // User 1 sends request to User 2 -> should auto-accept
            const res = await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request accepted automatically');
            expect(user1.friends).toContain(userId2);
            expect(user2.friends).toContain(userId1);
            expect(user1.friendRequests).toHaveLength(0);
            expect(user2.sentFriendRequests).toHaveLength(0);
        });

        it('CHALLENGE 3.5: Prevents duplicate IDs in requester.sentFriendRequests if already present', async () => {
            const user1 = createMockUser({ _id: userId1, sentFriendRequests: [userId2] });
            const user2 = createMockUser({ _id: userId2, friendRequests: [] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            await request(app)
                .post('/api/friends/request')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ recipientId: userId2 });

            // Count occurrences of userId2 in user1.sentFriendRequests
            const occurrences = user1.sentFriendRequests.filter(id => (id._id || id).toString() === userId2);
            expect(occurrences).toHaveLength(1);
        });

        it('CHALLENGE 3.7: Bidirectional pending requests clean up cleanly on /accept without leaving ghost requests', async () => {
            // Both users ended up with requests to each other (e.g. from concurrent requests)
            const user1 = createMockUser({
                _id: userId1,
                friendRequests: [userId2],
                sentFriendRequests: [userId2],
                friends: [],
            });
            const user2 = createMockUser({
                _id: userId2,
                friendRequests: [userId1],
                sentFriendRequests: [userId1],
                friends: [],
            });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(user1.friends).toContain(userId2);
            expect(user2.friends).toContain(userId1);
            // Verify all request queues are cleared between these two users
            expect(user1.friendRequests).not.toContain(userId2);
            expect(user2.sentFriendRequests).not.toContain(userId1);
            expect(user1.sentFriendRequests).not.toContain(userId2);
            expect(user2.friendRequests).not.toContain(userId1);
        });
    });

    describe('4. Discovery Query Exclusion Stress', () => {
        it('CHALLENGE 4.1: Strictly excludes self, all friends, all incoming requests, and all outgoing requests', async () => {
            const friendA = '66000000000000000000000a';
            const incomingReqB = '66000000000000000000000b';
            const outgoingReqC = '66000000000000000000000c';

            const mockCurrentUser = {
                _id: userId1,
                friends: [friendA],
                friendRequests: [incomingReqB],
                sentFriendRequests: [outgoingReqC],
                homeUniversity: 'George Mason University',
            };

            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockCurrentUser),
            });

            let capturedQuery = null;
            User.find.mockImplementation((query) => {
                capturedQuery = query;
                return {
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                };
            });

            const res = await request(app)
                .get('/api/matchmaking/discover')
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(200);
            expect(capturedQuery._id.$nin).toContain(userId1);
            expect(capturedQuery._id.$nin).toContain(friendA);
            expect(capturedQuery._id.$nin).toContain(incomingReqB);
            expect(capturedQuery._id.$nin).toContain(outgoingReqC);
            expect(capturedQuery._id.$nin).toHaveLength(4);
        });

        it('CHALLENGE 4.2: Handles populated friend objects with {_id: ...} in exclusion list', async () => {
            const mockCurrentUser = {
                _id: userId1,
                friends: [{ _id: '660000000000000000000010', name: 'Populated Friend' }],
                friendRequests: [{ _id: '660000000000000000000011' }],
                sentFriendRequests: [{ _id: '660000000000000000000012' }],
            };

            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockCurrentUser),
            });

            let capturedQuery = null;
            User.find.mockImplementation((query) => {
                capturedQuery = query;
                return {
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                };
            });

            const res = await request(app)
                .get('/api/matchmaking/discover')
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(200);
            expect(capturedQuery._id.$nin).toContain('660000000000000000000010');
            expect(capturedQuery._id.$nin).toContain('660000000000000000000011');
            expect(capturedQuery._id.$nin).toContain('660000000000000000000012');
        });

        // Robustness: Discover handles null/undefined elements in friend arrays
        it('CHALLENGE 4.3: Robustness against null/undefined elements in friend arrays (succeeds with 200)', async () => {
            const mockCurrentUser = {
                _id: userId1,
                friends: [null, undefined, '660000000000000000000099'],
                friendRequests: [null],
                sentFriendRequests: [],
            };

            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockCurrentUser),
            });

            User.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const res = await request(app)
                .get('/api/matchmaking/discover')
                .set('Authorization', `Bearer ${tokenUser1}`);

            // Let's verify what happens: does it crash with 500 or succeed?
            // This test empirically verifies whether nulls cause an unhandled exception / 500 error!
            expect(res.statusCode).toBe(200);
        });

        it('CHALLENGE 4.4: Recommended matches also strictly filter out excluded IDs and hydrate friendshipStatus', async () => {
            const mockCurrentUser = {
                _id: userId1,
                friends: ['660000000000000000000020'],
                homeUniversity: 'George Mason University',
            };

            const mockMatches = [{ _id: '660000000000000000000030', name: 'Player 30' }];
            const mockRecommended = [{ _id: '660000000000000000000040', name: 'Player 40' }];

            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockCurrentUser),
            });

            User.find
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockMatches),
                            }),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(mockRecommended),
                        }),
                    }),
                });

            const res = await request(app)
                .get('/api/matchmaking/discover')
                .set('Authorization', `Bearer ${tokenUser1}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.matches[0].friendshipStatus).toBe('none');
            expect(res.body.recommended[0].friendshipStatus).toBe('none');
        });
    });

    describe('5. Decline/Reject Behavior & Socket Event Emissions', () => {
        it('CHALLENGE 5.1: /decline removes pending request from both sides and emits friendRequestDeclined', async () => {
            const user1 = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const user2 = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/decline')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request declined');
            expect(user1.friendRequests.pull).toHaveBeenCalledWith(userId2);
            expect(user2.sentFriendRequests.pull).toHaveBeenCalledWith(userId1);
            expect(user1.friends).toHaveLength(0);
            expect(user2.friends).toHaveLength(0);

            expect(mockIo.to).toHaveBeenCalledWith(userId2);
            expect(mockIo.to).toHaveBeenCalledWith(userId1);
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestDeclined', { userId: userId1 });
            expect(mockIo.emit).toHaveBeenCalledWith('friendRequestDeclined', { userId: userId2 });
        });

        it('CHALLENGE 5.2: /reject (alias) behaves identically to /decline when cancelling sent request', async () => {
            // User 1 cancels request they sent to User 2
            const user1 = createMockUser({ _id: userId1, sentFriendRequests: [userId2] });
            const user2 = createMockUser({ _id: userId2, friendRequests: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(app)
                .post('/api/friends/reject')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ targetId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request declined');
            expect(user1.sentFriendRequests.pull).toHaveBeenCalledWith(userId2);
            expect(user2.friendRequests.pull).toHaveBeenCalledWith(userId1);
        });

        it('CHALLENGE 5.3: Gracefully succeeds even if Socket.io is not attached to app', async () => {
            const noSocketApp = express();
            noSocketApp.use(express.json());
            noSocketApp.use('/api/friends', friendsRoutes);

            const user1 = createMockUser({ _id: userId1, friendRequests: [userId2] });
            const user2 = createMockUser({ _id: userId2, sentFriendRequests: [userId1] });

            User.findById.mockImplementation((id) => {
                if (id === userId1) return Promise.resolve(user1);
                if (id === userId2) return Promise.resolve(user2);
                return Promise.resolve(null);
            });

            const res = await request(noSocketApp)
                .post('/api/friends/accept')
                .set('Authorization', `Bearer ${tokenUser1}`)
                .send({ requesterId: userId2 });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Friend request accepted');
        });
    });
});
