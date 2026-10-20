# Original User Request

## 2026-09-29T18:34:04Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Standard full team

Implement working "Add Friend" buttons with proper UI feedback, fix the styling mismatch on the Matchmaking search bar, and remove the redundant "Players" tab from the navigation bar. The implementation must follow our standard PR workflow (feature branch → pull request → QA validation → merge).

Working directory: ~/teamwork_projects/matchmaking_ui_polish
Integrity mode: development

## Verification Resources
- PR Workflow rules: `.agents/rules/pr_workflow.md`

## Requirements

### R1. Implement "Add Friend" Functionality
Integrate the "Add Friend" buttons on the Matchmaking player cards with the existing backend friend API. When clicked, the button must display a loading spinner, then transition to a disabled "Request Sent" state upon success.

### R2. Refine Search Bar Styling
Update the search bar in the Matchmaking view so its background is slightly lighter and translucent, ensuring it looks like a distinct input box against the dark theme background.

### R3. Remove "Players" Tab
Remove the "Players" navigation link from the top header Navbar, as the global search bar renders it redundant.

### R4. Execute PR Workflow
Follow the project's standard PR workflow by creating a feature branch, committing all changes, pushing, and invoking the QA Engineer subagent for autonomous testing.

## Acceptance Criteria

### Automated Verification
- [ ] `npm run lint` passes with 0 errors in the `client/` directory.
- [ ] `npm test` passes in the `client/` directory without breaking existing Navbar or Search tests.

### Agent-as-Judge Verification
- [ ] The "Add Friend" button successfully triggers an API request and visually updates to "Request Sent" (disabled).
- [ ] The Matchmaking search bar has a distinct translucent background fill.
- [ ] The "Players" tab is completely removed from the header navigation.
- [ ] A feature branch was created, and the QA Engineer subagent was invoked to review it.

## 2026-09-30T01:04:29Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Standard full team

Implement a complete, Facebook-style friend request system. This includes dynamic frontend button states, optimistic UI rendering, real-time socket notifications, exclusion of pending/existing friends from the discovery feed, and backend accept/decline handlers. The implementation must follow our standard PR workflow (feature branch → pull request → QA validation → merge).

Working directory: ~/teamwork_projects/friend_system_overhaul
Integrity mode: development

## Verification Resources
- PR Workflow rules: `.agents/rules/pr_workflow.md`

## Requirements

### R1. Backend Hydration & Exclusion
Update the `/api/matchmaking/discover` endpoint to calculate and return a `friendshipStatus` ("none", "pending", "friends") for each player. Modify the MongoDB query to completely exclude players who are already friends or have a pending request.

### R2. Dynamic FriendActionButton Component
Create a reusable `<FriendActionButton>` component used in `Matchmaking.jsx` and `Profile.jsx` that conditionally renders "Add Friend", "Request Sent", or "Friends" based on the `friendshipStatus`. It must use optimistic UI rendering (change state instantly before the API resolves).

### R3. Accept/Decline Handlers & Socket Notifications
Implement `/api/friends/accept` and `/api/friends/decline` backend routes to safely mutate the `friends` and `friendRequests` arrays. Ensure that when a request is sent or accepted, a Socket.io event is emitted to update the recipient's UI in real-time.

### R4. Execute PR Workflow
Follow the project's standard PR workflow by creating a feature branch, committing all changes, pushing, and invoking the QA Engineer subagent for autonomous testing.

## Acceptance Criteria

### Automated Verification
- [ ] `npm test` passes in both the `client/` and `server/` directories, including the newly added matchmaking tests.
- [ ] `npm run lint` passes with 0 errors.

### Agent-as-Judge Verification
- [ ] When User A sends a request to User B, User B is immediately filtered out of User A's discovery feed upon refresh.
- [ ] User B receives a real-time socket notification when the request is sent.
- [ ] The reusable `<FriendActionButton>` correctly handles optimistic state updates and error rollbacks.
- [ ] A feature branch was created, and the QA Engineer subagent was invoked to review it.

## 2026-10-02T23:38:06Z

# Teamwork Project Prompt

> Goal: Implement Phase 3 (Core Backend) of the DMV Tournament Aggregation & Admin Approval System
> Requested team: Backend / API Specialists

Implement the backend foundation for the Tournament Approval system. We need to store scraped tournament data, provide an admin queue for review, and expose endpoints to approve/reject them.

