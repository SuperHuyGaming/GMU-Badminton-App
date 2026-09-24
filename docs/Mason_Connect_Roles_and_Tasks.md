# Mason Badminton Connect: Master Engineering Backlog

Welcome to the **Mason Badminton Connect** task backlog! As our platform scales from a simple tournament scraper to a comprehensive social network, matchmaking hub, and utility app for the GMU badminton community, we are expanding our engineering tracks. 

Below are the 8 core roles, each with 10 highly specific, actionable tasks ready to be tackled.

---

## 1. Full Stack Engineer
**Focus:** Bridging the gap between the user interface and backend logic to deliver complete, end-to-end product features.

1. ✅ **Matchmaking Discovery UI & API:** Build a list-based UI allowing users to find local players matching their exact `searchRadius`, `skillLevel`, and `preferredPlay`, backed by a new REST endpoint.
2. ✅ **Real-Time Forum Updates:** Connect `Forum.jsx` to the existing Spring Boot WebSocket broker to stream new posts and comments instantly without hard page refreshes.
3. ✅ **Match Score Verification Modal:** Create an interface where Player A can report a match score. Player B receives an in-app prompt to "Accept" or "Dispute" before the database saves it.
4. ✅ **User Badges & Gamification:** Implement backend logic to automatically award badges (e.g., "Early Bird", "5-Win Streak") and build the React UI to display these SVG icons on player profiles.
5. ✅ **In-App Direct Messaging:** Build a persistent chat window using React Context and STOMP over WebSockets for secure 1-on-1 player communication.
6. ✅ **Tournament Bracket Generator:** Create a recursive UI component that visually maps out a 16-player knockout bracket, alongside backend logic to shuffle seeds.
7. ✅ **Notification Center:** Add a bell icon with a dropdown UI in the navigation bar, wired to a new `Notification` MongoDB collection.
8. ✅ **Friend / Follow System:** Implement a graph-like following system allowing users to subscribe to their friends' match activity and forum posts.
9. ✅ **Equipment Marketplace:** Build CRUD (Create, Read, Update, Delete) pages for users to list used rackets and shoes for sale to local players.
10. ✅ **Dynamic Activity Feed:** Create a unified homepage feed that chronologically interleaves forum posts, verified match results, and new marketplace listings.

---

## 2. Backend / Software Engineer
**Focus:** High-performance APIs, distributed systems, event streaming, and complex algorithmic logic in Java/Spring Boot & Node.js.

1. **ELO Rating Engine:** Implement a Kafka stream processor that listens to `match.verified` events and updates both players' ELO scores using mathematical rating algorithms.
2. ✅ **GMU RAC Court Scraper:** Write a scheduled Spring Boot service that scrapes the George Mason University recreation portal (or parses their API) for real-time open play court capacity.
3. **Push Notification Service:** Integrate Firebase Cloud Messaging (FCM) to dispatch native mobile push notifications when a user is challenged to a match.
4. ✅ **Geolocation Proximity API:** Leverage MongoDB `2dsphere` indexes to execute sub-millisecond `$near` queries for discovering players within a dynamic mile radius.
5. ✅ **Distributed Rate Limiting:** Prevent API abuse by implementing Bucket4j and Redis to enforce strict token-bucket rate limits on scraping endpoints.
6. ✅ **Change-Stream Dead Letter Queue (DLQ):** Build a fallback mechanism to catch, log, and retry MongoDB Change Stream events that fail to broadcast to Kafka.
7. **Search Aggregation Pipelines:** Write advanced MongoDB aggregation queries to power complex, multi-variable filtering on the Leaderboard.
8. ✅ **Idempotent API Design:** Use Redis distributed locks (`SETNX`) to ensure that rapidly double-clicking the "Report Score" button doesn't log the match twice.
9. ✅ **External Calendar Sync API:** Build an endpoint that dynamically generates a live CalDAV/`.ics` feed of a user's RSVP'd tournaments for Apple Calendar syncing.
10. **GDPR Data Export:** Create a secure, asynchronous endpoint that compiles a user's entire history (posts, matches, locations) into a downloadable ZIP file.

---

## 3. Front End Engineer
**Focus:** State management, responsive UI components, PWA features, and buttery-smooth browser performance.

