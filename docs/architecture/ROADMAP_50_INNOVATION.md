# Mason Badminton Connect: 50-Idea Master Innovation Roadmap

**Document ID:** MBC-ARCH-ROADMAP-50  
**Version:** 2.0.0-PROD  
**Author:** worker_m6_roadmap_tests (Implementer, QA, Specialist)  
**Status:** Approved & Production-Ready  
**Scope:** Comprehensive 50-Idea Architectural Enhancement Matrix covering Autonomous AI Tournament Hunter, Ingestion Quality & Duplicate Prevention, Link Health & Reliability, Admin Governance & Human-in-the-Loop Workflow, and Community Engagement.

---

## Executive Summary

Mason Badminton Connect (`GMU Badminton App`) is an enterprise-grade collegiate and regional badminton platform engineered for George Mason University and the broader Mid-Atlantic collegiate circuit (GMU, UMD, UVA, Virginia Tech, GWU, Georgetown, JHU, UMBC, VCU, W&M, CBA, NVBC).

This roadmap establishes **exactly 50 categorized, scored, and prioritized enhancement initiatives** designed to propel the platform into an autonomous, resilient, and community-driven tournament ecosystem. Crucially, **30 of the 50 initiatives (60%) directly solve ingestion accuracy, multimodal computer vision for promotional flyers, deep social link crawling, and automated link reliability** (Categories 1–3, comfortably exceeding the $\ge 25$ requirement).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 50-IDEA MASTER INNOVATION ROADMAP BREAKDOWN                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Category 1: Autonomous AI Tournament Hunter & Scraper Ecosystem (14 Ideas)  │
│ Category 2: Ingestion Quality & Duplicate Prevention (10 Ideas)             │
│ Category 3: Link Health & Reliability (6 Ideas)                             │
│   ─── Subtotal for Categories 1–3: 30 IDEAS (Requirement: >= 25) ───        │
│ Category 4: Admin Governance & Human-in-the-Loop Workflow (10 Ideas)        │
│ Category 5: Community Platform & Real-Time Engagement (10 Ideas)            │
│   ─── TOTAL: EXACTLY 50 ACTIONABLE PRODUCTION INITIATIVES ───               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prioritization & Scoring Methodology

Every initiative is scored using our standard architectural rubric:
- **Impact Score (1–10)**: Evaluates user experience enhancement, data accuracy, platform resilience, and operational time saved for campus tournament directors. (10 = Transformative/Critical Invariant, 8–9 = High-Value Production Feature, 7 = Incremental Utility).
- **Implementation Complexity**:
  - **Low**: 1–2 sprints, minimal external dependencies, localized to existing utilities/routes.
  - **Medium**: 2–4 sprints, cross-cutting backend/frontend state, external AI/SDK integrations, or complex algorithms.
  - **High**: 4+ sprints, distributed state coordination, offline-first architectures, or complex WebAssembly/canvas hardware acceleration.

---

## Category 1: Autonomous AI Tournament Hunter & Scraper Ecosystem (14 Ideas)

*Focus: Multimodal Vision AI for Instagram flyers, deep Linktree and Google Forms crawling, geofencing, temporal validation, and scraper resilience.*

### HUNTER-01: Multimodal Vision OCR Flyer Parsing Engine
- **Problem Statement**: Over 75% of collegiate badminton tournament organizers announce events exclusively through graphic flyers on Instagram with minimal or emoji-only captions (e.g., *"Link in bio! Let's smash! 🏸"*). Standard NLP text parsers fail completely because critical match dates, gymnasium addresses, flight restrictions (Flight A/B/C/D), entry fees ($25/event), and registration deadlines exist solely as stylized pixels on the flyer graphic.
- **Proposed Technical Capability / Architecture**: Integrate Gemini 2.5 Flash Multimodal Vision API (`@google/genai`) into `server/utils/aiParser.js`. When an Instagram post or crawled webpage contains an image URL, the scraper buffers the image (capped at 2MB), base64-encodes the buffer, and dispatches a structured multimodal prompt with schema constraints (`Type.OBJECT`). The vision model extracts the canonical event title, start/end dates, host facility, entry fees, flight tiers, and registration deadlines directly from flyer pixels.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Medium

