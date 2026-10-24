# 🗺️ Mason Badminton Connect: Master Innovation Roadmap & Technical Blueprint

Welcome to the **Mason Badminton Connect** Innovation Roadmap! This document defines the engineering vision, architectural roadmap, and technical milestones for our collegiate badminton tournament platform.

For the exhaustive, specification-level master catalog of all 50 initiatives, see:
📖 **[`docs/architecture/ROADMAP_50_INNOVATION.md`](docs/architecture/ROADMAP_50_INNOVATION.md)**

For production-ready architectural blueprints, API contracts, and integration hooks for the Autonomous AI Tournament Hunter, see:
🏛️ **[`docs/architecture/TOURNAMENT_HUNTER_BLUEPRINTS.md`](docs/architecture/TOURNAMENT_HUNTER_BLUEPRINTS.md)**

---

## 📊 50-Idea Innovation Roadmap Summary

The roadmap is structured into **5 Mandatory Strategic Categories** spanning exactly **50 prioritized initiatives**. Exactly **30 of the 50 initiatives (60%)** directly strengthen our Autonomous AI Tournament Hunter, scraper accuracy, multimodal flyer OCR, and automated link reliability.

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

## 🤖 Category 1: Autonomous AI Tournament Hunter & Scraper Ecosystem (14 Ideas)

| ID | Initiative | Problem Statement | Technical Architecture | Impact (1-10) | Complexity |
|---|---|---|---|---|---|
| **HUNTER-01** | **Multimodal Vision OCR Flyer Parsing Engine** | 75% of collegiate tournament announcements are flyers with minimal captions; critical dates, fees, and flights are lost. | Stream flyer image bytes to Gemini 2.5 Flash Multimodal Vision API (`@google/genai`) with structured JSON schema (`Type.OBJECT`) to extract event details from pixels. | **10/10** | Medium |
| **HUNTER-02** | **Deep Linktree & Social Bio Hierarchy Traversal** | Captions say "link in bio"; aggregator linktrees contain obsolete or unlabelled buttons; handle mismatches fail hardcoded URLs. | Recursive bio link crawler in `server/utils/campusGroupsBypass.js` extracting true profile bio URLs, parsing buttons, and resolving `forms.gle` entry links. | **9/10** | Low |
| **HUNTER-03** | **Google Forms Deep Schema & Field Extraction** | Google Forms links are stored as opaque URLs, missing rich dates, fees, and division tiers in form headers and questions. | Headless HTTP parser in `campusGroupsBypass.js` fetching form HTML, parsing `FB_PUBLIC_LOAD_DATA_`, and extracting dates, fees, and division checkbox items. | **9/10** | Medium |
| **HUNTER-04** | **Collegiate Club Schedule Radar & Target Discovery** | Static club arrays miss newly formed collegiate clubs or training academies in the Mid-Atlantic. | Autonomous discovery worker using Apify social search and Google SERP dorks to dynamically register new active club handles into `TARGET_CLUBS`. | **8/10** | Medium |
| **HUNTER-05** | **Multi-Model AI Routing & Circuit-Breaker Cascade** | Single LLM dependency risks pipeline stoppage on HTTP 429 quota exhaustion or 503 service downtime. | Multi-tier AI router (`aiRouter.js`) cascading from Gemini 2.5 Flash Lite $\to$ Flash $\to$ Pro with an automated 5-minute circuit breaker to deterministic regex. | **9/10** | Low |
| **HUNTER-06** | **Geofenced DMV Venue & Campus Facility Resolver** | Captions use colloquial campus venue acronyms (*"RAC"*, *"SPH"*, *"Mem Gym"*) without university context. | Domain knowledge dictionary mapping facilities (GMU RAC, UMD SPH, UVA Mem Gym, VT McComas) and attaching canonical GPS coordinates and parking guidance. | **8/10** | Low |
| **HUNTER-07** | **Temporal Horizon Validator & Stale Post Rejection** | Crawlers ingest past tournament recaps (2024 results, anniversary posts), resurfacing dead events. | Multi-tier temporal gate rejecting posts $> 45$ days old, titles with past years ($\le 2025$), and events whose completion date is in the past. | **10/10** | Low |
| **HUNTER-08** | **Flyer QR Code High-Resolution Decoder** | Promotional tournament flyers embed registration links purely as visual QR codes without written text URLs. | Integrated WebAssembly QR scanner (`jsQR`) scanning high-contrast image quadrants to extract embedded registration URLs before AI downsampling. | **9/10** | Medium |
| **HUNTER-09** | **Scraper Memory Ceiling & GC Microtask Governance** | Cheerio DOM parsing on 512MB RAM cloud tiers (Render) triggers V8 heap crashes (OOM). | Two-tier heap check (200MB soft / 250MB hard pause), 200KB HTML string truncation, pointer dereferencing (`$ = null`), and microtask yielding (`setImmediate`). | **10/10** | Low |
| **HUNTER-10** | **Rate-Limited Queue Worker with Exponential Jitter** | Burst scraping triggers IP rate-limits and CAPTCHA walls from tournament websites. | Token-bucket rate limiter enforcing 2.5s domain spacing with randomized exponential backoff jitter on HTTP 429 responses. | **8/10** | Low |
| **HUNTER-11** | **Zero-Quota Fast Pre-Filter for Non-Badminton Content** | Invoking LLMs on non-tournament club updates (dues, GBMs, bake sales) exhausts free-tier AI budgets. | Fast regex pre-filter (`fastHeuristicPreFilter`) executing in $< 1\text{ms}$ that categorizes and skips non-tournament posts before LLM invocation. | **9/10** | Low |
| **HUNTER-12** | **TournamentSoftware Regional League Harvester** | Official sanctioned USAB/collegiate regional draws are hosted on TournamentSoftware with cookie sessions. | Specialized crawler (`tournamentSoftwareCrawler.js`) passing session cookies (`sport=2`), extracting tournament draws, sanction codes, and entry lists. | **8/10** | Medium |
| **HUNTER-13** | **RFC 5545 iCalendar (.ics) Stream Ingestion** | Athletic departments publish tournaments via public `.ics` subscriptions rather than social posts. | RFC 5545 compliant parser (`campusGroupsBypass.js`) handling line unfolding, VEVENT extraction, date normalization, and recurring event expansion. | **8/10** | Low |
| **HUNTER-14** | **Scraper Health & Pipeline Telemetry Metrics** | Scraping failures or dead club accounts go unnoticed until users report missing tournaments. | Telemetry collector tracking scrape cycle duration, item yields, AI confidence distributions, and error frequencies via `GET /api/admin/tournaments/telemetry`. | **7/10** | Low |

