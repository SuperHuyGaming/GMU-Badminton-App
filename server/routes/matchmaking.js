const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET: /api/matchmaking/discover
// Discover players matching the logged-in user's preferences
router.get("/discover", authMiddleware, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        // We will build a dynamic MongoDB query based on the user's preferences
        const query = {
            _id: { $ne: currentUser._id }, // Don't match with yourself
        };

        // 1. Filter by Home University if they have one set
        if (currentUser.homeUniversity && currentUser.homeUniversity !== "Other") {
            query.homeUniversity = currentUser.homeUniversity;
        }

        // 2. Filter by Skill Level (exact match for now, or could do $+/- 1 level)
        // If preferredPlay is "Any", ignore playstyle filter.
        if (currentUser.preferredPlay && currentUser.preferredPlay !== "Any") {
            query.preferredPlay = { $in: [currentUser.preferredPlay, "Any"] };
        }

        // To add some randomness and limit payload size, we limit to 20 users
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive")
            .limit(20)
            .lean();

        res.json({ matches: potentialMatches });
    } catch (err) {
        console.error("Matchmaking error:", err);
        res.status(500).json({ message: "Server error during matchmaking discovery" });
    }
});

module.exports = router;