Working directory: `server/`
Integrity mode: development

## Requirements

### R1. ProposedTournament Model
Create `server/models/ProposedTournament.js` using Mongoose. It should include:
- Raw Scraped Data (`rawCaption`, `scrapedImageUrls`, `sourceLinks`)
- AI Structured Data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`)
- Metadata (`sourceUrl`, `confidenceScore` 0-100, `status` enum: ['pending', 'approved', 'rejected'])

### R2. Admin API Routes
Create `server/routes/adminTournaments.js` and mount it in `server/server.js` at `/api/admin/tournaments`.
- `GET /proposed`: Returns all 'pending' ProposedTournaments, sorted by confidenceScore (descending).
- `POST /approve/:id`: Finds a ProposedTournament, creates a new entry in `Tournament.js` (existing model), and marks the proposal as 'approved'.
- `POST /reject/:id`: Marks the ProposedTournament as 'rejected'.
- `PUT /:id`: Allows an admin to manually edit the AI Structured Data before approval.

### R3. Authentication & Security
Ensure all `/api/admin/tournaments` routes use `authMiddleware` AND verify that `req.user.role === 'admin'`.

### R4. Kafka Consumer (Optional/Stub)
In `server/utils/kafkaConsumer.js` (if it exists), add a stub case for the `tournament-scraping` topic that inserts a message into the `ProposedTournament` collection. If it doesn't exist, just document where the consumer should be added.

## Acceptance Criteria
- [ ] The `ProposedTournament` model is created and matches the schema requirements.
- [ ] The `/api/admin/tournaments` routes are fully implemented and protected.
- [ ] A feature branch was already created (`feature/tournament-admin-approval`), so just commit your work to it.
- [ ] Run `npm run lint` and `npm test` in the `server/` directory to ensure no regressions.

## 2026-10-03T00:31:31Z

# Teamwork Project Prompt

> Goal: Implement Phase 4 (Admin Dashboard UI) of the DMV Tournament Aggregation & Admin Approval System
> Requested team: Frontend / UX Specialists

We just finished Phase 3 (Core Backend) which gave us the `ProposedTournament` database collection and the `/api/admin/tournaments` endpoints. Now we need the React frontend UI for the admins to review these proposals.

Working directory: `client/`
Integrity mode: development

## Requirements

### R1. Admin Route & Layout
Create a new Admin view (e.g., `client/src/pages/admin/TournamentApprovals.jsx`) and ensure it's protected by an Admin route guard. Add a link to this page in the Admin Sidebar/Navbar.

### R2. Review Queue UI
Fetch `GET /api/admin/tournaments/proposed` and display the pending tournaments. Use a Table or Kanban layout. Highlight tournaments or specific fields that have a low `confidenceScore` (e.g., < 80) so admins know to pay attention.

### R3. Split-Screen Reviewer
When an admin clicks a proposal, open a Modal or a split-screen view:
- **Left Side**: Display the raw scraped context (`rawCaption`, `scrapedImageUrls`, `sourceLinks`) so the admin can visually verify the data.
- **Right Side**: Display an editable form pre-filled with the AI's extracted data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`).

### R4. Approval Actions & UX
- Provide "Approve" (calls `POST /api/admin/tournaments/approve/:id`) and "Reject" (calls `POST /api/admin/tournaments/reject/:id`) buttons.
- Add success/error Toast notifications for all actions.
- Allow the admin to save edits (calls `PUT /api/admin/tournaments/:id`) before approving.
- Provide a "Manual Entry" button to open a blank form to create a tournament manually (without scraping).

## Acceptance Criteria
- [ ] The `TournamentApprovals.jsx` page is created and visually matches our MUI theme.
- [ ] The split-screen reviewer modal works and accurately displays both the raw source and the editable form.
- [ ] Axios/fetch logic successfully connects to the backend API routes built in Phase 3.
- [ ] A feature branch is already active (`feature/tournament-admin-ui`), so just commit your work to it.
- [ ] Run `npm run lint` and `npm test` in the `client/` directory to ensure no regressions.

## 2026-10-18T02:59:44Z

Reset and completely transform the GMU Badminton Tournament platform into an enterprise-ready collegiate and open tournament management ecosystem suitable for company pitch and GitHub project production tracking, backed by an executive 50-sprint plan across 10 specialized engineering roles.

