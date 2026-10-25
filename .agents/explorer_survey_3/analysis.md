# Phase 3 Core Backend Survey: Test Configuration, Linting, Kafka Consumer, & Git Status

**Explorer:** Explorer 3 (Phase 3 Core Backend Survey)  
**Date:** 2026-10-02  
**Target:** DMV Tournament Aggregation & Admin Approval System (`server/`)

---

## 1. Test Configuration & Baseline Status

### 1.1 Configuration & Tooling
- **Configuration File:** `server/package.json`
- **Script:** `"test": "cross-env NODE_ENV=test jest"`
- **Framework & Libraries:**
  - `jest`: `^29.7.0` (Test runner & assertion library)
  - `supertest`: `^7.3.0` (HTTP endpoint testing against Express apps)
  - `cross-env`: `^10.1.0` (Cross-platform environment variable setting)
- **Module System:** CommonJS (`"type": "commonjs"`)

### 1.2 Baseline Test Execution Results
Execution of `npm test` inside `server/`:
- **Result:** **PASSED** (Exit code: 0)
- **Test Suites:** 9 passed, 9 total
- **Tests:** 115 passed, 8 skipped, 123 total
- **Execution Time:** ~3.07 seconds
- **Suites Verified:**
  1. `tests/kafkaProducer.test.js` (6 tests passed)
  2. `tests/search.test.js` (11 tests passed)
  3. `tests/gamification.test.js` (6 tests passed)
  4. `tests/auth.test.js` (4 tests passed)
  5. `tests/matchmaking.test.js` (10 tests passed)
  6. `tests/friends.test.js` (26 tests passed)
  7. `tests/challenge_stress.test.js` (33 tests passed, 8 skipped)
  8. `tests/aiModeration.test.js` (6 tests passed)
  9. `tests/securityValidation.test.js` (13 tests passed)

### 1.3 Client Test Baseline
Execution of `npm test` inside `client/`:
- **Result:** **PASSED** (Exit code: 0)
- **Tool:** Vitest v3.2.7
- **Suites:** 12 passed, 12 total (59 passed, 18 skipped)
- **Execution Time:** ~4.80 seconds

---

## 2. Linting Configuration & Status

### 2.1 Configuration & Tooling
- **Configuration File:** `server/eslint.config.js`
- **Config Content:**
  ```javascript
  module.exports = [{}];
  ```
- **Script:** `"lint": "eslint ."`
- **Dependencies:**
  - `eslint`: `^10.11.0`
  - `@eslint/js`: `^10.0.1`

### 2.2 Baseline Lint Execution Results
Execution of `npm run lint` inside `server/`:
- **Result:** **PASSED** (Exit code: 0, 0 errors, 0 warnings).

---

## 3. Kafka Utilities & Consumer Architecture

### 3.1 Existing Kafka Utilities in `server/`
- `server/utils/kafkaProducer.js` is the primary Kafka utility in the server service.
  - Client ID: `gmu-badminton-server`
  - Broker default: `process.env.KAFKA_BROKERS || 'localhost:9092'`
  - Uses legacy partitioner: `Partitioners.LegacyPartitioner`
  - Payload sanitizer: Strips sensitive fields (`password`, `token`, `secret`, `jwt`, `pushSubscriptions`)
  - Test safety: Bypasses publishing if `NODE_ENV === 'test'` unless `ENABLE_KAFKA_TESTS` is set.
- `server/utils/kafkaConsumer.js` does **NOT** currently exist in `server/utils/`.

### 3.2 Reference Kafka Consumer (`search-service/kafkaConsumer.js`)
The `search-service` microservice contains an established consumer pattern:
- Connects using `kafkajs`.
- Configurable group ID: `process.env.KAFKA_GROUP_ID || '...'`.
- Topic subscription: `consumer.subscribe({ topic: '...', fromBeginning: true })`.
- Run loop: `consumer.run({ eachMessage: handleMessage })`.
- Graceful shutdown on `SIGINT` / `SIGTERM`.

### 3.3 Proposed `server/utils/kafkaConsumer.js` Design
Per Requirement R4:
> "In `server/utils/kafkaConsumer.js` (if it exists), add a stub case for the `tournament-scraping` topic that inserts a message into the `ProposedTournament` collection. If it doesn't exist, just document where the consumer should be added."

