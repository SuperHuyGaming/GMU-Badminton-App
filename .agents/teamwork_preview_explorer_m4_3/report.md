# Phase 4 Admin Dashboard UI: Comprehensive Investigation Report

**Explorer**: Explorer 3 (Tournament Pages, Admin UI Patterns, and Client Testing Setup)  
**Date**: October 3, 2026 (UTC) / October 2, 2026 (Local)  
**Target Module**: Phase 4 — Admin Dashboard UI for DMV Tournament Aggregation & Admin Approval System  
**Working Directory**: `.agents/teamwork_preview_explorer_m4_3/`

---

## Executive Summary

This investigation analyzed the frontend ecosystem of `GMU-Badminton-App` to guide the implementation of Phase 4: Admin Dashboard UI (`TournamentApprovals.jsx`), its supporting components, and automated test suite (`TournamentApprovals.test.jsx`).

Key findings include:
1. **Existing Tournament Modeling**: The current public tournament view (`client/src/pages/Tournaments.jsx`) consumes a Java microservice/external API (`/api/v1/tournaments`), rendering cards with flyer images, date, location, registration links, and an .ICS calendar exporter. In contrast, the new approval queue will consume the Node/Express backend (`/api/admin/tournaments/proposed`), which exposes richer scraped context (`rawCaption`, `scrapedImageUrls`, `sourceLinks`) alongside AI-structured fields and confidence scoring.
2. **Admin UI Patterns**: `client/src/pages/Admin.jsx` sets clear precedents for administrative workflows. It uses a hybrid layout of card-based moderation queues (for flagged content) and MUI tables (for user/message management). Modals consistently use rounded corners (`borderRadius: 3`), colored headers with inline icons, and standard actions (`Cancel` + action button). Toast notifications are powered by `react-hot-toast` (`toast.success` / `toast.error`).
3. **Client Test Infrastructure**: The client uses **Vitest v3.2.7** with `jsdom`, `@testing-library/react` v16.3.3, and `@testing-library/jest-dom`. All 12 test files (59 tests) pass in ~4 seconds, and `npm run lint` passes with 0 warnings.
4. **Mocking & Integration Patterns**: Existing tests cleanly isolate network calls by mocking `client/src/utils/api.js` (`apiFetch`) via `vi.mock('../utils/api')` and supplying authenticated admin state via `AuthContext.Provider value={{ user: { role: 'admin' } }}`.
5. **Testing Roadmap**: We have designed a complete, battle-tested specification for `TournamentApprovals.test.jsx` covering the 7 core requirements: queue rendering, low-confidence highlighting (< 80), split-screen modal display, approve workflow, reject workflow, inline/modal edit saving (`PUT`), and manual entry creation.

---

## 1. Investigation of Existing Tournament Views

### 1.1 `client/src/pages/Tournaments.jsx`
- **Location**: `client/src/pages/Tournaments.jsx` (262 lines).
- **Architecture**:
  - Fetches from `VITE_TOURNAMENT_API_URL` or fallback `/api/v1/tournaments` with pagination (`cursor`, `nextCursor`, `hasNext`).
  - Utilizes MUI Grid v2 (`<Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>` and `<Grid size={{ xs: 12, md: 6 }}>`).
- **Data Attributes Used in Public UI**:
  - `tournament.id` / `tournament._id`
  - `tournament.tournamentName`: Title heading (`h6`, `fontWeight="bold"`)
  - `tournament.eventLocation`: Preceded by `<MapPinIcon width={16} height={16} />`
  - `tournament.startDate`: Formatted via `new Date(startDate).toLocaleDateString()`
  - `tournament.flyerImageUrl`: Rendered in a fixed-height card header (`200px`, `objectFit: 'cover'`)
  - `tournament.originalCaption`: Text snippet truncated at 150 characters (`originalCaption.substring(0, 150) + "..."`)
  - `tournament.registrationUrl`: Big action button (`variant="contained" color="secondary"` GMU Gold `#FFCC33`, text `#002f17`)
- **Key Features to Borrow**:
  - **Flyer Image Container**: Uses responsive image container with `overflow: 'hidden'` and `borderRadius`.
  - **Export to ICS**: `handleExportICS(tournament)` generates standard `.ics` blob for calendar syncing.
  - **Empty State**: Uses dedicated `<EmptyTournaments />` component when list is empty.

