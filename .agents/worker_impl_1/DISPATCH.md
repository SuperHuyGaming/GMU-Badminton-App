# Dispatch: Worker 1 — Phase 3 Core Backend Implementation

## Mandatory Reading
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md` (MUST read first)
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_3\SCOPE.md` (Architecture, Contracts, Schema Specs)
- Explorer reports:
  - `D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_1\handoff.md` (Models & Mappings)
  - `D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_2\handoff.md` (Routes & Security)
  - `D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_3\handoff.md` (Tests & Environment)

## Write Ownership
You exclusively own and may create/modify:
- `server/models/ProposedTournament.js`
- `server/routes/adminTournaments.js`
- `server/server.js` (mount `/api/admin/tournaments` directly before `/api/admin`)
- `server/utils/kafkaConsumer.js` (stub consumer for `tournament-scraping`)
- `server/tests/adminTournaments.test.js` (comprehensive test suite)

Do NOT modify any files outside these boundaries.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Requirements to Implement
1. **R1: ProposedTournament Model (`server/models/ProposedTournament.js`)**:
   - Raw Scraped Data: `rawCaption` (String), `scrapedImageUrls` ([String]), `sourceLinks` ([String])
   - AI Structured Data: `tournamentName` (String, required, trimmed), `date` (Date), `location` (String, default "TBD"), `entryFee` (String), `registrationLink` (String), `skillLevels` ([String]), `registrationDeadline` (Date)
   - Metadata: `sourceUrl` (String, required), `confidenceScore` (Number, min: 0, max: 100, default: 0), `status` (enum: ['pending', 'approved', 'rejected'], default 'pending', index: true)
   - Lifecycle & Audit: `approvedAt` (Date), `approvedBy` (ObjectId ref 'User'), `rejectedAt` (Date), `rejectionReason` (String), `createdTournamentId` (ObjectId ref 'Tournament')
   - Compound index: `{ status: 1, confidenceScore: -1 }`
   - Virtuals or getters for `aiStructuredData` and `rawScrapedData` so accessing or updating nested or flat fields works cleanly.

