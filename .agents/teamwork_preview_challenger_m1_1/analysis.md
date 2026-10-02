# Adversarial Challenge & Concurrency Stress Report — Milestone 1

## Challenge Summary

**Overall risk assessment**: HIGH

Empirical challenge testing of the backend friend request implementation and matchmaking discovery query exclusion revealed four concrete failure modes, including two uncaught `TypeError` crashes leading to HTTP 500 server errors, one array pollution defect, and one ghost request state leak during bidirectional or concurrent friend operations.

---

## Challenges

### [Critical] Challenge 1: Uncaught `TypeError` in Matchmaking Discovery Query Exclusion on Null References

- **Assumption challenged**: Assumed `currentUser.friends`, `currentUser.friendRequests`, and `currentUser.sentFriendRequests` contain only non-null objects or ObjectIds with a `.toString()` method.
- **Attack scenario**: When a user's friend or request list contains a `null` or unpopulated reference (which occurs naturally in MongoDB when a referenced user document is removed or an array item is cleared), `(f?._id || f).toString()` evaluates `null.toString()`.
- **Blast radius**: Crashes `GET /api/matchmaking/discover` with an uncaught `TypeError: Cannot read properties of null (reading 'toString')`, returning HTTP 500 (`Server error during player discovery`) to the client and completely breaking the discovery feed.
- **Mitigation**: Filter out nulls/falsy values before invoking `.toString()`, e.g.:
  ```javascript
  if (Array.isArray(currentUser.friends)) {
      currentUser.friends.forEach(f => {
          const id = f?._id || f;
          if (id) excludedIds.push(id.toString());
      });
  }
  ```
  And in `getFriendshipStatus`:
  ```javascript
  if (currentUser.friends?.some(id => (id?._id || id)?.toString() === targetStr)) return "friends";
  ```

---

### [High] Challenge 2: Unhandled Null Element Crash in Friend Request and Acceptance Routes

- **Assumption challenged**: Assumed all elements in `recipient.friends`, `recipient.friendRequests`, and `requester.friendRequests` are non-null when evaluating `.some(id => (id._id || id).toString() === requesterId)`.
- **Attack scenario**: If any user in the database has a `null` entry in their `friends` or `friendRequests` array, calling `POST /api/friends/request` or `POST /api/friends/accept` immediately throws an uncaught `TypeError: Cannot read properties of null (reading 'toString')`.
- **Blast radius**: The user receives HTTP 500 and is unable to send or accept friend requests.
- **Mitigation**: Guard all `.some()` predicate checks with optional chaining:
  ```javascript
  if (recipient.friends.some(id => (id?._id || id)?.toString() === requesterId))
  ```

---

### [Medium] Challenge 3: Array Pollution in `sentFriendRequests`

