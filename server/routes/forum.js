// server/routes/forum.js
const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");

const router = express.Router();

// Helper to shorten long comments in notifications
const truncateText = (text, maxLength = 40) => {
	if (!text) return "";
	return text.length > maxLength
		? text.substring(0, maxLength - 3) + "..."
		: text;
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

router.get("/", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const query = {};

		if (req.query.date) {
			query.targetDate = req.query.date;
		}

		if (req.query.search) {
			const searchRegex = new RegExp(req.query.search, "i");
			query.$or = [
				{ title: searchRegex },
				{ content: searchRegex },
				{ authorName: searchRegex },
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

router.get("/user/:userId", async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const rawPosts = await Post.find({ authorId: req.params.userId })
			.sort({ timestamp: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		res.json(await hydrateWithPictures(rawPosts));
	} catch (error) {
		res.status(500).json({ message: "Error fetching user posts" });
	}
});

router.post("/", async (req, res) => {
	try {
		const { title, content, authorName, targetDate, authorId } = req.body;
		const newPost = new Post({
			title,
			content,
			authorName,
			targetDate: targetDate || "General",
			authorId: authorId || "000000000000000000000000",
		});
		await newPost.save();
		const hydratedPost = await hydrateWithPictures(newPost.toObject());
		if (req.io) req.io.emit("postCreated", hydratedPost);
		res.status(201).json(hydratedPost);
	} catch (error) {
		res.status(500).json({ message: "Error creating post" });
	}
});

router.post("/:postId/comments", async (req, res) => {
	try {
		const { authorId, authorName, content } = req.body;
		const post = await Post.findById(req.params.postId);
		post.comments.push({ authorId, authorName, content });
		await post.save();

		const updatedPost = await Post.findById(req.params.postId).lean();
		const hydratedPost = await hydrateWithPictures(updatedPost);

		if (req.io) {
			req.io.emit("postUpdated", hydratedPost);
			if (post.authorId?.toString() !== authorId.toString()) {
				const newComment =
					updatedPost.comments[updatedPost.comments.length - 1];
				// FIX: Display truncated comment content instead of post title!
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
				// FIX: Don't show the title, just say they liked the post!
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

router.post("/:postId/comments/:commentId/replies", async (req, res) => {
	try {
		const { authorId, authorName, content } = req.body;
		const post = await Post.findById(req.params.postId);
		const comment = post.comments.id(req.params.commentId);

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
					commentToReply.replies[commentToReply.replies.length - 1];
				// FIX: Display truncated reply content!
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
