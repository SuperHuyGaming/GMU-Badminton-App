// server/routes/admin.js
const express = require("express");
const User = require("../models/User");
const Post = require("../models/Post");
const { authMiddleware, adminMiddleware } = require("./profile");

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// ==========================================
// USER MANAGEMENT ROUTES
// ==========================================

router.get("/users", async (req, res) => {
	try {
		const users = await User.find()
			.select("-password")
			.sort({ createdAt: -1 });
		res.json(users);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching users" });
	}
});

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
// SPAM & MODERATION ROUTES
// ==========================================

router.get("/flagged", async (req, res) => {
	try {
		const flaggedPosts = await Post.find({ isFlagged: true }).sort({
			timestamp: -1,
		});
		res.json(flaggedPosts);
	} catch (err) {
		res.status(500).json({
			message: "Server error fetching flagged posts",
		});
	}
});

router.put("/flagged/:id/approve", async (req, res) => {
	try {
		const post = await Post.findByIdAndUpdate(
			req.params.id,
			{ isFlagged: false },
			{ new: true },
		);
		if (!post) return res.status(404).json({ message: "Post not found" });

		if (req.io) req.io.emit("postCreated", post);

		res.json({ message: "Post approved", post });
	} catch (err) {
		res.status(500).json({ message: "Server error approving post" });
	}
});

// ==========================================
// FORUM MANAGEMENT ROUTES
// ==========================================

router.get("/posts", async (req, res) => {
	try {
		const posts = await Post.find().sort({ timestamp: -1 });
		res.json(posts);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching posts" });
	}
});

router.delete("/posts/:id", async (req, res) => {
	try {
		const deletedPost = await Post.findByIdAndDelete(req.params.id);
		if (!deletedPost)
			return res.status(404).json({ message: "Post not found" });

		// NEW: Broadcast to everyone's browser to rip this post off the screen instantly!
		if (req.io) {
			req.io.emit("postDeleted", req.params.id);
		}

		res.json({ message: "Post permanently deleted." });
	} catch (err) {
		res.status(500).json({ message: "Server error deleting post" });
	}
});

module.exports = router;
