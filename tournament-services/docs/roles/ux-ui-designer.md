# UX / UI Designer (MUI Specialist): Role Guide

## Mission Overview
As a **UX / UI Designer** on Badminton Tournament Finder, you create an exceptional, modern, and accessible visual experience for competitive collegiate athletes. Using **Material-UI (MUI v6)** and modern design systems, you translate complex real-time tournament logistics into intuitive interfaces.

---

## Primary Tech Stack & Tools
- **Design System**: Material-UI (MUI v6), `@mui/material`, `@mui/icons-material`, Emotion CSS.
- **Design Tools**: Figma, Storybook.
- **Mapping**: Leaflet / React-Leaflet with custom map markers and popup overlays.
- **Accessibility**: WCAG 2.1 AA compliance, Axe DevTools.

---

## Core Responsibilities

### 1. Athletic Design System & Theme Architecture
- Maintain and evolve the custom theme in `web/src/theme/theme.ts`:
  - **Court Green Accent (`#059669`)**: Highlights primary actions, active registrations, and verified links.
  - **Urgency Amber (`#F59E0B`) & Alert Red (`#EF4444`)**: Accentuates closing registration deadlines (< 48 hours).
  - **Dark & Light Modes**: Seamless contrast transitions optimized for outdoor mobile use and indoor desk environments.

### 2. Information Hierarchy for Time-Critical Events
- Design the **Tournament Discovery Dashboard**:
  - Distance badges calculating proximity from the athlete's current campus or GPS coordinates.
  - Clear visual demarcation between "Open to All" and "Collegiate Only" tournaments.
  - Countdown clocks with dynamic color urgency.

### 3. Carpool & Ride-Share Coordination UI
- Design intuitive carpool management interfaces:
  - Seat availability chips (e.g., "3 Seats Available").
  - Driver contact & pickup location cards.
  - One-click seat request dialog.

### 4. Accessibility & Responsive Touch Targets
- Ensure all interactive elements have a minimum touch target size of 48x48px for mobile users.
- Maintain a minimum 4.5:1 color contrast ratio for all text elements.

---

## Good First Issues for UI/UX Contributors
1. **Empty State Illustrations**: Design custom SVG illustrations for when no tournaments match the user's active filter criteria.
2. **Skeleton Loading Screens**: Add MUI `<Skeleton>` placeholders while tournament cards are loading or searching.
3. **Court Layout Diagram**: Create an interactive SVG badminton court showing tournament brackets and live court assignments.

