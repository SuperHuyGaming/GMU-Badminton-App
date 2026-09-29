const request = require('supertest');
const express = require('express');
const axios = require('axios');
const searchRoutes = require('../routes/search');

jest.mock('axios');

const app = express();
app.use(express.json());
app.use('/api/search', searchRoutes);

describe('Search Proxy Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should proxy search request to search-service and return results', async () => {
        const mockResults = [
            { _id: 'u1', name: 'Alice Smith', skillLevel: 'Intermediate', university: 'GMU' }
        ];

        axios.get.mockResolvedValue({
            data: { results: mockResults }
        });

        const res = await request(app)
            .get('/api/search?q=Alice&type=user');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ results: mockResults });
        expect(axios.get).toHaveBeenCalledWith('http://localhost:5001/search', {
            params: { q: 'Alice', type: 'user' },
            timeout: 5000,
        });
    });

    it('should forward page and limit parameters to search-service', async () => {
        axios.get.mockResolvedValue({
            data: { results: [], total: 0, page: 2, limit: 10 }
        });

        const res = await request(app)
            .get('/api/search?q=Bob&type=posts&page=2&limit=10');

        expect(res.statusCode).toBe(200);
        expect(axios.get).toHaveBeenCalledWith('http://localhost:5001/search', {
            params: { q: 'Bob', type: 'posts', page: '2', limit: '10' },
            timeout: 5000,
        });
    });

    it('should forward searcherHomeUniversity parameter to search-service', async () => {
        axios.get.mockResolvedValue({
            data: { results: [], total: 0 }
        });

        const res = await request(app)
            .get('/api/search?q=David&type=players&searcherHomeUniversity=GMU');

        expect(res.statusCode).toBe(200);
        expect(axios.get).toHaveBeenCalledWith('http://localhost:5001/search', {
            params: { q: 'David', type: 'players', searcherHomeUniversity: 'GMU' },
            timeout: 5000,
        });
    });

    it('should strip sensitive fields from search proxy response', async () => {
        const mockResultsWithSecrets = [
            {
                _id: 'u2',
                name: 'Charlie',
                email: 'charlie@gmu.edu',
                password: 'hashed-password',
                pushSubscriptions: [{ endpoint: 'ep' }],
                token: 'jwt-token-leak',
                secret: 'sensitive-val',
                jwt: 'token',
                skillLevel: 'Advanced'
            }
        ];

        axios.get.mockResolvedValue({
            data: { results: mockResultsWithSecrets }
        });

        const res = await request(app)
            .get('/api/search?q=Charlie');

        expect(res.statusCode).toBe(200);
        expect(res.body.results[0]).toEqual({
            _id: 'u2',
            name: 'Charlie',
            skillLevel: 'Advanced'
        });
        expect(res.body.results[0].email).toBeUndefined();
        expect(res.body.results[0].password).toBeUndefined();
        expect(res.body.results[0].pushSubscriptions).toBeUndefined();
        expect(res.body.results[0].token).toBeUndefined();
        expect(res.body.results[0].secret).toBeUndefined();
        expect(res.body.results[0].jwt).toBeUndefined();
    });

    it('should respect custom SEARCH_SERVICE_URL env variable', async () => {
        const origEnv = process.env.SEARCH_SERVICE_URL;
        process.env.SEARCH_SERVICE_URL = 'http://custom-search-service:5001/search';

        axios.get.mockResolvedValue({
            data: { results: [] }
        });

        const res = await request(app)
            .get('/api/search?q=custom');

        expect(res.statusCode).toBe(200);
        expect(axios.get).toHaveBeenCalledWith('http://custom-search-service:5001/search', {
            params: { q: 'custom' },
            timeout: 5000,
        });

        if (origEnv !== undefined) {
            process.env.SEARCH_SERVICE_URL = origEnv;
        } else {
            delete process.env.SEARCH_SERVICE_URL;
        }
    });

    it('should handle search-service failure gracefully and return empty results fallback', async () => {
        axios.get.mockRejectedValue(new Error('Connection refused'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .get('/api/search?q=Alice&type=user');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ results: [] });
        expect(consoleSpy).toHaveBeenCalledWith('Search proxy error:', 'Connection refused');

        consoleSpy.mockRestore();
    });
});
