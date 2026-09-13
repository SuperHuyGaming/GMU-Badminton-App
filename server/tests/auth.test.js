const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('../routes/auth');
const User = require('../models/User');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes Edge Cases', () => {
    // Mocking Mongoose and User model
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should reject registration if email already exists', async () => {
        User.findOne = jest.fn().mockResolvedValue({ email: 'test@example.com' });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('An account with this email already exists.');
    });

    it('should reject registration if required fields are missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com'
            });
        expect(res.statusCode).toBe(400); 
    });

    it('should reject login if user is not found', async () => {
        User.findOne = jest.fn().mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'nonexistent@example.com',
                password: 'password123'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid email or password.');
    });

    it('should reject login if password does not match', async () => {
        const bcrypt = require('bcryptjs');
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
        User.findOne = jest.fn().mockResolvedValue({
            email: 'test@example.com',
            password: 'hashedpassword'
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid email or password.');
    });
});
