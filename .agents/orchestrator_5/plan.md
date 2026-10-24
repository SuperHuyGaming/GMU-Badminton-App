# Enterprise Tournament Platform — Master Plan

## Architecture & Decomposition

### Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline Health Verification | Ensure all 14 server test suites and 15 client test files are passing | M0 | Survey (Completed) |
| 2 | Clean Slate & Seeding Core | Purge legacy data, seed 2026/2027 collegiate/open tournaments in <100ms via bulkWrite | M1 | R1 (ORIGINAL_REQUEST.md) |
| 3 | Court Scheduling & Match Backend | RAC Courts 1-6 model, BWF TournamentMatch model, Socket.io event emissions | M1 | R3 (ORIGINAL_REQUEST.md) |
| 4 | Interactive Bracket Engine | Hardware-accelerated Single/Double Elim & Round Robin with pan/zoom, collision prevention | M2 | R2 (ORIGINAL_REQUEST.md) |
| 5 | Court Queue & Umpire Touch Pad UI | RAC Courts 1-6 viewer, touch umpire scorepad with BWF service court display and live socket sync | M2 | R3 (ORIGINAL_REQUEST.md) |
| 6 | Master 50-Sprint Plan Document | 10 specialized roles × 20 concrete initiatives = 200 total initiatives in enterprise_tournament_platform_50_sprint_plan.md | M3 | R4 (ORIGINAL_REQUEST.md) |
| 7 | GitHub Milestones & Issue Templates | 5 GitHub milestones and .github/ISSUE_TEMPLATE/tournament_initiative.yml | M3 | R4 (ORIGINAL_REQUEST.md) |
| 8 | Multi-Agent Review, Challenge & Forensic Audit | Reviewers, Challengers, and Forensic Integrity Auditor gate check | M4 | Quality Gate |
| 9 | PR Workflow & QA Merge | Feature branch, gh pr create, QA bot comment, QA validation, squash merge into develop | M5 | Repository Invariant |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Codebase Audit | Comprehensive backend, frontend, and plan audit | none | DONE |
| M1 | Backend Core: Seeding & Court Engine | Clean slate seed (<100ms), RAC Courts 1-6, BWF TournamentMatch, Socket.io | M0 | IN_PROGRESS |
| M2 | Frontend Core: Bracket & Umpire Pad | Interactive Bracket Engine, Court Queue, Touch Umpire Pad, Socket listeners | M1 | PENDING |
| M3 | Master 50-Sprint Plan & GitHub Projects | enterprise_tournament_platform_50_sprint_plan.md (200 initiatives), milestones, issue template | M0 | PENDING |
| M4 | Gate: Review, Stress Test & Forensic Audit | 2 Reviewers, 2 Challengers, 1 Forensic Auditor | M1, M2, M3 | PENDING |
| M5 | PR Workflow, QA Lead & Squash Merge | Feature branch, PR, QA bot comment, QA validation, squash merge | M4 | PENDING |

## Code Layout Boundaries
- M1 Backend Worker:
  - `server/models/Court.js` (NEW)
  - `server/models/TournamentMatch.js` (NEW)
  - `server/utils/autonomousHunter.js` (update seeding to bulkWrite, <100ms)
  - `server/scripts/cleanSlateSeedTournaments.js` (NEW standalone runner)
  - `server/routes/courts.js` (NEW)
  - `server/routes/tournaments.js` (add reset-seed endpoint)
  - `server/server.js` (mount courts route and socket handlers)
  - `server/tests/cleanSlateSeed.test.js` (NEW benchmark & verification tests)
  - `server/tests/courtScheduling.test.js` (NEW court & umpire tests)
- M2 Frontend Worker:
  - `client/src/components/TournamentBracket.jsx` (Interactive bracket visualizer with pan/zoom)
  - `client/src/components/CourtQueueViewer.jsx` (NEW: RAC Courts 1-6 monitor)
  - `client/src/components/UmpireDigitalPad.jsx` (NEW: touch umpire pad with BWF service court display)
  - `client/src/pages/Tournaments.jsx` (integrate bracket, court queue, umpire pad tabs/views)
  - `client/src/components/TournamentBracket.test.jsx` (NEW)
  - `client/src/components/UmpireDigitalPad.test.jsx` (NEW)
- M3 Planning Worker:
  - `enterprise_tournament_platform_50_sprint_plan.md` (NEW: 200 initiatives across 10 roles & 50 sprints)
  - `.github/ISSUE_TEMPLATE/tournament_initiative.yml` (NEW)
  - GitHub milestones created via `gh api`
