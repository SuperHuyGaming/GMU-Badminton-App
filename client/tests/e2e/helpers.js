// Shared E2E helpers.
//
// The specs run against the Vite dev server with every /api/** call stubbed,
// so they need no database and no real login. A real API call with a fake
// token would return 401 and the client would log the user out (see
// src/utils/api.js), so a signed-in test must stub the API before it loads.

/**
 * Stub every /api/** request with an empty 200 response.
 * Register specific page.route() mocks AFTER calling this: Playwright tries
 * the most recently registered matching route first.
 */
export async function stubApi(page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}

/** Seed localStorage so the app starts signed in as `user`. */
export async function signInAs(page, user) {
  await page.addInitScript((u) => {
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('accessToken', 'e2e-fake-access-token');
    localStorage.setItem('refreshToken', 'e2e-fake-refresh-token');
    localStorage.setItem('onboardingComplete', 'true');
  }, user);
}

export const PLAYER = {
  _id: 'e2e-player',
  id: 'e2e-player',
  name: 'Playwright Tester',
  email: 'tester@gmu.edu',
  role: 'user',
};

export const ADMIN = {
  _id: 'e2e-admin',
  id: 'e2e-admin',
  name: 'Playwright Admin',
  email: 'admin@gmu.edu',
  role: 'admin',
};