Working directory: ~/teamwork_projects/tournament_enterprise_platform
Integrity mode: development

## Verification Resources
- Master 50-Sprint Plan: enterprise_tournament_platform_50_sprint_plan.md
- PR & QA Workflow rules: .agents/rules/pr_workflow.md
- Client test suite: client/src/pages/Tournaments.test.jsx, client/src/pages/admin/TournamentApprovals.test.jsx
- Server test suite: server/tests/tournaments.test.js, server/tests/adminTournaments.test.js, server/tests/autonomousHunter.test.js

## Requirements

### R1. Tournament Clean Slate & Verified Data Seeding
Purge legacy/stale test data and seed verified 2026/2027 collegiate and regional tournaments (e.g. 2026 GMU Badminton Open, Mid-Atlantic Collegiate Championships, NVBC Spring Open, Snowpeak DC Open) with complete division structures, normalized dates, and verified entry fees.

### R2. Interactive Tournament Bracket Engine & Viewer
Implement a hardware-accelerated interactive bracket visualizer supporting single elimination, double elimination, and round-robin draws with zoom/pan gesture controls, team collision prevention, and live match state progression.

### R3. Real-Time Court Queue & Umpire Digital Pad
Build a real-time court scheduling engine for gymnasium courts (RAC Courts 1–6) paired with a mobile-optimized umpire touch scorekeeper syncing point-by-point live scores and service states over WebSockets.

### R4. Production GitHub Project & Milestone Structuring
Structure the 200 initiatives across the 50 sprints into actionable GitHub Projects milestones, epics, and issue templates with automated QA pipeline enforcement on all PRs.

## Acceptance Criteria

### Automated Verification
- [ ] Client test suites pass with 100% success rate: npm test in client/ (15/15 test files passing).
- [ ] Server test suites pass with 100% success rate: npm test in server/ (14/14 test suites passing).
- [ ] Zero lint errors and successful production build: npm run lint and npm run build in client/ and server/.
- [ ] Reset and seed endpoints execute in < 100ms with zero memory leaks.

### Product & Presentation Verification
- [ ] Master 50-sprint plan document contains 10 distinct job roles with 20 concrete initiatives each (200 total initiatives).
- [ ] Live interactive bracket renders smoothly on mobile and desktop viewports without horizontal layout breaks.
- [ ] Umpire scoring actions emit real-time Socket.io events reflected immediately on public scoreboards.
- [ ] PR workflow strictly adheres to the repository invariant: all code pushed to feature branches, reviewed by QA subagent, and never directly committed to develop or main.

## 2026-10-18T03:01:04Z

CRITICAL REPOSITORY INVARIANT & WORKFLOW DIRECTIVE:

You MUST follow the repository's mandatory PR & QA Workflow (.agents/rules/pr_workflow.md) without exception:
1. NEVER commit or push directly to `develop` or `main`.
2. All changes must be developed on a descriptive feature branch (e.g., `feature/tournament-enterprise-platform`).
3. Commit with conventional commit messages and push to `origin`.
4. Create a Pull Request targeting `develop` using GitHub CLI:
   `gh pr create --base develop --head <branch> --title "<title>" --body "<detailed description>" --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"`
5. Immediately post the QA bot comment:
   `gh pr comment <PR#> --body "🤖 **Automated QA Pipeline:** ..."`
6. Run full verification (`npm test` in client and server, `npm run lint`, `npm run build`) and post review comment.
7. Merge only after all QA checks report 100% PASS using:
   `gh pr merge <PR#> --squash --delete-branch`
8. Under NO circumstances merge `develop` into `main`.

Acknowledge and adhere to this workflow for all deliverables.

## 2026-10-19T04:15:39Z

An autonomous multi-agent engineering team to eliminate backend JavaScript heap out of memory (OOM) crashes on Render (512MB RAM tier) caused by heavy Cheerio DOM parsing and unbounded web page scraping during Autonomous Tournament Hunter cycles.

Working directory: D:/GMU Fall 2026/GMU-Badminton-App
Integrity mode: development

## Requirements

### R1. Scraper Heap Memory & Cheerio DOM Optimization
Enforce response body caps (maxContentLength: 500 * 1024, maxBodyLength: 500 * 1024) on all Axios calls in autonomousHunter.js, tournamentSoftwareCrawler.js, and scraper.js. Truncate raw HTML strings to 200KB prior to Cheerio parsing. Immediately dereference Cheerio DOM trees ($ = null, data = null) after extraction and yield microtasks (await new Promise(r => setImmediate(r))) between items to allow V8 garbage collection to reclaim memory.

