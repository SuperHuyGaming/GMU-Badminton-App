# Milestone 1 Backend Review & Adversarial Analysis

**Author**: Reviewer 1 (Backend Specialist)  
**Target Files**:
- `server/routes/matchmaking.js`
- `server/routes/friends.js`
- `server/tests/friends.test.js`
- `server/tests/matchmaking.test.js`

---

## 1. Executive Summary

- **Verdict**: **APPROVE**
- **Integrity Violation Check**: **PASS (0 violations found)**
- **Automated Verification**:
  - `npm test` in `server/`: **8 test suites passed, 97 tests passed** (100% pass)
  - `npm run lint` in `server/`: **0 errors, 0 warnings**
  - Independent client verification (`npm test` in `client/`): **12 test suites passed, 71 tests passed**
- **Assessment**: The backend implementation completely satisfies Milestone 1 requirements (R1, R2, R3). Query exclusion via `$nin: excludedIds` is robust, `friendshipStatus` hydration is accurate, friend request routes are securely guarded against unauthorized acceptance, array mutations prevent duplicates, and real-time Socket.io events are cleanly emitted.

---

## 2. Integrity Violation Audit

| Integrity Check | Status | Verification & Evidence |
|---|---|---|
| **Hardcoded Test Results** | **PASS** | Grepped and visually inspected source files (`matchmaking.js`, `friends.js`). All queries use dynamic parameters (`req.user.userId`, `req.body`, `req.query`). No hardcoded mock responses or test shortcuts embedded in production routes. |
| **Dummy / Facade Implementations** | **PASS** | Complete document mutations (`pull`, `push`, `save()`), real Mongoose ODM interactions, schema validation (`mongoose.isValidObjectId`), and live Socket.io room emissions implemented. |
| **Shortcuts / Task Bypasses** | **PASS** | No external delegation or skipped steps. Implemented full Facebook-style workflow: request -> accept (with pending verification) / decline / reject / remove. |
| **Fabricated Verification Outputs** | **PASS** | All test logs independently reproduced and verified by Reviewer 1 running `npm test` and `npm run lint` directly on Windows PowerShell. |
| **Self-Certifying Work** | **PASS** | Test suites in `server/tests/friends.test.js` and `server/tests/matchmaking.test.js` execute independently against Supertest endpoints and Express routers with complete assertions. |

---

## 3. Quality Review

### 3.1 Correctness & Requirements Conformance
1. **Matchmaking Discovery Exclusion (`server/routes/matchmaking.js`)**:
   - `excludedIds` combines `req.user.userId`, `currentUser.friends`, `currentUser.friendRequests`, and `currentUser.sentFriendRequests`.
   - Handles both populated objects (`f?._id`) and raw ObjectId references (`f`).
   - MongoDB base query applies `_id: { $nin: excludedIds }`.
   - Cursor pagination preserves exclusion: `_id: { $nin: excludedIds, $lt: cursor }`.
   - "People You May Know" (`recommended`) query also enforces `_id: { $nin: excludedIds }`.
   - Correctly satisfies Requirement R1.
2. **`friendshipStatus` Hydration**:
   - `getFriendshipStatus(targetId)` evaluates target relationship against `currentUser.friends`, `currentUser.sentFriendRequests`, and `currentUser.friendRequests`, returning `"friends"`, `"pending"`, or `"none"`.
   - Every returned player card in `matches` and `recommended` is hydrated with `friendshipStatus`.
3. **Friend Request Routes (`server/routes/friends.js`)**:
   - **`POST /api/friends/request`**:
     - Parameter flexibility: accepts `recipientId`, `friendId`, or `targetId`.
     - Validates ObjectId format.
     - Blocks self-addition with 400 (`Cannot add yourself`).
     - Blocks existing friendships with 400 (`Already friends`).
     - Blocks duplicate requests with 400 (`Request already sent`).
     - Auto-accepts mutual requests if the recipient already sent a request, deduplicating `friends` arrays.
     - Emits `newNotification` and `friendRequestReceived` with complete requester profile data.
   - **`POST /api/friends/accept`**:
     - Verifies `user.friendRequests` contains `requesterId`. Blocks unauthorized acceptance with 400 (`No pending friend request from this user`).
     - Moves IDs from `friendRequests`/`sentFriendRequests` to `friends` on both documents.
     - Deduplicates array insertion via `!user.friends.some(...)`.
     - Emits `newNotification` and `friendRequestAccepted` to both user rooms.
   - **`POST /api/friends/decline` & `/reject`**:
     - Reusable handler `handleDeclineOrReject` cleans both incoming and outgoing requests on both users.
     - Emits `friendRequestDeclined` to both participant rooms.
     - Preserves `/reject` for backward compatibility.
   - **`POST /api/friends/remove`**:
     - Pulls friendship from both users and emits `friendRemoved`.
4. **Socket.io Event Emission**:
   - All socket operations safely guarded by `const io = req.app?.get("io") || req.io; if (io) { ... }`.
   - Emits directly to target user rooms (`io.to(userId)`), matching the `joinUserRoom` listener configured in `server/server.js:149`.

### 3.2 Test Coverage & Rigor
- `server/tests/friends.test.js`:
  - 14 comprehensive test cases covering authentication, 400/403/404 error cases, mutual auto-acceptance, unauthorized accept prevention, notification creation, and Socket.io event emissions.
- `server/tests/matchmaking.test.js`:
  - 7 test cases covering presence, queue join/leave, bracket generation, cursor pagination, and `$nin` exclusion with `friendshipStatus: "none"`.
- Total backend tests: **97 passed across 8 test suites**.

