// server/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
	targetUserId: { type: String, required: true },
	message: { type: String, required: true },
	link: { type: String, required: true },
	read: { type: Boolean, default: false },
	time: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notification", notificationSchema);
