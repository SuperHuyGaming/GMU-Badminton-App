// server/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	name: { type: String, required: true },
	firstName: { type: String },
	lastName: { type: String },
	internalId: { type: String, unique: true, sparse: true },
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

	// Preferences
	homeUniversity: { type: String, default: "George Mason University" },
	searchRadius: { type: Number, default: 50 },

	// Geospatial Location (Task 4: Geolocation Proximity API)
	location: {
		type: {
			type: String,
			enum: ["Point"],
			default: "Point",
		},
		coordinates: {
			type: [Number], // [longitude, latitude]
			default: [0, 0],
		},
	},

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

	// Bookmarks
	bookmarkedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],

	// Calendar / RSVPs
	rsvpedTournaments: [{ type: String }], // Array of Tournament IDs

	lastActive: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
});

// Create geospatial index for sub-millisecond location discovery
userSchema.index({ location: "2dsphere" });

userSchema.index({ name: 1 });
userSchema.index({ homeUniversity: 1, lastActive: -1 });
userSchema.index({ skillLevel: 1, lastActive: -1 });

const { publishEvent } = require("../utils/kafkaProducer");

const sanitizeUserForEvent = (doc) => {
	if (!doc) return null;
	const userObj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
	delete userObj.password;
	delete userObj.email;
	delete userObj.pushSubscriptions;
	return userObj;
};

userSchema.post("save", async function (doc) {
	try {
		await publishEvent("user-events", { type: "user.updated", payload: sanitizeUserForEvent(doc) });
	} catch (error) {
		console.error("Kafka publish error (User save):", error);
	}
});

userSchema.post("findOneAndDelete", async function (doc) {
	if (!doc) return;
	try {
		await publishEvent("user-events", { type: "user.deleted", payload: sanitizeUserForEvent(doc) });
	} catch (error) {
		console.error("Kafka publish error (User delete):", error);
	}
});

module.exports = mongoose.model("User", userSchema);
