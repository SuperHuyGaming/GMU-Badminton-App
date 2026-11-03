// Protected endpoints must reject anonymous and forged requests before doing
// any work. Each request here is refused by the auth middleware, so this is
// safe to run against a deployed server.
const { test, expect } = require('@playwright/test');

const PROTECTED = [
  { method: 'post', path: '/api/forum', label: 'create a post' },
  { method: 'get', path: '/api/matches/pending', label: 'pending matches' },
  { method: 'post', path: '/api/matches', label: 'submit a match' },
  { method: 'post', path: '/api/matchmaking/queue/join', label: 'join matchmaking queue' },
  { method: 'post', path: '/api/courts/1/check-in', label: 'court check-in' },
  { method: 'get', path: '/api/admin/tournaments/proposed', label: 'admin tournament queue' },
  { method: 'post', path: '/api/announcements', label: 'post an announcement' },
];

// A well-formed JWT signed with a key the server does not know.
const FORGED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJ1c2VySWQiOiJhdHRhY2tlciIsInJvbGUiOiJhZG1pbiJ9.' +
  'c2lnbmF0dXJlLXRoYXQtd2lsbC1uZXZlci12ZXJpZnk';

test.describe('auth guards', () => {
  for (const { method, path, label } of PROTECTED) {
    test(`${method.toUpperCase()} ${path} (${label}) rejects a request with no token`, async ({ request }) => {
      const res = await request[method](path, { data: method === 'post' ? {} : undefined });
      expect(res.status()).toBe(401);
      expect((await res.json()).message).toBe('No token, authorization denied');
    });

    test(`${method.toUpperCase()} ${path} (${label}) rejects a forged admin token`, async ({ request }) => {
      const res = await request[method](path, {
        headers: { Authorization: `Bearer ${FORGED_JWT}` },
        data: method === 'post' ? {} : undefined,
      });
      expect(res.status()).toBe(401);
      expect((await res.json()).message).toBe('Token is not valid');
    });
  }

  test('a malformed Authorization header is rejected', async ({ request }) => {
    const res = await request.get('/api/matches/pending', {
      headers: { Authorization: 'Bearer' },
    });
    expect(res.status()).toBe(401);
  });
});