### 3.3 Code Quality & Conventions
- Conforms to project ESLint standards (0 lint errors/warnings).
- Async handlers consistently wrapped in `try ... catch` blocks passing errors to `next(error)`.
- Input validation on all IDs using `mongoose.isValidObjectId`.

---

## 4. Adversarial Review & Attack Surface Challenges

### Challenge 1: Unauthorized Friendship Spoofing
- **Assumption**: A malicious user cannot force another user to become friends without consent.
- **Attack Scenario**: Attacker calls `POST /api/friends/accept` supplying an arbitrary `requesterId` who never sent a friend request.
- **Stress-Test Analysis**:
  In `server/routes/friends.js:142-145`:
  ```javascript
  const hasPendingRequest = user.friendRequests.some(id => (id._id || id).toString() === requesterId);
  if (!hasPendingRequest) {
      return res.status(400).json({ message: "No pending friend request from this user" });
  }
  ```
  `user` is loaded strictly from `req.user.userId` (authenticated JWT token). The check strictly requires `requesterId` to be inside `user.friendRequests`.
- **Verdict**: **DEFENDED (Pass)**. Attacker receives 400 Bad Request; database is not mutated.

### Challenge 2: Null / Deleted Current User in Discovery
- **Assumption**: If `currentUser` does not exist in the database (e.g. deleted account with lingering JWT), discovery does not crash.
- **Attack Scenario**: Call `GET /api/matchmaking/discover` with a valid JWT whose user record was deleted from MongoDB.
- **Stress-Test Analysis**:
  `const currentUser = await User.findById(req.user.userId).lean();`
  `excludedIds` defaults to `[req.user.userId]`.
  All array iteration blocks are guarded with `if (currentUser) { ... }`.
  `getFriendshipStatus` starts with `if (!currentUser || !targetId) return "none";`.
  `recommended` query is guarded with `if (currentUser && currentUser.homeUniversity) { ... }`.
- **Verdict**: **DEFENDED (Pass)**. Route returns valid JSON with status 200 without throwing null pointer exceptions.

### Challenge 3: Unhandled Socket Server Downtime or Test Environment
- **Assumption**: Backend route does not crash if Socket.io server is missing or fails to initialize.
- **Attack Scenario**: Running tests or server in minimal mode without Socket.io attached to Express app.
- **Stress-Test Analysis**:
  `const io = req.app?.get("io") || req.io;`
  `if (io) { ... }` guards every socket emission across `request`, `accept`, `decline`, and `remove`.
- **Verdict**: **DEFENDED (Pass)**. Safe fallback prevents crashes.

### Challenge 4: Concurrency & Duplicate Friend Additions
- **Assumption**: Rapid double-clicking or concurrent requests cannot produce duplicate IDs in the `friends` array.
- **Attack Scenario**: User clicks "Accept" twice in rapid succession before first network call resolves.
- **Stress-Test Analysis**:
  In `POST /accept`:
  `if (!user.friends.some(id => (id._id || id).toString() === requesterId)) user.friends.push(requesterId);`
  `if (!requester.friends.some(id => (id._id || id).toString() === userId)) requester.friends.push(userId);`
  In addition, on the second call, `user.friendRequests` has already had `requesterId` pulled, so the pending request validation (`hasPendingRequest`) returns 400.
- **Verdict**: **DEFENDED (Pass)**. Duplicates are blocked both by array membership check and by pending request invalidation.

---

## 5. Verified Claims Summary

| Claim | Verification Method | Result |
|---|---|---|
| Discovery excludes `currentUser`, `friends`, `friendRequests`, and `sentFriendRequests` via `$nin` | Code inspection of `server/routes/matchmaking.js:56-85` & `server/tests/matchmaking.test.js` | **PASS** |
| `friendshipStatus` hydrated on matches and recommendations | Code inspection of `server/routes/matchmaking.js:143,159` & `server/tests/matchmaking.test.js` | **PASS** |
| Unauthorized acceptance blocked with 400 | Code inspection of `server/routes/friends.js:142-145` & `server/tests/friends.test.js:285-301` | **PASS** |
| Safe array mutations via `pull` / `push` / `save()` | Code inspection of `server/routes/friends.js` & Supertest integration tests | **PASS** |
| Real-time Socket.io events emitted to user rooms | Code inspection of `server/routes/friends.js` & mock assertions in `server/tests/friends.test.js` | **PASS** |
| `npm test` in `server/` passes 100% | Executed `npm test` in `server/` via PowerShell | **PASS (8 suites, 97 tests)** |
| `npm run lint` in `server/` passes with 0 errors | Executed `npm run lint` in `server/` via PowerShell | **PASS (0 errors)** |

---

## 6. Caveats & Non-Blocking Observations

- **Caveat 1 (Document-Level Atomicity)**: In MongoDB without multi-document replica set transactions, if a fatal database crash occurs between `await user.save()` and `await requester.save()`, one document could save without the other. This is consistent with the app's established Mongoose architecture across all existing features (matches, tournaments, posts) and poses minimal real-world risk.
- **Caveat 2 (Search Query vs Friendship Status)**: Since `_id: { $nin: excludedIds }` excludes all existing and pending friends from discovery, users found in discovery will virtually always have `friendshipStatus: "none"`. This correctly adheres to Requirement R1 while preserving `getFriendshipStatus` for defense-in-depth and future search feed enhancements.

---

## 7. Conclusion

The Milestone 1 backend implementation is verified, secure, conformant to interface contracts, and thoroughly tested. No integrity violations or regressions were identified. Reviewer 1 issues an **APPROVE** verdict.
