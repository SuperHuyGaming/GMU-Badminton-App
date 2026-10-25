// server/models/Feedback.js
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
	{
		type: {
			type: String,
			enum: ["bug", "feedback", "feature"],
			default: "bug",
			required: true,
			index: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
			maxlength: 150,
		},
		description: {
			type: String,
			required: true,
			trim: true,
			maxlength: 3000,
		},
		severity: {
			type: String,
			enum: ["low", "medium", "high", "critical"],
			default: "medium",
		},
		pageUrl: {
			type: String,
			trim: true,
			maxlength: 500,
			default: "",
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		userName: {
			type: String,
			trim: true,
			maxlength: 100,
			default: "Anonymous",
		},
		userEmail: {
			type: String,
			trim: true,
			maxlength: 100,
			default: "",
		},
		status: {
			type: String,
			enum: ["pending", "in_progress", "resolved", "dismissed"],
			default: "pending",
			index: true,
		},
		adminNotes: {
			type: String,
			trim: true,
			maxlength: 1000,
			default: "",
		},
		images: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Feedback", feedbackSchema);
