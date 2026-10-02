# DISPATCH — Worker Milestone 1

## Objective
Implement Milestone 1: Complete Facebook-Style Friend Request System (Backend R1 & R3, Frontend R2 & R3, and full test suites).

## Working Directory
`D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1`

## Inputs
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md`
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md`
- Explorer 1 Analysis: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_1\analysis.md`
- Explorer 2 Analysis: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_2\analysis.md`
- Explorer 3 Analysis: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_3\analysis.md`

## File Ownership
You exclusively own and may edit or create the following files:
- `server/routes/matchmaking.js`
- `server/routes/friends.js`
- `server/tests/friends.test.js`
- `server/tests/matchmaking.test.js`
- `client/src/components/FriendActionButton.jsx`
- `client/src/components/FriendActionButton.test.jsx`
- `client/src/pages/Matchmaking.jsx`
- `client/src/pages/Matchmaking.test.jsx`
- `client/src/pages/Profile.jsx`
- `client/src/components/profile/ProfileHeader.jsx`

## Tasks to Execute:
1. **Backend Hydration & Exclusion (`server/routes/matchmaking.js`)**:
   - In `/api/matchmaking/discover`: Fetch `currentUser` with friends, friendRequests, and sentFriendRequests.
   - Construct `excludedIds = [req.user.userId, ...(currentUser?.friends || []), ...(currentUser?.friendRequests || []), ...(currentUser?.sentFriendRequests || [])]`.
   - Update MongoDB query: `_id: cursor ? { $nin: excludedIds, $lt: cursor } : { $nin: excludedIds }`.
   - Hydrate all returned players in `matches` and `recommended` with `friendshipStatus` ("none", "pending", "friends").

2. **Backend Accept/Decline Handlers & Sockets (`server/routes/friends.js`)**:
   - Normalize body parameters: support `recipientId`, `friendId`, `targetId`, and `requesterId`.
   - In `POST /api/friends/request`: Add to sender `sentFriendRequests` and recipient `friendRequests`, call `doc.save()`, and emit `friendRequestReceived` & `newNotification` via `req.app.get("io")?.to(recipientId).emit(...)`.
   - In `POST /api/friends/accept`:
     - Validate that `requesterId` exists in `user.friendRequests`. If not, return 400 Bad Request ("No pending friend request from this user").
     - Pull from `friendRequests` and `sentFriendRequests`, push to `friends` of both users safely (no duplicate IDs using `.some()`), call `doc.save()`.
     - Emit `friendRequestAccepted` via `req.app.get("io")?.to(requesterId).emit(...)`.
   - In `POST /api/friends/decline`:
     - Implement route and keep `/reject` as alias. Pull from `friendRequests` and `sentFriendRequests`, call `doc.save()`.
     - Emit `friendRequestDeclined` via `req.app.get("io")?.to(requesterId).emit(...)`.

3. **Backend Tests**:
   - Create `server/tests/friends.test.js` testing `/request`, `/accept`, `/decline`, unauthorized `/accept` rejection, array mutations, and Socket.io event emissions.
   - Update `server/tests/matchmaking.test.js` to assert `$nin` query exclusion and `friendshipStatus` property on matches.

4. **Dynamic `<FriendActionButton>` Component (`client/src/components/FriendActionButton.jsx`)**:
   - Create reusable component handling states: `"none"` ("Add Friend"), `"pending"` ("Request Sent", disabled), `"friends"` ("Friends"), and `"request_received"` ("Accept Request").
   - Implement optimistic UI updates: change state instantly before API resolves, show `<CircularProgress size={16} />` during network calls, disable button to prevent double-clicks.
   - Implement error rollback: catch network/API errors, revert to `prevStatus`, display toast error, and invoke `onStatusChange` callback.
   - Support `targetUserId === currentUserId` guard (returns `null`).
   - Create unit tests in `client/src/components/FriendActionButton.test.jsx`.

5. **Frontend Integration & Socket Sync**:
   - In `client/src/pages/Matchmaking.jsx`: Replace old button in `renderPlayerCard` with `<FriendActionButton>`. Connect to singleton `client/src/utils/socket.js`, listen for `friendRequestReceived` and `friendRequestAccepted`.
   - In `client/src/pages/Profile.jsx`: Replace `const socket = io(...)` with singleton `client/src/utils/socket.js`. Listen for friend socket events.
   - In `client/src/components/profile/ProfileHeader.jsx`: Delegate friend button rendering to `<FriendActionButton>`.
   - Update `client/src/pages/Matchmaking.test.jsx` as needed.

6. **Verification**:
   - Run `npm test` and `npm run lint` in `server/`.
   - Run `npm test`, `npm run lint`, and `npm run build` in `client/`.
   - All tests MUST pass with 0 lint errors.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-30T01:10:53Z
You are Worker 1 for Milestone 1 of the GMU Badminton App project.
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1
Your detailed instructions are in: D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1\DISPATCH.md
Read:
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_1\analysis.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_2\analysis.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_3\analysis.md

