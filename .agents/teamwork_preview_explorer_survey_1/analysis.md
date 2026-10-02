# Deep Technical Analysis: Facebook-Style Friend Request System & Matchmaking Discovery

## Executive Summary
This report details the backend architectural investigation for the GMU Badminton App, specifically focusing on the Facebook-style friend request system, player discovery hydration and exclusion, and real-time Socket.io notifications as mandated by the project requirements.

The backend is built with Express.js, MongoDB (Mongoose), Socket.io, and Kafka for event publishing. The investigation identified exact schema structures, route controllers, and socket patterns, as well as critical security bugs (such as unauthorized friend acceptance without pending requests) and parameter naming inconsistencies between frontend components (`recipientId` vs `friendId`).

---

## 1. Data Models & Schemas

### 1.1 User Model (`server/models/User.js`)
The `User` schema directly manages friendships using three array fields containing `ObjectId` references to other `User` documents:

```javascript
// server/models/User.js (Lines 56-60)
// Friends System
friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```

#### Field Semantics & Invariants
| Field | Type | Symmetric? | Meaning |
|---|---|---|---|
| `friends` | `ObjectId[]` | **Symmetric** | If User A is in User B's `friends`, User B MUST be in User A's `friends`. |
| `friendRequests` | `ObjectId[]` | **Asymmetric** | Incoming pending friend requests. Stores IDs of users who sent a request to this user. |
| `sentFriendRequests` | `ObjectId[]` | **Asymmetric** | Outgoing pending friend requests. Stores IDs of users to whom this user has sent a request. |

#### Invariants & Integrity Constraints:
1. **Disjointness**: For any pair $(A, B)$, $B$ cannot simultaneously exist in $A$'s `friends` and $A$'s `friendRequests` or `sentFriendRequests`.
2. **Symmetry of Pending Requests**: If $B \in A.\text{friendRequests}$, then $A \in B.\text{sentFriendRequests}$.
3. **No Self-Reference**: A user's `_id` must never appear in their own `friends`, `friendRequests`, or `sentFriendRequests`.
4. **No Duplicates**: Each array must contain unique `ObjectId`s.

#### Mongoose Lifecycle Hooks & Kafka Publishing
In `server/models/User.js` (lines 102-108):
```javascript
userSchema.post("save", async function (doc) {
	try {
		await publishEvent("user-events", { type: "user.updated", payload: sanitizeUserForEvent(doc) });
	} catch (error) {
		console.error("Kafka publish error (User save):", error);
	}
});
```
- **Crucial Observation**: The schema defines a `post("save")` hook to publish `user.updated` events to Kafka.
- **Implication**: If route handlers use atomic operations like `User.findByIdAndUpdate` or `User.bulkWrite`, Mongoose `post("save")` hooks are **bypassed**. Using `doc.save()` triggers the Kafka producer, keeping event streams consistent with the rest of the application.

