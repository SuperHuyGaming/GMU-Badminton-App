# GMU Badminton Community Hub

A full-stack social platform built for George Mason University students to coordinate badminton matches, track court availability at the RAC, and connect with other players through a Facebook-style forum.

## 🚀 Features

- **Live RAC Status:** Scraped real-time data on gym availability.
- **Interactive Forum:** Nested comments (3 levels deep), likes, and user tagging.
- **Player Profiles:** Customizable "Player Cards" showing skill levels, playstyles, and equipment.
- **Smart UI:** Facebook-style modal comments and dynamic navigation.
- **Secure Auth:** JWT-based authentication with hashed passwords.

---

## 🛠️ Tech Stack

- **Frontend:** React.js, Vite, Material-UI (MUI), React Router
- **Backend:** Node.js, Express.js
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
git clone [https://github.com/YourUsername/gmu-badminton-app.git](https://github.com/YourUsername/gmu-badminton-app.git)
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
2. **Create your Feature Branch** from the `development` branch:
   ```bash
   git checkout development
   git checkout -b feature/AmazingFeature
   ```
3. **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request** against the `development` branch.

---

## 📄 License
Distributed under the MIT License.

## ✉️ Contact
**Project Lead:** Huy Truong

---

### How to push this to GitHub:

Once you've saved the file, follow your new Git workflow to update your repository:

```bash
# 1. Make sure you are on your development branch
git checkout development

# 2. Add and commit the README
git add README.md
git commit -m "Docs: Add comprehensive README with setup and contribution guides"

# 3. Push to GitHub
git push origin development
