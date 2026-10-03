# Scope: Phase 4 Admin Dashboard UI (Tournament Approvals)

## Architecture & Integration
- **Framework & Libraries**: React 18 / Vite, React Router DOM v7, Material UI (`@mui/material`), `react-hot-toast`, Vitest / React Testing Library.
- **Client Routing**:
  - `client/src/App.jsx`: Route `/admin/tournaments` wrapped in `<AdminRoute>` and animated via Framer Motion. Lazy-loaded via `React.lazy`.
- **Navigation Linking**:
  - `client/src/components/Navbar.jsx`: Desktop navbar button and mobile drawer list item for "Tournament Approvals" visible when `user && user.role === 'admin'`.
  - `client/src/pages/Admin.jsx`: Navigation banner/link to Tournament Approvals.
- **API Integration**:
  - `client/src/utils/api.js` (`apiFetch`): Injects `Authorization: Bearer <accessToken>`, auto-refreshes on 401, throws on non-2xx.
- **Backend Endpoints (`server/routes/adminTournaments.js`)**:
  - `GET /api/admin/tournaments/proposed`
  - `POST /api/admin/tournaments/approve/:id`
  - `POST /api/admin/tournaments/reject/:id`
  - `PUT /api/admin/tournaments/:id`
  - `POST /api/admin/tournaments/manual` (for manual entry creation)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Admin Route & Layout Guard | Create `/admin/tournaments` route protected by `AdminRoute` in `App.jsx`, link in `Navbar.jsx` (desktop & mobile drawer) | M1 | R1 |
| F2 | Review Queue UI | Fetch `GET /api/admin/tournaments/proposed`, render pending list with Table/Card layout, filter/refresh | M1 | R2 |
| F3 | Low Confidence Highlighting | Visually highlight proposals or fields with `confidenceScore < 80` (warning chips, border accents, alert badges) | M1 | R2 |
| F4 | Split-Screen Reviewer Modal | Dialog on proposal click: Left side shows raw scraped context (`rawCaption`, `scrapedImageUrls`, `sourceLinks`); Right side shows editable AI form (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`) | M1 | R3 |
| F5 | Approval & Rejection Actions | "Approve" (`POST /approve/:id`), "Reject" (`POST /reject/:id` with reason dialog), state updates, toast alerts | M1 | R4 |
| F6 | Save Edits Workflow | "Save Edits" button (`PUT /:id`), local state sync, toast alerts | M1 | R4 |
| F7 | Manual Tournament Entry | "Manual Entry" modal to create a tournament without scraping, posting to `/api/admin/tournaments/manual` | M1 | R4 |
| F8 | Client Automated Test Suite | `TournamentApprovals.test.jsx` covering queue render, low-confidence warning, modal inspection, approve, reject, save edit, manual entry | M1 | AC |
| F9 | PR & Autonomous QA Workflow | Branch `feature/tournament-admin-ui`, PR targeting `develop`, QA bot comment, QA validation, squash merge | M2 | PR Rule |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Tournament Approvals UI & Test Implementation | Features F1 - F8: Route, Navigation, Review Queue, Split-Screen Modal, Actions, Manual Entry, Unit Tests | none | IN_PROGRESS |
| 2 | PR Workflow & Autonomous QA Pipeline | Feature F9: Push branch, create PR, post bot comment, invoke QA subagent, squash merge | M1 | PLANNED |

## Interface Contracts & Schemas

### 1. `ProposedTournament` Schema Contract (from Phase 3)
```typescript
interface ProposedTournament {
  _id: string;
  tournamentName: string;
  date?: string;
  location?: string;
  entryFee?: string;
  registrationLink?: string;
  skillLevels?: string[];
  registrationDeadline?: string;
  sourceUrl: string;
  rawCaption?: string;
  scrapedImageUrls?: string[];
  sourceLinks?: string[];
  confidenceScore: number; // 0 - 100
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}
```

### 2. Endpoints Contract
1. `GET /api/admin/tournaments/proposed`
   - Returns: `ProposedTournament[]`
2. `POST /api/admin/tournaments/approve/:id`
   - Returns: `{ message: string, tournament: object, proposedTournament: object }`
3. `POST /api/admin/tournaments/reject/:id`
   - Body: `{ reason?: string }`
   - Returns: `{ message: string, proposedTournament: object }`
4. `PUT /api/admin/tournaments/:id`
   - Body: Partial editable fields (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`, `confidenceScore`)
   - Returns: `{ message: string, proposedTournament: object }`
5. `POST /api/admin/tournaments/manual`
   - Body: `{ tournamentName, startDate, endDate, eventLocation, registrationDeadline, registrationUrl, flyerImageUrl, skillLevels, entryFee }`
   - Returns: `{ message: string, tournament: object }`

### 3. Component Hierarchy & File Boundaries
- `client/src/pages/admin/TournamentApprovals.jsx`: Main view with queue table/cards, confidence highlight, modal controls.
- `client/src/pages/admin/TournamentApprovals.test.jsx`: Comprehensive test suite.
- `client/src/App.jsx`: Route definition with `<AdminRoute>`.
- `client/src/components/Navbar.jsx`: Admin navigation links.
- `client/src/pages/Admin.jsx`: Navigation shortcut to Approvals.
- `server/routes/adminTournaments.js`: Add `POST /manual` route for direct manual creation.

## Code Layout
- `client/src/pages/admin/TournamentApprovals.jsx` (New)
- `client/src/pages/admin/TournamentApprovals.test.jsx` (New)
- `client/src/App.jsx` (Modified: add route)
- `client/src/components/Navbar.jsx` (Modified: add nav link)
- `client/src/pages/Admin.jsx` (Modified: add link banner)
- `server/routes/adminTournaments.js` (Modified: add POST /manual)
- `server/tests/adminTournaments.test.js` (Modified/Verified: test POST /manual)