### 1.2 `client/src/components/EmptyTournaments.jsx`
- Custom SVG graphic depicting an empty trophy/calendar case with a resting racket and spiderwebs.
- Text: "Our AI is Hunting..." and "Our autonomous AI engine is currently scouring the web for upcoming DMV tournaments."
- Matches the badminton theme; ideal for reuse or reference when the admin queue has 0 pending proposals.

### 1.3 `ProposedTournament` Schema vs Public `Tournament` Schema
| Field Category | `ProposedTournament` (Admin Queue) | `Tournament` (Approved / Public) |
| :--- | :--- | :--- |
| **Identity & Status** | `_id`, `status: 'pending'\|'approved'\|'rejected'`, `confidenceScore: 0-100` | `_id`, `isOpenTournament: Boolean` |
| **Raw Scraped Context** | `rawCaption` (String)<br>`scrapedImageUrls` ([String])<br>`sourceLinks` ([String])<br>`sourceUrl` (String) | `flyerImageUrl` (String)<br>`originalCaption` (String)<br>`sourceUrl` (String)<br>`instagramPostUrl` (String) |
| **AI Structured Data** | `tournamentName` (String)<br>`date` (Date)<br>`location` (String)<br>`entryFee` (String)<br>`registrationLink` (String)<br>`skillLevels` ([String])<br>`registrationDeadline` (Date) | `tournamentName` (String)<br>`startDate` / `endDate` (Date)<br>`eventLocation` (String)<br>`registrationDeadline` (Date)<br>`registrationUrl` (String)<br>`skillLevels` ([String]) |
| **Audit Metadata** | `approvedAt`, `approvedBy`, `rejectedAt`, `rejectionReason`, `createdTournamentId` | `rsvpCount`, `hostUniversity`, `createdAt` |

