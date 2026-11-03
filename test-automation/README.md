# test-automation

API-level tests for the GMU Badminton server. They use Playwright's `request`
client, so no browser is involved. Browser (UI) tests live in `client/tests/e2e`.

| File | What it checks |
|---|---|
| `tests/health.spec.js` | `/api/status`, `/api/schedule/weekly`, unknown routes return 404 |
| `tests/auth-guards.spec.js` | Protected endpoints reject missing, malformed and forged tokens with 401 |
| `tests/security.spec.js` | Security headers, rate-limit headers, CORS allow/deny, preflight, login input validation |

None of these need MongoDB: every request is either DB-free or rejected
before the database is touched.

## Run locally

```bash
cd test-automation
npm install
npm test            # starts ../server on port 5099, runs the suite, stops it
```

The server's own dependencies must be installed (`cd server && npm install`).

## Smoke-test a deployed API

```bash
API_BASE_URL=https://gmu-badminton-api.onrender.com npm run test:smoke
```

In this mode no server is started. The suite only sends read-only requests or
requests the server must reject, so it is safe to run against production.
The first request may take up to a minute if the Render instance is asleep.
