const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
	type: { type: String, enum: ["singles", "doubles"], required: true },
	team1: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
	team2: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
	team1Score: { type: Number, required: true },
	team2Score: { type: Number, required: true },
	winner: { type: String, enum: ["team1", "team2"], required: true },
	
	// Elo tracking (how much they gained/lost)
	eloChanges: [{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		change: { type: Number }
	}],

	// To prevent abuse, a match must be confirmed by at least one member of the opposing team
	status: { type: String, enum: ["pending", "confirmed", "rejected"], default: "pending" },
	submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	
	date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Match", matchSchema);