*Insight for Admin UI*: The Admin Reviewer must bridge the gap between `ProposedTournament` and `Tournament`. When an admin edits or approves, `ProposedTournament` fields (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`) are verified and pushed into the public `Tournament` collection via `POST /api/admin/tournaments/approve/:id`.

---

## 2. Investigation of Admin UI Patterns & Component Conventions

### 2.1 Page Layout & Typography
Inspected `client/src/pages/Admin.jsx`:
- **Top Container**:
  ```jsx
  <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 5 }, pb: 10, px: { xs: 1, sm: 2, md: 3 } }}>
  ```
- **Page Header**:
  ```jsx
  <Typography variant="h3" color="error.main" fontWeight="900" gutterBottom sx={{ fontSize: { xs: "2.2rem", md: "3rem" } }}>
      Tournament Approvals
  </Typography>
  <Typography variant="h6" color="text.primary">
      Review and approve AI-scraped tournaments before publishing.
  </Typography>
  ```
- **Queue Sections**: Headers use `variant="h5"` with an emoji icon and bold typography (e.g., `⚡ Pending Review Queue (4)`).

### 2.2 Card Layout vs Table Layout
`Admin.jsx` showcases both paradigms:
1. **Moderation Cards (Spam/Flagged Content)**:
   - Used when content has rich context (long text, author, metrics).
   - Wrapped in `<Paper elevation={0} sx={{ p: 3, mb: 2, borderRadius: 3, border: "2px solid", borderColor: ... }}>`.
   - Displays severity chips (`<Chip label="Score: 85%" color="success" size="small" />`).
   - Uses pre-wrapped text container: `<Typography sx={{ whiteSpace: "pre-wrap", p: 2, bgcolor: "background.paper", borderRadius: 2, border: "1px dashed divider" }}>`.
2. **MUI Table (User Management & All Messages)**:
   - Used for scanning multiple rows.
   - `<TableContainer component={Paper} elevation={0} sx={{ mb: 6, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>`.
   - `<Table sx={{ minWidth: 650 }}>` with `<TableHead sx={{ bgcolor: "background.default" }}>`.
   - Sticky or nowrap cells with `<TableRow hover>`.

*Recommendation for `TournamentApprovals.jsx`*:
A hybrid or toggleable approach works best:
- Primary View: A clean **Table or Card Queue** displaying:
  - Tournament Name & Date
  - Source domain / platform tag (e.g. `instagram.com`)
  - Confidence Score Badge (with low confidence highlight)
  - Extracted Fee & Location
  - Action buttons: `Review` (opens Split-Screen modal), `Quick Approve`, `Reject`.

### 2.3 Confidence Score Visual Highlighting Rules
The requirement mandates highlighting tournaments or specific fields that have a low `confidenceScore` (< 80):
- **Score >= 80% (High Confidence)**:
  - Chip: `color="success"`, e.g., `<Chip label="92% Confidence" color="success" size="small" sx={{ fontWeight: 'bold' }} />`
  - Border: Normal `divider` or subtle green.
- **Score 60% – 79% (Medium / Low Confidence)**:
  - Chip: `color="warning"`, e.g., `<Chip label="72% Low Confidence" color="warning" size="small" sx={{ fontWeight: 'bold' }} />`
  - Border: Warning accent (e.g., `border: "2px solid #E65100"` or amber).
  - Row Highlight: Light warning background tint (`rgba(230, 81, 0, 0.05)`).
- **Score < 60% (Critical / Poor AI Extraction)**:
  - Chip: `color="error"`, e.g., `<Chip label="45% Needs Verification" color="error" size="small" sx={{ fontWeight: 'bold' }} />`
  - Warning alert banner indicating: `"AI extraction confidence is below 80%. Please carefully verify dates, location, and links against the raw flyer."`
- **Field-Level Highlighting**:
  - Highlight missing or TBD values (e.g., `location === 'TBD'`, missing `registrationDeadline`, missing `entryFee`) with an orange warning indicator or `helperText="Field was not detected in flyer"`.

### 2.4 Split-Screen Reviewer Modal Conventions
Following MUI Dialog conventions in `Admin.jsx` and `Tournaments.jsx`:
- **Modal Component**:
  ```jsx
  <Dialog
      open={modalOpen}
      onClose={handleCloseModal}
      maxWidth="lg"
      fullWidth
      PaperProps={{
          sx: {
              borderRadius: 3,
              height: { xs: '90vh', md: '85vh' },
              display: 'flex',
              flexDirection: 'column'
          }
      }}
  >
  ```
- **Modal Header**:
  - Title: Proposal Name + Confidence Chip + Close button.
- **Modal Body (Split-Screen Grid)**:
  - Uses `<Grid container sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>`:
    - **Left Column (xs: 12, md: 6)** — Raw Scraped Context:
      - Scrollable container (`overflowY: 'auto'`).
      - Scraped Flyer Image: full width, zoom/click to expand, fallback placeholder if empty.
      - Raw Caption: `<Paper sx={{ p: 2, bgcolor: 'background.default', whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto', fontFamily: 'monospace' }}>`.
      - Source Links: Clickable `RouterLink` or external `<a>` tags with `target="_blank" rel="noopener noreferrer"`.
    - **Right Column (xs: 12, md: 6)** — Editable AI Structured Form:
      - Scrollable form container (`overflowY: 'auto'`, `p: 3`).
      - Form controls:
        - `tournamentName`: `<TextField label="Tournament Name" required fullWidth size="small" />`
        - `date`: `<TextField label="Tournament Date" type="date" InputLabelProps={{ shrink: true }} fullWidth size="small" />`
        - `registrationDeadline`: `<TextField label="Registration Deadline" type="date" InputLabelProps={{ shrink: true }} fullWidth size="small" />`
        - `location`: `<TextField label="Location / Venue" fullWidth size="small" />`
        - `entryFee`: `<TextField label="Entry Fee (e.g. $25)" fullWidth size="small" />`
        - `registrationLink`: `<TextField label="Registration URL" fullWidth size="small" />`
        - `skillLevels`: Multi-chip input or comma-delimited input (`"A, B, C, D"`).
- **Modal Footer (`DialogActions`)**:
  - Left: "Save Edits" button (`variant="outlined" color="primary"`).
  - Right:
    - "Reject" button (`variant="outlined" color="error"`).
    - "Approve & Publish" button (`variant="contained" color="success"` or GMU green `#004d26`).

### 2.5 Toast Notifications & Feedback
- `client/src/App.jsx` mounts `<Toaster position="top-center" reverseOrder={false} />`.
- `react-hot-toast` is the application standard (`import toast from 'react-hot-toast'`).
- Actions:
  - On Approve: `toast.success('Tournament approved and published!')`
  - On Reject: `toast.success('Tournament proposal rejected.')`
  - On Save Edit: `toast.success('Tournament details updated successfully.')`
  - On Error: `toast.error(err.message || 'Action failed. Please try again.')`

### 2.6 Manual Entry Action
Requirement R4 asks for a "Manual Entry" button.
- UI: Placed in the top action bar: `<Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenManualModal}>Manual Entry</Button>`.
- Behavior: Opens the Reviewer Modal in "blank" mode (or dedicated modal):
  - Left pane: Optional flyer image upload or blank context.
  - Right pane: Blank form with required fields.
  - On Submit:
    - To maintain Phase 3 database consistency, it can invoke `POST /api/scrape/submit-pending` OR a dedicated endpoint `POST /api/admin/tournaments/manual`.

---

## 3. Investigation of Client Testing Setup & Mocking Patterns

### 3.1 Test Framework Configuration
- **Package Scripts** (`client/package.json`):
  - `"test": "vitest run"`
  - `"lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0"`
- **Dependencies**:
  - `vitest`: `^3.2.7`
  - `@testing-library/react`: `^16.3.3`
  - `@testing-library/jest-dom`: `^7.0.1`
  - `jsdom`: `^27.0.1`
- **Config** (`client/vite.config.js`):
  ```js
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 20000
  }
  ```
- **Global Setup** (`client/src/setupTests.js`):
  - Imports `@testing-library/jest-dom`.
  - Injects `globalThis.React = React` and `window.React = React`.

### 3.2 Existing Mocking Patterns in Client Tests
Inspected `Leaderboard.test.jsx`, `CommunityDirectory.test.jsx`, and `Navbar.test.jsx`:

1. **Mocking `apiFetch` (`client/src/utils/api.js`)**:
   ```javascript
   import apiFetch from '../utils/api';
   vi.mock('../utils/api', () => ({
       default: vi.fn(),
   }));
   ```
   *Usage in tests*:
   ```javascript
   apiFetch.mockResolvedValueOnce({
       ok: true,
       json: async () => mockData,
   });
   ```
   Or route-selective mocking:
   ```javascript
   apiFetch.mockImplementation(async (url, options) => {
       if (url.includes('/api/admin/tournaments/proposed')) {
           return { ok: true, json: async () => [mockProposal] };
       }
       if (url.includes('/approve/')) {
           return { ok: true, json: async () => ({ message: 'Approved' }) };
       }
       return { ok: true, json: async () => ({}) };
   });
   ```

2. **Mocking Auth Context (`client/src/context/AuthContext.jsx`)**:
   In `Navbar.test.jsx`:
   ```javascript
   import { AuthContext } from '../context/AuthContext';

   const mockAdminUser = {
       id: 'admin-1',
       _id: 'admin-1',
       name: 'Admin Tester',
       email: 'admin@gmu.edu',
       role: 'admin',
   };

   const renderWithAuth = (ui, user = mockAdminUser) => {
       return render(
           <AuthContext.Provider value={{ user, logout: vi.fn(), setUser: vi.fn() }}>
               <MemoryRouter>
                   {ui}
               </MemoryRouter>
           </AuthContext.Provider>
       );
   };
   ```

3. **Mocking `react-hot-toast`**:
   ```javascript
   vi.mock('react-hot-toast', () => ({
       default: {
           success: vi.fn(),
           error: vi.fn(),
       },
       toast: {
           success: vi.fn(),
           error: vi.fn(),
       },
   }));
   ```

4. **ESLint Accessibility Compliance**:
   - `eslint.config.js` enforces `eslint-plugin-jsx-a11y`.
   - Every input needs an accessible label (e.g. `id` + `<label>` or MUI `TextField label="..."`).
   - Every `<img>` needs `alt="..."` (e.g., `alt="Scraped Tournament Flyer"`).
   - Dialogs must have `aria-labelledby` matching `<DialogTitle id="...">`.

---

## 4. Detailed Specification for `TournamentApprovals.test.jsx`

Here is the exact architectural blueprint for `client/src/pages/admin/TournamentApprovals.test.jsx`.

### 4.1 Mock Fixtures
```javascript
const mockProposals = [
    {
        _id: 'prop-high-1',
        tournamentName: 'Mason Open 2026',
        date: '2026-11-20T00:00:00.000Z',
        location: 'RAC Gym, Fairfax, VA',
        entryFee: '$25',
        registrationLink: 'https://masonbadminton.com/register/open',
        skillLevels: ['Intermediate', 'Advanced'],
        registrationDeadline: '2026-11-15T00:00:00.000Z',
        sourceUrl: 'https://instagram.com/p/mason-open-2026',
        confidenceScore: 94,
        status: 'pending',
        rawCaption: '🏸 Mason Open 2026 is officially live! Nov 20 at RAC Gym. $25 entry fee. Register at link in bio.',
        scrapedImageUrls: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea'],
        sourceLinks: ['https://masonbadminton.com/register/open'],
        createdAt: '2026-10-01T12:00:00.000Z',
    },
    {
        _id: 'prop-low-2',
        tournamentName: 'DMV Fall Racket Fest',
        date: '2026-12-05T00:00:00.000Z',
        location: 'TBD',
        entryFee: '',
        registrationLink: '',
        skillLevels: ['Open'],
        registrationDeadline: null,
        sourceUrl: 'https://instagram.com/p/dmv-fall-racket',
        confidenceScore: 62, // < 80 => TRIGGERS LOW CONFIDENCE HIGHLIGHT
        status: 'pending',
        rawCaption: 'Tentative fall tournament coming up in DMV area. Save the date Dec 5. Details soon.',
        scrapedImageUrls: [],
        sourceLinks: [],
        createdAt: '2026-10-02T08:00:00.000Z',
    }
];
```

### 4.2 Comprehensive Test Cases

| # | Test Scenario | Steps & Assertions |
| :- | :--- | :--- |
| **T1** | **Review queue rendering** | 1. Mock `GET /api/admin/tournaments/proposed` resolving with `mockProposals`.<br>2. Render page within `MemoryRouter` and `AuthContext.Provider` (`role: 'admin'`).<br>3. Verify title "Tournament Approvals" or "Review Queue" renders.<br>4. Assert "Mason Open 2026" and "DMV Fall Racket Fest" appear in the document.<br>5. Verify source URLs / captions are referenced. |
| **T2** | **Empty queue rendering** | 1. Mock `GET /api/admin/tournaments/proposed` returning `[]`.<br>2. Assert empty state message (e.g. "No pending tournament proposals") is visible. |
| **T3** | **Low confidence visual highlighting (< 80)** | 1. Render queue with both proposals.<br>2. Proposal 1 (`confidenceScore: 94`): check for success indicator (e.g. "94%" with success styling).<br>3. Proposal 2 (`confidenceScore: 62`): assert visual warning / highlight exists (e.g. warning chip text `"62%"`, warning badge, or alert indicating low AI confidence). |
| **T4** | **Split-screen reviewer modal opening** | 1. Click "Review" button on "Mason Open 2026".<br>2. Assert Dialog opens (`role="dialog"`).<br>3. **Left side assertions**: check raw caption `"🏸 Mason Open 2026 is officially live!"`, flyer image with `alt="Scraped Tournament Flyer"`, and source link are visible.<br>4. **Right side assertions**: check form inputs are pre-filled with `"Mason Open 2026"`, `"RAC Gym, Fairfax, VA"`, `"$25"`, `"https://masonbadminton.com/register/open"`. |
| **T5** | **Approve action (`POST /approve/:id`)** | 1. In the open modal for `prop-high-1`, click "Approve" (or "Approve & Publish").<br>2. Mock `POST /api/admin/tournaments/approve/prop-high-1` returning `{ message: "Tournament approved", tournament: { ... } }`.<br>3. Assert `apiFetch` was called with `/api/admin/tournaments/approve/prop-high-1` and `method: "POST"`.<br>4. Assert `toast.success` was dispatched.<br>5. Assert modal closes and "Mason Open 2026" is removed from the pending list. |
| **T6** | **Reject action (`POST /reject/:id`)** | 1. Click "Review" or "Reject" on `prop-low-2`.<br>2. Click "Reject" button.<br>3. Mock `POST /api/admin/tournaments/reject/prop-low-2` with body `{ reason: "Incomplete details" }`.<br>4. Assert `apiFetch` called `/api/admin/tournaments/reject/prop-low-2` with `method: "POST"`.<br>5. Assert `toast.success` was dispatched.<br>6. Assert "DMV Fall Racket Fest" is removed from queue. |
| **T7** | **Save edit action (`PUT /:id`)** | 1. Open reviewer modal for `prop-low-2`.<br>2. Edit location input to `"Capital Badminton Center"`.<br>3. Edit entry fee to `"$35"`.<br>4. Click "Save Edits".<br>5. Mock `PUT /api/admin/tournaments/prop-low-2` returning updated object.<br>6. Assert `apiFetch` was called with `method: "PUT"` and payload containing `{ location: "Capital Badminton Center", entryFee: "$35" }`.<br>7. Assert `toast.success` was dispatched and modal updates or closes. |
| **T8** | **Manual entry creation** | 1. Click "Manual Entry" button on queue page.<br>2. Assert manual entry modal/form opens with empty inputs.<br>3. Fill Tournament Name ("GMU Spring Invitational"), Date ("2026-11-28"), Location ("RAC"), Entry Fee ("$20").<br>4. Submit the form.<br>5. Verify API call is made and success toast is triggered. |
| **T9** | **Unauthorized access protection** | 1. Render `TournamentApprovals` or wrapped route with regular member (`role: 'member'`) or null user.<br>2. Assert page redirects or renders Access Denied message. |

---

## 5. Architectural Recommendations & Implementation Plan

### 5.1 Component Breakdown
To keep code modular, maintainable, and strictly compliant with React 19 / ESLint:
1. `client/src/pages/admin/TournamentApprovals.jsx`:
   - Main page component.
   - Fetches `/api/admin/tournaments/proposed`.
   - Renders header, "Manual Entry" button, review queue (Table or Cards), and low confidence alerts.
   - Houses state for `selectedProposal` (active review modal) and `manualModalOpen`.
2. `client/src/components/admin/ProposalReviewModal.jsx` (or co-located inside `TournamentApprovals.jsx`):
   - Handles the split-screen layout (Left: Raw Scraped Data; Right: Editable Form).
   - Form state management with local validation.
   - Dispatches Approve (`POST /approve/:id`), Reject (`POST /reject/:id`), and Save (`PUT /:id`).
3. `client/src/components/admin/ManualTournamentModal.jsx`:
   - Clean form modal for manual creation without scraping.

### 5.2 Routing & Navigation Updates
1. **Route Guard in `client/src/App.jsx`**:
   ```jsx
   const TournamentApprovals = React.lazy(() => import("./pages/admin/TournamentApprovals"));
   ...
   <Route
       path="/admin/tournaments"
       element={
           <AdminRoute>
               <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                   <TournamentApprovals />
               </motion.div>
           </AdminRoute>
       }
   />
   ```
2. **Navigation Link in `client/src/components/Navbar.jsx`**:
   - For desktop and mobile drawer when `user && user.role === 'admin'`:
     - Add a link to `/admin/tournaments` (e.g. "Tournament Approvals" or sub-item under Admin).
3. **Hub Link in `client/src/pages/Admin.jsx`**:
   - Add a navigation card or banner at the top of the Admin hub linking directly to `/admin/tournaments` with a pending proposal count chip.

### 5.3 Backend Integration Caveat & Solution
- In Phase 3, `server/routes/adminTournaments.js` implemented:
  - `GET /proposed`
  - `POST /approve/:id`
  - `POST /reject/:id`
  - `PUT /:id`
- Notice that `server/routes/adminTournaments.js` did not expose a `POST /manual` route.
- **Recommended Solution**:
  - The implementer can either:
    1. Add a small route `POST /manual` (or `POST /`) in `server/routes/adminTournaments.js` that directly saves to `Tournament` with `isOpenTournament: true` (or creates a `ProposedTournament` with `confidenceScore: 100`).
    2. OR, on the frontend, create a proposed tournament via `POST /api/scrape/submit-pending` or direct backend creation.
  - Adding `POST /manual` in `server/routes/adminTournaments.js` is the cleanest and most robust approach.

---

## 6. Verification Plan

1. **Unit & Integration Tests**:
   - Run `npm test` in `client/` to verify all 12 existing test suites pass.
   - Run `npx vitest run src/pages/admin/TournamentApprovals.test.jsx` once created to verify full test suite passes.
2. **Linter & Accessibility Check**:
   - Run `npm run lint` in `client/` to ensure zero errors and zero warnings.
3. **Build Check**:
   - Run `npm run build` in `client/` to verify Vite bundle compiles with no type/syntax errors.
