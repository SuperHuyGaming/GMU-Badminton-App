const mongoose = require("mongoose");

const unwrapUser = (val) => {
	if (val && typeof val === "object" && val.user) {
		return val.user;
	}
	return val;
};

const matchSchema = new mongoose.Schema({
	type: { type: String, enum: ["singles", "doubles"], default: "singles" },
	matchType: { type: String, default: "singles" },
	team1: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		set: unwrapUser
	}],
	team2: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		set: unwrapUser
	}],
	team1Score: {
		type: Number,
		required: function() { return this.status !== "scheduled"; }
	},
	team2Score: {
		type: Number,
		required: function() { return this.status !== "scheduled"; }
	},
	winner: {
		type: String,
		enum: ["team1", "team2"],
		required: function() { return this.status !== "scheduled"; }
	},
	
	// Elo tracking (how much they gained/lost)
	eloChanges: [{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		change: { type: Number }
	}],

	// To prevent abuse, a match must be confirmed by at least one member of the opposing team
	status: {
		type: String,
		enum: ["scheduled", "pending", "confirmed", "rejected"],
		default: "pending"
	},
	submittedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: function() { return this.status !== "scheduled"; }
	},

	// Challenge Metadata & Community Match Integration
	challengeMetadata: {
		postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
		acceptedAt: { type: Date, default: Date.now }
	},
	source: {
		type: String,
		enum: ["manual", "community_challenge", "tournament"],
		default: "manual"
	},
	communityPostId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
	stipulations: { type: String, default: "" },
	scheduledAt: { type: Date },
	
	date: { type: Date, default: Date.now }
});

// At most one Match per community challenge post (guards against double-accept races)
matchSchema.index(
	{ communityPostId: 1 },
	{ unique: true, partialFilterExpression: { communityPostId: { $type: "objectId" } } }
);

matchSchema.pre('validate', function(next) {
	if (!this.type && this.matchType) {
		const mt = String(this.matchType).toLowerCase();
		this.type = mt.includes("double") ? "doubles" : "singles";
	}
	if (!this.matchType && this.type) {
		this.matchType = this.type;
	}
	if (!this.type) {
		this.type = "singles";
	}
	if (Array.isArray(this.team1)) {
		this.team1 = this.team1.map(t => (t && typeof t === 'object' && t.user ? t.user : t));
	}
	if (Array.isArray(this.team2)) {
		this.team2 = this.team2.map(t => (t && typeof t === 'object' && t.user ? t.user : t));
	}
	if (typeof next === 'function') next();
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
				category: "match_result",
				referenceId: doc._id,
				authorId: doc.submittedBy,
				authorName: submitter?.name,
				authorProfilePic: submitter?.profilePic,
				authorSkillLevel: submitter?.skillLevel,
				authorBadges: submitter?.badges || [],
				team1Score: doc.team1Score,
				team2Score: doc.team2Score,
				team1: t1Users.map(u => u.name),
				team2: t2Users.map(u => u.name),
				team1Avatars: t1Users.map(u => u.profilePic),
				team2Avatars: t2Users.map(u => u.profilePic),
				createdAt: doc.date,
				score: doc.team1Score + doc.team2Score
			},
			{ upsert: true, returnDocument: 'after' }
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
	} catch (e) {
		console.error("ActivityFeed sync error (Match delete):", e);
	}
});

module.exports = mongoose.model("Match", matchSchema);
