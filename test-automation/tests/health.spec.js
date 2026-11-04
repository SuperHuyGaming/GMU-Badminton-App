// Public, read-only endpoints that need no database.
const { test, expect } = require('@playwright/test');

test.describe('health & public data', () => {
  test('GET /api/status returns the RAC status message', async ({ request }) => {
    const res = await request.get('/api/status');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  test('GET /api/schedule/weekly returns a 7-day schedule', async ({ request }) => {
    const res = await request.get('/api/schedule/weekly');
    expect(res.status()).toBe(200);
    const days = await res.json();
    expect(Array.isArray(days)).toBe(true);
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(day).toEqual(expect.objectContaining({
        date: expect.any(String),
        day: expect.any(String),
        status: expect.any(String),
        location: expect.any(String),
      }));
    }
    const names = days.map((d) => d.day);
    expect(new Set(names).size).toBe(7);
  });

  test('unknown API routes return 404', async ({ request }) => {
    const res = await request.get('/api/this-route-does-not-exist');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ message: 'Not found' });
  });
});
