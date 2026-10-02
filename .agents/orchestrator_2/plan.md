# Plan — orchestrator_2: Complete Friend Request System

## 1. Survey Phase
Spawn 3 parallel Explorers:
- **Explorer 1 (Backend Focus)**: Investigate MongoDB User model schema (`friends`, `friendRequests`), `/api/matchmaking/discover` controller & query, `/api/friends` existing routes, Socket.io integration on server.
- **Explorer 2 (Frontend Focus)**: Investigate `Matchmaking.jsx`, `Profile.jsx`, how player cards render "Add Friend", optimistic state requirements, Socket.io client setup, and reusable `<FriendActionButton>` design.
- **Explorer 3 (Tests & PR Workflow Focus)**: Investigate client/server Vitest/Jest suites, linting configuration, existing mocks, socket test patterns, git branch state, and PR requirements.

## 2. Plan & Spec Synthesis
- Consolidate explorer findings into `.agents/PROJECT.md` Feature Inventory & Architecture.
- Verify clear interface contracts (endpoint inputs/outputs, socket event payloads, component props).

## 3. Implementation (Worker)
- Dispatch Worker to implement R1, R2, R3:
  - Backend: update `/api/matchmaking/discover` exclusion & `friendshipStatus` calculation; implement `/api/friends/accept` and `/api/friends/decline` routes; emit socket events.
  - Frontend: create `<FriendActionButton>` in `client/src/components/FriendActionButton.jsx`; integrate in `Matchmaking.jsx` and `Profile.jsx` with optimistic updates & socket event listener updates.
  - Tests: write/update unit and integration tests across client and server.

## 4. Verification & Gate
- Dispatch Reviewers (2) and Challengers (2) to rigorously test optimistic UI, edge cases, error rollbacks, query exclusions, socket emission.
- Dispatch Auditor for integrity validation.

## 5. PR Workflow Execution
- Ensure changes are on a clean feature branch (e.g. `feature/friend-request-system`).
- Push branch, create PR targeting `develop`, post QA Bot comment.
- Invoke `qa_engineer` subagent for autonomous testing & review comment.
- Merge upon QA PASS.

## 6. Synthesis & Final Handoff
- Produce comprehensive final handoff to Sentinel.