---

## 🎯 Category 2: Ingestion Quality & Duplicate Prevention (10 Ideas)

| ID | Initiative | Problem Statement | Technical Architecture | Impact (1-10) | Complexity |
|---|---|---|---|---|---|
| **QUALITY-01** | **Hybrid Machine Learning Similarity Ensemble** | Different sources announce same event with title variations (*"GMU Open"* vs *"2026 George Mason Invitational"*). | Ensemble in `server/utils/deduplication.js` combining TF-IDF Cosine (40%), Jaro-Winkler (35%), and Levenshtein (25%) with 0.85 threshold within 48h. | **10/10** | Medium |
| **QUALITY-02** | **Multi-Stage ML Candidate Pruning Pipeline** | Comparing all scraped items against full database is $O(N \cdot M)$, degrading response times. | 3-stage pruner (`shouldPruneCandidate`): Stage 1 date window ($>48\text{h}$ drops in $O(1)$), Stage 2 length ratio ($>3.5:1$ dropped), Stage 3 token inverted index. | **9/10** | Low |
| **QUALITY-03** | **Collegiate Entity Clash Guard** | Distinct universities host tournaments on same weekend, tricking naive matchers into merging them. | Tokenized entity extractor (`hasConflictingCollegiateEntities`) prohibiting merges between opposing collegiate institutions (e.g. GMU vs UMD). | **10/10** | Low |
| **QUALITY-04** | **Cross-Collection Canonical Deduplication** | Checking only live `Tournament` creates duplicate cards in pending `ProposedTournament`. | Cross-collection dedup engine querying live and proposed collections simultaneously, merging newly discovered flight divisions into canonical records. | **10/10** | Medium |
| **QUALITY-05** | **Navigation Debris & Title Boilerplate Sanitizer** | Web crawlers capture navigation headers (*"Skip to main content - Mason Open"*), polluting titles. | Delimiter-aware title sanitizer (`cleanTitle`) stripping navigation anchors, CMS slogans, and trailing pipes while preserving valid event titles. | **9/10** | Low |
| **QUALITY-06** | **Division Draw Normalization & Flight Merging** | Regional tournaments list flight tiers with inconsistent terminology (*"Flight A"*, *"Open Singles"*). | Classification rule engine (`normalizeDivisionKey`) mapping division strings into standardized BWF/USAB tiers and merging unique flights into canonical records. | **9/10** | Medium |
| **QUALITY-07** | **Historical Annually Recurring Event Linker** | Annual recurring tournaments (GMU Open 2026 vs 2027) lose connection to previous seeds and winners. | `TournamentSeries` model linking recurring tournament editions, enabling multi-year player head-to-head records and historical bracket archiving. | **8/10** | Medium |
| **QUALITY-08** | **Attendee & RSVP Bi-Directional Consolidation** | Merging duplicate tournament cards risks dropping players who RSVP'd on the secondary duplicate card. | Transactional attendee reconciliation merging user ID arrays, preserving earliest registration timestamps, recalculating `rsvpCount`, and adjusting waitlist. | **9/10** | Medium |
| **QUALITY-09** | **Compound Spatial & Temporal Database Indexing** | Deduplication checks during scraping spikes cause MongoDB full collection scans, exhausting CPU. | Compound MongoDB indexes on `Tournament` and `ProposedTournament` (`{ status: 1, startDate: 1 }`, `{ hostClubHandle: 1, startDate: 1 }`), optimizing queries to $<5\text{ms}$. | **8/10** | Low |
| **QUALITY-10** | **Automated Anomaly & Low-Confidence Scoring Badge** | Admins reviewing proposals must manually inspect every field to find AI extraction uncertainties. | Granular field-level confidence scoring assigning weights to date, fee, venue, and divisions, highlighting fields below 80% with visual amber badges. | **9/10** | Low |

