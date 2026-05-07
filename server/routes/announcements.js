// server/routes/announcements.js
const express = require("express");
const Announcement = require("../models/Announcement");

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
router.post("/", async (req, res) => {
	try {
		const { content, authorName, authorId, role } = req.body;

		// AUTH GUARD: Strictly verify admin role
		if (role !== "admin") {
			return res.status(403).json({
				message: "Unauthorized. Only admins can broadcast updates.",
			});
		}

		const newAnnouncement = new Announcement({
			content,
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
router.delete("/:id", async (req, res) => {
	try {
		const { role } = req.query; // Pass role in the URL query

		// AUTH GUARD: Strictly verify admin role
		if (role !== "admin") {
			return res.status(403).json({ message: "Unauthorized." });
		}

		await Announcement.findByIdAndDelete(req.params.id);

		// Tell all connected clients to remove it from their screens
		if (req.io) req.io.emit("announcementDeleted", req.params.id);

		res.json({ message: "Announcement deleted successfully" });
	} catch (error) {
		res.status(500).json({ message: "Server error deleting announcement" });
	}
});

module.exports = router;
