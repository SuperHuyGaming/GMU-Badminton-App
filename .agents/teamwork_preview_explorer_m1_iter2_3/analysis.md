# Deep Technical Analysis: Bidirectional Pending Request Reconciliation in `server/routes/friends.js`

**Author**: Explorer Remediation 3 (Bidirectional Reconciliation Specialist)  
**Date**: 2026-09-29  
**Target File**: `server/routes/friends.js`  
**Related Test Suites**: `server/tests/friends.test.js`, `server/tests/challenge_stress.test.js`

---

## 1. Executive Summary

In social graph models maintaining dual arrays for pending requests (`friendRequests` for incoming, `sentFriendRequests` for outgoing), establishing or terminating friendship requires **strict bidirectional symmetry**. When two users concurrently or sequentially initiate friend requests, both users' documents accumulate cross-referenced pending entries. 

Currently, `server/routes/friends.js`:
1. In `/accept` (`lines 147-148`), only clears `user.friendRequests.pull(requesterId)` and `requester.sentFriendRequests.pull(userId)`. It fails to clear reciprocal pending entries (`user.sentFriendRequests` and `requester.friendRequests`).
2. In auto-accept (`lines 68-69`), only clears `requester.friendRequests.pull(recipientId)` and `recipient.sentFriendRequests.pull(requesterId)`, repeating the exact same unidirectional defect.
3. Causes **"ghost requests"**: users who are already confirmed friends continue to see pending incoming/outgoing requests in their notifications, profile action buttons, and friend lists. If subsequently unfriended via `/remove`, these zombie requests resurface.

We propose a unified, defensive, idempotent helper `clearBidirectionalRequests(userA, userB)` implemented across all state transition endpoints (`/accept`, auto-accept, `/decline`/`/reject`, and `/remove`), paired with null-safe array traversal and idempotent push guards.

---

## 2. Root Cause Analysis & Lifecycle Tracing

### 2.1 The Ghost Request Phenomenon in `/accept`

**Location**: `server/routes/friends.js:141-155`

```javascript
// Validate that requesterId exists in user.friendRequests
const hasPendingRequest = user.friendRequests.some(id => (id._id || id).toString() === requesterId);
if (!hasPendingRequest) {
    return res.status(400).json({ message: "No pending friend request from this user" });
}

user.friendRequests.pull(requesterId);
requester.sentFriendRequests.pull(userId);

if (!user.friends.some(id => (id._id || id).toString() === requesterId)) user.friends.push(requesterId);
if (!requester.friends.some(id => (id._id || id).toString() === userId)) requester.friends.push(userId);
```

#### The Failure Sequence:
1. **Initial State (Concurrent or Cross Requests)**:
   - User 1 (`userId1`):
     - `friendRequests: [userId2]`
     - `sentFriendRequests: [userId2]`
     - `friends: []`
   - User 2 (`userId2`):
     - `friendRequests: [userId1]`
     - `sentFriendRequests: [userId1]`
     - `friends: []`
2. **User 1 executes `POST /api/friends/accept` with `requesterId = userId2`**:
   - `user1.friendRequests.pull(userId2)` -> Clears `userId2` from User 1's incoming.
   - `user2.sentFriendRequests.pull(userId1)` -> Clears `userId1` from User 2's outgoing.
   - `user1.friends.push(userId2)` -> Added to friends.
   - `user2.friends.push(userId1)` -> Added to friends.
3. **Resulting Corrupted State in MongoDB**:
   - User 1:
     - `friendRequests: []`
     - `sentFriendRequests: [userId2]` ⚠️ **ORPHAN GHOST OUTGOING REQUEST**
     - `friends: [userId2]`
   - User 2:
     - `friendRequests: [userId1]` ⚠️ **ORPHAN GHOST INCOMING REQUEST**
     - `sentFriendRequests: []`
     - `friends: [userId1]`
4. **Empirical Reproduction**:
   Verified in `server/tests/challenge_stress.test.js:320-354` (`CHALLENGE 3.7`):
   ```
   expect(received).not.toContain(expected)
   Expected value: not "660000000000000000000002"
   Received array:     ["660000000000000000000002"]
   ```

