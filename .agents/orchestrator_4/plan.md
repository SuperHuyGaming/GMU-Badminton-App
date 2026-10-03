# Execution Plan: Phase 4 Admin Dashboard UI (Tournament Approvals)

## Goal
Implement Phase 4 (Admin Dashboard UI) of the DMV Tournament Aggregation & Admin Approval System, satisfying requirements R1-R4, PR workflow, client tests/linting, and verification gates.

## Step 1: Exploration & Survey
- Dispatch 3 Explorers in parallel:
  - **Explorer 1**: Explore Client App Routing & Admin Auth Layout (`App.jsx`, `App.js`, route definitions, Admin route guards, Navbar/Sidebar components, MUI theme configuration, and current git branch status).
  - **Explorer 2**: Explore Phase 3 Backend Endpoints & API Client Conventions (`server/routes/adminTournaments.js`, `server/models/ProposedTournament.js`, client API utility like `apiFetch` or Axios, auth headers, toast library).
  - **Explorer 3**: Explore Existing Tournament Views & Admin UI Patterns (`client/src/pages/`, admin tables, modal patterns, form structures, existing tests in `client/`).

## Step 2: Synthesis & Scope Finalization
- Synthesize Explorer findings into `SCOPE.md`.
- Detail component hierarchy, prop interfaces, API contracts, UI state machine, and error handling.

## Step 3: Worker Implementation
- Dispatch Worker to:
  - Create `client/src/pages/admin/TournamentApprovals.jsx` with Table/Kanban layout, confidence score highlight (<80), split-screen modal (raw context vs editable form), approval actions, rejection actions, toast alerts, save edits (PUT), and manual entry button.
  - Wire route guard and link in Navbar/Sidebar.
  - Implement comprehensive unit tests (`client/src/pages/admin/TournamentApprovals.test.jsx`).
  - Run `npm test` and `npm run lint` in `client/` to verify 0 regressions.

## Step 4: Multi-Agent Verification Panel
- Dispatch 2 Reviewers independently (inspect code quality, UX, MUI styling, API contracts, error boundaries).
- Dispatch 2 Challengers independently (verify boundary conditions, null/empty raw data, malformed payloads, rapid button spam, optimistic states).
- Dispatch 1 Forensic Auditor (`teamwork_preview_auditor`) for integrity check (no dummy facades, authentic API calls).

## Step 5: Gate Evaluation
- Check all gate criteria in `GATE_STATUS.md`.
- If pass, proceed to Step 6. If fail, iterate back.

## Step 6: PR Workflow & Autonomous QA
- Ensure changes are on `feature/tournament-admin-ui`.
- Commit changes with conventional commit message and push.
- Open GitHub PR targeting `develop` with labels and assignee.
- Post QA Bot comment.
- Invoke QA subagent to validate client test/lint/build and approve/merge PR.
- Final victory report to Sentinel.
