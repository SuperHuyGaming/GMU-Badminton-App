# Comprehensive Null-Safety & Robustness Analysis — Milestone 1 Iteration 2

**Author**: Explorer Remediation 1 (Null-Safety Specialist)  
**Target Files**: `server/routes/matchmaking.js`, `server/routes/friends.js`  
**Related Test Files**: `server/tests/matchmaking.test.js`, `server/tests/friends.test.js`, `server/tests/challenge_stress.test.js`

---

## 1. Executive Summary

During Milestone 1 review, Challenger 1 discovered that calling `.toString()` on array elements in `server/routes/matchmaking.js` (lines 62, 65, 68 and `getFriendshipStatus`) and `server/routes/friends.js` (lines 58, 62, 67, 71, 72, 142, 150, 151) blindly dereferences elements without checking for `null`, `undefined`, or malformed objects. When any friend-related array contains a `null` (e.g., due to deleted user references in MongoDB, sparse arrays, or partial migrations), the server throws an uncaught `TypeError` causing an HTTP 500 error.

Additionally, two related concurrency/integrity bugs were surfaced:
1. `server/routes/friends.js:92` unconditionally pushes to `requester.sentFriendRequests`, causing duplicate entries.
2. `server/routes/friends.js:147-148` (and auto-accept on lines 68-69) clears pending requests unidirectionally, leaving ghost pending requests when mutual or concurrent requests occur.

This analysis details the exact root causes, categorizes every vulnerable line, formulates an idiomatic and bulletproof `toIdString` helper and defensive array filtering strategy, provides drop-in replacement snippets, and specifies test cases to guarantee 100% test coverage and resilience.

---

## 2. Root Cause Analysis & Empirical Evidence

### 2.1 The Mechanism of Failure
In MongoDB/Mongoose:
- Array fields containing ObjectIds (e.g., `friends: [{ type: Schema.Types.ObjectId, ref: 'User' }]`) can hold `null` or `undefined` values if a referenced document is deleted without cascading cleanup, if an array migration was incomplete, or if tests inject mock states.
- When `.populate()` is used on a deleted reference, Mongoose assigns `null` to that position in the array.
- In Express route handlers:
  ```javascript
  // matchmaking.js:62
  currentUser.friends.forEach(f => excludedIds.push((f?._id || f).toString()));
  ```
  If `f === null`:
  1. `f?._id` evaluates to `undefined`.
  2. `(f?._id || f)` evaluates to `(undefined || null)`, which is `null`.
  3. `(null).toString()` throws `TypeError: Cannot read properties of null (reading 'toString')`.

- In `friends.js:58`:
  ```javascript
  if (recipient.friends.some(id => (id._id || id).toString() === requesterId))
  ```
  If `id === null`:
  1. `id._id` attempts to access property `_id` of `null`, throwing `TypeError: Cannot read properties of null (reading '_id')` immediately.
  2. Because there is no optional chaining on `id._id`, it throws before even reaching `.toString()`.

### 2.2 Verbatim Test Output
Running `npx jest server/tests/challenge_stress.test.js` reproduces the exact unhandled exception:
```
console.error
  Discovery error: TypeError: Cannot read properties of null (reading 'toString')
      at toString (D:\GMU Fall 2026\GMU-Badminton-App\server\routes\matchmaking.js:62:81)
      at Array.forEach (<anonymous>)
      at forEach (D:\GMU Fall 2026\GMU-Badminton-App\server\routes\matchmaking.js:62:37)
```
When `recipient.friends` contains `[null]`, `POST /api/friends/request` fails with:
```
TypeError: Cannot read properties of null (reading '_id')
    at D:\GMU Fall 2026\GMU-Badminton-App\server\routes\friends.js:58:38
    at Array.some (<anonymous>)
```

---

## 3. Vulnerability Inventory

### 3.1 `server/routes/matchmaking.js`

