## 2026-10-02T23:39:16Z
You are the Project Orchestrator for Phase 3 (Core Backend) of the DMV Tournament Aggregation & Admin Approval System.

Your identity and working directory:
- Working Directory: D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_3
- Original Request: D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md (see section ## 2026-10-02T23:38:06Z)
- Project Root: D:\GMU Fall 2026\GMU-Badminton-App
- Rules: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md

Key Objectives & Requirements:
1. R1. ProposedTournament Model: Create `server/models/ProposedTournament.js` using Mongoose with Raw Scraped Data (rawCaption, scrapedImageUrls, sourceLinks), AI Structured Data (tournamentName, date, location, entryFee, registrationLink, skillLevels, registrationDeadline), and Metadata (sourceUrl, confidenceScore 0-100, status enum: ['pending', 'approved', 'rejected']).
2. R2. Admin API Routes: Create `server/routes/adminTournaments.js` and mount it in `server/server.js` at `/api/admin/tournaments`:
   - GET /proposed: returns all 'pending' ProposedTournaments, sorted by confidenceScore (descending).
   - POST /approve/:id: finds ProposedTournament, creates a new entry in `Tournament.js` (existing model), and marks proposal as 'approved'.
   - POST /reject/:id: marks ProposedTournament as 'rejected'.
   - PUT /:id: allows admin to manually edit AI Structured Data before approval.
3. R3. Authentication & Security: Ensure all `/api/admin/tournaments` routes use `authMiddleware` AND verify that `req.user.role === 'admin'`.
4. R4. Kafka Consumer (Optional/Stub): In `server/utils/kafkaConsumer.js` (if it exists), add a stub case for the `tournament-scraping` topic that inserts a message into the ProposedTournament collection. If it doesn't exist, document where the consumer should be added.
5. Acceptance Criteria:
   - Ensure the ProposedTournament model matches schema requirements.
   - Ensure /api/admin/tournaments routes are fully implemented and protected.
   - A feature branch was already created (`feature/tournament-admin-approval`), so checkout/use it and commit your work to it.
   - Follow PR workflow rules in `.agents/rules/pr_workflow.md`.
   - Run `npm run lint` and `npm test` in the `server/` directory to ensure no regressions.
6. Maintain `plan.md`, `progress.md`, and `BRIEFING.md` in your directory (`.agents/orchestrator_3/`). Keep `progress.md` updated regularly so sentinel liveness monitoring tracks active progress.
7. When complete, submit your handoff / victory claim to the Sentinel.
