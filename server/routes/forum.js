// server/routes/forum.js
const express = require("express");
const Post = require("../models/Post");

const router = express.Router();

// GET: Fetch all posts
router.get("/", async (req, res) => {
	try {
		const posts = await Post.find().sort({ timestamp: -1 });
		res.json(posts);
	} catch (error) {
		res.status(500).json({ message: "Server error fetching posts" });
	}
});

// POST: Create a new main post
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

		// NEW: Broadcast to everyone that a brand new thread was created!
		if (req.io) {
			req.io.emit("postCreated", newPost);
		}

		res.status(201).json(newPost);
	} catch (error) {
		console.error("Error creating post:", error);
		res.status(500).json({ message: "Server error creating post" });
	}
});

// --- LEVEL 1: MAIN POST INTERACTIONS ---

// POST: Add a main comment to a specific post
router.post("/:postId/comments", async (req, res) => {
	try {
		const { authorId, authorName, content } = req.body;

		const updatedPost = await Post.findByIdAndUpdate(
			req.params.postId,
			{ $push: { comments: { authorId, authorName, content } } },
			{ new: true },
		);

		if (!updatedPost)
			return res.status(404).json({ message: "Post not found" });

		// NEW: Broadcast the updated post with the new comment
		if (req.io) {
			req.io.emit("postUpdated", updatedPost);
		}

		res.json(updatedPost);
	} catch (error) {
		res.status(500).json({ message: "Server error adding comment" });
	}
});

// PUT: Toggle Like on the Main Post
router.put("/:postId/like", async (req, res) => {
	try {
		const { userId } = req.body;
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		const hasLiked = post.likedBy.includes(userId);
		if (hasLiked) {
			post.likedBy = post.likedBy.filter((id) => id !== userId);
		} else {
			post.likedBy.push(userId);
		}

		await post.save();

		// NEW: Broadcast the new like count
		if (req.io) {
			req.io.emit("postUpdated", post);
		}

		res.json(post);
	} catch (error) {
		res.status(500).json({ message: "Server error toggling like" });
	}
});

// --- LEVEL 2 & 3: COMMENT INTERACTIONS ---

// PUT: Toggle Like on a specific Comment
router.put("/:postId/comments/:commentId/like", async (req, res) => {
	try {
		const { userId } = req.body;
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		const comment = post.comments.id(req.params.commentId);
		if (!comment)
			return res.status(404).json({ message: "Comment not found" });

		const hasLiked = comment.likedBy.includes(userId);
		if (hasLiked) {
			comment.likedBy = comment.likedBy.filter((id) => id !== userId);
		} else {
			comment.likedBy.push(userId);
		}

		await post.save();

		// NEW: Broadcast the new comment like count
		if (req.io) {
			req.io.emit("postUpdated", post);
		}

		res.json(post);
	} catch (error) {
		res.status(500).json({ message: "Server error toggling comment like" });
	}
});

// POST: Add a Reply to a specific Comment
router.post("/:postId/comments/:commentId/replies", async (req, res) => {
	try {
		const { authorId, authorName, content } = req.body;
		const post = await Post.findById(req.params.postId);
		if (!post) return res.status(404).json({ message: "Post not found" });

		const comment = post.comments.id(req.params.commentId);
		if (!comment)
			return res.status(404).json({ message: "Comment not found" });

		comment.replies.push({ authorId, authorName, content });
		await post.save();

		// NEW: Broadcast the newly added reply
		if (req.io) {
			req.io.emit("postUpdated", post);
		}

		res.json(post);
	} catch (error) {
		res.status(500).json({ message: "Server error adding reply" });
	}
});

router.put(
	"/:postId/comments/:commentId/replies/:replyId/like",
	async (req, res) => {
		try {
			const { userId } = req.body;
			const post = await Post.findById(req.params.postId);
			if (!post)
				return res.status(404).json({ message: "Post not found" });

			const comment = post.comments.id(req.params.commentId);
			if (!comment)
				return res.status(404).json({ message: "Comment not found" });

			const reply = comment.replies.id(req.params.replyId);
			if (!reply)
				return res.status(404).json({ message: "Reply not found" });

			const hasLiked = reply.likedBy.includes(userId);
			if (hasLiked) {
				reply.likedBy = reply.likedBy.filter((id) => id !== userId);
			} else {
				reply.likedBy.push(userId);
			}

			await post.save();

			// NEW: Broadcast the new reply like count
			if (req.io) {
				req.io.emit("postUpdated", post);
			}

			res.json(post);
		} catch (error) {
			res.status(500).json({
				message: "Server error toggling reply like",
			});
		}
	},
);

module.exports = router;
