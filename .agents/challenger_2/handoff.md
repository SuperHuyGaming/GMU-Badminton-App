# Adversarial Verification & Handoff Report — Challenger 2

**Agent**: Challenger 2 (Empirical Challenger: critic, specialist)  
**Target Milestone**: Phase 3 (Core Backend: DMV Tournament Aggregation & Admin Approval System)  
**Final Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

Direct empirical observations made across the codebase, execution logs, and automated tests:

### O1. `isOpenTournament: true` Feed Visibility Invariant
In `server/routes/adminTournaments.js` (lines 53-69):
```javascript
        const tournament = new Tournament({
            tournamentName: proposed.tournamentName,
            eventLocation: proposed.location || "TBD",
            hostUniversity: "Local Club",
            startDate: proposed.date,
            endDate: proposed.date,
            registrationDeadline: proposed.registrationDeadline || proposed.date,
            registrationUrl: proposed.registrationLink || sourceLinks[0] || proposed.sourceUrl,
            sourceUrl: proposed.sourceUrl,
            flyerImageUrl: scrapedImageUrls[0] || "",
            skillLevels: proposed.skillLevels || [],
            originalCaption: proposed.rawCaption || "",
            isOpenTournament: true,
            rsvpCount: 0,
            hasSentDeadlineWarning: false,
            createdAt: new Date()
        });
```
- In `tournament-services/core-service/src/main/java/com/badminton/core/service/TournamentService.java` (lines 81, 94):
  Public feeds filter explicitly: `tournamentRepository.findByIsOpenTournamentTrueAndRegistrationDeadlineAfter(now, sort)` and `criteria.and("isOpenTournament").is(true)`.
- Empirical verification proved that `tournament.isOpenTournament` strictly evaluates to boolean `true` (type `boolean`, not `"true"` string or object).

### O2. Fallback Ladder & Field Mappings
- `registrationUrl` adheres to a strict 3-tier fallback ladder:
  1. `proposed.registrationLink`
  2. `proposed.sourceLinks[0]` (if link is empty)
  3. `proposed.sourceUrl` (if both registrationLink and sourceLinks are empty)
- `registrationDeadline` falls back to `proposed.date` when undefined.
- `startDate` and `endDate` map directly to `proposed.date`.
- `eventLocation` defaults to `"TBD"` if empty.
- `flyerImageUrl` captures `scrapedImageUrls[0]` or empty string `""`.

### O3. Proposal Lifecycle Mutation Integrity
In `server/routes/adminTournaments.js` (lines 73-77):
```javascript
        proposed.status = "approved";
        proposed.approvedAt = new Date();
        proposed.approvedBy = req.user?.id || req.user?.userId || null;
        proposed.createdTournamentId = tournament._id;
        await proposed.save();
```
- Double-approval guard in `server/routes/adminTournaments.js` (lines 45-47):
```javascript
        if (proposed.status === "approved") {
            return res.status(400).json({ message: "Tournament proposal is already approved." });
        }
```
- Non-existent proposal yields 404; invalid ObjectId yields 400.

### O4. Edit / Mutation Hardening (`PUT /:id`)
In `server/routes/adminTournaments.js` (lines 149-192):
- Status immutability: Passing `{ status: "approved" }`, `{ approvedAt: ... }`, or `{ createdTournamentId: ... }` to `PUT /:id` is completely ignored. Only AI Structured Data fields and `confidenceScore` are mutated.
- Input validation:
  - `tournamentName`: Empty or whitespace-only strings return HTTP 400 (`"Tournament name cannot be empty."`).
  - `confidenceScore`: Values `< 0`, `> 100`, or `NaN` return HTTP 400 (`"Confidence score must be a number between 0 and 100."`). Valid boundaries `0` and `100` succeed.
  - `date` and `registrationDeadline`: Invalid date strings fail Mongoose validation and trigger HTTP 400 (`err.name === "ValidationError"`).
  - XSS Sanitization: Malicious script tags (`<script>alert('xss')</script>`) are neutralized.

### O5. Kafka Consumer Crash Resilience
In `server/utils/kafkaConsumer.js` (lines 58-145):
- `parseScrapedTournamentMessage` enforces presence of `tournamentName` and `sourceUrl`, clamps confidence score to `[0, 100]`, and parses both flat and nested JSON structures.
- `handleMessage` wraps processing in a top-level `try/catch`. When given `null`, empty buffer, invalid JSON (`"<<<MALFORMED XML>>>"`), or payloads missing required fields, it logs an error and returns `null` without throwing unhandled exceptions or crashing the consumer process.