#### Downstream System Breakdowns:
- **UI Inconsistency**: When User 2 navigates to their profile or friend requests page, `GET /api/friends/:userId2` returns User 1 in `friendRequests`. User 2 is presented with "Accept" and "Decline" buttons for a user who is *already* their friend.
- **Duplicate Notifications**: If User 2 clicks "Accept" on the ghost request, an extra `POST /accept` succeeds (since User 1 is in `user2.friendRequests`), re-triggering notification emissions ("User 2 accepted your friend request!") to User 1.
- **Zombie Request Resurfacing**: If User 1 un-friends User 2 via `POST /api/friends/remove`, `user1.friends` and `user2.friends` are pulled, but `user2.friendRequests` still has `userId1`. User 1 instantly reappears as an active pending friend request without either user sending one.

---

### 2.2 Unidirectional Cleanup in Auto-Accept (`POST /api/friends/request`)

**Location**: `server/routes/friends.js:66-76`

```javascript
// If they already sent YOU a request, just accept it
if (requester.friendRequests.some(id => (id._id || id).toString() === recipientId)) {
    requester.friendRequests.pull(recipientId);
    recipient.sentFriendRequests.pull(requesterId);
    
    if (!requester.friends.some(id => (id._id || id).toString() === recipientId)) requester.friends.push(recipientId);
    if (!recipient.friends.some(id => (id._id || id).toString() === requesterId)) recipient.friends.push(requesterId);
    
    await requester.save();
    await recipient.save();
...
```

#### The Failure Sequence:
- If User B had previously sent a request to User A, and User A clicks "Add Friend", auto-accept triggers.
- If User A had also accumulated an entry in `requester.sentFriendRequests` (e.g., from network retries or previous client actions) or User B had an entry in `recipient.friendRequests`:
  - `requester.friendRequests.pull(recipientId)` and `recipient.sentFriendRequests.pull(requesterId)` are pulled.
  - BUT `requester.sentFriendRequests.pull(recipientId)` and `recipient.friendRequests.pull(requesterId)` are **omitted**.
  - Ghost requests linger under the same mechanism as `/accept`.

---

### 2.3 Evaluation of Decline/Reject Flow (`handleDeclineOrReject`)

**Location**: `server/routes/friends.js:184-218`

```javascript
// Could be rejecting a received request, or cancelling a sent request
user.friendRequests.pull(targetId);
user.sentFriendRequests.pull(targetId);
target.friendRequests.pull(userId);
target.sentFriendRequests.pull(userId);

await user.save();
await target.save();
```

#### Observations:
- In `handleDeclineOrReject`, the 4-way pull is **already present**!
- Both incoming and outgoing arrays for both users are purged:
  - `user.friendRequests.pull(targetId)`
  - `user.sentFriendRequests.pull(targetId)`
  - `target.friendRequests.pull(userId)`
  - `target.sentFriendRequests.pull(userId)`
- However, `handleDeclineOrReject` currently lacks:
  1. Guard against self-target (`userId === targetId`).
  2. Safe optional chaining on array access if document arrays are uninitialized.

---

### 2.4 Unfriend Flow (`POST /api/friends/remove`)

**Location**: `server/routes/friends.js:227-258`

```javascript
user.friends.pull(friendId);
friend.friends.pull(userId);

await user.save();
await friend.save();
```

#### Vulnerability:
- If prior ghost requests existed between `user` and `friend` due to historical bugs, removing the friendship leaves those orphan requests in `friendRequests` or `sentFriendRequests`.
- Defensive best practice: `POST /remove` must purge any pending request queues between the two users simultaneously, ensuring a completely clean state.

---

### 2.5 Related Array Pollution and Null Pointer Edge Cases

1. **Duplicate ID Accumulation in `sentFriendRequests` (`friends.js:91-92`)**:
   - `POST /request` checks `if (recipient.friendRequests.some(...)) return 400`, but never checks `requester.sentFriendRequests`.
   - Line 92 unconditionally calls `requester.sentFriendRequests.push(recipientId)`.
   - Verified in `CHALLENGE 3.5`: `sentFriendRequests` accumulates duplicate entries `["userId2", "userId2"]`.
