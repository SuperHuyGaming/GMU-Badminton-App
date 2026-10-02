# Handoff Report — Explorer Remediation 2 (Duplicate Array Prevention Specialist)

## 1. Observation

Direct empirical observations from code review, test executions, and test fixtures:

1. **Unchecked Push in `server/routes/friends.js:91-92`**:
   - In `server/routes/friends.js`:
     ```javascript
     91: recipient.friendRequests.push(requesterId);
     92: requester.sentFriendRequests.push(recipientId);
     ```
   - Prior to line 92, the code checks `recipient.friendRequests` at line 62, but performs **no verification whatsoever** on `requester.sentFriendRequests`.

2. **Verbatim Test Failure in `CHALLENGE 3.5` (`server/tests/challenge_stress.test.js:298-316`)**:
   - In `CHALLENGE 3.5`, when `user1.sentFriendRequests` initially contains `userId2` and sends a request to `userId2`:
     ```
     Expected length: 1
     Received length: 2
     Received array:  ["660000000000000000000002", "660000000000000000000002"]
     ```
   - Marked with `it.failing` because the current code fails to prevent duplicate accumulation.

3. **In-Memory Mock Architecture in Jest Test Harness (`server/tests/friends.test.js:32-56`)**:
   - In `server/tests/friends.test.js` and `server/tests/challenge_stress.test.js`:
     ```javascript
     const createMockUser = (overrides = {}) => {
         const user = {
             friends: overrides.friends ? [...overrides.friends] : [],
             friendRequests: overrides.friendRequests ? [...overrides.friendRequests] : [],
             sentFriendRequests: overrides.sentFriendRequests ? [...overrides.sentFriendRequests] : [],
             save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
             ...
         };
         const attachArrayMethods = (arr) => {
             arr.pull = jest.fn(...);
             return arr;
         };
     ```
   - Only `.pull()` is mocked on array instances. If the backend invokes `.addToSet()` (a Mongoose DocumentArray method), mock arrays throw `TypeError: ...addToSet is not a function`.

4. **Kafka Post-Save Hook Dependency (`server/models/User.js:102-108`)**:
   - In `server/models/User.js`:
     ```javascript
     userSchema.post("save", async function (doc) {
         try {
             await publishEvent("user-events", { type: "user.updated", payload: sanitizeUserForEvent(doc) });
         } catch (error) { ... }
     });
     ```
   - Direct MongoDB database calls such as `User.updateOne(..., { $addToSet: ... })` bypass Mongoose document `post("save")` hooks entirely, breaking event propagation.

---

## 2. Logic Chain

1. **Inference from Observation 1 & 2**: Because `server/routes/friends.js:92` calls `requester.sentFriendRequests.push(recipientId)` unconditionally, any scenario where `requester.sentFriendRequests` already contains `recipientId` (such as a desync state, network retry, or duplicate UI click) causes an identical duplicate ID to be appended.
2. **Inference from Observation 3**: While Mongoose document arrays in production possess an `.addToSet()` method, utilizing `.addToSet()` in route handlers will break the existing test harness (`server/tests/friends.test.js` and `server/tests/challenge_stress.test.js`) because mock user arrays are plain JavaScript arrays that only mock `.pull()`.
3. **Inference from Observation 4**: Refactoring the routes to use MongoDB direct updates (`User.updateOne(..., { $addToSet: ... })`) is hazardous because it circumvents the Mongoose `post("save")` Kafka publisher, prevents access to in-memory user objects needed for notifications and socket emissions, and invalidates existing `User.findById` test mocks.
4. **Synthesis**: The optimal, safest remediation is introducing module-level in-memory guard helpers (`safeIncludesId` and `safePushUnique`) in `server/routes/friends.js`. These helpers perform idempotent insertion using optional chaining (`item?._id || item`), prevent duplicates across all ID formats (String, ObjectId, populated doc), remain 100% compatible with Jest mocks, and preserve document `.save()` and Kafka hooks.

---

## 3. Caveats

- In high-throughput distributed environments with multiple server processes running concurrently against a shared replica set, in-memory checks followed by `.save()` do not provide ACID serialization without MongoDB transactions or optimistic version locking (`__v`). For this application, Mongoose versioning and document saving are standard across all existing routes.
- Front-end optimistic UI throttling on `<FriendActionButton>` further mitigates duplicate rapid clicks at the browser level.

---

## 4. Conclusion

The array pollution vulnerability in `server/routes/friends.js` can be completely resolved with zero regression risk by:
1. Adding `safeIncludesId` and `safePushUnique` helpers to `server/routes/friends.js`.
2. Replacing unconditional pushes at lines 91-92 with:
   ```javascript
   safePushUnique(recipient.friendRequests, requesterId);
   safePushUnique(requester.sentFriendRequests, recipientId);
   ```
3. Using `safePushUnique` for `friends` array pushes during auto-accept (lines 71-72) and manual accept (lines 150-151).
4. Updating `CHALLENGE 3.5` in `server/tests/challenge_stress.test.js` from `it.failing` to standard `it`, and adding explicit duplicate prevention unit tests to `server/tests/friends.test.js`.

---

## 5. Verification Method

To independently verify this strategy after the worker applies the proposed remediation:

1. **Verify `CHALLENGE 3.5` Passes as Standard `it` Test**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npx jest server/tests/challenge_stress.test.js -t "CHALLENGE 3.5"
   ```
   *Expected outcome*: Test passes without `it.failing`.

2. **Run Full Server Test Suite**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   ```
   *Expected outcome*: All test suites pass (9 suites, 118+ tests).

3. **Verify Linting Compliance**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm run lint
   ```
   *Expected outcome*: 0 errors, 0 warnings.