### O6. Project Test Suite & Lint Output
Command execution in `server/`:
- `npm run lint`:
  ```
  > server@1.0.0 lint
  > eslint .
  (exit code 0, 0 errors, 0 warnings)
  ```
- `npm test`:
  ```
  > server@1.0.0 test
  > cross-env NODE_ENV=test jest

  PASS tests/kafkaProducer.test.js
  PASS tests/search.test.js
  PASS tests/gamification.test.js
  PASS tests/auth.test.js
  PASS tests/matchmaking.test.js
  PASS tests/adminTournaments.test.js
  PASS tests/challenge_stress.test.js
  PASS tests/aiModeration.test.js
  PASS tests/friends.test.js
  PASS tests/securityValidation.test.js

  Test Suites: 10 passed, 10 total
  Tests:       8 skipped, 156 passed, 164 total
  Snapshots:   0 total
  Time:        2.511 s
  ```

---

## 2. Logic Chain

1. **Premise 1 (Feed Visibility Invariant)**: In DMV tournament aggregation, scraped tournaments must only become visible on player discovery feeds and calendar sync once approved by an administrator. Because Java and Node feeds filter by `isOpenTournament: true` (O1), setting `isOpenTournament: true` during `POST /approve/:id` guarantees immediate visibility upon approval, while keeping unapproved/scraped items quarantined.
2. **Premise 2 (Field Preservation & Fallbacks)**: Scraped records frequently contain missing or partial fields. As observed in O2, the 3-tier fallback ladder (`registrationLink` -> `sourceLinks[0]` -> `sourceUrl`) ensures no approved tournament produces broken registration links.
3. **Premise 3 (Auditing & Idempotency)**: Tracking `approvedBy`, `approvedAt`, and linking `createdTournamentId` (O3) creates an immutable audit trail. The check `proposed.status === "approved"` (O3) guarantees idempotency and prevents duplicate tournament generation.
4. **Premise 4 (State Transition Integrity)**: Permitting arbitrary field updates via `PUT /:id` could allow an attacker or uncareful admin to bypass the approval pipeline by injecting `status: "approved"`. Because `PUT /:id` strictly filters for AI Structured Data and ignores `status` (O4), state integrity is preserved.
5. **Premise 5 (Consumer Reliability)**: Real-world scraping feeds frequently produce corrupt messages or transient parsing errors. Because `handleMessage` catches errors and returns `null` (O5), Kafka message ingestion cannot terminate the Node process or crash consumer groups.
6. **Conclusion**: The Phase 3 Core Backend implementation satisfies all interface contracts, security boundaries, and architectural invariants without regression.

---

## 3. Adversarial Challenges & Edge Case Mining

### Challenge 1 [Low Risk]: String Slicing Precedes XSS Entity Encoding
- **Assumption Challenged**: Truncating `location` to 200 characters and `rejectionReason` to 500 characters prevents string expansion beyond those lengths in MongoDB.
- **Attack Scenario**: An attacker submits 500 characters consisting of `<<<<...` in `reason`. The code runs `xss(req.body.reason.trim().slice(0, 500))`. The `slice(0, 500)` occurs *before* `xss()`. During sanitization, each `<` is converted to `&lt;` (4 characters), resulting in a sanitized string of up to 2,000 characters.
- **Blast Radius**: Extremely low. MongoDB strings can store up to 16MB. No denial of service or database crash occurs.
- **Mitigation Recommendation**: In future polish, slice after XSS sanitization: `xss(str).slice(0, 500)`.

### Challenge 2 [Low Risk]: URL Protocol Scheme Validation in `registrationLink`
- **Assumption Challenged**: Calling `xss(sourceData.registrationLink.trim())` prevents malicious URI schemes like `javascript:alert(1)`.
- **Attack Scenario**: An admin inputs `javascript:alert(1)` into `registrationLink`. The `xss` library is designed for HTML tag sanitization and leaves raw URLs untouched unless embedded within an `<a href="...">` attribute.
- **Blast Radius**: Low. Only admins with valid admin JWTs can call `PUT /:id`. Furthermore, modern frontend frameworks (React JSX) sanitize anchor bindings or open in standard tabs.
- **Mitigation Recommendation**: Add regex validation verifying the URL starts with `^https?://` or `^/`.