| Line # | Current Code Pattern | Failure Mode | Severity |
|---|---|---|---|
| **59** | `const excludedIds = [req.user.userId];` | If `req.user.userId` is an ObjectId or undefined, not normalized to string. | Low |
| **62** | `currentUser.friends.forEach(f => excludedIds.push((f?._id \|\| f).toString()));` | Throws `TypeError` if `f` is `null` or `undefined`. Pollutes with `"[object Object]"` if `f` is `{}`. | **Critical** |
| **65** | `currentUser.friendRequests.forEach(f => excludedIds.push((f?._id \|\| f).toString()));` | Throws `TypeError` if element is `null`/`undefined`. | **Critical** |
| **68** | `currentUser.sentFriendRequests.forEach(f => excludedIds.push((f?._id \|\| f).toString()));` | Throws `TypeError` if element is `null`/`undefined`. | **Critical** |
| **75** | `const targetStr = (targetId._id \|\| targetId).toString();` | Throws `TypeError` if `targetId._id` is null or `targetId` is null. | High |
| **76** | `currentUser.friends?.some(id => (id._id \|\| id).toString() === targetStr)` | Throws `TypeError` on `id._id` if `id` is `null`/`undefined`. | **Critical** |
| **77** | `currentUser.sentFriendRequests?.some(id => (id._id \|\| id).toString() === targetStr)` | Throws `TypeError` on `id._id` if `id` is `null`/`undefined`. | **Critical** |
| **78** | `currentUser.friendRequests?.some(id => (id._id \|\| id).toString() === targetStr)` | Throws `TypeError` on `id._id` if `id` is `null`/`undefined`. | **Critical** |
| **145, 161** | `friendshipStatus: getFriendshipStatus(player._id)` | Lacks safe navigation if `player` or `player._id` is missing. | Low |

### 3.2 `server/routes/friends.js`

| Line # | Current Code Pattern | Failure Mode | Severity |
|---|---|---|---|
| **17, 43, 128, 186, 229** | `(req.user.id \|\| req.user.userId).toString()` | Throws if neither `id` nor `userId` exists on `req.user`. | Low |
| **31-33** | `friends: user.friends, ...` | Transmits raw `null` items to frontend when populated deleted references exist. | Medium |
| **58** | `recipient.friends.some(id => (id._id \|\| id).toString() === requesterId)` | Throws `TypeError: Cannot read properties of null (reading '_id')`. | **Critical** |
| **62** | `recipient.friendRequests.some(id => (id._id \|\| id).toString() === requesterId)` | Throws `TypeError` if `recipient.friendRequests` contains `null`. | **Critical** |
| **67** | `requester.friendRequests.some(id => (id._id \|\| id).toString() === recipientId)` | Throws `TypeError` if `requester.friendRequests` contains `null`. | **Critical** |
| **71-72** | `!requester.friends.some(id => (id._id \|\| id).toString() === recipientId)` | Throws `TypeError` if `friends` contains `null`. | **Critical** |
| **68-69** | `requester.friendRequests.pull(recipientId); recipient.sentFriendRequests.pull(requesterId);` | Ghost requests: leaves reciprocal pending requests if both sent requests. | Medium |
| **91-92** | `recipient.friendRequests.push(requesterId); requester.sentFriendRequests.push(recipientId);` | Array pollution: pushes duplicate IDs without checking existing entries. | Medium |
| **142** | `user.friendRequests.some(id => (id._id \|\| id).toString() === requesterId)` | Throws `TypeError` if `user.friendRequests` contains `null`. | **Critical** |
| **147-148** | `user.friendRequests.pull(requesterId); requester.sentFriendRequests.pull(userId);` | Ghost requests: leaves reverse direction if mutual requests existed. | Medium |
| **150-151** | `!user.friends.some(id => (id._id \|\| id).toString() === requesterId)` | Throws `TypeError` if `friends` contains `null`. | **Critical** |

---

## 4. Remediation Strategy

### 4.1 Canonical ID String Extraction Helper: `toIdString`
Both files should define or adopt a localized, pure, null-safe helper function `toIdString(item)`:

