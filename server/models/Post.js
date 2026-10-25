// server/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
	title: { type: String, required: true },
	content: { type: String, required: true },
	authorName: { type: String, required: true },
	authorId: { type: String, required: true },
	targetDate: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
	visibility: { type: String, enum: ['PUBLIC', 'FRIENDS_ONLY', 'ONLY_ME'], default: 'PUBLIC' },
	category: {
		type: String,
		enum: ['general', 'match_result', 'gear_review', 'meetup_rally', 'training', 'find_partner', 'challenge_match', 'qa_forum', 'gear_exchange'],
		default: 'general',
	},
		matchDetails: {
		partner: { type: String, default: "" },
		opponents: { type: [String], default: [] },
		score: { type: String, default: "" },
		court: { type: String, default: "" },
		winner: { type: String, default: "" },
	},
	playerMatchmaking: {
		skillLevelRequired: { type: String, default: 'Any' },
		format: { type: String, default: 'Doubles' },
		preferredCourt: { type: String, default: 'RAC Courts 1-3' },
		rallyDate: { type: Date },
		timeWindow: { type: String, default: '' },
		slotsNeeded: { type: Number, default: 1 },
		rsvpList: [
			{
				userId: { type: String, required: true },
				userName: { type: String, default: 'Player' },
				avatarUrl: { type: String, default: '' },
				status: { type: String, enum: ['confirmed', 'waitlist'], default: 'confirmed' },
				joinedAt: { type: Date, default: Date.now }
			}
		],
		isFilled: { type: Boolean, default: false }
	},
	challengeMatch: {
		matchType: { type: String, default: 'Friendly Scrimmage' },
		gameFormat: { type: String, default: 'Best of 3 to 21' },
		stipulations: { type: String, default: '' },
		matchStatus: { type: String, enum: ['open', 'accepted', 'completed', 'declined'], default: 'open' },
		challengerTeam: [
			{
				userId: { type: String, required: true },
				userName: { type: String, default: 'Challenger' },
				avatarUrl: { type: String, default: '' }
			}
		],
		acceptedBy: [
			{
				userId: { type: String, required: true },
				userName: { type: String, default: 'Opponent' },
				avatarUrl: { type: String, default: '' }
			}
		],
		linkedMatchId: { type: String, default: '' }
	},
	qaDetails: {
		subtopic: { type: String, default: 'General' },
		isResolved: { type: Boolean, default: false },
		acceptedCommentId: { type: String, default: '' },
		acceptedBy: {
			userId: { type: String },
			userName: { type: String },
			at: { type: Date }
		}
	},
	gearDetails: {
		gearType: { type: String, default: 'Racket' },
		brand: { type: String, default: '' },
		condition: { type: String, default: 'Good' },
		specs: {
			weightCode: { type: String, default: '' },
			gripSize: { type: String, default: '' },
			balancePoint: { type: String, default: '' },
			currentString: { type: String, default: '' }
		},
		tradeType: { type: String, default: 'Review / Discussion' },
		price: { type: Number, default: 0 }
	},
likedBy: { type: [String], default: [] },
	isFlagged: { type: Boolean, default: false },
	status: {
		type: String,
		enum: ['active', 'quarantined', 'deleted'],
		default: 'active',
		index: true,
	},
	reportCount: {
		type: Number,
		default: 0,
		index: true,
	},
	reports: [
		{
			reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
			reason: { type: String, trim: true, default: 'Spam/Abuse' },
			timestamp: { type: Date, default: Date.now }
		}
	],
	toxicityScore: { type: Number, default: 0 }, // NEW: Sentiment toxicity tracking
	isEdited: { type: Boolean, default: false }, // NEW: Track post edits
	imageUrl: { type: String, default: "" }, // Legacy
	imageUrls: { type: [String], default: [] }, // NEW: Multiple images
	tags: { type: [String], default: [] }, // NEW: Post categorization tags
	isPinned: { type: Boolean, default: false }, // NEW: Pinned megathread by admins
	reactions: [
		{
			userId: { type: String, required: true },
			userName: { type: String, default: "Player" },
			emoji: { type: String, required: true },
			reactionType: { type: String },
			createdAt: { type: Date, default: Date.now },
		},
	],
	comments: [
		{
			authorId: String,
			authorName: String,
			content: String,
			timestamp: { type: Date, default: Date.now },
			likedBy: { type: [String], default: [] },
			isEdited: { type: Boolean, default: false }, // NEW: Track comment edits
			replies: [
				{
					authorId: String,
					authorName: String,
					content: String,
					timestamp: { type: Date, default: Date.now },
					likedBy: { type: [String], default: [] },
					isEdited: { type: Boolean, default: false }, // NEW: Track reply edits
				},
			],
		},
	],
});

