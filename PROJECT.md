# Project: Project Titan (20-Problem Enterprise Engineering Overhaul)

## Architecture
GMU Badminton Connect is an enterprise collegiate platform structured into:
- **Scraper & Ingestion Layer**:
  - `server/utils/autonomousHunter.js`: Autonomous discovery queue, batch processing, heap ceilings.
  - `server/utils/deduplication.js`: Jaro-Winkler (>0.85 threshold) + 48h temporal window deduplication with draw, link, and RSVP merging.
  - `server/utils/linkHealthChecker.js`: Routine HEAD/GET healthcheck crawler, fallback to host club homepage.
  - `server/utils/sanitizeScrapedTitle.js`: Delimiter-aware and inline navigation debris stripping without discarding valid events.
  - `server/utils/instagramScraper.js` & `server/utils/linkResolution.js`: Instagram posts, bio links, Linktree, and Google Forms resolution.
- **Cache & Performance Layer**:
  - `server/utils/redis.js`: Tagged active keys (`SADD tournaments:active_keys`) with non-blocking $O(1)$ `UNLINK` pipelines.
  - `server/routes/tournaments.js`: Query projection omitting heavy division brackets and attendee objects for directory listings.
  - `client/src/pages/Tournaments.jsx`: Virtualized card grid (`react-window`) and decoupled lazy flyer images (`<LazyFlyerImage>`).
- **Real-Time Interactive Systems & Fair Play**:
  - `server/models/TournamentMatch.js`: Optimistic concurrency locking (`optimisticConcurrency: true`, versioning `__v`) and bracket match advance endpoints.
  - `client/src/components/UmpireDigitalPad.jsx`: Offline PWA resilience with IndexedDB local ledger and auto-replay on Wi-Fi reconnection.
  - `server/routes/courts.js` & `server/utils/bwfRules.js`: Strict BWF 21-point rally scoring, 2-point clear deuce, 30-point golden cap, 60s/120s interval timers, Game 3 side change at 11 points.
  - `server/models/Court.js` & `server/routes/courts.js`: RAC Gymnasium Court 1â€“6 scheduling, dynamic match duration estimation, 10-min walkover forfeit countdown, auto-advancement.
  - `server/utils/glicko2.js`: Glicko-2 MMR engine tracking Rating ($R$), Rating Deviation ($RD$), and Volatility ($\sigma$) with inactivity decay.
- **Community Integrity & Accessibility**:
  - `server/routes/friends.js`: Bi-directional atomic friend state transitions with session/transaction idempotency.
  - `server/models/Post.js` & `server/routes/forum.js`: Community spam filtering, report counter, and 3-report auto-quarantine trigger.
  - `server/routes/tournaments.js`: Atomic RSVP capacity enforcement and FIFO waitlist queue.
  - `client/src/App.jsx` & UI: WCAG 2.1 AA color contrast compliance ($\ge 4.5:1$), universal `:focus-visible` keyboard rings, and dynamic `aria-live` regions.
- **Automated QA & Bot Harness**:
  - 10-Persona Collegiate Synthetic Bot Simulation (`client/src/userBotsSimulation.test.jsx`) exercising all 20 workflows under adversarial memory pressure.