```javascript
/**
 * Safely extracts a string ID from an ObjectId, string, or populated document object.
 * Returns null if the item is null, undefined, unpopulated, or non-convertible.
 *
 * @param {any} item - ObjectId | string | { _id: any } | null | undefined
 * @returns {string | null}
 */
const toIdString = (item) => {
    if (!item) return null;
    const raw = item._id !== undefined ? item._id : item;
    if (!raw) return null;
    const str = typeof raw.toString === "function" ? raw.toString() : String(raw);
    return str && str !== "[object Object]" ? str : null;
};
```

#### Verification of Edge Cases for `toIdString`:
1. `null` / `undefined` -> `null` (never throws)
2. `"660000000000000000000001"` -> `"660000000000000000000001"`
3. `new ObjectId("660000000000000000000001")` -> `"660000000000000000000001"`
4. `{ _id: "660000000000000000000001", name: "Alice" }` -> `"660000000000000000000001"`
5. `{ _id: new ObjectId("660000000000000000000001") }` -> `"660000000000000000000001"`
6. `{ _id: null }` / `{ _id: undefined }` -> `null`
7. `{}` (empty object) -> `null` (since `str === "[object Object]"`)
8. `0` / `false` / `""` -> `null`

---

### 4.2 Proposed Code Replacements for `server/routes/matchmaking.js`

#### Location 1: Exclusion List Compilation (lines 58-70)
**Before:**
```javascript
// Collect all IDs that must be excluded from discovery
const excludedIds = [req.user.userId];
if (currentUser) {
    if (Array.isArray(currentUser.friends)) {
        currentUser.friends.forEach(f => excludedIds.push((f?._id || f).toString()));
    }
    if (Array.isArray(currentUser.friendRequests)) {
        currentUser.friendRequests.forEach(f => excludedIds.push((f?._id || f).toString()));
    }
    if (Array.isArray(currentUser.sentFriendRequests)) {
        currentUser.sentFriendRequests.forEach(f => excludedIds.push((f?._id || f).toString()));
    }
}
```

**Proposed After:**
```javascript
// Safely collect all IDs that must be excluded from discovery
const currentUserIdStr = toIdString(req.user?.userId || req.user?.id);
const excludedIds = currentUserIdStr ? [currentUserIdStr] : [];

if (currentUser) {
    const friendLists = [
        currentUser.friends,
        currentUser.friendRequests,
        currentUser.sentFriendRequests
    ];
    for (const list of friendLists) {
        if (Array.isArray(list)) {
            for (const item of list) {
                const idStr = toIdString(item);
                if (idStr && !excludedIds.includes(idStr)) {
                    excludedIds.push(idStr);
                }
            }
        }
    }
}
```

#### Location 2: `getFriendshipStatus` Helper (lines 72-80)
**Before:**
```javascript
// Helper to determine friendship status ("none", "pending", "friends")
const getFriendshipStatus = (targetId) => {
    if (!currentUser || !targetId) return "none";
    const targetStr = (targetId._id || targetId).toString();
    if (currentUser.friends?.some(id => (id._id || id).toString() === targetStr)) return "friends";
    if (currentUser.sentFriendRequests?.some(id => (id._id || id).toString() === targetStr)) return "pending";
    if (currentUser.friendRequests?.some(id => (id._id || id).toString() === targetStr)) return "pending";
    return "none";
};
```

**Proposed After:**
```javascript
// Helper to determine friendship status ("none", "pending", "friends")
const getFriendshipStatus = (targetId) => {
    if (!currentUser || !targetId) return "none";
    const targetStr = toIdString(targetId);
    if (!targetStr) return "none";

    const matchesTarget = (id) => toIdString(id) === targetStr;

    if (Array.isArray(currentUser.friends) && currentUser.friends.some(matchesTarget)) {
        return "friends";
    }
    if (Array.isArray(currentUser.sentFriendRequests) && currentUser.sentFriendRequests.some(matchesTarget)) {
        return "pending";
    }
    if (Array.isArray(currentUser.friendRequests) && currentUser.friendRequests.some(matchesTarget)) {
        return "pending";
    }
    return "none";
};
```

