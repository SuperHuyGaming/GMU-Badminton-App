// API-level test automation for the GMU Badminton server.
//
// Local (default):  starts ../server on port 5099 and tests it. No database needed.
// Smoke (deployed): API_BASE_URL=https://gmu-badminton-api.onrender.com npm run test:smoke
//                   Only sends read-only requests or requests the server must reject.
const { defineConfig } = require('@playwright/test');

const LOCAL_PORT = 5099;
const remote = process.env.API_BASE_URL;
const baseURL = (remote || `http://localhost:${LOCAL_PORT}`).replace(/\/+$/, '');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A sleeping Render instance can take ~60s to wake on the first request.
  timeout: remote ? 90_000 : 30_000,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  metadata: { target: remote ? 'remote' : 'local', baseURL },
  webServer: remote
    ? undefined
    : {
        command: 'node server.js',
        cwd: '../server',
        // "/" has no route (404), so wait on a DB-free endpoint instead.
        url: `${baseURL}/api/status`,
        env: { PORT: String(LOCAL_PORT), NODE_ENV: 'development' },
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
