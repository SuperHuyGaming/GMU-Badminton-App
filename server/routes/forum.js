const express = require("express");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const { analyzeContent } = require("../utils/aiModeration");
const { evaluateSpamHeuristics } = require("../utils/spamDetector");
const { parseDateRange } = require("../utils/dateRange");
const feedCache = require("../utils/feedCache");
const router = express.Router();

const escapeHtml = (str) => {
	if (!str || typeof str !== "string") return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
};

// Helper to shorten long comments in notifications
const truncateText = (text, maxLength = 40) => {
	if (!text) return "";
	return text.length > maxLength
		? text.substring(0, maxLength - 3) + "..."
		: text;
};

// 1. RATE LIMITER
const postLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	skip: (req) => req.method === "OPTIONS",
	message: {
		message: "You are posting too fast. Please wait a few minutes.",
	},
});


// 2. THE UPGRADED AI SPAM ENGINE
const checkSpam = async (text) => {
	const result = await analyzeContent(text);
	return result.isFlagged;
};

const hydrateWithPictures = async (data) => {
	const posts = Array.isArray(data) ? data : [data];
	const userIds = new Set();
	
	posts.forEach(post => {
		if (post.authorId) userIds.add(post.authorId.toString());
		if (Array.isArray(post.likedBy)) post.likedBy.forEach(id => userIds.add(id.toString()));
		
		post.comments?.forEach(comment => {
			if (comment.authorId) userIds.add(comment.authorId.toString());
			if (Array.isArray(comment.likedBy)) comment.likedBy.forEach(id => userIds.add(id.toString()));
			
			comment.replies?.forEach(reply => {
				if (reply.authorId) userIds.add(reply.authorId.toString());
				if (Array.isArray(reply.likedBy)) reply.likedBy.forEach(id => userIds.add(id.toString()));
			});
		});
	});

	const users = await User.find({ _id: { $in: Array.from(userIds) } }).select("_id name profilePic role badges stats").lean();
	const userMap = {};
	users.forEach(
		(u) =>
			(userMap[u._id.toString()] = {
				name: u.name,
				profilePic: u.profilePic,
				role: u.role || "user",
				badges: Array.isArray(u.badges) ? u.badges : [],
				streak: u.stats?.winStreak || 0,
			}),
	);

	const attach = (post) => {
		const authorInfo = userMap[post.authorId?.toString()];
		post.authorPic = authorInfo?.profilePic || "";
		post.authorRole = authorInfo?.role || "user";
		post.authorBadges = authorInfo?.badges || [];
		post.authorStreak = authorInfo?.streak || 0;
		post.likedByDetails = Array.isArray(post.likedBy)
			? post.likedBy.map((id) => ({
					id,
					name: userMap[id.toString()]?.name || "Unknown",
					profilePic: userMap[id.toString()]?.profilePic || "",
				}))
			: [];

		post.comments?.forEach((comment) => {
			comment.authorPic =
				userMap[comment.authorId?.toString()]?.profilePic || "";
			comment.authorRole = userMap[comment.authorId?.toString()]?.role || "user";
			comment.authorBadges = userMap[comment.authorId?.toString()]?.badges || [];
			comment.authorStreak = userMap[comment.authorId?.toString()]?.streak || 0;
			comment.likedByDetails = Array.isArray(comment.likedBy)
				? comment.likedBy.map((id) => ({
						id,
						name: userMap[id.toString()]?.name || "Unknown",
						profilePic: userMap[id.toString()]?.profilePic || "",
					}))
				: [];

			comment.replies?.forEach((reply) => {
				reply.authorPic =
					userMap[reply.authorId?.toString()]?.profilePic || "";
				reply.authorRole = userMap[reply.authorId?.toString()]?.role || "user";
				reply.authorBadges = userMap[reply.authorId?.toString()]?.badges || [];
				reply.authorStreak = userMap[reply.authorId?.toString()]?.streak || 0;
				reply.likedByDetails = Array.isArray(reply.likedBy)
					? reply.likedBy.map((id) => ({
							id,
							name: userMap[id.toString()]?.name || "Unknown",
							profilePic:
								userMap[id.toString()]?.profilePic || "",
						}))
					: [];
			});
		});
		return post;
	};

	if (Array.isArray(data)) return data.map(attach);
	return attach(data);
};

// ==========================================
// NOTIFICATIONS
// ==========================================

// ==========================================

// ==========================================
// ACTIVE ONLINE USERS PRESENCE
// ==========================================
router.get("/online-users", (req, res) => {
	const onlineUsersMap = req.app.get("onlineUsers");
	const onlineUserIds = onlineUsersMap ? Array.from(onlineUsersMap.keys()) : [];
	res.json({ onlineUserIds });
});