#### Location 3: Player Hydration (lines 145 & 161)
Ensure `getFriendshipStatus(player?._id || player)` is called safely:
```javascript
const hydratedMatches = potentialMatches.map(player => ({
    ...player,
    friendshipStatus: getFriendshipStatus(player?._id || player)
}));
```

---

### 4.3 Proposed Code Replacements for `server/routes/friends.js`

#### Location 1: Helper Definition & Current User ID (lines 17, 43, 128, etc.)
Add `toIdString` helper at the top of `server/routes/friends.js`.  
Use safe navigation for `currentUserId`:
```javascript
const currentUserId = (req.user?.id || req.user?.userId)?.toString();
```

#### Location 2: `GET /:userId` Response Sanitization (lines 30-34)
**Before:**
```javascript
res.json({
    friends: user.friends,
    friendRequests: user.friendRequests,
    sentFriendRequests: user.sentFriendRequests,
});
```
**Proposed After:**
```javascript
res.json({
    friends: (user.friends || []).filter(Boolean),
    friendRequests: (user.friendRequests || []).filter(Boolean),
    sentFriendRequests: (user.sentFriendRequests || []).filter(Boolean),
});
```

#### Location 3: `POST /request` Handler (lines 58-95)
**Before:**
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
    ...
}

recipient.friendRequests.push(requesterId);
requester.sentFriendRequests.push(recipientId);

await recipient.save();
await requester.save();
```

**Proposed After:**
```javascript
// Safe array initialization
requester.friends = requester.friends || [];
requester.friendRequests = requester.friendRequests || [];
requester.sentFriendRequests = requester.sentFriendRequests || [];
recipient.friends = recipient.friends || [];
recipient.friendRequests = recipient.friendRequests || [];
recipient.sentFriendRequests = recipient.sentFriendRequests || [];

// Check already friends
if (recipient.friends.some(id => toIdString(id) === requesterId)) {
    return res.status(400).json({ message: "Already friends" });
}

// Check request already sent (in recipient.friendRequests OR requester.sentFriendRequests)
if (
    recipient.friendRequests.some(id => toIdString(id) === requesterId) ||
    requester.sentFriendRequests.some(id => toIdString(id) === recipientId)
) {
    return res.status(400).json({ message: "Request already sent" });
}

// If they already sent YOU a request, auto-accept and clear both queues
if (requester.friendRequests.some(id => toIdString(id) === recipientId)) {
    // Bidirectional cleanup to prevent ghost requests
    requester.friendRequests.pull(recipientId);
    requester.sentFriendRequests.pull(recipientId);
    recipient.friendRequests.pull(requesterId);
    recipient.sentFriendRequests.pull(requesterId);

    if (!requester.friends.some(id => toIdString(id) === recipientId)) requester.friends.push(recipientId);
    if (!recipient.friends.some(id => toIdString(id) === requesterId)) recipient.friends.push(requesterId);

    await requester.save();
    await recipient.save();
    ...
    return res.json({ message: "Friend request accepted automatically" });
}

// Push to queues without duplicates
if (!recipient.friendRequests.some(id => toIdString(id) === requesterId)) {
    recipient.friendRequests.push(requesterId);
}
if (!requester.sentFriendRequests.some(id => toIdString(id) === recipientId)) {
    requester.sentFriendRequests.push(recipientId);
}

await recipient.save();
await requester.save();
```

#### Location 4: `POST /accept` Handler (lines 142-154)
**Before:**
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

**Proposed After:**
```javascript
user.friends = user.friends || [];
user.friendRequests = user.friendRequests || [];
user.sentFriendRequests = user.sentFriendRequests || [];
requester.friends = requester.friends || [];
requester.friendRequests = requester.friendRequests || [];
requester.sentFriendRequests = requester.sentFriendRequests || [];

// Validate that requesterId exists in user.friendRequests
const hasPendingRequest = user.friendRequests.some(id => toIdString(id) === requesterId);
if (!hasPendingRequest) {
    return res.status(400).json({ message: "No pending friend request from this user" });
}

