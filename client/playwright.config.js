import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // eslint-disable-next-line no-undef
  forbidOnly: !!process.env.CI,
  // eslint-disable-next-line no-undef
  retries: process.env.CI ? 2 : 0,
  // eslint-disable-next-line no-undef
  workers: process.env.CI ? 1 : undefined,
  // eslint-disable-next-line no-undef
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      // eslint-disable-next-line no-undef
      reuseExistingServer: !process.env.CI,
      cwd: './',
    },
    {
      command: 'npm run start',
      // The API has no route at "/" (returns 404, which Playwright treats as not ready).
      url: 'http://localhost:5005/api/status',
      // eslint-disable-next-line no-undef
      reuseExistingServer: !process.env.CI,
      cwd: '../server',
    }
  ],
});
