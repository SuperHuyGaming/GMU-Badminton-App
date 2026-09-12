const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
	sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	content: { type: String, required: true },
	read: { type: Boolean, default: false },
	timestamp: { type: Date, default: Date.now },
	isFlagged: { type: Boolean, default: false },
	flagReason: { type: String, default: "" },
	isDeletedByAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model("Message", messageSchema);
