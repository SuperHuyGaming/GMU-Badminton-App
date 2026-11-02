const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const courtRoutes = require('../routes/courts');
const Court = require('../models/Court');
const User = require('../models/User');

jest.mock('../models/Court');
jest.mock('../models/User');
jest.mock('../models/TournamentMatch');

const JWT_SECRET = process.env.JWT_SECRET || 'gmu_badminton_super_secret_key_2026';
const testUserId = '660000000000000000000030';
const testToken = jwt.sign({ userId: testUserId, id: testUserId }, JWT_SECRET);

describe('RAC Physical Court Check-in API Suite', () => {
	let app;
	let mockIo;
	let emittedEvents;

	beforeEach(() => {
		jest.clearAllMocks();
		emittedEvents = [];
		mockIo = {
			emit: jest.fn((event, data) => {
				emittedEvents.push({ event, data });
			}),
		};

		app = express();
		app.use(express.json());
		app.set('io', mockIo);
		app.use('/api/courts', courtRoutes);
	});

	describe('1. GET /api/courts/recreational-occupancy', () => {
		test('returns RAC Courts 1-6 with recreational occupancy details and cleans expired users', async () => {
			const futureDate = new Date(Date.now() + 1800000);
			const pastDate = new Date(Date.now() - 600000);

			const mockCourts = [1, 2, 3, 4, 5, 6].map((num) => ({
				courtNumber: num,
				courtName: `RAC Court ${num}`,
				status: 'AVAILABLE',
				recreationalOccupancy: {
					isCheckedIn: num === 1,
					checkedInUsers: num === 1 ? [
						{ userId: new mongoose.Types.ObjectId(), userName: 'Active Player', expiresAt: futureDate },
						{ userId: new mongoose.Types.ObjectId(), userName: 'Expired Player', expiresAt: pastDate }
					] : [],
					queueCount: 0,
					estimatedWaitMinutes: 0
				},
				updatedAt: new Date(),
				save: jest.fn().mockResolvedValue(true)
			}));

			Court.find = jest.fn().mockReturnValue({
				sort: jest.fn().mockResolvedValue(mockCourts)
			});
			Court.findOne = jest.fn().mockImplementation(({ courtNumber }) => {
				return Promise.resolve(mockCourts.find(c => c.courtNumber === courtNumber));
			});

			const res = await request(app).get('/api/courts/recreational-occupancy');
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.courts).toHaveLength(6);
			// Court 1 should now have only 1 active user after cleaning expired
			expect(res.body.courts[0].recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(res.body.courts[0].recreationalOccupancy.checkedInUsers[0].userName).toBe('Active Player');
		});
	});

	describe('2. POST /api/courts/:courtNumber/check-in', () => {
		test('returns 401 when unauthenticated', async () => {
			const res = await request(app).post('/api/courts/1/check-in').send({
				latitude: 38.8315,
				longitude: -77.3075
			});
			expect(res.status).toBe(401);
		});

		test('returns 400 for invalid court number (e.g., 7 or 0)', async () => {
			const res = await request(app)
				.post('/api/courts/7/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: -77.3075 });
			expect(res.status).toBe(400);
		});

		test('returns 403 when GPS coordinates are missing without test flag', async () => {
			User.findById = jest.fn().mockResolvedValue({
				_id: testUserId,
				name: 'Test Player',
				save: jest.fn().mockResolvedValue(true)
			});

			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({});

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/valid gps coordinates required/i);
		});

		test('returns 403 when GPS location is > 200m away from RAC', async () => {
			User.findById = jest.fn().mockResolvedValue({
				_id: testUserId,
				name: 'Test Player',
				save: jest.fn().mockResolvedValue(true)
			});

			// Coordinates in Washington DC (~25km away from RAC in Fairfax)
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8977, longitude: -77.0365 });

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/must be physically at the rac/i);
		});

		test('returns 200 and successfully checks in when location is within 200m of RAC', async () => {
			const mockUser = {
				_id: testUserId,
				name: 'Court Tester',
				profilePic: 'https://example.com/pic.jpg',
				save: jest.fn().mockResolvedValue(true)
			};
			User.findById = jest.fn().mockResolvedValue(mockUser);

			const mockCourt1 = {
				courtNumber: 1,
				courtName: 'RAC Court 1',
				recreationalOccupancy: {
					isCheckedIn: false,
					checkedInUsers: [],
					queueCount: 0
				},
				save: jest.fn().mockResolvedValue(true)
			};

			Court.findOne = jest.fn().mockResolvedValue(mockCourt1);
			Court.find = jest.fn().mockResolvedValue([]);

			// Coordinates exactly at RAC: 38.8315, -77.3075
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: -77.3075 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.courtNumber).toBe(1);
			expect(res.body.checkIn.expiresAt).toBeDefined();
			expect(mockCourt1.recreationalOccupancy.isCheckedIn).toBe(true);
			expect(mockCourt1.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(mockUser.currentCourtCheckIn.courtNumber).toBe(1);
			expect(mockUser.checkInLocation).toBe('RAC');
			expect(mockIo.emit).toHaveBeenCalledWith('courtOccupancyUpdated', expect.anything());
		});

		test('returns 403 when latitude or longitude is out of [-90, 90] / [-180, 180] range', async () => {
			User.findById = jest.fn().mockResolvedValue({
				_id: testUserId,
				name: 'Test Player',
				save: jest.fn().mockResolvedValue(true)
			});

			const resLat = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 95.0, longitude: -77.3075 });
			expect(resLat.status).toBe(403);
			expect(resLat.body.message).toMatch(/valid gps coordinates required/i);

			const resLon = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: 185.0 });
			expect(resLon.status).toBe(403);
			expect(resLon.body.message).toMatch(/valid gps coordinates required/i);
		});

		test('allows bypass check-in with isTestCheckIn: true', async () => {
			const mockUser = {
				_id: testUserId,
				name: 'Test Runner',
				save: jest.fn().mockResolvedValue(true)
			};
			User.findById = jest.fn().mockResolvedValue(mockUser);

			const mockCourt = {
				courtNumber: 3,
				courtName: 'RAC Court 3',
				recreationalOccupancy: { isCheckedIn: false, checkedInUsers: [] },
				save: jest.fn().mockResolvedValue(true)
			};

			Court.findOne = jest.fn().mockResolvedValue(mockCourt);
			Court.find = jest.fn().mockResolvedValue([]);

			const res = await request(app)
				.post('/api/courts/3/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ isTestCheckIn: true });

			expect(res.status).toBe(200);
			expect(res.body.courtNumber).toBe(3);
			expect(mockCourt.recreationalOccupancy.isCheckedIn).toBe(true);
		});
	});

	describe('3. POST /api/courts/:courtNumber/check-out', () => {
		test('clears user check-in and updates occupancy', async () => {
			const mockUser = {
				_id: testUserId,
				currentCourtCheckIn: { courtNumber: 2 },
				checkInLocation: 'RAC',
				save: jest.fn().mockResolvedValue(true)
			};
			User.findById = jest.fn().mockResolvedValue(mockUser);

			const mockCourt = {
				courtNumber: 2,
				courtName: 'RAC Court 2',
				recreationalOccupancy: {
					isCheckedIn: true,
					checkedInUsers: [{ userId: testUserId, userName: 'Checked In User' }]
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Court.findOne = jest.fn().mockResolvedValue(mockCourt);

			const res = await request(app)
				.post('/api/courts/2/check-out')
				.set('Authorization', `Bearer ${testToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(mockCourt.recreationalOccupancy.checkedInUsers).toHaveLength(0);
			expect(mockCourt.recreationalOccupancy.isCheckedIn).toBe(false);
			expect(mockUser.currentCourtCheckIn).toBeUndefined();
			expect(mockUser.checkInLocation).toBe('None');
			expect(mockIo.emit).toHaveBeenCalledWith('courtOccupancyUpdated', expect.anything());
		});

		test('returns 400 Bad Request when user attempts check-out while not checked in at all', async () => {
			const mockCourt = {
				courtNumber: 2,
				courtName: 'RAC Court 2',
				recreationalOccupancy: {
					isCheckedIn: false,
					checkedInUsers: []
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Court.findOne = jest.fn().mockResolvedValue(mockCourt);

			const res = await request(app)
				.post('/api/courts/2/check-out')
				.set('Authorization', `Bearer ${testToken}`);

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/not checked into this court/i);
			expect(mockIo.emit).not.toHaveBeenCalled();
		});

		test('returns 400 Bad Request when checking out of a court the user is not checked into (cross-court check-out prevention)', async () => {
			const otherUserId = '660000000000000000000099';
			const mockCourt = {
				courtNumber: 3,
				courtName: 'RAC Court 3',
				recreationalOccupancy: {
					isCheckedIn: true,
					checkedInUsers: [{ userId: otherUserId, userName: 'Other User' }]
				},
				save: jest.fn().mockResolvedValue(true)
			};
			Court.findOne = jest.fn().mockResolvedValue(mockCourt);

			const res = await request(app)
				.post('/api/courts/3/check-out')
				.set('Authorization', `Bearer ${testToken}`);

			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/not checked into this court/i);
			expect(mockCourt.recreationalOccupancy.checkedInUsers).toHaveLength(1);
			expect(mockIo.emit).not.toHaveBeenCalled();
		});
	});
});
