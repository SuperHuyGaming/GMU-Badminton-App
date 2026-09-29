# 🏸 Mason Badminton Connect

An independent, student-run community platform for George Mason University badminton players. Connect with doubles partners, rank up on the Elo leaderboard, chat in real-time, and discover the latest regional tournaments scraped by AI.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)
![Kafka](https://img.shields.io/badge/Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## ✨ Features

- **Advanced Global Search Engine:** A Facebook-caliber, hyper-fast search engine powered by Elasticsearch, Kafka event streaming, and Redis-backed typeahead caching. Features faceted filtering, typo tolerance, and graph-based relevance ranking (prioritizing players from your home university).
- **Live Chat & Forum:** Real-time WebSockets-powered chat with iMessage-style typing indicators, unread badges, and "Last Active" presence tracking.
- **AI Tournament Finder:** A Python-based AI scraper that autonomously hunts for regional badminton tournaments on Instagram/Web, parsed by GPT-4o, and streamed to the UI.
- **Global Matchmaking:** Elo tracking for Singles and Doubles with glowing Top-3 player avatars and Varsity trading card-style profiles.
- **Responsive Flex UI:** A custom, premium UI utilizing Deep Forest Green OLED dark mode, Gold accents, and responsive Bento-Box layouts powered by Material-UI (MUI v6) and Framer Motion.
- **Live RAC Status:** Instantly see if courts are open before walking to the gym.

---

## 🏗️ Architecture

This repository is a **Monorepo** containing multiple distinct services designed to run seamlessly together via Docker:

- `/client`: React 19 Frontend (Vite, MUI, Framer Motion)
- `/server`: Node.js Express API (User Auth, Forum, WebSockets)
- `/search-service`: High-performance Node.js microservice handling the Elasticsearch and Redis layers for instantaneous search results.
- `/tournament-services`: Advanced Microservices Stack (Java Spring Boot backend, Python Scraper Worker).
- **Infrastructure**: Apache Kafka (Event Streaming), Redis (Caching/Rate Limiting), Elasticsearch (Search Index), MongoDB Replica Set (Change Streams).

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
*This will spin up: MongoDB, Redis, Kafka, Elasticsearch, Node API (Port 5001), Search Service (Port 5002), React UI (Port 5173), Java API (Port 8081), and the Python Scraper.*

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
6. Open a Pull Request against the `develop` or `main` branch.

---

## 🏆 Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%">
        <a href="https://github.com/SuperHuyGaming">
          <img src="https://avatars.githubusercontent.com/u/SuperHuyGaming?v=4" width="100px;" alt="SuperHuyGaming"/>
          <br /><sub><b>SuperHuyGaming</b></sub>
        </a>
        <br />
        <a href="https://github.com/SuperHuyGaming/GMU-Badminton-App/commits?author=SuperHuyGaming" title="Code">💻</a> 
        <a href="#design-SuperHuyGaming" title="Design">🎨</a> 
        <a href="#maintenance-SuperHuyGaming" title="Maintenance">🚧</a> 
        <a href="#projectManagement-SuperHuyGaming" title="Project Management">📆</a>
      </td>
      <td align="center" valign="top" width="14.28%">
        <a href="https://github.com/HuyTruong2005">
          <img src="https://avatars.githubusercontent.com/u/HuyTruong2005?v=4" width="100px;" alt="HuyTruong2005"/>
          <br /><sub><b>HuyTruong2005</b></sub>
        </a>
        <br />
        <a href="https://github.com/SuperHuyGaming/GMU-Badminton-App/commits?author=HuyTruong2005" title="Code">💻</a> 
        <a href="#design-HuyTruong2005" title="Design">🎨</a> 
        <a href="#ideas-HuyTruong2005" title="Ideas, Planning, & Feedback">🤔</a>
      </td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

---

## 📝 License & Contact
Distributed under the MIT License.

**Project Leads:** 
- Huy Truong - [SuperHuyGaming](https://github.com/SuperHuyGaming)
- [HuyTruong2005](https://github.com/HuyTruong2005)
