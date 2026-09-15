import { test, expect } from '@playwright/test';

test.describe('Authentication & Core Flow', () => {
    test('Should display Landing page for unauthenticated users', async ({ page }) => {
        // Go to root
        await page.goto('http://localhost:5173');

        // Check if hero banner text is visible
        await expect(page.locator('text=GMU Badminton Hub')).toBeVisible();

        // Check for the "Join the Club" CTA button
        await expect(page.getByRole('button', { name: /join the club/i })).toBeVisible();
    });

    test('Should display Forum after bypassing auth', async ({ page, context }) => {
        // Mock the user auth state by setting a fake token in localStorage
        await page.goto('http://localhost:5173');
        await page.evaluate(() => {
            localStorage.setItem('user', JSON.stringify({ id: 'test', name: 'Playwright Tester' }));
            localStorage.setItem('accessToken', 'fake-token');
        });
        
        // Reload to let React pick up the token
        await page.reload();

        // Ensure user lands on Dashboard
        await expect(page).toHaveURL(/.*\/dashboard/);

        // Click the Forum tab
        await page.getByRole('link', { name: /forum/i }).click();

        // Ensure the forum header is visible
        await expect(page.getByText('Discussion Board')).toBeVisible();
    });
});