### R2. Discovery Queue Batch Throttling & Heap Pressure Guards
Reduce processDiscoveryQueue batch size from 25 to 5–10 items per cycle. Add proactive heap checks (process.memoryUsage().heapUsed); if heap usage exceeds 200MB, pause processing to let the garbage collector catch up rather than crashing the Node process.

### R3. Startup Memory Configuration & Mongoose Schema Cleanup
In server.js, inspect memory configuration and handle low-heap environments gracefully. Remove redundant courtSchema.index({ courtNumber: 1 }) in server/models/Court.js to eliminate the Mongoose duplicate index warning on boot.

### R4. Automated Memory Leak & Regression Verification
Create an automated test suite in server/tests/ verifying that runFullAutonomousHunt and batch discovery queue processing execute without exceeding 200MB of heap memory, confirming zero OOM crashes.

## Acceptance Criteria

### Memory & System Resilience
- [ ] Autonomous Tournament Hunter cycles (runFullAutonomousHunt and processDiscoveryQueue) complete without exceeding 200MB heap memory.
- [ ] Zero FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory crashes.
- [ ] Zero Mongoose duplicate index warnings on application startup.
- [ ] All test suites pass cleanly:
  - server/: npm test (100% passing suites), npm run lint (0 errors, 0 warnings).
  - client/: npm test (100% passing files), npm run lint (0 errors, 0 warnings), npm run build (success).

### Repository Workflow Compliance
- [ ] All changes developed on a feature branch (fix/hunter-heap-oom-optimization) and merged via Pull Request following QA pipeline verification without direct commits to develop or main.

## 2026-10-19T04:34:01Z

CRITICAL ADDITIONAL USER REQUIREMENT:
After the memory optimization and PR merge to `develop` are completed:
1. Verify that Render logs show zero OOM crashes or heap limit errors.
2. Delete/wipe all tournaments currently in the system using the admin wipe endpoint (`POST /api/admin/tournaments/wipe-and-restart`).
3. Have a bot user with admin privileges trigger the Autonomous Tournament Hunter (`POST /api/admin/tournaments/discovery-queue/run-hunt`) to start finding tournaments from scratch.
4. Verify that the hunter completes its full discovery cycle cleanly with zero memory spikes and zero errors.


## 2026-10-19T19:01:57Z

This is a single self-contained fix; keep it small and focused.
Diagnose and permanently resolve CI test failures and flakiness on the develop branch in `server/tests/challenger_empirical_stress.test.js`, where full test runner memory baselines in CI (>200MB) cause premature heap guard exits and failed queue batch assertions.

Working directory: D:\GMU Fall 2026\GMU-Badminton-App
Integrity mode: development

## Requirements

### R1. Test Runner Heap Pressure Isolation
Ensure `server/tests/challenger_empirical_stress.test.js` isolates or mocks `checkHeapPressure` and heap threshold checks during batch queue testing, so assertions for queue clamping (`limit(10)`), item processing, and error handling run deterministically without being bypassed by the CI runner's baseline memory.

### R2. Deterministic Memory Ceiling Assertions
Update the memory boundary tests in `challenger_empirical_stress.test.js` to either measure heap growth delta (differential memory usage of the hunt cycle) or configure the heap limit threshold via environment/mock in test mode, preventing false positive failures caused by Jest module caching across prior test suites.

### R3. Full-Suite Local & CI Verification
Verify that running `npm test` across all server suites sequentially passes 100% (22/22 suites, 0 failed), client tests pass (21/21 files), and the fix is safely committed and merged via the standard PR and QA review workflow.

## Acceptance Criteria

### Test & CI Integrity
- [ ] `npx jest tests/challenger_empirical_stress.test.js` passes 100% of tests (0 failed)
- [ ] `npm test` in `server/` passes 100% of test suites (22/22 test suites, 0 failed) when executed as a full suite
- [ ] `npm test` in `client/` passes 100% (21/21 files, 0 failed)
- [ ] `npm run lint` and `npm run build` in `client/` pass with 0 errors
- [ ] A PR is opened, verified by QA, and merged to `develop` with a green GitHub Actions CI run


