# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: discovery.spec.ts >> Tournament Discovery Dashboard >> should filter tournaments by search query
- Location: discovery.spec.ts:30:7

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
  3  | test.describe('Tournament Discovery Dashboard', () => {
  4  |   test.beforeEach(async ({ page }) => {
> 5  |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  6  |   });
  7  | 
  8  |   test('should load the page with title and live indicators', async ({ page }) => {
  9  |     await expect(page).toHaveTitle(/Badminton Tournament Finder/i);
  10 |     await expect(page.getByText('Badminton Tournament Finder')).toBeVisible();
  11 |     await expect(page.getByText('Real-Time Collegiate Circuit Intelligence')).toBeVisible();
  12 |   });
  13 | 
  14 |   test('should display active tournaments and interactive map', async ({ page }) => {
  15 |     // Verify KPI cards
  16 |     await expect(page.getByText('Active Tournaments Loaded')).toBeVisible();
  17 |     await expect(page.getByText('Open to All Athletes')).toBeVisible();
  18 | 
  19 |     // Verify Leaflet map exists
  20 |     const map = page.locator('.leaflet-container');
  21 |     await expect(map).toBeVisible();
  22 | 
  23 |     // Verify tournament cards are rendered
  24 |     const cards = page.locator('.MuiCard-root');
  25 |     await expect(cards.first()).toBeVisible();
  26 |     const count = await cards.count();
  27 |     expect(count).toBeGreaterThan(0);
  28 |   });
  29 | 
  30 |   test('should filter tournaments by search query', async ({ page }) => {
  31 |     const searchInput = page.getByPlaceholder('Search tournaments by name or location...');
  32 |     await searchInput.fill('UMD');
  33 | 
  34 |     // Should display UMD tournament
  35 |     await expect(page.getByText('UMD Terrapin Invitational 2026')).toBeVisible();
  36 | 
  37 |     // Should not display VCU tournament
  38 |     await expect(page.getByText('VCU Open Badminton Championship 2026')).not.toBeVisible();
  39 |   });
  40 | 
  41 |   test('should filter tournaments by "Open to All Players" toggle', async ({ page }) => {
  42 |     const openSwitch = page.getByLabel('Open Tournaments Only');
  43 |     await openSwitch.check();
  44 | 
  45 |     // UMBC is Collegiate Only, so it should be filtered out
  46 |     await expect(page.getByText('UMBC Retriever Collegiate Classic')).not.toBeVisible();
  47 |   });
  48 | });
  49 | 
  50 | 
```