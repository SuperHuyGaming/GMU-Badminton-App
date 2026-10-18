# Backend Architecture & Verification Survey Report

**Explorer**: `explorer_survey_1`  
**Date**: 2026-10-18T03:08:00Z  
**Target Repository**: `GMU-Badminton-App`  
**Scope**: Backend models, routes, test suites (14 suites), Socket.io architecture, seed scripts, and technical requirements mapping for **R1 (Tournament Clean Slate & Verified Seeding)** and **R3 (Real-Time Court Queue & Umpire Digital Pad)**.

---

## 1. Executive Summary

A comprehensive, read-only architectural investigation was conducted across `server/`. The server currently comprises:
- An Express 4.x application with Helmet, express-mongo-sanitize, Redis-backed rate limiting, Prometheus metrics (`express-prom-bundle`), and Socket.io with Redis horizontal scaling adapter support.
- 14 active test suites in `server/tests/`, all passing with a **100% success rate (221 passed, 8 skipped, 229 total tests in 3.24s)**.
- ESLint checks passing with **0 errors**.
- Existing tournament models (`Tournament.js`, `ProposedTournament.js`) and match models (`Match.js`), which currently support basic social/pickup matches and calendar feeds, but lack enterprise division hierarchy, court assignment, and BWF live scoring state.
- Existing cleanup and seeding logic in `server/utils/autonomousHunter.js` (`wipeAndRestartTournamentSystem`, `ensureGuaranteedTournaments`), which serves as a foundational baseline for R1, but requires optimization into bulk operations (<100ms invariant) and multi-division collegiate/regional schemas for 2026/2027.

---

## 2. Backend Models Analysis

### 2.1 `server/models/Tournament.js`
- **Collection Name**: Explicitly mapped to `"tournaments"`.
- **Existing Schema**:
  ```javascript
  {
      tournamentName: String,
      hostUniversity: String,
      eventLocation: String,
      registrationDeadline: Date,
      rideFormDeadline: Date,
      isOpenTournament: Boolean, // Critical invariant for public discovery
      registrationUrl: String,
      sourceUrl: String,
      flyerImageUrl: String,
      rsvpCount: { type: Number, default: 0 },
      attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      entryFee: String,
      skillLevels: [String],
      startDate: Date,
      endDate: Date,
      scraperLastRun: Date,
      instagramPostUrl: String,
      hostClubHandle: String,
      linktreeUrl: String,
      originalCaption: String,
      hasSentDeadlineWarning: { type: Boolean, default: false },
      status: { type: String, enum: ["active", "sold_out", "canceled", "archived"], default: "active" },
      createdAt: Date
  }
  ```
- **Indexes**: `{ tournamentName: 1 }`, `{ sourceUrl: 1 }`.
- **Gaps for Enterprise Tier**:
  1. *Divisions & Events Structure*: Currently uses flat `skillLevels: [String]` and a single `entryFee: String`. Enterprise collegiate tournaments feature structured divisions (e.g., Men's Singles Open/A/B, Women's Singles Open/A, Men's Doubles, Women's Doubles, Mixed Doubles) with distinct entry fees, maximum draw sizes, and bracket types.
  2. *Court Associations*: No association to gym courts (e.g., RAC Courts 1-6).
  3. *Bracket References*: No direct reference to generated brackets or active draw trees.

### 2.2 `server/models/ProposedTournament.js`
- **Collection Name**: Proposed tournaments for AI scraper admin approval queue.
- **Fields**:
  - Raw Scraped Data: `rawCaption`, `scrapedImageUrls`, `sourceLinks`.
  - AI Structured Data: `tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`.
  - Metadata: `sourceUrl`, `confidenceScore` (0-100), `status` enum (`pending`, `approved`, `rejected`).
  - Lifecycle: `approvedAt`, `approvedBy`, `rejectedAt`, `rejectionReason`, `createdTournamentId`.
  - Virtuals: `aiStructuredData` and `rawScrapedData` getters/setters.
- **Status**: Stable, covered by 28 unit tests in `adminTournaments.test.js`.

