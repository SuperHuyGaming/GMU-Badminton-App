const request = require('supertest');
const { app } = require('../index');

describe('Search Service Express Server', () => {
  it('GET /health returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'search-service',
    });
  });

  describe('GET /api/search validation', () => {
    it('returns 200 with search results for valid query', async () => {
      const res = await request(app).get('/api/search?q=badminton&type=players&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        query: 'badminton',
        type: 'players',
        page: 1,
        limit: 10,
        total: 0,
        results: [],
      });
    });

    it('returns 400 when search query "q" is missing or empty', async () => {
      const res = await request(app).get('/api/search?q=   ');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('required and cannot be empty');
    });

    it('returns 400 when search query exceeds 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app).get(`/api/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('must not exceed 100 characters');
    });

    it('returns 400 when invalid type is provided', async () => {
      const res = await request(app).get('/api/search?q=test&type=invalid_type');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('Invalid type');
    });
  });

  describe('404 Not Found Handler', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(app).get('/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
