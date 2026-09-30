const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const matchmakingRoutes = require('../routes/matchmaking');
const User = require('../models/User');

jest.mock('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const testToken = jwt.sign({ userId: 'current_user_123' }, JWT_SECRET);

const app = express();
app.use(express.json());
app.use('/api/matchmaking', matchmakingRoutes);

describe('Matchmaking Backend Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/matchmaking/presence', () => {
        it('requires authentication', async () => {
            const res = await request(app).get('/api/matchmaking/presence');
            expect(res.statusCode).toBe(401);
        });

        it('returns active users from the last 5 minutes', async () => {
            const mockOnlineUsers = [
                { _id: 'u1', name: 'Alice' },
                { _id: 'u2', name: 'Bob' }
            ];
            User.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockOnlineUsers)
                })
            });

            const res = await request(app)
                .get('/api/matchmaking/presence')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ onlineUsers: mockOnlineUsers });
            expect(User.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    lastActive: expect.any(Object)
                })
            );
        });
    });

    describe('POST /api/matchmaking/queue/join', () => {
        it('joins matchmaking queue with location and time', async () => {
            User.findByIdAndUpdate.mockResolvedValue({});

            const res = await request(app)
                .post('/api/matchmaking/queue/join')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    checkInLocation: 'RAC',
                    preferredTimeOfDay: 'Evening'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Joined queue successfully');
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                'current_user_123',
                expect.objectContaining({
                    inQueue: true,
                    checkInLocation: 'RAC',
                    preferredTimeOfDay: 'Evening'
                })
            );
        });
    });

    describe('POST /api/matchmaking/queue/leave', () => {
        it('leaves matchmaking queue', async () => {
            User.findByIdAndUpdate.mockResolvedValue({});

            const res = await request(app)
                .post('/api/matchmaking/queue/leave')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Left queue successfully');
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                'current_user_123',
                { inQueue: false }
            );
        });
    });

    describe('GET /api/matchmaking/discover', () => {
        it('returns potential matches and recommendations based on user university', async () => {
            const mockCurrentUser = {
                _id: 'current_user_123',
                homeUniversity: 'George Mason University'
            };
            const mockMatches = [
                { _id: 'u2', name: 'Bob', skillLevel: 'Intermediate', homeUniversity: 'George Mason University' }
            ];
            const mockRecommended = [
                { _id: 'u3', name: 'Charlie', homeUniversity: 'George Mason University' }
            ];

            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockCurrentUser)
            });

            User.find
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockMatches)
                            })
                        })
                    })
                })
                .mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(mockRecommended)
                        })
                    })
                });

            const res = await request(app)
                .get('/api/matchmaking/discover?skill=Intermediate&campus=RAC&time=Evening')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                matches: mockMatches,
                recommended: mockRecommended
            });
        });

        it('supports cursor pagination and search filter', async () => {
            User.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null)
            });

            User.find.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            });

            const res = await request(app)
                .get('/api/matchmaking/discover?search=Alex&cursor=660000000000000000000010')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(User.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: expect.objectContaining({
                        $ne: 'current_user_123',
                        $lt: '660000000000000000000010'
                    }),
                    $or: expect.any(Array)
                })
            );
        });
    });

    describe('GET /api/matchmaking/generate-bracket', () => {
        it('generates a 16-player knockout tournament bracket', async () => {
            const mockUsers = Array.from({ length: 16 }, (_, i) => ({
                name: `Player ${i + 1}`
            }));

            User.aggregate.mockResolvedValue(mockUsers);

            const res = await request(app)
                .get('/api/matchmaking/generate-bracket')
                .set('Authorization', `Bearer ${testToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('nextMatches');
            expect(res.body.nextMatches.length).toBe(2);
        });
    });
});
