# Handoff Report — Explorer 1 (Backend Specialist)

## 1. Observation
1. **User Schema Friends Arrays (`server/models/User.js:56-60`)**:
   ```javascript
   friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   ```
   Friendships and pending requests are modeled directly on the `User` schema as arrays of `ObjectId`s.
   In addition, `server/models/User.js:102-108` declares a `post("save")` hook publishing to Kafka (`publishEvent("user-events", ...)`), meaning `doc.save()` triggers Kafka event publishing while `findOneAndUpdate` bypasses it.

2. **Matchmaking Discovery Implementation (`server/routes/matchmaking.js:56-61, 90-92, 119-129`)**:
   ```javascript
   const currentUser = await User.findById(req.user.userId).lean();
   
   // Build base query (exclude self)
   const query = {
       _id: { $ne: req.user.userId },
   };
   // Cursor-Based Pagination
   if (cursor) {
       query._id = { $ne: req.user.userId, $lt: cursor };
   }
   ```
   The discovery query currently only excludes `req.user.userId`. It does not exclude `currentUser.friends`, `currentUser.friendRequests`, or `currentUser.sentFriendRequests`. Neither `potentialMatches` nor `recommended` contains a `friendshipStatus` property.

3. **Existing Friends Routes (`server/routes/friends.js:40-205`)**:
   - `POST /api/friends/request`: Expects `req.body.recipientId` (line 45). However, `client/src/pages/Matchmaking.jsx:327` and `client/src/pages/Matchmaking.test.jsx:182` transmit `{ friendId: playerId }`.
   - `POST /api/friends/accept`: Pulls `requesterId` from `user.friendRequests` and pushes to `friends` without verifying that `requesterId` was actually present in `user.friendRequests` (lines 118-124).
   - `POST /api/friends/reject`: Exists at line 146, but there is NO `/decline` endpoint.
   - Sockets: Sockets join personal rooms via `socket.join(userId)` (`server/server.js:151`). Notifications and real-time events are emitted via `req.app.get("io").to(recipientId).emit(...)`.

4. **Existing Test Suite Baseline**:
   - `npm test` in `server/`: 7 suites passed, 72 tests passed.
   - `npm test` in `client/`: 10 suites passed, 46 tests passed.
   - `npm run lint` in both `server/` and `client/`: 0 errors, 0 warnings.
   - Specifically in `server/tests/matchmaking.test.js:134-137`:
     ```javascript
     expect(res.body).toEqual({
         matches: mockMatches,
         recommended: mockRecommended
     });
     ```
     This strictly expects matches without `friendshipStatus`. Adding `friendshipStatus` to discover response requires updating this test's mock data or expectations.

---

## 2. Logic Chain
1. *From Observation 1 and 2*: The `/api/matchmaking/discover` query must exclude existing friends and active pending requests. By gathering `excludedIds = [req.user.userId, ...(currentUser?.friends || []), ...(currentUser?.friendRequests || []), ...(currentUser?.sentFriendRequests || [])]`, MongoDB's query can filter them out with `_id: cursor ? { $nin: excludedIds, $lt: cursor } : { $nin: excludedIds }`.
2. *From Observation 2*: Requirement R1 mandates calculating and returning `friendshipStatus` ("none", "pending", "friends") on each player card. Even though the query excludes friends and pending requests from the broad discovery feed, mapping `friendshipStatus` across both `matches` and `recommended` guarantees deterministic hydration for search results, recommendations, and tests.
3. *From Observation 3*: Callers across the frontend use different field names (`recipientId` vs `friendId` vs `targetId`). Normalizing parameter destructuring (`const recipientId = req.body.recipientId || req.body.friendId || req.body.targetId;`) guarantees zero regression across `Matchmaking.jsx`, `Profile.jsx`, and `Messages.jsx`.
4. *From Observation 3*: In `/api/friends/accept`, the lack of checking whether `requesterId` is in `user.friendRequests` allows arbitrary friend additions without authorization. Enforcing `user.friendRequests.some(id => id.toString() === requesterId.toString())` closes this security loophole.
5. *From Observation 3*: Requirement R3 requires `/api/friends/decline`. Creating `router.post("/decline", ...)` while keeping `/reject` as a backward-compatible alias satisfies R3 without breaking existing frontend calls.
6. *From Observation 1 and 3*: Sockets are keyed by `userId` room (`socket.join(userId)` in `server.js:151`). Using `req.app?.get("io")?.to(targetId).emit(...)` ensures real-time updates for `friendRequestReceived`, `friendRequestAccepted`, and `friendRequestDeclined` across clients while remaining safe when `io` is unmocked in test environments.

---

## 3. Caveats
1. **Mongoose Versioning & In-Memory vs DB Mutation**: If `doc.save()` is used concurrently on two documents, Mongoose versioning handles optimistic concurrency, but under heavy parallel load, transactions (`session.startTransaction()`) or atomic operators (`$addToSet`/`$pull`) could be considered. However, atomic operators bypass Mongoose's `post("save")` Kafka hook (`server/models/User.js:102`). The recommended solution uses `doc.save()` to maintain Kafka stream compatibility.
2. **Existing Matchmaking Unit Test Strictness**: `server/tests/matchmaking.test.js` uses strict `toEqual` on `res.body`. The implementation agent must update `mockMatches` in `matchmaking.test.js` to expect `friendshipStatus: 'none'`, or adjust the test assertion.
3. **Frontend Integration Scope**: Frontend component `<FriendActionButton>` and page updates in `Matchmaking.jsx` and `Profile.jsx` were reviewed for API contract compatibility, but frontend implementation details belong to Explorer 2 / Implementer.

---

## 4. Conclusion
The backend architecture is clean and well-positioned for the Facebook-style friend request system. To complete the requirements:
1. In `server/routes/matchmaking.js`: Modify the query to exclude `[currentUser._id, ...friends, ...friendRequests, ...sentFriendRequests]` via `_id: { $nin: excludedIds }` (handling cursor pagination with `$lt`), and attach `friendshipStatus: ("none" | "pending" | "friends")` to all returned matches and recommendations.
2. In `server/routes/friends.js`:
   - Implement `POST /api/friends/decline` and retain `POST /api/friends/reject` as an alias.
   - Accept flexible request bodies (`friendId`, `recipientId`, `targetId`, `requesterId`).
   - Validate pending requests in `/accept` before mutating arrays to prevent unauthorized friendship injection.
   - Safely mutate arrays without duplicates and emit Socket.io events (`friendRequestReceived`, `friendRequestAccepted`, `friendRequestDeclined`) to the target rooms via `req.app.get("io").to(id).emit(...)`.
3. Update server tests in `server/tests/matchmaking.test.js` to validate exclusion and `friendshipStatus`.

---

## 5. Verification Method
1. **Server Unit Tests**:
   Run `npm test` in `server/` to verify all 7 test suites pass:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
2. **Client Unit Tests**:
   Run `npm test` in `client/` to verify frontend tests pass:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\client"
   npm test
   ```
3. **Code Style & Lint**:
   Run `npm run lint` in both `server/` and `client/` directories:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server" && npm run lint
   cd "D:\GMU Fall 2026\GMU-Badminton-App\client" && npm run lint
   ```
4. **Invalidation Conditions**:
   - The solution is invalidated if `/api/matchmaking/discover` returns a player whose ID is present in the requesting user's `friends`, `friendRequests`, or `sentFriendRequests`.
   - The solution is invalidated if `/api/friends/accept` can be triggered without an existing pending request in `friendRequests`.
   - The solution is invalidated if `POST /api/friends/decline` returns 404.