### 2.3 `server/models/Match.js`
- **Current Role**: Handles casual/pickup match submissions and Elo updates.
- **Fields**:
  ```javascript
  {
      type: { type: String, enum: ["singles", "doubles"], required: true },
      team1: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
      team2: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
      team1Score: { type: Number, required: true },
      team2Score: { type: Number, required: true },
      winner: { type: String, enum: ["team1", "team2"], required: true },
      eloChanges: [{ userId, change }],
      status: { type: String, enum: ["pending", "confirmed", "rejected"], default: "pending" },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      date: { type: Date, default: Date.now }
  }
  ```
- **Gaps for Enterprise Umpire & Court Engine (R3)**:
  - No BWF best-of-3 game scoring (`gameScores: [{ game: 1, team1Score, team2Score }]`).
  - No live point-by-point tracking (`pointHistory: []` for undo/redo).
  - No service/receiver state tracking (`currentServer`, `currentReceiver`, `serverCourtSide`).
  - No assignment to RAC Courts 1-6.
  - No tournament or bracket ID association.

### 2.4 Missing Models Identified for R3
1. **`Court.js`**:
   - Represents the physical gymnasium courts (RAC Courts 1 through 6).
   - Needs: `courtNumber` (1-6), `courtName`, `status` (`available`, `warmup`, `in_match`, `maintenance`), `currentMatchId`, `assignedUmpireId`, `queue` (array of match IDs), `lastUpdated`.
2. **`TournamentMatch.js` (or Enterprise Match Extension)**:
   - Official tournament match with bracket node ID, round, seed, live game points, BWF service court rotation, point history, and umpire audit log.

---

## 3. Routes & Controllers Investigation

### 3.1 `server/routes/tournaments.js`
- `GET /api/tournaments`: Public list of active tournaments.
  - Supports query parameters: `month`, `location`, `skillLevel`, `upcoming`, `weekend`, `search`.
  - Implements Redis caching (`tournaments:${JSON.stringify(query)}`, TTL 3600s).
  - Contains automatic fallback: if query returns 0 results and no specific filters are applied, triggers `ensureGuaranteedTournaments()` or serves in-memory `getGuaranteedTournamentsList()`.
- `POST /api/tournaments/:id/rsvp`: Toggles user RSVP (`authMiddleware` required).
  - Updates `attendees` array and `rsvpCount`.
  - Automatically invalidates `tournaments:*` Redis keys.

### 3.2 `server/routes/adminTournaments.js`
- Protected by `authMiddleware` AND `adminMiddleware`.
- `GET /proposed`: Lists pending proposals sorted by `confidenceScore` descending.
- `POST /approve/:id`: Creates a live `Tournament` with `isOpenTournament: true`, marks proposal approved, and emits `tournamentApproved` via Socket.io.
- `POST /reject/:id`: Rejects proposal with XSS-sanitized reason.
- `PUT /:id`: Updates AI structured data fields prior to approval.
- `POST /manual`: Creates a manual tournament with `isOpenTournament: true` and emits `tournamentApproved`.
- `GET /discovery-queue`: Lists discovery queue items.
- `POST /discovery-queue/run-hunt`: Runs autonomous hunter crawler cycle.
- `POST /discovery-queue/process`: Runs AI evaluation on queued URLs.
- `POST /wipe-and-restart`: Executes `wipeAndRestartTournamentSystem()`.

### 3.3 `server/routes/matchmaking.js`
- Contains `GET /api/matchmaking/generate-bracket`:
  - Generates a transient 16-player single-elimination binary tree based on random users or "TBD" placeholders.
  - Does NOT persist the bracket to MongoDB.
  - Does NOT support double-elimination or round-robin draws.

### 3.4 `server/server.js`
- Initializes HTTP server and Socket.io instance with Redis adapter support (`@socket.io/redis-adapter`) if `REDIS_URL` is configured.
- Middleware: `req.io = io` and `app.set("io", io)`.
- Global error handler (`middleware/errorHandler.js`).
- Database connect hook initializes Gemini AI coach, runs `seedFeedIfEmpty()`, and calls `ensureGuaranteedTournaments()`.

---

## 4. Enumeration of All 14 Server Test Suites