## 2026-10-19T22:56:50Z

# Flagship Teamwork Project: Project Titan (20-Problem Enterprise Overhaul)

> Status: Architecture Defined & Ready for Execution
> Goal: Fix 20 major engineering issues across tournament intelligence, deduplication, past event archiving, broken links, memory/RAM optimization, BWF Umpire Pad, Glicko-2 MMR, and automated verification.
> Requested team: Standard full multi-agent engineering team

## Scope & Problem Catalog
1. Fuzzy & semantic duplicate tournament detection & merging (Jaro-Winkler + date window).
2. Strict temporal horizon & past tournament auto-archiving.
3. Autonomous 404 / broken link healthcheck crawler.
4. Scraping title sanitizer & navigation boilerplate reject filter.
5. CampusGroups & Mason360 SSO gate bypass / calendar feed fallback.
6. Scraper heap pressure ceiling & deterministic garbage collection triggers.
7. Atomic Redis tagged invalidation ($O(1)$ set-based cache eviction).
8. Database query projection & summary payload truncation.
9. Client-side virtualized rendering & lazy flyer image decoupling.
10. Optimistic concurrency locking on bracket match progression.
11. Offline PWA resilience & IndexedDB local scoring ledger for Umpire Pad.
12. Strict BWF official scoring rules enforcement (2-pt lead, 30-pt ceiling, interval timers).
13. RAC Gymnasium Court 1-6 scheduling deadlock prevention.
14. Glicko-2 Matchmaking Rating (MMR) & inactivity volatility decay.
15. Bi-directional friend state idempotency & atomic transactional mutations.
16. Community feed spam & abuse moderation quarantine pipeline.
17. Atomic tournament RSVP capacity capping & FIFO waitlists.
18. Dynamic CORS hardening & rate-limiting preflight isolation.
19. Full WCAG 2.1 AA accessibility & color contrast compliance.
20. 10-persona synthetic user bot simulation & memory leak harness.

## 4-Phase Delivery Roadmap
- Milestone 1 (M1): Data Quality & Ingestion Deduplication (Problems 1–5).
- Milestone 2 (M2): Performance, RAM Governance & Scaling (Problems 6–9, 18).
- Milestone 3 (M3): Interactive Systems & Fair Play (Problems 10–14).
- Milestone 4 (M4): Community Integrity, Accessibility & 10-Bot QA (Problems 15–17, 19–20).


## 2026-10-20T03:23:35Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team (large-scale autonomous engineering team)

Execute Project Titan: a comprehensive 20-problem engineering overhaul across the GMU Badminton Connect platform, resolving duplicate tournament ingestion, past event leaks, broken external links, scraper heap/RAM accumulation, BWF scoring compliance, court scheduling deadlocks, Glicko-2 ratings, and end-to-end synthetic testing.

Working directory: D:\GMU Fall 2026\GMU-Badminton-App
Integrity mode: development

## Verification Resources
- Master Architecture Blueprint: `PROJECT_TITAN_MASTER_PLAN.md`
- PR Workflow rules: `.agents/rules/pr_workflow.md`
- Server test suites: `server/tests/` (22 existing suites, including `cleanSlateSeed.test.js` and `challenger_empirical_stress.test.js`)
- Client test suites: `client/src/` (21 existing files, including `Tournaments.test.jsx` and `userBotsSimulation.test.jsx`)

## Requirements

### R1. Tournament Intelligence & Ingestion Reliability
Implement an automated ingestion pipeline that cleans, deduplicates, and validates all regional tournaments:
- **Fuzzy Deduplication**: Match variant tournament titles using Jaro-Winkler / Levenshtein distance combined with a 48-hour date window ($>0.85$ threshold), automatically merging division draws, links, and attendee counts rather than creating duplicate cards.
- **Strict Temporal Horizon**: Auto-archive elapsed tournaments where `endDate < Date.now()`, removing them from default public searches and recommendation queues while preserving match archives.
- **Autonomous Link Healthcheck Crawler**: Routine `HEAD`/`GET` link health verifier that marks broken or 404 external registration links with a clear warning badge and falls back gracefully to the host club homepage.
- **Title Sanitizer & SSO Bypass**: Strip navigation debris (*"Skip to main content"*, *"a smashing sport"*, *"Menu Select"*) and parse structured `.ics` feeds or public JSON APIs when encountering login walls.

