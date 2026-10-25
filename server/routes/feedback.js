// server/routes/feedback.js
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const xss = require("xss");
const rateLimit = require("express-rate-limit");
const Feedback = require("../models/Feedback");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// Rate limiter for feedback submissions to prevent spam attacks
const feedbackSubmitLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: process.env.NODE_ENV === "test" ? 1000 : 25,
	skip: (req) => req.method === "OPTIONS",
	message: { message: "Too many feedback submissions from this IP. Please try again after 15 minutes." },
});

// Optional auth helper: if bearer token is attached and valid, populates req.user
const optionalAuthMiddleware = (req, res, next) => {
	const authHeader = req.header("Authorization");
	if (!authHeader) return next();

	try {
		const token = authHeader.split(" ")[1];
		if (token) {
			const decoded = jwt.verify(token, JWT_SECRET);
			req.user = decoded;
			if (req.user) {
				const normalizedId = (req.user.userId || req.user.id || req.user._id || "").toString();
				req.user.id = normalizedId;
				req.user.userId = normalizedId;
			}
		}
	} catch {
		// Non-fatal: if token is expired or malformed, continue as guest
	}
	next();
};

// ==========================================
// PUBLIC USER SUBMISSION
// ==========================================

router.post("/", feedbackSubmitLimiter, optionalAuthMiddleware, async (req, res) => {
	try {
		const { type, title, description, severity, pageUrl, userName, userEmail } = req.body;

		// Validation: Type
		const validTypes = ["bug", "feedback", "feature"];
		const feedbackType = validTypes.includes(type) ? type : "bug";

		// Validation: Title
		if (!title || typeof title !== "string" || !title.trim()) {
			return res.status(400).json({ message: "Please provide a subject or title for your report." });
		}
		if (title.trim().length < 3) {
			return res.status(400).json({ message: "Title must be at least 3 characters long." });
		}
		if (title.trim().length > 150) {
			return res.status(400).json({ message: "Title cannot exceed 150 characters." });
		}

		// Validation: Description
		if (!description || typeof description !== "string" || !description.trim()) {
			return res.status(400).json({ message: "Please provide detailed description of the feedback or issue." });
		}
		if (description.trim().length < 5) {
			return res.status(400).json({ message: "Description must be at least 5 characters long." });
		}
		if (description.trim().length > 3000) {
			return res.status(400).json({ message: "Description cannot exceed 3000 characters." });
		}

		// Validation: Severity
		const validSeverities = ["low", "medium", "high", "critical"];
		const feedbackSeverity = validSeverities.includes(severity) ? severity : "medium";

		// Validation: Optional Email
		if (userEmail && typeof userEmail === "string" && userEmail.trim()) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(userEmail.trim())) {
				return res.status(400).json({ message: "Please provide a valid email address." });
			}
		}

		// Determine user ownership
		let userId = null;
		let cleanUserName = "Anonymous User";
		let cleanUserEmail = "";

		if (req.user && req.user.id) {
			userId = req.user.id;
			cleanUserName = req.user.username || req.user.name || "Authenticated User";
			cleanUserEmail = req.user.email || "";
		}

		if (userName && typeof userName === "string" && userName.trim()) {
			cleanUserName = xss(userName.trim().slice(0, 100));
		}
		if (userEmail && typeof userEmail === "string" && userEmail.trim()) {
			cleanUserEmail = xss(userEmail.trim().slice(0, 100));
		}

		const cleanTitle = xss(title.trim().slice(0, 150));
		const cleanDescription = xss(description.trim().slice(0, 3000));
		const cleanPageUrl = typeof pageUrl === "string" ? xss(pageUrl.trim().slice(0, 500)) : "";

		const feedback = new Feedback({
			type: feedbackType,
			title: cleanTitle,
			description: cleanDescription,
			severity: feedbackType === "bug" ? feedbackSeverity : "medium",
			pageUrl: cleanPageUrl,
			user: userId,
			userName: cleanUserName,
			userEmail: cleanUserEmail,
			status: "pending",
		});

		await feedback.save();

		// Realtime socket notification for admins
		const io = req.io || req.app?.get("io");
		if (io) {
			io.emit("feedbackCreated", feedback);
		}

		res.status(201).json({
			success: true,
			message: "Thank you for your feedback! Our team has received your submission.",
			feedback,
		});
	} catch (err) {
		console.error("Error creating feedback:", err);
		res.status(500).json({ message: "Failed to submit feedback. Please try again." });
	}
});

// ==========================================
// ADMIN MANAGEMENT ROUTES (Admins Only)
// ==========================================

router.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { status, type, severity } = req.query;
		const query = {};

		if (status && status !== "all") {
			query.status = status;
		}
		if (type && type !== "all") {
			query.type = type;
		}
		if (severity && severity !== "all") {
			query.severity = severity;
		}

		const feedbackList = await Feedback.find(query)
			.populate("user", "username email firstName lastName role")
			.sort({ createdAt: -1 });

		const [total, pending, inProgress, resolved, dismissed] = await Promise.all([
			Feedback.countDocuments({}),
			Feedback.countDocuments({ status: "pending" }),
			Feedback.countDocuments({ status: "in_progress" }),
			Feedback.countDocuments({ status: "resolved" }),
			Feedback.countDocuments({ status: "dismissed" }),
		]);

		res.json({
			feedback: feedbackList,
			counts: {
				total,
				pending,
				inProgress,
				resolved,
				dismissed,
			},
		});
	} catch (err) {
		console.error("Error fetching feedback list:", err);
		res.status(500).json({ message: "Server error fetching feedback" });
	}
});

router.patch("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) {
			return res.status(400).json({ message: "Invalid feedback ID format." });
		}

		const feedback = await Feedback.findById(id);
		if (!feedback) {
			return res.status(404).json({ message: "Feedback report not found." });
		}

		const { status, adminNotes } = req.body;

		if (status) {
			const validStatuses = ["pending", "in_progress", "resolved", "dismissed"];
			if (!validStatuses.includes(status)) {
				return res.status(400).json({ message: "Invalid status value." });
			}
			feedback.status = status;
		}

		if (adminNotes !== undefined && typeof adminNotes === "string") {
			feedback.adminNotes = xss(adminNotes.trim().slice(0, 1000));
		}

		await feedback.save();

		const io = req.io || req.app?.get("io");
		if (io) {
			io.emit("feedbackUpdated", feedback);
		}

		res.json({
			success: true,
			message: "Feedback report updated successfully.",
			feedback,
		});
	} catch (err) {
		console.error("Error updating feedback:", err);
		res.status(500).json({ message: "Server error updating feedback" });
	}
});

router.delete("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) {
			return res.status(400).json({ message: "Invalid feedback ID format." });
		}

		const deleted = await Feedback.findByIdAndDelete(id);
		if (!deleted) {
			return res.status(404).json({ message: "Feedback report not found." });
		}

		const io = req.io || req.app?.get("io");
		if (io) {
			io.emit("feedbackDeleted", id);
		}

		res.json({
			success: true,
			message: "Feedback report permanently deleted.",
		});
	} catch (err) {
		console.error("Error deleting feedback:", err);
		res.status(500).json({ message: "Server error deleting feedback" });
	}
});

module.exports = router;