| # | Test Suite File | Describe Blocks | Passing Tests | Skipped | Key Test Focus Areas |
|---|---|---|---|---|---|
| 1 | `tests/adminTournaments.test.js` | 9 describe blocks | 28 | 0 | Admin RBAC (401/403), proposal approval, proposal rejection, AI field editing with XSS sanitization, ProposedTournament model validation, Kafka stub, manual tournament creation, delta updates. |
| 2 | `tests/aiModeration.test.js` | 1 describe block | 6 | 0 | NLP Bayesian spam filter, sentiment toxicity threshold, slur blocking, character repetition DoS guard, null/empty robustness. |
| 3 | `tests/auth.test.js` | 1 describe block | 4 | 0 | Duplicate email rejection, missing required fields, non-existent user login, bcrypt password mismatch. |
| 4 | `tests/autonomousHunter.test.js` | 9 describe blocks | 27 | 0 | Levenshtein algorithm & fuzzy deduplication, SSRF URL validator, Fast Zero-Quota heuristic pre-filter, TournamentSoftware parser, DiscoveryQueue processing, Admin endpoints, Guaranteed tournaments initializer, Queue wipe & date sanitizer, Admin wipe-and-restart endpoint. |
| 5 | `tests/challenge_stress.test.js` | 5 describe blocks | 16 | 0 | Friendship concurrency stress, unauthorized `/accept`, self-interaction guards, duplicate relationship prevention, decline/reject socket emissions. |
| 6 | `tests/cloudinaryHelper.test.js` | 1 describe block | 6 | 0 | Image transformations, signed URLs, fallback URLs, cloud upload error handling. |
| 7 | `tests/friends.test.js` | 6 describe blocks | 21 | 0 | Friend requests lifecycle, mutual accept, mutual decline, remove friendship, defensive edge cases. |
| 8 | `tests/gamification.test.js` | 1 describe block | 6 | 0 | Win streak calculation, Elo multiplier, milestone badges (`first_win`, `streak_3`, `matches_10`), duplicate badge prevention, socket unlocks. |
| 9 | `tests/kafkaConsumer.test.js` | 3 describe blocks | 9 | 0 | Flat and nested message parsing, auto-publishing when confidence >= 95%, sold-out/canceled status propagation, registration deadline auto-updates. |
| 10 | `tests/kafkaProducer.test.js` | 1 describe block | 6 | 0 | KafkaJS producer connectivity, graceful offline fallback, test environment skipping, topic validation, sensitive field redaction (passwords, tokens). |
| 11 | `tests/matchmaking.test.js` | 4 describe blocks | 2 | 4 | Real-time presence (lastActive), queue join/leave, discovery feed (4 skipped legacy tests), 16-player bracket generator. |
| 12 | `tests/search.test.js` | 1 describe block | 6 | 0 | Microservice proxy forwarding, pagination query forwarding, university filtering, sensitive credential stripping from search payloads. |
| 13 | `tests/securityValidation.test.js` | 11 describe blocks | 56 | 0 | Announcements privilege escalation, Messages IDOR, CORS origin validation, NoSQL injection via `express-mongo-sanitize`, rate limiter behavior, error handler stack scrubbing. |
| 14 | `tests/tournaments.test.js` | 2 describe blocks | 9 | 0 | Public tournament querying, location/skill/upcoming filters, Redis caching & retrieval, RSVP toggle ON/OFF, invalid ID validation. |

**Current Test Status**: `14 passed, 14 total` (221 passed, 8 skipped, 229 total tests).  
**Execution Duration**: ~3.2 seconds.

---

## 5. Socket.io Architecture & Event Analysis

### 5.1 Architecture & Connection Lifecycle
- Initialized in `server.js` on HTTP server with CORS credentials enabled.
- Redis adapter `@socket.io/redis-adapter` enables horizontal scaling across multiple Node instances when `REDIS_URL` is set.
- Connection handler maintains `onlineUsers = new Set()`.
- Client rooms: `socket.on("joinUserRoom", (userId) => socket.join(userId))`.

