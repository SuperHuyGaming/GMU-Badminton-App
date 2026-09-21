# Mason Badminton Connect - Official Wiki

Welcome to the Mason Badminton Connect Developer Wiki! This document serves as the central hub for understanding our vision, how the system is built, and how you can get your local environment running in minutes.

---

## 🌟 1. Project Vision
**Mason Badminton Connect** is an independent, student-run initiative designed to unite the George Mason University badminton community. 
Before this app, players had to rely on fragmented Discord servers, Instagram DMs, and walking all the way to the RAC just to see if the courts were full. 

**Our Goal:** To build a premium, gamified, and real-time ecosystem where players can:
1. **Find matches** and track their Elo rankings globally.
2. **Chat in real-time** with typing indicators and presence tracking.
3. **Discover Tournaments** automatically through our AI web scraper.
4. **Check RAC Availability** without leaving their dorms.

---

## 🏗️ 2. Architecture Overview
This project is structured as a **Monorepo** containing a suite of microservices. We chose this architecture to handle heavy AI scraping and real-time WebSockets without crashing the main UI.

### The Stack
- **Frontend (`/client`)**: React 19, Vite, Material-UI (MUI v6), Framer Motion. 
  - *Why?* For a blazing-fast, app-like experience with premium animations.
- **Backend API (`/server`)**: Node.js, Express, Socket.IO.
  - *Why?* Node is perfect for handling thousands of concurrent WebSocket chat connections.
- **Tournament Core (`/tournament-services/core-service`)**: Java Spring Boot.
  - *Why?* Java provides enterprise-grade stability and strict typing for processing our AI's heavy data streams.
- **AI Scraper (`/tournament-services/scraper-service`)**: Python, Playwright, GPT-4o.
  - *Why?* Python is the undisputed king of web scraping and AI integration. 
- **Infrastructure**: MongoDB (Database), Redis (Caching/Rate Limiting), Apache Kafka (Event Streaming between microservices).

---

## 💻 3. Local Environment Setup

We have containerized the entire 7-service architecture using Docker. You do not need to install Java, Python, or Redis on your machine.

### Prerequisites
1. **Docker Desktop**: Must be installed and running.
2. **Node.js**: Installed locally for frontend hot-reloading.

### Booting the Matrix
1. Clone the repository and open your terminal.
2. Run the master Docker command:
   ```bash
   docker compose up --build -d
   ```
3. Docker will now spin up MongoDB, Redis, Kafka, the Node Server, the Java Server, and the Python AI in the background.

### Frontend Hot-Reloading (Pro Workflow)
You don't want to rebuild Docker every time you change a CSS color. To get instant hot-reloading:
1. Leave Docker running in the background.
2. Open a *new* terminal window.
3. Run:
   ```bash
   cd client
   npm install --legacy-peer-deps
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`. Any changes you make to the React code will instantly appear on your screen!

---

## 🤝 4. How to Contribute
Check out the `.github/ISSUE_TEMPLATE` folder to report bugs or request features. If you want to grab an active task, check our `tournament-services/docs/project_roles_tasks.md` file for a list of awesome jobs across all tech stacks!
