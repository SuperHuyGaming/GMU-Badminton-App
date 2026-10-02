# Orchestration Plan — Matchmaking UI Polish

## Overview
Implement the full requirements outlined in `ORIGINAL_REQUEST.md`:
1. R1: Add Friend functionality integration on Matchmaking cards with loading spinner and disabled "Request Sent" state.
2. R2: Refine Matchmaking Search bar styling with translucent, distinct background fill against dark theme.
3. R3: Remove redundant "Players" tab from Navbar.
4. R4: Execute full PR Workflow according to `.agents/rules/pr_workflow.md`.

## Execution Phases
### Phase 0: Survey & Investigation (Parallel Explorers)
- Explorer 1: Investigate Navbar (`client/src/components/layout/Navbar.jsx` or similar) & existing Navbar tests.
- Explorer 2: Investigate Matchmaking search bar styling & components (`client/src/pages/Matchmaking.jsx` / `client/src/components/...`).
- Explorer 3: Investigate Matchmaking player card "Add Friend" button, friend API endpoints, client services/slices, and backend friend routes.

### Phase 1: PROJECT.md Synthesis & Feature Inventory
- Collate all explorer findings into `PROJECT.md` at `.agents/PROJECT.md` and project root.
- Document exact file locations, dependencies, API contracts, and test targets.

### Phase 2: Milestone 1 Execution — Navbar & Search Styling (R2, R3)
- Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
- Verify `npm test` and `npm run lint` in `client/`.

### Phase 3: Milestone 2 Execution — Add Friend Integration (R1)
- Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
- Verify button states (default -> loading spinner -> "Request Sent" disabled), API error handling, `npm test` & `npm run lint`.

### Phase 4: Milestone 3 Execution — PR Workflow & Verification (R4)
- Run Worker / QA subagents to:
  1. Create feature branch (`feature/matchmaking-ui-polish`).
  2. Commit changes with conventional commit message.
  3. Push branch to origin.
  4. Create Pull Request using `gh pr create`.
  5. Post automated QA Bot comment.
  6. Invoke QA Engineer subagent for autonomous review/testing.
  7. Confirm all tests and lint pass.

### Phase 5: Synthesis & Reporting to Sentinel
- Perform final gate evaluation.
- Compile completion handoff and send message to parent (Sentinel).
