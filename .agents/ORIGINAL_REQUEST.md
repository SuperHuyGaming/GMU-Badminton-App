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


## 2026-10-23T19:54:51Z

Develop a comprehensive 50-idea master innovation roadmap and technical blueprint for Mason Badminton Connect (GMU Badminton App), focusing on an enterprise-grade Autonomous AI Tournament Hunter, multimodal flyer vision parsing, deep link crawling, and admin governance.

Working directory: D:\GMU Badminton App
Integrity mode: development

## Requirements

### R1. 50-Idea Comprehensive Innovation Roadmap
Synthesize exactly 50 categorized, scored, and prioritized enhancement ideas for the Mason Badminton Connect ecosystem. The roadmap must span:
1. Autonomous AI Tournament Hunter & Scraper Ecosystem (Multimodal Vision for flyers, Linktree/Forms deep crawling, geofencing, temporal validation)
2. Ingestion Quality & Duplicate Prevention (Fuzzy clustering, cross-collection indexing, conflict guards)
3. Link Health & Reliability (Automated HTTP probing, 404 detection, verified fallback routing)
4. Admin Governance & Human-in-the-Loop Workflow (Review queue, inline date/division editing, one-click approvals)
5. Community Platform & Real-Time Engagement (Elo ratings, live RAC court tracking, matchmaking)

Each idea must include a clear problem statement, proposed technical capability, expected impact score (1-10), and implementation complexity (Low/Medium/High).

### R2. Tournament Hunter Deep-Dive & Architectural Blueprints
Deliver production-ready architectural blueprints and integration designs for the top-priority Tournament Hunter capabilities:
- Multimodal Vision AI ingestion for Instagram flyer graphics (extracting dates, venues, entry fees, and flight divisions directly from image pixels).
- Deep Linktree and Google Forms crawler to capture tournament specifics where captions omit details.
- Pre-flight automated link health verification to detect and prevent broken URLs from reaching public feeds.
- Human-admin review queue guarantees ensuring zero unapproved tournaments are ever published live.

### R3. Programmatic Verification & Audit Harness
Construct automated verification scripts and test suites to objectively validate:
- Zero unapproved tournaments are exposed on the public `/api/tournaments` endpoint.
- Broken registration links (e.g. 404s, DNS failures) are automatically detected and flagged with verified host club fallbacks.
- New discoveries without dates are safely enqueued as pending proposals with TBD markers rather than dropped or fabricated.

## Acceptance Criteria

### Roadmap Completeness
- [ ] Exactly 50 distinct, actionable ideas are articulated with problem, solution, impact (1-10), and complexity ratings.
- [ ] At least 25 of the 50 ideas directly address the Tournament Hunter, scraper accuracy, flyer OCR, and link verification.

### Architectural Rigor
- [ ] Detailed technical designs are provided for Multimodal Vision flyer extraction, Linktree/Google Forms deep parsing, and pre-flight link health probing.
- [ ] The human-in-the-loop governance model strictly preserves the invariant that zero unapproved tournaments appear in the public live feed.

### Objective Verification
- [ ] Programmatic test scripts execute cleanly and verify:
  - (1) GET `/api/tournaments` returns only human-approved tournaments.
  - (2) Link health verification correctly flags unreachable URLs and assigns verified club fallbacks.
  - (3) Dateless tournaments remain in the review queue with TBD status.
