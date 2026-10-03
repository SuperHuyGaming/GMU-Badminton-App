# Phase 4 Investigation Report: Client Routing, Admin Route Guards, Navigation/Layout, MUI Theme, Auth Context & Git Branch State

**Explorer**: Explorer 1 (Phase 4 — Admin Dashboard UI)  
**Date**: 2026-10-03  
**Working Directory**: `D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_m4_1`  
**Target Milestone**: Phase 4 — Admin Dashboard UI (`TournamentApprovals.jsx`)

---

## Executive Summary

Phase 4 requires creating the Admin Dashboard UI for tournament approvals, featuring a review queue for pending scraped tournaments, low-confidence highlighting, a split-screen raw-vs-AI reviewer modal, approval/rejection actions, edit capabilities, and manual entry creation.

This investigation verified all architectural prerequisites on the client:
1. **Client Routing & Route Guards**: The application uses React Router DOM v7 (`BrowserRouter`, `Routes`, `Route`) with lazy loading (`React.lazy`) and Framer Motion animated transitions. An `AdminRoute` component guard is already implemented in `client/src/App.jsx:79-83` that checks `user && user.role === "admin"`, redirecting unauthorized users to `/`.
2. **Navigation & Layout Linking**: The top sticky `Navbar.jsx` conditionally renders an "Admin Panel" button and mobile drawer item for `role === 'admin'`. There is currently no Admin Sidebar. We propose adding a direct link in `Navbar.jsx` (and mobile drawer) to `/admin/tournaments` alongside a shared sub-navigation tab bar between `/admin` (Moderation Hub) and `/admin/tournaments` (Tournament Approvals).
3. **Git Branch & Status**: The local repository is already checked out to `feature/tournament-admin-ui` and clean for source code. No branch switching is required.
4. **MUI Theme & Styling Guidelines**: MUI theme is centralized in `client/src/App.jsx:296-457`. Primary colors are Mason Deep Green (`#004d26` light, `#80e27e` dark), secondary Mason Gold (`#FFCC33`), with custom dark mode background (`#02120a`), glassmorphic `MuiPaper` (`backdropFilter: blur(20px)`), and snappy easing curves.
5. **Auth & Role Management**: `client/src/context/AuthContext.jsx` exposes `useAuth()`. The user object is stored in `localStorage` under key `"user"`, with tokens in `"accessToken"` and `"refreshToken"`. Admin authorization is verified via `user.role === 'admin'`. API calls use `client/src/utils/api.js` (`apiFetch`), and toast notifications use `react-hot-toast` (already mounted in `App.jsx`).

---

## Detailed Investigation Findings

### 1. Client Routing & Admin Route Guards