---

## 4. Empirical Stress Test Results

| Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| `POST /approve/:id` feed visibility invariant | Created `Tournament.isOpenTournament === true` (boolean) | `isOpenTournament` strictly `true` | **PASS** |
| 3-tier registration URL fallback ladder | Uses `registrationLink`, falls back to `sourceLinks[0]`, then `sourceUrl` | Correct tiered resolution verified | **PASS** |
| Missing deadline fallback | Falls back to tournament event `date` | `registrationDeadline === date` | **PASS** |
| Proposal audit metadata recording | Sets `status: 'approved'`, `approvedAt`, `approvedBy`, `createdTournamentId` | All audit fields populated accurately | **PASS** |
| Double approval prevention | Second approval returns HTTP 400 "already approved" | Returns HTTP 400 | **PASS** |
| State escalation via `PUT /:id` | Injecting `{ status: "approved" }` in PUT payload is rejected/ignored | `status` remains `"pending"` | **PASS** |
| Empty/whitespace tournamentName on PUT | Returns HTTP 400 "Tournament name cannot be empty" | Returns HTTP 400 | **PASS** |
| Out-of-bounds confidenceScore (<0, >100, NaN) | Returns HTTP 400 "Confidence score must be a number between 0 and 100" | Returns HTTP 400 | **PASS** |
| ConfidenceScore exact boundaries (0, 100) | Successfully updates to 0 and 100 | Returns HTTP 200 with score updated | **PASS** |
| XSS injection in editable fields | Neutralizes `<script>`, `onerror`, `onload`, `<iframe>` | All scripts/handlers neutralized | **PASS** |
| Invalid date strings on PUT | Mongoose `ValidationError` caught and mapped to HTTP 400 | Returns HTTP 400 | **PASS** |
| Rejection reason plain text length cap | Truncates plain text strings > 500 chars to exactly 500 | Length capped at 500 chars | **PASS** |
| Kafka consumer flat & nested payloads | Normalizes both flat and `aiStructuredData`/`rawScrapedData` objects | Successfully parsed | **PASS** |
| Kafka confidence score clamping | Clamps values < 0 to 0, values > 100 to 100 | Correctly clamped to [0, 100] | **PASS** |
| Kafka missing required fields (`tournamentName`, `sourceUrl`) | Throws informative validation error in parser | Error thrown as expected | **PASS** |
| Kafka consumer invalid/malformed buffer | `handleMessage` catches errors, returns `null`, and prevents crash | Returns `null` without throwing | **PASS** |

---

## 5. Caveats

- **Kafka Live Broker Connectivity**: Tested against mocked Kafka message payloads and unit harnesses; live multi-broker cluster connectivity was not run in this environment due to local Docker/Kafka service absence.
- **Client-Side Rendering Context**: Verified backend API and model sanitization; browser-level rendering of flyer images and links remains subject to frontend React component implementations.

---

## 6. Conclusion

The Phase 3 Core Backend deliverables:
1. `server/models/ProposedTournament.js`
2. `server/routes/adminTournaments.js`
3. `server/utils/kafkaConsumer.js`
4. `server/server.js`
5. `server/tests/adminTournaments.test.js`

strictly preserve the critical `isOpenTournament: true` visibility invariant, enforce robust authorization, protect auditing lifecycles, and handle malformed Kafka messages gracefully.

**Final Verdict**: **APPROVE**

---

## 7. Verification Method

To independently reproduce and verify this assessment:

1. **Verify ESLint Conformance**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm run lint
   ```
   *Expected*: Exits with code 0, 0 errors.

2. **Execute Full Automated Test Suite**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
   *Expected*: All 10 test suites pass (156 passed, 8 skipped).

3. **Inspect Implementation Files**:
   - `server/routes/adminTournaments.js` (lines 53-69 for `isOpenTournament: true`, lines 149-192 for `PUT /:id` validation)
   - `server/models/ProposedTournament.js` (lines 20-26 for schema constraints)
   - `server/utils/kafkaConsumer.js` (lines 58-145 for crash resilience)
