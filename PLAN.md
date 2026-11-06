# GMU Badminton Connect — Comprehensive Sprint Plan
**Version:** 1.0.0  
**Target Branch:** `develop` (⚠️ NEVER push to or merge into `main`)  
**Base Commit:** `87cd8ba`  
**Purpose:** Implementation guide for the next session to save tokens and execute seamlessly.

---

## 🎯 Executive Sprint Summary

This sprint delivers a premier user experience update modeled after modern social platforms (Facebook/Meta design patterns):
1. **Facebook-Style Multi-Chat System**: Replaces the single floating chat dock with up to **3 docked chat popup windows** side-by-side at the bottom-right and up to **5 circular chat heads (bubbles)** stacked vertically on the right edge with `'x'` dismiss buttons.
2. **Marketplace Retirement**: Hides Marketplace navigation and redirects `/marketplace` to `/community` (no gear selling).
3. **Players Discovery Overhaul (`/matchmaking`)**: Loads full member directory immediately on mount with instant live search and a 1-click "Chat" button on every player card that triggers the floating chat popup.
4. **Site Illustration Redesigns**: Redesigns the 404 court graphic, Landing page hero illustration, and empty state visuals with premier modern vector SVG art.
5. **Theme Contrast & Polish**: Preserves the signature deep green `#02120a` aesthetic while elevating contrast, glassmorphism, and borders.
6. **Comprehensive Smoothness**: Adds spring physics to chat heads, zero-layout-shift skeletons, and fluid micro-interactions.

---

## 🏗️ Architectural Specifications

### 1. Facebook-Style Multi-Chat System (`client/src/components/FloatingChatDock.jsx`)

#### A. State Architecture
```javascript
// Open popup windows (max 3)
const [activeChats, setActiveChats] = useState([]); // [{ _id, name, avatarUrl, isMinimized }]

// Floating chat head bubbles (max 5)
const [chatBubbles, setChatBubbles] = useState([]); // [{ _id, name, avatarUrl, unreadCount }]
```

#### B. Interaction Rules
1. **Opening a Chat**:
   - Triggered via:
     - Global custom event `window.dispatchEvent(new CustomEvent('openChatWithUser', { detail: user }))`
     - Clicking "Chat" on any player card, post author avatar, or member directory
     - Clicking a circular chat head bubble
   - **Behavior**:
     - If the user is already in `activeChats`, expand/focus their popup window.
     - If `activeChats.length < 3`, add the user to `activeChats` (docked at bottom right).
     - If `activeChats.length === 3`, move the least-recently-active chat into `chatBubbles` (if not already there) and open the new chat as the active popup.
     - Ensure the user is also registered in `chatBubbles` (up to 5 max, dropping the oldest inactive bubble if count > 5).
2. **Minimizing a Popup**:
   - Clicking `-` on the popup header collapses the window to just its title bar (328px wide × 40px high) or minimizes it into its chat head bubble on the right edge.
3. **Closing a Popup (`✕`)**:
   - Closes the popup window from `activeChats`. The chat head remains in `chatBubbles` for quick re-access unless dismissed.
4. **Dismissing a Chat Head (`x`)**:
   - Hovering or tapping a circular chat head reveals a small circular `x` badge.
   - Clicking `x` completely removes that user from `chatBubbles` (and from `activeChats` if currently open).
5. **Mobile Viewport Adaptation (<600px)**:
   - On screens `<600px`, floating multi-window popups collapse into a single slide-up bottom sheet or full-width drawer when a chat is opened, preventing screen clipping.

#### C. Layout & Dimensions
- **Docked Popup Windows**:
  - Width: `328px`
  - Height: `420px` (or `40px` when collapsed)
  - Bottom: `0px`
  - Right offset: `index * 340px + 72px` (positioned neatly to the left of the vertical bubble rail)
  - Dark mode background: `rgba(10, 30, 20, 0.95)` with `backdropFilter: 'blur(16px)'` and `1px solid rgba(255,255,255,0.15)`
  - Header: 44px height, avatar (32px), full name, online presence badge, minimize `-` button, close `✕` button
- **Vertical Chat Head Rail**:
  - Right: `16px`
  - Bottom: `24px`
  - Bubbles: Circular avatars (48px × 48px) with 2px border, elevation 4, stacked vertically with `8px` gap (max 5 bubbles)
  - Hover: Reveals floating close `x` icon (18px circle, top-left or top-right)

---

### 2. Marketplace Retirement (`client/src/pages/Marketplace.jsx` & `Navbar.jsx`)

1. **Route Redirect**:
   - In `client/src/App.jsx`, update the `/marketplace` route:
     ```jsx
     <Route path="/marketplace" element={<Navigate to="/community" replace />} />
     ```
2. **Navbar & Shortcuts**:
   - Remove "Marketplace" link from `client/src/components/Navbar.jsx`.
   - Remove any Marketplace shortcut items from `Forum.jsx` left rail.

---

### 3. Players Discovery Overhaul (`client/src/pages/CommunityDirectory.jsx`)

1. **Immediate Roster Rendering**:
   - Eliminate the requirement for `submittedQuery` or `skillFilter !== 'All'` to view the player directory.
   - Fetch and display the full active player directory grid on initial page load.
2. **Instant Live Search**:
   - Debounce search input by 250ms and filter results instantly as the user types without requiring `Enter`.
3. **Direct 1-Click Chat**:
   - Every player card in both the directory grid and search suggestions includes a prominent "Chat" button.
   - Clicking "Chat" dispatches `openChatWithUser` with `{ _id, name, avatarUrl }`, immediately popping open their Facebook-style chat window.

