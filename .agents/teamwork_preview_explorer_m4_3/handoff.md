# Phase 4 Admin Dashboard UI Investigation Handoff

**Agent**: Explorer 3 (`teamwork_preview_explorer_m4_3`)  
**Mission**: Investigate Existing Tournament Pages, Admin UI Patterns, and Client Testing Setup for Phase 4.

---

## 1. Observation

1. **Existing Tournament View (`client/src/pages/Tournaments.jsx`)**:
   - Lines 70–121: Uses `fetch` on `VITE_TOURNAMENT_API_URL` or `/api/v1/tournaments` (external Java backend).
   - Lines 158–221: Renders tournament cards with `flyerImageUrl` (fixed 200px box), `eventLocation` (with `MapPinIcon`), `startDate`, and a 150-char truncated caption.
   - Lines 183–206: Sign up button in secondary color (`#FFCC33` Gold / `#002f17` text) opens `registrationUrl`.
   - Lines 40–68: `handleExportICS(tournament)` creates and downloads `.ics` calendar files.
   - Lines 154–156: Uses `<EmptyTournaments />` (`client/src/components/EmptyTournaments.jsx`) when no tournaments exist.
2. **Existing Admin Views & UI Patterns (`client/src/pages/Admin.jsx`)**:
   - Lines 80–124: Uses `apiFetch` from `../utils/api` to make authenticated requests (`PUT` to approve/dismiss, `DELETE` to remove).
   - Lines 176–268: Moderation queue pattern uses `<Paper elevation={0}>` with red/warning borders, chips for toxicity scores, pre-wrapped text for raw message content, and side-by-side action buttons (`Delete Spam` error button, `Approve` success button).
   - Lines 444–538: User and message management tables use `TableContainer`, `TableHead sx={{ bgcolor: "background.default" }}`, and `TableRow hover`.
   - Lines 642–703: Centralized modal dialog with `PaperProps={{ sx: { borderRadius: 3, p: 1 } }}` and `DialogActions`.
3. **Application Routing & Auth Guards (`client/src/App.jsx`)**:
   - Lines 79–83: `AdminRoute` guard checks `const { user } = useAuth(); if (!user || user.role !== "admin") return <Navigate to="/" replace />; return children;`.
   - Line 3 & 492: React Hot Toast is configured globally via `<Toaster position="top-center" reverseOrder={false} />`.
   - Lines 296–330: MUI Theme specifies `primary` (GMU green `#004d26`), `secondary` (Gold `#FFCC33`), `error` (`#B00020`), and translucent background papers.
4. **Client Testing & Linting Environment**:
   - `client/package.json` scripts: `"test": "vitest run"`, `"lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0"`.
   - Running `npm test` in `client/` ran 12 test files (59 passed, 18 skipped) in 3.96s with 0 failures.
   - Running `npm run lint` in `client/` exited with code 0 and 0 warnings.
   - Existing tests (`Leaderboard.test.jsx`, `Navbar.test.jsx`, `CommunityDirectory.test.jsx`) mock API requests via `vi.mock('../utils/api')` and provide admin auth state via `<AuthContext.Provider value={{ user: { role: 'admin' } }}>`.
5. **Backend Data Contract (`server/models/ProposedTournament.js` & `server/routes/adminTournaments.js`)**:
   - `ProposedTournament` holds `rawCaption`, `scrapedImageUrls`, `sourceLinks`, `sourceUrl`, `confidenceScore` (0-100), `status` ('pending'|'approved'|'rejected'), and structured fields (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`).
   - Routes: `GET /api/admin/tournaments/proposed`, `POST /approve/:id`, `POST /reject/:id`, `PUT /:id`.
   - Missing endpoint: There is currently no `POST /manual` route in `adminTournaments.js` for manual entry creation.

---

## 2. Logic Chain

1. From Observation 1, the public tournament interface only handles pre-approved, published tournament records. It does not display scraped context, confidence scores, or raw image lists. Therefore, `TournamentApprovals.jsx` requires a distinct admin model consuming `/api/admin/tournaments/proposed`.
2. From Observation 2, `Admin.jsx` sets established patterns for moderation queues: rounded paper containers, severity/confidence badges, raw text display boxes, and distinct approve/reject action buttons. Adopting these exact patterns ensures aesthetic and UX consistency.
3. From Observation 3, any new admin page must be wrapped with `<AdminRoute>` in `App.jsx`, can dispatch notifications using `toast.success` / `toast.error`, and should use MUI Theme palette tokens (`primary`, `secondary`, `error`, `warning`).
4. From Observation 4, Vitest + React Testing Library is fast, robust, and clean. All tests pass without mock pollution. Creating `TournamentApprovals.test.jsx` using `vi.mock('../utils/api')` and `<AuthContext.Provider>` will seamlessly fit the existing test runner and pass CI.
5. From Observation 5, while Phase 3 implemented review, approve, reject, and edit routes, the "Manual Entry" requirement requires either adding a dedicated `POST /manual` endpoint to `server/routes/adminTournaments.js` or posting to `POST /api/scrape/submit-pending`. Adding `POST /manual` to `adminTournaments.js` will give the cleanest end-to-end integration.

---

## 3. Caveats

1. **Manual Entry Endpoint**: Phase 3 did not include `POST /api/admin/tournaments/manual`. If backend modification is permitted during Phase 4, adding this endpoint is strongly recommended. If Phase 4 is restricted to `client/`, the manual entry form can connect to `POST /api/scrape/submit-pending` or create a draft proposal.
2. **WebSocket Real-Time Updates**: Phase 3 server emits `io.emit("tournamentApproved", tournament)`. The review queue UI can optionally listen to this socket event or simply perform local state updates upon API resolution.

---

## 4. Conclusion

The client codebase is clean, well-tested, and provides all necessary architectural building blocks for Phase 4. `TournamentApprovals.jsx` should be placed in `client/src/pages/admin/`, protected by `AdminRoute` in `App.jsx`, linked from `Navbar.jsx` and `Admin.jsx`, and tested by `TournamentApprovals.test.jsx` using Vitest, RTL, and `apiFetch` mocking as specified in `report.md`.

---

## 5. Verification Method

To independently verify these findings:
1. Run client test suite:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\client"
   npm test
   ```
   *Expected*: All 12 test files pass.
2. Run client linter:
   ```powershell
   npm run lint
   ```
   *Expected*: Exits with code 0.
3. Inspect the comprehensive report at:
   `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_3\report.md`
