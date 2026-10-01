// server/routes/coach.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const CoachChat = require("../models/CoachChat");
const User = require("../models/User");
const { chat } = require("../utils/aiCoach");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

// Rate limit: 20 messages per minute per user
const coachLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { message: "You're sending messages too fast. Take a breather! 🏸" },
    keyGenerator: (req) => (req.user?.id || req.user?.userId || "anonymous"),
    validate: { keyGeneratorIpFallback: false },
});

// All coach routes require authentication
router.use(authMiddleware);

// POST /api/coach/message - Send a message to the AI Coach
router.post("/message", coachLimiter, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = (req.user.id || req.user.userId).toString();

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ message: "A valid message is required." });
        }
        if (message.trim().length > 2000) {
            return res.status(400).json({ message: "Message cannot exceed 2000 characters." });
        }

        // Get user's skill level for personalized coaching
        const user = await User.findById(userId).select("skillLevel").lean();
        const skillLevel = user?.skillLevel || "D Level";

        // Fetch or create the user's coach chat history
        let coachChat = await CoachChat.findOne({ userId });
        if (!coachChat) {
            coachChat = new CoachChat({ userId, messages: [] });
        }

        // Build Gemini-compatible history from stored messages
        const geminiHistory = coachChat.messages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
        }));

        // Call the AI Coach
        const { response, error } = await chat(message.trim(), geminiHistory, skillLevel);

        // Save both the user message and AI response to history
        coachChat.messages.push(
            { role: "user", content: message.trim() },
            { role: "model", content: response }
        );

        // Trim history to prevent unbounded growth
        coachChat.trimHistory();
        await coachChat.save();

        res.json({
            response,
            error,
            messageCount: coachChat.messages.length,
        });
    } catch (error) {
        console.error("Coach route error:", error);
        res.status(500).json({ message: "Failed to get coach response." });
    }
});

// GET /api/coach/history/:userId - Get chat history
router.get("/history/:userId", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format." });
        }

        const currentUserId = (req.user.id || req.user.userId).toString();
        if (req.user.role !== "admin" && currentUserId !== req.params.userId) {
            return res.status(403).json({ message: "Unauthorized to access this coaching history." });
        }

        const coachChat = await CoachChat.findOne({ userId: req.params.userId });
        if (!coachChat) {
            return res.json({ messages: [] });
        }
        res.json({ messages: coachChat.messages });
    } catch (error) {
        console.error("Coach history error:", error);
        res.status(500).json({ message: "Failed to load chat history." });
    }
});

// DELETE /api/coach/history/:userId - Clear chat history (start fresh)
router.delete("/history/:userId", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format." });
        }

        const currentUserId = (req.user.id || req.user.userId).toString();
        if (req.user.role !== "admin" && currentUserId !== req.params.userId) {
            return res.status(403).json({ message: "Unauthorized to clear this coaching history." });
        }

        await CoachChat.findOneAndDelete({ userId: req.params.userId });
        res.json({ message: "Chat history cleared. Ready for a fresh coaching session! 🏸" });
    } catch (error) {
        console.error("Coach clear error:", error);
        res.status(500).json({ message: "Failed to clear chat history." });
    }
});

module.exports = router;
