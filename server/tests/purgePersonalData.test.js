const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

const forumRoutes = require('../routes/forum');
const User = require('../models/User');
const runPurge = require('../scripts/purgePersonalData');

jest.mock('../models/User');
jest.mock('../models/Post');
jest.mock('../models/ActivityFeed');
jest.mock('../models/Notification');
jest.mock('../utils/feedCache', () => ({
	get: jest.fn().mockReturnValue(null),
	set: jest.fn().mockReturnValue('W/"test-etag"'),
	invalidateFeed: jest.fn(),
	clear: jest.fn(),
	resetStats: jest.fn(),
	getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, invalidations: 0, size: 0 }),
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

const app = express();
app.use(express.json());
app.use('/api/forum', forumRoutes);

describe('Personal Data Purge & Member Exclusion Defense-in-Depth Suite', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('1. Member Search API Defense-in-Depth (GET /api/forum/members)', () => {
		it('applies $nor exclusion filter for target personal records', async () => {
			const mockUsers = [
				{ _id: new mongoose.Types.ObjectId(), name: 'Alex Chen', role: 'user', skillLevel: 'Intermediate', badges: [] },
				{ _id: new mongoose.Types.ObjectId(), name: 'Tu Pham', role: 'user', skillLevel: 'Advanced', badges: [] },
				{ _id: new mongoose.Types.ObjectId(), name: 'Nhat Quang', role: 'user', skillLevel: 'Beginner', badges: [] },
				{ _id: new mongoose.Types.ObjectId(), name: 'David Kim', role: 'user', skillLevel: 'Intermediate', badges: [] },
			];

			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue(mockUsers),
					}),
				}),
			});

			const res = await request(app).get('/api/forum/members?limit=10');
			expect(res.status).toBe(200);
			expect(res.body.users).toBeDefined();

			// Confirm $nor filter was passed to User.find
			const findCall = User.find.mock.calls[0][0];
			expect(findCall.$nor).toBeDefined();
			expect(findCall.$nor).toEqual([
				{ name: /tu\s+pham/i },
				{ name: /nhat\s+quang/i },
			]);

			// Confirm in-memory defense-in-depth filter completely stripped target names
			const returnedNames = res.body.users.map((u) => u.name);
			expect(returnedNames).toContain('Alex Chen');
			expect(returnedNames).toContain('David Kim');
			expect(returnedNames).not.toContain('Tu Pham');
			expect(returnedNames).not.toContain('Nhat Quang');
			expect(res.body.users.length).toBe(2);
		});

		it('strips case-insensitive variations and extra whitespace of target names', async () => {
			const mockUsersWithVariations = [
				{ _id: new mongoose.Types.ObjectId(), name: 'tu   pham', role: 'user', skillLevel: 'Intermediate', badges: [] },
				{ _id: new mongoose.Types.ObjectId(), name: 'NHAT   QUANG', role: 'user', skillLevel: 'Intermediate', badges: [] },
				{ _id: new mongoose.Types.ObjectId(), name: 'Sarah Connor', role: 'user', skillLevel: 'Advanced', badges: [] },
			];

			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue(mockUsersWithVariations),
					}),
				}),
			});

			const res = await request(app).get('/api/forum/members');
			expect(res.status).toBe(200);
			expect(res.body.users).toHaveLength(1);
			expect(res.body.users[0].name).toBe('Sarah Connor');
		});
	});

	describe('2. Standalone Purge Script Module (server/scripts/purgePersonalData.js)', () => {
		it('handles MongoDB connection failure gracefully and returns summary report', async () => {
			const summary = await runPurge({
				mongoUri: 'mongodb://127.0.0.1:29999/non_existent_db_for_test',
				isDryRun: true,
				timeoutMs: 1000,
			});

			expect(summary).toBeDefined();
			expect(summary.isDryRun).toBe(true);
			expect(summary.success).toBe(false);
			expect(summary.error).toBeDefined();
		}, 10000);
	});
});
