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
		it('applies $nor exclusion filter for target personal records in the database query', async () => {
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({
					limit: jest.fn().mockReturnValue({
						lean: jest.fn().mockResolvedValue([]),
					}),
				}),
			});

			const res = await request(app).get('/api/forum/members?limit=10');
			expect(res.status).toBe(200);
			expect(res.body.users).toBeDefined();

			const findCall = User.find.mock.calls[0][0];
			expect(findCall.$nor).toEqual([
				{ name: /tu\s+pham/i },
				{ name: /nhat\s+quang/i },
			]);
			expect(findCall.hideFromSearch).toEqual({ $ne: true });
		});

		it('returns a full page of results (no post-limit filtering shortens the page)', async () => {
			const mockUsers = Array.from({ length: 3 }, (_, i) => ({
				_id: new mongoose.Types.ObjectId(),
				name: `Member ${i}`,
				role: 'user',
				skillLevel: 'Intermediate',
				badges: [],
			}));
			const limitMock = jest.fn().mockReturnValue({
				lean: jest.fn().mockResolvedValue(mockUsers),
			});
			User.find.mockReturnValue({
				select: jest.fn().mockReturnValue({ limit: limitMock }),
			});

			const res = await request(app).get('/api/forum/members?limit=3');
			expect(res.status).toBe(200);
			expect(limitMock).toHaveBeenCalledWith(3);
			expect(res.body.users).toHaveLength(3);
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

		it('defaults to a dry run unless --confirm is passed', async () => {
			expect(process.argv).not.toContain('--confirm');
			const summary = await runPurge({
				mongoUri: 'mongodb://127.0.0.1:29999/non_existent_db_for_test',
				timeoutMs: 1000,
			});

			expect(summary.isDryRun).toBe(true);
			expect(summary.usersDeleted).toBe(0);
		}, 10000);
	});
});
