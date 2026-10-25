## 2026-10-03T00:31:31Z
You are the Project Orchestrator for Phase 4 (Admin Dashboard UI) of the DMV Tournament Aggregation & Admin Approval System.

Your identity and working directory:
- Working Directory: D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_4
- Original Request: D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md (see section ## 2026-10-03T00:31:31Z)
- Project Root: D:\GMU Fall 2026\GMU-Badminton-App
- Rules: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md

Key Objectives & Requirements:
1. R1. Admin Route & Layout:
   - Create a new Admin view (e.g., `client/src/pages/admin/TournamentApprovals.jsx`) and ensure it's protected by an Admin route guard.
   - Add a link to this page in the Admin Sidebar/Navbar.
2. R2. Review Queue UI:
   - Fetch `GET /api/admin/tournaments/proposed` and display the pending tournaments.
   - Use a Table or Kanban layout. Highlight tournaments or specific fields that have a low `confidenceScore` (e.g., < 80) so admins know to pay attention.
3. R3. Split-Screen Reviewer:
   - When an admin clicks a proposal, open a Modal or a split-screen view:
     * Left Side: Display the raw scraped context (`rawCaption`, `scrapedImageUrls`, `sourceLinks`) so the admin can visually verify the data.
     * Right Side: Display an editable form pre-filled with the AI's extracted data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`).
4. R4. Approval Actions & UX:
   - Provide "Approve" (calls `POST /api/admin/tournaments/approve/:id`) and "Reject" (calls `POST /api/admin/tournaments/reject/:id`) buttons.
   - Add success/error Toast notifications for all actions.
   - Allow the admin to save edits (calls `PUT /api/admin/tournaments/:id`) before approving.
   - Provide a "Manual Entry" button to open a blank form to create a tournament manually (without scraping).
5. Acceptance Criteria:
   - The `TournamentApprovals.jsx` page is created and visually matches our MUI theme.
   - The split-screen reviewer modal works and accurately displays both the raw source and the editable form.
   - Axios/fetch logic successfully connects to the backend API routes built in Phase 3.
   - A feature branch is already active (`feature/tournament-admin-ui`), so commit your work to it.
   - Follow PR workflow rules in `.agents/rules/pr_workflow.md`.
   - Run `npm run lint` and `npm test` in the `client/` directory to ensure no regressions.
6. Maintain `plan.md`, `progress.md`, and `BRIEFING.md` in your directory (`.agents/orchestrator_4/`). Keep `progress.md` updated regularly so sentinel liveness monitoring tracks active progress.
7. When complete, submit your handoff / victory claim to the Sentinel.
