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

	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
