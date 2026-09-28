const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET: /api/matchmaking/discover
// Discover players and search for users
router.get("/discover", authMiddleware, async (req, res) => {
    try {
        const { search } = req.query;
        
        // Build base query (exclude self)
        const query = {
            _id: { $ne: req.user.userId },
        };

        // Add search filtering if provided
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { homeUniversity: { $regex: search, $options: "i" } }
            ];
        }

        // Fetch up to 50 users, sorted by most recently active
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
            .sort({ lastActive: -1 })
            .limit(50)
            .lean();

        res.json({ matches: potentialMatches });
    } catch (err) {
        console.error("Discovery error:", err);
        res.status(500).json({ message: "Server error during player discovery" });
    }
});

// GET: /api/matchmaking/generate-bracket
// Generates a mock 16-player knockout bracket tree
router.get("/generate-bracket", authMiddleware, async (req, res) => {
    try {
        // Fetch up to 16 users randomly to seed the bracket
        const users = await User.aggregate([
            { $sample: { size: 16 } },
            { $project: { name: 1 } }
        ]);

        // If we don't have enough users, fill with "TBD"
        while (users.length < 16) {
            users.push({ name: "TBD" });
        }

        // Shuffle seeds (already random from $sample, but good practice)
        const shuffled = users.sort(() => 0.5 - Math.random());

        // Helper to build recursive nodes
        let idCounter = 1;
        const buildNode = (depth, player1, player2) => {
            if (depth === 0) {
                // Leaf node (Round of 16)
                return {
                    id: idCounter++,
                    player1: player1.name,
                    player2: player2.name,
                    score1: null,
                    score2: null,
                    winner: null,
                    nextMatches: []
                };
            }
            
            // Build children (previous rounds)
            // A node at depth 1 needs 2 matches at depth 0
            const child1 = buildNode(depth - 1, shuffled.pop(), shuffled.pop());
            const child2 = buildNode(depth - 1, shuffled.pop(), shuffled.pop());

            return {
                id: idCounter++,
                player1: null, // to be decided
                player2: null,
                score1: null,
                score2: null,
                winner: null,
                nextMatches: [child1, child2]
            };
        };

        // We want a 16-player bracket. 16 players = 8 round-of-16 matches.
        // Depth 3 = Finals (1 match). Depth 2 = Semis (2 matches). Depth 1 = Quarters (4). Depth 0 = R16 (8).
        // The buildNode recursively consumes the `shuffled` array at the leaf nodes.
        const finals = buildNode(3, null, null);

        res.json(finals);
    } catch (err) {
        console.error("Bracket generation error:", err);
        res.status(500).json({ message: "Server error generating bracket" });
    }
});

module.exports = router;
