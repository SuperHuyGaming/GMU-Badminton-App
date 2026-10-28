# Project: Notifications System Sprint Overhaul

## Architecture
The notification system spans the full stack of Mason Badminton Connect:
- **Backend Persistence & Sockets**: Mongoose `Notification` model with compound indexes (`{ targetUserId: 1, time: -1 }`, `{ targetUserId: 1, read: 1 }`). Express routes in `server/routes/forum.js` handling `GET /notifications/:userId`, `PUT /notifications/:userId/read`, `DELETE /notifications/:userId`, and `PUT /notifications/single/:notifId/read`. Real-time socket events emitted to user room (`userId`) via Socket.io (`newNotification`, `notificationsMarkedRead`, `notificationsCleared`, `notificationRead`).
- **Frontend Hook & Synchronization Layer**: `client/src/hooks/useNotifications.js` provides reactive state (`notifications`, `unreadCount`, `unreadMessages`), deduplicated socket listener (`newNotification`), and multi-tab synchronization listeners (`notificationsMarkedRead`, `notificationsCleared`).
- **Frontend Navigation & Deep-Link Layer**: `client/src/App.jsx` preserves query search parameters and hash fragments during `/forum` redirection to `/community`. `PostCard.jsx` and `Forum.jsx` inspect `?postId=` and `?highlight=` / `#comment-...` to scroll and highlight target comments. `Messages.jsx` inspects `?userId=` to open active conversation threads.
- **Frontend Presentation Layer**: `client/src/components/Navbar.jsx` renders the bell icon, unread counter badge, and dropdown menu. Implements Bell Read-on-Open invariant (`badgeContent={notifOpen ? 0 : unreadCount}` + async `markAsRead`), segmented tabs ("All" / "Unread"), bulk actions ("Mark all as read" / "Clear All"), distinct unread pip & background styling, and empty state illustrations.
- **Test Infrastructure**: Automated unit and integration tests in `server/tests/notifications.test.js`, `client/src/hooks/useNotifications.test.js`, and `client/src/components/Navbar.test.jsx`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Bell Read-on-Open Invariant | Clicking notification bell immediately clears badge to 0/hidden and triggers async mark-all-read API | M3 | R1 |
| 2 | Backend Mark-All-Read & Sockets | `PUT /api/forum/notifications/:userId/read` marks all unread as read, returns counts, emits `notificationsMarkedRead` | M1 | R1, R4 |
| 3 | Segmented View Filtering | "All" vs "Unread" toggle controls in notification dropdown filtering items dynamically | M3 | R2 |
| 4 | Distinct Unread Styling | Unread items visually distinguished with circular indicator pip and subtle tinted background | M3 | R2 |
| 5 | Bulk Actions ("Mark All Read" & "Clear All") | UI buttons to mark all read or clear all notifications with immediate feedback | M3 | R2 |
| 6 | Backend Clear-All Endpoint | `DELETE /api/forum/notifications/:userId` deletes user notifications from DB, emits `notificationsCleared` | M1 | R2, R4 |
| 7 | Contextual Empty States | Clean empty illustrations/text ("No notifications" for All; "All caught up" for Unread) | M3 | R2 |
| 8 | Deep-Link Parameter Preservation | `App.jsx` preserves query params and hash when redirecting `/forum` to `/community` | M2 | R3 |
| 9 | Target Entity Deep-Linking | Clicking notification item navigates to post comment, chat thread, or tournament and closes menu | M2, M3 | R3 |
| 10 | Target Comment Highlighting | `PostCard.jsx` scrolls to and highlights target comment when `commentId` / `highlight` matches | M2 | R3 |
| 11 | Direct Message Deep-Linking | `Messages.jsx` parses `?userId=` search parameter to activate chat conversation | M2 | R3 |
| 12 | Real-Time Badge Increment (Menu Closed) | Incoming socket `newNotification` increments unread count and updates badge when dropdown is closed | M2 | R4 |
| 13 | Smooth Real-Time Append (Menu Open) | Incoming socket `newNotification` prepends to notification list without race condition or duplication | M2 | R4 |
| 14 | Cross-Tab Socket Synchronization | `notificationsMarkedRead` and `notificationsCleared` sync badge and list across all open tabs/devices | M1, M2 | R4 |
| 15 | Notification Database Indexing | Compound indexes `{ targetUserId: 1, time: -1 }` and `{ targetUserId: 1, read: 1 }` in `Notification.js` | M1 | Survey |
| 16 | Dedicated Backend Test Suite | `server/tests/notifications.test.js` covering all notification endpoints, auth checks, and sockets | M1 | Acceptance Criteria |
| 17 | Notification Hook Test Suite | `client/src/hooks/useNotifications.test.js` testing initial fetch, actions, and socket sync | M2 | Acceptance Criteria |
| 18 | Navbar Notification Test Suite | `client/src/components/Navbar.test.jsx` verifying bell click, badge clearing, tabs, and bulk actions | M3 | Acceptance Criteria |
| 19 | 100% Full-Suite Test & Lint Pass | Full client & server test suites pass (100%), 0 lint warnings/errors, client build passes | M4 | Quality Gate |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Notification Foundation & Sockets | Mongoose indexes, `PUT /read`, `DELETE /:userId`, socket events, `server/tests/notifications.test.js` | none | DONE |
| M2 | Frontend Notification Hook & Deep-Link Routing | `useNotifications.js`, `App.jsx` redirect preservation, `Messages.jsx` & `PostCard.jsx` deep links, `useNotifications.test.js` | M1 Contracts | DONE |
| M3 | Navbar Notification UI, Filtering & UX | Bell read-on-open handler, badge reset invariant, segmented tabs, bulk actions, unread pip/styling, `Navbar.test.jsx` | M2 | DONE |
| M4 | Full Regression Verification & Quality Gate | Full client (`vitest`) and server (`jest`) test suites pass 100%, 0 lint errors/warnings, production build | M1, M2, M3 | DONE |