#### File: `client/src/App.jsx`
- **Routing Framework**: `react-router-dom` v7.14.2 (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useLocation`).
- **Route Guard**:
  ```javascript
  // client/src/App.jsx:79-83
  const AdminRoute = ({ children }) => {
      const { user } = useAuth();
      if (!user || user.role !== "admin") return <Navigate to="/" replace />;
      return children;
  };
  ```
  - **Behavior**: Verifies that `user` exists in `AuthContext` and that `user.role === "admin"`. If false or null, performs an immediate replace redirect to `"/"`.
  - **Reusability**: `AdminRoute` is modular and already wraps `<Admin />`. It can directly wrap our new `<TournamentApprovals />` component without any modification.

- **Lazy Loading & Animated Routes**:
  All page components are lazy-loaded at the top of `App.jsx`:
  ```javascript
  const Admin = React.lazy(() => import("./pages/Admin"));
  ```
  Inside `<AnimatedRoutes>` (lines 85-268), routes are wrapped in:
  - `<Suspense fallback={<Box ...><CircularProgress color="primary" /></Box>}>`
  - `<AnimatePresence mode="wait">`
  - Motion wrapper per element:
    ```javascript
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
        <Admin />
    </motion.div>
    ```

- **App Layout Container Wrapping**:
  In `client/src/App.jsx:494-506`:
  ```jsx
  <Container 
      maxWidth="lg" 
      sx={{ 
          mt: { xs: 2, sm: 3, md: 4 }, 
          mb: { xs: 4, sm: 6, md: 8 },
          px: { xs: 2, sm: 3, md: 4 }
      }}
  >
      {user && <PendingMatchesPrompt />}
      <AnimatedRoutes />
      {user && <PushNotificationPrompt />}
      <PWAInstallPrompt />
  </Container>
  ```
  *Recommendation for Phase 4*: Because `AnimatedRoutes` is nested within a `maxWidth="lg"` Container, `TournamentApprovals.jsx` should avoid unnecessary nested outer Containers, or use a Box with `width: '100%'` to utilize the full content width for table and split-screen viewing.

- **Recommended New Route Definition**:
  1. Add lazy import:
     ```javascript
     const TournamentApprovals = React.lazy(() => import("./pages/admin/TournamentApprovals"));
     ```
  2. Add route inside `<Routes>` in `App.jsx`:
     ```jsx
     <Route
         path="/admin/tournaments"
         element={
             <AdminRoute>
                 <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                     <TournamentApprovals />
                 </motion.div>
             </AdminRoute>
         }
     />
     ```

---

### 2. Navigation Components & Layout Linking

#### Files: `client/src/components/Navbar.jsx` and `client/src/components/MobileNav.jsx`

- **Current State of Navigation**:
  - The application uses `Navbar.jsx` (desktop top sticky bar + mobile slide-out drawer) and `MobileNav.jsx` (mobile bottom navigation bar for phones, hidden on `md` and above).
  - There is currently **no dedicated Admin Sidebar** component in the project.
  - The existing admin link in `Navbar.jsx` is rendered conditionally based on `user && user.role === "admin"`:
    - **Desktop Navbar (`Navbar.jsx:399-424`)**:
      ```jsx
      {user && user.role === "admin" && (
          <Button
              variant="contained"
              component={RouterLink}
              to="/admin"
              aria-current={location.pathname === "/admin" ? "page" : undefined}
              sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  ml: 2,
                  backgroundColor: "#FFCC33",
                  color: "#1a202c",
                  boxShadow: "none",
                  "&:hover": {
                      backgroundColor: "#e6b800",
                      boxShadow: "none",
                  },
                  "&:focus-visible": {
                      outline: "2px solid #ffffff",
                      outlineOffset: "2px",
                  },
              }}
          >
              Admin Panel
          </Button>
      )}
      ```
    - **Mobile Drawer (`Navbar.jsx:873-897`)**:
      ```jsx
      {user && user.role === "admin" && (
          <ListItemButton
              component={RouterLink}
              to="/admin"
              onClick={handleDrawerToggle}
              aria-current={location.pathname === "/admin" ? "page" : undefined}
              sx={{
                  textAlign: "center",
                  backgroundColor: location.pathname === "/admin" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 204, 51, 0.12)",
                  borderLeft: "4px solid #FFCC33",
              }}
          >
              <ListItemText
                  primaryTypographyProps={{ fontWeight: "bold", color: "#ffffff" }}
                  primary="Admin Panel"
              />
          </ListItemButton>
      )}
      ```

- **Recommended Integration Plan for Linking the New Page**:
  To provide an intuitive UX without cluttering the main navigation for non-admin users:
  1. **In `Navbar.jsx`**:
     - Add a link for "Tournament Approvals" (or an "Approvals" badge button) directly next to the "Admin Panel" button when `user.role === 'admin'`.
     - In the mobile drawer, add a matching `ListItemButton` for "Tournament Approvals" linking to `/admin/tournaments`.
  2. **Admin Sub-Navigation Bar / Tab Switcher**:
     - At the top of both `/admin` (`Admin.jsx`) and `/admin/tournaments` (`TournamentApprovals.jsx`), render a unified Admin Header / Tab switcher:
       - Tab 1: **Moderation & Community** (`/admin`)
       - Tab 2: **Tournament Approvals** (`/admin/tournaments`)
     - This gives the impression of a unified, professional Admin Suite without requiring a disruptive full-page layout refactor.

---

### 3. Git Branch & Status Verification

- Command: `git status ; git branch -a`
- Findings:
  - **Current active branch**: `feature/tournament-admin-ui`
  - **Branch status**: Ready and active on HEAD.
  - **Working tree**: Clean regarding application source files. Uncommitted changes only exist in `.agents/` metadata.
  - **Target PR branch**: Per repository rule `RULE[D:\GMU Fall 2026\GMU-Badminton-App\.agents\rules\pr_workflow.md]`, pull requests MUST target `develop`.
  - **Verdict**: No git branch checkout or creation is needed. Implementation can proceed directly on `feature/tournament-admin-ui`.

---

### 4. MUI Theme Configuration & Styling Guidelines

#### File: `client/src/App.jsx:296-457`
The theme is created via MUI `createTheme` inside `App.jsx` and reactive to the `mode` state (`light` or `dark`).

#### Palette Breakdown
| Token | Light Mode Value | Dark Mode Value | Semantic Role |
|---|---|---|---|
| `primary.main` | `#004d26` | `#80e27e` | Mason Deep Green / Neon Green |
| `primary.dark` | `#003319` | `#005c2e` | Darker green for borders/hover |
| `primary.light` | `#156536` | `#a5d6a7` | Soft green accent |
| `secondary.main` | `#FFCC33` | `#FFCC33` | Mason Gold / Yellow highlight |
| `secondary.contrastText` | `#002f17` | `#002f17` | Deep contrast text on gold |
| `error.main` | `#B00020` | `#ef5350` | Rejections, spam, high toxicity |
| `warning.main` | `#E65100` | `#ff9800` | Low confidence score (<80) |
| `info.main` | `#01579B` | `#29b6f6` | Scraped source metadata, links |
| `success.main` | `#1B5E20` | `#66bb6a` | Approvals, published status |
| `background.default` | `#f4f6f8` | `#02120a` | Ultra-deep forest green in dark mode |
| `background.paper` | `rgba(255, 255, 255, 0.75)` | `rgba(8, 33, 20, 0.75)` | Glassmorphic translucent surfaces |
| `text.primary` | `#1a202c` | `#ffffff` | Primary text |
| `text.secondary` | `#404040` | `rgba(255, 255, 255, 0.8)` | Secondary text / metadata |

