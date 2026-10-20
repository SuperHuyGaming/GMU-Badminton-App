# Progress: Milestone 1 — Ingestion Deduplication & Reliability

Last visited: 2026-10-20T04:10:00Z
Status: Completed
Phase: Verified & Ready for Handoff

## Milestones & Tasks
- [x] Initial dispatch & briefing setup
- [x] Create git feature branch `feature/titan-m1-ingestion-dedup` from `develop`
- [x] Implement P4: Scraping Title Sanitizer (`server/utils/sanitizeScrapedTitle.js`) & update crawlers
- [x] Implement P1: Fuzzy Deduplication & ML Pruning (`server/utils/deduplication.js`, `autonomousHunter.js`, `adminTournaments.js`, `instagramScraper.js`)
  - [x] Multi-stage ML candidate pruning cascade (`shouldPruneCandidate`)
  - [x] TF-IDF n-gram vectorizer & cosine similarity (`computeTfIdfVector`, `cosineSimilarity`)
  - [x] Hybrid ML ensemble scoring (TF-IDF Cosine 40%, Jaro-Winkler 35%, Levenshtein 25%)
  - [x] Collegiate acronym expansion (GMU <-> George Mason, UMD <-> Maryland, UVA <-> Virginia, etc.)
  - [x] Division draw merging (maxDraw, feeAmount updates)
  - [x] Outbound registration URL & sourceLinks preservation
  - [x] Attendee RSVPs union set & rsvpCount calculation
- [x] Implement P2: Strict Temporal Horizon (`server/models/Tournament.js`, `server/routes/tournaments.js`, `server/utils/cronJobs.js`)
  - [x] Compound indexing on `{ status: 1, endDate: 1 }` and `{ status: 1, startDate: 1 }`
  - [x] Nightly cron & hourly auto-archiving for `endDate < Date.now()`
  - [x] Public directory filtering default `{ status: { $ne: 'archived' } }`
  - [x] Match archive preservation via `GET /:id` and `?status=archived`
  - [x] Redis cache invalidation (`tournaments:*`) on archival
- [x] Implement P3: Link Healthcheck Crawler (`server/models/Tournament.js`, `server/utils/linkHealthChecker.js`, `server/routes/adminTournaments.js`, `client/src/pages/Tournaments.jsx`)
  - [x] Schema fields: `linkStatus`, `linkStatusCode`, `linkLastChecked`, `fallbackRegistrationUrl`
  - [x] HEAD request with GET fallback on 405, handling 404, timeouts, redirects
  - [x] Host club fallback resolution prioritizing collegiate clubs (@gmu_badminton, @umd_badminton, etc.)
  - [x] Admin route `POST /api/admin/tournaments/link-healthcheck`
  - [x] Frontend warning badge & fallback registration button in `client/src/pages/Tournaments.jsx`
- [x] Implement P5: CampusGroups / Mason360 Directives & Bio Link Resolution (`server/utils/campusGroupsBypass.js`, `autonomousHunter.js`)
  - [x] Mason360 / CampusGroups URL detection with user directive adherence (Mason360 ignored as ingestion target)
  - [x] Social bio link detection (Linktree, Beacons, Bio.link)
  - [x] External registration form extraction (Google Forms, TournamentSoftware)
  - [x] RFC 5545 iCalendar stream parsing (`parseIcsContent`, `parseIcsDate`)
- [x] Domain Insight: Collegiate on-campus venue recognition (`CAMPUS_VENUES`, `identifyCampusVenue`)
  - [x] GMU: Recreation Athletic Complex (RAC Gym, Fairfax, VA)
  - [x] UMD: SPH / Ritchie Coliseum (College Park, MD)
  - [x] UVA: Memorial Gymnasium / Slaughter Recreation Center (Charlottesville, VA)
  - [x] Virginia Tech: McComas Hall / War Memorial Hall (Blacksburg, VA)
  - [x] VCU: Cary Street Gymnasium (Richmond, VA)
  - [x] JHU: Ralph S. O'Connor Recreation Center (Baltimore, MD)
  - [x] NVBC: Northern Virginia Badminton Club (Ashburn, VA)
  - [x] CBA: Capital Badminton Academy (Columbia, MD)
- [x] Write test suite `server/tests/titan_m1_ingestion_dedup.test.js` (35/35 passing)
- [x] Full server test suite verification: 23/23 suites passing (360/360 passing)
- [x] Full client test suite verification: 21/21 files passing (150/150 passing)
- [x] Client production build (`vite build`): Clean build in 485ms
- [x] Client & server linting: 0 errors, 0 warnings
- [x] Commit to feature branch `feature/titan-m1-ingestion-dedup`
- [x] Write 5-component handoff report `handoff.md` and notify orchestrator
