const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../models/Court');
jest.mock('../models/User');
jest.mock('../models/TournamentMatch');

const courtRoutes = require('../routes/courts');

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const memberToken = jwt.sign({ userId: 'member-1', id: 'member-1', role: 'user' }, JWT_SECRET);

describe('Court management routes require authentication', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/courts', courtRoutes);
    });

    it.each([
        '/api/courts/1/assign',
        '/api/courts/1/score/point',
        '/api/courts/1/score/undo',
        '/api/courts/1/status',
        '/api/courts/1/queue',
        '/api/courts/1/walkover/start',
        '/api/courts/1/walkover/cancel',
        '/api/courts/1/walkover/forfeit',
        '/api/courts/initialize',
        '/api/courts/rebalance-queues',
    ])('rejects anonymous POST %s with 401', async (path) => {
        const res = await request(app).post(path).send({ scoringTeam: 'team1' });
        expect(res.status).toBe(401);
    });

    it.each(['/api/courts/initialize', '/api/courts/rebalance-queues'])(
        'rejects non-admin POST %s with 403',
        async (path) => {
            const res = await request(app).post(path).set('Authorization', `Bearer ${memberToken}`);
            expect(res.status).toBe(403);
        }
    );
});
