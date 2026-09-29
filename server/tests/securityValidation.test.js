const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

const userToken = jwt.sign(
    { id: "650000000000000000000001", userId: "650000000000000000000001", role: "user", name: "Regular Player" },
    JWT_SECRET
);
const otherUserToken = jwt.sign(
    { id: "650000000000000000000002", userId: "650000000000000000000002", role: "user", name: "Other Player" },
    JWT_SECRET
);
const adminToken = jwt.sign(
    { id: "650000000000000000000099", userId: "650000000000000000000099", role: "admin", name: "Club Admin" },
    JWT_SECRET
);

jest.mock('natural', () => ({
    BayesClassifier: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        train: jest.fn(),
        classify: jest.fn().mockReturnValue('ham')
    }))
}));
jest.mock('../utils/aiModeration', () => ({
    analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, reason: "", score: 0 })
}));

// Mocks
jest.mock('../models/Announcement');
jest.mock('../models/Message');
jest.mock('../models/Post');
jest.mock('../models/User');
jest.mock('../models/Match');
jest.mock('../models/CoachChat');

const Announcement = require('../models/Announcement');
const Message = require('../models/Message');
const Post = require('../models/Post');
const User = require('../models/User');
const Match = require('../models/Match');

const announcementRoutes = require('../routes/announcements');
const messageRoutes = require('../routes/messages');
const forumRoutes = require('../routes/forum');
const matchesRoutes = require('../routes/matches');
const scrapeRoutes = require('../routes/scrape');
const { router: profileRoutes } = require('../routes/profile');

const app = express();
app.use(express.json());
app.set('io', { emit: jest.fn(), to: () => ({ emit: jest.fn() }) });
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/profile', profileRoutes);

describe('Backend Security & Validation Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Announcements Authorization & Privilege Escalation', () => {
        it('should reject announcement creation without token', async () => {
            const res = await request(app)
                .post('/api/announcements')
                .send({ content: 'Test Announcement', role: 'admin' });

            expect(res.statusCode).toBe(401);
        });

        it('should reject announcement creation with non-admin token even if body has role admin', async () => {
            const res = await request(app)
                .post('/api/announcements')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ content: 'Malicious announcement', role: 'admin' });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('Admins only');
        });

        it('should reject announcement deletion with non-admin token even with ?role=admin', async () => {
            const res = await request(app)
                .delete('/api/announcements/650000000000000000000010?role=admin')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Messages IDOR & Sender Spoofing Prevention', () => {
        it('should reject fetching recent messages of another user', async () => {
            const res = await request(app)
                .get('/api/messages/recent/650000000000000000000002')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('Unauthorized');
        });

        it('should reject fetching conversation between two other users', async () => {
            const res = await request(app)
                .get('/api/messages/650000000000000000000002/650000000000000000000003')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should reject sending a message to oneself', async () => {
            const res = await request(app)
                .post('/api/messages')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    receiverId: '650000000000000000000001',
                    content: 'Hello self'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Cannot send message to yourself');
        });
    });

    describe('Forum Stored XSS Prevention in /share/:postId', () => {
        it('should HTML entity encode malicious payloads in share preview', async () => {
            Post.findById = jest.fn().mockResolvedValue({
                _id: new mongoose.Types.ObjectId('650000000000000000000055'),
                authorName: '<script>alert("xss")</script>',
                content: '<img src=x onerror=alert(1)>',
                imageUrls: ['https://example.com/pic.jpg']
            });

            const res = await request(app)
                .get('/api/forum/share/650000000000000000000055');

            expect(res.statusCode).toBe(200);
            expect(res.text).not.toContain('<script>alert("xss")</script>');
            expect(res.text).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            expect(res.text).not.toContain('<img src=x onerror=alert(1)>');
            expect(res.text).toContain('&lt;img src=x onerror=alert(1)&gt;');
        });

        it('should return 404 for invalid post ID format', async () => {
            const res = await request(app).get('/api/forum/share/invalid-id');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('Profile Route Privacy & IDOR', () => {
        it('should exclude email and password from public profile', async () => {
            const mockSelect = jest.fn().mockResolvedValue({
                _id: '650000000000000000000002',
                name: 'Other Player',
                skillLevel: 'B Level'
            });
            User.findById = jest.fn().mockReturnValue({ select: mockSelect });

            const res = await request(app)
                .get('/api/profile/650000000000000000000002')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(200);
            expect(mockSelect).toHaveBeenCalledWith('-password -email -pushSubscriptions');
        });
    });

    describe('Match Validation & Participant Authorization', () => {
        it('should reject match where submitter is not a participant', async () => {
            const res = await request(app)
                .post('/api/matches')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    type: 'singles',
                    team1: ['650000000000000000000003'],
                    team2: ['650000000000000000000004'],
                    team1Score: 21,
                    team2Score: 19
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('You must be a player in the match');
        });

        it('should reject match with duplicate player', async () => {
            const res = await request(app)
                .post('/api/matches')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    type: 'singles',
                    team1: ['650000000000000000000001'],
                    team2: ['650000000000000000000001'],
                    team1Score: 21,
                    team2Score: 19
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Duplicate player detected');
        });

        it('should reject match with tied or negative scores', async () => {
            const res = await request(app)
                .post('/api/matches')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    type: 'singles',
                    team1: ['650000000000000000000001'],
                    team2: ['650000000000000000000002'],
                    team1Score: 21,
                    team2Score: 21
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('distinct non-negative integers');
        });
    });

    describe('Instagram Scraper URL Validation', () => {
        it('should reject non-https or non-instagram URLs', async () => {
            const res = await request(app)
                .post('/api/scrape/instagram')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ url: 'http://evil.com/instagram.com' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('https://instagram.com');
        });
    });
});