---

## 🔗 Category 3: Link Health & Reliability (6 Ideas)

| ID | Initiative | Problem Statement | Technical Architecture | Impact (1-10) | Complexity |
|---|---|---|---|---|---|
| **LINK-01** | **Two-Phase Pre-Flight HTTP Health Prober** | Registration links expire or 404 over time, stranding players trying to sign up. | Automated link validator (`verifyLinkHealth`) issuing HTTP HEAD with fallback to lightweight GET (capped 50KB) on HTTP 405, verifying 200–399 status. | **10/10** | Low |
| **LINK-02** | **Verified Host Club Homepage Fallback Router** | When an external entry form breaks, players have no alternative way to contact the host club. | Dynamic fallback resolver (`resolveHostClubFallback`) routing expired links to verified host club Linktrees or homepages (e.g. `@gmu_badminton` $\to$ `linktr.ee/gmubadminton`). | **10/10** | Low |
| **LINK-03** | **Scheduled Cron Healthcheck Crawler & Redis Cache Purge** | Registration links that were active at discovery break days later as organizers close forms. | Scheduled cron worker (`runTournamentLinkHealthcheck`) running every 6 hours in batches of 25, updating `linkStatus`, and evicting Redis cache tags. | **9/10** | Low |
| **LINK-04** | **Client-Side Expired Link Warning Badge & UX Redirector** | Users clicking broken links experience jarring 404 browser pages with no explanation. | Frontend UI component in `Tournaments.jsx` rendering amber `"Registration Link Expired"` badge with secondary button: `"Visit Host Club Linktree / Website"`. | **9/10** | Low |
| **LINK-05** | **Google Forms Closed Acceptance Detection** | Full Google Forms return HTTP 200 OK while displaying *"no longer accepting responses"*. | Content validator fetching first 10KB of Google Forms HTML, checking for closed markers (`"no longer accepting responses"`), and marking `linkStatus: 'expired'`. | **9/10** | Medium |
| **LINK-06** | **Link Shortener Expander & Redirect Chain Audit** | Shortlinks (`bit.ly`, `tinyurl.com`) obscure ultimate registration platforms and may expire. | Multi-hop redirect resolver tracking up to 5 hops, recording canonical landing URL in `registrationUrl` while auditing against malicious domains. | **8/10** | Low |

---

## 🛡️ Category 4: Admin Governance & Human-in-the-Loop Workflow (10 Ideas)

