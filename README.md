# GMU Badminton Community Hub

A full-stack, real-time social platform built for George Mason University students to coordinate badminton matches, track court availability at the RAC, and connect with other players through a high-end, gamified interface.

## 🚀 Features

- **Live Chat & Messaging:** Real-time WebSockets powered chat with iMessage-style typing indicators, unread badges, and "Last Active" presence tracking.
- **GMU Varsity Aesthetic:** A custom, premium UI utilizing Deep Forest Green OLED dark mode, Gold accents, and animated mesh gradient backgrounds with frosted glassmorphism.
- **Interactive Forum:** Facebook-style modal comments, nested replies (3 levels deep), and user tagging.
- **Instagram-style Interactions:** Double-tap anywhere on a post to trigger a massive glowing heart and instantly "Like" it.
- **Global Leaderboards:** Elo tracking for Singles and Doubles with glowing Top-3 player avatars and Varsity trading card-style profile stats.
- **Custom Player Profiles:** Free-form, any-ratio cover photo cropping and dynamic badges.
- **Live RAC Status:** Scraped real-time data on gym availability.

---

## 🛠️ Tech Stack

- **Frontend:** React.js, Vite, Material-UI (MUI), Framer Motion, React Router
- **Backend:** Node.js, Express.js, Socket.IO
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Security:** JSON Web Tokens (JWT), Bcrypt.js

---

## 📦 Installation & Setup

Follow these steps to get a local copy up and running.

### 1. Prerequisites
- **Node.js** (v16 or higher)
- **npm** (comes with Node)
- A **MongoDB Atlas** account and cluster

### 2. Clone the Repository
```bash
git clone https://github.com/superhuygaming/gmu-badminton-app.git
cd gmu-badminton-app
```

### 3. Setup the Backend
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `server/` directory and add your credentials:
   ```env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_key
   CLOUDINARY_URL=your_cloudinary_url (optional, for image hosting)
   ```
4. Start the server:
   ```bash
   node server.js
   ```

### 4. Setup the Frontend
1. Open a new terminal and navigate to the client folder:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`.

---

## 🤝 Contributing

We welcome contributions! To maintain a clean project, please follow our branching workflow.

1. **Fork the Project**
2. **Create your Feature Branch** from the `main` branch:
   ```bash
   git checkout main
   git checkout -b feature/AmazingFeature
   ```
3. **Commit your Changes** (`git commit -m 'feat(ui): add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request** against the `main` branch.

---

## 📄 License
Distributed under the MIT License.

## ✉️ Contact
**Project Lead:** Huy Truong
