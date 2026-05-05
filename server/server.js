require("dotenv").config(); // Loads  secret variables
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http"); // NEW: Built-in Node module
const { Server } = require("socket.io"); // NEW: Socket.io
const { getRacStatus, getWeeklySchedule } = require("./services/scraper");
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("Successfully connected to MongoDB!"))
	.catch((error) => console.error("MongoDB connection failed:", error));

const app = express(); // Initializes the Express application
const PORT = 5001;
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
		methods: ["GET", "POST", "PUT", "DELETE"],
	},
});

// NEW: Inject Socket.io into every API request so our routes can broadcast!
app.use((req, res, next) => {
	req.io = io;
	next();
});
// Middleware
// Explicitly trust the Vite frontend
app.use(
	cors({
		origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
		credentials: true,
	}),
);
app.use(express.json()); // Tells Express to parse incoming data as JSON

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
const forumRoutes = require("./routes/forum");
app.use("/api/forum", forumRoutes);
const { router: profileRoutes } = require("./routes/profile");
app.use("/api/profile", profileRoutes);
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

// A dynamic API Route using the web scraper
app.get("/api/status", async (req, res) => {
	try {
		// Run the scraper and wait for the result
		const statusMessage = await getRacStatus();
		// Send the live result back to the React frontend
		res.json({ message: statusMessage });
	} catch (error) {
		console.error("Route error:", error);
		res.status(500).json({ message: "Server error fetching status." });
	}
});

app.get("/api/schedule/weekly", (req, res) => {
	try {
		const weeklyData = getWeeklySchedule();
		res.json(weeklyData);
	} catch (error) {
		res.status(500).json({ message: "Server error generating schedule." });
	}
});

// Starts the server
// Starts the server (CHANGED FROM app.listen TO server.listen)
server.listen(PORT, () => {
	console.log(`Server is running on port: ${PORT}`);
});
