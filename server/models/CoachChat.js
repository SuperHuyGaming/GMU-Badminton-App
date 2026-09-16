// server/models/CoachChat.js
const mongoose = require("mongoose");

const coachMessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "model"],
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

const coachChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    messages: [coachMessageSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Auto-update the updatedAt timestamp
coachChatSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

// Keep only the last 50 messages per user to control token costs
coachChatSchema.methods.trimHistory = function () {
    if (this.messages.length > 50) {
        this.messages = this.messages.slice(-50);
    }
};

module.exports = mongoose.model("CoachChat", coachChatSchema);
