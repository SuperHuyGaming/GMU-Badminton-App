require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const { getRacStatus, getWeeklySchedule } = require("./services/scraper");

const { initializeGemini } = require("./utils/aiCoach");

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		console.log("Successfully connected to MongoDB!");
		initializeGemini();
	})
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

const { redisClient, redisEnabled } = require("./config/redis");
const RedisStore = require("rate-limit-redis").default;

// 3. Global API Rate Limiting (Backed by Redis if available)
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 500, // Limit each IP to 500 requests per `window`
	standardHeaders: true,
	legacyHeaders: false,
    ...(redisEnabled && {
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
    }),
	message: "Too many requests from this IP, please try again after 15 minutes."
});
app.use("/api/", apiLimiter);

// FIX 1: Sidestep the stuck port by using 5005 locally!
const PORT = process.env.PORT || 5005;
const server = http.createServer(app);

const allowedOrigins = [
	"http://localhost:5173", 
	"http://localhost:3000",
	"https://gmu-badminton-openplayschedule.onrender.com",
	process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
	origin: function (origin, callback) {
		if (!origin || allowedOrigins.includes(origin) || origin.includes("gmu-badminton")) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true
};

const io = new Server(server, {
	cors: {
		origin: corsOptions.origin,
		methods: ["GET", "POST", "PUT", "DELETE"],
		credentials: true
	},
});

// Setup Socket.io Redis Adapter for multi-instance scaling
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
	const pubClient = createClient({ url: REDIS_URL });
	const subClient = pubClient.duplicate();

	Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
		io.adapter(createAdapter(pubClient, subClient));
		console.log("🚀 Socket.io Redis Adapter connected for horizontal scaling");
	}).catch((err) => {
		console.error("❌ Redis Adapter Error:", err);
	});
} else {
	console.log("ℹ️ No REDIS_URL found. Using local in-memory Socket.io adapter.");
}

app.use((req, res, next) => {
	req.io = io;
	next();
});

// Explicitly trust the Vite frontend
app.use(cors(corsOptions));
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
app.use("/api/push", require("./routes/push"));
app.use("/api/coach", require("./routes/coach"));
app.use("/api/matchmaking", require("./routes/matchmaking"));
app.use("/api/marketplace", require("./routes/marketplace"));

// Make io accessible globally
app.set("io", io);

const onlineUsers = new Set();

io.on("connection", (socket) => {
	console.log("New socket connection:", socket.id);
	
	socket.on("joinUserRoom", async (userId) => {
		socket.userId = userId;
		socket.join(userId);
		onlineUsers.add(userId);
		io.emit("onlineUsersUpdate", Array.from(onlineUsers));
		console.log(`User ${userId} joined their personal room`);
		
		// Also update lastActive on connect just in case
		try {
			const User = require("./models/User");
			await User.findByIdAndUpdate(userId, { lastActive: Date.now() });
		} catch (err) {
			console.error("Error updating lastActive on join:", err);
		}
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

	socket.on("disconnect", async () => {
		if (socket.userId) {
			onlineUsers.delete(socket.userId);
			io.emit("onlineUsersUpdate", Array.from(onlineUsers));
			socket.broadcast.emit("stopTyping", { senderId: socket.userId });
			
			try {
				const User = require("./models/User");
				await User.findByIdAndUpdate(socket.userId, { lastActive: Date.now() });
			} catch (err) {
				console.error("Error updating lastActive on disconnect:", err);
			}
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