2. **Null Element Crashes (`friends.js:58, 62, 67, 71, 72, 142, 150, 151`)**:
   - `(id._id || id).toString()` crashes with `TypeError: Cannot read properties of null (reading 'toString')` whenever MongoDB populated references contain null or dangling references (`CHALLENGE 3.6`).
   - Must use safe navigation: `(id?._id || id)?.toString() === targetId`.

---

## 3. Remediation Architecture: Unified Bidirectional Reconciliation

To eliminate code duplication, prevent asymmetric logic, and enforce invariant safety, we define a single helper function:

```javascript
/**
 * Completely purges all incoming and outgoing pending friend requests
 * between two users across all four queues.
 *
 * @param {import('mongoose').Document} userA 
 * @param {import('mongoose').Document} userB 
 */
const clearBidirectionalRequests = (userA, userB) => {
    if (!userA || !userB) return;
    const idA = (userA._id || userA).toString();
    const idB = (userB._id || userB).toString();

    if (userA.friendRequests?.pull) userA.friendRequests.pull(idB);
    if (userA.sentFriendRequests?.pull) userA.sentFriendRequests.pull(idB);
    if (userB.friendRequests?.pull) userB.friendRequests.pull(idA);
    if (userB.sentFriendRequests?.pull) userB.sentFriendRequests.pull(idA);
};
```

### Why this design is mathematically sound:
1. **Commutativity / Symmetry**:
   `clearBidirectionalRequests(A, B)` has identical execution semantics to `clearBidirectionalRequests(B, A)`. Regardless of who called the endpoint (sender or recipient), both documents have all cross-references removed.
2. **Idempotency**:
   Mongoose `DocumentArray.prototype.pull` removes all matching ObjectIds. If the ID is not present in the array, it is a silent no-op. Calling this function multiple times does not produce errors or corrupt array indexes.
3. **Null & Mock Tolerance**:
   The use of `?.pull` guarantees that if a mock user object, sparse schema, or custom payload lacks a specific array method, it does not throw an uncaught exception.
4. **Single Source of Truth**:
   Centralizes the four-way queue purge so future modifications or new routes (e.g., blocking, admin resets) reuse the identical reconciliation logic.

---

## 4. Proposed Code Changes in `server/routes/friends.js`

### 4.1 Addition of Helper Functions (Top of File, around line 9)

```javascript
// Helper: Safely compare MongoDB ObjectIds, populated objects, or strings
const idsMatch = (item, targetId) => {
    if (!item || !targetId) return false;
    return (item?._id || item)?.toString() === targetId.toString();
};

// Helper: Purge all reciprocal pending requests between two users
const clearBidirectionalRequests = (userA, userB) => {
    if (!userA || !userB) return;
    const idA = (userA._id || userA).toString();
    const idB = (userB._id || userB).toString();

    if (userA.friendRequests?.pull) userA.friendRequests.pull(idB);
    if (userA.sentFriendRequests?.pull) userA.sentFriendRequests.pull(idB);
    if (userB.friendRequests?.pull) userB.friendRequests.pull(idA);
    if (userB.sentFriendRequests?.pull) userB.sentFriendRequests.pull(idA);
};
```

---

### 4.2 Patch for `POST /api/friends/request` (Auto-Accept & Duplicate Prevention)

