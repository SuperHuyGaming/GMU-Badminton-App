# Developer & Agent Handover Document

> **Last Updated**: October 26, 2026 (22:33 EDT)  
> **Active Working Branch**: `develop`  
> **Target Branch for Features**: `develop`  
> **Production Branch**: `main` (Strictly protected)

---

## 1. Golden Rules & Invariants

> [!CAUTION]
> **STRICT INVARIANT: NEVER MERGE TO `main` UNLESS EXPLICITLY DIRECTED BY THE USER.**
> - All new features and bug fixes MUST target `develop`.
> - Render **Staging** auto-deploys from `develop` (`gmu-social-api-staging.onrender.com` & `gmu-frontend-staging`).
> - Render **Production** auto-deploys from `main` (`gmu-social-api` & `gmu-frontend`).
> - Only promote `develop` → `main` when the user explicitly instructs to deploy to production.
> - Preserved in `.agents/rules/pr_workflow.md`.

---

## 2. Recent Work & Merged Pull Requests

### PR #152: PR Workflow Invariant Rule
- Created `.agents/rules/pr_workflow.md` specifying that all autonomous agents and developers must target `develop` and never push or merge directly to `main`.

### PR #153: Reverted Accidental Main Merge
- Cleanly reverted commit `33457fe` on `main` to ensure production was fully restored to its clean base state.

### PR #154: Community Hub UI Simplification & Mobile Messages Polish
- **Removed Duplicate `Create New Post` Button**: Eliminated top button in favor of the inline Facebook-style card composer (*"What's on your mind, [User]?"*).
- **Removed Redundant Tabs Bar**: Removed the `For You | Top | Latest | Saved` `<Tabs>` row; default feed state cleanly displays latest activity.
- **Consolidated Filter Rows**: Condensed 4 stacked rows down to 2 streamlined rows: a Search & Controls toolbar, and a unified horizontal swipeable Category & Trending Topic strip (`data-testid="trending-tags-strip"`).
- **Timezone-Aware Date Range (`tzOffset`)**: In `server/utils/dateRange.js`, date calculations now accept client timezone offset (`tzOffset`) so local EDT calendar days (*Today*, *This Week*, *This Month*) are accurate regardless of Render's UTC server clock.
- **Case-Insensitive Hashtag Search**: In `server/routes/feed.js` and `server/routes/forum.js`, updated tag query to regex `^#?tag$` (`'i'`) so hashtags like `#stringing` match seamlessly.
- **401 Match Polling Guard**: Guarded in `client/src/components/PendingMatchesPrompt.jsx` to prevent runaway polling loops on expired tokens.
- **Eliminated Mobile Message Input Double Border**: In `client/src/pages/Messages.jsx` and `client/src/index.css`, stripped native user-agent borders, outlines, and box-shadows on `.MuiInputBase-inputMultiline` and inner `<textarea>`, removing the inner rectangular border inside the rounded pill input on mobile WebKit/iOS Safari.

### PR #155: Comments Overhaul (Backend 500 Fix, 404/Auth Fix & Facebook UI)
- **Resolved 500 Internal Server Error (`GET /api/forum/:postId/comments`)**: In `server/routes/forum.js`, `findPostByIdOrActivityFeed` returns a Promise. Fixed call to pass `{ lean: true }` instead of chaining `.lean()`, which previously threw `TypeError: .lean is not a function`.
- **Resolved 404 & 401 Auth Errors (`POST //api/forum/:postId/comments`)**:
  - Replaced raw `fetch` calls in `PostCommentsInline.jsx`, `CommentBubble.jsx`, and `ReplyBubble.jsx` with the centralized `apiFetch` utility (`client/src/utils/api.js`).
  - Fixed double-slash URLs caused by trailing slashes in `VITE_API_URL`.
  - Fixed token authentication by attaching valid `Bearer ${accessToken}` instead of querying `localStorage.getItem("token")` (which was null).
- **Redesigned Facebook-Style Comments UI**:
  - Empty state: Centered, friendly card with chat bubble icon (*"No comments yet — Be the first to share your thoughts or rally!"*).
  - Speech bubbles: Soft rounded 18px/16px speech bubbles with `action.hover` background, clear author badge chips (Exec, OP, TD), and relative timestamps.
  - Composer: Multiline auto-expanding pill input with smooth focus outlines, `@mention` autocomplete, and active press send/reply button.
- **Unit Tests Added**: Added `GET /api/forum/:postId/comments` regression test in `server/tests/communityPhase8.test.js`.

---

## 3. Key Architecture & Pitfalls to Avoid

### 1. Centralized API Fetch (`apiFetch`)
- **NEVER** write raw `fetch(`${import.meta.env.VITE_API_URL}${endpoint}`)`.
- **ALWAYS** use `apiFetch(endpoint, options)` from `client/src/utils/api.js`. It handles:
  - Base URL slash sanitization
  - Automatic `Authorization: Bearer <accessToken>` header
  - Silent 401 token refresh queue via `refreshToken`

### 2. Timezone Handling
- Posts are stored in MongoDB in UTC timestamps.
- Render servers run in UTC (`UTC+0`).
- Users are often in US Eastern (`EDT`, `UTC-4`).
- Whenever computing calendar boundaries (*Today*, *This Week*), always pass `tzOffset: new Date().getTimezoneOffset()` from the client to the backend.

### 3. Mongoose Helper `findPostByIdOrActivityFeed`
- Function signature: `findPostByIdOrActivityFeed(postId, options = {})`
- It is `async` and returns a resolved document or `null`.
- To get a plain object, pass `{ lean: true }`. Never do `findPostByIdOrActivityFeed(id).lean()`.

### 4. Windows Line Endings (CRLF vs LF)
- The codebase uses CRLF on Windows.
- When performing string replacements or scripts, always normalize `\r\n` and `\n` to prevent target mismatches.

---

## 4. Verification & Testing Commands

### Backend Tests
```bash
cd server
npm test -- tests/communityPhase8.test.js
npm test -- tests/communityPhase2.test.js
```

### Frontend Tests, Lint & Build
```bash
cd client
npx vitest run src/components/PostCard.test.jsx src/pages/Forum.test.jsx src/pages/Forum.accessibility.test.jsx
npm run lint
npm run build
```

---

## 5. Next Steps for Next Developer / Agent
1. **Preview on Staging**: Verify Staging build once deployed on `https://gmu-social-api-staging.onrender.com`.
2. **Production Release**: When the user explicitly requests to deploy to production, create a PR from `develop` into `main` and merge.
