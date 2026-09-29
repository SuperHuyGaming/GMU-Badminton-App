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
            params: { q: 'Alice', type: 'user' }
        });
    });

    it('should pass searcherHomeUniversity to search-service', async () => {
        const mockResults = [
            { _id: 'u1', name: 'Alice Smith', skillLevel: 'Intermediate', university: 'GMU' }
        ];

        axios.get.mockResolvedValue({
            data: { results: mockResults }
        });

        const res = await request(app)
            .get('/api/search?q=Alice&type=user&searcherHomeUniversity=GMU');

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ results: mockResults });
        expect(axios.get).toHaveBeenCalledWith('http://localhost:5001/search', {
            params: { q: 'Alice', type: 'user', searcherHomeUniversity: 'GMU' }
        });
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