#### Key Component Styles & Guidelines
1. **Glassmorphism**:
   - `MuiPaper` default style includes `backdropFilter: "blur(20px)"`, `WebkitBackdropFilter: "blur(20px)"`, and borders:
     `1px solid rgba(255, 255, 255, 0.4)` (light) / `rgba(255, 255, 255, 0.05)` (dark).
   - Use `<Paper sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>` for content cards and review panels.
2. **Buttons & Micro-interactions**:
   - Buttons have snappy `cubic-bezier(0.16, 1, 0.3, 1)` transitions and scale down to `0.95` on click (`&:active`).
   - Use `textTransform: "none"` and `fontWeight: "bold"`.
   - Action buttons:
     - Approve: `variant="contained"` with `color="success"` or `#004d26`
     - Reject: `variant="outlined"` with `color="error"`
     - Save Edits: `variant="outlined"` with `color="primary"`
3. **Confidence Score Highlighting**:
   - Scores < 80 must be highlighted to alert admins:
     - `<Chip label={`${confidenceScore}%`} color="warning" size="small" sx={{ fontWeight: "bold" }} />` or `color="error"` if < 60.
     - For high scores (>= 80): `color="success"`.
4. **Dialogs**:
   - Dialog papers automatically trigger `@keyframes dialogPop` (scale 0.9 -> 1.0 with 350ms spring curve).
   - Dialogs should have `PaperProps={{ sx: { borderRadius: 3 } }}`.

