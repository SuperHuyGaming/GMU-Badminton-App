// HTTP hardening: security headers, CORS, rate-limit headers, input validation.
const { test, expect } = require('@playwright/test');

test.describe('security headers', () => {
  test('helmet headers are set and X-Powered-By is hidden', async ({ request }) => {
    const res = await request.get('/api/status');
    const h = res.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('API responses advertise the rate limit', async ({ request }) => {
    const res = await request.get('/api/status');
    const h = res.headers();
    expect(Number(h['ratelimit-limit'])).toBeGreaterThan(0);
    expect(h['ratelimit-remaining']).toBeDefined();
  });
});

test.describe('CORS', () => {
  const ALLOWED = 'http://localhost:5173';

  test('echoes an allowed origin with credentials', async ({ request }) => {
    const res = await request.get('/api/status', { headers: { Origin: ALLOWED } });
    expect(res.headers()['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('does not grant access to an unknown origin', async ({ request }) => {
    const res = await request.get('/api/status', { headers: { Origin: 'https://evil.example.com' } });
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('does not trust look-alike GMU domains', async ({ request }) => {
    for (const origin of ['https://gmu.edu.evil.com', 'https://notgmu.edu', 'https://evil-onrender.com']) {
      const res = await request.get('/api/status', { headers: { Origin: origin } });
      expect(res.headers()['access-control-allow-origin'], origin).toBeUndefined();
    }
  });

  test('answers preflight requests with 204', async ({ request }) => {
    const res = await request.fetch('/api/forum', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    expect(res.status()).toBe(204);
    expect(res.headers()['access-control-allow-methods']).toContain('POST');
    expect(res.headers()['access-control-allow-headers']).toMatch(/authorization/i);
  });
});

test.describe('input validation', () => {
  test('login rejects a missing email before touching the database', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/valid email/i);
  });

  test('login rejects a NoSQL operator injected as the email', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: { $gt: '' }, password: 'irrelevant' },
    });
    expect(res.status()).toBe(400);
  });
});
