# Empirical Challenge & Adversarial Analysis — Milestone 1 Iteration 2

**Agent**: Empirical Challenger (critic, specialist)  
**Date**: 2026-09-30T01:38:00Z  
**Target Repository**: `GMU-Badminton-App`  
**Verdict**: **APPROVE**

---

## 1. Executive Summary

Milestone 1 Iteration 2 tasked the Challenger with re-verifying the remediation of 4 distinct defects identified in Iteration 1:
1. **CHALLENGE 3.5**: Duplicate ID insertion into `requester.sentFriendRequests`.
2. **CHALLENGE 3.6**: Unhandled `TypeError: Cannot read properties of null (reading 'toString')` when `friends` or `friendRequests` contain null/unpopulated references, resulting in HTTP 500.
3. **CHALLENGE 3.7**: Incomplete queue cleanup leaving ghost requests after `/accept` on bidirectional pending requests.
4. **CHALLENGE 4.3**: Discovery feed crash (`TypeError` on null elements) during query exclusion and friendship status hydration.

Additionally, this review verified that:
- All 21 challenge stress tests in `server/tests/challenge_stress.test.js` execute and pass natively without `it.failing`, `.skip`, or workarounds.
- Full server test suite (`npm test`) passes with 123/123 tests (9 suites).
- Server code satisfies ESLint with 0 errors and 0 warnings (`npm run lint`).
- Full client test suite (`npm test`) passes with 77/77 tests (12 suites).
- Client code satisfies ESLint with 0 errors and 0 warnings (`npm run lint`).
- Client production build succeeds cleanly (`npm run build`).

---

## 2. Empirical Verification Evidence

### 2.1 Challenge Stress Suite Execution
Command executed:
```powershell
npx jest tests/challenge_stress.test.js --verbose
```
Verbatim execution output:
```
PASS tests/challenge_stress.test.js
  CHALLENGER 1: Empirical Concurrency & Edge Stress Suite
    1. Unauthorized & Invalid /accept Calls
      √ CHALLENGE 1.1: Rejects /accept when user has NO pending request from requester (25 ms)
      √ CHALLENGE 1.2: Rejects /accept when a request exists from user3, but user2 is passed (13 ms)
      √ CHALLENGE 1.3: Rejects /accept if target user ID is non-existent in database (12 ms)
      √ CHALLENGE 1.4: Rejects /accept with malformed or non-ObjectId requesterId (10 ms)
    2. Self-Addition & Self-Interaction Stress
      √ CHALLENGE 2.1: Rejects self-addition via /request (recipientId === requesterId) (4 ms)
      √ CHALLENGE 2.2: Rejects self-addition via /request aliases (friendId or targetId) (10 ms)
      √ CHALLENGE 2.3: Rejects self-accept if user tries to accept themselves without pending request (4 ms)
    3. Concurrency, Duplicate Prevention & Array Integrity
      √ CHALLENGE 3.1: Sequential duplicate /request is rejected with 400 and arrays not duplicated (4 ms)
      √ CHALLENGE 3.2: Rejects /request if already friends with 400 (24 ms)
      √ CHALLENGE 3.6: Robustness when friends array contains null/unpopulated references (succeeds with 200) (15 ms)
      √ CHALLENGE 3.3: Double /accept attempt fails on second call and does not duplicate friend list (13 ms)
      √ CHALLENGE 3.4: Auto-accept mutual request cleans up friendRequests and does not duplicate friends (16 ms)
      √ CHALLENGE 3.5: Prevents duplicate IDs in requester.sentFriendRequests if already present (3 ms)
      √ CHALLENGE 3.7: Bidirectional pending requests clean up cleanly on /accept without leaving ghost requests (17 ms)
    4. Discovery Query Exclusion Stress
      √ CHALLENGE 4.1: Strictly excludes self, all friends, all incoming requests, and all outgoing requests (4 ms)
      √ CHALLENGE 4.2: Handles populated friend objects with {_id: ...} in exclusion list (3 ms)
      √ CHALLENGE 4.3: Robustness against null/undefined elements in friend arrays (succeeds with 200) (29 ms)
      √ CHALLENGE 4.4: Recommended matches also strictly filter out excluded IDs and hydrate friendshipStatus (4 ms)
    5. Decline/Reject Behavior & Socket Event Emissions
      √ CHALLENGE 5.1: /decline removes pending request from both sides and emits friendRequestDeclined (4 ms)
      √ CHALLENGE 5.2: /reject (alias) behaves identically to /decline when cancelling sent request (3 ms)
      √ CHALLENGE 5.3: Gracefully succeeds even if Socket.io is not attached to app (4 ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        1.058 s, estimated 2 s
```

### 2.2 Re-verification of 4 Target Edge Cases

#### CHALLENGE 3.5: Duplicate Prevention in `sentFriendRequests`
- **Initial Defect**: Sending a duplicate request pushed the recipient ID unconditionally into `requester.sentFriendRequests` without checking if it was already present.
- **Verification**:
  - `server/routes/friends.js` checks `if (safeIncludesId(recipient.friendRequests, requesterId) || safeIncludesId(requester.sentFriendRequests, recipientId))` and returns 400 `"Request already sent"`.
  - Array mutation uses `safePushUnique(arr, idToAdd)`, checking normalized ID string uniqueness before inserting.
  - Test ran with `user1.sentFriendRequests = [userId2]` and sent another request to `userId2`.
  - Result: Array retained exactly 1 occurrence of `userId2`, returning HTTP 400 with no duplication.

