# Dispatch: DevOps PR Worker — Git Commit, Push & PR Creation

## Mandatory Reading
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md` (mandatory read)
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md`
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\orchestrator_3\SCOPE.md`

## Tasks to Execute
You are responsible for executing Steps 1, 2, 3, and 4 of the Mandatory PR Workflow:

1. **Step 1 & 2: Feature Branch & Commit**:
   - Confirm current git branch is `feature/tournament-admin-approval`.
   - Check `git status`.
   - Stage the Phase 3 backend files:
     - `server/models/ProposedTournament.js`
     - `server/routes/adminTournaments.js`
     - `server/server.js`
     - `server/utils/kafkaConsumer.js`
     - `server/tests/adminTournaments.test.js`
     (and any other server test files created for verification).
   - Commit with conventional commit message:
     `git commit -m "feat(server): implement ProposedTournament model, admin approval routes, and Kafka consumer stub"`
   - Push to origin:
     `git push origin feature/tournament-admin-approval`

2. **Step 3: Create Pull Request**:
   - Note: GitHub CLI `gh.exe` is located at `"C:\Program Files\GitHub CLI\gh.exe"` (or `gh` if in PATH).
   - Create PR targeting `develop`:
     ```powershell
     & "C:\Program Files\GitHub CLI\gh.exe" pr create --base develop --head feature/tournament-admin-approval --title "feat(server): Phase 3 DMV Tournament Aggregation & Admin Approval System" --body "## Summary`n- Implemented ProposedTournament Mongoose model with Raw Scraped Data, AI Structured Data, and Metadata.`n- Implemented protected admin routes in /api/admin/tournaments (GET /proposed, POST /approve/:id, POST /reject/:id, PUT /:id).`n- Enforced authMiddleware and adminMiddleware (req.user.role === 'admin').`n- Enforced isOpenTournament: true critical invariant on approved Tournament documents.`n- Implemented Kafka consumer stub for tournament-scraping topic in server/utils/kafkaConsumer.js.`n`n## Testing Results`n- 10 test suites passed, 156 passed, 0 failures.`n- ESLint passed with 0 errors.`n- Verified by 2 Reviewers, 2 Challengers, and Forensic Auditor (CLEAN)." --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"
     ```
   - Capture the PR number and URL.

3. **Step 4: Post Automated QA Bot Comment**:
   - Post the initial QA Bot comment:
     ```powershell
     & "C:\Program Files\GitHub CLI\gh.exe" pr comment <PR#> --body "🤖 **Automated QA Pipeline:** PR registered for Phase 3 Core Backend. QA Engineer assigned. Automated verification pipeline starting: linting, server test suite, and client build."
     ```

## Deliverable
Write your report with the created PR URL and PR number to `.agents/worker_devops_pr/handoff.md`.
Send a completion message to parent with the PR number.

## 2026-10-02T20:00:03Z
Received task from parent:
You are the DevOps PR Worker for Phase 3 (Core Backend).
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_devops_pr
Tasks:
1. Confirm branch is `feature/tournament-admin-approval`.
2. Stage and commit changes with a conventional commit message:
   `feat(server): implement ProposedTournament model, admin approval routes, and Kafka consumer stub`
3. Push to `origin feature/tournament-admin-approval`.
4. Create Pull Request targeting `develop` using GitHub CLI (`C:\Program Files\GitHub CLI\gh.exe`).
5. Immediately post the automated QA Bot comment on the PR.
6. Record the PR URL and PR number in D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_devops_pr\handoff.md and send a completion message to parent.