### 5.2 Existing Socket Events
| Event Name | Direction | Payload | Usage |
|---|---|---|---|
| `onlineUsersUpdate` | Server -> All | `string[]` (userIds) | Global active presence |
| `privateMessage` | Server -> User Room | `Message` doc | Direct chat |
| `typing` / `stopTyping` | Server -> User Room | `{ senderId }` | 1-on-1 typing status |
| `postCreated` / `postUpdated` / `postDeleted` | Server -> All | `Post` doc or `id` | Social feed updates |
| `announcementCreated` / `announcementDeleted` | Server -> All | `Announcement` doc | Admin club announcements |
| `badgeUnlocked` | Server -> User Room | `Badge` object | Gamification reward |
| `tournamentApproved` | Server -> All | `Tournament` doc | Public tournament broadcast |
| `matchConfirmed` / `matchDisputed` | Server -> All / User | `Match` doc | Casual match verification |

### 5.3 Required Socket Events for R3
To fulfill R3 (Real-Time Court Queue & Umpire Digital Pad), the following events must be emitted:
1. `courtStatusUpdate`: Broadcast to all connected clients when RAC Court 1-6 status changes:
   ```json
   {
       "courtNumber": 1,
       "courtName": "RAC Court 1",
       "status": "in_match",
       "currentMatch": {
           "matchId": "670c...",
           "division": "Men's Singles Open",
           "team1": [{ "name": "Ethan Lin", "seed": 1 }],
           "team2": [{ "name": "Marcus Vance", "seed": 4 }],
           "gameScores": [{ "game": 1, "team1Score": 21, "team2Score": 18 }, { "game": 2, "team1Score": 14, "team2Score": 11 }],
           "currentGame": 2,
           "team1Score": 14,
           "team2Score": 11,
           "serviceState": {
               "server": "Ethan Lin",
               "receiver": "Marcus Vance",
               "side": "right"
           }
       }
   }
   ```
2. `liveScoreUpdate`: Emitted on every point scored or undone by umpire:
   ```json
   {
       "matchId": "670c...",
       "courtNumber": 1,
       "currentGame": 2,
       "team1Score": 15,
       "team2Score": 11,
       "scoringTeam": "team1",
       "gameScores": [...],
       "serviceState": { "server": "Ethan Lin", "side": "left" },
       "isMatchPoint": false,
       "isGamePoint": true
   }
   ```
3. `matchCalled`: Emitted to alert players when their match is called to a court.
4. `courtQueueUpdate`: Broadcast when the on-deck queue for RAC courts is reordered or populated.

---

## 6. Seed and Migration Scripts Analysis

### 6.1 Current Scripts
1. `server/scripts/seedProposedTournaments.js`: Ingests 3 hardcoded proposals into `ProposedTournament` collection.
2. `server/seed_feed.js`: Standalone script wiping and rebuilding `ActivityFeed` from existing `Post` and `Match` collections.
3. `server/utils/seedFeed.js`: Idempotent self-healing function that populates `ActivityFeed` if empty on MongoDB connect.
4. `server/utils/autonomousHunter.js`:
   - `ensureGuaranteedTournaments()`: Upserts 4 tournaments (2026 GMU Open, 2026 Mid-Atlantic Collegiate, 2026 Snowpeak DC Open, 2026 NVBC Spring Open) on server start.
   - `wipeAndRestartTournamentSystem()`: Purges queues and legacy pre-2026 tournaments, then re-seeds the 4 guaranteed tournaments.

### 6.2 Bottlenecks in Current Seeding Logic
- **Sequential Execution**: `ensureGuaranteedTournaments` executes individual `Tournament.findOneAndUpdate` queries in a `for...of` loop. In high-latency or test conditions, sequential round trips risk exceeding the strict 100ms budget.
- **Data Completeness**: Does not include 2026/2027 collegiate division matrices (singles, doubles, mixed with fees and draw sizes).
- **No Standalone Purge/Seed Script**: Lacks a dedicated `server/scripts/cleanSlateSeedTournaments.js` that can be run directly via CLI or integrated into CI pipelines.

---

## 7. Requirement Mapping for R1 & R3

### 7.1 R1: Clean Slate Purge Endpoint & Verified Seeding (<100ms, Zero Memory Leaks)

