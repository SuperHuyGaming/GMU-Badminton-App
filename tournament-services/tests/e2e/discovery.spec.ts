import { test, expect } from '@playwright/test';

test.describe('Tournament Discovery Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the page with title and live indicators', async ({ page }) => {
    await expect(page).toHaveTitle(/Badminton Tournament Finder/i);
    await expect(page.getByText('Badminton Tournament Finder')).toBeVisible();
    await expect(page.getByText('Real-Time Collegiate Circuit Intelligence')).toBeVisible();
  });

  test('should display active tournaments and interactive map', async ({ page }) => {
    // Verify KPI cards
    await expect(page.getByText('Active Tournaments Loaded')).toBeVisible();
    await expect(page.getByText('Open to All Athletes')).toBeVisible();

    // Verify Leaflet map exists
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible();

    // Verify tournament cards are rendered
    const cards = page.locator('.MuiCard-root');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter tournaments by search query', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search tournaments by name or location...');
    await searchInput.fill('UMD');

    // Should display UMD tournament
    await expect(page.getByText('UMD Terrapin Invitational 2026')).toBeVisible();

    // Should not display VCU tournament
    await expect(page.getByText('VCU Open Badminton Championship 2026')).not.toBeVisible();
  });

  test('should filter tournaments by "Open to All Players" toggle', async ({ page }) => {
    const openSwitch = page.getByLabel('Open Tournaments Only');
    await openSwitch.check();

    // UMBC is Collegiate Only, so it should be filtered out
    await expect(page.getByText('UMBC Retriever Collegiate Classic')).not.toBeVisible();
  });
});

