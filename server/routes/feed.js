const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ActivityFeed = require("../models/ActivityFeed");
const { authMiddleware } = require("../middleware/auth");
const User = require("../models/User");
const { parseDateRange } = require("../utils/dateRange");

router.get("/", authMiddleware, async (req, res, next) => {
    try {
        const allowedTabs = ["saved", "latest", "top", "foryou"];
        const tab = allowedTabs.includes(req.query.tab) ? req.query.tab : "foryou";
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const cursor = req.query.cursor; // The _id of the last item
        // Use the sessionTime passed from the client, or default to now if not provided
        const parsedSessionTime = req.query.sessionTime ? parseInt(req.query.sessionTime, 10) : NaN;
        const sessionTime = !isNaN(parsedSessionTime) ? new Date(parsedSessionTime) : new Date();

        const userDoc = await User.findById(req.user.id).select("skillLevel bookmarkedPosts");
        const currentUser = userDoc || { skillLevel: "Beginner", bookmarkedPosts: [] };
        
        let matchStage = {
            $or: [
                { visibility: 'PUBLIC' },
                { visibility: { $exists: false } }, // backward compatibility
                { authorId: mongoose.isValidObjectId(req.user.id) ? new mongoose.Types.ObjectId(req.user.id) : req.user.id }
            ]
        };

        if (req.query.tag && typeof req.query.tag === "string") {
            matchStage.tags = req.query.tag.trim().slice(0, 50);
        }

        if (req.query.category && typeof req.query.category === "string" && req.query.category.toLowerCase() !== "all") {
            const cat = req.query.category.trim().toLowerCase().slice(0, 50);
            if (cat === "find_partner") {
                matchStage.category = { $in: ["find_partner", "meetup_rally"] };
            } else if (cat === "gear_exchange") {
                matchStage.category = { $in: ["gear_exchange", "gear_review"] };
            } else if (cat === "match_result") {
                const matchResultOr = [{ category: "match_result" }, { type: "match" }];
                if (matchStage.$and) {
                    matchStage.$and.push({ $or: matchResultOr });
                } else {
                    const visibilityOr = matchStage.$or;
                    delete matchStage.$or;
                    matchStage.$and = [
                        { $or: visibilityOr },
                        { $or: matchResultOr }
                    ];
                }
            } else if (cat === "general") {
                matchStage.category = "general";
                matchStage.type = { $ne: "match" };
            } else {
                matchStage.category = cat;
            }
        }

        const { start: dateStart, end: dateEnd } = parseDateRange(req.query);
        if (dateStart || dateEnd) {
            matchStage.createdAt = matchStage.createdAt || {};
            if (dateStart) matchStage.createdAt.$gte = dateStart;
            if (dateEnd) matchStage.createdAt.$lte = dateEnd;
        }

        const rawSearch = (req.query.search || req.query.q || "").trim();
        if (rawSearch) {
            const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
            const searchRegex = new RegExp(escaped, 'i');
            const searchOr = [
                { title: { $regex: searchRegex } },
                { content: { $regex: searchRegex } },
                { authorName: { $regex: searchRegex } },
                { tags: searchRegex },
                { "matchDetails.court": { $regex: searchRegex } },
                { "playerMatchmaking.preferredCourt": { $regex: searchRegex } },
                { team1: searchRegex },
                { team2: searchRegex }
            ];
            
            if (matchStage.$and) {
                matchStage.$and.push({ $or: searchOr });
            } else {
                const visibilityOr = matchStage.$or;
                delete matchStage.$or;
                matchStage.$and = [
                    { $or: visibilityOr },
                    { $or: searchOr }
                ];
            }
        }

        let lastDoc = null;
        if (cursor && cursor !== "null") {
            if (!mongoose.isValidObjectId(cursor)) {
                return res.status(400).json({ message: "Invalid cursor ID format." });
            }
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
            if (lastDoc) {
                matchStage.createdAt = {
                    ...(matchStage.createdAt || {}),
                    $lt: lastDoc.createdAt
                };
            }
            
            const feedItems = await ActivityFeed.find(matchStage).sort({ createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = feedItems.length > limit;
            if (hasMore) feedItems.pop();
            const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
            return res.json({ feed: feedItems, hasMore, nextCursor, bookmarkedPosts: currentUser.bookmarkedPosts || [] });
        }

        if (tab === "latest") {
            if (lastDoc) {
                matchStage.createdAt = {
                    ...(matchStage.createdAt || {}),
                    $lt: lastDoc.createdAt
                };
            }
            const feedItems = await ActivityFeed.find(matchStage).sort({ isPinned: -1, createdAt: -1 }).limit(limit + 1).lean();
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
                        discoveryBoost: isForYou ? {
                            $multiply: [
                                {
                                    $cond: {
                                        if: { $eq: ["$authorSkillLevel", currentUser.skillLevel] },
                                        then: 1.5, // 50% score boost if they share the same skill level
                                        else: 1
                                    }
                                },
                                {
                                    $cond: {
                                        if: { $lt: ["$safeAgeInHours", 1] }, // New post freshness boost (< 1 hour old)
                                        then: 5, // Massive multiplier to force new posts to the top of "For You"
                                        else: 1
                                    }
                                }
                            ]
                        } : 1
                    }
                },
                {
                    $addFields: {
                        // score = (likes + comments + 1) / (ageInHours + 2)^1.5 * discoveryBoost
                        velocityScore: {
                            $multiply: [
                                {
                                    $divide: [
                                        { $add: [{ $max: ["$score", 0] }, 1] }, // numerator
                                        { $pow: [{ $add: ["$safeAgeInHours", 2] }, 1.5] } // denominator (gravity = 1.5)
                                    ]
                                },
                                "$discoveryBoost"
                            ]
                        }
                    }
                }
            ];

            if (lastDoc) {
                // We must recalculate the last document's exact velocityScore relative to the SAME sessionTime
                const lastDocAgeHours = Math.max(0, (sessionTime - new Date(lastDoc.createdAt)) / (1000 * 60 * 60));
                let lastDocBoost = 1;
                if (isForYou) {
                    const skillB = lastDoc.authorSkillLevel === currentUser.skillLevel ? 1.5 : 1;
                    const freshB = lastDocAgeHours < 1 ? 5 : 1;
                    lastDocBoost = skillB * freshB;
                }
                
                const lastDocNumerator = Math.max(lastDoc.score || 0, 0) + 1;
                const lastDocDenominator = Math.pow(lastDocAgeHours + 2, 1.5);
                const lastDocVelocityScore = (lastDocNumerator / lastDocDenominator) * lastDocBoost;

                pipeline.push({
                    $match: {
                        $or: [
                            { velocityScore: { $lt: lastDocVelocityScore } },
                            { velocityScore: lastDocVelocityScore, _id: { $lt: lastDoc._id } }
                        ]
                    }
                });
            }

            pipeline.push({ $sort: { isPinned: -1, velocityScore: -1, _id: -1 } });
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
