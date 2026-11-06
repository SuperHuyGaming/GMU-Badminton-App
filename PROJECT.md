# Project: UI Content Standards Audit & Alignment

## Architecture
- Client: React 18 SPA (Vite, Material-UI v5, Framer Motion, Vitest)
- Server: Node.js / Express REST API (MongoDB / Mongoose, Jest)
- Rule standard: `.agents/rules/ui_content_standards.md`
- PR & QA Workflow: `.agents/rules/pr_workflow.md`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Inclusive Fallback Copy | Replace exclusionary collegiate labels with "Open Tournament" / "Community Event" defaults in index.html, Tournaments.jsx, and scraper parsers | M1 | Survey 2 |
| 2 | Bottom-Right FAB & Minimized Pill | Align FeedbackFAB and minimized feedback pill to bottom-right corner horizontally adjacent to chat launcher without collision | M1 | Survey 2 |
| 3 | Contextual Feedback Pre-population | Fix FeedbackContext and FeedbackModal to accept title and description from ErrorBoundary and error triggers | M2 | Survey 3 |
| 4 | One-Click Screen Capture | Add 1-click "📷 Capture Screen" utility to FeedbackModal | M2 | Survey 3 |
| 5 | Admin Scraped Workflow Approval Auto-Save | Ensure TournamentApprovals handleApprove automatically persists uncommitted editForm changes before approval | M2 | Survey 3 |
| 6 | Comment Gamification Badge Cleanliness | Comment out remaining synthetic gamification badges (Smash Master, Clutch Performer, Community Guide, Streak) in PostCard.jsx and align tests | M3 | Survey 1 & 3 |
| 7 | Zero-Count Metric Wall Remediation | Replace prominent 0 counters and empty progress bars in ProfileIntro, Dashboard, and FeedbackManager with subtle text/borders | M3 | Survey 1 |
| 8 | Leaderboard Banner & Typography Alignment | Replace harsh 135deg gradient with crisp typography, subtle border, and soft elevation per CommunityDirectory design standards | M3 | Survey 1 |
| 9 | Card Micro-Interactions Suite | Add hover elevation (-4px), title highlight, and image zoom (scale 1.04, 0.35s) to Marketplace, CommunityDirectory, PostCard, SearchResults, FriendsTab, CourtQueueViewer | M3 | Survey 1 |
| 10 | Universal Keyboard Search Focus | Implement `/` and `Ctrl+K`/`Cmd+K` search focus with unfocused `/` shortcut pills in Navbar, SearchResults, Leaderboard, FriendsTab | M4 | Survey 1 |
| 11 | Instant Quick-Filter Pills & Reset Actions | Add dedicated "Reset Filters" action button to CommunityDirectory, Marketplace, SearchResults, FeedbackManager, and convert Marketplace category filter to instant in-memory | M4 | Survey 1 |
| 12 | Comprehensive Verification & QA Pipeline | Validate `npm test`, `npm run lint`, and `npm run build` across client and server with zero errors or warnings | M5 | Survey 1, 2, 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Public Scope Copy & Support Navigation Alignment | Inclusive copy updates across client and scraper utilities; bottom-right FAB and minimized pill placement | none | DONE |
| M2 | Feedback System & Admin Scraped Workflow Alignment | Contextual error diagnostics pre-population; 1-click screen capture in FeedbackModal; admin approve auto-save | M1 | DONE |
| M3 | Visual Styling, Metric Walls, Card Micro-Interactions & Comment Badge Cleanliness | Remove synthetic badges; subtle 0-count metric text; Leaderboard header polish; card hover elevation, title highlight, and image hover zoom | M1 | IN_PROGRESS |
| M4 | Universal Keyboard Search Focus & Instant Filter Reset Controls | `/` and `Ctrl+K` keyboard shortcuts with shortcut pills; instant in-memory filtering and "Reset Filters" action buttons | M3 | PLANNED |
| M5 | Comprehensive Verification & QA Pipeline | Full client and server test suites, linting, build checks, and forensic audit | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Feedback Context Diagnostics
- `openFeedbackModal(options)` accepts:
  - `type`: 'feedback' | 'bug' | 'feature'
  - `severity`: 'low' | 'medium' | 'high' | 'critical'
  - `title`: string
  - `description`: string
  - `pageUrl`: string
  - `initialData`: object

### Card Styling Micro-Interactions Standards
- Card root:
  - `transition: 'transform 0.25s ease, box-shadow 0.25s ease'`
  - `&:hover`: `{ transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,0,0,0.08)' }`
  - `&:hover .card-title`: `{ color: 'primary.main', transition: 'color 0.2s ease' }`
  - `&:hover img`: `{ transform: 'scale(1.04)', transition: 'transform 0.35s ease' }`

## Code Layout
- `client/src/components/FeedbackFAB.jsx` — Support FAB
- `client/src/components/FeedbackModal.jsx` — Non-blocking feedback dock
- `client/src/context/FeedbackContext.jsx` — Feedback state & draft management
- `client/src/pages/admin/TournamentApprovals.jsx` — Scraped tournament approval workflow
- `server/routes/adminTournaments.js` — Backend tournament admin persistence
- `client/src/components/PostCard.jsx` — Post card & comment integration
- `client/src/components/profile/ProfileIntro.jsx` — Profile stats & intro
- `client/src/pages/Dashboard.jsx` — Dashboard metrics & schedule
- `client/src/pages/Leaderboard.jsx` — Leaderboard & search
- `client/src/pages/CommunityDirectory.jsx` — Players directory & filters
- `client/src/pages/Marketplace.jsx` — Marketplace listings & category filters
- `client/src/pages/SearchResults.jsx` — Global search results & filters
- `client/src/pages/Tournaments.jsx` — Tournaments explorer & discovery dialogs
- `server/utils/campusGroupsBypass.js` — Scraper calendar parser
- `server/utils/aiParser.js` — Scraper caption parser