1. **Offline-First PWA (Workbox):** Configure Vite PWA Service Workers to cache user profiles and recent forum posts so the app functions seamlessly in the RAC basement without cell service.
2. **Native Web Share & QR Codes:** Integrate the mobile OS Web Share API to easily text profiles to friends, and generate dynamic UI QR codes for in-person friending.
3. **Custom "Add to Homescreen" Flow:** Intercept the browser's default PWA install prompt and replace it with a branded, high-conversion modal explaining the app's benefits.
4. **Dark Mode / Light Mode Theming:** Extensively refine the Material-UI (MUI v6) palette, standardizing CSS variables to ensure perfect contrast in both themes.
5. **Virtualized Leaderboard Lists:** Implement `react-window` or `react-virtuoso` to render the Leaderboard efficiently without DOM lag, even with 5,000+ players.
6. **Skeleton Loading & Suspense:** Replace jarring spinners with elegant, animated Skeleton loaders mapped to exact component shapes during data fetching.
7. **Internationalization (i18n):** Integrate `react-i18next` to dynamically translate the UI into Vietnamese, Chinese, and Korean—popular demographics in the local badminton scene.
8. **3D Racket Viewer:** Embed a Three.js canvas in the Profile page allowing users to display an interactive, rotating 3D model of their primary racket.
9. **Swipe-to-Action Gestures:** Use Framer Motion to implement mobile-native swipe gestures (e.g., swipe right to "Like" a forum post, swipe left to "Hide").
10. **Real-time Typing Indicators:** Build the React UI state for displaying "Player X is typing..." bubbles inside the messaging component.

---

## 4. AI / Machine Learning Engineer
**Focus:** Data science, predictive modeling, natural language processing, and advanced analytics.

1. **Match Outcome Prediction:** Train a logistic regression or XGBoost model on historical ELO data to predict the win-probability percentages for upcoming matches.
2. **Spam & Toxicity Classifier:** Deploy an NLP model (e.g., BERT) to automatically flag and hide highly toxic language or spam bots in the community Forum.
3. **Smart Partner Recommendations:** Build a collaborative filtering recommendation engine suggesting ideal Doubles partners based on complementary playstyles and past synergy.
4. **Court Traffic Forecasting:** Use time-series forecasting (ARIMA/Prophet) on scraped RAC capacity data to predict exactly how busy the courts will be at 7 PM next Tuesday.
5. **Computer Vision Racket Classifier:** Train an image classification model to automatically identify a racket's make and model when a user uploads a photo to their profile.
6. **Chatbot Assistant (RAG):** Integrate an LLM with Retrieval-Augmented Generation to answer user questions like, "When is the next local B-level tournament?"
7. **Playstyle Clustering:** Apply K-Means clustering algorithms to group users into archetypes ("Aggressive Smasher", "Defensive Clearer") based on their self-reported stats and match history.
8. **Smurfing Anomaly Detection:** Flag suspicious accounts that consistently lose matches on purpose to artificially lower their ELO rating.
9. **Automated Match Highlight Timestamping:** Prototype a video processing script that analyzes uploaded game footage to automatically detect and timestamp winning smashes.
10. **Dynamic Notification Timing:** Analyze user activity logs to determine the optimal time of day to send engagement push notifications tailored to individual sleep/wake cycles.

---

## 5. UX / UI Designer
**Focus:** Wireframing, prototyping, user research, accessibility, and visual brand identity.

1. **User Onboarding Flow:** Design a high-fidelity Figma prototype for a beautiful, frictionless step-by-step account setup wizard.
2. **Match Screen Redesign:** Redesign the score-reporting modal to be highly intuitive, preventing user errors when submitting sets (e.g., 21-19, 22-20).
3. **Gamification Badges Art:** Digitally illustrate custom, visually distinct SVG badges for community achievements (Gold, Silver, Bronze tiers).
4. **Accessibility (a11y) Audit:** Conduct a comprehensive audit ensuring all text meets WCAG AAA color contrast ratios and UI elements are completely screen-reader friendly.
5. **Brand Identity & Splash Screens:** Design the official PWA app icon, favicon, and loading splash screens to establish a premium "Mason Badminton Connect" brand identity.
6. **Empty States & Error Pages:** Create delightful, custom graphics for empty states (e.g., "No Tournaments Found" or "404: Shuttlecock out of bounds").
7. **Micro-interactions:** Prototype and specify CSS bezier curves for highly satisfying button clicks, toggles, and modal animations.
8. **Responsive Grid Standardization:** Define exact layout grids, margins, and breakpoints for mobile, tablet, and desktop viewing.
9. **User Research & Heatmaps:** Analyze Hotjar or Microsoft Clarity heatmap data to identify where users are rage-clicking or dropping off on the Profile page.
10. **Custom Map Pins:** Design unique, branded map markers for the discovery map to differentiate between "Tournaments", "Open Play", and "Players".

---

## 6. Security Engineer
**Focus:** Penetration testing, encryption, vulnerability patching, and identity access management.

