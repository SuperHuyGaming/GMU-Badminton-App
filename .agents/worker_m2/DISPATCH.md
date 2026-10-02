# Dispatch for Worker M2 (PR Workflow Execution)

## Mission: Milestone 2 — PR Workflow & QA Validation

Read ORIGINAL_REQUEST.md at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md
Read PR Workflow rules at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md
Read QA Lead rules at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\qa_lead.md
Read PROJECT.md at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md
Read Milestone 1 Handoff at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m1\handoff.md

## Step-by-Step Task Instructions
Execute the mandatory PR workflow according to `.agents/rules/pr_workflow.md`:

1. **Step 1: Feature Branch**:
   - Check current git status.
   - Create and checkout a descriptive feature branch:
     `git checkout -b feature/matchmaking-ui-polish`

2. **Step 2: Commit & Push**:
   - Stage all modified and new files:
     - `client/src/components/Navbar.jsx`
     - `client/src/components/Navbar.test.jsx`
     - `client/src/pages/Matchmaking.jsx`
     - `client/src/pages/Matchmaking.test.jsx`
     - `client/src/pages/NavbarAndMultiCard.challenge.test.jsx`
   - Commit with a conventional commit message:
     `git commit -m "feat(ui): implement add friend, refine matchmaking search bar, and remove players tab"`
   - Push to origin:
     `git push -u origin feature/matchmaking-ui-polish`

3. **Step 3: Create Pull Request**:
   - Create PR targeting `develop` using `gh`:
     ```
     gh pr create --base develop --head feature/matchmaking-ui-polish --title "feat(ui): Matchmaking UI polish, Add Friend integration, and Navbar streamlining" --body "## Summary\n- R1: Integrated Add Friend button on Matchmaking player cards with POST /api/friends/request, loading spinner, and disabled Request Sent state.\n- R2: Refined Matchmaking search bar with distinct translucent fill, backdrop blur, and dark mode contrast.\n- R3: Deprecated redundant Players tab from Navbar desktop and mobile drawer.\n- Added comprehensive unit tests in Matchmaking.test.jsx and Navbar.test.jsx.\n\n## Verification\n- npm test: 12 suites, 66 tests passing\n- npm run lint: 0 errors\n- npm run lint:a11y: 0 errors\n- npm run build: clean build" --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"
     ```
   - Capture the PR number and URL.

4. **Step 4: QA Bot Comment**:
   - Post automated QA Bot comment on the PR:
     ```
     gh pr comment <PR#> --body "🤖 **Automated QA Pipeline:** Pull Request created for Matchmaking UI polish. Assigning QA verification pipeline. Running automated test suite and accessibility checks."
     ```

5. **Step 5: Run Verification / QA Checks**:
   - Run in `client/`:
     - `npm test`
     - `npm run lint`
     - `npm run lint:a11y`
     - `npm run build`
   - Post QA review comment on the PR with `gh pr comment`:
     ```
     gh pr comment <PR#> --body "🧪 **QA Engineer Review & Autonomous Testing Report:**\n- **Client Tests**: 12 suites passed, 66 tests passed (0 failures)\n- **ESLint**: 0 errors, 0 warnings\n- **Accessibility**: 0 errors, 0 warnings\n- **Build**: Vite production bundle compiled cleanly\n- **Overall QA Status**: **PASS** ✅"
     ```

6. **Step 6: Document in handoff.md**:
   - Write `D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m2\handoff.md` with PR URL, branch name, commit hash, QA Bot comment output, QA test results, and final verification summary.
   - Message orchestrator_1 when completed.

## 2026-09-29T18:53:31Z
You are Worker M2 (Archetype: teamwork_preview_worker).
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m2
Your parent is: orchestrator_1 (Conversation ID: 93d2d1d0-6d75-4341-b9f0-ead10a1e3f67)

Read ORIGINAL_REQUEST.md at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md
Read DISPATCH.md at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m2\DISPATCH.md
Read PR Workflow rules at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md
Read QA Lead rules at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\qa_lead.md
Read PROJECT.md at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md
Read Milestone 1 Handoff at: D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m1\handoff.md

Your mission is to execute Milestone 2 (Mandatory PR & QA Workflow per pr_workflow.md):
1. Create descriptive feature branch: `feature/matchmaking-ui-polish`
2. Stage all changed files:
   - `client/src/components/Navbar.jsx`
   - `client/src/components/Navbar.test.jsx`
   - `client/src/pages/Matchmaking.jsx`
   - `client/src/pages/Matchmaking.test.jsx`
   - `client/src/pages/NavbarAndMultiCard.challenge.test.jsx`
3. Commit with conventional commit message:
   `feat(ui): implement add friend, refine matchmaking search bar, and remove players tab`
4. Push branch to origin: `git push -u origin feature/matchmaking-ui-polish`
5. Create PR targeting `develop` with labels "QA Pipeline" and "Automated", assigned to SuperHuyGaming:
   `gh pr create --base develop --head feature/matchmaking-ui-polish --title "feat(ui): Matchmaking UI polish, Add Friend integration, and Navbar streamlining" --body "..." --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"`
6. Post automated QA Bot comment on the PR using `gh pr comment`.
7. Execute QA checks (run tests, lint, and build in client/) and post QA review comment on PR.
8. Document all commands, outputs, PR URL, and commit hash in `D:\GMU Fall 2026\GMU-Badminton-App\.agents\worker_m2\handoff.md`.
