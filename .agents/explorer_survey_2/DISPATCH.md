# Dispatch: Explorer 2 - Server Routes, Middleware, & Admin Auth

## Objective
Investigate `server/server.js`, existing routes, auth middleware, and role verification in the server codebase to determine how to securely implement and mount `/api/admin/tournaments`.

## Key Files to Investigate
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md` (mandatory read)
- `D:\GMU Fall 2026\GMU-Badminton-App\server\server.js`
- `D:\GMU Fall 2026\GMU-Badminton-App\server\routes/`
- `D:\GMU Fall 2026\GMU-Badminton-App\server\middleware/` (e.g. auth middleware)

## Deliverables
Write your comprehensive findings and recommendations to `.agents/explorer_survey_2/handoff.md`. Include:
1. How routes are currently structured, mounted, and error-handled in `server/server.js`.
2. Existing auth middleware implementation, how tokens are validated, and how `req.user` / `req.user.role` are populated.
3. Is there an existing admin check middleware or role check pattern? How should admin verification be enforced for all `/api/admin/tournaments` routes?
4. Detailed endpoints design for:
   - `GET /proposed`: pending tournaments sorted by confidenceScore desc
   - `POST /approve/:id`: find, create in Tournament, mark approved
   - `POST /reject/:id`: mark rejected
   - `PUT /:id`: update AI structured data
5. Recommended route structure for `server/routes/adminTournaments.js` and mount point in `server/server.js`.

## 2026-10-02T23:40:30Z
Investigate `server/server.js`, existing routes, auth middleware, and role verification in the server codebase to determine how to securely implement and mount `/api/admin/tournaments`.
Deliverable: Write a comprehensive report to D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_2\handoff.md.
When finished, send a message to parent with your completion status and reference the handoff report path.
