# Mason Badminton Connect: Roles & Tasks

Welcome to the **Mason Badminton Connect** project! This document outlines the core engineering roles and the backlog of actionable tasks needed to evolve this platform into a fully-fledged social network and utility app for the GMU badminton community.

---

## 1. Fullstack / Product Engineer
**Focus:** Building social features, player matchmaking, and seamless user experiences across the React frontend and Node/Java APIs.

### Tasks:
- [ ] **Task 1: Matchmaking & Player Discovery UI**
  Build a Tinder-style or list-based UI in React where users can discover other players who match their `searchRadius`, `skillLevel`, and `preferredPlay`. 
- [ ] **Task 2: Real-Time Forum Updates**
  The `Forum.jsx` page currently requires a hard refresh. Connect it to the existing Spring Boot WebSocket broker to stream new posts and comments in real-time.
- [ ] **Task 3: Match Verification System**
  Create a modal where Player A can report a match score against Player B. Send a notification to Player B to "Accept" or "Dispute" the score before it impacts their ELO.
- [ ] **Task 4: User Badges & Gamification UI**
  Update the Profile page to elegantly display unlocked badges (e.g., "Early Bird", "5-Win Streak", "Tournament Champion") using custom SVG icons.

---

## 2. Backend / Systems Engineer
**Focus:** Core business logic, mathematical algorithms (ELO), third-party scrapers, and data integrity.

### Tasks:
- [ ] **Task 1: ELO Rating Engine**
  Implement an asynchronous Kafka consumer that listens to `match.verified` events and calculates new ELO ratings for both players using standard chess ELO algorithms, then updates MongoDB.
- [ ] **Task 2: GMU RAC Court Scraper**
  Write a scheduled Java/Python service that scrapes the George Mason University recreation portal (or parses their API) to determine real-time open play court availability and broadcasts it.
- [ ] **Task 3: Push Notification Service**
  Integrate Firebase Cloud Messaging (FCM) into the Spring Boot backend to send mobile push notifications when a user receives a match challenge or when their favorite tournament opens registration.
- [ ] **Task 4: Geolocation Auto-Update API**
  Create a low-latency endpoint that accepts background GPS pings from the mobile PWA to update a user's geo-coordinates (using MongoDB `2dsphere`) to trigger local proximity alerts.

---

## 3. Frontend PWA / Mobile Engineer
**Focus:** Making the web app feel exactly like a native iOS/Android application.

### Tasks:
- [ ] **Task 1: Offline First (Workbox)**
  Configure Vite PWA Service Workers to aggressively cache the user's profile, settings, and the first page of the Forum and Tournaments so the app opens instantly even in the RAC basement with zero cell service.
- [ ] **Task 2: Native Share API & QR Codes**
  Add a "Share Profile" button that leverages the mobile OS's native Web Share API (iMessage, WhatsApp). Generate a dynamic QR code for easy in-person friending on the courts.
- [ ] **Task 3: Custom "Add to Homescreen" UX**
  Intercept the browser's default PWA install prompt and replace it with a branded, high-conversion animated modal explaining the benefits of installing the app.

---

## 4. Platform / DevOps Engineer
**Focus:** Cloud infrastructure, monitoring, scaling, and CI/CD pipelines.

### Tasks:
- [ ] **Task 1: Grafana / Prometheus Observability**
  Expose custom Micrometer metrics in the Java backend (e.g., `match.reported.count`, `scraper.errors.total`) and build a Grafana dashboard for the admin team.
- [ ] **Task 2: Redis Session & Leaderboard Caching**
  The `Leaderboard.jsx` page queries MongoDB on every load. Implement a Redis cache (`@Cacheable`) that stores the Top 100 players and invalidates only when an ELO score changes.
- [ ] **Task 3: GitHub Actions Auto-Deploy for Java**
  Currently, only the Node frontend auto-deploys to Render. Write a GitHub Action pipeline that packages the Java `core-service` into a Docker image and pushes it to a cloud registry on `main` branch merges.
