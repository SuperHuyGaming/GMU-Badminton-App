# Project: Complete Facebook-Style Friend Request System

## Architecture
- **Frontend**: React 18, Vite, Material-UI (`@mui/material`), `react-hot-toast`, Socket.io Client (`client/src/utils/socket.js`).
- **Backend**: Node.js, Express, MongoDB (Mongoose `User` model), Socket.io (`server/server.js`), JWT authentication.
- **Code Layout**:
  - `server/models/User.js` — User schema containing `friends`, `friendRequests`, and `sentFriendRequests` arrays.
  - `server/routes/matchmaking.js` — Discovery endpoint `/api/matchmaking/discover` with query exclusion and `friendshipStatus` hydration.
  - `server/routes/friends.js` — Friend routes (`/request`, `/accept`, `/decline`, `/reject`, `/remove`) with array mutation and Socket.io emission.
  - `server/tests/friends.test.js` — Server test suite for friend operations, array mutations, and socket events.
  - `server/tests/matchmaking.test.js` — Server test suite for matchmaking discovery and exclusion.
  - `server/tests/challenge_stress.test.js` — 21 adversarial stress tests covering concurrency, null-safety, array uniqueness, and ghost request cleanup.
  - `client/src/components/FriendActionButton.jsx` — Reusable dynamic friend action button with optimistic rendering and rollback.
  - `client/src/components/FriendActionButton.test.jsx` — Unit tests for `<FriendActionButton>`.
  - `client/src/components/FriendActionButton.stress.test.jsx` — 22 empirical stress tests for `<FriendActionButton>`.
  - `client/src/pages/Matchmaking.jsx` — Matchmaking feed using `<FriendActionButton>` and socket events.
  - `client/src/pages/Profile.jsx` — Profile view using singleton socket and `<FriendActionButton>`.
  - `client/src/components/profile/ProfileHeader.jsx` — Header using `<FriendActionButton>`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Discovery Query Exclusion & Hydration | Exclude `currentUser._id`, `friends`, `friendRequests`, `sentFriendRequests` from `/api/matchmaking/discover` query and hydrate `friendshipStatus` ("none", "pending", "friends") on each player card | M1 | Survey 1 (ORIGINAL_REQUEST R1) |
| 2 | Backend Accept/Decline Routes & Sockets | Implement `/api/friends/accept` (with authorization check), `/api/friends/decline` (with `/reject` alias), safe array mutations via `doc.save()`, and emit real-time Socket.io events (`friendRequestReceived`, `friendRequestAccepted`, `friendRequestDeclined`) | M1 | Survey 1 (ORIGINAL_REQUEST R3) |
| 3 | Reusable `<FriendActionButton>` Component | Component supporting dynamic states ("Add Friend", "Request Sent", "Friends", "Accept Request"), optimistic UI updates, loading spinners, and error rollbacks | M1 | Survey 2 (ORIGINAL_REQUEST R2) |
| 4 | Frontend Page Integration & Real-Time Sockets | Integrate `<FriendActionButton>` in `Matchmaking.jsx` and `Profile.jsx` (via `ProfileHeader.jsx`), connect to singleton socket, and handle real-time UI updates | M1 | Survey 2 (ORIGINAL_REQUEST R2, R3) |
| 5 | Full-Stack Unit & Integration Test Suite | Create `server/tests/friends.test.js`, update `server/tests/matchmaking.test.js`, and create `client/src/components/FriendActionButton.test.jsx` with 100% pass | M1 | Survey 1-3 (ORIGINAL_REQUEST AC) |
| 6 | Pull Request & Autonomous QA Workflow | Branch `feature/friend-request-system`, commit, push to GitHub, create PR via `gh pr create`, post QA Bot comment, invoke `qa_engineer` subagent for autonomous testing & review, and merge | M2 | Survey 3 & Rules (ORIGINAL_REQUEST R4) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Complete Friend Request System Implementation & Tests | Features 1, 2, 3, 4, 5: Backend exclusion/hydration, accept/decline handlers, socket emissions, `<FriendActionButton>` component, page integrations, and complete test suites | none | DONE |
| 2 | PR Workflow, Autonomous QA Validation & Merge | Feature 6: Full verification, git branch creation, push, GitHub PR creation, QA Bot comment, `qa_engineer` review, and squash merge | M1 | DONE |

## Interface Contracts
### 1. Matchmaking Discovery Endpoint
- **URL**: `GET /api/matchmaking/discover?page=1&limit=10&cursor=<id>`
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Exclusion Logic**: Exclude `[req.user.userId, ...user.friends, ...user.friendRequests, ...user.sentFriendRequests]`.
- **Response (200 OK)**:
  ```json
  {
    "matches": [
      {
        "_id": "...",
        "username": "...",
        "skillLevel": "Intermediate",
        "friendshipStatus": "none"
      }
    ],
    "recommended": [
      {
        "_id": "...",
        "username": "...",
        "skillLevel": "Advanced",
        "friendshipStatus": "none"
      }
    ]
  }
  ```

### 2. Friend Request Endpoints
- **POST `/api/friends/request`**:
  - Body: `{ "recipientId": "<userId>", "friendId": "<userId>" }`
  - Action: Adds to sender `sentFriendRequests` and recipient `friendRequests`. Emits `friendRequestReceived` & `newNotification`.
  - Response (200 OK): `{ "message": "Friend request sent" }`

- **POST `/api/friends/accept`**:
  - Body: `{ "requesterId": "<userId>", "friendId": "<userId>", "recipientId": "<userId>" }`
  - Validation: Verify `requesterId` exists in `user.friendRequests`.
  - Action: Removes from `friendRequests` and `sentFriendRequests` in both directions, adds to `friends` of both users. Emits `friendRequestAccepted`.
  - Response (200 OK): `{ "message": "Friend request accepted" }`

- **POST `/api/friends/decline`** (and alias `POST `/api/friends/reject``):
  - Body: `{ "requesterId": "<userId>", "friendId": "<userId>", "recipientId": "<userId>" }`
  - Action: Removes from `friendRequests` and `sentFriendRequests` in both directions. Emits `friendRequestDeclined`.
  - Response (200 OK): `{ "message": "Friend request declined" }`

### 3. Reusable Component Contract: `<FriendActionButton>`
- **Props**:
  - `targetUserId`: string (required) — ID of target player
  - `initialStatus`: `"none" | "pending" | "friends" | "request_received"` (default: `"none"`)
  - `currentUserId`: string (optional) — skips rendering if `targetUserId === currentUserId`
  - `onStatusChange`: `(newStatus, oldStatus) => void` (optional callback)
  - `size`: `"small" | "medium" | "large"` (default: `"medium"`)
  - `fullWidth`: boolean (default: false)
  - `sx`: object (optional MUI styling)
- **Behavior**:
  - When status is `"none"`, displays "Add Friend" button.
  - On click, optimistically switches to "Request Sent" (disabled) with loading spinner.
  - Calls `apiFetch('/api/friends/request', { body: JSON.stringify({ recipientId: targetUserId, friendId: targetUserId }) })`.
  - On success, stays "Request Sent" (disabled).
  - On failure, rolls back to `"none"`, triggers `toast.error(message)`, and notifies `onStatusChange`.