// TRENDING TAGS (Cached with 2-minute TTL)
// ==========================================
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
		let tagsAggregation = await Post.aggregate([
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

		if (tagsAggregation.length < 3) {
			tagsAggregation = await Post.aggregate([
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

router.get("/share/:postId", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.postId)) {
            return res.status(404).send("Post not found");
        }

        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).send("Post not found");
        
        const frontendUrl = (process.env.FRONTEND_URL || "https://gmu-badminton-app.onrender.com").replace(/\/+$/, "");
        const rawTitle = post.authorName ? `${post.authorName} on GMU Badminton` : "GMU Badminton Post";
        let rawDescription = post.content || "Check out this discussion on GMU Badminton!";
        if (rawDescription.length > 150) rawDescription = rawDescription.substring(0, 150) + "...";
        
        const rawImageUrl = (post.imageUrls && post.imageUrls.length > 0) ? post.imageUrls[0] : (post.imageUrl || "https://res.cloudinary.com/dcb4ilgpy/image/upload/v1727221064/default-preview_h7xk6p.png");
        const safePostId = encodeURIComponent(post._id.toString());
        const targetUrl = `${frontendUrl}/post/${safePostId}`;

        const safeTitle = escapeHtml(rawTitle);
        const safeDescription = escapeHtml(rawDescription);
        const safeImageUrl = escapeHtml(rawImageUrl);
        const safeTargetUrl = escapeHtml(targetUrl);
        const jsonTargetUrl = JSON.stringify(targetUrl);

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:url" content="${safeTargetUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>${safeTitle}</title>
    <script>
        // Redirect immediately to the frontend deep link
        window.location.href = ${jsonTargetUrl};
    </script>
</head>
<body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:20vh;">
    <h2>Redirecting you to the post...</h2>
    <p>If you are not redirected automatically, <a href="${safeTargetUrl}" style="color:#00BFFF;">click here</a>.</p>
</body>
</html>`;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    } catch (e) {
        console.error("Error generating share link:", e);
        res.status(500).send("Error generating preview");
    }
});
router.get("/notifications/:userId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== req.params.userId) {
			return res.status(403).json({ message: "Unauthorized to access these notifications." });
		}

		const notifs = await Notification.find({
			targetUserId: req.params.userId,
		})
			.sort({ time: -1 })
			.limit(30);
		res.json(notifs);
	} catch (error) {
		res.status(500).json({ message: "Error fetching notifications" });
	}
});

router.put("/notifications/:userId/read", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== req.params.userId) {
			return res.status(403).json({ message: "Unauthorized to update these notifications." });
		}

		await Notification.updateMany(
			{ targetUserId: req.params.userId, read: false },
			{ read: true },
		);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ message: "Error updating notifications" });
	}
});

router.put("/notifications/single/:notifId/read", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.notifId)) {
			return res.status(400).json({ message: "Invalid notification ID format." });
		}

		const notif = await Notification.findById(req.params.notifId);
		if (!notif) return res.status(404).json({ message: "Notification not found" });

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== notif.targetUserId?.toString()) {
			return res.status(403).json({ message: "Unauthorized to update this notification." });
		}

		notif.read = true;
		await notif.save();
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ message: "Error updating notification" });
	}
});

const sendNotification = async (io, targetUserId, message, link) => {
	if (!targetUserId || targetUserId === "000000000000000000000000") return;
	const notif = new Notification({ targetUserId, message, link });
	await notif.save();
	if (io) io.to(targetUserId.toString()).emit("newNotification", notif);
};

// ==========================================
// POSTS (FETCH & CREATE)
// ==========================================
const ALLOWED_CATEGORIES = [
	'general',
	'match_result',
	'gear_review',
	'meetup_rally',
	'training',
	'find_partner',
	'challenge_match',
	'qa_forum',
	'gear_exchange'
];

const parsePlayerMatchmaking = (pm) => {
	if (!pm || typeof pm !== 'object') return undefined;
	return {
		skillLevelRequired: pm.skillLevelRequired ? xss(String(pm.skillLevelRequired).trim()).slice(0, 50) : 'Any',
		format: pm.format ? xss(String(pm.format).trim()).slice(0, 50) : 'Doubles',
		preferredCourt: pm.preferredCourt ? xss(String(pm.preferredCourt).trim()).slice(0, 100) : 'RAC Courts 1-3',
		rallyDate: pm.rallyDate ? new Date(pm.rallyDate) : undefined,
		timeWindow: pm.timeWindow ? xss(String(pm.timeWindow).trim()).slice(0, 50) : '',
		slotsNeeded: typeof pm.slotsNeeded === 'number' && pm.slotsNeeded > 0 ? Math.min(10, pm.slotsNeeded) : 1,
		rsvpList: Array.isArray(pm.rsvpList) ? pm.rsvpList.map(r => ({
			userId: String(r.userId || ''),
			userName: xss(String(r.userName || 'Player')).slice(0, 60),
			avatarUrl: r.avatarUrl ? xss(String(r.avatarUrl).trim()) : '',
			status: r.status === 'waitlist' ? 'waitlist' : 'confirmed',
			joinedAt: r.joinedAt ? new Date(r.joinedAt) : new Date()
		})) : [],
		isFilled: Boolean(pm.isFilled)
	};
};

const parseChallengeMatch = (cm, authorInfo) => {
	if (!cm || typeof cm !== 'object') return undefined;
	const challengerTeam = Array.isArray(cm.challengerTeam) && cm.challengerTeam.length > 0
		? cm.challengerTeam.map(c => ({
			userId: String(c.userId || ''),
			userName: xss(String(c.userName || 'Challenger')).slice(0, 60),
			avatarUrl: c.avatarUrl ? xss(String(c.avatarUrl).trim()) : ''
		}))
		: (authorInfo ? [{ userId: authorInfo.userId, userName: authorInfo.userName, avatarUrl: authorInfo.avatarUrl || '' }] : []);

	return {
		matchType: cm.matchType ? xss(String(cm.matchType).trim()).slice(0, 50) : 'Friendly Scrimmage',
		gameFormat: cm.gameFormat ? xss(String(cm.gameFormat).trim()).slice(0, 50) : 'Best of 3 to 21',
		stipulations: cm.stipulations ? xss(String(cm.stipulations).trim()).slice(0, 200) : '',
		matchStatus: ['open', 'accepted', 'completed', 'declined'].includes(cm.matchStatus) ? cm.matchStatus : 'open',
		challengerTeam,
		acceptedBy: Array.isArray(cm.acceptedBy) ? cm.acceptedBy.map(a => ({
			userId: String(a.userId || ''),
			userName: xss(String(a.userName || 'Opponent')).slice(0, 60),
			avatarUrl: a.avatarUrl ? xss(String(a.avatarUrl).trim()) : ''
		})) : [],
		linkedMatchId: cm.linkedMatchId ? xss(String(cm.linkedMatchId).trim()).slice(0, 60) : ''
	};
};

const parseQaDetails = (qa) => {
	if (!qa || typeof qa !== 'object') return undefined;
	return {
		subtopic: qa.subtopic ? xss(String(qa.subtopic).trim()).slice(0, 50) : 'General',
		isResolved: Boolean(qa.isResolved),
		acceptedCommentId: qa.acceptedCommentId ? xss(String(qa.acceptedCommentId).trim()).slice(0, 60) : '',
		acceptedBy: qa.acceptedBy && typeof qa.acceptedBy === 'object' ? {
			userId: String(qa.acceptedBy.userId || ''),
			userName: xss(String(qa.acceptedBy.userName || '')).slice(0, 60),
			at: qa.acceptedBy.at ? new Date(qa.acceptedBy.at) : new Date()
		} : undefined
	};
};

const parseGearDetails = (gd) => {
	if (!gd || typeof gd !== 'object') return undefined;
	return {
		gearType: gd.gearType ? xss(String(gd.gearType).trim()).slice(0, 50) : 'Racket',
		brand: gd.brand ? xss(String(gd.brand).trim()).slice(0, 50) : '',
		condition: gd.condition ? xss(String(gd.condition).trim()).slice(0, 50) : 'Good',
		specs: gd.specs && typeof gd.specs === 'object' ? {
			weightCode: gd.specs.weightCode ? xss(String(gd.specs.weightCode).trim()).slice(0, 10) : '',
			gripSize: gd.specs.gripSize ? xss(String(gd.specs.gripSize).trim()).slice(0, 10) : '',
			balancePoint: gd.specs.balancePoint ? xss(String(gd.specs.balancePoint).trim()).slice(0, 30) : '',
			currentString: gd.specs.currentString ? xss(String(gd.specs.currentString).trim()).slice(0, 60) : ''
		} : {},
		tradeType: gd.tradeType ? xss(String(gd.tradeType).trim()).slice(0, 50) : 'Review / Discussion',
		price: typeof gd.price === 'number' && gd.price >= 0 ? gd.price : (Number(gd.price) || 0)
	};
};

const parseOpponents = (opponents) => {
	if (Array.isArray(opponents)) {
		return opponents.map((o) => xss(String(o || "").trim()).slice(0, 100)).filter(Boolean);
	}
	if (typeof opponents === "string" && opponents.trim()) {
		return opponents.split(",").map((o) => xss(o.trim()).slice(0, 100)).filter(Boolean);
	}
	return [];
};

router.get("/", async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
		const skip = (page - 1) * limit;

		const query = {
			isFlagged: { $ne: true },
			status: { $nin: ['quarantined', 'deleted'] }
		};

		const { start: dateStart, end: dateEnd } = parseDateRange(req.query);
		if (dateStart || dateEnd) {
			query.createdAt = {};
			if (dateStart) query.createdAt.$gte = dateStart;
			if (dateEnd) query.createdAt.$lte = dateEnd;
		} else if (req.query.date && typeof req.query.date === "string") {
			query.targetDate = req.query.date.slice(0, 50);
		}

		if (req.query.category && typeof req.query.category === "string" && req.query.category.toLowerCase() !== "all") {
			const cat = req.query.category.trim().toLowerCase().slice(0, 50);
			if (cat === "find_partner") {
				query.category = { $in: ["find_partner", "meetup_rally"] };
			} else if (cat === "gear_exchange") {
				query.category = { $in: ["gear_exchange", "gear_review"] };
			} else if (ALLOWED_CATEGORIES.includes(cat)) {
				query.category = cat;
			}
		}

		if (req.query.tag && typeof req.query.tag === "string") {
			query.tags = req.query.tag.trim().slice(0, 50);
		}

		const rawQuerySearch = typeof req.query.search === "string"
			? req.query.search
			: (typeof req.query.q === "string" ? req.query.q : (Array.isArray(req.query.search) && typeof req.query.search[0] === "string" ? req.query.search[0] : ""));
		const rawSearch = rawQuerySearch.trim().slice(0, 100);
		if (rawSearch) {
			const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const searchRegex = new RegExp(escaped, 'i');
			query.$or = [
				{ title: { $regex: searchRegex } },
				{ content: { $regex: searchRegex } },
				{ authorName: { $regex: searchRegex } },
				{ tags: searchRegex },
				{ "matchDetails.court": { $regex: searchRegex } },
				{ "matchDetails.partner": { $regex: searchRegex } },
				{ "matchDetails.opponents": searchRegex },
				{ "playerMatchmaking.preferredCourt": { $regex: searchRegex } },
				{ "gearDetails.brand": { $regex: searchRegex } },
				{ "gearDetails.gearType": { $regex: searchRegex } }
			];
		}

		const rawPosts = await Post.find(query)
			.sort({ timestamp: -1 })
			.skip(skip)
			.limit(limit)
			.lean();
		res.json(await hydrateWithPictures(rawPosts));
	} catch (error) {
		res.status(500).json({ message: "Error fetching posts" });
	}
});

router.post("/", authMiddleware, postLimiter, async (req, res) => {
	try {
		const { title, content, imageUrl, imageUrls, targetDate, tags, visibility, isPinned, category, matchDetails, playerMatchmaking, challengeMatch, qaDetails, gearDetails } = req.body;

		if (!title || typeof title !== "string" || !title.trim()) {
			return res.status(400).json({ message: "Post title is required." });
		}
		if (title.trim().length > 200) {
			return res.status(400).json({ message: "Post title cannot exceed 200 characters." });
		}

		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Post content is required." });
		}

		let cleanCategory = "general";
		if (category) {
			if (!ALLOWED_CATEGORIES.includes(category)) {
				return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}` });
			}
			cleanCategory = category;
		}

		let cleanMatchDetails = undefined;
		if (matchDetails && typeof matchDetails === "object") {
			cleanMatchDetails = {
				partner: matchDetails.partner ? xss(String(matchDetails.partner).trim()).slice(0, 100) : "",
				opponents: parseOpponents(matchDetails.opponents),
				score: matchDetails.score ? xss(String(matchDetails.score).trim()).slice(0, 100) : "",
				court: matchDetails.court ? xss(String(matchDetails.court).trim()).slice(0, 100) : "",
				winner: matchDetails.winner ? xss(String(matchDetails.winner).trim()).slice(0, 100) : "",
			};
		}
		
		const cleanTitle = xss(title.trim());
		const cleanContent = xss(content.trim());
		const cleanImageUrl = (imageUrl && typeof imageUrl === "string") ? xss(imageUrl.trim()) : "";
		const cleanImageUrls = Array.isArray(imageUrls) ? imageUrls.map(url => typeof url === "string" ? xss(url.trim()) : "").filter(url => url) : [];
		const cleanTags = Array.isArray(tags) ? tags.filter(t => typeof t === "string").map(t => xss(t.trim()).slice(0, 50)) : [];
		
		const isSpam = await checkSpam(cleanTitle) || await checkSpam(cleanContent);
		const aiAnalysis = await analyzeContent(cleanTitle + " " + cleanContent);

		const authorId = (req.user.id || req.user.userId).toString();
		const authorName = req.user.name || req.body.authorName || "Member";

		const spamEvaluation = await evaluateSpamHeuristics({
			userId: authorId,
			title: cleanTitle,
			content: cleanContent
		});

		const isFlagged = Boolean(isSpam || aiAnalysis.isFlagged || spamEvaluation.isSpam);
		const status = isFlagged ? 'quarantined' : 'active';
		const toxicityScore = spamEvaluation.score || aiAnalysis.score || 0;

		const authorInfo = { userId: authorId, userName: authorName, avatarUrl: req.user.profilePic || "" };
		const cleanPlayerMatchmaking = parsePlayerMatchmaking(playerMatchmaking);
		const cleanChallengeMatch = parseChallengeMatch(challengeMatch, authorInfo);
		const cleanQaDetails = parseQaDetails(qaDetails);
		const cleanGearDetails = parseGearDetails(gearDetails);

		const newPost = new Post({
			title: cleanTitle,
			content: cleanContent,
			category: cleanCategory,
			matchDetails: cleanMatchDetails,
			playerMatchmaking: cleanPlayerMatchmaking,
			challengeMatch: cleanChallengeMatch,
			qaDetails: cleanQaDetails,
			gearDetails: cleanGearDetails,
			imageUrl: cleanImageUrl,
			imageUrls: cleanImageUrls,
			tags: cleanTags,
			isPinned: req.user.role === "admin" && Boolean(isPinned),
			visibility: visibility || 'PUBLIC',
			authorName,
			targetDate: targetDate || "General",
			authorId,
			status,
			isFlagged,
			toxicityScore
		});

		await newPost.save();

		if (isFlagged) {
			return res
				.status(201)
				.json({
					message: "Post submitted for review.",
					post: { _id: newPost._id, status: newPost.status, isFlagged: newPost.isFlagged }
				});
		}

		const hydratedPost = await hydrateWithPictures(newPost.toObject());
		if (req.io) req.io.emit("postCreated", hydratedPost);
		res.status(201).json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error creating post" });
	}
});

