// server/routes/admin.js
const express = require("express");
const User = require("../models/User");
const Post = require("../models/Post");
const { authMiddleware, adminMiddleware } = require("./profile");

const router = express.Router();

// 🛡️ THE VAULT DOOR: Apply security bouncers to EVERY route in this file
router.use(authMiddleware);
router.use(adminMiddleware);

// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================

// GET: Fetch all users in the database
router.get("/users", async (req, res) => {
	try {
		// We use .select("-password") so we never accidentally leak hashed passwords to the frontend
		const users = await User.find()
			.select("-password")
			.sort({ createdAt: -1 });
		res.json(users);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching users" });
	}
});

// DELETE: Obliterate a user from the database
router.delete("/users/:id", async (req, res) => {
	try {
		const deletedUser = await User.findByIdAndDelete(req.params.id);
		if (!deletedUser)
			return res.status(404).json({ message: "User not found" });

		res.json({ message: "User permanently deleted." });
	} catch (err) {
		res.status(500).json({ message: "Server error deleting user" });
	}
});

// ==========================================
// FORUM MANAGEMENT ROUTES
// ==========================================

// GET: Fetch all posts (Admin View)
router.get("/posts", async (req, res) => {
	try {
		const posts = await Post.find().sort({ timestamp: -1 });
		res.json(posts);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching posts" });
	}
});

// DELETE: Obliterate a forum post
router.delete("/posts/:id", async (req, res) => {
	try {
		const deletedPost = await Post.findByIdAndDelete(req.params.id);
		if (!deletedPost)
			return res.status(404).json({ message: "Post not found" });

		res.json({ message: "Post permanently deleted." });
	} catch (err) {
		res.status(500).json({ message: "Server error deleting post" });
	}
});

module.exports = router;
