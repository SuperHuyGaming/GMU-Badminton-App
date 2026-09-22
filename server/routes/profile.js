// server/routes/profile.js
const express = require("express");
const User = require("../models/User");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();
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

// GET: Fetch a public profile by ID
router.get("/:id", authMiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.params.id).select("-password -pushSubscriptions");
		if (!user) return res.status(404).json({ message: "User not found" });
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
			homeUniversity,
			searchRadius,
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
				homeUniversity,
				searchRadius,
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
