const express = require("express");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authMiddleware } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const xss = require("xss");
const { analyzeContent } = require("../utils/aiModeration");
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

	const users = await User.find({ _id: { $in: Array.from(userIds) } }).select("_id name profilePic").lean();
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
router.get("/", async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page, 10) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
		const skip = (page - 1) * limit;

		const query = { isFlagged: { $ne: true } };
		if (req.query.date && typeof req.query.date === "string") query.targetDate = req.query.date.slice(0, 50);

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
		const { title, content, imageUrl, targetDate, tags, visibility } = req.body;

		if (!title || typeof title !== "string" || !title.trim()) {
			return res.status(400).json({ message: "Post title is required." });
		}
		if (title.trim().length > 200) {
			return res.status(400).json({ message: "Post title cannot exceed 200 characters." });
		}

		if (!content || typeof content !== "string" || !content.trim()) {
			return res.status(400).json({ message: "Post content is required." });
		}
		
		const cleanTitle = xss(title.trim());
		const cleanContent = xss(content.trim());
		const cleanImageUrl = (imageUrl && typeof imageUrl === "string") ? xss(imageUrl.trim()) : "";
		const cleanTags = Array.isArray(tags) ? tags.filter(t => typeof t === "string").map(t => xss(t.trim()).slice(0, 50)) : [];
		
		const isSpam = await checkSpam(cleanTitle) || await checkSpam(cleanContent);
		const aiAnalysis = await analyzeContent(cleanTitle + " " + cleanContent);

		const authorId = (req.user.id || req.user.userId).toString();
		const authorName = req.user.name || req.body.authorName || "Member";

		const newPost = new Post({
			title: cleanTitle,
			content: cleanContent,
			imageUrl: cleanImageUrl,
			tags: cleanTags,
			visibility: visibility || 'PUBLIC',
			authorName,
			targetDate: targetDate || "General",
			authorId,
			isFlagged: isSpam || aiAnalysis.isFlagged,
			toxicityScore: aiAnalysis.score || 0
		});

		await newPost.save();

		if (isSpam || aiAnalysis.isFlagged)
			return res
				.status(201)
				.json({ message: "Post submitted for review." });

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
// EDIT & DELETE POSTS (WITH ADMIN GOD MODE)
// ==========================================
router.put("/:postId", authMiddleware, async (req, res) => {
	try {
		if (!mongoose.isValidObjectId(req.params.postId)) {
			return res.status(400).json({ message: "Invalid post ID format." });
		}

		const { title, content } = req.body;
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

		const cleanTitle = xss(title.trim());
		const cleanContent = xss(content.trim());

		if (await checkSpam(cleanTitle) || await checkSpam(cleanContent)) {
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
		if (await checkSpam(cleanContent))
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
			if (await checkSpam(cleanContent))
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

module.exports = router;