#### Before (`lines 58-96`):
```javascript
		if (recipient.friends.some(id => (id._id || id).toString() === requesterId)) {
			return res.status(400).json({ message: "Already friends" });
		}

		if (recipient.friendRequests.some(id => (id._id || id).toString() === requesterId)) {
			return res.status(400).json({ message: "Request already sent" });
		}

		// If they already sent YOU a request, just accept it
		if (requester.friendRequests.some(id => (id._id || id).toString() === recipientId)) {
			requester.friendRequests.pull(recipientId);
			recipient.sentFriendRequests.pull(requesterId);
			
			if (!requester.friends.some(id => (id._id || id).toString() === recipientId)) requester.friends.push(recipientId);
			if (!recipient.friends.some(id => (id._id || id).toString() === requesterId)) recipient.friends.push(requesterId);
			
			await requester.save();
			await recipient.save();

			const io = req.app?.get("io") || req.io;
			if (io) {
				io.to(recipientId).emit("friendRequestAccepted", {
					userId: requesterId,
					friend: { _id: requester._id, name: requester.name, profilePic: requester.profilePic, skillLevel: requester.skillLevel }
				});
				io.to(requesterId).emit("friendRequestAccepted", {
					userId: recipientId,
					friend: { _id: recipient._id, name: recipient.name, profilePic: recipient.profilePic, skillLevel: recipient.skillLevel }
				});
			}
			return res.json({ message: "Friend request accepted automatically" });
		}

		recipient.friendRequests.push(requesterId);
		requester.sentFriendRequests.push(recipientId);

		await recipient.save();
		await requester.save();
```

#### After:
```javascript
		if (recipient.friends.some(id => (id?._id || id)?.toString() === requesterId) ||
		    requester.friends.some(id => (id?._id || id)?.toString() === recipientId)) {
			return res.status(400).json({ message: "Already friends" });
		}

		if (recipient.friendRequests.some(id => (id?._id || id)?.toString() === requesterId)) {
			return res.status(400).json({ message: "Request already sent" });
		}

		// If they already sent YOU a request, just accept it (Bidirectional Auto-Accept)
		if (requester.friendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
			clearBidirectionalRequests(requester, recipient);
			
			if (!requester.friends.some(id => (id?._id || id)?.toString() === recipientId)) requester.friends.push(recipientId);
			if (!recipient.friends.some(id => (id?._id || id)?.toString() === requesterId)) recipient.friends.push(requesterId);
			
			await requester.save();
			await recipient.save();

			const io = req.app?.get("io") || req.io;
			if (io) {
				io.to(recipientId).emit("friendRequestAccepted", {
					userId: requesterId,
					friend: { _id: requester._id, name: requester.name, profilePic: requester.profilePic, skillLevel: requester.skillLevel }
				});
				io.to(requesterId).emit("friendRequestAccepted", {
					userId: recipientId,
					friend: { _id: recipient._id, name: recipient.name, profilePic: recipient.profilePic, skillLevel: recipient.skillLevel }
				});
			}
			return res.json({ message: "Friend request accepted automatically" });
		}

		// Idempotent insertion guards against duplicate entries
		if (!recipient.friendRequests.some(id => (id?._id || id)?.toString() === requesterId)) {
			recipient.friendRequests.push(requesterId);
		}
		if (!requester.sentFriendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
			requester.sentFriendRequests.push(recipientId);
		}

		await recipient.save();
		await requester.save();
```

---

### 4.3 Patch for `POST /api/friends/accept`

#### Before (`lines 141-155`):
```javascript
		// Validate that requesterId exists in user.friendRequests
		const hasPendingRequest = user.friendRequests.some(id => (id._id || id).toString() === requesterId);
		if (!hasPendingRequest) {
			return res.status(400).json({ message: "No pending friend request from this user" });
		}

		user.friendRequests.pull(requesterId);
		requester.sentFriendRequests.pull(userId);

		if (!user.friends.some(id => (id._id || id).toString() === requesterId)) user.friends.push(requesterId);
		if (!requester.friends.some(id => (id._id || id).toString() === userId)) requester.friends.push(userId);

		await user.save();
		await requester.save();
```

#### After:
```javascript
		// Validate that requesterId exists in user.friendRequests with null-safe comparison
		const hasPendingRequest = user.friendRequests.some(id => (id?._id || id)?.toString() === requesterId);
		if (!hasPendingRequest) {
			return res.status(400).json({ message: "No pending friend request from this user" });
		}

		// Bidirectional request queue cleanup
		clearBidirectionalRequests(user, requester);

		if (!user.friends.some(id => (id?._id || id)?.toString() === requesterId)) user.friends.push(requesterId);
		if (!requester.friends.some(id => (id?._id || id)?.toString() === userId)) requester.friends.push(userId);

		await user.save();
		await requester.save();
```

