require("dotenv").config();
const express = require("express");
const promBundle = require("express-prom-bundle");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const v8 = require("v8");
const { Server } = require("socket.io");
const { getRacStatus, getWeeklySchedule } = require("./services/scraper");

const { initializeGemini } = require("./utils/aiCoach");

function inspectStartupMemory() {
	const heapStats = v8.getHeapStatistics();
	const heapLimitMB = Math.round(heapStats.heap_size_limit / (1024 * 1024));
	const memUsage = process.memoryUsage();
	const rssMB = Math.round(memUsage.rss / (1024 * 1024));
	const heapUsedMB = Math.round(memUsage.heapUsed / (1024 * 1024));
	const heapTotalMB = Math.round(memUsage.heapTotal / (1024 * 1024));
	const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
	const nodeOptions = process.env.NODE_OPTIONS || "";

	console.log("==================================================");
	console.log("📊 [Memory Monitor] Startup Memory Configuration:");
	console.log(`   - V8 Heap Size Limit: ${heapLimitMB} MB`);
	console.log(`   - Initial Heap Total:  ${heapTotalMB} MB (Used: ${heapUsedMB} MB)`);
	console.log(`   - Initial Process RSS: ${rssMB} MB`);
	console.log(`   - NODE_OPTIONS:        ${nodeOptions || "None"}`);
	console.log(`   - Environment:         ${isRender ? "Render Cloud" : (process.env.NODE_ENV || "development")}`);

	if (heapLimitMB <= 512 || isRender) {
		console.log("⚠️ [Memory Monitor] Low-heap environment detected (<=512MB RAM tier).");
		console.log("   - Autonomous scraper heap guards active (200MB ceiling).");
		console.log("   - Cheerio DOM parsing caps & microtask GC yielding enabled.");
		if (heapLimitMB > 450) {
			console.warn("⚠️ [Memory Monitor] Warning: Heap limit > 450MB on 512MB RAM host risks container cgroup OOM kill.");
			console.warn("   Recommendation: Configure NODE_OPTIONS='--max-old-space-size=300' for safe headroom.");
		}
	}
	console.log("==================================================");

	return { heapLimitMB, heapUsedMB, rssMB, isRender };
}

if (process.env.NODE_ENV !== "test") {
	inspectStartupMemory();
	mongoose
		.connect(process.env.MONGO_URI)
		.then(async () => {
			console.log("Successfully connected to MongoDB!");
			initializeGemini();
			require("./utils/seedFeed")();
			try {
				const { ensureGuaranteedTournaments } = require("./utils/autonomousHunter");
				await ensureGuaranteedTournaments();
				console.log("🏸 [Tournament Engine] Verified live tournaments initialized on DB connect.");
			} catch (err) {
				console.error("❌ Failed to initialize tournaments on DB connect:", err.message);
			}
		})
		.catch((error) => console.error("MongoDB connection failed:", error));
}

const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const app = express();
app.set('trust proxy', 1); // Trust the first proxy (Render's load balancer) for correct rate limiting IP detection

// CORS Configuration - MUST precede metrics & rate-limiting middleware
const staticAllowedOrigins = [
	"http://localhost:5173", 
	"http://localhost:3000",
	"http://localhost:4173",
	"http://127.0.0.1:5173",
	"http://127.0.0.1:3000",
	"http://127.0.0.1:4173",
	"https://gmu-frontend-staging.onrender.com",
	"https://gmu-badminton-app.onrender.com",
	"https://gmu-badminton-openplayschedule.onrender.com",
	"https://gmu-badminton.onrender.com"
];

const envOrigins = (process.env.FRONTEND_URL || "")
	.split(",")
	.map((s) => s.trim().replace(/\/+$/, ""))
	.filter(Boolean);

const additionalOrigins = (process.env.ADDITIONAL_ALLOWED_ORIGINS || "")
	.split(",")
	.map((s) => s.trim().replace(/\/+$/, ""))
	.filter(Boolean);

const allowedOrigins = [...new Set([...staticAllowedOrigins, ...envOrigins, ...additionalOrigins])];

const isOriginAllowed = (origin) => {
	if (!origin) return true;
	const norm = origin.toLowerCase().trim().replace(/\/+$/, "");
	// 1. Static and environment whitelisted origins
	if (allowedOrigins.some((o) => o && o.toLowerCase().trim().replace(/\/+$/, "") === norm)) return true;
	// 2. Localhost & loopback development environments
	if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(norm)) return true;
	// 3. Official George Mason University academic domains (*.gmu.edu)
	if (/^https?:\/\/([a-z0-9-]+\.)*gmu\.edu$/.test(norm)) return true;
	// 4. Staging and preview deployments on Render strictly prefixed with GMU identifiers
	if (/^https:\/\/([a-z0-9-]+\.)*(?:[a-z0-9-]+-)?gmu-[a-z0-9-]+\.onrender\.com$/.test(norm)) return true;
	return false;
};

