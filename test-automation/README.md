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

## Two-bot end-to-end run (`two-bots/`)

Two real users, **Bot Alice** (desktop 1366×768) and **Bot Bob** (phone 390×844),
sign up through the real Sign Up and onboarding screens, then use the app against
a full local stack: an in-memory MongoDB, the real API on port 5199 and the Vite
client on port 5175. Nothing touches the live site; the bots' browsers block every
non-localhost request.

```bash
cd test-automation
npm install          # first time only
npm run twobots      # ~7 minutes; starts everything, runs the bots, shuts down
```

It checks, with each step marked PASS or FAIL:
- **Posts:** posting, with live updates on the other screen.
- **Interactions:** comments, reactions, save, RSVP, edit, delete and report.
- **Phone layout:** long words don't widen the phone screen.
- **Privacy:** friends-only and Only-Me posts.
- **Friends:** friend request and accept.
- **Messages:** back-and-forth chat, with order, duplicates, the unread badge, the typing indicator and the phone input not being covered.
- **Clean run:** no console errors and no failed requests.

Results go to `two-bots/results.json`, screenshots for every step to
`two-bots/shots/`, and server, database and web logs to `two-bots/logs/`. The
exit code is 0 when everything passes and 2 when some steps fail.

Options (environment variables):
- `HEADED=1` shows the two browsers.
- `LIVE_MS=10000` sets how long to wait for live updates.
- `REAL_KAFKA=1` uses the real kafkajs library. The server skips Kafka when
  `KAFKA_BROKERS` is unset; without this flag kafkajs is replaced by a stub.
- `MONGOMS_VERSION=x.y.z` picks the MongoDB version.
- `node two-bots/run-all.cjs --serve` keeps the stack running for manual
  testing. Stop it with Ctrl+C, and run `node two-bots/twobots.cjs` to re-run
  just the bots.

The first run downloads a MongoDB binary (about 100 MB) into the
mongodb-memory-server cache.
