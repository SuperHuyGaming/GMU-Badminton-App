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
        const limit = 20;
        const skip = (page - 1) * limit;

        // Fetch current user to personalize feed
        const currentUser = await User.findById(req.user.id).select("skillLevel");
        
        let matchStage = {}; // Fetch all

        let sortStage = { createdAt: -1 }; // Default chronological

        if (currentUser && currentUser.skillLevel) {
            // ALGORITHMIC PERSONALIZATION (Item 10)
            // Instead of pure chronological, we use an aggregation pipeline to boost 
            // posts from users with the SAME skillLevel, while keeping newer posts relevant.
            
            const pipeline = [
                { $match: matchStage },
                {
                    $addFields: {
                        // Calculate a "relevance" score
                        // Base score comes from likes/comments (Item 8 seeding)
                        // Add +50 points if the author has the same skill level
                        // Add points based on recency (newer = higher)
                        timeScore: { $toLong: "$createdAt" },
                        skillBoost: {
                            $cond: {
                                if: { $eq: ["$authorSkillLevel", currentUser.skillLevel] },
                                then: 500000000, // Big boost to float them up slightly
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
                { $limit: limit + 1 } // fetch 1 extra to check if hasMore
            ];

            const feedItems = await ActivityFeed.aggregate(pipeline);
            
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();

            return res.json({ feed: feedItems, hasMore });
        }

        // Fallback to purely chronological if no user skill level
        const feedItems = await ActivityFeed.find(matchStage)
            .sort(sortStage)
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