### HUNTER-02: Deep Linktree & Social Bio Hierarchy Traversal
- **Problem Statement**: Collegiate club Instagram bios point to aggregator linktrees (`linktr.ee/gmubadminton`, `beacons.ai/umd_badminton`) containing multiple links (GBM forms, merchandise, social GroupMes) where the actual tournament Google Form is nested inside an ambiguous button label. Furthermore, hardcoding `linktr.ee/${handle}` fails when the club's Linktree username differs from its Instagram handle.
- **Proposed Technical Capability / Architecture**: Implement an autonomous multi-hop bio crawler in `server/utils/campusGroupsBypass.js`. The crawler extracts the club profile's true `externalUrl` from Apify, fetches the aggregator page (capped at 200KB), parses `<a>` tags and Next.js hydration scripts (`__NEXT_DATA__`), and traverses button labels matching tournament regexes (`register|tournament|open|fall|spring|smash|cup`) to locate the direct entry form.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### HUNTER-03: Google Forms Deep Schema & Field Extraction
- **Problem Statement**: When a registration link points to Google Forms (`forms.gle/*` or `docs.google.com/forms/*`), standard scrapers store the URL as an opaque string. Google Forms contain authoritative event schedules, gym rules, and division tiers in their header descriptions and dropdown fields, but this intelligence remains unextracted when captions are brief.
- **Proposed Technical Capability / Architecture**: Build a dedicated Google Forms DOM and schema extractor in `server/utils/campusGroupsBypass.js`. It fetches the public form HTML (`GET /viewform`), parses the embedded JavaScript data structure (`var FB_PUBLIC_LOAD_DATA_ = [...]`), and extracts: (1) Form Title, (2) Header Description containing tournament dates, venue, and entry fees, and (3) Multiple-choice/checkbox items representing flight divisions (e.g., Men's Singles Open, Flight B Doubles).
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### HUNTER-04: Collegiate Club Schedule Radar & Target Discovery
- **Problem Statement**: Static target arrays miss newly formed collegiate clubs, student tournament committees, or regional badminton facilities in Virginia, Maryland, and DC.
- **Proposed Technical Capability / Architecture**: Autonomous discovery worker leveraging Apify social search actors and targeted Google dorks (`site:instagram.com ("badminton tournament" OR "badminton open") (virginia OR maryland OR "washington dc")`) executed on a monthly cadence to discover new active collegiate badminton handles and dynamically register them into the `TARGET_CLUBS` database.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Medium

### HUNTER-05: Multi-Model AI Routing & Circuit-Breaker Cascade
- **Problem Statement**: Relying on a single LLM API key causes catastrophic scraping failures when Google Cloud returns HTTP 429 (`ResourceExhausted`) or HTTP 503 (`Service Unavailable`), halting tournament discovery.
- **Proposed Technical Capability / Architecture**: Create a resilient multi-tier AI routing gateway (`server/utils/aiRouter.js`). The gateway prioritizes Gemini 2.5 Flash Lite for high-speed caption parsing, falls back to Gemini 2.5 Flash for vision extraction, and cascades to Gemini 1.5 Pro. If quota exhaustion is detected, an automatic 5-minute circuit breaker trips, routing items to deterministic local regex parsers without crashing the queue worker.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### HUNTER-06: Geofenced DMV Venue & Campus Facility Resolver
- **Problem Statement**: Scraped venue strings frequently list colloquial campus acronyms (e.g., *"RAC"*, *"SPH"*, *"Mem Gym"*, *"Cary St"*), preventing players from knowing the actual host university or calculating driving distances.
- **Proposed Technical Capability / Architecture**: Build a domain-specific collegiate badminton geospatial resolver. It maintains a dictionary mapping campus facilities (GMU RAC $\to$ Recreation Athletic Complex, Fairfax, VA; UMD SPH $\to$ School of Public Health, College Park, MD; UVA Mem Gym $\to$ Memorial Gymnasium, Charlottesville, VA; VT McComas $\to$ McComas Hall, Blacksburg, VA) and attaches canonical latitude/longitude coordinates and campus parking guidance.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### HUNTER-07: Temporal Horizon Validator & Stale Post Rejection
- **Problem Statement**: Social media crawlers frequently scrape historical tournament posts (e.g., 2024 results, anniversary celebrations *"Est. 2001"*), cluttering the review queue with expired events.
- **Proposed Technical Capability / Architecture**: Implement an assertive temporal filter that checks post publish dates ($> 45$ days old skipped), rejects past year tokens in titles ($\le 2025$), verifies extracted event dates against the active collegiate season (2026/2027), and rejects events whose completion timestamp is in the past.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### HUNTER-08: Flyer QR Code High-Resolution Decoder
- **Problem Statement**: Promotional tournament graphics increasingly embed registration links exclusively as QR codes printed in the bottom corner of the image, omitting written URLs from both the flyer text and post caption.
- **Proposed Technical Capability / Architecture**: Integrate a lightweight WebAssembly/pure-JS QR code scanner (`jsQR`) into the multimodal ingestion pipeline. Prior to downsampling flyer images, the decoder crops the quadrant with highest contrast and extracts decoded URI payloads (`forms.gle/...`), automatically populating `candidateTourney.registrationUrl`.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### HUNTER-09: Scraper Memory Ceiling & GC Microtask Governance
- **Problem Statement**: Processing dozens of large HTML documents and flyer buffers on memory-constrained cloud hosting tiers (e.g., Render 512MB RAM tier) triggers Node.js V8 heap exhaustion and unrecoverable OOM process crashes.
- **Proposed Technical Capability / Architecture**: Enforce a two-tier heap governor (`checkHeapPressure`) in `server/utils/autonomousHunter.js`. It monitors `process.memoryUsage().heapUsed` against a 200MB soft ceiling and 250MB hard pause. Raw HTML strings are truncated to 200KB before Cheerio parsing, Cheerio pointers (`$ = null`) are immediately dereferenced, and microtasks are yielded (`await new Promise(r => setImmediate(r))`) between batch items to allow the V8 garbage collector to reclaim memory.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### HUNTER-10: Rate-Limited Queue Worker with Exponential Jitter
- **Problem Statement**: Unthrottled concurrent web scraping triggers IP bans, CAPTCHA hurdles, and HTTP 429 rate limits from tournament hosting websites.
- **Proposed Technical Capability / Architecture**: Implement a token-bucket rate limiter in `server/utils/autonomousHunter.js` enforcing a minimum 2.5-second spacing between requests to the same origin domain, backed by randomized exponential jitter (`backoff = Math.min(30000, base * 2^attempt + Math.random() * 1000)`).
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### HUNTER-11: Zero-Quota Fast Pre-Filter for Non-Badminton Content
- **Problem Statement**: Invoking multimodal LLM endpoints on every routine collegiate club post (GBMs, bake sales, dues announcements, tryouts) rapidly depletes free-tier AI budgets.
- **Proposed Technical Capability / Architecture**: Fast regex pre-filter (`fastHeuristicPreFilter`) executing in $< 1\text{ms}$ that categorizes and skips non-tournament posts (recaps, congrats, dues, board meetings) unless explicit registration triggers are detected (`register now|registration link|entry fee|deadline`).
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### HUNTER-12: TournamentSoftware Regional League Harvester
- **Problem Statement**: Official USAB-sanctioned and Mid-Atlantic collegiate regional draws are hosted on TournamentSoftware.com, which requires cookie sessions and specific league search parameters.
- **Proposed Technical Capability / Architecture**: Build a specialized crawler (`server/utils/tournamentSoftwareCrawler.js`) that injects required session cookies (`sport=2`), queries regional organization IDs (Mid-Atlantic Badminton Association, USAB Northeast), extracts tournament sanction codes, division draws, and entry lists, and ingests them into `DiscoveryQueue`.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Medium

### HUNTER-13: RFC 5545 iCalendar (.ics) Stream Ingestion
- **Problem Statement**: University athletic departments and recreational sports boards publish tournament dates as public `.ics` calendar subscriptions rather than social media graphics.
- **Proposed Technical Capability / Architecture**: Add an RFC 5545 compliant parser (`parseIcsContent` in `server/utils/campusGroupsBypass.js`) that handles line unfolding, `VEVENT` extraction, timezone normalization, and recurring event expansion for collegiate campus recreation calendar feeds.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### HUNTER-14: Scraper Health & Pipeline Telemetry Metrics
- **Problem Statement**: Silent scraping failures caused by website DOM layout changes or dead club accounts go undetected until students report missing tournaments.
- **Proposed Technical Capability / Architecture**: Telemetry logging collector tracking scraping cycle durations, item yields per club handle, AI confidence distributions, and error rates, exposed via a protected health status endpoint (`GET /api/admin/tournaments/telemetry`).
- **Expected Impact Score**: 7/10
- **Implementation Complexity**: Low

---

## Category 2: Ingestion Quality & Duplicate Prevention (10 Ideas)

*Focus: Fuzzy clustering, machine learning candidate pruning, cross-collection indexing, entity conflict guards, and title sanitization.*

### QUALITY-01: Hybrid Machine Learning Similarity Ensemble
- **Problem Statement**: Single-metric string matching fails when different sources announce the same tournament under varying naming styles (e.g., *"GMU Spring Open"* vs *"2026 George Mason Badminton Invitational"*).
- **Proposed Technical Capability / Architecture**: Multi-metric ensemble in `server/utils/deduplication.js` combining sub-word TF-IDF Cosine similarity (40% weight), Jaro-Winkler distance (35% weight), and Levenshtein edit distance (25% weight). Merges tournament records when the composite score $\ge 0.85$ within a 48-hour date window.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Medium

### QUALITY-02: Multi-Stage ML Candidate Pruning Pipeline
- **Problem Statement**: Performing comprehensive string similarity comparisons of every newly scraped candidate against all historical database entries is an $O(N \cdot M)$ operation that causes server latency spikes as the archive grows.
- **Proposed Technical Capability / Architecture**: Three-stage candidate pruning pipeline (`shouldPruneCandidate`): Stage 1 drops candidate pairs with date delta $> 48$ hours in $O(1)$; Stage 2 drops pairs with character length ratios $> 3.5:1$; Stage 3 checks an inverted token index requiring non-stopword token or character trigram overlap before executing expensive distance metrics.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### QUALITY-03: Collegiate Entity Clash Guard
- **Problem Statement**: Different universities frequently host tournaments on the same weekend with similar generic titles (e.g., *"GMU Open"* vs *"UMD Open"* on Nov 7, 2026), tricking standard fuzzy matchers into merging two completely different university tournaments into a single corrupt record.
- **Proposed Technical Capability / Architecture**: Tokenized entity conflict guard (`hasConflictingCollegiateEntities`) that extracts university acronyms and mascot tokens (GMU, UMD, UVA, VT, GWU, JHU). If both tournaments reference conflicting collegiate entities, the system forcibly prohibits merging regardless of high string similarity.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### QUALITY-04: Cross-Collection Canonical Deduplication
- **Problem Statement**: Checking duplicate entries against only the live `Tournament` collection allows duplicate announcements to spawn multiple identical cards within the pending `ProposedTournament` collection, cluttering the admin review queue.
- **Proposed Technical Capability / Architecture**: Cross-collection deduplication index that queries both live active tournaments and pending review proposals simultaneously. When a match is detected, the system augments the existing canonical record with newly discovered flight divisions and alternative registration links instead of inserting a redundant proposal.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Medium

### QUALITY-05: Navigation Debris & Title Boilerplate Sanitizer
- **Problem Statement**: Web scrapers frequently capture website header elements and CMS navigation anchors (e.g., *"Skip to main content - Mason Open"* or *"Menu Select | Capital Badminton"*), polluting public tournament cards with UI junk.
- **Proposed Technical Capability / Architecture**: Delimiter-aware title sanitizer (`cleanTitle` in `server/utils/sanitizeScrapedTitle.js`) that strips leading navigation anchors, CMS slogans, and trailing pipes/dashes while preserving genuine tournament names. Rejects items whose title consists entirely of boilerplate.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### QUALITY-06: Division Draw Normalization & Flight Merging
- **Problem Statement**: Regional tournaments list flight categories using non-standardized terminology (e.g., *"Flight A"*, *"Open Singles"*, *"Division 1"*, *"Upper Intermediate"*), causing inconsistent UI filters.
- **Proposed Technical Capability / Architecture**: Flight classification engine (`normalizeDivisionKey`) mapping diverse division strings into standardized BWF/USAB tiers (Open Flight, Flight A, Flight B, Flight C, Collegiate Team, Junior U19) and merging unique flight structures into the canonical tournament document.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### QUALITY-07: Historical Annually Recurring Event Linker
- **Problem Statement**: Tournaments recurring annually (e.g., GMU Open 2026 vs GMU Open 2027) lose connection to previous year brackets, seeds, and champion records.
- **Proposed Technical Capability / Architecture**: Introduce a `TournamentSeries` model linking recurring tournament editions, enabling multi-year player head-to-head records and historical bracket archiving.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Medium

### QUALITY-08: Attendee & RSVP Bi-Directional Consolidation
- **Problem Statement**: Merging duplicate tournament cards risks dropping players who RSVP'd on the secondary duplicate entry.
- **Proposed Technical Capability / Architecture**: Transactional attendee reconciliation merging user ID arrays, preserving earliest registration timestamps, recalculating `rsvpCount`, and adjusting waitlist positions idempotently.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### QUALITY-09: Compound Spatial & Temporal Database Indexing
- **Problem Statement**: High-concurrency deduplication checks during scraping spikes cause MongoDB full collection scans, exhausting database CPU.
- **Proposed Technical Capability / Architecture**: Compound MongoDB indexes on `Tournament` and `ProposedTournament` (`{ status: 1, startDate: 1 }`, `{ hostClubHandle: 1, startDate: 1 }`, `{ sourceUrl: 1 }`), ensuring dedup queries execute in $< 5\text{ms}$.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### QUALITY-10: Automated Anomaly & Low-Confidence Scoring Badge
- **Problem Statement**: Admins reviewing proposed tournaments must manually inspect every field to determine which data points the AI was uncertain about.
- **Proposed Technical Capability / Architecture**: Field-level confidence scoring assigning individual weights to date, fee, venue, and divisions, highlighting fields below 80% with visual amber badges and explanatory tooltips in the admin console.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

---

## Category 3: Link Health & Reliability (6 Ideas)

*Focus: Automated HTTP probing, 404/DNS detection, verified fallback routing, and link status lifecycle.*

### LINK-01: Two-Phase Pre-Flight HTTP Health Prober
- **Problem Statement**: External registration links become invalid over time (expired Google Forms, closed registrations, domain expirations), leading players to dead 404 pages.
- **Proposed Technical Capability / Architecture**: Automated link validator (`verifyLinkHealth` in `server/utils/linkHealthChecker.js`) issuing non-blocking HTTP HEAD requests with automatic fallback to lightweight GET (capped at 50KB) on HTTP 405 Method Not Allowed, verifying HTTP 200–399 status.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### LINK-02: Verified Host Club Homepage Fallback Router
- **Problem Statement**: When an external registration link expires or breaks, players are left without any way to find alternative entry or contact details for the host club.
- **Proposed Technical Capability / Architecture**: Dynamic fallback resolver (`resolveHostClubFallback`) that inspects club handle and venue metadata, mapping expired links to verified club Linktree pages or primary homepages (e.g. `@gmu_badminton` $\to$ `https://linktr.ee/gmubadminton`).
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### LINK-03: Scheduled Cron Healthcheck Crawler & Redis Cache Purge
- **Problem Statement**: Registration links that were active at discovery time break days or weeks later as organizers close forms.
- **Proposed Technical Capability / Architecture**: Scheduled cron worker (`runTournamentLinkHealthcheck`) running every 6 hours, querying active tournaments in batches of 25, updating `linkStatus`, and instantly evicting affected Redis cache keys (`tournaments:active_keys`).
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### LINK-04: Client-Side Expired Link Warning Badge & UX Redirector
- **Problem Statement**: Users clicking broken links experience jarring browser 404 pages with no explanation.
- **Proposed Technical Capability / Architecture**: Frontend UI component in `Tournaments.jsx` rendering an amber `"Registration Link Expired"` badge with a secondary button: `"Visit Host Club Linktree / Website"`.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### LINK-05: Google Forms Closed Acceptance Detection
- **Problem Statement**: Google Forms that have reached capacity still return HTTP 200 OK but display *"This form is no longer accepting responses"*, misleading HTTP status checkers.
- **Proposed Technical Capability / Architecture**: Specialized content validator for Google Forms URLs that fetches the initial 10KB of HTML and inspects for closed form markers (`"no longer accepting responses"`, `"form closed"`, `"has ended"`), marking `linkStatus: 'expired'`.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### LINK-06: Link Shortener Expander & Redirect Chain Audit
- **Problem Statement**: Clubs frequently share shortlinks (`bit.ly`, `tinyurl.com`, `t.co`) that obscure the ultimate registration platform and may expire or redirect to dead pages.
- **Proposed Technical Capability / Architecture**: Redirect chain resolver tracking up to 5 hops, recording the canonical destination URL in `registrationUrl` while validating security against malicious domains.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

---

## Category 4: Admin Governance & Human-in-the-Loop Workflow (10 Ideas)

*Focus: Review queue guarantees, split-screen verification, inline editing, one-click approvals, and audit trails.*

### ADMIN-01: Split-Screen Flyer Reviewer & Synchronized Zoom
- **Problem Statement**: Admins reviewing AI-scraped tournaments must switch between tabs to verify raw flyer images against extracted form data.
- **Proposed Technical Capability / Architecture**: Split-screen modal in `TournamentApprovals.jsx`: Left pane features high-resolution flyer image with smooth mousewheel pan/pinch zoom; Right pane presents editable structured form fields.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### ADMIN-02: Zero-Live-Publish Invariant & Public Endpoint Gate
- **Problem Statement**: Automated scrapers publishing directly to public feeds risk displaying incorrect dates, offensive captions, or duplicate events to campus users.
- **Proposed Technical Capability / Architecture**: Architectural invariant: all discovered tournaments route strictly to `ProposedTournament` with `status: 'pending'`. Public endpoint `/api/tournaments` strictly queries `Tournament` model, guaranteeing zero unapproved tournaments appear live.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### ADMIN-03: Inline Division Draw & Entry Fee Editor
- **Problem Statement**: AI extraction may misread entry fees or omit niche flight divisions (e.g. Mixed Doubles Senior).
- **Proposed Technical Capability / Architecture**: Interactive division builder in the admin review modal allowing inline adding, editing, and deleting of division codes, fee amounts, and maximum draw sizes prior to approval.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### ADMIN-04: One-Click Approval with Atomic Cache Invalidation
- **Problem Statement**: Approving a tournament requires creating the live record, updating proposal status, notifying users, and clearing stale Redis cache keys, which can fail partially.
- **Proposed Technical Capability / Architecture**: Transactional approval endpoint (`POST /api/admin/tournaments/approve/:id`) that saves the live `Tournament`, marks proposal as approved, triggers Redis tagged cache invalidation (`tournaments:active_keys`), and emits a real-time `tournamentApproved` WebSocket event.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### ADMIN-05: Dateless Discovery Review Drawer with TBD Badging
- **Problem Statement**: Discarding tournaments with unannounced dates loses valuable upcoming events, while populating speculative dates misleads players.
- **Proposed Technical Capability / Architecture**: Dedicated admin queue filter for "Dateless / Upcoming" proposals. Displays events with prominent "Date TBD" chips, enabling admins to insert verified dates once announced or monitor the host club.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### ADMIN-06: Batch Bulk Approval & Rejection Controller
- **Problem Statement**: During active tournament season, reviewing dozens of verified club events one-by-one is tedious for club officers.
- **Proposed Technical Capability / Architecture**: Multi-select checkbox table in `TournamentApprovals.jsx` supporting bulk "Approve Selected" and "Reject Selected" with reason prompt and progress bar feedback.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### ADMIN-07: Cryptographic Point-by-Point Score Audit Ledger
- **Problem Statement**: In competitive tournament finals, disputed scores or accidental umpire entries need immutable verification.
- **Proposed Technical Capability / Architecture**: HMAC-SHA256 signature chain on match point mutations (`pointHistory.signature`) logged in MongoDB, with an admin audit drawer verifying tamper-free scoring history.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Medium

### ADMIN-08: Admin Role-Based Access Control (RBAC) Hardening
- **Problem Statement**: Non-admin users or compromised JWT tokens could attempt to approve or delete tournament proposals.
- **Proposed Technical Capability / Architecture**: Express middleware enforcing strict verification: `authMiddleware` verifies signature and expiration, and `adminMiddleware` strictly checks `req.user.role === 'admin'`. Destructive actions are governed by IP rate limiters.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### ADMIN-09: Live Tournament Wipe & Clean Slate Seeding Controller
- **Problem Statement**: During system upgrades or testing, clearing legacy test data without dropping production collections requires manual database scripting.
- **Proposed Technical Capability / Architecture**: Secure admin endpoint (`POST /api/admin/tournaments/wipe-and-restart`) that purges stale proposals and re-seeds verified 2026/2027 regional tournaments (GMU Open, NVBC Open, Mid-Atlantic Championships) in $< 100\text{ms}$.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### ADMIN-10: Push Notification Broadcast Dispatcher upon Approval
- **Problem Statement**: Players must repeatedly check the website to learn when regional tournament registrations open.
- **Proposed Technical Capability / Architecture**: Automated notification trigger upon tournament approval: dispatches in-app notifications and Web Push alerts to registered players based on preferred travel radius and university affiliation.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Medium

---

## Category 5: Community Platform & Real-Time Engagement (10 Ideas)

*Focus: Elo/Glicko-2 ratings, live RAC court tracking, mobile umpire scorekeeper, and matchmaking.*

### COMMUNITY-01: Glicko-2 Dynamic Matchmaking Rating (MMR) Engine
- **Problem Statement**: Standard Elo fails to account for player skill volatility, match confidence, or rating deviation decay during academic off-seasons.
- **Proposed Technical Capability / Architecture**: Glicko-2 engine (`server/utils/glicko2.js`) tracking Rating ($R$), Rating Deviation ($RD$), and Volatility ($\sigma$), auto-decaying confidence ($RD \to 350$) for inactive players.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### COMMUNITY-02: Live RAC Gymnasium Court Status Tracker
- **Problem Statement**: Mason students traveling to the Recreation Athletic Complex (RAC) have no live visibility into whether badminton courts (Courts 1–6) are available or occupied.
- **Proposed Technical Capability / Architecture**: Real-time court status monitor scraping and syncing Mason RAC gym open-recreation hours and club practice reservations, displayed as a responsive glassmorphism widget with Redis caching.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### COMMUNITY-03: Mobile-Optimized Umpire Digital Pad
- **Problem Statement**: Tournament umpires relying on paper score sheets create delays in updating public brackets and match scoreboards.
- **Proposed Technical Capability / Architecture**: Ergonomic touch-first mobile interface (`client/src/components/UmpireDigitalPad.jsx`) with giant tap zones, service court indicators (Right/Left), point undo/redo, and sub-50ms WebSocket broadcasting.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Medium

### COMMUNITY-04: Strict BWF 21-Point Rally Rules Engine
- **Problem Statement**: Custom scoring logic causes disputes when matches reach deuce (20–20) or extended play.
- **Proposed Technical Capability / Architecture**: BWF rules validator (`server/utils/bwfRules.js`) enforcing official regulations: 2-point clear lead, golden point ceiling at 30 (29–29 resolves at 30–29), 60s/120s interval timers, and Game 3 side change at 11 points.
- **Expected Impact Score**: 10/10
- **Implementation Complexity**: Low

### COMMUNITY-05: Hardware-Accelerated Interactive Bracket Visualizer
- **Problem Statement**: Traditional HTML table brackets break on mobile screens and do not support fluid zoom or pan for 64-player draws.
- **Proposed Technical Capability / Architecture**: Custom SVG bracket visualizer with CSS `matrix3d` transform controls, pinch-to-zoom gestures, cubic Bezier connecting lines, and real-time winner advancement animations.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### COMMUNITY-06: RAC Courts 1–6 Scheduling & Deadlock Prevention
- **Problem Statement**: Gymnasium courts sit idle while waiting for players who are already competing on another court or haven't reported.
- **Proposed Technical Capability / Architecture**: Court queue manager (`server/routes/courts.js`) with dynamic match duration estimation, 10-minute walkover forfeit countdown timers, and automated FIFO queue advancement across RAC Courts 1–6.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### COMMUNITY-07: Offline PWA Umpire Pad & IndexedDB Sync
- **Problem Statement**: Gymnasium Wi-Fi dead zones cause mobile umpire pads to lose connection and drop match scores.
- **Proposed Technical Capability / Architecture**: Service Worker and IndexedDB scoring ledger buffering point increments locally during network loss and sequentially replaying mutations to the server upon reconnection.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Medium

### COMMUNITY-08: Player Skill-Matched Partner & Opponent Matchmaking
- **Problem Statement**: Recreational players struggle to find doubles partners or singles sparring partners with comparable skill levels.
- **Proposed Technical Capability / Architecture**: Matchmaking recommendation engine (`server/routes/matchmaking.js`) pairing players within $\pm 150$ Glicko-2 rating points, filtering by preferred availability times and campus locations.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

### COMMUNITY-09: Atomic RSVP Capacity Enforcement & FIFO Waitlist
- **Problem Statement**: Popular tournaments fill instantly; concurrent registrations cause overbooking beyond gym court capacity.
- **Proposed Technical Capability / Architecture**: Atomic MongoDB `findOneAndUpdate` conditioned on `attendees.length < maxCapacity`, automatically routing excess registrants into a FIFO waitlist and auto-promoting next candidates upon cancellation.
- **Expected Impact Score**: 9/10
- **Implementation Complexity**: Low

### COMMUNITY-10: Public Kiosk Scoreboard Mode for Gym Wall Displays
- **Problem Statement**: Spectators at tournament venues must crowd around umpire clipboards to check scores.
- **Proposed Technical Capability / Architecture**: High-contrast, full-screen kiosk display view (`/tournaments/:id/kiosk`) designed for 55-inch gymnasium TV monitors, auto-refreshing match progression and live court scores over WebSockets.
- **Expected Impact Score**: 8/10
- **Implementation Complexity**: Low

---

## 50-Idea Master Prioritization Matrix

| ID | Title | Category | Impact (1-10) | Complexity | Target Release |
|---|---|---|---|---|---|
| HUNTER-01 | Multimodal Vision OCR Flyer Parsing Engine | AI Tournament Hunter | 10 | Medium | v2.0 |
| HUNTER-02 | Deep Linktree & Social Bio Hierarchy Traversal | AI Tournament Hunter | 9 | Low | v2.0 |
| HUNTER-03 | Google Forms Deep Schema & Field Extraction | AI Tournament Hunter | 9 | Medium | v2.0 |
| HUNTER-04 | Collegiate Club Schedule Radar & Target Discovery | AI Tournament Hunter | 8 | Medium | v2.1 |
| HUNTER-05 | Multi-Model AI Routing & Circuit-Breaker Cascade | AI Tournament Hunter | 9 | Low | v2.0 |
| HUNTER-06 | Geofenced DMV Venue & Campus Facility Resolver | AI Tournament Hunter | 8 | Low | v2.0 |
| HUNTER-07 | Temporal Horizon Validator & Stale Post Rejection | AI Tournament Hunter | 10 | Low | v1.5 |
| HUNTER-08 | Flyer QR Code High-Resolution Decoder | AI Tournament Hunter | 9 | Medium | v2.1 |
| HUNTER-09 | Scraper Memory Ceiling & GC Microtask Governance | AI Tournament Hunter | 10 | Low | v1.5 |
| HUNTER-10 | Rate-Limited Queue Worker with Exponential Jitter | AI Tournament Hunter | 8 | Low | v1.5 |
| HUNTER-11 | Zero-Quota Fast Pre-Filter for Non-Badminton Content | AI Tournament Hunter | 9 | Low | v1.5 |
| HUNTER-12 | TournamentSoftware Regional League Harvester | AI Tournament Hunter | 8 | Medium | v2.1 |
| HUNTER-13 | RFC 5545 iCalendar (.ics) Stream Ingestion | AI Tournament Hunter | 8 | Low | v2.0 |
| HUNTER-14 | Scraper Health & Pipeline Telemetry Metrics | AI Tournament Hunter | 7 | Low | v2.0 |
| QUALITY-01 | Hybrid Machine Learning Similarity Ensemble | Ingestion Quality | 10 | Medium | v1.5 |
| QUALITY-02 | Multi-Stage ML Candidate Pruning Pipeline | Ingestion Quality | 9 | Low | v1.5 |
| QUALITY-03 | Collegiate Entity Clash Guard | Ingestion Quality | 10 | Low | v1.5 |
| QUALITY-04 | Cross-Collection Canonical Deduplication | Ingestion Quality | 10 | Medium | v1.5 |
| QUALITY-05 | Navigation Debris & Title Boilerplate Sanitizer | Ingestion Quality | 9 | Low | v1.5 |
| QUALITY-06 | Division Draw Normalization & Flight Merging | Ingestion Quality | 9 | Medium | v2.0 |
| QUALITY-07 | Historical Annually Recurring Event Linker | Ingestion Quality | 8 | Medium | v2.2 |
| QUALITY-08 | Attendee & RSVP Bi-Directional Consolidation | Ingestion Quality | 9 | Medium | v2.0 |
| QUALITY-09 | Compound Spatial & Temporal Database Indexing | Ingestion Quality | 8 | Low | v1.5 |
| QUALITY-10 | Automated Anomaly & Low-Confidence Scoring Badge | Ingestion Quality | 9 | Low | v2.0 |
| LINK-01 | Two-Phase Pre-Flight HTTP Health Prober | Link Health | 10 | Low | v1.5 |
| LINK-02 | Verified Host Club Homepage Fallback Router | Link Health | 10 | Low | v1.5 |
| LINK-03 | Scheduled Cron Healthcheck Crawler & Redis Cache Purge | Link Health | 9 | Low | v2.0 |
| LINK-04 | Client-Side Expired Link Warning Badge & UX Redirector | Link Health | 9 | Low | v1.5 |
| LINK-05 | Google Forms Closed Acceptance Detection | Link Health | 9 | Medium | v2.0 |
| LINK-06 | Link Shortener Expander & Redirect Chain Audit | Link Health | 8 | Low | v2.0 |
| ADMIN-01 | Split-Screen Flyer Reviewer & Synchronized Zoom | Admin Governance | 10 | Low | v1.5 |
| ADMIN-02 | Zero-Live-Publish Invariant & Public Endpoint Gate | Admin Governance | 10 | Low | v1.5 |
| ADMIN-03 | Inline Division Draw & Entry Fee Editor | Admin Governance | 9 | Low | v1.5 |
| ADMIN-04 | One-Click Approval with Atomic Cache Invalidation | Admin Governance | 10 | Low | v1.5 |
| ADMIN-05 | Dateless Discovery Review Drawer with TBD Badging | Admin Governance | 9 | Low | v1.5 |
| ADMIN-06 | Batch Bulk Approval & Rejection Controller | Admin Governance | 8 | Low | v2.1 |
| ADMIN-07 | Cryptographic Point-by-Point Score Audit Ledger | Admin Governance | 8 | Medium | v2.2 |
| ADMIN-08 | Admin Role-Based Access Control (RBAC) Hardening | Admin Governance | 9 | Low | v1.5 |
| ADMIN-09 | Live Tournament Wipe & Clean Slate Seeding Controller | Admin Governance | 9 | Low | v1.5 |
| ADMIN-10 | Push Notification Broadcast Dispatcher upon Approval | Admin Governance | 8 | Medium | v2.0 |
| COMMUNITY-01 | Glicko-2 Dynamic Matchmaking Rating (MMR) Engine | Community & Fair Play | 9 | Medium | v1.5 |
| COMMUNITY-02 | Live RAC Gymnasium Court Status Tracker | Community & Fair Play | 9 | Medium | v2.0 |
| COMMUNITY-03 | Mobile-Optimized Umpire Digital Pad | Community & Fair Play | 10 | Medium | v1.5 |
| COMMUNITY-04 | Strict BWF 21-Point Rally Rules Engine | Community & Fair Play | 10 | Low | v1.5 |
| COMMUNITY-05 | Hardware-Accelerated Interactive Bracket Visualizer | Community & Fair Play | 9 | Medium | v2.0 |
| COMMUNITY-06 | RAC Courts 1–6 Scheduling & Deadlock Prevention | Community & Fair Play | 9 | Medium | v2.0 |
| COMMUNITY-07 | Offline PWA Umpire Pad & IndexedDB Sync | Community & Fair Play | 9 | Medium | v2.2 |
| COMMUNITY-08 | Player Skill-Matched Partner & Opponent Matchmaking | Community & Fair Play | 8 | Low | v1.5 |
| COMMUNITY-09 | Atomic RSVP Capacity Enforcement & FIFO Waitlist | Community & Fair Play | 9 | Low | v1.5 |
| COMMUNITY-10 | Public Kiosk Scoreboard Mode for Gym Wall Displays | Community & Fair Play | 8 | Low | v2.0 |