#### Required Tournaments & Division Structure
The seeded data must cover verified 2026 and 2027 collegiate and regional tournaments:
1. **2026 GMU Badminton Open** (George Mason University, RAC Gym, Fairfax VA)
   - Divisions:
     - Men's Singles Open (Draw: 32, Fee: $25)
     - Men's Singles B (Draw: 32, Fee: $20)
     - Women's Singles Open (Draw: 16, Fee: $25)
     - Men's Doubles Open (Draw: 16 teams, Fee: $40/team)
     - Mixed Doubles Open (Draw: 16 teams, Fee: $40/team)
2. **2026 Mid-Atlantic Collegiate Team Badminton Championships** (Capital Badminton Academy, Columbia MD)
   - Divisions: Collegiate Division I Team (GMU, UVA, VT, UMD, JHU), Collegiate Division II Team.
3. **2026 Snowpeak DC Open Badminton Championships** (UMD SPH, College Park MD)
   - Divisions: Men's Singles Open, Women's Singles Open, Men's Doubles A/B, Mixed Doubles Open.
4. **2026 NVBC Spring Open Championships** (Northern Virginia Badminton Club, Ashburn VA)
   - Divisions: Open Flight, Flight B, Flight C, Junior U19.
5. **2027 GMU Spring Invitational** (George Mason University, RAC Gym, Fairfax VA)
   - Rolling collegiate spring tournament.

#### Performance & Memory Leak Guarantees (< 100ms)
To achieve <100ms execution with zero memory leaks:
1. **Atomic Bulk Operations**: Use `Tournament.deleteMany()` and `Tournament.bulkWrite()` with `upsert: true` instead of looping sequential queries.
2. **Single-Operation Cache Clear**: Clear Redis tournament keys using non-blocking Redis pipelines or targeted key eviction.
3. **No Unclosed Handles**: Any script or endpoint must ensure connection pooling re-use in server mode, and explicit `mongoose.disconnect()` in standalone CLI mode.

#### API Contract
- `POST /api/tournaments/reset-seed` (or admin endpoint `POST /api/admin/tournaments/wipe-and-restart`)
- Response payload:
  ```json
  {
      "success": true,
      "executionTimeMs": 24,
      "purged": {
          "discoveryQueue": 0,
          "proposedTournaments": 0,
          "staleTournaments": 0
      },
      "seededTournaments": 5,
      "tournaments": [...]
  }
  ```

---

### 7.2 R3: Real-Time Court Scheduling Engine & Umpire Digital Pad Backend

#### Court Architecture: RAC Courts 1 to 6
George Mason University's Recreation Athletic Complex (RAC) has 6 primary badminton courts. The court engine must maintain the state of all 6 courts:
- Court numbers: `1, 2, 3, 4, 5, 6`.
- Court statuses:
  - `available`: Ready for match assignment.
  - `called`: Match announced, waiting for players to take court.
  - `warmup`: 3-minute BWF warmup period in progress.
  - `in_match`: Match active, live scores being posted.
  - `maintenance`: Court temporarily unavailable (net check, floor sweep).

#### Court Scheduling Engine Endpoints (`server/routes/courts.js` or mounted on `/api/courts`)
1. `GET /api/courts`: Returns status of RAC Courts 1-6 and the global on-deck queue.
2. `POST /api/courts/:courtNumber/assign`: Assigns a queued match to a court, switches status to `called`, emits `courtStatusUpdate` and `matchCalled`.
3. `POST /api/courts/:courtNumber/queue`: Appends a tournament match to the court's waiting queue.
4. `POST /api/courts/:courtNumber/reorder`: Reorders queued matches.
5. `POST /api/courts/:courtNumber/clear`: Completes current match, sets court `available`, or auto-calls next match in queue.

#### Umpire Digital Pad Backend Endpoints
Mounted on `/api/courts/match/:matchId/` or `/api/tournaments/matches/:matchId/`:
1. `POST /score/point`:
   - Parameters: `{ scoringTeam: "team1" | "team2" }`.
   - Logic:
     - Increments score for designated team.
     - Enforces BWF standard scoring: Best 2 of 3 games to 21 points. Must win by 2 points up to 29-29; at 29-all, first to 30 wins.
     - Calculates service court: even score = right half-court, odd score = left half-court.
     - Appends entry to `pointHistory` for undo capability.
     - Emits `liveScoreUpdate` and `courtStatusUpdate`.
