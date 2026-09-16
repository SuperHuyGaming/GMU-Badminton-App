// server/routes/coach.js
const express = require("express");
const router = express.Router();
const CoachChat = require("../models/CoachChat");
const User = require("../models/User");
const { chat } = require("../utils/aiCoach");
const rateLimit = require("express-rate-limit");

// Rate limit: 20 messages per minute per user
const coachLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { message: "You're sending messages too fast. Take a breather! 🏸" },
    keyGenerator: (req) => req.body.userId || req.ip,
});

// POST /api/coach/message - Send a message to the AI Coach
router.post("/message", coachLimiter, async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!userId || !message?.trim()) {
            return res.status(400).json({ message: "userId and message are required." });
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
        await CoachChat.findOneAndDelete({ userId: req.params.userId });
        res.json({ message: "Chat history cleared. Ready for a fresh coaching session! 🏸" });
    } catch (error) {
        console.error("Coach clear error:", error);
        res.status(500).json({ message: "Failed to clear chat history." });
    }
});

module.exports = router;
