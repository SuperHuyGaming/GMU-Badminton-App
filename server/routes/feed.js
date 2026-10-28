const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ActivityFeed = require("../models/ActivityFeed");
const { authMiddleware } = require("../middleware/auth");
const User = require("../models/User");
const { parseDateRange } = require("../utils/dateRange");
const feedCache = require("../utils/feedCache");

// Trending tags aggregation endpoint (Cached with 2-minute TTL)
router.get("/trending-tags", async (req, res, next) => {
	try {
		const cached = feedCache.get("trending_tags");
		if (cached) {
			if (req.headers["if-none-match"] === cached.etag) {
				return res.status(304).end();
			}
			res.setHeader("ETag", cached.etag);
			res.setHeader("X-Feed-Cache", "HIT");
			return res.json(cached.data);
		}

		const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
		let tagsAggregation = await ActivityFeed.aggregate([
			{
				$match: {
					status: { $nin: ["quarantined", "deleted"] },
					isFlagged: { $ne: true },
					createdAt: { $gte: twoDaysAgo },
					tags: { $exists: true, $ne: [] }
				}
			},
			{ $unwind: "$tags" },
			{
				$project: {
					tag: { $trim: { input: { $toLower: "$tags" } } }
				}
			},
			{ $match: { tag: { $ne: "" } } },
			{
				$group: {
					_id: "$tag",
					count: { $sum: 1 }
				}
			},
			{ $sort: { count: -1, _id: 1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					tag: "$_id",
					count: 1
				}
			}
		]);

		// Fallback to recent tags across all time if sparse in last 48h
		if (tagsAggregation.length < 3) {
			tagsAggregation = await ActivityFeed.aggregate([
				{
					$match: {
						status: { $nin: ["quarantined", "deleted"] },
						isFlagged: { $ne: true },
						tags: { $exists: true, $ne: [] }
					}
				},
				{ $unwind: "$tags" },
				{
					$project: {
						tag: { $trim: { input: { $toLower: "$tags" } } }
					}
				},
				{ $match: { tag: { $ne: "" } } },
				{
					$group: {
						_id: "$tag",
						count: { $sum: 1 }
					}
				},
				{ $sort: { count: -1, _id: 1 } },
				{ $limit: 10 },
				{
					$project: {
						_id: 0,
						tag: "$_id",
						count: 1
					}
				}
			]);
		}

		const payload = { tags: tagsAggregation };
		const etag = feedCache.set("trending_tags", payload, 120);
		res.setHeader("ETag", etag);
		res.setHeader("X-Feed-Cache", "MISS");
		return res.json(payload);
	} catch (err) {
		next(err);
	}
});