router.get("/user/:userId", async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
		const skip = (page - 1) * limit;

		const rawPosts = await Post.find({
			authorId: req.params.userId,
			isFlagged: { $ne: true },
			status: { $nin: ['quarantined', 'deleted'] }
		})
			.sort({ timestamp: -1 })
			.skip(skip)
			.limit(limit)
			.lean();
		res.json(await hydrateWithPictures(rawPosts));
	} catch (error) {
		res.status(500).json({ message: "Error fetching user posts" });
	}
});

// ==========================================
// REPORT POST & COMMUNITY QUARANTINE
// ==========================================
router.post("/:postId/report", authMiddleware, async (req, res) => {
	try {
		const { postId } = req.params;
		if (!mongoose.isValidObjectId(postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ message: "Post not found." });
		}

		// Invariant: author cannot report their own post
		if (post.authorId && post.authorId.toString() === currentUserId) {
			return res.status(400).json({ message: "You cannot report your own post." });
		}

		// Invariant: prevent duplicate reports from the same user
		if (!Array.isArray(post.reports)) post.reports = [];
		const alreadyReported = post.reports.some(r => r.reportedBy && r.reportedBy.toString() === currentUserId);
		if (alreadyReported) {
			return res.status(400).json({ message: "You have already reported this post." });
		}

		const reason = req.body.reason ? xss(String(req.body.reason).trim()).slice(0, 200) : "Spam/Inappropriate";
		post.reports.push({
			reportedBy: currentUserId,
			reason,
			timestamp: new Date()
		});
		post.reportCount = post.reports.length;

		let quarantined = false;
		// 3-Report Auto-Quarantine Trigger
		if (post.reportCount >= 3) {
			post.status = 'quarantined';
			post.isFlagged = true;
			quarantined = true;
		}

		await post.save(); // Triggers post-save hook to remove from ActivityFeed if quarantined

		if (quarantined) {
			const io = req.io || req.app?.get('io');
			if (io) {
				io.emit("postQuarantined", { postId: post._id, reportCount: post.reportCount });
				io.emit("postDeleted", post._id.toString());
			}
		}

		return res.status(200).json({
			success: true,
			message: quarantined 
				? "Post has received 3 community reports and has been quarantined for moderator review."
				: "Post reported successfully.",
			reportCount: post.reportCount,
			status: post.status
		});
	} catch (err) {
		console.error("Error reporting post:", err);
		return res.status(500).json({ message: "Internal server error reporting post." });
	}
});