- **Assumption challenged**: Assumed checking `recipient.friendRequests` is sufficient to prevent duplicate requests and maintain array integrity.
- **Attack scenario**: If a user previously sent a request, or if arrays become desynchronized (e.g. recipient declines/clears request, but sender's client retries), `POST /api/friends/request` does not check `requester.sentFriendRequests.some(...)` before pushing. Line 92 unconditionally executes `requester.sentFriendRequests.push(recipientId)`.
- **Blast radius**: Duplicates accumulate in `sentFriendRequests` (`[id2, id2]`), causing memory bloat and potential front-end rendering anomalies.
- **Mitigation**: Guard the push with duplicate check:
  ```javascript
  if (!requester.sentFriendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
      requester.sentFriendRequests.push(recipientId);
  }
  ```

---

### [Medium] Challenge 4: Ghost Request State Leak on Bidirectional or Concurrent Requests

- **Assumption challenged**: Assumed friend requests are strictly unidirectional and that `/accept` only needs to pull `user.friendRequests` and `requester.sentFriendRequests`.
- **Attack scenario**: Under network latency or concurrent requests where User A and User B both send requests to each other before either accepts, both users have each other in `friendRequests` AND `sentFriendRequests`. When User A calls `/accept`, it pulls `user.friendRequests(requesterId)` and `requester.sentFriendRequests(userId)`, but DOES NOT pull `user.sentFriendRequests(requesterId)` or `requester.friendRequests(userId)`.
- **Blast radius**: Both users become friends, but User B continues to see an incoming friend request from User A in their UI, and User A continues to have a sent request to User B.
- **Mitigation**: When accepting, clear both request directions on both documents (matching the cleanup pattern already used in `handleDeclineOrReject`):
  ```javascript
  user.friendRequests.pull(requesterId);
  user.sentFriendRequests.pull(requesterId);
  requester.friendRequests.pull(userId);
  requester.sentFriendRequests.pull(userId);
  ```

---

### [Low] Challenge 5: Idempotency & Socket Event Emission on Non-Existent Request Declines

- **Assumption challenged**: Assumed `/decline` and `/reject` should always execute DB saves and emit socket events regardless of whether a request existed.
- **Attack scenario**: Any authenticated user can issue repeated `POST /api/friends/decline` calls with arbitrary target user IDs. The server performs two DB `.save()` operations, publishes Kafka `user.updated` events, and emits `friendRequestDeclined` socket events to the target user even if no relationship or request ever existed.
- **Blast radius**: Unnecessary DB writes, Kafka queue noise, and socket event emissions.
- **Mitigation**: Verify that at least one array actually contained the ID before saving documents and emitting socket events, or return a 400 Bad Request.

---

## Stress Test Results

| Test ID | Scenario | Expected Behavior | Actual Behavior | Pass/Fail |
|---|---|---|---|---|
| **1.1** | Unauthorized `/accept` when no pending request exists | HTTP 400 "No pending friend request" | HTTP 400 "No pending friend request" | **PASS** |
| **1.2** | `/accept` with mismatching requester ID | HTTP 400 "No pending friend request" | HTTP 400 "No pending friend request" | **PASS** |
| **1.3** | `/accept` with non-existent target user ID | HTTP 404 "User not found" | HTTP 404 "User not found" | **PASS** |
| **1.4** | `/accept` with malformed ObjectId string | HTTP 400 "Valid requester ID is required" | HTTP 400 "Valid requester ID is required" | **PASS** |
| **2.1** | Self-addition attempt via `POST /request` (`recipientId === requesterId`) | HTTP 400 "Cannot add yourself" | HTTP 400 "Cannot add yourself" | **PASS** |
| **2.2** | Self-addition attempt via `friendId` or `targetId` aliases | HTTP 400 "Cannot add yourself" | HTTP 400 "Cannot add yourself" | **PASS** |
| **2.3** | Self-accept attempt (`requesterId === currentUserId`) | HTTP 400 "No pending friend request" | HTTP 400 "No pending friend request" | **PASS** |
| **3.1** | Sequential duplicate `POST /request` calls | HTTP 400 "Request already sent", no duplicates | HTTP 400 "Request already sent", no duplicates | **PASS** |
| **3.2** | `POST /request` when already friends | HTTP 400 "Already friends" | HTTP 400 "Already friends" | **PASS** |
| **3.3** | Double `/accept` call sequence | First: 200 OK; Second: 400 Bad Request | First: 200 OK; Second: 400 Bad Request | **PASS** |
| **3.4** | Mutual request auto-accept branch | Clears incoming request, adds to friends without duplicates | Auto-accepted, added to friends cleanly | **PASS** |
| **3.5** | Repeated request with pre-existing `sentFriendRequests` entry | Exactly 1 entry in `sentFriendRequests` | 2 duplicate entries in `sentFriendRequests` | **FAIL (Defect)** |
| **3.6** | `POST /request` when friend array contains `null` | HTTP 200, handles null safely | HTTP 500 Uncaught TypeError `null.toString()` | **FAIL (Defect)** |
| **3.7** | Bidirectional requests accepted via `/accept` | All request queues cleared between users | Leaves ghost request in opposite direction | **FAIL (Defect)** |
| **4.1** | Discovery query exclusion of self, friends, incoming, outgoing requests | `$nin` query contains all 4 IDs | `$nin` query contains all 4 IDs | **PASS** |
| **4.2** | Discovery exclusion with populated `{ _id }` friend objects | `$nin` extracts hex ID strings | `$nin` extracts hex ID strings | **PASS** |
| **4.3** | Discovery query exclusion when array contains `null` | HTTP 200, filters null safely | HTTP 500 Uncaught TypeError `null.toString()` | **FAIL (Defect)** |
| **4.4** | Recommended users exclusion and hydration | Excluded from recommended; `friendshipStatus: "none"` | Filtered cleanly; `friendshipStatus: "none"` | **PASS** |
| **5.1** | `POST /decline` request removal and socket emissions | Removes request, emits `friendRequestDeclined` | Removes request, emits `friendRequestDeclined` | **PASS** |
| **5.2** | `POST /reject` alias parity with `/decline` | Identical behavior to `/decline` | Identical behavior to `/decline` | **PASS** |
| **5.3** | Friend routes operation when Socket.io instance is absent | Degrades gracefully without crash | HTTP 200 OK | **PASS** |

---

## Unchallenged Areas

- **MongoDB Distributed Replica Set Locking**: In-memory mocking of Mongoose models verifies query construction, schema validations, and JavaScript array manipulation; testing multi-instance MongoDB multi-document transactions would require an active external replica set.
- **Kafka Network Partitioning**: Event publication was verified through existing unit mock pipelines; live Kafka broker failure recovery is handled by the dedicated Kafka producer module.
