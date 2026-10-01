const express = require("express");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const discoverLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300, // Increased for live search debouncing
    message: { message: "Too many discovery requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

const router = express.Router();

const toIdString = (item) => {
    if (!item) return null;
    const raw = item._id !== undefined ? item._id : item;
    if (!raw) return null;
    const str = typeof raw.toString === "function" ? raw.toString() : String(raw);
    return str && str !== "[object Object]" ? str : null;
};

// GET /api/matchmaking/presence - Task 7
router.get("/presence", authMiddleware, async (req, res) => {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUsers = await User.find({ 
            lastActive: { $gte: fiveMinsAgo },
            hideFromSearch: { $ne: true }
        })
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
        let { checkInLocation, preferredTimeOfDay } = req.body;
        checkInLocation = checkInLocation ? String(checkInLocation) : undefined;
        preferredTimeOfDay = preferredTimeOfDay ? String(preferredTimeOfDay) : undefined;

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
router.get("/discover", authMiddleware, discoverLimiter, async (req, res) => {
    try {
        const mongoose = require("mongoose");
        const search = req.query.search ? String(req.query.search) : undefined;
        const skill = req.query.skill ? String(req.query.skill) : undefined;
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const campus = req.query.campus ? String(req.query.campus) : undefined;
        const time = req.query.time ? String(req.query.time) : undefined;
        
        const escapeRegex = (string) => {
            if (typeof string !== "string") return "";
            return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        };
        
        const currentUser = await User.findById(req.user.userId).lean();
        
        // Collect all IDs that must be excluded from discovery
        const excludedIds = [toIdString(req.user.userId)].filter(Boolean);
        
        // Only exclude friends/pending if we are NOT actively searching.
        // If we are searching, we want a universal directory search (including friends).
        if (!search && currentUser) {
            if (Array.isArray(currentUser.friends)) {
                currentUser.friends.forEach(f => {
                    const idStr = toIdString(f);
                    if (idStr) excludedIds.push(idStr);
                });
            }
            if (Array.isArray(currentUser.friendRequests)) {
                currentUser.friendRequests.forEach(f => {
                    const idStr = toIdString(f);
                    if (idStr) excludedIds.push(idStr);
                });
            }
            if (Array.isArray(currentUser.sentFriendRequests)) {
                currentUser.sentFriendRequests.forEach(f => {
                    const idStr = toIdString(f);
                    if (idStr) excludedIds.push(idStr);
                });
            }
        }

        const excludedObjectIds = excludedIds.map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch(e) { return null; }
        }).filter(Boolean);

        const currentUserFriendsIds = currentUser && Array.isArray(currentUser.friends) 
            ? currentUser.friends.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch(e) { return null; }
            }).filter(Boolean)
            : [];

        // Helper to determine friendship status ("none", "pending", "friends")
        const getFriendshipStatus = (targetId) => {
            if (!currentUser || !targetId) return "none";
            const targetStr = toIdString(targetId);
            if (!targetStr) return "none";
            if (currentUser.friends?.some(id => toIdString(id) === targetStr)) return "friends";
            if (currentUser.sentFriendRequests?.some(id => toIdString(id) === targetStr)) return "pending";
            if (currentUser.friendRequests?.some(id => toIdString(id) === targetStr)) return "pending";
            return "none";
        };

        // Build base query (exclude self, existing friends, and pending requests, and users who hide from search)
        const query = {
            _id: { $nin: excludedObjectIds },
            hideFromSearch: { $ne: true }
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
            query.skillLevel = { $in: mapSkill(cleanSkill) };
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
            try {
                query._id = { $nin: excludedObjectIds, $lt: new mongoose.Types.ObjectId(cursor) };
            } catch(e) {}
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

        // Fetch up to 50 users via Aggregation
        const potentialMatches = await User.aggregate([
            { $match: query },
            { $sort: { _id: -1 } },
            { $limit: 50 },
            {
                $addFields: {
                    mutualFriendsRaw: {
                        $setIntersection: [
                            { $ifNull: ["$friends", []] },
                            currentUserFriendsIds
                        ]
                    }
                }
            },
            {
                $addFields: {
                    mutualFriendsCount: { $size: { $ifNull: ["$mutualFriendsRaw", []] } },
                    mutualFriendsSample: { $slice: [{ $ifNull: ["$mutualFriendsRaw", []] }, 2] }
                }
            },
            
            {
                $lookup: {
                    from: "users",
                    localField: "mutualFriendsSample",
                    foreignField: "_id",
                    as: "mutualFriendsObjects"
                }
            },

                $project: {
                    name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, 
                    profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, 
                    checkInLocation: 1, preferredTimeOfDay: 1, inQueue: 1, singlesElo: 1,
                    mutualFriendsCount: 1, 
                    mutualFriendsSample: {
                        $map: {
                            input: "$mutualFriendsObjects",
                            as: "friend",
                            in: {
                                _id: "$friend._id",
                                name: "$friend.name",
                                profilePic: "$friend.profilePic"
                            }
                        }
                    }
                }
        ]);

        const hydratedMatches = potentialMatches.map(player => ({
            ...player,
            friendshipStatus: getFriendshipStatus(player?._id || player)
        }));

        // Fetch "People You May Know" using Recommendation Engine V2
        let recommended = [];
        if (currentUser) {
            const userElo = currentUser.singlesElo || 1200;
            const userTime = currentUser.preferredTimeOfDay;
            const userUni = currentUser.homeUniversity;

            const timeScoreExpr = userTime ? {
                $cond: [{ $eq: ["$preferredTimeOfDay", userTime] }, 3, 0]
            } : 0;

            const uniScoreExpr = userUni ? {
                $cond: [{ $eq: ["$homeUniversity", userUni] }, 2, 0]
            } : 0;

            const rawRecommended = await User.aggregate([
                {
                    $match: {
                        _id: { $nin: excludedObjectIds },
                        hideFromSearch: { $ne: true }
                    }
                },
                {
                    $addFields: {
                        eloDiff: { $abs: { $subtract: [{ $ifNull: ["$singlesElo", 1200] }, userElo] } },
                        timeScore: timeScoreExpr,
                        uniScore: uniScoreExpr
                    }
                },
                {
                    $addFields: {
                        eloScore: {
                            $cond: [
                                { $lte: ["$eloDiff", 100] },
                                2,
                                {
                                    $cond: [
                                        { $lte: ["$eloDiff", 300] },
                                        1,
                                        0
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        totalScore: { $add: ["$timeScore", "$uniScore", "$eloScore"] },
                        mutualFriendsRaw: {
                            $setIntersection: [
                                { $ifNull: ["$friends", []] },
                                currentUserFriendsIds
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        mutualFriendsCount: { $size: { $ifNull: ["$mutualFriendsRaw", []] } },
                        mutualFriendsSample: { $slice: [{ $ifNull: ["$mutualFriendsRaw", []] }, 2] }
                    }
                },
                {
                    $sort: { totalScore: -1, _id: -1 }
                },
                {
                    $limit: 4
                },
                
            {
                $lookup: {
                    from: "users",
                    localField: "mutualFriendsSample",
                    foreignField: "_id",
                    as: "mutualFriendsObjects"
                }
            },

                    $project: {
                        name: 1, bio: 1, skillLevel: 1, preferredPlay: 1, racket: 1, 
                        profilePic: 1, homeUniversity: 1, lastActive: 1, location: 1, 
                        singlesElo: 1, preferredTimeOfDay: 1,
                        mutualFriendsCount: 1, 
                        mutualFriendsSample: {
                            $map: {
                                input: "$mutualFriendsObjects",
                                as: "friend",
                                in: {
                                    _id: "$friend._id",
                                    name: "$friend.name",
                                    profilePic: "$friend.profilePic"
                                }
                            }
                        }
                    }
            ]);

            recommended = rawRecommended.map(player => ({
                ...player,
                friendshipStatus: getFriendshipStatus(player?._id || player)
            }));
        }

        res.json({ matches: hydratedMatches, recommended });
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
            { $match: { hideFromSearch: { $ne: true } } },
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
        const buildNode = (depth) => {
            if (depth === 0) {
                // Leaf node (Round of 16)
                const p1 = shuffled.pop() || { name: "TBD" };
                const p2 = shuffled.pop() || { name: "TBD" };
                return {
                    id: idCounter++,
                    player1: p1.name,
                    player2: p2.name,
                    score1: null,
                    score2: null,
                    winner: null,
                    nextMatches: []
                };
            }
            
            // Build children (previous rounds)
            // A node at depth 1 needs 2 matches at depth 0
            const child1 = buildNode(depth - 1);
            const child2 = buildNode(depth - 1);

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
        const finals = buildNode(3);

        res.json(finals);
    } catch (err) {
        console.error("Bracket generation error:", err);
        res.status(500).json({ message: "Server error generating bracket" });
    }
});

module.exports = router;