---

### 4.4 Patch for `handleDeclineOrReject` (`/decline` and `/reject`)

#### Before (`lines 199-206`):
```javascript
		// Could be rejecting a received request, or cancelling a sent request
		user.friendRequests.pull(targetId);
		user.sentFriendRequests.pull(targetId);
		target.friendRequests.pull(userId);
		target.sentFriendRequests.pull(userId);

		await user.save();
		await target.save();
```

#### After:
```javascript
		if (userId === targetId) {
			return res.status(400).json({ message: "Cannot decline yourself" });
		}

		// Clean all pending requests between both users bidirectionally
		clearBidirectionalRequests(user, target);

		await user.save();
		await target.save();
```

---

### 4.5 Patch for `POST /api/friends/remove`

#### Before (`lines 242-247`):
```javascript
		user.friends.pull(friendId);
		friend.friends.pull(userId);

		await user.save();
		await friend.save();
```

#### After:
```javascript
		user.friends.pull(friendId);
		friend.friends.pull(userId);
		// Defensively purge any orphan or ghost pending requests between users
		clearBidirectionalRequests(user, friend);

		await user.save();
		await friend.save();
```

---

## 5. Machine-Applicable Patch Representation

```diff
--- server/routes/friends.js
+++ server/routes/friends.js
@@ -7,2 +7,13 @@
 
+// Helper: Safely purge all reciprocal pending requests between two users
+const clearBidirectionalRequests = (userA, userB) => {
+	if (!userA || !userB) return;
+	const idA = (userA._id || userA).toString();
+	const idB = (userB._id || userB).toString();
+	if (userA.friendRequests?.pull) userA.friendRequests.pull(idB);
+	if (userA.sentFriendRequests?.pull) userA.sentFriendRequests.pull(idB);
+	if (userB.friendRequests?.pull) userB.friendRequests.pull(idA);
+	if (userB.sentFriendRequests?.pull) userB.sentFriendRequests.pull(idA);
+};
+
 // GET: friends and friend requests
@@ -58,9 +69,10 @@
-		if (recipient.friends.some(id => (id._id || id).toString() === requesterId)) {
+		if (recipient.friends.some(id => (id?._id || id)?.toString() === requesterId) ||
+		    requester.friends.some(id => (id?._id || id)?.toString() === recipientId)) {
 			return res.status(400).json({ message: "Already friends" });
 		}
 
-		if (recipient.friendRequests.some(id => (id._id || id).toString() === requesterId)) {
+		if (recipient.friendRequests.some(id => (id?._id || id)?.toString() === requesterId)) {
 			return res.status(400).json({ message: "Request already sent" });
 		}
 
 		// If they already sent YOU a request, just accept it
-		if (requester.friendRequests.some(id => (id._id || id).toString() === recipientId)) {
-			requester.friendRequests.pull(recipientId);
-			recipient.sentFriendRequests.pull(requesterId);
+		if (requester.friendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
+			clearBidirectionalRequests(requester, recipient);
 			
-			if (!requester.friends.some(id => (id._id || id).toString() === recipientId)) requester.friends.push(recipientId);
-			if (!recipient.friends.some(id => (id._id || id).toString() === requesterId)) recipient.friends.push(requesterId);
+			if (!requester.friends.some(id => (id?._id || id)?.toString() === recipientId)) requester.friends.push(recipientId);
+			if (!recipient.friends.some(id => (id?._id || id)?.toString() === requesterId)) recipient.friends.push(requesterId);
@@ -91,2 +103,6 @@
-		recipient.friendRequests.push(requesterId);
-		requester.sentFriendRequests.push(recipientId);
+		if (!recipient.friendRequests.some(id => (id?._id || id)?.toString() === requesterId)) {
+			recipient.friendRequests.push(requesterId);
+		}
+		if (!requester.sentFriendRequests.some(id => (id?._id || id)?.toString() === recipientId)) {
+			requester.sentFriendRequests.push(recipientId);
+		}
@@ -142,5 +158,5 @@
 		// Validate that requesterId exists in user.friendRequests
-		const hasPendingRequest = user.friendRequests.some(id => (id._id || id).toString() === requesterId);
+		const hasPendingRequest = user.friendRequests.some(id => (id?._id || id)?.toString() === requesterId);
 		if (!hasPendingRequest) {
 			return res.status(400).json({ message: "No pending friend request from this user" });
 		}
 
-		user.friendRequests.pull(requesterId);
-		requester.sentFriendRequests.pull(userId);
+		clearBidirectionalRequests(user, requester);
 
-		if (!user.friends.some(id => (id._id || id).toString() === requesterId)) user.friends.push(requesterId);
-		if (!requester.friends.some(id => (id._id || id).toString() === userId)) requester.friends.push(userId);
+		if (!user.friends.some(id => (id?._id || id)?.toString() === requesterId)) user.friends.push(requesterId);
+		if (!requester.friends.some(id => (id?._id || id)?.toString() === userId)) requester.friends.push(userId);
@@ -198,6 +214,8 @@
 		if (!user || !target) return res.status(404).json({ message: "User not found" });
 
+		if (userId === targetId) return res.status(400).json({ message: "Cannot decline yourself" });
+
 		// Could be rejecting a received request, or cancelling a sent request
-		user.friendRequests.pull(targetId);
-		user.sentFriendRequests.pull(targetId);
-		target.friendRequests.pull(userId);
-		target.sentFriendRequests.pull(userId);
+		clearBidirectionalRequests(user, target);
@@ -243,2 +261,3 @@
 		user.friends.pull(friendId);
 		friend.friends.pull(userId);
+		clearBidirectionalRequests(user, friend);
```

