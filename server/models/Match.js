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

matchSchema.post('save', async function(doc) {
	if (doc.status !== "confirmed") return;
	try {
		const ActivityFeed = require('./ActivityFeed');
		const User = require('./User');
		
		const submitter = await User.findById(doc.submittedBy).lean();
		const t1Users = await User.find({ _id: { $in: doc.team1 } }).lean();
		const t2Users = await User.find({ _id: { $in: doc.team2 } }).lean();

		await ActivityFeed.findOneAndUpdate(
			{ type: "match", referenceId: doc._id },
			{
				type: "match",
				referenceId: doc._id,
				authorId: doc.submittedBy,
				authorName: submitter?.name,
				authorProfilePic: submitter?.profilePic,
				authorSkillLevel: submitter?.skillLevel,
				team1Score: doc.team1Score,
				team2Score: doc.team2Score,
				team1: t1Users.map(u => u.name),
				team2: t2Users.map(u => u.name),
				team1Avatars: t1Users.map(u => u.profilePic),
				team2Avatars: t2Users.map(u => u.profilePic),
				createdAt: doc.date,
				score: doc.team1Score + doc.team2Score
			},
			{ upsert: true, new: true }
		);
	} catch (e) {
		console.error("ActivityFeed sync error (Match):", e);
	}
});

matchSchema.post('findOneAndDelete', async function(doc) {
	if (!doc) return;
	try {
		const ActivityFeed = require('./ActivityFeed');
		await ActivityFeed.deleteOne({ type: "match", referenceId: doc._id });
	} catch (e) {}
});

module.exports = mongoose.model("Match", matchSchema);