| ID | Initiative | Problem Statement | Technical Architecture | Impact (1-10) | Complexity |
|---|---|---|---|---|---|
| **ADMIN-01** | **Split-Screen Flyer Reviewer & Synchronized Zoom** | Admins must flip between browser tabs to verify raw flyer images against AI form fields. | Split-screen modal in `TournamentApprovals.jsx`: Left pane displays flyer graphic with mousewheel pan/pinch zoom; Right pane presents editable form fields. | **10/10** | Low |
| **ADMIN-02** | **Zero-Live-Publish Invariant & Public Endpoint Gate** | Automated scrapers publishing live directly risk displaying incorrect dates or duplicate cards. | Architectural invariant: all discovered tournaments route strictly to `ProposedTournament` (`status: 'pending'`). Public `/api/tournaments` queries only `Tournament`. | **10/10** | Low |
| **ADMIN-03** | **Inline Division Draw & Entry Fee Editor** | AI extraction may misread fees or miss niche flight divisions (e.g. Mixed Doubles Senior). | Interactive division builder in review modal allowing inline addition, modification, and removal of division codes, fee amounts, and draw limits before approval. | **9/10** | Low |
| **ADMIN-04** | **One-Click Approval with Atomic Cache Invalidation** | Approving tournaments requires creating live record, updating proposal, and flushing Redis. | Transactional endpoint (`POST /api/admin/tournaments/approve/:id`) creating `Tournament`, updating proposal, evicting Redis tags, and emitting WebSocket event. | **10/10** | Low |
| **ADMIN-05** | **Dateless Discovery Review Drawer with TBD Badging** | Discarding dateless tournaments drops upcoming events; speculating fake dates misleads players. | Dedicated review queue filter for dateless proposals. Displays events with prominent "Date TBD" chips; admins enter verified date once announced. | **9/10** | Low |
| **ADMIN-06** | **Batch Bulk Approval & Rejection Controller** | Reviewing dozens of verified club events one-by-one is tedious for student club officers. | Multi-select table in `TournamentApprovals.jsx` supporting bulk "Approve Selected" and "Reject Selected" with reason prompt and progress bar feedback. | **8/10** | Low |
| **ADMIN-07** | **Cryptographic Point-by-Point Score Audit Ledger** | In tournament finals, disputed scores or accidental umpire entries need immutable verification. | HMAC-SHA256 signature chain on match point mutations logged in MongoDB, with an admin audit drawer verifying tamper-free scoring history. | **8/10** | Medium |
| **ADMIN-08** | **Admin Role-Based Access Control (RBAC) Hardening** | Unauthorized users or expired tokens could attempt to approve or delete tournament proposals. | Express middleware enforcing strict JWT verification: `authMiddleware` verifies signature; `adminMiddleware` strictly validates `req.user.role === 'admin'`. | **9/10** | Low |
| **ADMIN-09** | **Live Tournament Wipe & Clean Slate Seeding Controller** | Clearing test data during system upgrades requires manual database scripting. | Secure admin endpoint (`POST /api/admin/tournaments/wipe-and-restart`) purging stale proposals and re-seeding verified 2026/2027 regional tournaments in $<100\text{ms}$. | **9/10** | Low |
| **ADMIN-10** | **Push Notification Broadcast Dispatcher upon Approval** | Players must repeatedly check the site to discover when tournament registrations open. | Notification trigger upon tournament approval: dispatches in-app notifications and Web Push alerts to players based on travel radius and campus affiliation. | **8/10** | Medium |

---

## 🏸 Category 5: Community Platform & Real-Time Engagement (10 Ideas)

