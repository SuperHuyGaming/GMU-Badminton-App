# Changes Implemented for Milestone 1

## Summary
Milestone 1 implemented a complete, Facebook-style friend request system across the full stack, satisfying all backend and frontend requirements (R1, R2, R3).

## 1. Backend Route Changes

### `server/routes/matchmaking.js`
- **Exclusion of Friends and Pending Requests**:
  - Fetched `currentUser` with friends, friendRequests, and sentFriendRequests.
  - Constructed `excludedIds` containing caller's `_id`, friends, incoming requests, and outgoing requests.
  - Updated MongoDB query to `_id: cursor ? { $nin: excludedIds, $lt: cursor } : { $nin: excludedIds }`.
  - Also excluded all `excludedIds` from "People You May Know" (`recommended`) query.
- **Hydration of `friendshipStatus`**:
  - Implemented `getFriendshipStatus(targetId)` returning `"friends"`, `"pending"`, or `"none"`.
  - Mapped and hydrated each player card in `matches` and `recommended` with `friendshipStatus`.

### `server/routes/friends.js`
- **Parameter Normalization**:
  - Supported `recipientId`, `friendId`, `targetId`, and `requesterId` across all endpoints to ensure interoperability.
- **`POST /api/friends/request`**:
  - Added self-add prevention and duplicate request guards.
  - Handled auto-acceptance when mutual requests exist.
  - Pushed to `recipient.friendRequests` and `requester.sentFriendRequests`, calling `doc.save()`.
  - Created persistent `Notification` and emitted real-time Socket.io events (`newNotification` and `friendRequestReceived`) safely guarded with `req.app?.get("io") || req.io`.
- **`POST /api/friends/accept`**:
  - Added security verification ensuring `requesterId` exists in `user.friendRequests`. Returns 400 Bad Request ("No pending friend request from this user") if unauthorized.
  - Pulled from `friendRequests` and `sentFriendRequests`.
  - Safely pushed to `friends` of both users without duplicates.
  - Called `doc.save()` on both users.
  - Emitted `friendRequestAccepted` and `newNotification` via Socket.io to both participants.
- **`POST /api/friends/decline` & `/reject`**:
  - Added `POST /api/friends/decline` with `/reject` as an alias.
  - Pulled from `friendRequests` and `sentFriendRequests` on both users, called `doc.save()`.
  - Emitted `friendRequestDeclined` via Socket.io.
- **`POST /api/friends/remove`**:
  - Safeguarded `req.app?.get("io")` Socket.io emission.

## 2. Backend Test Suites

### `server/tests/friends.test.js` (NEW)
- Created comprehensive integration test suite covering:
  - `GET /:userId` authentication, authorization (403), and data fetching.
  - `POST /request` authentication, validation, self-add guard, duplicate guard, mutual request auto-accept, Notification creation, and Socket.io event emissions (`newNotification`, `friendRequestReceived`).
  - `POST /accept` authentication, validation, unauthorized acceptance prevention (400 if no pending request), array mutations, Notification creation, and Socket.io emissions (`friendRequestAccepted`).
  - `POST /decline` and `POST /reject` parameter handling, array mutations, and Socket.io emission (`friendRequestDeclined`).
  - `POST /remove` friendship removal and Socket.io emission (`friendRemoved`).

### `server/tests/matchmaking.test.js`
- Updated discovery tests to assert `$nin: ['current_user_123']` query filter.
- Added test verifying exclusion of friends and pending incoming/outgoing requests from the discovery feed.
- Asserted `friendshipStatus: "none"` hydration on matches and recommendations.

## 3. Frontend Component & Unit Tests

### `client/src/components/FriendActionButton.jsx` (NEW)
- Created dynamic, reusable MUI component supporting 4 states:
  - `"none"`: "Add Friend" (primary, enabled).
  - `"pending"`: "Request Sent" (inherit, disabled).
  - `"friends"`: "Friends" (success, disabled).
  - `"request_received"`: "Accept Request" (primary, enabled).
- Implemented immediate optimistic UI transitions before network call resolution.
- Displayed `<CircularProgress size={16} />` during in-flight network requests and locked button to prevent double-clicks.
- Implemented automatic rollback to previous state with `toast.error()` upon API failure.
- Included self-view guard (`targetUserId === currentUserId`) that returns `null`.

### `client/src/components/FriendActionButton.test.jsx` (NEW)
- Created 9 unit tests with 100% pass covering:
  - Rendering default "Add Friend" for `initialStatus="none"`.
  - Rendering "Request Sent" (disabled) for `initialStatus="pending"`.
  - Rendering "Friends" (disabled) for `initialStatus="friends"`.
  - Rendering "Accept Request" for `initialStatus="request_received"`.
  - Hiding button when `targetUserId === currentUserId`.
  - Optimistic click transition to "Request Sent" and dispatching `POST /api/friends/request`.
  - Error rollback to "Add Friend" on failed API call.
  - Optimistic transition to "Friends" on accepting request.
  - Error rollback on failed accept call.

## 4. Frontend Page Integrations

### `client/src/pages/Matchmaking.jsx`
- Replaced legacy button in `renderPlayerCard` with `<FriendActionButton>`.
- Connected to singleton `client/src/utils/socket.js`.
- Added listeners for `friendRequestReceived` and `friendRequestAccepted` to dynamically update player cards in real-time.
- Removed unused legacy `handleAddFriend` and `PersonAddIcon` import.

### `client/src/pages/Matchmaking.test.jsx`
- Updated friend request test to expect `<FriendActionButton>` request payload (`{ recipientId: 'user-1', friendId: 'user-1' }`) and "Request Sent" button text.

### `client/src/pages/Profile.jsx`
- Replaced duplicate `const socket = io(...)` with singleton `import socket from "../utils/socket"`.
- Added real-time socket listeners for `friendRequestReceived`, `friendRequestAccepted`, `friendRequestDeclined`, and `friendRemoved`.
- Normalized friend status calculation for ObjectId types.
- Passed `setFriendStatus` down to `ProfileHeader`.

### `client/src/components/profile/ProfileHeader.jsx`
- Delegated action button rendering to `<FriendActionButton>`.
- Preserved Message button when in "friends" state.