1. **OAuth2 & JWT Hardening:** Implement HttpOnly, secure cookies for JWT refresh tokens and enforce strict token rotation to prevent session hijacking.
2. **E2E Payload Encryption:** Integrate end-to-end encryption for the Direct Messaging API so that even database admins cannot read private player chats.
3. **Injection Prevention:** Audit all Express and Spring Boot routes to ensure strict validation, completely neutralizing NoSQL/SQL injection risks.
4. **XSS & CSRF Mitigation:** Configure strict Content Security Policy (CSP) headers and integrate anti-CSRF tokens for all state-changing API calls.
5. **Automated Penetration Testing:** Add OWASP ZAP (Zed Attack Proxy) into the GitHub Actions pipeline to automatically scan pull requests for known vulnerabilities.
6. **Role-Based Access Control (RBAC):** Architect a secure permission hierarchy separating `USER`, `MODERATOR`, and `ADMIN` roles across the backend endpoints.
7. **Secrets Management Migration:** Migrate hardcoded `.env` files to a secure vault like AWS Secrets Manager or HashiCorp Vault.
8. **PII Data Masking:** Ensure all Personally Identifiable Information (emails, exact GPS coordinates) is irreversibly masked in application logging and monitoring tools.
9. **Bot Detection:** Implement Cloudflare Turnstile or reCAPTCHA v3 on the registration and login routes to block automated credential stuffing attacks.
10. **Rate Limit Bypass Testing:** Actively attempt to circumvent the Bucket4j rate limiters using IP spoofing, and patch any discovered loopholes.

---

## 7. Software Test / QA Engineer
**Focus:** Quality assurance, automated test frameworks, release stability, and regression prevention.

1. **End-to-End (E2E) UI Testing:** Write comprehensive Playwright or Cypress test suites simulating a user registering, finding a tournament, and reporting a match.
2. **Backend Integration Testing:** Implement Testcontainers to spin up ephemeral MongoDB and Kafka Docker containers for highly reliable Spring Boot integration tests.
3. **Load & Stress Testing:** Use Gatling or JMeter to simulate 10,000 concurrent WebSocket connections, ensuring the forum real-time server doesn't crash under pressure.
4. **Chaos Engineering:** Intentionally terminate the Redis cache container during automated tests to verify the backend gracefully falls back to MongoDB.
5. **Cross-Browser Matrix Testing:** Configure BrowserStack or SauceLabs to run the React test suite automatically across Safari, Chrome, Firefox, and Edge.
6. **API Contract Testing:** Use Pact to write consumer-driven contract tests, ensuring the Node.js frontend and Java backend completely agree on JSON payload structures.
7. **Visual Regression Testing:** Integrate Storybook and Chromatic to automatically flag if a CSS change accidentally misaligns a UI button by 2 pixels.
8. **Mobile Device Lab Testing:** Run automated Appium scripts against real physical iOS and Android devices to ensure PWA mobile rendering is flawless.
9. **Accessibility Automation:** Hook `axe-core` into the CI pipeline to automatically fail pull requests that introduce HTML elements lacking ARIA labels.
10. **Test Coverage Enforcement:** Configure JaCoCo (Java) and Istanbul (Node) to block PR merges if code coverage drops below an 85% threshold.

---

## 8. DevOps / Platform Engineer
**Focus:** Cloud architecture, CI/CD automation, container orchestration, and site reliability.

1. **CI/CD Pipeline Overhaul:** Consolidate build pipelines into a unified GitHub Actions workflow that builds, lints, tests, and deploys both the Node and Java monorepos.
2. **Infrastructure as Code (IaC):** Write Terraform scripts to programmatically provision the Render databases, AWS S3 buckets, and Redis instances.
3. **Blue/Green Deployments:** Configure zero-downtime deployment strategies so users currently in the app aren't disconnected when a new backend version rolls out.
4. **Container Orchestration Migration:** Prepare the app for massive scale by writing Helm charts and Kubernetes manifests for the microservices.
5. **Prometheus & Grafana Stack:** Deploy a monitoring stack that scrapes JVM memory, garbage collection metrics, and Node event loop delays in real-time.
6. **Centralized Logging (ELK/Datadog):** Aggregate logs from all microservices into a single dashboard, injecting Trace IDs into headers to track a single request across servers.
7. **Automated Database Backups:** Write Cron jobs that snapshot the MongoDB Atlas cluster daily and archive the encrypted backups to AWS S3 Deep Archive.
8. **Cost Optimization & Auto-Scaling:** Implement dynamic auto-scaling rules that spin up additional Spring Boot replicas during the 6 PM - 10 PM RAC rush hour, and scale down at night.
9. **CDN Edge Caching:** Route all React static assets, images, and fonts through a Cloudflare CDN to ensure rapid loading speeds globally.
10. **Disaster Recovery Simulation:** Author detailed Runbooks and conduct "Game Days" to practice fully restoring the application from scratch in under 15 minutes after a simulated catastrophic failure.
