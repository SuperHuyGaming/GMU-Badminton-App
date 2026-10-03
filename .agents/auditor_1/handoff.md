# Forensic Audit & Adversarial Review Report: Phase 3 Core Backend

**Auditor**: Forensic Auditor 1 (`.agents/auditor_1`)  
**Target**: Phase 3 (Core Backend) — DMV Tournament Aggregation & Admin Approval System  
**Profile**: General Project  
**Integrity Mode**: Development Mode (from `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### Target Files Inspected
1. `server/models/ProposedTournament.js` (84 lines)
2. `server/routes/adminTournaments.js` (208 lines)
3. `server/server.js` (Lines 124–127 modified)
4. `server/utils/kafkaConsumer.js` (217 lines)
5. `server/tests/adminTournaments.test.js` (687 lines)

### Direct Observations & Verbatim Quotations

#### A. Schema Implementation (`server/models/ProposedTournament.js`)
- **Raw Scraped Data**:
  ```javascript
  // Lines 5-7
  rawCaption: { type: String, default: "" },
  scrapedImageUrls: { type: [String], default: [] },
  sourceLinks: { type: [String], default: [] },
  ```
- **AI Structured Data**:
  ```javascript
  // Lines 10-16
  tournamentName: { type: String, required: true, trim: true },
  date: { type: Date },
  location: { type: String, default: "TBD" },
  entryFee: { type: String, default: "" },
  registrationLink: { type: String, default: "" },
  skillLevels: { type: [String], default: [] },
  registrationDeadline: { type: Date },
  ```
- **Metadata & Lifecycle**:
  ```javascript
  // Lines 19-33
  sourceUrl: { type: String, required: true },
  confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
  status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  createdTournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" }
  ```
- **Compound & Single Indexes**:
  ```javascript
  // Lines 41-42
  proposedTournamentSchema.index({ status: 1, confidenceScore: -1 });
  proposedTournamentSchema.index({ sourceUrl: 1 });
  ```
- **Virtual Properties**:
  - `aiStructuredData` getter and setter (Lines 45–66)
  - `rawScrapedData` getter and setter (Lines 68–81)

#### B. Router Security & Route Handlers (`server/routes/adminTournaments.js`)
- **Global Auth & Admin Enforcement**:
  ```javascript
  // Lines 10-12
  router.use(authMiddleware);
  router.use(adminMiddleware);
  ```
- **GET `/proposed`**:
  ```javascript
  // Lines 20-22
  const proposals = await ProposedTournament.find({ status: "pending" })
      .sort({ confidenceScore: -1 });
  return res.status(200).json(proposals);
  ```
- **POST `/approve/:id` Invariant & Logic**:
  ```javascript
  // Lines 36-38: ObjectId Validation
  if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid proposed tournament ID format." });
  }

  // Lines 45-47: Idempotency Protection
  if (proposed.status === "approved") {
      return res.status(400).json({ message: "Tournament proposal is already approved." });
  }

  // Lines 53-69: Invariant Enforcement
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
      isOpenTournament: true, // CRITICAL INVARIANT
      rsvpCount: 0,
      hasSentDeadlineWarning: false,
      createdAt: new Date()
  });
  await tournament.save();
  ```
- **POST `/reject/:id`**:
  ```javascript
  // Lines 110-117
  const reason = req.body && typeof req.body.reason === "string" && req.body.reason.trim()
      ? xss(req.body.reason.trim().slice(0, 500))
      : "Rejected by admin";
  proposed.status = "rejected";
  proposed.rejectedAt = new Date();
  proposed.rejectionReason = reason;
  await proposed.save();
  ```
- **PUT `/:id`**:
  - Validates `mongoose.isValidObjectId(id)`.
  - Validates `tournamentName` is non-empty string.
  - Sanitizes strings with `xss()`.
  - Validates and clamps `confidenceScore` between 0 and 100.
  - Supports both flattened fields and nested `aiStructuredData`.

#### C. Mounting in Server (`server/server.js`)
- Git diff verification:
  ```diff
  @@ -121,6 +121,8 @@ const forumRoutes = require("./routes/forum");
   app.use("/api/forum", forumRoutes);
   const { router: profileRoutes } = require("./routes/profile");
   app.use("/api/profile", profileRoutes);
  +const adminTournamentsRoutes = require("./routes/adminTournaments");
  +app.use("/api/admin/tournaments", adminTournamentsRoutes);
   const adminRoutes = require("./routes/admin");
   app.use("/api/admin", adminRoutes);
   const announcementRoutes = require("./routes/announcements");
  ```
  Mounted prior to `/api/admin` to eliminate route shadowing risks.

#### D. Kafka Consumer (`server/utils/kafkaConsumer.js`)
- Topic: `tournament-scraping` (Line 40)
- Group ID: `gmu-tournament-scraping-group` (Line 39)
- `parseScrapedTournamentMessage`: validates payload, enforces required fields `tournamentName` and `sourceUrl`, clamps `confidenceScore`, handles nested and top-level fields.
- `handleMessage`: deserializes message and persists to `ProposedTournament` collection via Mongoose `new ProposedTournament(...)` and `.save()`.

#### E. Test & Lint Execution Results
- `npm run lint` in `server/`:
  ```
  > server@1.0.0 lint
  > eslint .
  ```
  Exit code: 0 (0 warnings, 0 errors).
- `npx jest tests/adminTournaments.test.js --verbose` in `server/`:
  ```
  Test Suites: 1 passed, 1 total
  Tests:       41 passed, 41 total
  Snapshots:   0 total
  Time:        0.998 s
  ```
  All 41 test cases passed.
- Entire server test suite (`npm test` in `server/`):
  ```
  Test Suites: 10 passed, 10 total
  Tests:       8 skipped, 156 passed, 164 total
  Snapshots:   0 total
  Time:        2.692 s
  ```
  100% of non-skipped tests passed with zero regressions.

---

## 2. Logic Chain

1. **Absence of Hardcoded Results**:
   - Inspection of `server/routes/adminTournaments.js` and `server/utils/kafkaConsumer.js` confirmed no static dummy responses, hardcoded test IDs (e.g. `650000000000000000000010`), or `process.env.NODE_ENV === 'test'` shortcut branches.
   - All responses are generated by genuine Mongoose queries (`ProposedTournament.find()`, `findById()`, `new Tournament()`, `save()`).
2. **Absence of Facades**:
   - `ProposedTournament.js` is a complete Mongoose model defining schemas, timestamps, indexes, getters, and setters.
   - `adminTournaments.js` implements real CRUD endpoints with parameter checking, MongoDB state transitions, XSS sanitization, and Socket.io event emissions.
   - `kafkaConsumer.js` implements real message extraction, error logging, and persistence logic using the `kafkajs` client.
3. **Absence of Pre-populated Artifacts**:
   - Filesystem scan of `server/` confirmed no cached test outputs, fake logs, or pre-computed results.
4. **Authentic Security & Auth Enforcement**:
   - `router.use(authMiddleware)` and `router.use(adminMiddleware)` apply to the entire router.
   - Line 17 of `server/middleware/auth.js` verifies JWT signatures via `jwt.verify(token, JWT_SECRET)`.
   - Line 32 of `server/middleware/auth.js` verifies `req.user.role === 'admin'`.
   - Automated tests directly confirmed 401 for missing/invalid tokens and 403 for non-admin tokens across all four endpoints.
5. **Critical Invariant Verification**:
   - Requirement specified `isOpenTournament: true` must be set on approval. Line 65 of `server/routes/adminTournaments.js` explicitly defines `isOpenTournament: true`. Tests 3.4 and 3.5 assert this property on the returned Tournament instance.
6. **Robustness & Edge-Case Handling**:
   - Malformed MongoDB ObjectIds are rejected with HTTP 400 via `mongoose.isValidObjectId(id)`.
   - Double-approval attempts return HTTP 400.
   - XSS injections into string fields (`tournamentName`, `location`, `reason`, etc.) are cleansed using `xss()`.
   - Clamping logic prevents out-of-bounds `confidenceScore` numbers.

---

## 3. Caveats

- **No Active Kafka Cluster in Test Environment**: The unit and integration tests exercise Kafka message parsing (`parseScrapedTournamentMessage`) and handler persistence (`handleMessage`) using in-memory and mocked buffer payloads without spinning up a live Kafka broker container. This is standard and expected for CI/CD unit testing and complies with the prompt's direction for a consumer stub.
- **No other caveats.**

---

## 4. Conclusion

The Phase 3 Core Backend deliverables fully satisfy the requirements in `ORIGINAL_REQUEST.md`, `DISPATCH.md`, and `SCOPE.md`.
- No cheating, hardcoded shortcuts, or facade implementations exist.
- Schema, authentication, database operations, and invariants are genuinely and securely implemented.
- Runtime tests (41/41 targeted, 156/156 full suite) and ESLint pass cleanly.

**Final Verdict: CLEAN**

---

## 5. Verification Method

To independently reproduce and verify this audit:

1. **Verify Linting**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm run lint
   ```
   *Expected*: Exit code 0, 0 errors.

2. **Run Targeted Tests**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npx jest tests/adminTournaments.test.js --verbose
   ```
   *Expected*: 41 tests passed across 7 describe suites.

3. **Run Full Test Suite**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
   *Expected*: All 10 test suites pass.

4. **Verify Key Invariant**:
   Inspect line 65 of `server/routes/adminTournaments.js` to confirm `isOpenTournament: true`.

5. **Invalidation Conditions**:
   The verdict is invalidated if:
   - Any hardcoded test bypass is discovered in `adminTournaments.js` or `ProposedTournament.js`.
   - Any endpoint under `/api/admin/tournaments` can be accessed by an unauthenticated user or a non-admin user.
   - An approved tournament is created with `isOpenTournament !== true`.