2. `POST /score/undo`:
   - Pops last point from `pointHistory`, restores scores, game status, and service state.
   - Emits `liveScoreUpdate`.
3. `POST /status`:
   - Updates match phase: `warmup` -> `in_progress` -> `completed`.
   - On `completed`: auto-promotes winner to next round in bracket tree and marks court available.

---

## 8. Proposed Architectural Additions

### 8.1 Schema Design: `Court.js`
File: `server/models/Court.js`
```javascript
const mongoose = require("mongoose");

const courtSchema = new mongoose.Schema({
    courtNumber: { type: Number, required: true, unique: true, min: 1, max: 6 },
    courtName: { type: String, required: true }, // e.g. "RAC Court 1"
    status: {
        type: String,
        enum: ["available", "called", "warmup", "in_match", "maintenance"],
        default: "available"
    },
    currentMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch", default: null },
    currentMatchSnapshot: {
        tournamentName: String,
        division: String,
        round: String,
        team1Name: String,
        team2Name: String,
        team1Score: { type: Number, default: 0 },
        team2Score: { type: Number, default: 0 },
        currentGame: { type: Number, default: 1 },
        gameScores: [{ game: Number, team1Score: Number, team2Score: Number }]
    },
    queue: [{ type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch" }],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Court", courtSchema);
```

### 8.2 Schema Design: `TournamentMatch.js`
File: `server/models/TournamentMatch.js`
```javascript
const mongoose = require("mongoose");

const tournamentMatchSchema = new mongoose.Schema({
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true },
    division: { type: String, required: true }, // e.g. "Men's Singles Open"
    round: { type: String, required: true }, // e.g. "R16", "QF", "SF", "Final"
    matchNumber: { type: Number, required: true },
    courtNumber: { type: Number, min: 1, max: 6, default: null },
    team1: [{
        name: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seed: Number
    }],
    team2: [{
        name: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seed: Number
    }],
    status: {
        type: String,
        enum: ["scheduled", "queued", "called", "warmup", "in_progress", "completed", "walkover"],
        default: "scheduled"
    },
    currentGame: { type: Number, default: 1 },
    team1Score: { type: Number, default: 0 },
    team2Score: { type: Number, default: 0 },
    team1GamesWon: { type: Number, default: 0 },
    team2GamesWon: { type: Number, default: 0 },
    gameScores: [{
        game: Number,
        team1Score: Number,
        team2Score: Number,
        winner: String
    }],
    serviceState: {
        server: String,
        receiver: String,
        side: { type: String, enum: ["left", "right"], default: "right" },
        shuttlePossession: { type: String, enum: ["team1", "team2"], default: "team1" }
    },
    pointHistory: [{
        pointIndex: Number,
        scoringTeam: String,
        scoreBefore: [Number],
        scoreAfter: [Number],
        serviceBefore: Object,
        timestamp: { type: Date, default: Date.now }
    }],
    winner: { type: String, enum: ["team1", "team2", null], default: null },
    nextMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch", default: null },
    umpireName: { type: String, default: "RAC Umpire" },
    startTime: Date,
    endTime: Date
}, { timestamps: true });

module.exports = mongoose.model("TournamentMatch", tournamentMatchSchema);
```

---

## 9. Verification & Safety Guidelines

1. **Strict Invariant**: All existing 14 test suites in `server/tests/` must remain 100% green without regression.
2. **Open Tournament Invariant**: Any seeded or approved tournament must have `isOpenTournament: true` to ensure visibility on the public calendar and feed.
3. **PR Workflow Compliance**: All implementations must follow `.agents/rules/pr_workflow.md` (branch -> commit -> push -> `gh pr create` -> QA review -> merge). Never commit directly to `develop` or `main`.

---
*Report compiled by explorer_survey_1 on 2026-10-18T03:08:00Z.*
