// server/models/Announcement.js
const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
	content: { type: String, required: true },
	authorName: { type: String, required: true },
	authorId: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Announcement", announcementSchema);
