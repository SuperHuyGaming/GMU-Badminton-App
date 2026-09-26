# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: websocket-live.spec.ts >> Real-Time WebSocket & Notification Toast >> should display WebSocket connection badge in the navbar
- Location: websocket-live.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Real-Time WebSocket & Notification Toast', () => {
  4  |   test('should display WebSocket connection badge in the navbar', async ({ page }) => {
> 5  |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  6  | 
  7  |     // Check for presence of live or offline badge
  8  |     const badge = page.locator('header').getByText(/LIVE FEED|OFFLINE/i);
  9  |     await expect(badge).toBeVisible();
  10 |   });
  11 | 
  12 |   test('should render real-time notification snackbar when new tournament event fires', async ({ page }) => {
  13 |     await page.goto('/');
  14 | 
  15 |     // Evaluate client-side dispatch to test incoming notification toast rendering
  16 |     await page.evaluate(() => {
  17 |       const mockEvent = new CustomEvent('mock-ws-tournament', {
  18 |         detail: {
  19 |           id: 'test-event-1',
  20 |           tournamentName: 'Test Open Championship 2026',
  21 |           hostUniversity: 'Georgetown University',
  22 |           eventLocation: 'Yates Field House, Washington, DC',
  23 |           registrationDeadline: new Date(Date.now() + 86400000 * 5).toISOString(),
  24 |           isOpenTournament: true,
  25 |           rsvpCount: 0,
  26 |           createdAt: new Date().toISOString(),
  27 |         }
  28 |       });
  29 |       window.dispatchEvent(mockEvent);
  30 |     });
  31 | 
  32 |     // Check if notification snackbar UI elements render cleanly
  33 |     const toast = page.locator('.MuiSnackbar-root');
  34 |     await expect(toast).toBeVisible();
  35 |     // Note: If event listener is hooked to window, this verifies snackbar animation
  36 |   });
  37 | });
  38 | 
  39 | 
```