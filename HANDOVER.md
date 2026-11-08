# 🏸 GMU Badminton Connect — Workstation Handover & Sync Note
**Target Branch:** `develop`  
**Latest Verification:** 100% Green (Client: 818/818 tests PASS, Server: 1,099/1,099 tests PASS, ESLint: 0 warnings/errors)  
**Date:** November 8, 2026  

---

## 🚀 Quick Start on New PC

To synchronize and start development on this machine:

```bash
# 1. Ensure you are on the develop branch and fetch latest commits
git checkout develop
git pull origin develop

# 2. Install dependencies (if needed)
cd client && npm install
cd ../server && npm install

# 3. Run test suites to verify local environment health
cd ../client && npm test -- --run
cd ../server && npm test

# 4. Start local development servers
# Terminal 1 (Backend API & Socket.IO):
cd server && npm run dev

# Terminal 2 (Frontend Vite dev server):
cd client && npm run dev
```

---

## 🔒 Mandatory Agent Workflow & Invariants (DO NOT SKIP)

1. **Strict Branch Protection (`pr_workflow.md`)**:
   - **NEVER** commit or push directly to `develop` or `main`.
   - **NEVER** target PRs to `main` without explicit user request.
   - Always branch off `develop` (e.g. `feature/...`, `fix/...`, `docs/...`).
   - Create PRs targeting `develop`.
   - Post QA bot comment: `gh pr comment <PR#> --body "🤖 **Automated QA Pipeline:** ..."`
   - Invoke `qa_engineer` subagent for test verification and PR review before squash-merging.

2. **UI Content Standards (`ui_content_standards.md`)**:
   - **No AI Badge Clutter**: No multi-emoji/all-caps banners.
   - **No Empty Metric Card Walls**: Zero counters softened to subtle secondary text.
   - **Premier UX (Start.gg / Luma style)**: Smooth card hover elevation (`translateY(-4px)`), title highlight, and image hover zoom (`scale(1.04)`).
   - **Keyboard Search**: Support `/` and `Ctrl+K` / `Cmd+K` focus with shortcut pills.
   - **Public Scope**: Inclusive copy ("Open Tournament", "Community Event") rather than exclusionary collegiate wording.
   - **Navbar Purity**: Top navbar reserved for `Dashboard`, `Community`, `Players`, `Tournaments`. Support tools belong in bottom-right FAB / avatar menu.
   - **Non-Blocking Feedback Dock**: Minimized pill and 1-click screen capture with JPEG compression.
   - **Comment Cleanliness**: Essential actions only (`Delete`, `Report`), comments cached in memory to prevent empty-stub overwrite.

---

## 📦 Recent Sprints & PRs Merged to `develop`

| PR # | Branch | Title | Key Highlights |
|:---:|:---|:---|:---|
| **[#196](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/196)** | `feature/mobile-messaging-ux` | `feat(chat): mobile UI improvements for messages and floating dock` | Standalone `/messages` mobile overhaul (Active Now carousel, All/Unread filter pills, Framer Motion slide navigation with history integration, dynamic 👍 / Send composer, tap-to-inspect sheet) & global floating chat edge-to-edge mobile bottom sheet with compact launcher. |
| **[#195](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/195)** | `feature/search-filters-controls` | `feat(ui): add universal keyboard search focus, shortcut pills, and filter reset controls` | Universal `/` and `Ctrl+K`/`Cmd+K` keyboard shortcuts with capture-phase in-page priority, shortcut pills, and dedicated "Reset All Filters" actions. |
| **[#194](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/194)** | `feature/visual-cards-styling` | `feat(ui): align card micro-interactions, clean metric walls, and disable gamification badges` | Disabled synthetic gamification badges, replaced 0-count metric walls with clean subtle text, and added `-4px` hover elevation, title highlight, and image hover zoom (`scale(1.04)`). |
| **[#193](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/193)** | `feature/feedback-admin-polish` | `feat(feedback): support screen capture, error prefill, and admin flyer auto-save` | 1-click screen capture (`html2canvas` / canvas stream with JPEG compression), error diagnostic prefill in `FeedbackContext`, and admin flyer auto-save on approval. |
| **[#192](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/192)** | `feature/public-scope-nav-align` | `feat(ui): align public scope copy and relocate feedback FAB to bottom-right` | Replaced exclusionary collegiate copy with inclusive "Open Tournament" / "Community Event" fallbacks; repositioned support FAB to bottom-right adjacent to messenger launcher. |
| **[#191](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/191)** | `feature/chat-popup-polish-and-focus-fix` | `feat(chat): improve chat popup UX, remove global rectangular focus outline, and align post reactions` | Polished Facebook chat window focus styles, reaction alignment, and modal backdrop stacking. |
| **[#190](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/190)** | `feature/theme-smoothness-polish` | `feat(theme): smoothness and theme contrast pass` | Deep green `#02120a` theme contrast, glassmorphism borders, and spring physics. |
| **[#189](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/189)** | `feature/illustration-redesign` | `feat(ui): premier illustration redesign suite` | Custom vector SVG court art for 404 page, landing hero, and empty state visuals. |
| **[#188](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/188)** | `feature/facebook-multi-chat` | `feat(chat): facebook-style multi-window chat system` | Up to 3 docked popup windows side-by-side and up to 5 circular chat heads with dismiss `x`. |
| **[#187](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/187)** | `feature/players-discovery-polish` | `feat(players): instant directory on mount with live search and 1-click chat` | Immediate roster load on mount without filter preconditions, live debounce search, and 1-click direct chat buttons. |
| **[#186](https://github.com/SuperHuyGaming/GMU-Badminton-App/pull/186)** | `feature/marketplace-retirement` | `feat(nav): retire Marketplace and redirect to Community` | Redirected `/marketplace` route to `/community` and removed all navigation references. |

---

## 🎯 Next Recommended Work & Backlog

Consult [`PLAN.md`](./PLAN.md) and [`PROJECT.md`](./PROJECT.md) for full architecture details:
1. **Real-time Mobile Testing & Push Notifications**:
   - Validate Web Push notifications (`client/src/components/PushNotificationPrompt.jsx`) on mobile devices.
   - Verify PWA offline caching behavior with service worker precache.
2. **Tournament Bracket Interactive Controls**:
   - Deep dive into hardware-accelerated single-elimination tournament bracket view on touch screens.
3. **Court Queue Real-Time Updates**:
   - Explore court queue viewer socket updates and check-in flow on small screen viewports.

---

*This document is maintained to ensure frictionless context transfer between devices.*