| ID | Initiative | Problem Statement | Technical Architecture | Impact (1-10) | Complexity |
|---|---|---|---|---|---|
| **COMMUNITY-01** | **Glicko-2 Dynamic Matchmaking Rating (MMR) Engine** | Standard Elo fails to track player rating volatility or confidence decay over summer break. | Glicko-2 engine (`server/utils/glicko2.js`) tracking Rating ($R$), Deviation ($RD$), and Volatility ($\sigma$), auto-decaying confidence ($RD \to 350$) for inactive players. | **9/10** | Medium |
| **COMMUNITY-02** | **Live RAC Gymnasium Court Status Tracker** | Students traveling to the RAC gym have no visibility into whether courts 1–6 are available. | Real-time court status monitor syncing Mason RAC open-recreation schedules and club practice reservations, displayed as a glassmorphism widget with Redis caching. | **9/10** | Medium |
| **COMMUNITY-03** | **Mobile-Optimized Umpire Digital Pad** | Paper score sheets cause delays in updating public brackets and match scoreboards. | Ergonomic touch-first mobile interface (`client/src/components/UmpireDigitalPad.jsx`) with giant tap zones, service court indicators, undo/redo, and WebSocket broadcast. | **10/10** | Medium |
| **COMMUNITY-04** | **Strict BWF 21-Point Rally Rules Engine** | Custom scoring logic causes disputes when matches reach deuce (20–20) or extended play. | BWF rules validator (`server/utils/bwfRules.js`) enforcing 2-point clear lead, golden point ceiling at 30 (29–29 resolves at 30–29), and Game 3 interval side change. | **10/10** | Low |
| **COMMUNITY-05** | **Hardware-Accelerated Interactive Bracket Visualizer** | HTML table brackets break on mobile screens and do not support fluid pan/zoom for 64-player draws. | Custom SVG bracket visualizer with CSS `matrix3d` transform controls, pinch-to-zoom gestures, cubic Bezier connecting lines, and live progression animations. | **9/10** | Medium |
| **COMMUNITY-06** | **RAC Courts 1–6 Scheduling & Deadlock Prevention** | Gymnasium courts sit idle waiting for players who are already competing on another court. | Court queue manager (`server/routes/courts.js`) with dynamic duration estimation, 10-minute walkover forfeit countdown, and automated FIFO queue advancement. | **9/10** | Medium |
| **COMMUNITY-07** | **Offline PWA Umpire Pad & IndexedDB Sync** | Gymnasium Wi-Fi dead zones cause mobile umpire pads to lose connection and drop match scores. | Service Worker and IndexedDB scoring ledger buffering point increments locally during network loss and sequentially replaying mutations upon reconnection. | **9/10** | Medium |
| **COMMUNITY-08** | **Player Skill-Matched Partner & Opponent Matchmaking** | Recreational players struggle to find doubles partners with comparable skill levels. | Recommendation engine (`server/routes/matchmaking.js`) pairing players within $\pm 150$ Glicko-2 rating points, filtering by preferred availability and campus locations. | **8/10** | Low |
| **COMMUNITY-09** | **Atomic RSVP Capacity Enforcement & FIFO Waitlist** | Popular tournaments fill instantly; concurrent registrations cause gym court overbooking. | Atomic MongoDB `findOneAndUpdate` conditioned on `attendees.length < maxCapacity`, routing excess registrants into FIFO waitlists with auto-promotion on cancellation. | **9/10** | Low |
| **COMMUNITY-10** | **Public Kiosk Scoreboard Mode for Gym Wall Displays** | Spectators at tournament venues must crowd around umpire clipboards to check scores. | High-contrast, full-screen kiosk display view (`/tournaments/:id/kiosk`) designed for 55-inch gymnasium TV monitors, auto-refreshing match scores over WebSockets. | **8/10** | Low |

---

## 🏛️ Architectural Blueprints & Deep-Dive Specifications

To inspect the full technical architecture, Gemini 2.5 Flash SDK prompts, Linktree/Forms crawler schemas, pre-flight healthcheck cascading logic, and review queue isolation guarantees, see:
👉 **[`docs/architecture/TOURNAMENT_HUNTER_BLUEPRINTS.md`](docs/architecture/TOURNAMENT_HUNTER_BLUEPRINTS.md)**

---

## 📅 Strategic Release Milestones

- **v1.0 (Foundation)**: Core Monorepo architecture, React 19 + MUI v6 Bento Grid, JWT Authentication, Forum, Scraper baseline, Docker Compose.
- **v1.5 (Ingestion & Reliability Overhaul — Current Milestone)**:
  - 50-Idea Innovation Roadmap (`ROADMAP_50_INNOVATION.md`)
  - Tournament Hunter Architectural Blueprints (`TOURNAMENT_HUNTER_BLUEPRINTS.md`)
  - Pre-flight automated link health verification & host club fallbacks
  - Machine learning ensemble deduplication & collegiate entity clash guard
  - Human-in-the-loop review queue isolation guarantees
  - Programmatic audit harness (`server/tests/tournament_hunter_audit.test.js`)
- **v2.0 (Autonomous AI & Real-Time Engagement)**:
  - Gemini 2.5 Flash Multimodal Vision flyer OCR integration
  - Deep Linktree multi-hop crawler & Google Forms schema parser
  - Live RAC Gymnasium Court Status Tracker
  - Interactive SVG bracket visualizer with hardware acceleration
  - Web Push notifications for regional tournament approvals
- **v2.1 (League Harvester & QR Decoding)**:
  - High-resolution flyer QR code decoder
  - TournamentSoftware regional league harvester
  - Batch bulk approval controller for club officers
- **v2.2 (Enterprise Tournament Operations)**:
  - Cryptographic point-by-point score audit ledger
  - Offline-first PWA Umpire Pad with IndexedDB replay
  - TournamentSeries multi-year historical analytics