// Bidirectional cleanup to prevent ghost requests (CHALLENGE 3.7)
user.friendRequests.pull(requesterId);
user.sentFriendRequests.pull(requesterId);
requester.friendRequests.pull(userId);
requester.sentFriendRequests.pull(userId);

if (!user.friends.some(id => toIdString(id) === requesterId)) user.friends.push(requesterId);
if (!requester.friends.some(id => toIdString(id) === userId)) requester.friends.push(userId);

await user.save();
await requester.save();
```

---

## 5. Recommended Test Cases

### 5.1 Additions to `server/tests/matchmaking.test.js`

Add the following suite under `describe('GET /api/matchmaking/discover', ...)`:

```javascript
describe('Null-safety and malformed reference handling in discover feed', () => {
    it('handles null, undefined, and empty objects in friend arrays without throwing 500', async () => {
        const mockCurrentUser = {
            _id: 'current_user_123',
            friends: [null, undefined, {}, { _id: null }, 'valid_friend_1'],
            friendRequests: [null, 'valid_pending_in'],
            sentFriendRequests: [undefined, 'valid_pending_out'],
            homeUniversity: 'George Mason University'
        };
        const mockMatches = [
            { _id: 'u2', name: 'Bob', skillLevel: 'Intermediate' }
        ];

        User.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockCurrentUser)
        });

        let capturedQuery = null;
        User.find.mockImplementation((query) => {
            capturedQuery = query;
            return {
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(mockMatches)
                        })
                    }),
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([])
                    })
                })
            };
        });

        const res = await request(app)
            .get('/api/matchmaking/discover')
            .set('Authorization', `Bearer ${testToken}`);

        expect(res.statusCode).toBe(200);
        // Excluded list should contain only valid non-null strings
        expect(capturedQuery._id.$nin).toContain('current_user_123');
        expect(capturedQuery._id.$nin).toContain('valid_friend_1');
        expect(capturedQuery._id.$nin).toContain('valid_pending_in');
        expect(capturedQuery._id.$nin).toContain('valid_pending_out');
        expect(capturedQuery._id.$nin).not.toContain(null);
        expect(capturedQuery._id.$nin).not.toContain(undefined);
        expect(capturedQuery._id.$nin).not.toContain('[object Object]');
        expect(res.body.matches[0].friendshipStatus).toBe('none');
    });

    it('safely hydrates friendshipStatus when discovered players have missing or null _id', async () => {
        const mockCurrentUser = {
            _id: 'current_user_123',
            friends: ['friend_1'],
        };
        const mockMatches = [
            { name: 'Player Without Id' },
            { _id: null, name: 'Player With Null Id' }
        ];

        User.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockCurrentUser)
        });

        User.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockMatches)
                    })
                }),
                limit: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([])
                })
            })
        });

        const res = await request(app)
            .get('/api/matchmaking/discover')
            .set('Authorization', `Bearer ${testToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.matches[0].friendshipStatus).toBe('none');
        expect(res.body.matches[1].friendshipStatus).toBe('none');
    });
});
```

---

### 5.2 Additions to `server/tests/friends.test.js`

Add the following tests to `server/tests/friends.test.js`:

```javascript
describe('Null-safety and resilience in friend operations', () => {
    it('POST /api/friends/request succeeds when recipient arrays contain null/undefined', async () => {
        const requester = createMockUser({ _id: userId1, friends: [null], sentFriendRequests: [undefined] });
        const recipient = createMockUser({ _id: userId2, friends: [null], friendRequests: [undefined] });

        User.findById
            .mockResolvedValueOnce(requester)
            .mockResolvedValueOnce(recipient);

        const res = await request(app)
            .post('/api/friends/request')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ recipientId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Friend request sent');
        expect(recipient.friendRequests).toContain(userId1);
        expect(requester.sentFriendRequests).toContain(userId2);
    });

    it('POST /api/friends/accept succeeds when user and requester arrays contain nulls', async () => {
        const user = createMockUser({
            _id: userId1,
            friends: [null],
            friendRequests: [null, userId2],
            sentFriendRequests: [null]
        });
        const requester = createMockUser({
            _id: userId2,
            friends: [null],
            friendRequests: [null],
            sentFriendRequests: [null, userId1]
        });

        User.findById
            .mockResolvedValueOnce(user)
            .mockResolvedValueOnce(requester);

        const res = await request(app)
            .post('/api/friends/accept')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ requesterId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Friend request accepted');
        expect(user.friends).toContain(userId2);
        expect(requester.friends).toContain(userId1);
    });

    it('POST /api/friends/request prevents duplicate entries in sentFriendRequests', async () => {
        const requester = createMockUser({ _id: userId1, sentFriendRequests: [userId2] });
        const recipient = createMockUser({ _id: userId2, friendRequests: [] });

        User.findById
            .mockResolvedValueOnce(requester)
            .mockResolvedValueOnce(recipient);

        const res = await request(app)
            .post('/api/friends/request')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ recipientId: userId2 });

        // Should be rejected since request already sent
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Request already sent');
        expect(requester.sentFriendRequests.filter(id => id.toString() === userId2)).toHaveLength(1);
    });

    it('POST /api/friends/accept cleans up bidirectional pending requests without ghost requests', async () => {
        const user = createMockUser({
            _id: userId1,
            friendRequests: [userId2],
            sentFriendRequests: [userId2],
            friends: []
        });
        const requester = createMockUser({
            _id: userId2,
            friendRequests: [userId1],
            sentFriendRequests: [userId1],
            friends: []
        });

        User.findById
            .mockResolvedValueOnce(user)
            .mockResolvedValueOnce(requester);

        const res = await request(app)
            .post('/api/friends/accept')
            .set('Authorization', `Bearer ${tokenUser1}`)
            .send({ requesterId: userId2 });

        expect(res.statusCode).toBe(200);
        expect(user.friends).toContain(userId2);
        expect(requester.friends).toContain(userId1);
        expect(user.friendRequests.pull).toHaveBeenCalledWith(userId2);
        expect(user.sentFriendRequests.pull).toHaveBeenCalledWith(userId2);
        expect(requester.friendRequests.pull).toHaveBeenCalledWith(userId1);
        expect(requester.sentFriendRequests.pull).toHaveBeenCalledWith(userId1);
    });

    it('GET /api/friends/:userId filters out null elements populated from deleted users', async () => {
        const mockUser = {
            friends: [null, { _id: userId2, name: 'Active Friend' }],
            friendRequests: [null],
            sentFriendRequests: [undefined],
        };

        User.findById.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(mockUser),
                }),
            }),
        });

        const res = await request(app)
            .get(`/api/friends/${userId1}`)
            .set('Authorization', `Bearer ${tokenUser1}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.friends).toHaveLength(1);
        expect(res.body.friends[0]._id).toBe(userId2);
        expect(res.body.friendRequests).toHaveLength(0);
        expect(res.body.sentFriendRequests).toHaveLength(0);
    });
});
```

---

### 5.3 Test Transition in `server/tests/challenge_stress.test.js`
In `server/tests/challenge_stress.test.js`, Challenger 1 registered four tests with `it.failing`:
- `CHALLENGE 3.5`: Prevents duplicate IDs in `requester.sentFriendRequests`
- `CHALLENGE 3.6`: Robustness when `friends` array contains `null` (crashes with 500)
- `CHALLENGE 3.7`: Bidirectional pending requests clean up cleanly on `/accept`
- `CHALLENGE 4.3`: Robustness against null/undefined elements in friend arrays in discover feed

**Action for Implementer**:
Once the code remediations are applied, change `it.failing(...)` to standard `it(...)` for all four tests. Because Jest requires `it.failing` tests to actually fail, leaving `it.failing` after the fix will cause Jest to fail!

---

## 6. Verification Plan & Commands

To verify before and after remediation:
1. **Run full unit tests**:
   ```bash
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
2. **Run empirical challenge suite**:
   ```bash
   npx jest server/tests/challenge_stress.test.js
   ```
3. **Run linter**:
   ```bash
   npm run lint
   ```
   Must exit with 0 errors and 0 warnings.
