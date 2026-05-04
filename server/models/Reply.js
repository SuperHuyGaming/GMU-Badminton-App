const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
	// Reference to the parent post [cite: 99]
	postId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Post",
		required: true,
	},
	authorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	authorName: { type: String, required: true },
	content: { type: String, required: true }, // The response text [cite: 100]
	timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Reply", replySchema);
