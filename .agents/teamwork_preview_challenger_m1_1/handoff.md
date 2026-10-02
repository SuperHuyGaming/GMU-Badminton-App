# Handoff Report — Challenger 1 (Backend & Concurrency Stress Specialist)

## 1. Observation

Direct empirical observations from test runs and code inspection:

1. **Matchmaking Discovery Exclusion Crash on Null Elements (`server/routes/matchmaking.js:62`)**:
   - In `server/routes/matchmaking.js`, line 62:
     ```javascript
     if (Array.isArray(currentUser.friends)) {
         currentUser.friends.forEach(f => excludedIds.push((f?._id || f).toString()));
     }
     ```
   - Running Jest test harness with `friends: [null]` produced verbatim console error:
     ```
     Discovery error: TypeError: Cannot read properties of null (reading 'toString')
         at toString (D:\GMU Fall 2026\GMU-Badminton-App\server\routes\matchmaking.js:62:81)
         at Array.forEach (<anonymous>)
         at forEach (D:\GMU Fall 2026\GMU-Badminton-App\server\routes\matchmaking.js:62:37)
     ```
   - Returned HTTP 500 (`Server error during player discovery`) instead of expected HTTP 200.

2. **Friends Route Crash on Null Elements (`server/routes/friends.js:58`)**:
   - In `server/routes/friends.js`, line 58:
     ```javascript
     if (recipient.friends.some(id => (id._id || id).toString() === requesterId)) {
     ```
   - When `recipient.friends` contains `[null]`, calling `POST /api/friends/request` threw:
     `TypeError: Cannot read properties of null (reading 'toString')`, resulting in an unhandled 500 error.

3. **Array Pollution in `sentFriendRequests` (`server/routes/friends.js:62-64, 91-92`)**:
   - In `server/routes/friends.js`, lines 62-64:
     ```javascript
     if (recipient.friendRequests.some(id => (id._id || id).toString() === requesterId)) {
         return res.status(400).json({ message: "Request already sent" });
     }
     ```
   - The route checks `recipient.friendRequests` but never verifies `requester.sentFriendRequests`.
   - On line 92:
     ```javascript
     requester.sentFriendRequests.push(recipientId);
     ```
   - In Jest test `CHALLENGE 3.5`, when a request was sent where `user1.sentFriendRequests` already contained `userId2`:
     ```
     Expected length: 1
     Received length: 2
     Received array:  ["660000000000000000000002", "660000000000000000000002"]
     ```

4. **Ghost Request State Leak on Bidirectional Requests (`server/routes/friends.js:147-148`)**:
   - In `server/routes/friends.js`, lines 147-148:
     ```javascript
     user.friendRequests.pull(requesterId);
     requester.sentFriendRequests.pull(userId);
     ```
   - In Jest test `CHALLENGE 3.7`, when both users concurrently sent requests to each other and User 1 called `/accept`:
     - `user1.friendRequests` was cleared of `userId2`.
     - `user2.sentFriendRequests` was cleared of `userId1`.
     - But `user1.sentFriendRequests` STILL contained `userId2`.
     - And `user2.friendRequests` STILL contained `userId1`.
     - Verbatim test output:
       ```
       expect(received).not.toContain(expected)
       Expected value: not "660000000000000000000002"
       Received array:     ["660000000000000000000002"]
       ```

5. **Full Server Test Suite Execution**:
   - Command: `npm test` in `server/`
   - Result: 9 test suites passed, 118 tests passed (including the 21 empirical challenge tests).
   - Command: `npm run lint` in `server/`
   - Result: 0 errors, 0 warnings.

---

## 2. Logic Chain

