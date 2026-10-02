# Challenge Report — Challenger 2 (Frontend & Optimistic UI Stress Specialist)

## Challenge Summary

**Overall risk assessment**: LOW (Frontend `<FriendActionButton>` and page integrations demonstrate high resilience, correct optimistic locking, clean rollback mechanics, and flawless build/lint/test execution).

---

## Stress Test Results Matrix

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | Synchronous burst clicks (5x click events in same tick) | Exactly 1 API call triggered; no duplicate requests | `apiFetch` invoked exactly 1 time; button locked | **PASS** |
| 2 | In-flight asynchronous clicks | Button disabled during flight; subsequent clicks ignored | Button disabled; `apiFetch` invoked exactly 1 time | **PASS** |
| 3 | Rapid clicks on "Accept Request" | Immediate optimistic transition to "Friends"; 1 API call | Transitions instantly; exactly 1 API call | **PASS** |
| 4 | Clicks with explicit `disabled={true}` prop | All click interactions blocked | No API calls dispatched | **PASS** |
| 5 | Optimistic UI label update on "Add Friend" | Label immediately updates to "Request Sent" (disabled) before network resolves | Updates synchronously before promise resolution | **PASS** |
| 6 | Loading indicator rendering | Material-UI `CircularProgress` spinner displays in `startIcon` during flight | `MuiCircularProgress` rendered while `isLoading=true`, cleared on completion | **PASS** |
| 7 | Network latency simulation (300ms artificial delay) | UI remains responsive, disabled, and stable during network latency | Button remains disabled in optimistic state; toast triggers upon resolution | **PASS** |
| 8 | HTTP 500 error rollback | Rolls back to "Add Friend", re-enables button, displays error toast with server error | Rolled back to "none", button enabled, `toast.error` displayed | **PASS** |
| 9 | Network disconnection / `TypeError: Failed to fetch` | Rolls back to "Add Friend", re-enables button, displays error toast | Rolled back to "none", button enabled, `toast.error` displayed | **PASS** |
| 10 | HTTP 400 error rollback on "Accept Request" | Rolls back to "Accept Request", re-enables button, displays error toast | Rolled back to "request_received", button enabled, `toast.error` displayed | **PASS** |
| 11 | HTTP 409 Conflict (request already exists) | Rolls back gracefully to "Add Friend", displays error toast | Rolled back to "none", `toast.error` displayed | **PASS** |
| 12 | Malformed / non-JSON error response from proxy | Handles JSON parse failure gracefully; falls back to default error message | Does not crash; falls back to "Failed to send friend request" | **PASS** |
| 13 | Self-profile: `targetUserId === currentUserId` | Component returns `null` (no button rendered) | `container.firstChild` is `null` | **PASS** |
| 14 | Self-profile: `targetUserId === user.id` (AuthContext) | Component returns `null` | `container.firstChild` is `null` | **PASS** |
| 15 | Self-profile: `targetUserId === user._id` (Mongoose AuthContext) | Component returns `null` | `container.firstChild` is `null` | **PASS** |
| 16 | Self-profile: String vs Numeric ID type mismatch | Coerces to string and returns `null` | `container.firstChild` is `null` | **PASS** |
| 17 | Unauthenticated user viewing button (`user === null`) | Renders normally without null reference exceptions | Renders "Add Friend" button without error | **PASS** |
| 18 | External `initialStatus` reactive prop mutation | Component synchronizes internal status to parent prop change | Status updates to "pending" then "friends" | **PASS** |
| 19 | Legacy status normalization (`request_sent` → `pending`) | Normalizes legacy state to "pending" and disables button | Button displays "Request Sent" and is disabled | **PASS** |
| 20 | Missing `targetUserName` prop fallback | Defaults to 'player' in aria-label and toast messages | Button displays aria-label "Add Friend for player" | **PASS** |
| 21 | Component unmount during pending network promise | Resolving API call after unmount does not throw uncaught errors | Safe resolution, no uncaught exceptions | **PASS** |
| 22 | Client automated test suite (`npm test`) | 100% pass across all client suites | 12 test files passed, 77 tests passed | **PASS** |
| 23 | Client linter (`npm run lint`) | 0 errors, 0 warnings | 0 errors, 0 warnings | **PASS** |
| 24 | Client production build (`npm run build`) | Vite build succeeds cleanly | Built in 349ms, 0 errors | **PASS** |

---

## Detailed Challenges & Observations

### [Low Risk] Challenge 1: Asynchronous Cleanup of Matchmaking `requestedFriends` Local State on Error Rollback

- **Assumption challenged**: In `Matchmaking.jsx`, `onStatusChange` adds the target player to `requestedFriends` when `newStatus === 'pending'`, but does not remove it if rollback to `'none'` occurs.
- **Attack scenario**: If a user clicks "Add Friend" on a matchmaking card, the API fails (e.g. 500 error), and the card rolls back to `'none'`. If the player card's `player.friendshipStatus` is undefined or falsy, line 420 `initialStatus={player.friendshipStatus || (requestedFriends.has(player._id) ? 'pending' : 'none')}` would evaluate back to `'pending'` on re-render.
- **Blast radius**: Minimal in current implementation because backend `/api/matchmaking/discover` explicitly hydrates `player.friendshipStatus` as `"none"` (which is a non-empty string and evaluates to truthy). However, if an API response omits `friendshipStatus`, the button could fall back to stale local pending state.
- **Mitigation**: Update `Matchmaking.jsx` `onStatusChange` callback to remove `targetUserId` from `requestedFriends` when `newStatus !== 'pending'`:
  ```javascript
  onStatusChange={(newStatus) => {
    setRequestedFriends(prev => {
      const next = new Set(prev);
      if (newStatus === 'pending') next.add(player._id);
      else next.delete(player._id);
      return next;
    });
  }}
  ```

### [Low Risk] Challenge 2: Interface Contract Variance on `onStatusChange` Callback Signature

- **Assumption challenged**: `PROJECT.md` line 83 documents `onStatusChange: (newStatus, oldStatus) => void`.
- **Implementation**: `FriendActionButton.jsx` line 59 and 80 invokes `onStatusChange(newStatus, targetUserId)`.
- **Blast radius**: None in current consumers (`Matchmaking.jsx` only consumes 1 parameter `(newStatus)`, and `ProfileHeader.jsx` only consumes `(newStatus)`). Passing `targetUserId` as the second parameter is actually more useful for list/feed views to correlate which item changed.
- **Mitigation**: Align `PROJECT.md` contract specification to document `onStatusChange: (newStatus, targetUserId) => void`.

---

## Unchallenged Areas

- **Backend Socket.io Clustering & Redis Adapter**: Out of scope for Challenger 2 (frontend specialist); covered by Challenger 1.
- **Profile Image Cropper Modal & Canvas Encoding**: Out of scope for friend request UI milestone.
