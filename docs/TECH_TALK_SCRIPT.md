# Mason Badminton Connect - Architecture Walkthrough (Video Script)

**Goal:** Record a 5-minute Loom or YouTube video to help new open-source contributors understand how the Monorepo works and how to spin it up locally.

---

### [0:00 - 0:45] Introduction & The "Why"
**Visual:** Show the live `Landing.jsx` page (http://localhost:5173).
* **Script:** "Hey everyone, I'm Huy, the lead maintainer of Mason Badminton Connect. I'm recording this quick walkthrough to show you how our Monorepo is structured so you can start contributing today. Our goal is to build the ultimate real-time hub for GMU badminton players—combining live chat, Elo leaderboards, and an AI-powered tournament finder into one app."

### [0:45 - 1:45] The Frontend (React + Vite)
**Visual:** Open VS Code, expand the `/client` folder. Show `App.jsx` and `Landing.jsx`.
* **Script:** "Let's look at the codebase. Inside the `/client` folder, we have a React 19 app powered by Vite. We use Material-UI v6 for our design system and Framer Motion for those buttery-smooth UI animations. If you're a frontend dev, this is where you'll spend most of your time. Notice how we use a responsive Bento-Box grid layout in the Landing page rather than rigid tables."

### [1:45 - 2:30] The Backend (Node + Express)
**Visual:** Expand the `/server` folder. Open `server.js` or the WebSocket handler.
* **Script:** "Inside the `/server` folder is our Node.js and Express API. This handles all user authentication, JWTs, and most importantly, our Socket.IO connections. This is what powers the real-time typing indicators and live chat in our Forum."

### [2:30 - 3:45] The Microservices (Java + Python + Kafka)
**Visual:** Expand the `/tournament-services` folder. Point out the `core-service` (Java) and `scraper-service` (Python).
* **Script:** "This is where things get really cool. Because we have heavy AI workloads, we built a microservice architecture. The `scraper-service` uses Python, Playwright, and OpenAI's GPT-4o to actively hunt the web for regional badminton tournaments. When it finds one, it shoots that data through an Apache Kafka event stream over to our `core-service`, which is written in Java Spring Boot. Java processes it, saves it to MongoDB, and broadcasts it to the UI."

### [3:45 - 4:30] Spinning it up with Docker
**Visual:** Open the `docker-compose.yml` file in the root directory. Then open a terminal and run `docker ps` to show the running containers.
* **Script:** "I know that sounds like a lot to set up, but we've containerized everything! To run this entire 7-service architecture on your local machine, you literally just need Docker installed. Run `docker compose up --build -d` in the root folder, and Docker will spin up MongoDB, Redis, Kafka, Node, React, Java, and Python automatically in the background."

### [4:30 - 5:00] Outro & Call to Action
**Visual:** Show the GitHub Repository Issues tab. Point out the `good first issue` labels.
* **Script:** "If you want to contribute, head over to the Issues tab on our GitHub repo. Filter by the `good first issue` label, or check out the `project_roles_tasks.md` file in our docs to pick a role like AI Engineer or UX Designer. Thanks for watching, and I can't wait to see your Pull Requests!"
