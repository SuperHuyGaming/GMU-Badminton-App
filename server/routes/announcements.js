// server/routes/announcements.js
const express = require("express");
const mongoose = require("mongoose");
const xss = require("xss");
const Announcement = require("../models/Announcement");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET: Fetch all announcements (Everyone can read)
router.get("/", async (req, res) => {
	try {
		const announcements = await Announcement.find()
			.sort({ timestamp: -1 })
			.limit(20)
			.lean();
		res.json(announcements);
	} catch (error) {
		res.status(500).json({
			message: "Server error fetching announcements",
		});
	}
});

// POST: Create a new announcement (ADMIN ONLY)
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { content } = req.body;

		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Announcement content is required." });
		}

		const cleanContent = xss(content.trim());
		const authorId = req.user.id || req.user.userId;
		const authorName = req.user.name || req.body.authorName || "Admin";

		const newAnnouncement = new Announcement({
			content: cleanContent,
			authorName,
			authorId,
		});
		await newAnnouncement.save();

		// Broadcast live to everyone's dashboard!
		if (req.io) req.io.emit("announcementCreated", newAnnouncement);

		res.status(201).json(newAnnouncement);
	} catch (error) {
		res.status(500).json({ message: "Server error creating announcement" });
	}
});

// DELETE: Remove an announcement (ADMIN ONLY)
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.id)) {
			return res.status(400).json({ message: "Invalid announcement ID format." });
		}

		const deleted = await Announcement.findByIdAndDelete(req.params.id);
		if (!deleted) {
			return res.status(404).json({ message: "Announcement not found." });
		}

		// Tell all connected clients to remove it from their screens
		if (req.io) req.io.emit("announcementDeleted", req.params.id);

		res.json({ message: "Announcement deleted successfully" });
	} catch (error) {
		res.status(500).json({ message: "Server error deleting announcement" });
	}
});

module.exports = router;