const corsOptions = {
	origin: function (origin, callback) {
		if (isOriginAllowed(origin)) {
			callback(null, true);
		} else {
			callback(null, false);
		}
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-scraper-secret", "Idempotency-Key", "idempotency-key"],
	exposedHeaders: ["Content-Range", "X-Content-Range"],
	maxAge: 86400,
	optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const metricsMiddleware = promBundle({includeMethod: true});
app.use(metricsMiddleware);

// 1. HTTP Security Headers
app.use(helmet());

// 2. Prevent NoSQL Injection
app.use(mongoSanitize());

const { redisClient, redisEnabled } = require("./config/redis");
const RedisStore = require("rate-limit-redis").default;

// 3. Global API Rate Limiting (Backed by Redis if available)
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: Number(process.env.RATE_LIMIT_MAX) || 5000, // Limit each IP to 5000 requests per `window`
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => req.method === "OPTIONS", // Never rate limit CORS preflight requests
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

const io = new Server(server, {
	cors: {
		origin: corsOptions.origin,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: true
	},
	transports: ["websocket", "polling"],
	pingInterval: 10000,
	pingTimeout: 5000,
	connectTimeout: 20000,
	allowUpgrades: true,
	cookie: false
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

app.use(express.json({ limit: "1mb" })); // Reduced to 1mb for security
app.use(express.urlencoded({ limit: "1mb", extended: true }));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
const forumRoutes = require("./routes/forum");
app.use("/api/forum", forumRoutes);
const { router: profileRoutes } = require("./routes/profile");
app.use("/api/profile", profileRoutes);
const adminTournamentsRoutes = require("./routes/adminTournaments");
app.use("/api/admin/tournaments", adminTournamentsRoutes);
const tournamentRoutes = require("./routes/tournaments");
app.use("/api/tournaments", tournamentRoutes);
const courtRoutes = require("./routes/courts");
app.use("/api/courts", courtRoutes);
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
app.use("/api/feed", require("./routes/feed"));
app.use("/api/calendar", require("./routes/calendar"));
app.use("/api/scrape", require("./routes/scrape"));
app.use("/api/search", require("./routes/search"));

// Make io accessible globally
app.set("io", io);

// Multi-tab tracking: Map<userId, Set<socketId>>
const onlineUsers = new Map();

io.on("connection", (socket) => {
	console.log("New socket connection:", socket.id);
	
	socket.on("joinUserRoom", async (userId) => {
		if (!userId || typeof userId !== "string" || !userId.trim()) {
			return;
		}
		userId = userId.trim();

		// If socket previously joined under a different userId, clean up previous association
		if (socket.userId && socket.userId !== userId && onlineUsers.has(socket.userId)) {
			onlineUsers.get(socket.userId).delete(socket.id);
			if (onlineUsers.get(socket.userId).size === 0) {
				onlineUsers.delete(socket.userId);
			}
		}

		socket.userId = userId;
		socket.join(userId);

		if (!onlineUsers.has(userId)) {
			onlineUsers.set(userId, new Set());
		}
		onlineUsers.get(userId).add(socket.id);

		io.emit("onlineUsersUpdate", Array.from(onlineUsers.keys()));
		console.log(`User ${userId} joined their personal room (socket: ${socket.id})`);
		
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

	socket.on("commentTyping", (data) => {
		socket.broadcast.emit("commentTyping", { ...data, socketId: socket.id });
	});

	socket.on("commentStopTyping", (data) => {
		socket.broadcast.emit("commentStopTyping", { ...data, socketId: socket.id });
	});

	socket.on("stopTyping", (receiverId) => {
		if (socket.userId) {
			socket.to(receiverId).emit("stopTyping", { senderId: socket.userId });
		}
	});

	socket.on("disconnect", async () => {
		if (socket.userId) {
			const userSockets = onlineUsers.get(socket.userId);
			if (userSockets) {
				userSockets.delete(socket.id);
				if (userSockets.size === 0) {
					onlineUsers.delete(socket.userId);
					io.emit("onlineUsersUpdate", Array.from(onlineUsers.keys()));
					socket.broadcast.emit("stopTyping", { senderId: socket.userId });
					
					try {
						const User = require("./models/User");
						await User.findByIdAndUpdate(socket.userId, { lastActive: Date.now() });
					} catch (err) {
						console.error("Error updating lastActive on disconnect:", err);
					}
				}
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

if (process.env.NODE_ENV !== "test") {
	server.listen(PORT, () => {
		console.log(`Server is running on port: ${PORT}`);
	});
	require('./utils/cronJobs')();
}

module.exports = { app, server, io, isOriginAllowed, onlineUsers, corsOptions, apiLimiter, inspectStartupMemory };
