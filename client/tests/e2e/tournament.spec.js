import { test, expect } from '@playwright/test';

test.describe('Tournament Admin & Public Flow', () => {
  test('Admin can review, edit, and approve a proposed tournament', async ({ page }) => {
    // Mock Admin API endpoints
    await page.route('**/api/admin/tournaments/proposed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'prop-e2e-1',
            tournamentName: 'Mason Open E2E',
            eventLocation: 'RAC Gym, Fairfax, VA',
            confidenceScore: 95,
            status: 'pending',
            date: '2027-10-20T00:00:00.000Z',
            registrationLink: 'https://masonbadminton.com/register',
            skillLevels: ['Beginner', 'Intermediate']
          }
        ])
      });
    });

    await page.route('**/api/admin/tournaments/manual', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Tournament created successfully',
          tournament: {
            _id: 'tourney-manual-1',
            tournamentName: 'Playwright Test Open',
            eventLocation: 'E2E Test Gym',
            isOpenTournament: true
          }
        })
      });
    });

    // Navigate to admin tournament approvals page
    await page.goto('/admin/tournaments');

    // Wait for the admin page to render
    await expect(page.locator('text=Tournament Approvals Queue')).toBeVisible({ timeout: 10000 });

    // Click on the 'Manual Entry' button to open manual submission dialog
    const manualBtn = page.locator('button:has-text("Manual Entry")');
    await expect(manualBtn).toBeVisible();
    await manualBtn.click();

    // Fill out the modal fields
    await page.fill('input[name="tournamentName"]', 'Playwright Test Open');
    await page.fill('input[name="eventLocation"]', 'E2E Test Gym');
    await page.fill('input[name="registrationUrl"]', 'https://example.com/register');

    // Click Approve / Submit button
    await page.click('button:has-text("Approve")');

    // Expect toast notification
    await expect(page.locator('text=Tournament created successfully')).toBeVisible({ timeout: 5000 });
  });

  test('User can view approved tournaments, switch to calendar, and open detail modal', async ({ page }) => {
    // Mock Public Tournaments API
    await page.route('**/api/tournaments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
              rsvpCount: 4,
              attendees: [],
              originalCaption: 'Official DMV collegiate badminton championship.'
            }
          ]
        })
      });
    });

    await page.goto('/tournaments');

    // Verify Hero Banner
    await expect(page.locator('text=Discover DMV Tournaments')).toBeVisible();

    // Verify tournament card is rendered in List View
    await expect(page.locator('text=DMV Collegiate Open 2027')).toBeVisible();
    await expect(page.locator('text=RAC Center, Fairfax, VA')).toBeVisible();

    // Verify view mode switcher exists and toggle to Calendar View
    const listBtn = page.locator('button[aria-label="List View"]');
    const calBtn = page.locator('button[aria-label="Calendar View"]');
    await expect(listBtn).toBeVisible();
    await expect(calBtn).toBeVisible();

    await calBtn.click();

    // Verify calendar view header with Today button and navigation
    await expect(page.locator('button:has-text("Today")')).toBeVisible();

    // Switch back to List View
    await listBtn.click();

    // Verify filters drawer button
    const filterBtn = page.locator('button:has-text("Filters")');
    await filterBtn.click();
    await expect(page.locator('text=Tournament Filters')).toBeVisible();

    // Close filters drawer
    await page.locator('button[aria-label="Close filters"]').click();

    // Click card to open Detail Modal
    await page.locator('text=DMV Collegiate Open 2027').click();
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('text=Official DMV collegiate badminton championship.')).toBeVisible();
    await expect(page.locator('a:has-text("Register Online")')).toBeVisible();
  });
});
