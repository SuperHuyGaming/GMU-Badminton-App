import { test, expect } from '@playwright/test';
import { stubApi, signInAs, PLAYER } from './helpers.js';

test.describe('Authentication & Core Flow', () => {
  test('shows the Landing page to signed-out visitors', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Mason Badminton Connect' })).toBeVisible();
    await expect(page.getByRole('button', { name: /join the club/i })).toBeVisible();
  });

  test('sends signed-out visitors from /community to the login page', async ({ page }) => {
    await stubApi(page);
    await page.goto('/community');

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('lets a signed-in player open the Community page from the navbar', async ({ page }) => {
    await stubApi(page);
    await signInAs(page, PLAYER);
    await page.goto('/');

    // Signed-in users see the Dashboard at "/", not the Landing page.
    await expect(page.getByRole('heading', { name: 'Mason Badminton Connect' })).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Community' })
      .click();

    await expect(page).toHaveURL(/\/community$/);
    // Still signed in: the navbar no longer offers a Login link.
    await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
  });

  test('redirects the legacy /forum URL to /community', async ({ page }) => {
    await stubApi(page);
    await signInAs(page, PLAYER);
    await page.goto('/forum');

    await expect(page).toHaveURL(/\/community$/);
  });
});
