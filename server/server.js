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

const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const app = express();
app.disable('x-powered-by'); // Hide tech stack

// 1. HTTP Security Headers
app.use(helmet());

// 2. Prevent NoSQL Injection
app.use(mongoSanitize());

// 3. Global API Rate Limiting
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 500, // Limit each IP to 500 requests per `window`
	standardHeaders: true,
	legacyHeaders: false,
	message: "Too many requests from this IP, please try again after 15 minutes."
});
app.use("/api/", apiLimiter);

// FIX 1: Sidestep the stuck port by using 5005 locally!
const PORT = process.env.PORT || 5005;
const server = http.createServer(app);

const allowedOrigins = [
	"http://localhost:5173", 
	"http://localhost:3000",
	process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
	cors: {
		origin: process.env.NODE_ENV === "production" ? allowedOrigins : "*",
		methods: ["GET", "POST", "PUT", "DELETE"],
	},
});

app.use((req, res, next) => {
	req.io = io;
	next();
});

// Explicitly trust the Vite frontend
app.use(cors({ 
	origin: process.env.NODE_ENV === "production" ? allowedOrigins : "*",
	credentials: true 
}));
app.use(express.json({ limit: "1mb" })); // Reduced to 1mb for security
app.use(express.urlencoded({ limit: "1mb", extended: true }));

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
app.use("/api/friends", require("./routes/friends"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/matches", require("./routes/matches"));

// Make io accessible globally
app.set("io", io);

const onlineUsers = new Set();

io.on("connection", (socket) => {
	console.log("New socket connection:", socket.id);
	
	socket.on("joinUserRoom", (userId) => {
		socket.userId = userId;
		socket.join(userId);
		onlineUsers.add(userId);
		io.emit("onlineUsersUpdate", Array.from(onlineUsers));
		console.log(`User ${userId} joined their personal room`);
	});

	socket.on("typing", (receiverId) => {
		if (socket.userId) {
			socket.to(receiverId).emit("typing", { senderId: socket.userId });
		}
	});

	socket.on("stopTyping", (receiverId) => {
		if (socket.userId) {
			socket.to(receiverId).emit("stopTyping", { senderId: socket.userId });
		}
	});

	socket.on("disconnect", () => {
		if (socket.userId) {
			onlineUsers.delete(socket.userId);
			io.emit("onlineUsersUpdate", Array.from(onlineUsers));
		}
		console.log("Socket disconnected:", socket.id);
	});
});

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