2. **R2 & R3: Admin API Routes & Protection (`server/routes/adminTournaments.js` and `server/server.js`)**:
   - Enforce security at top of router:
     ```javascript
     const { authMiddleware, adminMiddleware } = require("../middleware/auth");
     router.use(authMiddleware);
     router.use(adminMiddleware);
     ```
   - `GET /proposed`: Returns all `status: 'pending'` ProposedTournaments sorted by `confidenceScore` descending (`{ confidenceScore: -1 }`).
   - `POST /approve/:id`:
     - Validate `mongoose.isValidObjectId(req.params.id)` (return 400 if invalid).
     - Find proposal. Return 404 if not found.
     - Check if already approved (`if (proposed.status === 'approved') return res.status(400).json({ message: "Tournament proposal is already approved" });`).
     - Create and save new `Tournament` document in `tournaments` collection using existing `Tournament.js` model.
     - **CRITICAL INVARIANT**: Set `isOpenTournament: true` on the new `Tournament` document so it renders in Java service and frontend feeds!
     - Map fields properly:
       `tournamentName`: `proposed.tournamentName`
       `eventLocation`: `proposed.location || "TBD"`
       `hostUniversity`: `"Local Club"`
       `startDate`: `proposed.date`
       `endDate`: `proposed.date`
       `registrationDeadline`: `proposed.registrationDeadline || proposed.date`
       `registrationUrl`: `proposed.registrationLink || proposed.sourceLinks[0] || proposed.sourceUrl`
       `sourceUrl`: `proposed.sourceUrl`
       `flyerImageUrl`: `proposed.scrapedImageUrls[0] || ""`
       `skillLevels`: `proposed.skillLevels || []`
       `originalCaption`: `proposed.rawCaption || ""`
       `isOpenTournament`: `true`
       `rsvpCount`: `0`
       `createdAt`: `new Date()`
     - Update proposal: `status = 'approved'`, `approvedAt = new Date()`, `approvedBy = req.user.id || req.user.userId`, `createdTournamentId = tournament._id`. Save proposal.
     - If `req.io`, emit `tournamentApproved` event with the new tournament.
     - Return 200 with `{ message: "Tournament approved and published successfully", tournament, proposedTournament: proposed }`.
   - `POST /reject/:id`:
     - Validate ObjectId (400 if invalid).
     - Find proposal (404 if not found).
     - Update: `status = 'rejected'`, `rejectedAt = new Date()`, `rejectionReason = req.body.reason || "Rejected by admin"`.
     - Save proposal and return 200 with `{ message: "Tournament proposal rejected", proposedTournament: proposed }`.
   - `PUT /:id`:
     - Validate ObjectId (400 if invalid).
     - Find proposal (404 if not found).
     - Update AI Structured Data fields (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`, `confidenceScore`) with sanitization.
     - Save and return 200 with `{ message: "Tournament proposal updated successfully", proposedTournament: proposed }`.
   - In `server/server.js`:
     Mount `server/routes/adminTournaments.js` at `/api/admin/tournaments` directly before `app.use("/api/admin", adminRoutes)`.

3. **R4: Kafka Consumer Stub (`server/utils/kafkaConsumer.js`)**:
   - Create `server/utils/kafkaConsumer.js` as a cleanly structured Kafka consumer stub using `kafkajs`.
   - Subscribes to topic `tournament-scraping`.
   - Consumer group `gmu-tournament-scraping-group`.
   - In the message handler, parses message and creates/saves a new `ProposedTournament` document.
   - Includes graceful error handling, connection setup, and exportable start/stop functions.
   - Comprehensive docstrings explaining architecture, schema, and deployment.

4. **R5: Testing & Verification (`server/tests/adminTournaments.test.js`)**:
   - Implement comprehensive tests covering:
     - Unauthenticated requests return 401 (`authMiddleware`).
     - Non-admin user tokens return 403 (`adminMiddleware`).
     - Admin token on `GET /api/admin/tournaments/proposed` returns 200 and pending tournaments ordered by confidenceScore descending.
     - Invalid ObjectId returns 400.
     - Non-existent ID returns 404.
     - `POST /api/admin/tournaments/approve/:id` creates `Tournament` with `isOpenTournament: true` and marks proposal `approved`.
     - Re-approving already approved proposal returns 400.
     - `POST /api/admin/tournaments/reject/:id` marks proposal `rejected`.
     - `PUT /api/admin/tournaments/:id` updates AI structured fields.
     - ProposedTournament schema validations (confidenceScore min/max, status enum).
     - Kafka consumer stub parsing test (if testable or mocked).
   - Run verification in `server/`:
     - `npm test` -> ALL test suites must pass (100% green).
     - `npm run lint` -> 0 errors.

## Deliverable
Write your implementation report to `.agents/worker_impl_1/handoff.md` and send a completion message to parent.

## 2026-10-02T23:46:35Z
You are the Backend Implementation Worker for Phase 3 (Core Backend).
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_impl_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md before starting work.
Read your full dispatch instructions in D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_impl_1\DISPATCH.md.
Also read D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_3\SCOPE.md.

Scope of work:
1. Implement `server/models/ProposedTournament.js` according to specifications in SCOPE.md and DISPATCH.md.
2. Implement `server/routes/adminTournaments.js` and mount it in `server/server.js` at `/api/admin/tournaments` (before `/api/admin`). Ensure all routes are protected with `authMiddleware` and `adminMiddleware`.
3. In `POST /approve/:id`, ensure you set `isOpenTournament: true` when creating the `Tournament` entry so it renders in public feeds! Also properly transition `ProposedTournament` status to 'approved' and store `createdTournamentId`.
4. In `server/utils/kafkaConsumer.js`, implement the stub consumer for the `tournament-scraping` topic that inserts incoming messages into `ProposedTournament`, with robust architecture and documentation.
5. Create comprehensive tests in `server/tests/adminTournaments.test.js`.
6. Run `npm test` and `npm run lint` inside the `server/` directory and ensure 100% pass and 0 lint errors.
7. Write your detailed handoff report to D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_impl_1\handoff.md and send a completion message to parent.