---

### 5. Auth & Role Context

#### File: `client/src/context/AuthContext.jsx`
- **State & Storage**:
  - `user`: State initialized from `localStorage.getItem("user")` (parsed JSON).
  - `accessToken`: In `localStorage.getItem("accessToken")`.
  - `refreshToken`: In `localStorage.getItem("refreshToken")`.
- **Role Verification**:
  - `const { user } = useAuth();`
  - Check: `user && user.role === "admin"`.
- **Authenticated Requests (`client/src/utils/api.js`)**:
  - `apiFetch(endpoint, options)` is the standard wrapper used across the app.
  - Automatically attaches `headers["Authorization"] = "Bearer " + token`.
  - Handles 401 refresh token flow automatically via `/api/auth/refreshtoken`.
  - On non-401 errors, throws an `Error` containing the server's `message` field.
  - Example usage:
    ```javascript
    const res = await apiFetch("/api/admin/tournaments/proposed");
    const data = await res.json();
    ```
- **Toast Notifications**:
  - `react-hot-toast` is installed and `<Toaster position="top-center" reverseOrder={false} />` is mounted at root in `client/src/App.jsx:492`.
  - Direct import:
    ```javascript
    import { toast } from "react-hot-toast";
    toast.success("Tournament approved and published!");
    toast.error(err.message || "Failed to approve tournament");
    ```

---

## File Blueprint Recommendations for Phase 4 Implementation

### 1. New File: `client/src/pages/admin/TournamentApprovals.jsx`
- **Review Queue**:
  - Fetch pending proposals on mount (`GET /api/admin/tournaments/proposed`).
  - Table / Card view showing: Tournament Name, Date, Location, Entry Fee, Confidence Score (colored Chip), Source, and "Review" button.
  - Empty state when queue has 0 items (e.g., using glassmorphic `Paper` matching `Admin.jsx:160`).
- **Split-Screen Reviewer Modal / Drawer**:
  - Dialog or split container opened when a proposal is selected.
  - **Left column (Raw Scraped Context)**:
    - `rawCaption` (collapsible or scrollable typography box).
    - `scrapedImageUrls` (flyer image preview with thumbnail fallback).
    - `sourceLinks` / `sourceUrl` (clickable external link chips).
  - **Right column (Editable AI Structured Data Form)**:
    - Text fields: `tournamentName`, `date` (date input), `location`, `entryFee`, `registrationLink`, `skillLevels` (chips or multi-select), `registrationDeadline`.
    - Form state pre-populated with AI data.
  - **Actions**:
    - "Save Edits" button (`PUT /api/admin/tournaments/:id`).
    - "Approve" button (`POST /api/admin/tournaments/approve/:id`).
    - "Reject" button (`POST /api/admin/tournaments/reject/:id` with optional rejection reason prompt).
- **Manual Entry Modal**:
  - Blank form button ("Manual Entry" / "Add Tournament").
  - Submits to create a new tournament entry or pending proposal.

### 2. Update File: `client/src/App.jsx`
- Add lazy import:
  `const TournamentApprovals = React.lazy(() => import("./pages/admin/TournamentApprovals"));`
- Add `<Route path="/admin/tournaments" element={<AdminRoute><motion.div ...><TournamentApprovals /></motion.div></AdminRoute>} />`

### 3. Update File: `client/src/components/Navbar.jsx`
- For admins (`user && user.role === 'admin'`), render links to both `/admin` (Moderation) and `/admin/tournaments` (Tournament Approvals) in desktop navbar and mobile drawer.

---

## Pre-Flight Verification Check
- `npm run lint` in `client/`: Exited with code 0 (clean, 0 warnings).
- `npm test` in `client/`: Exited with code 0 (12 test suites passed, 59 tests passed).
- Branch status: `feature/tournament-admin-ui` (clean and ready).