router.get("/", authMiddleware, async (req, res, next) => {
	try {
		const allowedTabs = ["saved", "latest", "top", "foryou", "activity", "recent_activity", "recent"];
		const tab = allowedTabs.includes(req.query.tab) ? req.query.tab : "foryou";
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
		const cursor = req.query.cursor; // The _id of the last item
		// Use the sessionTime passed from the client, or default to now if not provided
		const parsedSessionTime = req.query.sessionTime ? parseInt(req.query.sessionTime, 10) : NaN;
		const sessionTime = !isNaN(parsedSessionTime) ? new Date(parsedSessionTime) : new Date();

		const userDoc = await User.findById(req.user.id).select("skillLevel bookmarkedPosts savedPosts friends");
		const currentUser = userDoc || { skillLevel: "Beginner", bookmarkedPosts: [], savedPosts: [], friends: [] };

		const rawQuerySearch = typeof req.query.search === "string"
			? req.query.search
			: (typeof req.query.q === "string" ? req.query.q : (Array.isArray(req.query.search) && typeof req.query.search[0] === "string" ? req.query.search[0] : ""));
		const rawSearch = rawQuerySearch.trim().slice(0, 100);

		const { start: dateStart, end: dateEnd } = parseDateRange(req.query);

		// Cache check
		const cacheKey = `feed:${req.user?.id || 'anon'}:${tab}:${req.query.tag ? req.query.tag.trim().toLowerCase().replace(/^#/, '') : ''}:${req.query.category || ''}:${rawSearch}:${req.query.dateRange || ''}:${req.query.tzOffset || ''}:${dateStart ? dateStart.getTime() : ''}:${dateEnd ? dateEnd.getTime() : ''}:${cursor || 'root'}:${limit}:${currentUser.skillLevel}`;
		const cached = feedCache.get(cacheKey);
		if (cached) {
			if (req.headers["if-none-match"] === cached.etag) {
				return res.status(304).end();
			}
			res.setHeader("ETag", cached.etag);
			res.setHeader("X-Feed-Cache", "HIT");
			return res.json(cached.data);
		}

		const userId = req.user.id ? req.user.id.toString() : "";
		const userObjId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
		const friendIds = Array.isArray(currentUser.friends)
			? currentUser.friends.map(f => (f._id ? f._id.toString() : f.toString()))
			: [];
		const friendObjIds = friendIds
			.filter(id => mongoose.isValidObjectId(id))
			.map(id => new mongoose.Types.ObjectId(id));

		const visibilityOr = [
			{ visibility: 'PUBLIC' },
			{ visibility: { $exists: false } },
		];
		if (userObjId) {
			visibilityOr.push({ authorId: userObjId });
			visibilityOr.push({ authorId: userId });
		} else if (userId) {
			visibilityOr.push({ authorId: userId });
		}
		if (friendIds.length > 0) {
			visibilityOr.push({
				visibility: 'FRIENDS_ONLY',
				authorId: { $in: [...friendIds, ...friendObjIds] }
			});
		}

		let matchStage = {
			status: { $nin: ["quarantined", "deleted"] },
			isFlagged: { $ne: true },
			$or: visibilityOr
		};

		if (req.query.tag && typeof req.query.tag === "string") {
			const cleanTag = req.query.tag.trim().replace(/^#/, "").slice(0, 50);
			if (cleanTag) {
				const escaped = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				matchStage.tags = { $regex: new RegExp(`^#?${escaped}$`, "i") };
			}
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

		if (dateStart || dateEnd) {
			matchStage.createdAt = matchStage.createdAt || {};
			if (dateStart) matchStage.createdAt.$gte = dateStart;
			if (dateEnd) matchStage.createdAt.$lte = dateEnd;
		}

		if (rawSearch) {
			const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const searchRegex = new RegExp(escaped, 'i');
			const searchOr = [
				{ title: { $regex: searchRegex } },
				{ content: { $regex: searchRegex } },
				{ authorName: { $regex: searchRegex } },
				{ tags: searchRegex },
				{ "matchDetails.court": { $regex: searchRegex } },
				{ "matchDetails.partner": { $regex: searchRegex } },
				{ "matchDetails.opponents": searchRegex },
				{ "playerMatchmaking.preferredCourt": { $regex: searchRegex } },
				{ "gearDetails.brand": { $regex: searchRegex } },
				{ "gearDetails.gearType": { $regex: searchRegex } },
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

		if (tab === "saved") {
			const savedIds = [
				...(currentUser.savedPosts || []),
				...(currentUser.bookmarkedPosts || [])
			];
			matchStage.referenceId = { $in: savedIds };
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
			const payload = {
				feed: feedItems,
				hasMore,
				nextCursor,
				bookmarkedPosts: currentUser.bookmarkedPosts || [],
				savedPosts: currentUser.savedPosts || currentUser.bookmarkedPosts || []
			};
			const etag = feedCache.set(cacheKey, payload, 30);
			res.setHeader("ETag", etag);
			res.setHeader("X-Feed-Cache", "MISS");
			return res.json(payload);
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
			const payload = {
				feed: feedItems,
				hasMore,
				nextCursor,
				bookmarkedPosts: currentUser.bookmarkedPosts || [],
				savedPosts: currentUser.savedPosts || currentUser.bookmarkedPosts || []
			};
			const etag = feedCache.set(cacheKey, payload, 30);
			res.setHeader("ETag", etag);
			res.setHeader("X-Feed-Cache", "MISS");
			return res.json(payload);
		}

		if (tab === "recent_activity" || tab === "activity" || tab === "recent") {
			if (lastDoc) {
				matchStage.lastActivityAt = {
					...(matchStage.lastActivityAt || {}),
					$lt: lastDoc.lastActivityAt || lastDoc.createdAt
				};
			}
			const feedItems = await ActivityFeed.find(matchStage).sort({ isPinned: -1, lastActivityAt: -1, createdAt: -1 }).limit(limit + 1).lean();
			const hasMore = feedItems.length > limit;
			if (hasMore) feedItems.pop();
			const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;
			const payload = {
				feed: feedItems,
				hasMore,
				nextCursor,
				bookmarkedPosts: currentUser.bookmarkedPosts || [],
				savedPosts: currentUser.savedPosts || currentUser.bookmarkedPosts || []
			};
			const etag = feedCache.set(cacheKey, payload, 30);
			res.setHeader("ETag", etag);
			res.setHeader("X-Feed-Cache", "MISS");
			return res.json(payload);
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
							$cond: [{ $lt: ["$ageInHours", 0] }, 0, "$ageInHours"]
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

			if (isForYou) {
				pipeline.push({ $sort: { isPinned: -1, velocityScore: -1, _id: -1 } });
			} else {
				pipeline.push({ $sort: { isPinned: -1, score: -1, createdAt: -1, _id: -1 } });
			}
			pipeline.push({ $limit: limit + 1 });

			const feedItems = await ActivityFeed.aggregate(pipeline);
			const hasMore = feedItems.length > limit;
			if (hasMore) feedItems.pop();
			const nextCursor = feedItems.length > 0 ? feedItems[feedItems.length - 1]._id : null;

			const payload = {
				feed: feedItems,
				hasMore,
				nextCursor,
				bookmarkedPosts: currentUser.bookmarkedPosts || [],
				savedPosts: currentUser.savedPosts || currentUser.bookmarkedPosts || []
			};
			const etag = feedCache.set(cacheKey, payload, 30);
			res.setHeader("ETag", etag);
			res.setHeader("X-Feed-Cache", "MISS");
			return res.json(payload);
		};

		if (tab === "top") return await applyVelocityRanking(false);
		if (tab === "foryou") return await applyVelocityRanking(true);

		res.status(400).json({ message: "Invalid tab" });
	} catch (error) {
		next(error);
	}
});

module.exports = router;
