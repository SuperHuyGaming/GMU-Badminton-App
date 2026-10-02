# Project: Matchmaking UI Polish

## Architecture
- **Frontend**: React 18, Vite, Material-UI v9 (`@mui/material`, `@emotion/react`, `@emotion/styled`), `react-router-dom`, `react-hot-toast`.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, JWT authentication.
- **Code Layout**:
  - `client/src/components/Navbar.jsx` — Header navigation bar with desktop & mobile drawer links
  - `client/src/components/Navbar.test.jsx` — Navbar unit tests (Vitest)
  - `client/src/pages/Matchmaking.jsx` — Matchmaking page with search bar and player cards
  - `client/src/pages/Matchmaking.test.jsx` — Matchmaking unit tests (Vitest)
  - `client/src/pages/Matchmaking.challenge.test.jsx` — Rapid-click and state stress tests
  - `client/src/pages/NavbarAndMultiCard.challenge.test.jsx` — Multi-card and Navbar isolation tests
  - `client/src/utils/api.js` — Client API fetch wrapper with Bearer token authentication
  - `server/routes/friends.js` — Friend request endpoints (`POST /api/friends/request`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Navbar "Players" Tab Deprecation | Remove "Players" navigation link from desktop and mobile drawer in Navbar.jsx, add negative assertion test | M1 | Survey 1 (ORIGINAL_REQUEST R3) |
| 2 | Matchmaking Search Bar Translucent Styling | Style search bar TextField with translucent fill (`rgba(255, 255, 255, 0.08)`), backdrop blur, and border contrast in dark mode | M1 | Survey 2 (ORIGINAL_REQUEST R2) |
| 3 | "Add Friend" Button Integration & UI Feedback | Replace stub alert with `POST /api/friends/request` API call, display loading spinner during request, transition to disabled "Request Sent" upon success | M1 | Survey 3 (ORIGINAL_REQUEST R1) |
| 4 | Matchmaking & Navbar Unit Test Suite | Comprehensive unit tests for Navbar and Matchmaking (Add Friend button states and search bar) | M1 | Survey 1 & 3 (ORIGINAL_REQUEST AC) |
| 5 | Pull Request & Autonomous QA Workflow | Create feature branch, commit, push, create PR on GitHub, post QA Bot comment, invoke QA Engineer | M2 | Survey 1-3 & Rules (ORIGINAL_REQUEST R4) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Matchmaking UI Polish & Test Coverage | R1 ("Add Friend" integration), R2 (search bar styling), R3 (Navbar "Players" removal), and Unit Tests | none | DONE |
| 2 | Automated Verification & PR Workflow | R4: Git feature branch, commit, push, GitHub PR creation, QA Bot comment, QA Engineer autonomous review | M1 | DONE |

## Interface Contracts
### Client ↔ Server: Friend Request
- **Endpoint**: `POST /api/friends/request`
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body**: `{ "recipientId": "<player._id>", "requesterId": "<user.id>" }`
- **Response (200 OK)**: `{ "message": "Friend request sent" }` or `{ "message": "Friend request accepted automatically" }`
- **Response (400 Bad Request)**: `{ "message": "Request already sent" | "Already friends" | "Cannot add yourself" }`
- **Response (401 Unauthorized)**: `{ "message": "No token, authorization denied" }`
