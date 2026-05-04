const mongoose = require("mongoose");

// Level 3: Replies to Comments
const replySchema = new mongoose.Schema({
	authorId: { type: String, required: true },
	authorName: { type: String, required: true },
	content: { type: String, required: true },
	likedBy: [{ type: String }], // NEW: Array to hold User IDs who liked this reply!
	timestamp: { type: Date, default: Date.now },
});

// Level 2: The Main Comments
const commentSchema = new mongoose.Schema({
	authorId: { type: String, required: true }, // Added so we can link to their profile!
	authorName: { type: String, required: true },
	content: { type: String, required: true },
	likedBy: [{ type: String }], // Array of User IDs who liked this comment
	replies: [replySchema], // Array of replies to this comment
	timestamp: { type: Date, default: Date.now },
});

// Level 1: The Main Post
const postSchema = new mongoose.Schema({
	title: { type: String, required: true },
	content: { type: String, required: true },
	authorId: { type: String, required: true },
	authorName: { type: String, required: true },
	targetDate: { type: String, required: true, default: "General" },
	comments: [commentSchema],
	likedBy: [{ type: String }],
	timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", postSchema);
