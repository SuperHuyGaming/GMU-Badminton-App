// server/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
	title: { type: String, required: true },
	content: { type: String, required: true },
	authorName: { type: String, required: true },
	authorId: { type: String, required: true },
	targetDate: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	likedBy: { type: [String], default: [] },
	isFlagged: { type: Boolean, default: false },
	isEdited: { type: Boolean, default: false }, // NEW: Track post edits
	comments: [
		{
			authorId: String,
			authorName: String,
			content: String,
			timestamp: { type: Date, default: Date.now },
			likedBy: { type: [String], default: [] },
			isEdited: { type: Boolean, default: false }, // NEW: Track comment edits
			replies: [
				{
					authorId: String,
					authorName: String,
					content: String,
					timestamp: { type: Date, default: Date.now },
					likedBy: { type: [String], default: [] },
					isEdited: { type: Boolean, default: false }, // NEW: Track reply edits
				},
			],
		},
	],
});

module.exports = mongoose.model("Post", PostSchema);