// Compound indexes
PostSchema.index({ status: 1, isPinned: -1, createdAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ tags: 1, createdAt: -1 });

PostSchema.pre('save', function (next) {
	if (!this.createdAt && this.timestamp) {
		this.createdAt = this.timestamp;
	} else if (!this.timestamp && this.createdAt) {
		this.timestamp = this.createdAt;
	}
	if (Array.isArray(this.reactions)) {
		const EMOJI_TO_TYPE = {
			"💥": "smash",
			"🧊": "ice_drop",
			"⚡": "clutch"
		};
		this.reactions.forEach(r => {
			if (!r.reactionType) {
				r.reactionType = (r.emoji && EMOJI_TO_TYPE[r.emoji]) || "custom";
			}
		});
	}
	next();
});

PostSchema.post('save', async function(doc) {
	try {
		const { publishEvent } = require('../utils/kafkaProducer');
		await publishEvent("post-events", { type: "post.updated", payload: doc });
	} catch (err) {
		console.error("Kafka publish error (Post):", err);
	}

	try {
		const ActivityFeed = require('./ActivityFeed');
        
        if (doc.isFlagged || doc.status === 'quarantined' || doc.status === 'deleted') {
            await ActivityFeed.deleteOne({ type: "post", referenceId: doc._id });
            return;
        }

		const User = require('./User');
		const author = await User.findById(doc.authorId).lean();
		
		let recentLikerAvatars = [];
		if (doc.likedBy && doc.likedBy.length > 0) {
			const recentLikers = await User.find({ _id: { $in: doc.likedBy.slice(-3) } }).select('profilePic').lean();
			recentLikerAvatars = recentLikers.map(u => u.profilePic).filter(Boolean);
		}

		await ActivityFeed.findOneAndUpdate(
			{ type: "post", referenceId: doc._id },
			{
				type: "post",
				referenceId: doc._id,
				authorId: doc.authorId,
				authorName: doc.authorName,
				authorProfilePic: author?.profilePic,
				authorSkillLevel: author?.skillLevel,
				authorBadges: author?.badges || [],
				title: doc.title,
				content: doc.content,
				image: doc.imageUrl,
				images: doc.imageUrls || [],
				tags: doc.tags || [],
				isPinned: doc.isPinned || false,
								category: doc.category || 'general',
				matchDetails: doc.matchDetails || null,
				playerMatchmaking: doc.playerMatchmaking || null,
				challengeMatch: doc.challengeMatch || null,
				qaDetails: doc.qaDetails || null,
				gearDetails: doc.gearDetails || null,
				reactions: doc.reactions || [],
				likes: doc.likedBy?.length || 0,
				recentLikerAvatars: recentLikerAvatars,
				comments: doc.comments?.length || 0,
				createdAt: doc.createdAt || doc.timestamp,
				visibility: doc.visibility,
				score: (doc.likedBy?.length || 0) * 2 + (doc.comments?.length || 0) * 3 + (doc.reactions?.length || 0) * 2 + (doc.isPinned ? 1000 : 0)
			},
			{ upsert: true, returnDocument: 'after' }
		);
	} catch (e) {
		console.error("ActivityFeed sync error (Post):", e);
	}
});

PostSchema.post('findOneAndDelete', async function(doc) {
	if (!doc) return;
	try {
		const { publishEvent } = require('../utils/kafkaProducer');
		await publishEvent("post-events", { type: "post.deleted", payload: doc });
	} catch (err) {
		console.error("Kafka publish error (Post delete):", err);
	}
	try {
		const ActivityFeed = require('./ActivityFeed');
		await ActivityFeed.deleteOne({ type: "post", referenceId: doc._id });
	} catch (e) {
		console.error("ActivityFeed sync error (Post delete):", e);
	}
});

module.exports = mongoose.model("Post", PostSchema);
