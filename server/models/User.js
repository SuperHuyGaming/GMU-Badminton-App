// server/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	name: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },

	role: {
		type: String,
		enum: ["user", "admin"],
		default: "user",
	},

	// Player Card Fields
	skillLevel: {
		type: String,
		enum: ["D Level", "C Level", "B Level"],
		default: "D Level",
	},
	bio: { type: String, default: "I'm ready to play!" },
	preferredPlay: { type: String, default: "Any" }, // Singles, Doubles, Mixed
	racket: { type: String, default: "N/A" },
	profilePic: { type: String, default: "" },
	coverPic: { type: String, default: "" },

	// Gamification
	badges: { type: [String], default: [] }, // Array of badge IDs e.g. ["first_win", "streak_5"]
	stats: {
		totalMatches: { type: Number, default: 0 },
		winStreak: { type: Number, default: 0 },
		highestWinStreak: { type: Number, default: 0 },
	},

	// Friends System
	friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

	// Elo Ranking System
	singlesElo: { type: Number, default: 1200 },
	doublesElo: { type: Number, default: 1200 },

	// Web Push Subscriptions for Notifications
	pushSubscriptions: { type: Array, default: [] },

	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