#### CHALLENGE 3.6: Robustness Against Nulls in Friends Arrays
- **Initial Defect**: `(f?._id || f).toString()` crashed with `TypeError: Cannot read properties of null (reading 'toString')` when array elements were null.
- **Verification**:
  - `server/routes/friends.js` introduced `toIdString(item)` which checks for null/undefined before stringifying and discards `"[object Object]"` strings.
  - `GET /:userId` sanitizes responses via `(user.friends || []).filter(Boolean)`.
  - Test ran with `user1.friends = [null]` and `user2.friends = [null]`.
  - Result: Request resolved with HTTP 200, no unhandled exceptions or 500 errors.

#### CHALLENGE 3.7: Clean Bidirectional Queue Cleanup on `/accept`
- **Initial Defect**: Concurrent mutual friend requests resulted in ghost pending requests in `user.sentFriendRequests` and `requester.friendRequests` after acceptance.
- **Verification**:
  - `server/routes/friends.js` implemented `clearBidirectionalRequests(userA, userB)`, pulling `userA.friendRequests.pull(idB)`, `userA.sentFriendRequests.pull(idB)`, `userB.friendRequests.pull(idA)`, and `userB.sentFriendRequests.pull(idA)`.
  - Both users are mutated and persisted using `.save()`.
  - Test ran with cross-pending requests in all 4 queues.
  - Result: Both users transitioned to mutual friends with 0 residual requests in any incoming or outgoing queues.

#### CHALLENGE 4.3: Discovery Query Exclusion and Hydration with Nulls
- **Initial Defect**: `/api/matchmaking/discover` threw `TypeError: Cannot read properties of null (reading 'toString')` at line 62 when `friends` or `friendRequests` contained nulls.
- **Verification**:
  - `server/routes/matchmaking.js` implemented `toIdString(item)` and filters `excludedIds` using non-null string IDs.
  - `getFriendshipStatus(targetId)` evaluates `toIdString(targetId)` against array elements safely.
  - Test ran with `friends: [null, undefined, '6600...99']` and `friendRequests: [null]`.
  - Result: Query returned HTTP 200 with matches safely hydrated and excluded IDs correctly queried.

---

## 3. Full-Stack Integrity & Regression Check

| Check | Target | Expected | Observed | Status |
|---|---|---|---|---|
| Server Challenge Suite | `server/tests/challenge_stress.test.js` | 21 / 21 passing | 21 / 21 passing | **PASS** |
| Server Full Test Suite | `server/` | 123 / 123 passing | 123 / 123 passing (9 suites) | **PASS** |
| Server Linter | `server/` | 0 errors, 0 warnings | 0 errors, 0 warnings | **PASS** |
| Client Full Test Suite | `client/` | 77 / 77 passing | 77 / 77 passing (12 suites) | **PASS** |
| Client Linter | `client/` | 0 errors, 0 warnings | 0 errors, 0 warnings | **PASS** |
| Client Production Build | `client/` | Clean build | `✓ built in 349ms` (PWA SW generated) | **PASS** |

---

## 4. Adversarial Attack Surface Analysis

### 4.1 Input Validation & Object ID Injection
- **Scenario**: Passing malformed strings, numbers, or non-ObjectId values into `requesterId`, `recipientId`, or `targetId`.
- **Finding**: Both `friends.js` and `matchmaking.js` validate IDs using `mongoose.isValidObjectId(id)` and return HTTP 400 before querying MongoDB or modifying document arrays.

### 4.2 Self-Targeting Attacks
- **Scenario**: A user submits their own ID to `/request`, `/accept`, or `/decline`.
- **Finding**: `/request` checks `requesterId === recipientId` and returns 400 `"Cannot add yourself"`. `/accept` checks `hasPendingRequest` which fails for self-requests. `/decline` explicitly rejects `userId === targetId` with 400 `"Cannot decline yourself"`.

### 4.3 Concurrent Race Conditions & Duplicate Retries
- **Scenario**: Multiple concurrent `/request` calls for the same target user.
- **Finding**: `safeIncludesId` and `safePushUnique` guarantee in-memory idempotency before Mongoose `.save()`. Retried requests are rejected with 400 `"Request already sent"` or `"Already friends"`.

### 4.4 Socket Notification Resilience
- **Scenario**: Application runs in a test or serverless environment without Socket.io attached.
- **Finding**: Sockets are conditionally invoked with `const io = req.app?.get("io") || req.io; if (io) { ... }`. Test `CHALLENGE 5.3` proves the routes execute normally without crashing when `io` is absent.

---

## 5. Verdict

**VERDICT: APPROVE**

The remediation in Milestone 1 Iteration 2 is complete, robust, defensively coded, and backed by 100% native passing automated tests. All 4 defects from Iteration 1 have been completely resolved without workarounds. Milestone 1 is verified ready for Milestone 2 (PR creation and QA Lead review).