### R2. Performance, RAM Governance & Scaling
Eliminate memory leaks and high-traffic Redis bottlenecks:
- **Scraper Heap Pressure Ceiling**: Stream Cheerio DOM parsing with strict memory ceilings (`getHeapPressureLimitBytes()`) and concurrency throttling whenever heap usage exceeds 75% capacity.
- **Atomic Redis Tagged Invalidation**: Replace linear `redis.keys('tournaments:*')` scans with Redis Set-based key tagging (`SADD tournaments:active_keys`) and non-blocking `UNLINK` pipelines.
- **Database Query Projection**: Optimize directory queries to project only summary fields, deferring full division brackets and attendee arrays until detail modals open.
- **Client-Side Virtualization**: Virtualize the tournament directory card grid (`react-window`) and decouple high-res flyer image rendering.

### R3. Interactive Systems, BWF Umpire Pad & Fair Play
Enhance real-time competitive tournament infrastructure:
- **Bracket OCC Lock**: Implement Mongoose document versioning and WebSocket locks preventing race conditions during simultaneous bracket advances.
- **Offline PWA IndexedDB Sync**: Store live umpire pad score states locally in IndexedDB, auto-replaying mutations to the server upon Wi-Fi reconnection.
- **Strict BWF Rules Engine**: Enforce official 21-point rally scoring rules (deuce 2-point lead rule up to 29-29, golden point ceiling at 30, and side changes at 11 points in deciding sets).
- **RAC Court Deadlock Prevention**: Dynamic match duration estimation, 10-minute walkover forfeit countdown, and automated queue auto-advancement across RAC Courts 1–6.
- **Glicko-2 MMR Engine**: Calibrate player ratings tracking rating deviation ($RD$) and volatility ($\sigma$) with confidence decay for inactive accounts.

### R4. Community Integrity, Accessibility & 10-Bot CI Harness
Harden social features and automated quality assurance:
- **Bi-Directional Social Integrity**: Atomic MongoDB transactional mutations for friend states and waitlist promotions upon RSVP cancellation.
- **Feed Anti-Spam & Moderation**: Automated text spam analysis, rate limiting, and 3-report quarantine triggers.
- **WCAG 2.1 AA Compliance**: Full contrast audit ($\ge 4.5:1$), keyboard navigation rings, and dynamic `aria-live` announcements.
- **10-Persona Synthetic Bot Harness**: Expand end-to-end integration tests to 10 distinct collegiate personas exercising all 20 workflows under adversarial memory pressure.

### R5. Standard PR Workflow & Zero-Regression Invariant
All features and refactors must follow the project's PR workflow (`feature branch -> Pull Request -> CI verification -> squash-merge into develop`). Never commit directly to `develop` or `main`.

## Acceptance Criteria

### Automated Verification
- [ ] Server test suite: `npm test` in `server/` passes 100% (all 22+ suites passing, zero memory leaks, bounded heap $<200$MB).
- [ ] Client test suite: `npm test` in `client/` passes 100% (all 21+ files passing).
- [ ] Linting & build: `npm run lint` and `npm run build` pass with 0 errors and 0 warnings in both `client/` and `server/`.
- [ ] Deduplication test: Ingesting variant titles for the same event merges into 1 canonical tournament with combined division draws.
- [ ] Link health test: Broken 404 links are detected and flagged with `linkStatus: 'expired'` without crashing the ingestion worker.
- [ ] BWF scoring test: Umpire pad correctly halts scores at 30 points and enforces deuce rules.
- [ ] 10-bot simulation: Synthetic user bots complete multi-user exploration without timeouts or unhandled promise rejections.

### Agent-as-Judge & Deployment Verification
- [ ] Staging verification: Changes deployed to Render staging (`https://gmu-frontend-staging.onrender.com/tournaments`) reflect clean deduplicated directory cards and active controls.
- [ ] Victory Audit: Independent verification confirms zero regressions and 100% pass across all acceptance criteria.


## 2026-10-19T23:49:40Z

### CRITICAL USER CLARIFICATION: DATA SOURCES
> "okay keep in mind mason 360 is not where u get data, it's from instagram and linktree"