If implemented, `server/utils/kafkaConsumer.js` should reside in `server/utils/kafkaConsumer.js`:
```javascript
const { Kafka } = require('kafkajs');
const ProposedTournament = require('../models/ProposedTournament');

const brokers = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',').map((b) => b.trim())
  : ['localhost:9092'];

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'gmu-badminton-server-consumer',
  brokers,
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'tournament-consumer-group',
});

const handleMessage = async ({ topic, partition, message }) => {
  try {
    const rawValue = message.value ? message.value.toString() : '{}';
    const eventData = JSON.parse(rawValue);

    if (topic === 'tournament-scraping') {
      const proposal = await ProposedTournament.create({
        rawCaption: eventData.rawCaption || eventData.originalCaption || '',
        scrapedImageUrls: eventData.scrapedImageUrls || (eventData.flyerImageUrl ? [eventData.flyerImageUrl] : []),
        sourceLinks: eventData.sourceLinks || (eventData.sourceUrl ? [eventData.sourceUrl] : []),
        tournamentName: eventData.tournamentName || eventData.tournament_name || 'Untitled Tournament',
        date: eventData.date || eventData.startDate || null,
        location: eventData.location || eventData.event_location || 'TBD',
        entryFee: eventData.entryFee || 0,
        registrationLink: eventData.registrationLink || eventData.registration_url || '',
        skillLevels: eventData.skillLevels || [],
        registrationDeadline: eventData.registrationDeadline || eventData.registration_deadline || null,
        sourceUrl: eventData.sourceUrl || eventData.source_url || '',
        confidenceScore: eventData.confidenceScore !== undefined ? eventData.confidenceScore : 85,
        status: 'pending',
      });
      return proposal;
    }
  } catch (error) {
    console.error(`Error processing Kafka message on topic ${topic}:`, error);
    return null;
  }
};

const runConsumer = async () => {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_KAFKA_TESTS) {
    return;
  }
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'tournament-scraping', fromBeginning: false });
    await consumer.run({ eachMessage: handleMessage });
  } catch (error) {
    console.error('Error starting Kafka consumer:', error);
  }
};

const disconnectConsumer = async () => {
  try {
    await consumer.disconnect();
  } catch (error) {
    console.error('Error disconnecting Kafka consumer:', error);
  }
};

module.exports = {
  kafka,
  consumer,
  handleMessage,
  runConsumer,
  disconnectConsumer,
};
```

---

## 4. Git Branch & PR Workflow Status

### 4.1 Branch Verification
- **Current Active Branch:** `feature/tournament-admin-approval`
- **Branch Existence:** Verified locally.
- **Working Tree Status:** Clean source directory (`server/`, `client/`, `search-service/` have no unstaged code changes). Only metadata files in `.agents/` and `ORIGINAL_REQUEST.md` are modified.

### 4.2 GitHub CLI (`gh`) Availability
- **Default PATH:** `gh` is not in the system environment PATH.
- **Absolute Path Found:** `C:\Program Files\GitHub CLI\gh.exe`
- **Authentication Verified:**
  - Account: `SuperHuyGaming`
  - Active: `true`
  - Protocol: `https`
  - Scopes: `gist`, `read:org`, `repo`, `workflow`
- **Execution Command for PR Workflow:**
  Use `& "C:\Program Files\GitHub CLI\gh.exe"` or add `C:\Program Files\GitHub CLI` to `$env:PATH`.

### 4.3 Target Branch & PR Invariants
- Base branch: `develop`
- Head branch: `feature/tournament-admin-approval`
- Invariant rule: **Never commit or push directly to `develop` or `main`.**
- Workflow steps:
  1. Commit changes to `feature/tournament-admin-approval`
  2. Push branch: `git push -u origin feature/tournament-admin-approval`
  3. Create PR targeting `develop`:
     ```powershell
     & "C:\Program Files\GitHub CLI\gh.exe" pr create --base develop --head feature/tournament-admin-approval --title "feat(tournaments): tournament aggregation & admin approval backend" --body "..." --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"
     ```
  4. Post QA Bot comment:
     ```powershell
     & "C:\Program Files\GitHub CLI\gh.exe" pr comment <PR#> --body "🤖 **Automated QA Pipeline:** ..."
     ```
  5. Invoke `qa_engineer` subagent.

---

## 5. Blueprint for New Unit & Integration Tests

### 5.1 Test File Placement
Create `server/tests/adminTournaments.test.js` to cover the new endpoints and models.

### 5.2 Test Specifications
1. **Authentication & Authorization:**
   - Missing token -> `401 Unauthorized` (`{ message: "No token, authorization denied" }`).
   - Invalid token -> `401 Unauthorized` (`{ message: "Token is not valid" }`).
   - Non-admin user token (`role: 'user'`) -> `403 Forbidden` (`{ message: "Access denied. Admins only." }`).
   - Admin user token (`role: 'admin'`) -> `200 OK` / authorized access.
2. **`GET /api/admin/tournaments/proposed`:**
   - Returns only tournaments where `status === 'pending'`.
   - Results are sorted by `confidenceScore` in descending order.
3. **`POST /api/admin/tournaments/approve/:id`:**
   - Invalid ObjectId -> `400 Bad Request`.
   - Non-existent ID -> `404 Not Found`.
   - Success -> Creates a document in `Tournament` collection, updates `ProposedTournament.status` to `'approved'`, returns `200` with both objects.
4. **`POST /api/admin/tournaments/reject/:id`:**
   - Invalid ObjectId -> `400 Bad Request`.
   - Non-existent ID -> `404 Not Found`.
   - Success -> Updates `ProposedTournament.status` to `'rejected'`, returns `200`.
5. **`PUT /api/admin/tournaments/:id`:**
   - Invalid ObjectId -> `400 Bad Request`.
   - Non-existent ID -> `404 Not Found`.
   - Success -> Updates AI structured data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`), returns `200` with updated proposal.
6. **`ProposedTournament` Model Schema Validation:**
   - Defaults `status` to `'pending'`.
   - Rejects invalid enum values for `status` (only allows `'pending'`, `'approved'`, `'rejected'`).
   - Rejects `confidenceScore` outside the `0-100` range (min: 0, max: 100).
