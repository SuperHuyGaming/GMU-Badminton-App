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
});
