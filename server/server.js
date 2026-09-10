require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const { getRacStatus, getWeeklySchedule } = require("./services/scraper");

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("Successfully connected to MongoDB!"))
	.catch((error) => console.error("MongoDB connection failed:", error));

const app = express();

// FIX 1: Sidestep the stuck port by using 5005 locally!
const PORT = process.env.PORT || 5005;
const server = http.createServer(app);

const io = new Server(server, {
	cors: {
		// FIX 2: Allow WebSockets to connect from your live Render frontend!
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE"],
	},
});

app.use((req, res, next) => {
	req.io = io;
	next();
});

// Explicitly trust the Vite frontend
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
const forumRoutes = require("./routes/forum");
app.use("/api/forum", forumRoutes);
const { router: profileRoutes } = require("./routes/profile");
app.use("/api/profile", profileRoutes);
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
const announcementRoutes = require("./routes/announcements");
app.use("/api/announcements", announcementRoutes);
app.use("/api/upload", require("./routes/upload"));

const errorHandler = require("./middleware/errorHandler");

app.get("/api/status", async (req, res, next) => {
	try {
		const statusMessage = await getRacStatus();
		res.json({ message: statusMessage });
	} catch (error) {
		next(error);
	}
});

app.get("/api/schedule/weekly", (req, res, next) => {
	try {
		const weeklyData = getWeeklySchedule();
		res.json(weeklyData);
	} catch (error) {
		next(error);
	}
});

// Global error handler must be defined after all other routes and middleware
app.use(errorHandler);

server.listen(PORT, () => {
	console.log(`Server is running on port: ${PORT}`);
});