---

### 4. Site Illustration Redesign

1. **404 Page (`client/src/pages/NotFound.jsx`)**:
   - Replace wireframe neon illustration with a premier vector SVG badminton court:
     - Isometric perspective with warm court lighting.
     - Authentic shuttlecock with feather texture and cork base resting just outside the tramline.
     - High contrast, responsive viewBox (`0 0 800 500`), crisp mobile presentation.
2. **Landing Page Hero (`client/src/pages/Landing.jsx`)**:
   - Modernize the landing hero vector art to depict dynamic badminton play (racket trajectory, clean geometric shuttlecock, Mason green and gold accents).
3. **Empty States (`client/src/components/EmptyState.jsx`)**:
   - Create a reusable `EmptyState` component with bespoke vector graphics for:
     - No search results ("No players on court")
     - No upcoming tournaments ("No events scheduled")
     - Empty buddy list ("Find hitting partners")

---

### 5. Theme Contrast & UI Smoothness

1. **Theme Contrast**:
   - Retain deep green `#02120a` dark background.
   - Enhance readability with `rgba(255, 255, 255, 0.08)` borders, high-contrast text (`#f8fafc`), and distinct card surfaces (`rgba(13, 38, 25, 0.85)`).
2. **Framer Motion Micro-Interactions**:
   - Spring physics on chat heads: `transition: { type: "spring", stiffness: 350, damping: 25 }`.
   - Smooth popup slide-up: `initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}`.
   - Card hover elevation: `transform: translateY(-4px)`, `boxShadow: '0 12px 28px rgba(0,0,0,0.25)'`.

---

## 📋 Step-by-Step Implementation Roadmap

```
├── Step 1: Marketplace Retirement & Navigation Cleanup (feature/marketplace-retirement)
├── Step 2: Player Discovery Instant Directory & 1-Click Chat (feature/players-discovery-polish)
├── Step 3: Facebook-Style Multi-Chat System (feature/facebook-multi-chat)
├── Step 4: Illustration Redesign Suite (feature/illustration-redesign)
├── Step 5: Smoothness & Theme Contrast Pass (feature/theme-smoothness-polish)
└── Step 6: Full Regression & Two-Bots E2E Verification
```

### Detailed Steps:

#### Step 1: Marketplace Retirement
- **Files**: `client/src/App.jsx`, `client/src/components/Navbar.jsx`, `client/src/pages/Forum.jsx`
- **Actions**:
  - Redirect `/marketplace` to `/community`.
  - Remove all navbar and sidebar references to Marketplace.
- **Verification**: `npm --prefix client test`, `npm --prefix client run lint`.

#### Step 2: Player Discovery Instant Directory & 1-Click Chat
- **Files**: `client/src/pages/CommunityDirectory.jsx`
- **Actions**:
  - Update `useEffect` to fetch initial directory on mount without search filter precondition.
  - Implement instant debounced live search.
  - Add "Chat" button with `openChatWithUser` dispatch on all cards.
- **Verification**: `npm --prefix client test -- CommunityDirectory`.

#### Step 3: Facebook-Style Multi-Chat System
- **Files**: `client/src/components/FloatingChatDock.jsx`, `client/src/components/FloatingChatPopup.jsx` (new), `client/src/components/FloatingChatBubble.jsx` (new)
- **Actions**:
  - Refactor dock into a Multi-Chat Manager.
  - Render up to 3 `FloatingChatPopup` windows side-by-side.
  - Render up to 5 `FloatingChatBubble` heads with dismiss `x`.
  - Bind Socket.IO `privateMessage` to update specific active popups or chat heads.
  - Mobile responsive single-sheet adapter.
- **Verification**: Unit tests in `FloatingChatDock.test.jsx`, `npm --prefix test-automation run twobots`.

#### Step 4: Illustration Redesign Suite
- **Files**: `client/src/pages/NotFound.jsx`, `client/src/pages/Landing.jsx`, `client/src/components/EmptyState.jsx`
- **Actions**:
  - Create modern, authentic vector SVG badminton illustrations.
  - Ensure responsive scaling across mobile and desktop.
- **Verification**: Visual inspection, `npm --prefix client run build`.

#### Step 5: Smoothness & Theme Contrast Pass
- **Files**: `client/src/App.jsx`, `client/src/components/PostCard.jsx`, `client/src/pages/Forum.jsx`
- **Actions**:
  - Refine theme paper colors and glassmorphism borders.
  - Add spring animations and hover micro-interactions.
- **Verification**: `npm --prefix client run lint`, `npm --prefix client run build`.

#### Step 6: Verification & QA
- **Commands**:
  - Server: `npm --prefix server test` (77 suites) and `npm --prefix server run lint`
  - Client: `npm --prefix client test` (58 files), `npm --prefix client run lint`, `npm --prefix client run build`
  - Playwright E2E: `npm --prefix client run test:e2e` (15 tests)
  - Two-Bots Simulation: `npm --prefix test-automation run twobots` (67 tests)
  - API Suite: `npm --prefix test-automation test` (27 tests)

---

## 🔒 Crucial Invariants & Rules
1. **Target `develop` ONLY.** Never touch `main`.
2. **NO AI ATTRIBUTION ANYWHERE:** No "Co-Authored-By", no "Generated with", and never mention AI or bots in commit messages, PR titles, or bodies.
3. **Line Endings:** Preserve existing file line endings (CRLF).
4. **Lint Invariant:** `--max-warnings 0` for client and server.
