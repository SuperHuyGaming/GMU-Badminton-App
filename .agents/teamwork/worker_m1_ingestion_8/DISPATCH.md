# Dispatch: Milestone 1 — Tournament Intelligence & Ingestion Reliability

## Identity
- Role: Milestone 1 Implementation Worker (`worker_m1_ingestion_8`)
- Agent Type: `teamwork_preview_worker`
- Working Directory: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\worker_m1_ingestion_8`
- Parent: Orchestrator 8 (`9b541525-8ca2-4c29-81f2-c47c7dfed15c`)

## Authoritative Inputs
- User Request: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\ORIGINAL_REQUEST.md` (read verbatim, especially section `## 2026-10-20T03:23:35Z`)
- PR Workflow rules: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md`
- Master Scope & Architecture: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\orchestrator_8\PROJECT.md`
- Detailed Survey Report: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\explorer_survey_ingestion_8\report.md`
- Ingestion Survey Handoff: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\explorer_survey_ingestion_8\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Git & PR Invariant
- NEVER commit or push directly to `develop` or `main`.
- Create feature branch: `feature/titan-m1-ingestion-dedup` from `develop`.
- Develop and test on this branch.

## Scope of Work (Problems 1–5)

### P1. Fuzzy & Semantic Deduplication
- Implement `server/utils/deduplication.js` using `natural.JaroWinklerDistance` combined with Levenshtein and a 48-hour date window (>0.85 threshold).
- When a duplicate tournament is detected during discovery queue ingestion (`autonomousHunter.js`):
  - Do NOT reject or discard it.
  - Automatically merge division draws (combining division lists without duplicates), update/merge registration URLs, and merge attendee RSVPs into the canonical tournament document.
  - Integrate with `server/utils/autonomousHunter.js` and `server/routes/adminTournaments.js`.

### P2. Strict Temporal Horizon
- Auto-archive elapsed tournaments where `endDate < Date.now()`.
- Update `server/routes/tournaments.js`: default directory queries and keyword searches must enforce `{ status: { $ne: 'archived' } }` so past events are excluded from public search and recommendations, while preserving match archives when queried by id or archive status.
- Update `server/utils/cronJobs.js`: `cleanupArchivedTournaments` must check `endDate < Date.now()` and invalidate Redis tournament cache (`tournaments:*`).

### P3. Autonomous Link Healthcheck Crawler
- Update `server/models/Tournament.js` schema with:
  - `linkStatus`: enum `['valid', 'expired', 'warning', 'unchecked']`, default `'unchecked'`
  - `linkLastChecked`: `Date`
  - `linkStatusCode`: `Number`
  - `fallbackRegistrationUrl`: `String`
- Create `server/utils/linkHealthChecker.js`:
  - Routine HEAD/GET link health verifier that tests external registration links.
  - Marks broken or 404 links with `linkStatus: 'expired'`.
  - Assigns host club homepage / contact page as `fallbackRegistrationUrl`.
- Update `client/src/pages/Tournaments.jsx`:
  - If `tournament.linkStatus === 'expired'`, render a clear warning badge ("Link Expired / Host Fallback") and use `fallbackRegistrationUrl` if available.

### P4. Scraping Title Sanitizer & Debris Filter
- Refactor `server/utils/sanitizeScrapedTitle.js`:
  - Strip navigation debris ("Skip to main content", "a smashing sport for all ages", "Select Your Sport", "Menu Select", and trailing/inline delimiters like `-`, `|`, `/`).
  - Do NOT return `null` when a valid tournament title remains after stripping debris.
- Ensure all extraction points in `server/utils/tournamentSoftwareCrawler.js` and `server/utils/scraper.js` call `sanitizeScrapedTitle`.

### P5. CampusGroups & Mason360 SSO Gate Bypass
- In `server/utils/campusGroupsBypass.js` / `autonomousHunter.js`:
  - Detect Mason360 / CampusGroups URLs.
  - When encountering login/SSO walls (redirects, login forms), parse structured `.ics` feeds (`/ical/...ics` or `<url>.ics`) or public JSON API endpoints.
  - Extract event title, date, location, and description cleanly.

### Test Suite & Verification
- Create comprehensive tests in `server/tests/titan_m1_ingestion_dedup.test.js` covering:
  - Deduplication merges variant titles within 48h into 1 canonical tournament with unified division draws.
  - Strict temporal horizon excludes elapsed tournaments from public directory.
  - Broken 404 link is marked `linkStatus: 'expired'` with host fallback without crashing ingestion worker.
  - Title sanitizer cleanly strips debris while preserving title.
  - CampusGroups `.ics` fallback extracts structured event data.
- Run full test suite:
  - `npm test` in `server/` (all 22+ suites passing, zero regressions, bounded heap <200MB).
  - `npm test` in `client/` (all 21+ files passing).
  - `npm run lint` in `client/` and `server/` (0 errors, 0 warnings).
  - `npm run build` in `client/` and `server/`.

## Deliverables
1. Code committed to branch `feature/titan-m1-ingestion-dedup`.
2. Write handoff report to:
   `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\worker_m1_ingestion_8\handoff.md`
   Documenting:
   - What changed (files modified/created)
   - Test execution results with exact commands and output snippets
   - Verification evidence
3. Notify orchestrator via `send_message`.


## 2026-10-20T03:37:17Z
You are the Milestone 1 Implementation Worker for Project Titan.
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\worker_m1_ingestion_8

MANDATORY FIRST STEP: Read the authoritative user request at:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\ORIGINAL_REQUEST.md
Pay special attention to section ## 2026-10-20T03:23:35Z.

Next, read your detailed dispatch instructions:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\worker_m1_ingestion_8\DISPATCH.md
And reference:
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\orchestrator_8\PROJECT.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\explorer_survey_ingestion_8\report.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY GIT INVARIANT:
Create and develop on feature branch: feature/titan-m1-ingestion-dedup (branched from develop). NEVER commit or push to develop or main.

Implement Problems 1 to 5:
1. P1: Fuzzy Deduplication (natural.JaroWinklerDistance + 48h date window, >0.85 threshold, merging draws/links/attendees into canonical tournament) in server/utils/deduplication.js and autonomousHunter.js.
2. P2: Strict Temporal Horizon (auto-archive elapsed tournaments endDate < Date.now(), filter status: { $ne: 'archived' } on public directory, invalidate Redis cache).
3. P3: Autonomous Link Healthcheck Crawler (schema fields linkStatus, linkLastChecked, fallbackRegistrationUrl; server/utils/linkHealthChecker.js; client warning badge and fallback on Tournaments.jsx).
4. P4: Scraping Title Sanitizer (server/utils/sanitizeScrapedTitle.js: strip debris without returning null, integrate in crawlers).
5. P5: CampusGroups / Mason360 SSO Bypass (server/utils/campusGroupsBypass.js: parse .ics / JSON APIs on login walls).

Write tests in server/tests/titan_m1_ingestion_dedup.test.js.
Run full verification: npm test in server/ (all 22+ suites passing), npm test in client/ (all 21+ files passing), npm run lint, npm run build. Commit to feature branch.

Write your handoff report to:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork\worker_m1_ingestion_8\handoff.md
Notify orchestrator_8 (conversation ID: 9b541525-8ca2-4c29-81f2-c47c7dfed15c) via send_message when complete.


## 2026-10-20T03:50:25Z
**Context**: CRITICAL USER CLARIFICATION for Milestone 1 Ingestion
**Content**: The user explicitly specified: "okay keep in mind mason 360 is not where u get data, it's from instagram and linktree".
Directives:
1. Ingestion sources are Instagram (club handles, post captions, flyer media) and Linktree (or bio links leading to registration Google Forms), handled by server/utils/instagramScraper.js and autonomousHunter.js.
2. Mason360 is NOT an external ingestion source—do NOT build scraping/auth bypasses targeting Mason360.
3. Align all deduplication, link healthcheck, and tournament extraction logic with Instagram posts, Linktree URLs, Google Forms, and TournamentSoftware links.
**Action**: Please adapt your implementation immediately. If you created or planned any Mason360-specific scrapers/bypasses, remove or redirect them to Instagram/Linktree bio link resolution and Google Forms/TournamentSoftware registration link extraction.


## 2026-10-20T03:53:27Z
USER DIRECTIVE:
"you can start with clubs around dmv area from colleges, try that and let me know"

Directives:
1. Target specifically collegiate badminton clubs in the DMV area:
   - George Mason University: @gmu_badminton (Fairfax, VA)
   - University of Maryland: @umd_badminton (College Park, MD)
   - George Washington University: @gwbadminton (Washington, DC)
   - Georgetown University: @georgetownbadminton (Washington, DC)
   - Johns Hopkins University: @jhubadminton (Baltimore, MD)
   - UMBC: @umbcbadminton (Catonsville, MD)
   - University of Virginia: @uvabadminton (Charlottesville, VA)
   - Virginia Tech: @vtechbadminton (Blacksburg, VA)
   - VCU: @vcu.badminton (Richmond, VA)
   - William & Mary: @wmbadminton (Williamsburg, VA)
   - Plus regional training hubs: @cba_badminton and @nvbadminton.
2. In server/utils/instagramScraper.js, prioritize these DMV college handles at the top of TARGET_CLUBS.
3. Extract Linktree / bio links from these DMV college profiles, resolve Google Forms registration links, and parse post captions for 2026/2027 collegiate tournaments.
4. Execute a test run of this collegiate hunt and report the discovered DMV collegiate tournaments.
Recorded in ORIGINAL_REQUEST.md. Please incorporate this directly into your implementation and test run.

## 2026-10-20T03:56:01Z
DOMAIN INSIGHT FROM USER — On-Campus Venues & Key Tournaments:
1. "gmu open in november": Confirmed on campus at the Recreation Athletic Complex (RAC Gym, Fairfax, VA).
2. "nvbc open in december": Confirmed at Northern Virginia Badminton Club (Ashburn, VA).
3. "the hosts are sometimes on the school campus like gmu open is at the RAC":
Ensure venue extraction and deduplication recognizes on-campus collegiate facilities:
- GMU: Recreation Athletic Complex (RAC)
- UMD: SPH / Ritchie Coliseum
- UVA: Memorial Gymnasium / Slaughter Recreation Center
- Virginia Tech: McComas Hall / War Memorial Hall
- VCU: Cary Street Gymnasium
- JHU: Ralph S. O'Connor Recreation Center
And tags hostUniversity appropriately. Preserves these exact verified events and campus venue tags in your implementation and test seed data.

## 2026-10-20T04:00:19Z
USER DIRECTIVE: ML PRUNING & SIMILARITY ENSEMBLE
User directive: "for the similarity do some prunning and apply ML topics to do that and let me know"
Requirements in server/utils/deduplication.js:
1. Multi-Stage ML Candidate Pruning (shouldPruneCandidate):
   - Stage 1: Temporal Window Pruning (drops Delta t > windowHours in O(1))
   - Stage 2: String Length Ratio Pruning (>3.5:1 ratio without substring containment)
   - Stage 3: Informative Token Inverted Index Filter (requires shared non-stopword tokens or character trigram overlap)
2. Machine Learning TF-IDF Cosine Vectorizer (computeTfIdfVector, cosineSimilarity):
   - Computes term frequency and inverse document frequency with sub-word character trigram shingles
   - Assigns high IDF weights to distinctive collegiate terms and downweights generic sports terms
3. Hybrid ML Ensemble (computeTitleSimilarity):
   - Fuses Cosine Similarity (40%), Jaro-Winkler (35%), and Levenshtein (25%)
Ensure test suite server/tests/titan_m1_ingestion_dedup.test.js tests:
- shouldPruneCandidate
- computeTfIdfVector
- cosineSimilarity
- computeTitleSimilarity (ensemble)
