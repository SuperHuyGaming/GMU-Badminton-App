const express = require("express");
const router = express.Router();
const ActivityFeed = require("../models/ActivityFeed");
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");

// GET /api/feed
// Now uses the unified ActivityFeed collection (Item 8)
// And implements Algorithmic Personalization (Item 10)
router.get("/", authMiddleware, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const tab = req.query.tab || "foryou"; // "foryou", "top", "latest"
        const limit = 20;
        const skip = (page - 1) * limit;

        // Fetch current user to personalize feed
        const currentUser = await User.findById(req.user.id).select("skillLevel");
        
        let matchStage = {}; // Fetch all

        if (tab === "top") {
            const feedItems = await ActivityFeed.find(matchStage)
                .sort({ score: -1, createdAt: -1 }) // Sort purely by score (likes+comments)
                .skip(skip)
                .limit(limit + 1)
                .lean();

            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            return res.json({ feed: feedItems, hasMore });
        }

        if (tab === "latest") {
            const feedItems = await ActivityFeed.find(matchStage)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit + 1)
                .lean();

            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            return res.json({ feed: feedItems, hasMore });
        }

        // Default to "foryou"
        if (currentUser && currentUser.skillLevel) {
            // ALGORITHMIC PERSONALIZATION (Item 10)
            const pipeline = [
                { $match: matchStage },
                {
                    $addFields: {
                        timeScore: { $toLong: "$createdAt" },
                        skillBoost: {
                            $cond: {
                                if: { $eq: ["$authorSkillLevel", currentUser.skillLevel] },
                                then: 500000000, 
                                else: 0
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        finalScore: { $add: ["$score", "$timeScore", "$skillBoost"] }
                    }
                },
                { $sort: { finalScore: -1 } },
                { $skip: skip },
                { $limit: limit + 1 }
            ];

            const feedItems = await ActivityFeed.aggregate(pipeline);
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();

            return res.json({ feed: feedItems, hasMore });
        }

        // Fallback to purely chronological if no user skill level
        const feedItems = await ActivityFeed.find(matchStage)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit + 1)
            .lean();

        const hasMore = feedItems.length > limit;
        if (hasMore) feedItems.pop();

        res.json({ feed: feedItems, hasMore });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
