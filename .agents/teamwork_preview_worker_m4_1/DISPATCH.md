## 2026-10-03T00:41:10Z
You are Worker 1 for Phase 4 (Admin Dashboard UI) of the DMV Tournament Aggregation & Admin Approval System.

Your working directory is:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m4_1

MANDATORY: You MUST read the following file before starting work:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md (specifically section ## 2026-10-03T00:31:31Z)

Also review the scope and explorer reports:
- Scope: D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_4\SCOPE.md
- Explorer 1 (Routing & Layout): D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_1\report.md
- Explorer 2 (API & Data): D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_2\report.md
- Explorer 3 (UI Patterns & Tests): D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_3\report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You have exclusive write ownership of:
- `client/src/pages/admin/TournamentApprovals.jsx` (New)
- `client/src/pages/admin/TournamentApprovals.test.jsx` (New)
- `client/src/App.jsx` (Register `/admin/tournaments` route with `<AdminRoute>`)
- `client/src/components/Navbar.jsx` (Add link for admin users in desktop & mobile drawer)
- `client/src/pages/Admin.jsx` (Add navigation card/banner to Approvals)
- `server/routes/adminTournaments.js` (Add `POST /manual` route for manual tournament entry)
- `server/tests/adminTournaments.test.js` (Test `POST /manual` route)

Detailed Requirements to Implement:
1. R1. Admin Route & Layout:
   - Create `client/src/pages/admin/TournamentApprovals.jsx`.
   - In `client/src/App.jsx`, add lazy import and register `<Route path="/admin/tournaments" element={<AdminRoute><motion.div ...><TournamentApprovals /></motion.div></AdminRoute>} />`.
   - In `client/src/components/Navbar.jsx`, add "Tournament Approvals" navigation link for admin users in both desktop and mobile drawer.
   - In `client/src/pages/Admin.jsx`, add a clear link or banner leading to `/admin/tournaments`.

2. R2. Review Queue UI:
   - On mount, fetch pending proposals via `apiFetch('/api/admin/tournaments/proposed')`.
   - Display pending tournaments in a clean Table or Card layout matching the MUI theme.
   - Include columns/card fields: Tournament Name, Date, Location, Fee, Source domain, Confidence Score, and Actions.
   - Visual highlighting for low confidence (< 80): use warning Chip (`color="warning"`), warning border, or alert banner to clearly indicate proposals or fields needing attention.
   - Display friendly empty state when queue is empty (referencing `EmptyTournaments.jsx` style).

3. R3. Split-Screen Reviewer:
   - Clicking a proposal opens a full/large modal dialog:
   - Left Side: Displays raw scraped context (`rawCaption` in a formatted/scrollable box, flyer image preview from `scrapedImageUrls[0]` with proper alt tag, clickable `sourceLinks` and `sourceUrl`).
   - Right Side: Displays editable form pre-filled with AI extracted data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`).

4. R4. Approval Actions & UX:
   - "Approve" button: calls `POST /api/admin/tournaments/approve/:id` via `apiFetch`, displays success toast (`toast.success`), removes item from pending queue, and closes/updates modal.
   - "Reject" button: calls `POST /api/admin/tournaments/reject/:id` (with optional reason prompt/input), displays toast, and updates queue.
   - "Save Edits" button: calls `PUT /api/admin/tournaments/:id` with updated form values via `apiFetch`, displays success toast, and updates local state.
   - "Manual Entry" button on queue page: opens a modal dialog to create a tournament manually (without scraping). Calls `POST /api/admin/tournaments/manual` with `isOpenTournament: true` or creates and approves a new entry.
   - All notifications use `react-hot-toast` (`toast.success`, `toast.error`).
   - Ensure proper loading states (`CircularProgress` or button loading states) and error handling.

5. In `server/routes/adminTournaments.js`:
   - Implement `POST /manual` (protected by `authMiddleware` and `adminMiddleware` like all other routes):
     Creates a new `Tournament` document in the `tournaments` collection with `isOpenTournament: true`, validates required fields (e.g. `tournamentName`), saves it, emits `tournamentApproved` via Socket.io if available, and returns 201 with `{ message: "Tournament created successfully", tournament }`.
   - Add unit test in `server/tests/adminTournaments.test.js` to ensure 100% test pass on server.

6. Automated Unit Tests (`client/src/pages/admin/TournamentApprovals.test.jsx`):
   - Implement comprehensive Vitest tests:
     - Review queue renders proposals fetched from API.
     - Low confidence (< 80) proposal renders warning highlight.
     - Split-screen reviewer modal opens on click, displaying raw flyer/caption and pre-filled form.
     - Approve button triggers `POST /approve/:id`, toast success, and queue removal.
     - Reject button triggers `POST /reject/:id`, toast success, and queue removal.
     - Save edits triggers `PUT /:id` with updated form data and updates state.
     - Manual entry button opens form, submits, and calls API.
     - Empty queue state renders when no proposals exist.

7. Verification:
   - Run `npm test` in `client/` (ensure all client tests pass).
   - Run `npm run lint` in `client/` (ensure 0 lint errors/warnings).
   - Run `npm run build` in `client/` (ensure production build passes).
   - Run `npm test` and `npm run lint` in `server/` (ensure 0 regressions).

Write a comprehensive handoff report to:
`D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m4_1\handoff.md`
including commands run and full test results.
When finished, send a message to parent (ID: 0f798819-41c4-487f-8c72-a1bf71342c73).