// ==========================================
// EDIT & DELETE POSTS (WITH ADMIN GOD MODE)
// ==========================================
router.put("/:postId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const { title, content, category, matchDetails, playerMatchmaking, challengeMatch, qaDetails, gearDetails } = req.body;
		if (!title || typeof title !== "string" || !title.trim()) {
			return res.status(400).json({ message: "Post title is required." });
		}
		if (title.trim().length > 200) {
			return res.status(400).json({ message: "Post title cannot exceed 200 characters." });
		}

		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Post content is required." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		if (post.authorId.toString() !== currentUserId && req.user.role !== "admin")
			return res.status(403).json({ message: "Unauthorized" });

		if (category) {
			if (!ALLOWED_CATEGORIES.includes(category)) {
				return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}` });
			}
			post.category = category;
		}

		if (matchDetails && typeof matchDetails === "object") {
			post.matchDetails = {
				partner: matchDetails.partner !== undefined ? xss(String(matchDetails.partner || "").trim()).slice(0, 100) : (post.matchDetails?.partner || ""),
				opponents: matchDetails.opponents !== undefined
					? parseOpponents(matchDetails.opponents)
					: (post.matchDetails?.opponents || []),
				score: matchDetails.score !== undefined ? xss(String(matchDetails.score || "").trim()).slice(0, 100) : (post.matchDetails?.score || ""),
				court: matchDetails.court !== undefined ? xss(String(matchDetails.court || "").trim()).slice(0, 100) : (post.matchDetails?.court || ""),
				winner: matchDetails.winner !== undefined ? xss(String(matchDetails.winner || "").trim()).slice(0, 100) : (post.matchDetails?.winner || ""),
			};
		}

		if (playerMatchmaking && typeof playerMatchmaking === "object") {
			post.playerMatchmaking = parsePlayerMatchmaking(playerMatchmaking);
		}
		if (challengeMatch && typeof challengeMatch === "object") {
			post.challengeMatch = parseChallengeMatch(challengeMatch, { userId: currentUserId, userName: req.user.name, avatarUrl: req.user.profilePic });
		}
		if (qaDetails && typeof qaDetails === "object") {
			post.qaDetails = parseQaDetails(qaDetails);
		}
		if (gearDetails && typeof gearDetails === "object") {
			post.gearDetails = parseGearDetails(gearDetails);
		}

		const cleanTitle = xss(title.trim());
		const cleanContent = xss(content.trim());

		const aiAnalysis = await analyzeContent(cleanTitle + " " + cleanContent);
		if (aiAnalysis.isFlagged || await checkSpam(cleanTitle) || await checkSpam(cleanContent)) {
			post.isFlagged = true;
			await post.save();
			if (req.io) req.io.emit("postDeleted", post._id);
			return res
				.status(200)
				.json({ message: "Post submitted for review." });
		}

		post.title = cleanTitle;
		post.content = cleanContent;
		post.isEdited = true; // NEW: Set edited flag
		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error updating post" });
	}
});

router.delete("/:postId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		const post = await Post.findById(req.params.postId);
		const isAdmin = req.user.role === "admin";

		if (!post) return res.status(404).json({ message: "Post not found" });
		// Only Author OR Admin can delete
		if (post.authorId.toString() !== currentUserId && !isAdmin)
			return res.status(403).json({ message: "Unauthorized" });

		await Post.findByIdAndDelete(req.params.postId);
		if (req.io) req.io.emit("postDeleted", req.params.postId);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ message: "Error deleting post" });
	}
});

// ==========================================
// ==========================================
// GET SINGLE POST BY ID (URL DEEP-LINKING)
// ==========================================
router.get("/:postId", async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const post = await Post.findById(req.params.postId).lean();
		if (!post) return res.status(404).json({ message: "Post not found" });
		if (post.status === "quarantined" || post.status === "deleted") {
			return res.status(404).json({ message: "Post not available" });
		}

		const hydratedPost = await hydrateWithPictures(post);
		res.json(hydratedPost);
	} catch (error) {
		console.error("Error fetching single post:", error);
		res.status(500).json({ message: "Server error fetching post" });
	}
});

// ==========================================
// COMMENTS & REPLIES (CREATE, EDIT, DELETE)
// ==========================================

router.get("/:postId/comments", async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const post = await Post.findById(req.params.postId).lean();
		if (!post) return res.status(404).json({ message: "Post not found" });

		const hydratedPost = await hydrateWithPictures(post);
		res.json({ comments: hydratedPost.comments || [] });
	} catch (error) {
		console.error("Error fetching comments:", error);
		res.status(500).json({ message: "Server error fetching comments" });
	}
});

router.post("/:postId/comments", authMiddleware, postLimiter, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const { content } = req.body;
		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Comment content cannot be empty." });
		}

		const authorId = (req.user.id || req.user.userId).toString();
		const authorName = req.user.name || req.body.authorName || "Member";
		const cleanContent = xss(content.trim());
		const cleanAuthorName = xss(authorName);
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		const isSpam = await checkSpam(cleanContent);
		const aiAnalysis = await analyzeContent(cleanContent);

		if (isSpam || aiAnalysis.isFlagged)
			return res
				.status(400)
				.json({ message: "Comment rejected: Spam or toxicity detected." });

		post.comments.push({ authorId, authorName: cleanAuthorName, content: cleanContent });
		await post.save();

		const updatedPost = await Post.findById(req.params.postId).lean();
		const hydratedPost = await hydrateWithPictures(updatedPost);

		if (req.io) {
			req.io.emit("postUpdated", hydratedPost);
			if (post.authorId?.toString() !== authorId.toString()) {
				const newComment =
					updatedPost.comments[updatedPost.comments.length - 1];
				await sendNotification(
					req.io,
					post.authorId.toString(),
					`${authorName} commented: "${truncateText(content)}"`,
					`/forum?postId=${post._id}&highlight=${newComment._id}`,
				);
			}
		}
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error adding comment" });
	}
});

router.put("/:postId/comments/:commentId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
			return res.status(400).json({ message: "Invalid post or comment ID format." });
		}

		const { content } = req.body;
		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Comment content cannot be empty." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		const cleanContent = xss(content.trim());
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });
		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found" });

		if (comment.authorId.toString() !== currentUserId && req.user.role !== "admin")
			return res.status(403).json({ message: "Unauthorized" });
		const aiAnalysis = await analyzeContent(cleanContent);
		if (aiAnalysis.isFlagged || await checkSpam(cleanContent))
			return res.status(400).json({ message: "Comment rejected: Spam or toxicity detected." });
		if (false)
			return res.json(await hydrateWithPictures(post.toObject()));

		comment.content = cleanContent;
		comment.isEdited = true; // NEW: Set edited flag
		await post.save();
		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error updating comment" });
	}
});

router.delete("/:postId/comments/:commentId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
			return res.status(400).json({ message: "Invalid post or comment ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });
		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found" });
		const isAdmin = req.user.role === "admin";

		// Author OR Admin
		if (comment.authorId.toString() !== currentUserId && !isAdmin)
			return res.status(403).json({ message: "Unauthorized" });

		comment.deleteOne();
		await post.save();
		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error deleting comment" });
	}
});

router.post(
	"/:postId/comments/:commentId/replies",
	authMiddleware,
	postLimiter,
	async (req, res) => {
		try {
			if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
				return res.status(400).json({ message: "Invalid post or comment ID format." });
			}

			const { content } = req.body;
			if (!content || typeof content !== "string" || !content.trim()) {
				return res.status(400).json({ message: "Reply content cannot be empty." });
			}

			const authorId = (req.user.id || req.user.userId).toString();
			const authorName = req.user.name || req.body.authorName || "Member";
			const cleanContent = xss(content.trim());
			const cleanAuthorName = xss(authorName);
			const post = await Post.findById(req.params.postId);
			if (!post) return res.status(404).json({ message: "Post not found" });
			const comment = post.comments.id(req.params.commentId);
			if (!comment) return res.status(404).json({ message: "Comment not found" });

			const isSpam = await checkSpam(cleanContent);
			const aiAnalysis = await analyzeContent(cleanContent);

			if (isSpam || aiAnalysis.isFlagged)
				return res
					.status(400)
					.json({ message: "Reply rejected: Spam or toxicity detected." });

			comment.replies.push({ authorId, authorName: cleanAuthorName, content: cleanContent });
			await post.save();

			const updatedPost = await Post.findById(req.params.postId).lean();
			const hydratedPost = await hydrateWithPictures(updatedPost);

			if (req.io) {
				req.io.emit("postUpdated", hydratedPost);
				const commentToReply = updatedPost.comments.find(
					(c) => c._id.toString() === req.params.commentId,
				);
				if (
					commentToReply &&
					commentToReply.authorId?.toString() !== authorId.toString()
				) {
					const newReply =
						commentToReply.replies[
							commentToReply.replies.length - 1
						];
					await sendNotification(
						req.io,
						commentToReply.authorId.toString(),
						`${authorName} replied: "${truncateText(content)}"`,
						`/forum?postId=${post._id}&highlight=${newReply._id}`,
					);
				}
			}
			res.json(hydratedPost);
		} catch (error) {
			res.status(500).json({ message: "Error adding reply" });
		}
	},
);

router.put(
	"/:postId/comments/:commentId/replies/:replyId",
	authMiddleware,
	async (req, res) => {
		try {
			if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId) || !mongoose.isValidObjectId(req.params.replyId)) {
				return res.status(400).json({ message: "Invalid post, comment, or reply ID format." });
			}

			const { content } = req.body;
			if (!content || typeof content !== "string" || !content.trim()) {
				return res.status(400).json({ message: "Reply content cannot be empty." });
			}

			const currentUserId = (req.user.id || req.user.userId).toString();
			const cleanContent = xss(content.trim());
			const post = await Post.findById(req.params.postId);
			if (!post) return res.status(404).json({ message: "Post not found" });
			const comment = post.comments.id(req.params.commentId);
			if (!comment) return res.status(404).json({ message: "Comment not found" });
			const reply = comment.replies.id(req.params.replyId);
			if (!reply) return res.status(404).json({ message: "Reply not found" });

			if (reply.authorId.toString() !== currentUserId && req.user.role !== "admin")
				return res.status(403).json({ message: "Unauthorized" });
			const aiAnalysis = await analyzeContent(cleanContent);
		if (aiAnalysis.isFlagged || await checkSpam(cleanContent))
			return res.status(400).json({ message: "Comment rejected: Spam or toxicity detected." });
		if (false)
				return res.json(await hydrateWithPictures(post.toObject()));

			reply.content = cleanContent;
			reply.isEdited = true; // NEW: Set edited flag
			await post.save();
			const hydratedPost = await hydrateWithPictures(post.toObject());
			if (req.io) req.io.emit("postUpdated", hydratedPost);
			res.json(hydratedPost);
		} catch (error) {
			res.status(500).json({ message: "Error updating reply" });
		}
	},
);

router.delete(
	"/:postId/comments/:commentId/replies/:replyId",
	authMiddleware,
	async (req, res) => {
		try {
			if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId) || !mongoose.isValidObjectId(req.params.replyId)) {
				return res.status(400).json({ message: "Invalid post, comment, or reply ID format." });
			}

			const currentUserId = (req.user.id || req.user.userId).toString();
			const post = await Post.findById(req.params.postId);
			if (!post) return res.status(404).json({ message: "Post not found" });
			const comment = post.comments.id(req.params.commentId);
			if (!comment) return res.status(404).json({ message: "Comment not found" });
			const reply = comment.replies.id(req.params.replyId);
			if (!reply) return res.status(404).json({ message: "Reply not found" });
			const isAdmin = req.user.role === "admin";

			// Author OR Admin
			if (reply.authorId.toString() !== currentUserId && !isAdmin)
				return res.status(403).json({ message: "Unauthorized" });

			reply.deleteOne();
			await post.save();
			const hydratedPost = await hydrateWithPictures(post.toObject());
			if (req.io) req.io.emit("postUpdated", hydratedPost);
			res.json(hydratedPost);
		} catch (error) {
			res.status(500).json({ message: "Error deleting reply" });
		}
	},
);

// ==========================================
// ==========================================
// REPORT COMMENTS & REPLIES
// ==========================================
router.post("/:postId/comments/:commentId/report", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
			return res.status(400).json({ message: "Invalid post or comment ID format." });
		}
		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found." });

		if (comment.authorId && comment.authorId.toString() === currentUserId) {
			return res.status(400).json({ message: "You cannot report your own comment." });
		}

		if (!Array.isArray(comment.reports)) comment.reports = [];
		const alreadyReported = comment.reports.some(
			(r) => r.reportedBy && r.reportedBy.toString() === currentUserId
		);
		if (alreadyReported) {
			return res.status(400).json({ message: "You have already reported this comment." });
		}

		const reason = req.body.reason ? xss(String(req.body.reason).trim()).slice(0, 200) : "Spam/Abuse";
		const details = req.body.details ? xss(String(req.body.details).trim()).slice(0, 500) : "";
		comment.reports.push({
			reportedBy: currentUserId,
			reason,
			details,
			timestamp: new Date(),
		});
		comment.reportCount = comment.reports.length;

		let flagged = false;
		if (comment.reportCount >= 3) {
			comment.isFlagged = true;
			flagged = true;
		}

		await post.save();

		const updatedPost = await Post.findById(req.params.postId).lean();
		const hydratedPost = await hydrateWithPictures(updatedPost);
		if (req.io) req.io.emit("postUpdated", hydratedPost);

		return res.status(200).json({
			success: true,
			message: flagged
				? "Comment has received 3 reports and has been flagged for review."
				: "Comment reported successfully.",
			reportCount: comment.reportCount,
			isFlagged: comment.isFlagged,
		});
	} catch (err) {
		console.error("Error reporting comment:", err);
		return res.status(500).json({ message: "Internal server error reporting comment." });
	}
});

router.post("/:postId/comments/:commentId/replies/:replyId/report", authMiddleware, async (req, res) => {
	try {
		if (
			!mongoose.isValidObjectId(req.params.postId) ||
			!mongoose.isValidObjectId(req.params.commentId) ||
			!mongoose.isValidObjectId(req.params.replyId)
		) {
			return res.status(400).json({ message: "Invalid post, comment, or reply ID format." });
		}
		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found." });

		const reply = comment.replies.id(req.params.replyId);
		if (!reply) return res.status(404).json({ message: "Reply not found." });

		if (reply.authorId && reply.authorId.toString() === currentUserId) {
			return res.status(400).json({ message: "You cannot report your own reply." });
		}

		if (!Array.isArray(reply.reports)) reply.reports = [];
		const alreadyReported = reply.reports.some(
			(r) => r.reportedBy && r.reportedBy.toString() === currentUserId
		);
		if (alreadyReported) {
			return res.status(400).json({ message: "You have already reported this reply." });
		}

		const reason = req.body.reason ? xss(String(req.body.reason).trim()).slice(0, 200) : "Spam/Abuse";
		const details = req.body.details ? xss(String(req.body.details).trim()).slice(0, 500) : "";
		reply.reports.push({
			reportedBy: currentUserId,
			reason,
			details,
			timestamp: new Date(),
		});
		reply.reportCount = reply.reports.length;

		let flagged = false;
		if (reply.reportCount >= 3) {
			reply.isFlagged = true;
			flagged = true;
		}

		await post.save();

		const updatedPost = await Post.findById(req.params.postId).lean();
		const hydratedPost = await hydrateWithPictures(updatedPost);
		if (req.io) req.io.emit("postUpdated", hydratedPost);

		return res.status(200).json({
			success: true,
			message: flagged
				? "Reply has received 3 reports and has been flagged for review."
				: "Reply reported successfully.",
			reportCount: reply.reportCount,
			isFlagged: reply.isFlagged,
		});
	} catch (err) {
		console.error("Error reporting reply:", err);
		return res.status(500).json({ message: "Internal server error reporting reply." });
	}
});

// BOOKMARKS
// ==========================================

router.put("/:postId/bookmark", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const userId = (req.user.id || req.user.userId).toString();
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (!user.bookmarkedPosts) user.bookmarkedPosts = [];
		const postIndex = user.bookmarkedPosts.indexOf(req.params.postId);
		let isBookmarked = false;

		if (postIndex === -1) {
			user.bookmarkedPosts.push(req.params.postId);
			isBookmarked = true;
		} else {
			user.bookmarkedPosts.splice(postIndex, 1);
		}

		await user.save();
		res.json({ bookmarkedPosts: user.bookmarkedPosts, isBookmarked });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error toggling bookmark" });
	}
});

router.get("/bookmarks/:userId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ message: "Invalid user ID format." });
		}

		const currentUserId = (req.user.id || req.user.userId).toString();
		if (req.user.role !== "admin" && currentUserId !== req.params.userId) {
			return res.status(403).json({ message: "Unauthorized to access bookmarks." });
		}

		const user = await User.findById(req.params.userId).populate('bookmarkedPosts');
		if (!user) return res.status(404).json({ message: "User not found" });

		// Filter out nulls in case a post was deleted but still bookmarked
		const validPosts = user.bookmarkedPosts.filter(p => p !== null);
		const hydratedPosts = await hydrateWithPictures(validPosts.map(p => typeof p.toObject === 'function' ? p.toObject() : p));
		res.json(hydratedPosts);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error fetching bookmarks" });
	}
});

// ==========================================
// LIKES
// ==========================================
router.put("/:postId/like", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const userId = (req.user.id || req.user.userId).toString();
		const userName = req.user.name || req.body.userName || "Player";
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		const hasLiked = post.likedBy.some(
			(id) => id.toString() === userId.toString(),
		);
		if (hasLiked) {
			post.likedBy = post.likedBy.filter(
				(id) => id.toString() !== userId.toString(),
			);
		} else {
			post.likedBy.push(userId);
		}
		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) {
			req.io.emit("postUpdated", hydratedPost);
			if (!hasLiked && post.authorId?.toString() !== userId.toString()) {
				await sendNotification(
					req.io,
					post.authorId.toString(),
					`${userName} liked your post.`,
					`/forum?postId=${post._id}`,
				);
			}
		}
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error toggling like" });
	}
});

router.put("/:postId/comments/:commentId/like", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
			return res.status(400).json({ message: "Invalid post or comment ID format." });
		}

		const userId = (req.user.id || req.user.userId).toString();
		const userName = req.user.name || req.body.userName || "Player";
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });
		const comment = post.comments.id(req.params.commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found" });

		const hasLiked = comment.likedBy.some(
			(id) => id.toString() === userId.toString(),
		);
		if (hasLiked) {
			comment.likedBy = comment.likedBy.filter(
				(id) => id.toString() !== userId.toString(),
			);
		} else {
			comment.likedBy.push(userId);
		}
		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) {
			req.io.emit("postUpdated", hydratedPost);
			if (
				!hasLiked &&
				comment.authorId?.toString() !== userId.toString()
			) {
				await sendNotification(
					req.io,
					comment.authorId.toString(),
					`${userName} liked your comment.`,
					`/forum?postId=${post._id}&highlight=${comment._id}`,
				);
			}
		}
		res.json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error toggling comment like" });
	}
});

router.put(
	"/:postId/comments/:commentId/replies/:replyId/like",
	authMiddleware,
	async (req, res) => {
		try {
			if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId) || !mongoose.isValidObjectId(req.params.replyId)) {
				return res.status(400).json({ message: "Invalid post, comment, or reply ID format." });
			}

			const userId = (req.user.id || req.user.userId).toString();
			const userName = req.user.name || req.body.userName || "Player";
			const post = await Post.findById(req.params.postId);
			if (!post) return res.status(404).json({ message: "Post not found" });
			const comment = post.comments.id(req.params.commentId);
			if (!comment) return res.status(404).json({ message: "Comment not found" });
			const reply = comment.replies.id(req.params.replyId);
			if (!reply) return res.status(404).json({ message: "Reply not found" });

			const hasLiked = reply.likedBy.some(
				(id) => id.toString() === userId.toString(),
			);
			if (hasLiked) {
				reply.likedBy = reply.likedBy.filter(
					(id) => id.toString() !== userId.toString(),
				);
			} else {
				reply.likedBy.push(userId);
			}
			await post.save();

			const hydratedPost = await hydrateWithPictures(post.toObject());
			if (req.io) {
				req.io.emit("postUpdated", hydratedPost);
				if (
					!hasLiked &&
					reply.authorId?.toString() !== userId.toString()
				) {
					await sendNotification(
						req.io,
						reply.authorId.toString(),
						`${userName} liked your reply.`,
						`/forum?postId=${post._id}&highlight=${reply._id}`,
					);
				}
			}
			res.json(hydratedPost);
		} catch (error) {
			res.status(500).json({ message: "Error toggling reply like" });
		}
	},
);

// ==========================================
// PIN POST (ADMIN ONLY)
// ==========================================
router.put("/:postId/pin", authMiddleware, async (req, res) => {
	try {
		if (req.user.role !== "admin") {
			return res.status(403).json({ message: "Only administrators can pin posts." });
		}
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		post.isPinned = !post.isPinned;
		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);

		res.json({
			success: true,
			isPinned: post.isPinned,
			post: hydratedPost,
			message: post.isPinned ? "Post pinned successfully." : "Post unpinned."
		});
	} catch (error) {
		console.error("Error toggling pin status:", error);
		res.status(500).json({ message: "Error toggling pin status." });
	}
});

// ==========================================
// BADMINTON REACTION TRIO (💥, 🧊, ⚡) & EMOJIS
// ==========================================
const BADMINTON_REACTIONS_MAP = {
	"💥": { reactionType: "smash", notificationText: "smashed your post." },
	"🧊": { reactionType: "ice_drop", notificationText: "dropped on your post." },
	"⚡": { reactionType: "clutch", notificationText: "marked your post as clutch." },
};

const REACTION_TYPE_TO_EMOJI = {
	smash: "💥",
	ice_drop: "🧊",
	clutch: "⚡",
};

const ALLOWED_EMOJIS = [
	"💥", "🧊", "⚡", // Authentic Badminton Trio
	"🏸", "🔥", "💯", "❤️", "👏", "👍", // Legacy emojis for backward compatibility
];

router.put("/:postId/react", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		let { emoji, reactionType } = req.body;
		if (!emoji && reactionType && REACTION_TYPE_TO_EMOJI[reactionType]) {
			emoji = REACTION_TYPE_TO_EMOJI[reactionType];
		}

		if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
			return res.status(400).json({ message: `Invalid emoji. Allowed: ${ALLOWED_EMOJIS.join(" ")}` });
		}

		const resolvedReactionType = reactionType || BADMINTON_REACTIONS_MAP[emoji]?.reactionType || "custom";

		const userId = (req.user.id || req.user.userId).toString();
		const userName = req.user.name || "Player";
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		if (!Array.isArray(post.reactions)) {
			post.reactions = [];
		}

		const existingReactionIndex = post.reactions.findIndex(
			(r) => r.userId && r.userId.toString() === userId.toString()
		);

		let action = "added";
		if (existingReactionIndex !== -1) {
			if (post.reactions[existingReactionIndex].emoji === emoji) {
				// Same emoji clicked -> remove reaction (toggle off)
				post.reactions.splice(existingReactionIndex, 1);
				action = "removed";
			} else {
				// Different emoji clicked -> replace reaction
				post.reactions[existingReactionIndex].emoji = emoji;
				post.reactions[existingReactionIndex].reactionType = resolvedReactionType;
				post.reactions[existingReactionIndex].createdAt = new Date();
				action = "updated";
			}
		} else {
			// New reaction
			post.reactions.push({
				userId,
				userName,
				emoji,
				reactionType: resolvedReactionType,
				createdAt: new Date(),
			});
			action = "added";
		}

		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) {
			req.io.emit("postUpdated", hydratedPost);
			if (action === "added" && post.authorId?.toString() !== userId.toString()) {
				const notificationSuffix = BADMINTON_REACTIONS_MAP[emoji]?.notificationText || `reacted with ${emoji} to your post.`;
				await sendNotification(
					req.io,
					post.authorId.toString(),
					`${userName} ${notificationSuffix}`,
					`/forum?postId=${post._id}`
				);
			}
		}

		res.json(hydratedPost);
	} catch (error) {
		console.error("Error handling reaction:", error);
		res.status(500).json({ message: "Error updating reaction." });
	}
});


// ==========================================
// SPECIALIZED COMMUNITY WORKFLOWS (PHASE 2)
// ==========================================

// 1. Toggle RSVP for Player Matchmaking / Meetup Rally
router.post("/:postId/rsvp", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });
		if (post.isFlagged || post.status === "quarantined" || post.status === "deleted") {
			return res.status(403).json({ message: "Cannot RSVP to this post." });
		}

		if (!post.playerMatchmaking) {
			post.playerMatchmaking = {
				skillLevelRequired: "Any",
				format: "Doubles",
				preferredCourt: "RAC Courts 1-3",
				slotsNeeded: 1,
				rsvpList: [],
				isFilled: false
			};
		}

		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		const currentUserName = req.user.name || "Player";
		const userDoc = await User.findById(currentUserId).select("profilePic").lean();
		const avatarUrl = userDoc?.profilePic || req.user.profilePic || "";

		const existingIndex = post.playerMatchmaking.rsvpList.findIndex(
			r => String(r.userId) === currentUserId
		);

		let userAction = "joined";
		if (existingIndex > -1) {
			// Toggle off (cancel RSVP)
			post.playerMatchmaking.rsvpList.splice(existingIndex, 1);
			userAction = "left";

			// If a slot opened, promote the first waitlisted user to confirmed
			const confirmedCount = post.playerMatchmaking.rsvpList.filter(r => r.status === "confirmed").length;
			if (confirmedCount < post.playerMatchmaking.slotsNeeded) {
				const waitlisted = post.playerMatchmaking.rsvpList.find(r => r.status === "waitlist");
				if (waitlisted) waitlisted.status = "confirmed";
			}
		} else {
			// Toggle on (join)
			const confirmedCount = post.playerMatchmaking.rsvpList.filter(r => r.status === "confirmed").length;
			const status = confirmedCount < post.playerMatchmaking.slotsNeeded ? "confirmed" : "waitlist";
			post.playerMatchmaking.rsvpList.push({
				userId: currentUserId,
				userName: currentUserName,
				avatarUrl,
				status,
				joinedAt: new Date()
			});
		}

		// Update isFilled status
		const finalConfirmed = post.playerMatchmaking.rsvpList.filter(r => r.status === "confirmed").length;
		post.playerMatchmaking.isFilled = finalConfirmed >= post.playerMatchmaking.slotsNeeded;

		await post.save();

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);

		// Notify author if user joined
		if (userAction === "joined" && post.authorId?.toString() !== currentUserId) {
			await sendNotification(
				req.io,
				post.authorId.toString(),
				`${currentUserName} joined your badminton rally!`,
				`/post/${post._id}`
			);
		}

		res.json(hydratedPost);
	} catch (error) {
		console.error("Error toggling RSVP:", error);
		res.status(500).json({ message: "Error updating RSVP status." });
	}
});

// 2. Accept Scrimmage / Match Challenge
router.put("/:postId/accept-challenge", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		if (post.authorId?.toString() === currentUserId) {
			return res.status(400).json({ message: "You cannot accept your own challenge." });
		}

		if (!post.challengeMatch) {
			post.challengeMatch = {
				matchType: "Friendly Scrimmage",
				gameFormat: "Best of 3 to 21",
				matchStatus: "open",
				challengerTeam: [{ userId: post.authorId, userName: post.authorName, avatarUrl: "" }],
				acceptedBy: []
			};
		}

		const alreadyAccepted = post.challengeMatch.acceptedBy?.some(a => String(a.userId) === currentUserId);
		if (post.challengeMatch.matchStatus === "accepted" && !alreadyAccepted) {
			return res.status(400).json({ message: "This challenge has already been accepted." });
		}

		const userDoc = await User.findById(currentUserId).select("name profilePic").lean();
		const currentUserName = userDoc?.name || req.user.name || "Opponent";
		const avatarUrl = userDoc?.profilePic || req.user.profilePic || "";

		if (!alreadyAccepted) {
			if (!Array.isArray(post.challengeMatch.acceptedBy)) {
				post.challengeMatch.acceptedBy = [];
			}
			post.challengeMatch.acceptedBy.push({
				userId: currentUserId,
				userName: currentUserName,
				avatarUrl
			});
			post.challengeMatch.matchStatus = "accepted";
			await post.save();

			await sendNotification(
				req.io,
				post.authorId.toString(),
				`${currentUserName} accepted your match challenge!`,
				`/post/${post._id}`
			);
		}

		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);
		res.json(hydratedPost);
	} catch (error) {
		console.error("Error accepting challenge:", error);
		res.status(500).json({ message: "Error accepting challenge." });
	}
});

// 3. Mark Comment as Accepted Solution (Q&A Forum)
router.put("/:postId/comments/:commentId/accept-answer", authMiddleware, async (req, res) => {
	try {
		const { postId, commentId } = req.params;
		if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(commentId)) {
			return res.status(400).json({ message: "Invalid ID format." });
		}

		const post = await Post.findById(postId);
		if (!post) return res.status(404).json({ message: "Post not found." });

		const currentUserId = (req.user.id || req.user.userId || req.user._id).toString();
		const isAdmin = req.user.role === "admin";
		if (post.authorId?.toString() !== currentUserId && !isAdmin) {
			return res.status(403).json({ message: "Only the post author or an admin can mark the accepted answer." });
		}

		const comment = post.comments.id(commentId);
		if (!comment) return res.status(404).json({ message: "Comment not found." });

		if (!post.qaDetails) {
			post.qaDetails = { subtopic: "General", isResolved: false };
		}

		// Toggle accepted answer
		if (post.qaDetails.isResolved && String(post.qaDetails.acceptedCommentId) === String(commentId)) {
			// Unmark
			post.qaDetails.isResolved = false;
			post.qaDetails.acceptedCommentId = "";
			post.qaDetails.acceptedBy = undefined;
		} else {
			// Mark
			post.qaDetails.isResolved = true;
			post.qaDetails.acceptedCommentId = commentId.toString();
			post.qaDetails.acceptedBy = {
				userId: currentUserId,
				userName: req.user.name || "Author",
				at: new Date()
			};

			if (comment.authorId?.toString() !== currentUserId) {
				await sendNotification(
					req.io,
					comment.authorId.toString(),
					`${req.user.name || "The author"} marked your answer as the accepted solution!`,
					`/post/${post._id}`
				);
			}
		}

		await post.save();
		const hydratedPost = await hydrateWithPictures(post.toObject());
		if (req.io) req.io.emit("postUpdated", hydratedPost);
		res.json(hydratedPost);
	} catch (error) {
		console.error("Error marking accepted answer:", error);
		res.status(500).json({ message: "Error marking accepted answer." });
	}
});

module.exports = router;