**Architectural Directives:**
1. The primary data ingestion sources are **Instagram** posts/captions (via club handles like `@gmu_badminton`, `@cba_badminton`, `@nvbadminton`, etc.) and their **Linktree** (or Beacons/bio) URLs that link to Google Forms and registration pages.
2. Mason360 is NOT an external data ingestion target. Do not waste cycles attempting to scrape or authenticate with Mason360 login portals.
3. Treat Instagram post URLs and Linktree URLs as primary source and registration links in `instagramScraper.js`, `autonomousHunter.js`, and `deduplication.js`.


## 2026-10-20T03:53:07Z

### USER DIRECTIVE: DMV COLLEGIATE BADMINTON CLUBS TARGETING
> "you can start with clubs around dmv area from colleges, try that and let me know"

**Directives for orchestrator_8 and worker_m1_ingestion_8:**
1. Target specifically collegiate badminton clubs in the DMV area:
   - George Mason University: `@gmu_badminton` (Fairfax, VA)
   - University of Maryland: `@umd_badminton` (College Park, MD)
   - George Washington University: `@gwbadminton` (Washington, DC)
   - Georgetown University: `@georgetownbadminton` (Washington, DC)
   - Johns Hopkins University: `@jhubadminton` (Baltimore, MD)
   - UMBC: `@umbcbadminton` (Catonsville, MD)
   - University of Virginia: `@uvabadminton` (Charlottesville, VA)
   - Virginia Tech: `@vtechbadminton` (Blacksburg, VA)
   - VCU: `@vcu.badminton` (Richmond, VA)
   - William & Mary: `@wmbadminton` (Williamsburg, VA)
   - Plus regional training hubs: `@cba_badminton` and `@nvbadminton`.
2. In `server/utils/instagramScraper.js`, prioritize these DMV college handles at the top of `TARGET_CLUBS`.
3. Extract Linktree / bio links from these DMV college profiles, resolve Google Forms registration links, and parse post captions for 2026/2027 collegiate tournaments.
4. Execute a test run of this collegiate hunt and report the discovered DMV collegiate tournaments.


## 2026-10-19T23:55:21Z

### USER DOMAIN INSIGHT: ON-CAMPUS VENUES & SPECIFIC EVENTS
> "okay, like there is a gmu open in november and nvbc open in december, can you see that? also the hosts are sometimes on the school campus like gmu open is at the RAC"

**Confirmed Tournament Milestones:**
1. **GMU Badminton Open** (November) hosted on campus at George Mason University's **Recreation Athletic Complex (RAC)**.
2. **NVBC Open** (December) hosted at **Northern Virginia Badminton Club (NVBC)** in Ashburn, VA.
3. **On-Campus Venue Recognition**: Detect campus recreational facilities in venue metadata:
   - GMU: Recreation Athletic Complex (RAC)
   - UMD: University of Maryland SPH / Ritchie Coliseum
   - UVA: Memorial Gymnasium / Slaughter Recreation Center
   - Virginia Tech: McComas Hall / War Memorial Hall
   - VCU: Cary Street Gymnasium
   - JHU: Ralph S. O'Connor Recreation Center


## 2026-10-20T03:59:55Z

### USER DIRECTIVE: ML CANDIDATE PRUNING & SIMILARITY ENSEMBLE
> "for the similarity do some prunning and apply ML topics to do that and let me know"

**Directives for orchestrator_8 and worker_m1_ingestion_8:**
1. Multi-Stage ML Candidate Pruning (`shouldPruneCandidate`):
   - Stage 1: Temporal Window Pruning (drops $\Delta t > \text{windowHours}$ in $O(1)$)
   - Stage 2: String Length Ratio Pruning (>3.5:1 ratio without substring containment)
   - Stage 3: Informative Token Inverted Index Filter (requires shared non-stopword tokens or character trigram overlap)
2. Machine Learning TF-IDF Cosine Vectorizer (`computeTfIdfVector`, `cosineSimilarity`):
   - Computes term frequency and inverse document frequency with sub-word character trigram shingles
   - Assigns high IDF weights to distinctive collegiate terms and downweights generic sports terms
3. Hybrid ML Ensemble (`computeTitleSimilarity`):
   - Fuses Cosine Similarity (40%), Jaro-Winkler (35%), and Levenshtein (25%)
Ensure `worker_m1_ingestion_8` includes tests for `shouldPruneCandidate`, `computeTfIdfVector`, `cosineSimilarity`, and the ensemble similarity in `server/tests/titan_m1_ingestion_dedup.test.js`.
