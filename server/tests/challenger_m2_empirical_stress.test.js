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
const testUserId = '660000000000000000000099';
const testToken = jwt.sign({ userId: testUserId, id: testUserId }, JWT_SECRET);

describe('Challenger 1 Empirical Stress Suite: RAC Court Check-In & Haversine Boundaries', () => {
	let app;
	let mockIo;
	let emittedEvents;
	let mockUser;
	let mockCourt;

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

		mockUser = {
			_id: testUserId,
			name: 'Empirical Tester',
			profilePic: 'https://example.com/tester.jpg',
			save: jest.fn().mockResolvedValue(true),
		};
		User.findById = jest.fn().mockResolvedValue(mockUser);

		mockCourt = {
			courtNumber: 1,
			courtName: 'RAC Court 1',
			recreationalOccupancy: {
				isCheckedIn: false,
				checkedInUsers: [],
				queueCount: 0,
			},
			save: jest.fn().mockResolvedValue(true),
		};
		Court.findOne = jest.fn().mockResolvedValue(mockCourt);
		Court.find = jest.fn().mockImplementation(() => {
			const p = Promise.resolve([]);
			p.sort = jest.fn().mockResolvedValue([mockCourt]);
			return p;
		});
	});

	describe('Haversine GPS Exact Distance Boundaries', () => {
		// RAC Coordinates: (38.8315, -77.3075)
		const RAC_LAT = 38.8315;
		const RAC_LON = -77.3075;
		const R = 6371e3;
		const rad = deg => (deg * Math.PI) / 180;

		// Exact offsets in degrees
		const latOffset = d => RAC_LAT + (d * 180) / (Math.PI * R);
		const lonOffset = d => RAC_LON + (d * 180) / (Math.PI * R * Math.cos(rad(RAC_LAT)));

		it('succeeds at exactly 0m (center of RAC)', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: RAC_LAT, longitude: RAC_LON });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.courtNumber).toBe(1);
			expect(mockCourt.recreationalOccupancy.isCheckedIn).toBe(true);
		});

		it('succeeds at 100m North of RAC', async () => {
			const lat100 = latOffset(100);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: lat100, longitude: RAC_LON });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('succeeds at 100m East of RAC', async () => {
			const lon100 = lonOffset(100);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: RAC_LAT, longitude: lon100 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('succeeds at boundary of exactly 199m North of RAC', async () => {
			const lat199 = latOffset(199);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: lat199, longitude: RAC_LON });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('succeeds at boundary of exactly 199m East of RAC', async () => {
			const lon199 = lonOffset(199);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: RAC_LAT, longitude: lon199 });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('succeeds at boundary of exactly 200m North of RAC', async () => {
			const lat200 = latOffset(200);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: lat200, longitude: RAC_LON });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('rejects with 403 at boundary of 201m North of RAC', async () => {
			const lat201 = latOffset(201);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: lat201, longitude: RAC_LON });

			expect(res.status).toBe(403);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/201m away from the RAC/i);
		});

		it('rejects with 403 at boundary of 201m East of RAC', async () => {
			const lon201 = lonOffset(201);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: RAC_LAT, longitude: lon201 });

			expect(res.status).toBe(403);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/201m away from the RAC/i);
		});

		it('rejects with 403 at 250m North of RAC', async () => {
			const lat250 = latOffset(250);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: lat250, longitude: RAC_LON });

			expect(res.status).toBe(403);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/250m away from the RAC/i);
		});

		it('rejects with 403 at 250m East of RAC', async () => {
			const lon250 = lonOffset(250);
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: RAC_LAT, longitude: lon250 });

			expect(res.status).toBe(403);
			expect(res.body.success).toBe(false);
			expect(res.body.message).toMatch(/250m away from the RAC/i);
		});
	});

	describe('Invalid Coordinates & Data Types Stress Tests', () => {
		it('rejects with 403 when latitude is a string', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: '38.8315', longitude: -77.3075 });

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/valid gps coordinates required/i);
		});

		it('rejects with 403 when longitude is a string', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: '-77.3075' });

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/valid gps coordinates required/i);
		});

		it('rejects with 403 when coordinates are null or missing', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: null, longitude: null });

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/valid gps coordinates required/i);
		});

		it('rejects with 403 when coordinates are distant coordinates (e.g. Washington DC)', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8951, longitude: -77.0364 }); // ~25km away

			expect(res.status).toBe(403);
			expect(res.body.message).toMatch(/away from the RAC/i);
		});

		it('rejects with 403 when latitude is antipodal (opposite side of Earth)', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: -38.8315, longitude: 102.6925 });

			expect(res.status).toBe(403);
		});
	});

	describe('Court Identification and Access Control', () => {
		it('rejects with 401 when unauthenticated', async () => {
			const res = await request(app)
				.post('/api/courts/1/check-in')
				.send({ latitude: 38.8315, longitude: -77.3075 });

			expect(res.status).toBe(401);
		});

		it('rejects with 400 for courtNumber 0', async () => {
			const res = await request(app)
				.post('/api/courts/0/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: -77.3075 });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/between 1 and 6/i);
		});

		it('rejects with 400 for courtNumber 7', async () => {
			const res = await request(app)
				.post('/api/courts/7/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: -77.3075 });

			expect(res.status).toBe(400);
			expect(res.body.message).toMatch(/between 1 and 6/i);
		});

		it('rejects with 400 for non-numeric courtNumber', async () => {
			const res = await request(app)
				.post('/api/courts/invalidCourt/check-in')
				.set('Authorization', `Bearer ${testToken}`)
				.send({ latitude: 38.8315, longitude: -77.3075 });

			expect(res.status).toBe(400);
		});
	});

	describe('Check-Out and Socket Notification Invariant', () => {
		it('successfully checks out and broadcasts courtOccupancyUpdated event', async () => {
			mockCourt.recreationalOccupancy.checkedInUsers = [
				{ userId: testUserId, userName: 'Empirical Tester' },
			];
			mockCourt.recreationalOccupancy.isCheckedIn = true;
			mockUser.currentCourtCheckIn = { courtNumber: 1 };
			mockUser.checkInLocation = 'RAC';

			const res = await request(app)
				.post('/api/courts/1/check-out')
				.set('Authorization', `Bearer ${testToken}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(mockCourt.recreationalOccupancy.checkedInUsers).toHaveLength(0);
			expect(mockCourt.recreationalOccupancy.isCheckedIn).toBe(false);
			expect(mockUser.currentCourtCheckIn).toBeUndefined();
			expect(mockUser.checkInLocation).toBe('None');
			expect(mockIo.emit).toHaveBeenCalledWith('courtOccupancyUpdated', expect.objectContaining({
				courtNumber: 1,
			}));
		});
	});
});