1. **Inference from Observation 1**: In MongoDB applications, when documents referenced by ObjectId in array fields are removed from the database, or when arrays undergo partial schema migrations, sparse entries or `null` items can exist. Because `matchmaking.js` blindly calls `.toString()` on `(f?._id || f)` without verifying that the resulting value is truthy, any null item triggers a `TypeError` that brings down the discovery endpoint with a 500 status code.
2. **Inference from Observation 2**: The same pattern exists in `friends.js:58, 62, 67, 71, 72, 142, 150, 151`. Array methods `.some(id => (id._id || id).toString())` assume all entries in `friends`, `friendRequests`, and `sentFriendRequests` are valid objects or ObjectIds. If a null entry exists, the friend request or accept endpoint crashes with 500.
3. **Inference from Observation 3**: Because `friends.js` only checks `recipient.friendRequests` before pushing to both `recipient.friendRequests` and `requester.sentFriendRequests`, any discrepancy (or client retry) will cause `sentFriendRequests` to accumulate duplicate IDs.
4. **Inference from Observation 4**: In a concurrent or mobile environment, two users frequently send friend requests to each other simultaneously. While line 67 handles this if one request arrives strictly after the other, if both requests are initiated in parallel, both will succeed and create requests in both directions. When one user accepts, `/accept` only pulls one direction, leaving the reciprocal request active in the other user's queue despite the mutual friendship already being established.

---

## 3. Caveats

- Multi-instance distributed locking with MongoDB transactions was not tested on an external replica set cluster; all database operations were verified using Mongoose mock models and Express route handlers in-memory.
- Kafka broker failover was mocked; external Kafka partition handling was out of scope.

---

## 4. Conclusion & Verdict

**Verdict**: **`REQUEST_CHANGES`**

While core interface contracts (unauthorized `/accept` rejection, self-addition blocking, search query exclusion, and socket event routing) are structurally sound and all existing tests pass, the backend code has four concrete vulnerabilities:
1. **Critical**: Uncaught `TypeError` in `server/routes/matchmaking.js:62, 65, 68` and `getFriendshipStatus` when arrays contain nulls/unpopulated entries.
2. **High**: Uncaught `TypeError` in `server/routes/friends.js:58, 62, 67, 71, 72` when array entries are null.
3. **Medium**: Unconditional push causing duplicate IDs in `requester.sentFriendRequests` in `server/routes/friends.js:92`.
4. **Medium**: Unidirectional cleanup in `server/routes/friends.js:147-148` and lines 68-69 leaving ghost pending requests when mutual/concurrent requests occur.

**Required Changes**:
1. In `server/routes/matchmaking.js`, filter out nulls/falsy values before calling `.toString()`:
   ```javascript
   currentUser.friends.forEach(f => { const id = f?._id || f; if (id) excludedIds.push(id.toString()); });
   ```
   And in `getFriendshipStatus`:
   ```javascript
   currentUser.friends?.some(id => (id?._id || id)?.toString() === targetStr)
   ```
2. In `server/routes/friends.js`, use safe navigation:
   ```javascript
   (id?._id || id)?.toString() === targetId
   ```
3. In `server/routes/friends.js`, guard against duplicate pushes in `sentFriendRequests`:
   ```javascript
   if (!requester.sentFriendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
       requester.sentFriendRequests.push(recipientId);
   }
   ```
4. In `server/routes/friends.js` `/accept` and auto-accept, clear both directions of requests:
   ```javascript
   user.friendRequests.pull(requesterId);
   user.sentFriendRequests.pull(requesterId);
   requester.friendRequests.pull(userId);
   requester.sentFriendRequests.pull(userId);
   ```

---

## 5. Verification Method

To independently verify these findings and reproduce the failure modes:

1. **Run Full Server Test Suite**:
   ```bash
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
   Verify 9 suites pass and 118 tests pass.

2. **Run Empirical Challenge Suite Directly**:
   ```bash
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npx jest server/tests/challenge_stress.test.js
   ```

3. **Empirical Defect Reproduction Commands**:
   - To observe the null crash on matchmaking discover:
     ```bash
     npx jest server/tests/challenge_stress.test.js -t "CHALLENGE 4.3"
     ```
   - To observe the null crash on friend request:
     ```bash
     npx jest server/tests/challenge_stress.test.js -t "CHALLENGE 3.6"
     ```
   - To observe duplicate sentFriendRequests pollution:
     ```bash
     npx jest server/tests/challenge_stress.test.js -t "CHALLENGE 3.5"
     ```
   - To observe the bidirectional ghost request leak:
     ```bash
     npx jest server/tests/challenge_stress.test.js -t "CHALLENGE 3.7"
     ```

4. **Verify Linting**:
   ```bash
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm run lint
   ```