## Feature Inventory
| # | Feature / Problem | Description | Milestone | Source |
|---|-------------------|-------------|-----------|--------|
| 1 | P1: Fuzzy Deduplication & ML Ensemble | Multi-stage ML candidate pruning (temporal, length, trigrams) + Hybrid Ensemble (40% TF-IDF Cosine, 35% Jaro-Winkler, 25% Levenshtein) with draw/link/attendee merging | M1 | User Directive & Survey |
| 2 | P2: Strict Temporal Horizon | Auto-archive elapsed tournaments (`endDate < Date.now()`), status filter in directory queries | M1 | Survey (tournaments.js:8, cronJobs.js:122) |
| 3 | P3: Link Healthcheck Crawler | Routine HEAD/GET verifier, `linkStatus: 'expired'` badge, fallback to host club homepage | M1 | Survey (Tournament.js, Tournaments.jsx:760) |
| 4 | P4: Title Sanitizer | Strip navigation debris ("Skip to main content", "a smashing sport", delimiters) without discarding | M1 | Survey (sanitizeScrapedTitle.js:75) |
| 5 | P5: Instagram & Linktree Bio Link Resolution | Extract registration forms from Instagram bio links, Linktree, and Google Forms | M1 | User Directive (Instagram & Linktree) |
| 6 | P6: Scraper Heap Pressure Ceiling | Stream Cheerio DOM parsing, getHeapPressureLimitBytes (<200MB), dynamic GC yield | M2 | Survey (autonomousHunter.js, scraper.js) |
| 7 | P7: Atomic Redis Tagged Invalidation | SADD active keys, O(1) set-based cache eviction via UNLINK pipelines | M2 | Survey (tournaments.js:149, adminTournaments.js) |
| 8 | P8: Database Query Projection | Project summary fields for directory queries, deferring brackets/attendees to detail endpoint | M2 | Survey (tournaments.js:75, Tournament.js) |
| 9 | P9: Client-Side Virtualization | Virtualize directory card grid (`react-window`) & lazy flyer decoupling | M2 | Survey (Tournaments.jsx:594) |
| 10 | P10: Bracket OCC Lock | Mongoose document versioning and WebSocket locks on bracket match progression | M3 | Survey (TournamentMatch.js, matchmaking.js) |
| 11 | P11: Offline PWA IndexedDB Sync | Umpire pad offline state persistence with auto-replay on reconnect | M3 | Survey (UmpireDigitalPad.jsx) |
| 12 | P12: Strict BWF Rules Engine | Official 21-pt rally scoring, 2-pt deuce lead, 30-pt ceiling, interval timers, side change at 11 | M3 | Survey (courts.js, UmpireDigitalPad.jsx) |
| 13 | P13: RAC Court Deadlock Prevention | Dynamic match duration estimation, 10-min walkover forfeit timer, auto-advance Courts 1-6 | M3 | Survey (Court.js, courts.js) |
| 14 | P14: Glicko-2 MMR Engine | Player rating deviation ($RD$) and volatility ($\sigma$) with inactivity decay | M3 | Survey (elo.js, User.js) |
| 15 | P15: Bi-Directional Social Integrity | Atomic MongoDB transactional mutations for friend states & waitlist promotions | M4 | Survey (friends.js:127) |
| 16 | P16: Feed Anti-Spam & Moderation | Automated spam analysis, rate limiting, and 3-report quarantine triggers | M4 | Survey (Post.js, forum.js) |
| 17 | P17: Atomic Tournament RSVP Capping | Capacity enforcement and FIFO waitlist queue promotions | M4 | Survey (tournaments.js:112, Tournament.js) |
| 18 | P18: Dynamic CORS Hardening | Restrict Render regex to GMU prefixes and preflight isolation for rate limiters | M2 | Survey (server.js:103) |
| 19 | P19: WCAG 2.1 AA Compliance | Contrast ratio $\ge 4.5:1$, keyboard navigation rings, dynamic aria-live announcements | M4 | Survey (App.jsx:313, index.css) |
| 20 | P20: 10-Persona Synthetic Bot Harness | Multi-user exploration harness testing all 20 workflows under heap pressure | M5 | Survey (userBotsSimulation.test.jsx) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Architecture Baseline | Survey codebase across all 20 problems | none | DONE |
| M1 | Ingestion Deduplication & Reliability | P1, P2, P3, P4, P5 | M0 | DONE |
| M2 | Performance, RAM Governance & Scaling | P6, P7, P8, P9, P18 | M1 | DONE |
| M3 | Interactive Systems, BWF Umpire Pad & Fair Play | P10, P11, P12, P13, P14 | M2 | DONE |
| M4 | Community Integrity & Accessibility | P15, P16, P17, P19 | M3 | DONE |
| M5 | 10-Persona Synthetic Bot Verification & Victory Audit | P20, Full Suite Verification | M1, M2, M3, M4 | DONE |

## Interface Contracts

### 1. Ingestion Deduplication Engine (`server/utils/deduplication.js`)
- `deduplicateTournament(candidate, existingTournaments, options)`:
  - Input: candidate tournament object, array of existing tournaments, options `{ titleThreshold: 0.85, windowHours: 48 }`
  - Output: `{ isDuplicate: Boolean, canonicalId: ObjectId|null, mergedData: Object, matchScore: Number }`
  - Merges: union of `divisions`, `registrationUrl` fallback, `attendees` array, keeps earliest `startDate` and latest `endDate`.

