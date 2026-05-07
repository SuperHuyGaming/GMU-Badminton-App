// server/routes/profile.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET =
	process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// SECURITY MIDDLEWARE: Checks the "Digital Wristband"
const authMiddleware = (req, res, next) => {
	const authHeader = req.header("Authorization");
	if (!authHeader)
		return res
			.status(401)
			.json({ message: "No token, authorization denied" });

	try {
		const token = authHeader.split(" ")[1];
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded; // Attaches the user's ID to the request
		next();
	} catch (err) {
		res.status(401).json({ message: "Token is not valid" });
	}
};
const adminMiddleware = (req, res, next) => {
	// Check the "role" we just added to the JWT
	if (req.user && req.user.role === "admin") {
		next(); // User is an admin, let them through!
	} else {
		res.status(403).json({ message: "Access denied. Admins only." });
	}
};
// GET: Fetch the logged-in user's profile
router.get("/", authMiddleware, async (req, res) => {
	try {
		// Find user but exclude the password from the data sent to React!
		const user = await User.findById(req.user.userId).select("-password");
		res.json(user);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching profile" });
	}
});

// PUT: Update the user's profile
router.put("/", authMiddleware, async (req, res) => {
	try {
		// NEW: Destructure profilePic and coverPic from the incoming request
		const {
			name,
			skillLevel,
			bio,
			preferredPlay,
			racket,
			profilePic,
			coverPic,
		} = req.body;

		const updatedUser = await User.findByIdAndUpdate(
			req.user.userId,
			// NEW: Tell MongoDB to update the image fields
			{
				name,
				skillLevel,
				bio,
				preferredPlay,
				racket,
				profilePic,
				coverPic,
			},
			{ new: true, runValidators: true },
		).select("-password");

		if (req.io) {
			req.io.emit("profileUpdated", updatedUser);
		}

		res.json(updatedUser);
	} catch (err) {
		console.error("Error saving profile:", err);
		res.status(500).json({ message: "Server error updating profile" });
	}
});

// GET: Fetch ANY user's profile by ID (Public/Read-Only view)
router.get("/:id", async (req, res) => {
	try {
		// We use .select("-password -email") to ensure we NEVER send
		// someone's private email or hashed password to the public forum!
		const user = await User.findById(req.params.id).select(
			"-password -email",
		);

		if (!user) return res.status(404).json({ message: "User not found" });
		res.json(user);
	} catch (err) {
		res.status(500).json({
			message: "Server error fetching public profile",
		});
	}
});

module.exports = { router, authMiddleware, adminMiddleware };
