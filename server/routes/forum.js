// server/routes/forum.js
const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const rateLimit = require("express-rate-limit");
const router = express.Router();

// Helper to shorten long comments in notifications
const truncateText = (text, maxLength = 40) => {
	if (!text) return "";
	return text.length > maxLength
		? text.substring(0, maxLength - 3) + "..."
		: text;
};

// 1. RATE LIMITER: Prevent bot spam (Max 5 posts per 15 minutes per IP)
const postLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: {
		message: "You are posting too fast. Please wait a few minutes.",
	},
});

// 2. THE UPGRADED SPAM ENGINE: Regex and keyword detection
const checkSpam = (text) => {
	if (!text) return false;
	const lowerText = text.toLowerCase();

	// A. Block Exact Spam Phrases (URLs and scam sentences)
	const spamPhrases = [
		"buy cheap",
		"free money",
		"click here",
		"earn cash",
		"http://",
		"https://",
		"sugar daddy",
		"cashapp",
		"venmo me",
	];
	const hasSpamPhrase = spamPhrases.some((phrase) =>
		lowerText.includes(phrase),
	);

	// B. Block Toxic & Scam Words using Word Boundaries (\b)
	// This ensures we catch "crypto" but don't accidentally block a word that just contains those letters.
	const toxicWords = [
		"crypto",
		"bitcoin",
		"eth",
		"nft",
		"dick",
		"fuck",
		"shit",
		"bitch",
		"asshole",
		"cunt",
		"slut",
		"whore",
		"pussy",
		"cock",
		"porn",
		"onlyfans",
	];
	// Creates a regex pattern like: \b(crypto|bitcoin|dick|fuck)\b
	const toxicRegex = new RegExp(`\\b(${toxicWords.join("|")})\\b`, "i");
	const hasToxicWord = toxicRegex.test(lowerText);

	// C. Block excessive repetitive characters (e.g., "111111111111")
	const hasRepeatingChars = /(.)\1{10,}/.test(lowerText);

	// D. Block all-caps screaming (if the text is long enough)
	const isAllCaps = text.length > 20 && text === text.toUpperCase();

	return hasSpamPhrase || hasToxicWord || hasRepeatingChars || isAllCaps;
};

const hydrateWithPictures = async (data) => {
	const users = await User.find().select("_id name profilePic").lean();
	const userMap = {};
	users.forEach(
		(u) =>
			(userMap[u._id.toString()] = {
				name: u.name,
				profilePic: u.profilePic,
			}),
	);

	const attach = (post) => {
		post.authorPic = userMap[post.authorId?.toString()]?.profilePic || "";
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
router.get("/notifications/:userId", async (req, res) => {
	try {
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

router.put("/notifications/:userId/read", async (req, res) => {
	try {
		await Notification.updateMany(
			{ targetUserId: req.params.userId, read: false },
			{ read: true },
		);
		res.json({ success: true });
	} catch (error) {
		res.status(500).json({ message: "Error updating notifications" });
	}
});

const sendNotification = async (io, targetUserId, message, link) => {
	if (!targetUserId || targetUserId === "000000000000000000000000") return;
	const notif = new Notification({ targetUserId, message, link });
	await notif.save();
	if (io) io.emit("newNotification", notif);
};

// ==========================================
// POSTS
// ==========================================
router.get("/", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const query = { isFlagged: { $ne: true } };

		if (req.query.date) query.targetDate = req.query.date;

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

router.post("/", postLimiter, async (req, res) => {
	try {
		const { title, content, authorName, targetDate, authorId } = req.body;
		const isSpam = checkSpam(title) || checkSpam(content);

		const newPost = new Post({
			title,
			content,
			authorName,
			targetDate: targetDate || "General",
			authorId: authorId || "000000000000000000000000",
			isFlagged: isSpam,
		});

		await newPost.save();

		if (isSpam) {
			return res
				.status(201)
				.json({ message: "Post submitted for review." });
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
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const rawPosts = await Post.find({
			authorId: req.params.userId,
			isFlagged: { $ne: true },
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
// COMMENTS & REPLIES
// ==========================================
router.post("/:postId/comments", postLimiter, async (req, res) => {
	try {
		const { authorId, authorName, content } = req.body;
		const post = await Post.findById(req.params.postId);

		if (checkSpam(content)) {
			return res
				.status(201)
				.json(await hydrateWithPictures(post.toObject()));
		}

		post.comments.push({ authorId, authorName, content });
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

router.post(
	"/:postId/comments/:commentId/replies",
	postLimiter,
	async (req, res) => {
		try {
			const { authorId, authorName, content } = req.body;
			const post = await Post.findById(req.params.postId);
			const comment = post.comments.id(req.params.commentId);

			if (checkSpam(content)) {
				return res
					.status(201)
					.json(await hydrateWithPictures(post.toObject()));
			}

			comment.replies.push({ authorId, authorName, content });
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

// ==========================================
// LIKES
// ==========================================
router.put("/:postId/like", async (req, res) => {
	try {
		const { userId, userName } = req.body;
		const post = await Post.findById(req.params.postId);

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

router.put("/:postId/comments/:commentId/like", async (req, res) => {
	try {
		const { userId, userName } = req.body;
		const post = await Post.findById(req.params.postId);
		const comment = post.comments.id(req.params.commentId);

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
	async (req, res) => {
		try {
			const { userId, userName } = req.body;
			const post = await Post.findById(req.params.postId);
			const comment = post.comments.id(req.params.commentId);
			const reply = comment.replies.id(req.params.replyId);

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

module.exports = router;