### 2. Link Health Checker (`server/utils/linkHealthChecker.js`)
- `checkUrlHealth(url, timeoutMs)`:
  - Input: URL string, timeout (e.g., 5000ms)
  - Output: `{ linkStatus: 'valid' | 'expired' | 'fallback', httpStatus: Number, checkedAt: Date }`
- `Tournament` Schema fields:
  - `linkStatus`: `{ type: String, enum: ['valid', 'expired', 'warning', 'unchecked'], default: 'unchecked' }`
  - `linkLastChecked`: `{ type: Date }`
  - `fallbackRegistrationUrl`: `{ type: String }`

### 3. Title Sanitizer (`server/utils/sanitizeScrapedTitle.js`)
- `cleanTitle(rawTitle)`:
  - Strips leading/trailing/inline boilerplate: `"Skip to main content"`, `"A smashing sport for all ages"`, `"Select Your Sport"`, `"Menu Select"`.
  - Normalizes whitespace and removes trailing delimiters (`-`, `|`, `/`).
  - Preserves legitimate tournament names without returning `null` on slogan presence.

### 4. Scraper Heap Pressure Ceiling & GC Governance (`server/utils/autonomousHunter.js`)
- `checkHeapPressure(limitBytes = 200 * 1024 * 1024)`:
  - Returns `{ isHigh: Boolean, heapUsed: Number, heapLimit: Number, action: 'continue' | 'throttle' | 'pause' }`.
- Cheerio dereferencing and V8 GC yielding (`await new Promise(r => setImmediate(r))`).

### 5. Atomic Redis Tagged Invalidation (`server/utils/redis.js`)
- `tagCacheKey(tag, key)`: `SADD tournaments:active_keys <key>`
- `invalidateCacheTag(tag)`: Atomically gets all members from `tournaments:active_keys`, unlinks keys in a pipeline, and deletes the tag set.

### 6. Query Projection for Directory Listings (`server/routes/tournaments.js`)
- `GET /api/tournaments`:
  - Selects only: `_id tournamentName startDate endDate location city state venue entryFee registrationDeadline registrationUrl linkStatus status isArchived confidenceScore divisions.divisionName divisions.maxDraw divisionCount attendeeCount bannerUrl sourceUrl`.
  - Excludes: `divisions.matches`, `divisions.teams`, `divisions.brackets`, full `attendees` objects.

### 7. Client-Side Virtualized Directory Card Grid (`client/src/pages/Tournaments.jsx`)
- Virtualized list or windowed grid rendering for tournament cards.
- `<LazyFlyerImage src={bannerUrl} alt={name} />` with placeholder skeleton.

### 8. Dynamic CORS Hardening & Rate-Limiting Preflight Isolation (`server/index.js` or `server/server.js`)
- Dynamic origin verification whitelist: GMU domains, localhost, staging.
- Preflight `OPTIONS` exemption from express-rate-limit (`skip: (req) => req.method === 'OPTIONS'`).
- 204 response on `OPTIONS` with `Access-Control-Max-Age: 86400`.

## Code Layout
- Backend: `server/`
  - Ingestion: `server/utils/autonomousHunter.js`, `server/utils/deduplication.js`, `server/utils/linkHealthChecker.js`, `server/utils/sanitizeScrapedTitle.js`, `server/utils/instagramScraper.js`
  - Cache: `server/utils/redis.js`
  - Models: `server/models/Tournament.js`, `server/models/ProposedTournament.js`, `server/models/Court.js`, `server/models/User.js`, `server/models/TournamentMatch.js`, `server/models/Post.js`
  - Routes: `server/routes/tournaments.js`, `server/routes/adminTournaments.js`, `server/routes/courts.js`, `server/routes/friends.js`, `server/routes/forum.js`
  - Tests: `server/tests/`
- Frontend: `client/`
  - Pages: `client/src/pages/Tournaments.jsx`, `client/src/pages/admin/TournamentApprovals.jsx`, `client/src/pages/Matchmaking.jsx`, `client/src/pages/Community.jsx`
  - Components: `client/src/components/TournamentBracket.jsx`, `client/src/components/UmpireDigitalPad.jsx`, `client/src/components/CourtQueueViewer.jsx`, `client/src/components/LazyFlyerImage.jsx`
  - Tests: `client/src/`

