const express = require("express");
const router = express.Router();
const ActivityFeed = require("../models/ActivityFeed");
const { authMiddleware } = require("../middleware/auth");
const User = require("../models/User");

router.get("/", authMiddleware, async (req, res, next) => {
    try {
        const tab = req.query.tab || "foryou";
        const limit = parseInt(req.query.limit) || 20;
        const cursor = req.query.cursor; // The _id of the last item

        const currentUser = await User.findById(req.user.id).select("skillLevel bookmarkedPosts");
        let matchStage = {};

        if (req.query.tag) matchStage.tags = req.query.tag;

        let lastDoc = null;
        if (cursor && cursor !== "null") {
            lastDoc = await ActivityFeed.findById(cursor);
        }

        const buildCursorQuery = (sortField, lastVal, tieBreakerField, tieBreakerVal) => {
            if (!lastDoc) return {};
            return {
                $or: [
                    { [sortField]: { $lt: lastVal } },
                    { [sortField]: lastVal, [tieBreakerField]: { $lt: tieBreakerVal } }
                ]
            };
        };

        if (tab === "saved") {
            matchStage.referenceId = { $in: currentUser.bookmarkedPosts || [] };
            matchStage.type = "post";
            if (lastDoc) matchStage.createdAt = { $lt: lastDoc.createdAt };
            
            const feedItems = await ActivityFeed.find(matchStage).sort({ createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        if (tab === "top") {
            if (lastDoc) {
                Object.assign(matchStage, buildCursorQuery("score", lastDoc.score, "createdAt", lastDoc.createdAt));
            }
            const feedItems = await ActivityFeed.find(matchStage).sort({ score: -1, createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        if (tab === "latest") {
            if (lastDoc) matchStage.createdAt = { $lt: lastDoc.createdAt };
            const feedItems = await ActivityFeed.find(matchStage).sort({ createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        // For You Tab
        if (currentUser && currentUser.skillLevel) {
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
                }
            ];

            if (lastDoc) {
                const lastDocTimeScore = new Date(lastDoc.createdAt).getTime();
                const lastDocSkillBoost = (lastDoc.authorSkillLevel === currentUser.skillLevel) ? 500000000 : 0;
                const lastDocFinalScore = (lastDoc.score || 0) + lastDocTimeScore + lastDocSkillBoost;
                
                pipeline.push({
                    $match: {
                        $or: [
                            { finalScore: { $lt: lastDocFinalScore } },
                            { finalScore: lastDocFinalScore, _id: { $lt: lastDoc._id } }
                        ]
                    }
                });
            }

            pipeline.push({ $sort: { finalScore: -1, _id: -1 } });
            pipeline.push({ $limit: limit + 1 });

            const feedItems = await ActivityFeed.aggregate(pipeline);
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;

            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        if (lastDoc) matchStage.createdAt = { $lt: lastDoc.createdAt };
        const feedItems = await ActivityFeed.find(matchStage).sort({ createdAt: -1 }).limit(limit + 1).lean();
        const hasMore = feedItems.length > limit;
        if (hasMore) feedItems.pop();
        const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;

        res.json({ feed: feedItems, hasMore, nextCursor });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
