# DISPATCH — Worker Milestone 1 Iteration 2 (Remediation)

## Objective
Implement defensive fixes for the 4 defects discovered by Challenger 1, ensuring 100% test pass with zero workarounds (`it.failing`), complete null-safety, duplicate prevention, and bidirectional request reconciliation.

## Working Directory
`D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1_iter2`

## Inputs
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md`
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md`
- Challenger 1 Report: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_challenger_m1_1\handoff.md`
- Remediation Explorer 1 (Null-Safety): `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_1\handoff.md`
- Remediation Explorer 2 (Duplicate Prevention): `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_2\handoff.md`
- Remediation Explorer 3 (Bidirectional Reconciliation): `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_3\handoff.md`

## File Ownership
- `server/routes/matchmaking.js`
- `server/routes/friends.js`
- `server/tests/challenge_stress.test.js`
- `server/tests/friends.test.js`
- `server/tests/matchmaking.test.js`

## Specific Remediation Tasks:
1. **Null-Safety & Defensive ID Helper (`toIdString`)**:
   - In `server/routes/matchmaking.js` and `server/routes/friends.js`:
     ```javascript
     const toIdString = (item) => {
         if (!item) return null;
         const raw = item._id !== undefined ? item._id : item;
         if (!raw) return null;
         const str = typeof raw.toString === "function" ? raw.toString() : String(raw);
         return str && str !== "[object Object]" ? str : null;
     };
     ```
   - In `server/routes/matchmaking.js`:
     - Filter out null/undefined/falsy values before pushing to `excludedIds`.
     - In `getFriendshipStatus`, safely check `targetStr = toIdString(targetId)` and compare `toIdString(id) === targetStr`.
     - In lines 145 and 161, pass `player?._id || player`.
   - In `server/routes/friends.js`:
     - Replace all raw `(id._id || id).toString()` with `toIdString(id)`.
     - In `GET /:userId`, sanitize response with `(user.friends || []).filter(Boolean)`.

2. **Idempotent Duplicate Prevention (`safePushUnique`)**:
   - In `server/routes/friends.js`:
     ```javascript
     const safeIncludesId = (arr, idToFind) => {
         const target = toIdString(idToFind);
         if (!target || !Array.isArray(arr)) return false;
         return arr.some(item => toIdString(item) === target);
     };

     const safePushUnique = (arr, idToAdd) => {
         if (!safeIncludesId(arr, idToAdd)) {
             arr.push(idToAdd);
         }
     };
     ```
   - In `POST /api/friends/request`:
     - Check `safeIncludesId(requester.sentFriendRequests, recipientId)` before pushing; reject with `"Request already sent"` if request already pending in either direction.
     - Use `safePushUnique(recipient.friendRequests, requesterId)` and `safePushUnique(requester.sentFriendRequests, recipientId)`.
     - In `POST /api/friends/accept` and mutual request auto-accept, use `safePushUnique` for `friends` arrays.

3. **Bidirectional Request Reconciliation (`clearBidirectionalRequests`)**:
   - In `server/routes/friends.js`:
     ```javascript
     const clearBidirectionalRequests = (userA, userB) => {
         const idA = toIdString(userA?._id || userA);
         const idB = toIdString(userB?._id || userB);
         if (!idA || !idB || idA === idB) return;

         if (userA.friendRequests) userA.friendRequests.pull(idB);
         if (userA.sentFriendRequests) userA.sentFriendRequests.pull(idB);
         if (userB.friendRequests) userB.friendRequests.pull(idA);
         if (userB.sentFriendRequests) userB.sentFriendRequests.pull(idA);
     };
     ```
   - Call `clearBidirectionalRequests` in `POST /api/friends/accept`, in mutual auto-accept in `POST /api/friends/request`, and in `handleDeclineOrReject`.

4. **Test Suite Updates**:
   - In `server/tests/challenge_stress.test.js`:
     - Update all `it.failing(...)` (CHALLENGE 3.5, 3.6, 3.7, 4.3) to standard `it(...)`.
     - Ensure all 21 challenge tests pass cleanly.
   - Run `npm test` and `npm run lint` in `server/`.
   - Run `npm test`, `npm run lint`, and `npm run build` in `client/`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-30T01:28:49Z
You are Worker 2 for Milestone 1 Iteration 2 (Remediation).
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1_iter2
Your task is defined in: D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_worker_m1_iter2\DISPATCH.md
Read:
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\PROJECT.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_challenger_m1_1\handoff.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_1\handoff.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_2\handoff.md
- D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m1_iter2_3\handoff.md

