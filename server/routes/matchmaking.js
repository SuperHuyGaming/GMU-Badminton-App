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

        // 2. Filter by Skill Level
        if (currentUser.preferredPlay && currentUser.preferredPlay !== "Any") {
            query.preferredPlay = { $in: [currentUser.preferredPlay, "Any"] };
        }

        // 3. Geolocation Proximity ($near query)
        // Check if the user has a valid geolocation set (not default 0,0)
        const hasLocation = currentUser.location && 
                            currentUser.location.coordinates && 
                            (currentUser.location.coordinates[0] !== 0 || currentUser.location.coordinates[1] !== 0);

        if (hasLocation) {
            const maxDistanceMeters = (currentUser.searchRadius || 50) * 1609.34; // Convert miles to meters
            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: currentUser.location.coordinates
                    },
                    $maxDistance: maxDistanceMeters
                }
            };
        }

        // To add some randomness and limit payload size, we limit to 20 users
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
            .limit(20)
            .lean();

        res.json({ matches: potentialMatches });
    } catch (err) {
        console.error("Matchmaking error:", err);
        res.status(500).json({ message: "Server error during matchmaking discovery" });
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
