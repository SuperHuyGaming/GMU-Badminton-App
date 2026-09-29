const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// GET /api/matchmaking/presence - Task 7
router.get("/presence", authMiddleware, async (req, res) => {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUsers = await User.find({ lastActive: { $gte: fiveMinsAgo } })
            .select("name _id")
            .lean();
        res.json({ onlineUsers: activeUsers });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/matchmaking/queue/join - Task 9
router.post("/queue/join", authMiddleware, async (req, res) => {
    try {
        const { checkInLocation, preferredTimeOfDay } = req.body;
        await User.findByIdAndUpdate(req.user.userId, { 
            inQueue: true, 
            queueJoinedAt: new Date(),
            ...(checkInLocation && { checkInLocation }),
            ...(preferredTimeOfDay && { preferredTimeOfDay })
        });
        res.json({ message: "Joined queue successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error joining queue" });
    }
});

// POST /api/matchmaking/queue/leave - Task 9
router.post("/queue/leave", authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.userId, { inQueue: false });
        res.json({ message: "Left queue successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error leaving queue" });
    }
});

// GET: /api/matchmaking/discover
// Discover players and search for users
router.get("/discover", authMiddleware, async (req, res) => {
    try {
        const { search, skill, cursor, campus, time } = req.query;
        const escapeRegex = (string) => {
            if (typeof string !== "string") return "";
            return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        };
        
        const currentUser = await User.findById(req.user.userId).lean();
        
        // Build base query (exclude self)
        const query = {
            _id: { $ne: req.user.userId },
        };

        // Add skill filter
        if (skill && typeof skill === 'string' && skill.trim() !== 'All') {
            const cleanSkill = skill.trim().slice(0, 50);
            const mapSkill = (filterValue) => {
                switch (filterValue) {
                    case 'Beginner': return ['D Level', 'E Level', 'Beginner'];
                    case 'Intermediate': return ['C Level', 'Intermediate'];
                    case 'Advanced': return ['A Level', 'B Level', 'Advanced'];
                    default: return [filterValue];
                }
            };
            const allowedSkillLevels = mapSkill(cleanSkill);
            query.skillLevel = { $in: allowedSkillLevels };
        }

        // Add search filtering if provided
        if (search) {
            const sanitizedSearch = escapeRegex(search);
            if (sanitizedSearch) {
                query.$or = [
                    { name: { $regex: sanitizedSearch, $options: "i" } },
                    { homeUniversity: { $regex: sanitizedSearch, $options: "i" } }
                ];
            }
        }

        // Cursor-Based Pagination
        if (cursor) {
            query._id = { $lt: cursor };
        }

        // Geospatial Court Check-in Search
        if (campus && campus !== "All") {
            query.checkInLocation = campus;
        }

        // Recommendation Engine V2 (time of day)
        if (time && time !== "All") {
            if (query.$or) {
                query.$and = [
                    { $or: query.$or },
                    { $or: [{ preferredTimeOfDay: time }, { preferredTimeOfDay: "Any" }] }
                ];
                delete query.$or;
            } else {
                query.$or = [{ preferredTimeOfDay: time }, { preferredTimeOfDay: "Any" }];
            }
        }

        // Fetch up to 50 users
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location checkInLocation preferredTimeOfDay inQueue")
            .sort({ _id: -1 })
            .limit(50)
            .lean();

        // Fetch "People You May Know" (same university, if exists)
        let recommended = [];
        if (currentUser && currentUser.homeUniversity) {
            recommended = await User.find({
                _id: { $ne: req.user.userId },
                homeUniversity: currentUser.homeUniversity
            })
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
            .limit(4)
            .lean();
        }

        res.json({ matches: potentialMatches, recommended });
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
