jest.mock('natural', () => ({
    BayesClassifier: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        train: jest.fn(),
        classify: jest.fn(() => 'ham')
    }))
}));

jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    return {
        ...original,
        connect: jest.fn().mockResolvedValue(true)
    };
});

const request = require('supertest');
const { app } = require('../server');

describe('API Route 404 Behavior', () => {
    it('returns a JSON 404 for unknown /api/* routes', async () => {
        const res = await request(app).get('/api/unknown-endpoint-xyz');
        expect(res.status).toBe(404);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ message: 'Not found' });
    });

    it('returns JSON 404 for nested unknown /api/* routes', async () => {
        const res = await request(app).post('/api/forum/nonexistent/subroute');
        expect(res.status).toBe(404);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ message: 'Not found' });
    });
});
