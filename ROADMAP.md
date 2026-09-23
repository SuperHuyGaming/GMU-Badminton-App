# 🗺️ Mason Badminton Connect - Product Roadmap

Welcome to our official Roadmap! This document tracks our high-level goals for the next major releases. If you are looking to contribute, pick an item from the "Up Next" or "Backlog" sections and mention it in the Discord!

---

## 🚀 v1.0 (Current Release) - The Foundation
- [x] Create the Core Monorepo architecture.
- [x] Build the React 19 + MUI v6 Frontend with Bento-Box Grid.
- [x] Implement User Authentication (JWT + MongoDB).
- [x] Build the basic Forum and Post features.
- [x] Develop the Python Web Scraper using GPT-4o for tournament extraction.
- [x] Set up Java Spring Boot Microservice and Kafka Event Streaming.
- [x] Containerize the entire 7-service stack with Docker Compose.
- [x] Establish Open Source standards (Issue Templates, Code of Conduct, All-Contributors).

---

## 🛠️ v1.1 (Up Next) - Gamification & UX
- [ ] **Interactive Tournament Map**: Render scraped tournaments on a live Leaflet.js / Google Map.
- [ ] **Live RAC Status Integration**: Hook up the frontend widget to actively scrape and display George Mason RAC court availability.
- [ ] **Player Profiles**: Allow users to upload custom cropped profile banners and track their win/loss streaks.
- [ ] **Forum WebSockets**: Upgrade the forum to use real-time WebSockets so users see new posts without refreshing.

---

## 🔮 v2.0 (The Future) - The AI Ecosystem
- [ ] **LLM Chatbot**: Integrate a ChromaDB RAG pipeline so users can "Chat with the Tournament Rules".
- [ ] **Push Notifications**: Send browser push notifications when a new tournament is scraped in the user's area.
- [ ] **Elasticsearch**: Implement fuzzy searching so users can instantly search for specific players or forum posts.
- [ ] **Varsity Leaderboard**: Generate animated, trading-card style SVG graphics for the Top 3 players on the campus Elo leaderboard.

---

*Note to Maintainers: We also track these items dynamically using our [GitHub Projects Kanban Board](https://github.com/SuperHuyGaming/GMU-Badminton-App/projects).*
