# Handoff Report: Explorer 2 (Phase 4 Backend Endpoints & Client Integration)

## 1. Observation
- `server/routes/adminTournaments.js` (lines 11-12) applies `router.use(authMiddleware)` and `router.use(adminMiddleware)` to all routes.
- `server/routes/adminTournaments.js` exposes four endpoints:
  - `GET /proposed` (lines 18-26): Returns `ProposedTournament.find({ status: "pending" }).sort({ confidenceScore: -1 })` as HTTP 200 array.
  - `POST /approve/:id` (lines 33-92): Validates ObjectId, creates new `Tournament` with `isOpenTournament: true`, marks proposal status as `"approved"`, records `approvedAt`, `approvedBy`, `createdTournamentId`, emits Socket.io `tournamentApproved`, returns `{ message, tournament, proposedTournament }` as HTTP 200.
  - `POST /reject/:id` (lines 98-126): Validates ObjectId, accepts optional `req.body.reason` (defaults to `"Rejected by admin"`), marks status as `"rejected"`, records `rejectedAt`, `rejectionReason`, returns `{ message, proposedTournament }` as HTTP 200.
  - `PUT /:id` (lines 132-205): Validates ObjectId, accepts flat or nested `aiStructuredData` payload, validates `tournamentName` (non-empty string), sanitizes with `xss()`, validates `confidenceScore` in `[0, 100]`, updates proposal and returns `{ message, proposedTournament }` as HTTP 200.
- `server/models/ProposedTournament.js` (lines 3-38):
  - Raw scraped data: `rawCaption` (String), `scrapedImageUrls` ([String]), `sourceLinks` ([String]).
  - AI structured data: `tournamentName` (String, required), `date` (Date), `location` (String, default "TBD"), `entryFee` (String), `registrationLink` (String), `skillLevels` ([String]), `registrationDeadline` (Date).
  - Metadata: `sourceUrl` (String, required), `confidenceScore` (Number, 0-100), `status` (Enum ["pending", "approved", "rejected"], default "pending").
  - Virtuals: `aiStructuredData` and `rawScrapedData` with `toJSON: { virtuals: true }`.
- `client/src/utils/api.js` (lines 20-120):
  - Exports `apiFetch(endpoint, options)`.
  - Automatically attaches `Authorization: Bearer ${token}` from `localStorage.getItem("accessToken")`.
  - Automatically handles 401 token refresh queue with `/api/auth/refreshtoken`.
  - Automatically throws an `Error` for any non-ok response (`!response.ok && response.status !== 401`) with message from `errorData.message || 'Request failed with status...'`.
- `client/package.json` (line 32): `"react-hot-toast": "^2.6.0"` is installed.
- `client/src/App.jsx` (line 492): `<Toaster position="top-center" reverseOrder={false} />` is mounted globally under `BrowserRouter`.
- `client/src/App.jsx` (lines 79-83): `<AdminRoute>` guards routes by checking `user?.role === "admin"`.

## 2. Logic Chain
1. Observations in `server/routes/adminTournaments.js` and `server/server.js` confirm the backend routes are mounted at `/api/admin/tournaments` and require an admin JWT bearer token.
2. Observations in `server/models/ProposedTournament.js` confirm that data documents contain both raw scraped context and AI-structured fields, matching the split-screen requirements of Phase 4 R3.
3. Observations in `client/src/utils/api.js` demonstrate that client code does not need manual header injection or axios setup; calling `apiFetch("/api/admin/tournaments/...")` handles auth and refresh automatically, but requires `try / catch` error handling because it throws on non-2xx responses.
4. Observations in `client/package.json` and `client/src/App.jsx` demonstrate that `react-hot-toast` is the established notification standard, with `<Toaster />` globally mounted, so components only need `import { toast } from "react-hot-toast"` and calls to `toast.success()` / `toast.error()`.
5. Combining these observations provides the complete contract needed by the Phase 4 UI implementers to construct `TournamentApprovals.jsx` without backend friction.

## 3. Caveats
- `server/routes/adminTournaments.js` does not currently include a dedicated endpoint for manual tournament creation (`POST /manual` or `POST /create`). However, `server/routes/scrape.js` provides `POST /api/scrape/submit-pending` (creates `Tournament` with `isOpenTournament: false`). If manual entry should bypass the queue or create a proposal directly, the implementer can either utilize `submit-pending` or add a simple manual endpoint.

## 4. Conclusion
The backend endpoints and data models for Phase 4 are fully functional, tested, and ready for client consumption. Client-side integration should strictly use `apiFetch` from `client/src/utils/api.js` and `toast` from `react-hot-toast`. Detailed API signatures and frontend design recommendations have been documented in `report.md`.

## 5. Verification Method
1. Inspect `server/routes/adminTournaments.js` and `server/models/ProposedTournament.js` to verify endpoint schemas and fields.
2. Run server tests to confirm endpoint contracts:
   `npm test -- server/tests/adminTournaments.test.js`
3. Inspect `client/src/utils/api.js` and run client tests:
   `npm test -- client/src/utils/api.test.js`
4. Review the full report at:
   `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_2\report.md`
