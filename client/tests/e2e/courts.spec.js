import { test, expect } from '@playwright/test';
import { stubApi, signInAs, PLAYER } from './helpers.js';

// The Dashboard's RAC court widget reads the court schedule from the Java
// tournament service (http://localhost:8081/api/v1/courts/status on localhost)
// and falls back to a built-in weekly schedule when that service is down.
const COURT_STATUS = '**/api/v1/courts/status';

const HOUR = 60 * 60 * 1000;

function scheduleWithActiveSlot(status, eventName) {
  const now = Date.now();
  return {
    facilityName: 'RAC Linn Gym Court B',
    timeSlots: [
      { startTime: now - HOUR, endTime: now + HOUR, status, eventName },
      { startTime: now + 24 * HOUR, endTime: now + 26 * HOUR, status: 'CLUB_ONLY', eventName: 'Club Badminton Practice' },
    ],
  };
}

test.describe('RAC court status (Dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await signInAs(page, PLAYER);
    // The Dashboard expects these endpoints to return lists.
    for (const pattern of ['**/api/announcements', '**/api/matches/pending', '**/api/matches/user/*']) {
      await page.route(pattern, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      );
    }
  });

  test('shows OPEN FOR PLAY during a dedicated drop-in slot', async ({ page }) => {
    await page.route(COURT_STATUS, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scheduleWithActiveSlot('DEDICATED', 'Dedicated Drop In Badminton ct. B')),
      })
    );

    await page.goto('/');
    await expect(page.getByText('REAL-TIME COURT STATUS')).toBeVisible();
    await expect(page.getByText('OPEN FOR PLAY', { exact: true })).toBeVisible();
    await expect(page.getByText('Dedicated Drop-In Badminton (Open Play)')).toBeVisible();
    await expect(page.getByText('100% Dedicated')).toBeVisible();
  });

  test('shows PRACTICE IN SESSION during club practice', async ({ page }) => {
    await page.route(COURT_STATUS, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(scheduleWithActiveSlot('CLUB_ONLY', 'Club Badminton Practice')),
      })
    );

    await page.goto('/');
    await expect(page.getByText('PRACTICE IN SESSION', { exact: true })).toBeVisible();
    await expect(page.getByText('Club Reserved')).toBeVisible();
  });

  test('falls back to the built-in weekly schedule when the court service is down', async ({ page }) => {
    await page.route(COURT_STATUS, (route) => route.abort('connectionrefused'));

    await page.goto('/');
    await expect(page.getByText('REAL-TIME COURT STATUS')).toBeVisible();
    await expect(page.getByText('RAC Linn Gym Court B')).toBeVisible();
    // The fallback lists the regular weekly sessions.
    await expect(page.getByText('Club Badminton Practice').first()).toBeVisible();
  });
});
