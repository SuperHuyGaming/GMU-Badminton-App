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
        // Use the sessionTime passed from the client, or default to now if not provided
        const sessionTime = req.query.sessionTime ? new Date(parseInt(req.query.sessionTime)) : new Date();

        const userDoc = await User.findById(req.user.id).select("skillLevel bookmarkedPosts");
        const currentUser = userDoc || { skillLevel: "Beginner", bookmarkedPosts: [] };
        
        const mongoose = require('mongoose');
        let matchStage = {
            $or: [
                { visibility: 'PUBLIC' },
                { visibility: { $exists: false } }, // backward compatibility
                { authorId: new mongoose.Types.ObjectId(req.user.id) }
            ]
        };

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

        if (tab === "latest") {
            if (lastDoc) matchStage.createdAt = { $lt: lastDoc.createdAt };
            const feedItems = await ActivityFeed.find(matchStage).sort({ createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        // ALGORITHMIC VELOCITY RANKING (Reddit Hot / HN Style) for "Top" and "For You"
        const applyVelocityRanking = async (isForYou) => {
            const pipeline = [
                { $match: matchStage },
                {
                    $addFields: {
                        // Calculate age in hours relative to the fixed sessionTime
                        ageInHours: {
                            $divide: [
                                { $subtract: [sessionTime, "$createdAt"] },
                                1000 * 60 * 60
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        // Prevent negative age for posts created literally milliseconds after sessionTime
                        safeAgeInHours: {
                            $cond: [ { $lt: ["$ageInHours", 0] }, 0, "$ageInHours" ]
                        },
                        skillBoost: isForYou ? {
                            $cond: {
                                if: { $eq: ["$authorSkillLevel", currentUser.skillLevel] },
                                then: 1.5, // 50% score boost if they share the same skill level
                                else: 1
                            }
                        } : 1
                    }
                },
                {
                    $addFields: {
                        // score = (likes + comments + 1) / (ageInHours + 2)^1.5 * skillBoost
                        velocityScore: {
                            $multiply: [
                                {
                                    $divide: [
                                        { $add: [{ $max: ["$score", 0] }, 1] }, // numerator
                                        { $pow: [{ $add: ["$safeAgeInHours", 2] }, 1.5] } // denominator (gravity = 1.5)
                                    ]
                                },
                                "$skillBoost"
                            ]
                        }
                    }
                }
            ];

            if (lastDoc) {
                // We must recalculate the last document's exact velocityScore relative to the SAME sessionTime
                const lastDocAgeHours = Math.max(0, (sessionTime - new Date(lastDoc.createdAt)) / (1000 * 60 * 60));
                const lastDocSkillBoost = (isForYou && lastDoc.authorSkillLevel === currentUser.skillLevel) ? 1.5 : 1;
                const lastDocNumerator = Math.max(lastDoc.score || 0, 0) + 1;
                const lastDocDenominator = Math.pow(lastDocAgeHours + 2, 1.5);
                const lastDocVelocityScore = (lastDocNumerator / lastDocDenominator) * lastDocSkillBoost;

                pipeline.push({
                    $match: {
                        $or: [
                            { velocityScore: { $lt: lastDocVelocityScore } },
                            { velocityScore: lastDocVelocityScore, _id: { $lt: lastDoc._id } }
                        ]
                    }
                });
            }

            pipeline.push({ $sort: { velocityScore: -1, _id: -1 } });
            pipeline.push({ $limit: limit + 1 });

            const feedItems = await ActivityFeed.aggregate(pipeline);
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;

            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        };

        if (tab === "top") return await applyVelocityRanking(false);
        if (tab === "foryou") return await applyVelocityRanking(true);

        res.status(400).json({ message: "Invalid tab" });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
