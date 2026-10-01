# 🏸 Mason Badminton Connect

An independent, student-run community platform for George Mason University badminton players. Connect with doubles partners, rank up on the Elo leaderboard, chat in real-time, and discover the latest regional tournaments scraped by AI.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Java Spring](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## ✨ Features

- **Live Chat & Forum:** Real-time WebSockets-powered chat with iMessage-style typing indicators, unread badges, and "Last Active" presence tracking.
- **AI Tournament Finder:** A Python-based AI scraper that autonomously hunts for regional badminton tournaments on Instagram/Web, parsed by GPT-4o, and streamed to the UI via Kafka and Spring Boot.
- **Global Leaderboards:** Elo tracking for Singles and Doubles with glowing Top-3 player avatars and Varsity trading card-style profiles.
- **Responsive Flex UI:** A custom, premium UI utilizing Deep Forest Green OLED dark mode, Gold accents, and responsive Bento-Box layouts powered by Material-UI (MUI v6) and Framer Motion.
- **Live RAC Status:** Instantly see if courts are open before walking to the gym.

---

## 🏗️ Architecture

This repository is a **Monorepo** containing multiple distinct services designed to run seamlessly together via Docker:

- `/client`: React 19 Frontend (Vite, MUI, Framer Motion)
- `/server`: Node.js Express API (User Auth, Forum, WebSockets)
- `/tournament-services`: Advanced Microservices Stack
  - **Core Service**: Java Spring Boot backend handling high-throughput tournament data.
  - **Scraper Service**: Python worker using Playwright, BeautifulSoup, and OpenAI GPT-4o to extract structured data.
  - **Infrastructure**: Apache Kafka (Event Streaming), Redis (Caching/Rate Limiting), MongoDB Replica Set (Change Streams).

---

## 🚀 Local Development (Docker)

The absolute easiest way to run the entire 7-container architecture is using Docker Compose.

### 1. Prerequisites
- **Docker Desktop** installed and running.
- **Node.js** & **npm** (for local frontend hot-reloading).

### 2. Boot the Infrastructure
Run this command from the root of the project to build and start the entire stack:
```powershell
docker compose up --build -d
```
*This will spin up: MongoDB, Redis, Kafka, Node API (Port 5001), React UI (Port 5173), Java API (Port 8081), and the Python Scraper.*

### 3. Frontend Hot-Reloading (Pro Workflow)
To get instant millisecond updates while writing React code, leave Docker running, open a **new** terminal, and run:
```powershell
cd client
npm install --legacy-peer-deps
npm run dev
```
Open your browser to `http://localhost:5173` to view the app!

---

## 🤝 Contributing

We welcome contributions across all roles (Frontend, Backend, AI, UI/UX, QA, DevOps). To maintain a clean project, please follow our branching workflow:

1. Fork the Project.
2. Check out the project documentation in `tournament-services/docs` to read about specific roles and tasks.
3. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
4. Commit your Changes (`git commit -m 'feat(ui): add some AmazingFeature'`).
5. Push to the Branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request against the `main` branch.

---

## ✨ Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SuperHuyGaming"><img src="https://avatars.githubusercontent.com/u/SuperHuyGaming?v=4" width="100px;" alt="Huy Truong"/><br /><sub><b>Huy Truong</b></sub></a><br /><a href="https://github.com/SuperHuyGaming/GMU-Badminton-App/commits?author=SuperHuyGaming" title="Code">💻</a> <a href="#design-SuperHuyGaming" title="Design">🎨</a> <a href="#maintenance-SuperHuyGaming" title="Maintenance">🚧</a> <a href="#projectManagement-SuperHuyGaming" title="Project Management">📆</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

---

## 📜 License & Contact
Distributed under the MIT License.

**Project Lead:** Huy Truong - [SuperHuyGaming](https://github.com/SuperHuyGaming)
