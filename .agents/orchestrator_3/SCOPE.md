# Scope: Phase 3 Core Backend (DMV Tournament Aggregation & Admin Approval System)

## Architecture & Integration
- **Components**:
  1. `server/models/ProposedTournament.js`: Mongoose model separating raw/scraped and AI-extracted tournament proposals from the production `tournaments` collection.
  2. `server/routes/adminTournaments.js`: Protected Express router implementing administrative triage endpoints (`GET /proposed`, `POST /approve/:id`, `POST /reject/:id`, `PUT /:id`).
  3. `server/server.js`: Mount point registering `adminTournaments.js` under `/api/admin/tournaments` prior to `/api/admin`.
  4. `server/middleware/auth.js`: Existing `authMiddleware` and `adminMiddleware` enforcing authentication and admin role (`req.user.role === 'admin'`).
  5. `server/utils/kafkaConsumer.js`: Kafka consumer stub handling `tournament-scraping` topic messages and persisting to `ProposedTournament`.
  6. `server/tests/adminTournaments.test.js`: Comprehensive automated test suite exercising model validation, authentication/authorization (401/403/200), sorting, and CRUD state transitions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | ProposedTournament Model | Mongoose schema with Raw Scraped Data, AI Structured Data, and Metadata | M1 | R1 |
| F2 | Admin Auth & Security | router.use(authMiddleware, adminMiddleware) enforcing admin role | M2 | R3 |
| F3 | GET /proposed Route | Retrieve all pending proposals sorted by confidenceScore descending | M2 | R2 |
| F4 | POST /approve/:id Route | Create Tournament entry (with isOpenTournament: true) and mark proposal approved | M2 | R2 |
| F5 | POST /reject/:id Route | Mark proposal rejected with validation | M2 | R2 |
| F6 | PUT /:id Route | Edit AI Structured Data prior to approval | M2 | R2 |
| F7 | Server Mount | Register /api/admin/tournaments in server/server.js | M2 | R2 |
| F8 | Kafka Consumer Stub | Implement/document tournament-scraping consumer inserting into ProposedTournament | M3 | R4 |
| F9 | Test Suite & Validation | Unit & integration tests for model and routes; lint & test passing | M4 | R5 |
| F10 | PR & QA Pipeline | Feature branch commit, PR targeting develop, QA bot comment, QA subagent | M5 | R5 |

## Interface Contracts & Schemas

### ProposedTournament Schema (`server/models/ProposedTournament.js`)
- **Raw Scraped Data**:
  - `rawCaption`: String
  - `scrapedImageUrls`: [String]
  - `sourceLinks`: [String]
- **AI Structured Data**:
  - `tournamentName`: { type: String, required: true, trim: true }
  - `date`: Date
  - `location`: { type: String, default: "TBD" }
  - `entryFee`: String
  - `registrationLink`: String
  - `skillLevels`: [String]
  - `registrationDeadline`: Date
- **Metadata**:
  - `sourceUrl`: { type: String, required: true }
  - `confidenceScore`: { type: Number, min: 0, max: 100, default: 0 }
  - `status`: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }
- **Lifecycle & Auditing**:
  - `approvedAt`: Date
  - `approvedBy`: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  - `rejectedAt`: Date
  - `rejectionReason`: String
  - `createdTournamentId`: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }
- **Indexes**:
  - Compound index: `{ status: 1, confidenceScore: -1 }`
  - Single index: `{ sourceUrl: 1 }`
- **Virtuals**:
  - `aiStructuredData`: Get/set { tournamentName, date, location, entryFee, registrationLink, skillLevels, registrationDeadline }
  - `rawScrapedData`: Get/set { rawCaption, scrapedImageUrls, sourceLinks }

### Admin API Contract (`/api/admin/tournaments`)
All routes protected by `authMiddleware` AND `adminMiddleware`.
- **GET /proposed**:
  - Query: `{ status: 'pending' }`
  - Sort: `{ confidenceScore: -1 }`
  - Response 200: Array of ProposedTournament objects.
- **POST /approve/:id**:
  - Validates `mongoose.isValidObjectId(req.params.id)`. Returns 400 if invalid.
  - Finds proposed tournament. If not found, returns 404.
  - If `proposed.status === 'approved'`, returns 400 (Already approved).
  - Instantiates `Tournament` with:
    - `tournamentName`: `proposed.tournamentName`
    - `eventLocation`: `proposed.location || "TBD"`
    - `hostUniversity`: `"Local Club"`
    - `startDate`: `proposed.date`
    - `endDate`: `proposed.date`
    - `registrationDeadline`: `proposed.registrationDeadline || proposed.date`
    - `registrationUrl`: `proposed.registrationLink || proposed.sourceLinks[0] || proposed.sourceUrl`
    - `sourceUrl`: `proposed.sourceUrl`
    - `flyerImageUrl`: `proposed.scrapedImageUrls[0] || ""`
    - `skillLevels`: `proposed.skillLevels || []`
    - `originalCaption`: `proposed.rawCaption || ""`
    - `isOpenTournament`: `true` (CRITICAL INVARIANT)
    - `rsvpCount`: 0
    - `hasSentDeadlineWarning`: false
    - `createdAt`: `new Date()`
  - Saves new `Tournament`.
  - Updates `proposed.status = 'approved'`, `proposed.approvedAt = new Date()`, `proposed.approvedBy = req.user.id || req.user.userId`, `proposed.createdTournamentId = tournament._id`.
  - Saves `proposed`.
  - If `req.io`, emits `tournamentApproved`.
  - Response 200: `{ message: "Tournament approved and published successfully", tournament, proposedTournament: proposed }`.
- **POST /reject/:id**:
  - Validates `mongoose.isValidObjectId(req.params.id)`. Returns 400 if invalid.
  - Finds proposed tournament. Returns 404 if not found.
  - Updates `proposed.status = 'rejected'`, `proposed.rejectedAt = new Date()`, `proposed.rejectionReason = req.body.reason || "Rejected by admin"`.
  - Saves `proposed`.
  - Response 200: `{ message: "Tournament proposal rejected", proposedTournament: proposed }`.
- **PUT /:id**:
  - Validates `mongoose.isValidObjectId(req.params.id)`. Returns 400 if invalid.
  - Finds proposed tournament. Returns 404 if not found.
  - Updates AI structured fields (sanitizing strings): `tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`. Also supports `confidenceScore` if provided.
  - Saves and returns 200: `{ message: "Tournament proposal updated successfully", proposedTournament: proposed }`.

### Kafka Consumer Stub (`server/utils/kafkaConsumer.js`)
- Initializes Kafka consumer group `gmu-tournament-scraping-group`.
- Subscribes to topic `tournament-scraping`.
- Processes message JSON payload: creates and saves new `ProposedTournament` document.
- Documents consumer architecture, topic schema, and execution entrypoint.

### Code Layout
- `server/models/ProposedTournament.js`
- `server/routes/adminTournaments.js`
- `server/server.js` (mounting /api/admin/tournaments)
- `server/utils/kafkaConsumer.js`
- `server/tests/adminTournaments.test.js`