### 1.2 Notification Model (`server/models/Notification.js`)
```javascript
const notificationSchema = new mongoose.Schema({
	targetUserId: { type: String, required: true },
	message: { type: String, required: true },
	link: { type: String, required: true },
	read: { type: Boolean, default: false },
	time: { type: Date, default: Date.now },
});
```
- Notifications are persistently stored and delivered in real-time via Socket.io.
- `targetUserId` is stored as a `String` (matching the user's ObjectId hex string).

---

## 2. Matchmaking Discovery Investigation (`/api/matchmaking/discover`)

### 2.1 Current Implementation (`server/routes/matchmaking.js`, lines 48-136)
The `/discover` endpoint currently:
1. Retrieves the current user via `User.findById(req.user.userId).lean()`.
2. Constructs a base query that **only excludes the caller**:
   ```javascript
   const query = {
       _id: { $ne: req.user.userId },
   };
   ```
3. Handles cursor-based pagination:
   ```javascript
   if (cursor) {
       query._id = { $ne: req.user.userId, $lt: cursor };
   }
   ```
4. Executes the search against MongoDB:
   ```javascript
   const potentialMatches = await User.find(query)
       .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location checkInLocation preferredTimeOfDay inQueue")
       .sort({ _id: -1 })
       .limit(50)
       .lean();
   ```
5. Fetches "People You May Know" (`recommended`) matching `homeUniversity`, also only excluding self:
   ```javascript
   let recommended = [];
   if (currentUser && currentUser.homeUniversity) {
       recommended = await User.find({
           _id: { $ne: req.user.userId },
           homeUniversity: currentUser.homeUniversity
       })
       .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
       .limit(4)
       .lean();
   }
   ```
6. Returns `{ matches: potentialMatches, recommended }`.

### 2.2 Shortcomings of Current Implementation
1. **No Friend/Pending Exclusion**: Any user who is already a friend or has an active pending request (sent or received) still appears in the feed.
2. **Missing `friendshipStatus` Field**: Neither `matches` nor `recommended` items contain a `friendshipStatus` property ("none", "pending", "friends").
3. **Recommended Query Leak**: Existing friends and pending requests also appear in the "People You May Know" carousel.

### 2.3 Proposed MongoDB Query Exclusion & Hydration
To completely exclude existing friends and pending requests:

#### A. Assembling Excluded IDs
```javascript
const excludedIds = [req.user.userId];
if (currentUser) {
    if (Array.isArray(currentUser.friends)) excludedIds.push(...currentUser.friends);
    if (Array.isArray(currentUser.friendRequests)) excludedIds.push(...currentUser.friendRequests);
    if (Array.isArray(currentUser.sentFriendRequests)) excludedIds.push(...currentUser.sentFriendRequests);
}
```

#### B. Query Formulation with Cursor Pagination
MongoDB supports combining `$nin` and `$lt` on the `_id` field:
```javascript
const query = {
    _id: cursor ? { $nin: excludedIds, $lt: cursor } : { $nin: excludedIds }
};
```
And for `recommended`:
```javascript
const recommendedQuery = {
    _id: { $nin: excludedIds },
    homeUniversity: currentUser.homeUniversity
};
```

#### C. `friendshipStatus` Computation
Even when excluded from general discovery, individual queries (or recommendations, searches, and test cases) require `friendshipStatus` to be computed and returned as `"none"`, `"pending"`, or `"friends"`:

```javascript
const computeFriendshipStatus = (targetId, userDoc) => {
    if (!userDoc || !targetId) return "none";
    const targetStr = (targetId._id || targetId).toString();
    
    // Check friends
    if (userDoc.friends?.some(id => (id._id || id).toString() === targetStr)) {
        return "friends";
    }
    // Check pending (sent or received)
    if (userDoc.sentFriendRequests?.some(id => (id._id || id).toString() === targetStr) ||
        userDoc.friendRequests?.some(id => (id._id || id).toString() === targetStr)) {
        return "pending";
    }
    return "none";
};
```

Both `potentialMatches` and `recommended` items must be mapped before serialization:
```javascript
const hydratedMatches = potentialMatches.map(player => ({
    ...player,
    friendshipStatus: computeFriendshipStatus(player._id, currentUser)
}));

const hydratedRecommended = recommended.map(player => ({
    ...player,
    friendshipStatus: computeFriendshipStatus(player._id, currentUser)
}));
```

---

## 3. Friends Endpoints & Controllers (`server/routes/friends.js`)

### 3.1 Current Route Inventory
| Method | Endpoint | Auth Required | Purpose |
|---|---|---|---|
| `GET` | `/:userId` | Yes (Self/Admin) | Fetches user's friends, friendRequests, sentFriendRequests (populated). |
| `POST` | `/request` | Yes | Sends friend request or auto-accepts mutual request. |
| `POST` | `/accept` | Yes | Accepts friend request. |
| `POST` | `/reject` | Yes | Cancels or rejects pending request. |
| `POST` | `/remove` | Yes | Removes active friendship. |
| `GET` | `/search/:query` | Yes | Searches users by name regex. |

### 3.2 Critical Observations & Vulnerabilities in Existing Code

#### Vulnerability 1: Unauthorized Friendship Creation in `/accept`
In `server/routes/friends.js` (lines 118-124):
```javascript
user.friendRequests.pull(requesterId);
requester.sentFriendRequests.pull(userId);

if (!user.friends.includes(requesterId)) user.friends.push(requesterId);
if (!requester.friends.includes(userId)) requester.friends.push(userId);

await user.save();
await requester.save();
```
- **Bug**: The handler **never verifies** that `user.friendRequests` actually contains `requesterId`!
- Calling `user.friendRequests.pull(requesterId)` silently succeeds even when the array was empty.
- Then, both users are added to `friends`!
- **Impact**: Any authenticated user could call `POST /api/friends/accept` with any arbitrary user ID and force a mutual friendship without the other user ever sending a request.
- **Fix**: Must check `const hasRequest = user.friendRequests.some(id => id.toString() === requesterId.toString());` and return `400 Bad Request` ("No pending friend request from this user") if false.

#### Vulnerability 2: Missing `/decline` Route
- Requirement R3 explicitly states: `Implement /api/friends/accept and /api/friends/decline backend routes`.
- `friends.js` currently only implements `POST /reject`.
- **Fix**: Implement `POST /api/friends/decline` and retain `POST /api/friends/reject` as an alias to avoid breaking existing callers in `Profile.jsx` and `Messages.jsx`.

#### Vulnerability 3: Inconsistent Body Parameter Naming
Different frontend components send different keys:
- `Matchmaking.jsx` & `Matchmaking.test.jsx`: send `{ friendId: playerId }`
- `Profile.jsx`: sends `{ requesterId: user.id, recipientId: id }` to `/request`, `{ userId: user.id, requesterId: id }` to `/accept`, and `{ userId: user.id, targetId: id }` to `/reject`.
- `friends.js` currently expects strictly `recipientId` on `/request`, `requesterId` on `/accept`, and `targetId` on `/reject`.
- **Fix**: Standardize with defensive fallbacks:
  - `/request`: `const recipientId = req.body.recipientId || req.body.friendId || req.body.targetId;`
  - `/accept`: `const requesterId = req.body.requesterId || req.body.targetId || req.body.friendId;`
  - `/decline`: `const targetId = req.body.requesterId || req.body.targetId || req.body.friendId || req.body.recipientId;`

#### Vulnerability 4: Missing Socket Event on Decline / Reject
- When a request is rejected or declined, no socket event is emitted.
- If User A views User B's profile while User B declines User A's request, User A's button remains stuck on "Request Sent" until a hard page reload.
- **Fix**: Emit `friendRequestDeclined` (or `friendRequestRemoved`) to `targetId` and `userId`.

---

## 4. Socket.io Architecture & Event Protocol

### 4.1 Server Setup (`server/server.js`)
1. Socket server initialization:
   ```javascript
   const io = new Server(server, { cors: corsOptions });
   app.use((req, res, next) => { req.io = io; next(); });
   app.set("io", io);
   ```
2. Room membership:
   - When any client connects, it emits `joinUserRoom(userId)`.
   - The server handles this:
     ```javascript
     socket.on("joinUserRoom", async (userId) => {
         socket.userId = userId;
         socket.join(userId);
         onlineUsers.add(userId);
         io.emit("onlineUsersUpdate", Array.from(onlineUsers));
     });
     ```
   - Each user has a personal room whose name is their `userId` string.

### 4.2 Socket Event Catalog for Friend Actions

| Event Name | Emitted From | Recipient Room | Payload Structure | UI Reaction |
|---|---|---|---|---|
| `newNotification` | `POST /request`, `POST /accept` | `recipientId` / `requesterId` | `{ _id, targetUserId, message, link, read, time }` | Toast pop-up & increment notification badge |
| `friendRequestReceived` | `POST /request` | `recipientId` | `{ requesterId, requester: { _id, name, profilePic, skillLevel } }` | Updates discovery feed (removes requester) & updates profile button |
| `friendRequestAccepted` | `POST /accept` | `requesterId` AND `userId` | `{ userId, friend: { _id, name, profilePic, skillLevel } }` | Changes button from "Request Sent" to "Friends" immediately |
| `friendRequestDeclined` | `POST /decline` | `targetId` AND `userId` | `{ userId }` | Resets button from "Request Sent" back to "Add Friend" |
| `friendRemoved` | `POST /remove` | `friendId` AND `userId` | `{ friendId }` | Resets button from "Friends" back to "Add Friend" |

### 4.3 Safe Socket Access in Express Controllers
In Jest unit tests (e.g. `tests/matchmaking.test.js`), `req.app.get("io")` may be undefined unless explicitly mocked.
Controllers must access `io` defensively:
```javascript
const io = req.app?.get("io") || req.io;
if (io) {
    io.to(recipientId.toString()).emit("friendRequestReceived", { requesterId });
}
```

---

## 5. Edge Cases & Concurrency Analysis

| Scenario | Risk | Mitigation |
|---|---|---|
| **Self-Friend Request** | User adds themselves | Reject with 400 (`requesterId === recipientId`). |
| **Duplicate Request** | Double-clicking or spamming `POST /request` | Check `recipient.friendRequests.includes(requesterId)` and return 400. Use UI optimistic disabling. |
| **Mutual Requests** | User A sends to User B, User B sends to User A before seeing it | Already implemented: if User B sends to User A while User A's request is pending, auto-accept and transition both to `friends`. |
| **Accepting Without Pending Request** | Security vulnerability (spoofing friendships) | Explicitly verify `user.friendRequests.some(id => id.toString() === requesterId.toString())`. |
| **Accepting Already Friends** | Redundant mutation / array bloat | Check `user.friends.some(...)` before adding. |
| **Simultaneous Accept & Cancel** | Race condition between users | Use array `.pull()` on both arrays; verify existence before mutate; Mongoose document versioning (`__v`) prevents dirty writes. |
| **Deleted / Invalid Users** | CastError or 500 crash | Validate with `mongoose.isValidObjectId(id)` and verify non-null document. |
| **Mongoose ObjectId Comparison Pitfall** | `objectIdA === objectIdB` returns false in JS | Always compare using `.toString()`: `idA.toString() === idB.toString()`. |

---

## 6. Detailed Implementation Blueprint for the Implementation Agent

### 6.1 `server/routes/matchmaking.js`
Replace lines 56-62 and 90-93 with:
```javascript
const currentUser = await User.findById(req.user.userId).lean();

// Collect all IDs that must be excluded from discovery
const excludedIds = [req.user.userId];
if (currentUser) {
    if (Array.isArray(currentUser.friends)) excludedIds.push(...currentUser.friends);
    if (Array.isArray(currentUser.friendRequests)) excludedIds.push(...currentUser.friendRequests);
    if (Array.isArray(currentUser.sentFriendRequests)) excludedIds.push(...currentUser.sentFriendRequests);
}

// Helper to determine friendship status ("none", "pending", "friends")
const getFriendshipStatus = (targetId) => {
    if (!currentUser || !targetId) return "none";
    const targetStr = (targetId._id || targetId).toString();
    if (currentUser.friends?.some(id => (id._id || id).toString() === targetStr)) return "friends";
    if (currentUser.sentFriendRequests?.some(id => (id._id || id).toString() === targetStr)) return "pending";
    if (currentUser.friendRequests?.some(id => (id._id || id).toString() === targetStr)) return "pending";
    return "none";
};

// Build base query (exclude self, existing friends, and pending requests)
const query = {
    _id: { $nin: excludedIds },
};

// ... filters (skill, search, campus, time) ...

// Cursor-Based Pagination
if (cursor) {
    query._id = { $nin: excludedIds, $lt: cursor };
}

// Fetch matches & hydrate
const potentialMatches = await User.find(query)
    .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location checkInLocation preferredTimeOfDay inQueue")
    .sort({ _id: -1 })
    .limit(50)
    .lean();

const hydratedMatches = potentialMatches.map(player => ({
    ...player,
    friendshipStatus: getFriendshipStatus(player._id)
}));

// Fetch recommendations & hydrate (also excluding friends and pending requests)
let recommended = [];
if (currentUser && currentUser.homeUniversity) {
    const rawRecommended = await User.find({
        _id: { $nin: excludedIds },
        homeUniversity: currentUser.homeUniversity
    })
    .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
    .limit(4)
    .lean();

    recommended = rawRecommended.map(player => ({
        ...player,
        friendshipStatus: getFriendshipStatus(player._id)
    }));
}

res.json({ matches: hydratedMatches, recommended });
```

### 6.2 `server/routes/friends.js`
1. **Enhance `/request`**: Support both `recipientId` and `friendId`.
2. **Enhance `/accept`**:
   - Add verification that `user.friendRequests` contains `requesterId`.
   - Prevent duplicate additions to `friends`.
   - Emit `friendRequestAccepted` and `newNotification`.
3. **Implement `/decline`**:
   - Safely mutate `friendRequests` and `sentFriendRequests`.
   - Emit `friendRequestDeclined` via Socket.io.
   - Retain `/reject` endpoint pointing to identical logic.
4. **Ensure Defensive Socket Emission**: Wrap in `if (req.app?.get("io"))`.

### 6.3 Test Alignment Considerations
In `server/tests/matchmaking.test.js`:
- The existing test checks `expect(res.body).toEqual({ matches: mockMatches, recommended: mockRecommended })`.
- When `friendshipStatus` is added to each player object in `matches` and `recommended`, the mock objects in `matchmaking.test.js` or the assertion must be updated to expect `friendshipStatus: 'none'`, or the test will fail on strict equality comparison.
- Dedicated tests for exclusion of friends and pending requests should be added.
