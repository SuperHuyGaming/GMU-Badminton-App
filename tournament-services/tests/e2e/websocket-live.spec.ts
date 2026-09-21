import { test, expect } from '@playwright/test';

test.describe('Real-Time WebSocket & Notification Toast', () => {
  test('should display WebSocket connection badge in the navbar', async ({ page }) => {
    await page.goto('/');

    // Check for presence of live or offline badge
    const badge = page.locator('header').getByText(/LIVE FEED|OFFLINE/i);
    await expect(badge).toBeVisible();
  });

  test('should render real-time notification snackbar when new tournament event fires', async ({ page }) => {
    await page.goto('/');

    // Evaluate client-side dispatch to test incoming notification toast rendering
    await page.evaluate(() => {
      const mockEvent = new CustomEvent('mock-ws-tournament', {
        detail: {
          id: 'test-event-1',
          tournamentName: 'Test Open Championship 2026',
          hostUniversity: 'Georgetown University',
          eventLocation: 'Yates Field House, Washington, DC',
          registrationDeadline: new Date(Date.now() + 86400000 * 5).toISOString(),
          isOpenTournament: true,
          rsvpCount: 0,
          createdAt: new Date().toISOString(),
        }
      });
      window.dispatchEvent(mockEvent);
    });

    // Check if notification snackbar UI elements render cleanly
    const toast = page.locator('.MuiSnackbar-root');
    await expect(toast).toBeVisible();
    // Note: If event listener is hooked to window, this verifies snackbar animation
  });
});

