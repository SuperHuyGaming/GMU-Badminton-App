import { test, expect } from '@playwright/test';
import { stubApi, signInAs, ADMIN, PLAYER } from './helpers.js';

const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test.describe('Tournament Admin & Public Flow', () => {
  test('admin can create a tournament through Manual Entry', async ({ page }) => {
    await stubApi(page);
    await signInAs(page, ADMIN);

    await page.route('**/api/admin/tournaments/proposed', (route) =>
      route.fulfill(json([
        {
          _id: 'prop-e2e-1',
          tournamentName: 'Mason Open E2E',
          eventLocation: 'RAC Gym, Fairfax, VA',
          confidenceScore: 95,
          status: 'pending',
          date: '2027-10-20T00:00:00.000Z',
          registrationLink: 'https://masonbadminton.com/register',
          skillLevels: ['Beginner', 'Intermediate'],
        },
      ]))
    );

    let manualBody = null;
    await page.route('**/api/admin/tournaments/manual', (route) => {
      manualBody = route.request().postDataJSON();
      return route.fulfill(json({
        message: 'Tournament created successfully!',
        tournament: { _id: 'tourney-manual-1', tournamentName: 'Playwright Test Open' },
      }, 201));
    });

    await page.goto('/admin/tournaments');
    await expect(page.getByText('Tournament Approvals', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /manual entry/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Create Tournament (Manual Entry)')).toBeVisible();

    await dialog.getByLabel(/tournament name/i).fill('Playwright Test Open');
    await dialog.getByLabel(/location \/ venue/i).fill('E2E Test Gym');
    await dialog.getByLabel(/registration link/i).fill('https://example.com/register');
    await dialog.getByRole('button', { name: /create tournament/i }).click();

    await expect(page.getByText('Tournament created successfully!')).toBeVisible({ timeout: 5000 });
    expect(manualBody).toMatchObject({ tournamentName: 'Playwright Test Open' });
  });

  test('non-admin is kept out of the admin approvals page', async ({ page }) => {
    await stubApi(page);
    await signInAs(page, PLAYER);
    await page.goto('/admin/tournaments');

    await expect(page).not.toHaveURL(/\/admin\/tournaments/);
    await expect(page.getByText('Tournament Approvals', { exact: true })).toHaveCount(0);
  });

  test('visitor can browse tournaments, switch to calendar, and open the detail modal', async ({ page }) => {
    await stubApi(page);
    await page.route('**/api/tournaments*', (route) =>
      route.fulfill(json({
        tournaments: [
          {
            _id: 't-e2e-1',
            tournamentName: 'DMV Collegiate Open 2027',
            hostUniversity: 'George Mason University',
            eventLocation: 'RAC Center, Fairfax, VA',
            startDate: '2027-10-15T00:00:00.000Z',
            endDate: '2027-10-16T00:00:00.000Z',
            entryFee: '$25',
            skillLevels: ['Intermediate', 'Advanced'],
            registrationUrl: 'https://example.com/register-dmv',
            flyerImageUrl: 'https://example.com/flyer.png',
            rsvpCount: 0,
            attendees: [],
            originalCaption: 'Official DMV collegiate badminton championship.',
          },
        ],
      }))
    );

    await page.goto('/tournaments');
    await expect(page.getByText('Discover DMV Tournaments')).toBeVisible();
    await expect(page.getByText('DMV Collegiate Open 2027')).toBeVisible();
    await expect(page.getByText('RAC Center, Fairfax, VA')).toBeVisible();

    const listBtn = page.getByRole('button', { name: 'List View' });
    const calBtn = page.getByRole('button', { name: 'Calendar View' });
    await calBtn.click();
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await listBtn.click();

    await page.getByRole('button', { name: /filters/i }).click();
    await expect(page.getByText('Tournament Filters')).toBeVisible();
    await page.getByRole('button', { name: 'Close filters' }).click();

    await page.getByText('DMV Collegiate Open 2027').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Official DMV collegiate badminton championship.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Register' }))
      .toHaveAttribute('href', 'https://example.com/register-dmv');
  });
});