---

## 6. Verification & Test Strategy

### 6.1 Unskipping and Promoting Challenger Tests
Once the patch is applied by the implementer:
1. In `server/tests/challenge_stress.test.js`:
   Change:
   ```javascript
   it.failing('CHALLENGE 3.7: Bidirectional pending requests clean up cleanly on /accept without leaving ghost requests', async () => {
   ```
   To:
   ```javascript
   it('CHALLENGE 3.7: Bidirectional pending requests clean up cleanly on /accept without leaving ghost requests', async () => {
   ```
2. Similarly promote:
   - `CHALLENGE 3.5` (duplicate `sentFriendRequests` prevention)
   - `CHALLENGE 3.6` (null element resilience in `friends.js`)
   All will pass natively.

### 6.2 Recommended New Unit Tests in `server/tests/friends.test.js`

```javascript
describe('Bidirectional Request Reconciliation', () => {
    it('clears reciprocal pending requests when user accepts an incoming request (mutual concurrent requests scenario)', async () => {
        const user1 = createMockUser({
            _id: userId1,
            friendRequests: [userId2],
            sentFriendRequests: [userId2],
            friends: [],
        });
        const user2 = createMockUser({
            _id: userId2,
            friendRequests: [userId1],
            sentFriendRequests: [userId1],
            friends: [],
        });

        User.findById.mockImplementation((id) => {
            if (id === userId1) return Promise.resolve(user1);
            if (id === userId2) return Promise.resolve(user2);
            return Promise.resolve(null);
        });

        const res = await request(app)
            .post('/api/friends/accept')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ requesterId: userId2 });

        expect(res.statusCode).toBe(200);
        // Verify all 4 queues are purged
        expect(user1.friendRequests).not.toContain(userId2);
        expect(user1.sentFriendRequests).not.toContain(userId2);
        expect(user2.friendRequests).not.toContain(userId1);
        expect(user2.sentFriendRequests).not.toContain(userId1);
        // Verify mutual friendship
        expect(user1.friends).toContain(userId2);
        expect(user2.friends).toContain(userId1);
    });

    it('clears all reciprocal requests during auto-accept in /request', async () => {
        const user1 = createMockUser({
            _id: userId1,
            friendRequests: [userId2],
            sentFriendRequests: [userId2],
            friends: [],
        });
        const user2 = createMockUser({
            _id: userId2,
            friendRequests: [userId1],
            sentFriendRequests: [userId1],
            friends: [],
        });

        User.findById.mockImplementation((id) => {
            if (id === userId1) return Promise.resolve(user1);
            if (id === userId2) return Promise.resolve(user2);
            return Promise.resolve(null);
        });

        const res = await request(app)
            .post('/api/friends/request')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ recipientId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Friend request accepted automatically');
        expect(user1.friendRequests).toHaveLength(0);
        expect(user1.sentFriendRequests).toHaveLength(0);
        expect(user2.friendRequests).toHaveLength(0);
        expect(user2.sentFriendRequests).toHaveLength(0);
    });

    it('clears all reciprocal requests during /decline even if mutual requests existed', async () => {
        const user1 = createMockUser({
            _id: userId1,
            friendRequests: [userId2],
            sentFriendRequests: [userId2],
            friends: [],
        });
        const user2 = createMockUser({
            _id: userId2,
            friendRequests: [userId1],
            sentFriendRequests: [userId1],
            friends: [],
        });

        User.findById.mockImplementation((id) => {
            if (id === userId1) return Promise.resolve(user1);
            if (id === userId2) return Promise.resolve(user2);
            return Promise.resolve(null);
        });

        const res = await request(app)
            .post('/api/friends/decline')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ requesterId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(user1.friendRequests).toHaveLength(0);
        expect(user1.sentFriendRequests).toHaveLength(0);
        expect(user2.friendRequests).toHaveLength(0);
        expect(user2.sentFriendRequests).toHaveLength(0);
        expect(user1.friends).toHaveLength(0);
        expect(user2.friends).toHaveLength(0);
    });

    it('defensively purges any lingering request entries when removing a friend via /remove', async () => {
        const user1 = createMockUser({
            _id: userId1,
            friends: [userId2],
            friendRequests: [userId2],
            sentFriendRequests: [userId2],
        });
        const user2 = createMockUser({
            _id: userId2,
            friends: [userId1],
            friendRequests: [userId1],
            sentFriendRequests: [userId1],
        });

        User.findById.mockImplementation((id) => {
            if (id === userId1) return Promise.resolve(user1);
            if (id === userId2) return Promise.resolve(user2);
            return Promise.resolve(null);
        });

        const res = await request(app)
            .post('/api/friends/remove')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ friendId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(user1.friends).not.toContain(userId2);
        expect(user2.friends).not.toContain(userId1);
        expect(user1.friendRequests).toHaveLength(0);
        expect(user1.sentFriendRequests).toHaveLength(0);
        expect(user2.friendRequests).toHaveLength(0);
        expect(user2.sentFriendRequests).toHaveLength(0);
    });
});
```

---

## 7. Downstream Impact & Compatibility Analysis

1. **Matchmaking Discovery (`GET /api/matchmaking/discover`)**:
   - `excludedIds` combines `[currentUser._id, ...friends, ...friendRequests, ...sentFriendRequests]`.
   - By eliminating ghost requests, the exclude set reflects actual state without bloated duplicate ObjectIds.
   - `getFriendshipStatus` evaluates `friends` first, then `sentFriendRequests` / `friendRequests`. Eliminating ghost requests guarantees that when friendship is established, the status cleanly evaluates to `"friends"` and cannot accidentally be masked or confused by lingering `"pending"` entries.
2. **Profile & Player Cards (`<FriendActionButton>`)**:
   - Client buttons display "Add Friend", "Request Sent", "Friends", or "Accept Request" based on `friendshipStatus`.
   - With ghost requests eradicated, users never encounter impossible UI states (e.g. seeing "Accept Request" for a player who is already marked as a friend in another view).
3. **Kafka & Database Load**:
   - `User.post('save')` emits `user.updated` to Kafka (`user-events`).
   - Idempotent deduplication prevents superfluous writes when duplicate requests arrive.
