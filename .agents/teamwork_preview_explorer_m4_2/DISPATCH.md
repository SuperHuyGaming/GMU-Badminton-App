## 2026-10-03T00:34:28Z
You are Explorer 2 for Phase 4 (Admin Dashboard UI) of the DMV Tournament Aggregation & Admin Approval System.

Your working directory is:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_2

MANDATORY: You MUST read the following file before starting work:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md (specifically the section ## 2026-10-03T00:31:31Z)

Task: Investigate Backend Endpoints & Client API Integration Conventions.
1. Inspect `server/routes/adminTournaments.js` and `server/models/ProposedTournament.js` to get the exact endpoint signatures, HTTP methods, route paths, URL params, request body schemas, response payloads, and status codes for:
   - `GET /api/admin/tournaments/proposed`
   - `POST /api/admin/tournaments/approve/:id`
   - `POST /api/admin/tournaments/reject/:id`
   - `PUT /api/admin/tournaments/:id`
   - What fields are in `ProposedTournament` (both rawScrapedData: rawCaption, scrapedImageUrls, sourceLinks; and aiStructuredData: tournamentName, date, location, entryFee, registrationLink, skillLevels, registrationDeadline; and metadata: confidenceScore, status)?
2. Inspect client-side API utilities (e.g., `client/src/utils/api.js`, `apiFetch`, axios instance, auth header injection). How do existing pages make authenticated requests?
3. Inspect toast notification library used in `client/` (e.g., `react-hot-toast`, MUI Snackbar, or custom toast helper). How are success/error toasts dispatched?

Write your complete findings and recommendations to:
D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_2\report.md
Also write a brief handoff.md in your directory.
When finished, send a message to parent (ID: 0f798819-41c4-487f-8c72-a1bf71342c73) with a concise summary and path to your report.
