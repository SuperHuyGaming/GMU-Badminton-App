import { test, expect } from '@playwright/test';
import { stubApi, signInAs, PLAYER } from './helpers.js';

const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const PLAYERS = [
  { _id: 'p-alice', name: 'Alice Nguyen', skillLevel: 'Advanced', homeUniversity: 'George Mason University' },
  { _id: 'p-bob', name: 'Bob Patel', skillLevel: 'Beginner', homeUniversity: 'George Mason University' },
];

test.describe('Matchmaking (Players page)', () => {
  /** Every /api/matchmaking/discover request URL, in order. */
  let discoverUrls;

  test.beforeEach(async ({ page }) => {
    discoverUrls = [];
    await stubApi(page);
    await signInAs(page, PLAYER);
    await page.route('**/api/matchmaking/discover*', (route) => {
      const url = new URL(route.request().url());
      discoverUrls.push(url);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const skill = url.searchParams.get('skill');
      const matches = PLAYERS.filter((p) =>
        (!search || p.name.toLowerCase().includes(search)) && (!skill || p.skillLevel === skill)
      );
      return route.fulfill(json({ matches, recommended: [] }));
    });
  });

  test('search submits the query and shows matching players', async ({ page }) => {
    await page.goto('/matchmaking');

    const search = page.getByPlaceholder('Search by name or university...');
    await search.click();
    await search.fill('alice');
    await search.press('Enter');

    await expect(page.getByText('Alice Nguyen')).toBeVisible();
    await expect(page.getByText('Bob Patel')).toHaveCount(0);
    expect(discoverUrls.some((u) => u.searchParams.get('search') === 'alice')).toBe(true);
  });

  test('skill filter chip re-queries with the skill param', async ({ page }) => {
    await page.goto('/matchmaking');
    await page.getByRole('button', { name: 'Beginner', exact: true }).click();

    await expect.poll(() => discoverUrls.at(-1)?.searchParams.get('skill')).toBe('Beginner');
  });

  test('shows the empty state and Clear Filters resets the search', async ({ page }) => {
    await page.goto('/matchmaking');
    const search = page.getByPlaceholder('Search by name or university...');
    await search.click();
    await search.fill('nobody-matches-this');
    await search.press('Enter');

    await expect(page.getByText('No players found!')).toBeVisible();
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect.poll(() => discoverUrls.at(-1)?.searchParams.get('search')).toBeNull();
  });

  // The Play Now queue toggle lives in the Advanced Filters drawer, whose button
  // is hidden on purpose (e635cc1). Add a queue test if that drawer comes back.
});