## Interface Contracts

### Backend ↔ Frontend API Contract

#### 1. Fetch Notifications
- **Endpoint**: `GET /api/forum/notifications/:userId`
- **Headers**: `Authorization: Bearer <token>`
- **Response 200**:
  ```json
  [
    {
      "_id": "671fb2a0e28b1234567890ab",
      "targetUserId": "660000000000000000000001",
      "message": "string",
      "link": "string",
      "read": false,
      "time": "2026-10-28T00:30:00.000Z"
    }
  ]
  ```

#### 2. Mark All as Read
- **Endpoint**: `PUT /api/forum/notifications/:userId/read`
- **Headers**: `Authorization: Bearer <token>`
- **Response 200**:
  ```json
  {
    "success": true,
    "markedReadCount": 3,
    "unreadCount": 0
  }
  ```
- **Socket Emission**: `io.to(userId).emit("notificationsMarkedRead", { userId, unreadCount: 0 })`

#### 3. Clear All Notifications
- **Endpoint**: `DELETE /api/forum/notifications/:userId`
- **Headers**: `Authorization: Bearer <token>`
- **Response 200**:
  ```json
  {
    "success": true,
    "message": "All notifications cleared.",
    "deletedCount": 12
  }
  ```
- **Socket Emission**: `io.to(userId).emit("notificationsCleared", { userId })`

#### 4. Mark Single as Read
- **Endpoint**: `PUT /api/forum/notifications/single/:notifId/read`
- **Headers**: `Authorization: Bearer <token>`
- **Response 200**:
  ```json
  {
    "success": true,
    "notification": {
      "_id": "671fb2a0e28b1234567890ab",
      "read": true
    }
  }
  ```
- **Socket Emission**: `io.to(targetUserId).emit("notificationRead", { notifId, read: true })`

### Socket.io Event Contracts
- `newNotification` (Server $\to$ User Room): `{ _id, targetUserId, message, link, read: false, time }`
- `notificationsMarkedRead` (Server $\to$ User Room): `{ userId, unreadCount: 0 }`
- `notificationsCleared` (Server $\to$ User Room): `{ userId }`
- `notificationRead` (Server $\to$ User Room): `{ notifId, read: true }`

### Frontend Hook Contract (`useNotifications`)
```typescript
interface UseNotificationsReturn {
  notifications: Array<NotificationItem>;
  unreadCount: number;
  unreadMessages: number;
  loading: boolean;
  markAsRead: () => Promise<void>;
  markSingleAsRead: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}
```

## Code Layout
- `server/models/Notification.js`: Notification schema and compound indexes.
- `server/routes/forum.js`: Notification API routes and socket dispatch helper.
- `server/tests/notifications.test.js`: Integration tests for notification endpoints and socket events.
- `client/src/hooks/useNotifications.js`: Notification state, socket listeners, and API actions.
- `client/src/hooks/useNotifications.test.js`: Unit tests for `useNotifications` hook.
- `client/src/App.jsx`: Route table with query-preserving `/forum` redirect.
- `client/src/pages/Messages.jsx`: Chat thread selection via `?userId=` parameter.
- `client/src/components/forum/PostCard.jsx`: Comment highlighting via query and hash params.
- `client/src/components/Navbar.jsx`: Bell button, badge counter, dropdown menu, tabs, bulk actions, and item rendering.
- `client/src/components/Navbar.test.jsx`: Unit tests for Navbar notification interactions.
