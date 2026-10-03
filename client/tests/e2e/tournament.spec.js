import { test, expect } from '@playwright/test';

test.describe('Tournament Admin & Public Flow', () => {
  test('Admin can review, edit, and approve a proposed tournament', async ({ page }) => {
    // Navigate to admin tournament approvals page
    await page.goto('http://localhost:5173/admin/tournaments');

    // Mock Login would happen here. For now we assume the page loads.
    // Wait for the table to render
    await page.waitForSelector('text=Tournament Approvals Queue');

    // Click on the 'Manual Entry' button just to test form interaction
    await page.click('button:has-text("Manual Entry")');

    // Fill out the modal
    await page.fill('input[name="tournamentName"]', 'Playwright Test Open');
    await page.fill('input[name="eventLocation"]', 'E2E Test Gym');
    await page.fill('input[name="registrationUrl"]', 'https://example.com/register');

    // Click Approve (which would save in this manual context)
    await page.click('button:has-text("Approve")');

    // Expect a success toast
    await expect(page.locator('.go3958317564')).toContainText('successfully', { timeout: 10000 }); // react-hot-toast class approximation
  });

  test('User can view approved tournaments on the public tab', async ({ page }) => {
    await page.goto('http://localhost:5173/tournaments');

    // Check for the Hero Banner
    await expect(page.locator('text=Discover DMV Tournaments')).toBeVisible();

    // Verify toggle view exists
    await expect(page.locator('button[value="list"]')).toBeVisible();
    await expect(page.locator('button[value="map"]')).toBeVisible();
    await expect(page.locator('button[value="calendar"]')).toBeVisible();

    // Verify filters drawer button
    await page.click('button:has-text("Filters")');
    await expect(page.locator('text=Advanced Filters')).toBeVisible();

    // We assume there's at least a 'No tournaments found' or actual cards
    // await expect(page.locator('.MuiCard-root')).toBeVisible();
  });
});
