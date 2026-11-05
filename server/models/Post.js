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
		isEnabled: { type: Boolean, default: false },
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
	rsvp: {
		capacity: { type: Number, default: 0 },
		attendees: [{ type: String }],
		waitlist: [{ type: String }]
	},
	challengeMatch: {
		isEnabled: { type: Boolean, default: false },
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
		isEnabled: { type: Boolean, default: false },
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
		isEnabled: { type: Boolean, default: false },
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
			details: { type: String, trim: true, default: '' },
			timestamp: { type: Date, default: Date.now }
		}
	],
	toxicityScore: { type: Number, default: 0 }, // NEW: Sentiment toxicity tracking
	isEdited: { type: Boolean, default: false }, // NEW: Track post edits
	editedAt: { type: Date }, // NEW: Edit timestamp
	lastActivityAt: { type: Date, default: Date.now, index: true }, // NEW: Activity timestamp
	originalPostId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null, index: true }, // NEW: Repost parent reference
	sharedThought: { type: String, default: "" }, // NEW: Thoughts shared with repost
	shareCount: { type: Number, default: 0 }, // NEW: Repost count tracking
	imageUrl: { type: String, default: "" }, // Legacy
	imageUrls: { type: [String], default: [] }, // NEW: Multiple images
	videoUrl: { type: String, default: "" }, // M3: Video media upload
	videoThumbnail: { type: String, default: "" },
	videoDuration: { type: Number, default: 0 },
	videoWidth: { type: Number, default: 0 },
	videoHeight: { type: Number, default: 0 },
	audioUrl: { type: String, default: "" }, // M3: Audio media upload
	audioDuration: { type: Number, default: 0 },
	linkPreviews: [
		{
			url: { type: String },
			title: { type: String, default: "" },
			description: { type: String, default: "" },
			image: { type: String, default: "" },
			imageUrl: { type: String, default: "" },
			siteName: { type: String, default: "" },
			domain: { type: String, default: "" },
		}
	],
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
			reactions: [
				{
					userId: { type: String, required: true },
					userName: { type: String, default: "Player" },
					emoji: { type: String, required: true },
					reactionType: { type: String },
					createdAt: { type: Date, default: Date.now },
				},
			],
			isEdited: { type: Boolean, default: false }, // NEW: Track comment edits
			editedAt: { type: Date }, // NEW: Comment edit timestamp
			isFlagged: { type: Boolean, default: false },
			reportCount: { type: Number, default: 0 },
			reports: [
				{
					reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
					reason: { type: String, trim: true, default: 'Spam/Abuse' },
					details: { type: String, trim: true, default: '' },
					timestamp: { type: Date, default: Date.now },
				},
			],
			replies: [
				{
					authorId: String,
					authorName: String,
					content: String,
					timestamp: { type: Date, default: Date.now },
					likedBy: { type: [String], default: [] },
					reactions: [
						{
							userId: { type: String, required: true },
							userName: { type: String, default: "Player" },
							emoji: { type: String, required: true },
							reactionType: { type: String },
							createdAt: { type: Date, default: Date.now },
						},
					],
					isEdited: { type: Boolean, default: false }, // NEW: Track reply edits
					editedAt: { type: Date }, // NEW: Reply edit timestamp
					isFlagged: { type: Boolean, default: false },
					reportCount: { type: Number, default: 0 },
					reports: [
						{
							reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
							reason: { type: String, trim: true, default: 'Spam/Abuse' },
							details: { type: String, trim: true, default: '' },
							timestamp: { type: Date, default: Date.now },
						},
					],
				},
			],
		},
	],
});

// Compound indexes
PostSchema.index({ status: 1, isPinned: -1, createdAt: -1 });
PostSchema.index({ status: 1, isPinned: -1, lastActivityAt: -1 });
PostSchema.index({ isPinned: -1, lastActivityAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ tags: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ timestamp: -1 });

PostSchema.pre('save', function (next) {
	if (!this.createdAt && this.timestamp) {
		this.createdAt = this.timestamp;
	} else if (!this.timestamp && this.createdAt) {
		this.timestamp = this.createdAt;
	}
	if (!this.lastActivityAt) {
		this.lastActivityAt = this.createdAt || this.timestamp || new Date();
	}
	if (Array.isArray(this.reactions)) {
		const EMOJI_TO_TYPE = {
			"💥": "smash",
			"🧊": "ice_drop",
			"⚡": "clutch",
			"👍": "like",
			"❤️": "love",
			"🏸": "smash",
			"😮": "wow",
			"😂": "haha",
			"😢": "sad",
			"🔥": "smash",
			"💯": "clutch",
			"👏": "like"
		};
		this.reactions.forEach(r => {
			if (!r.reactionType) {
				r.reactionType = (r.emoji && EMOJI_TO_TYPE[r.emoji]) || "custom";
			}
		});
	}
	if (typeof next === 'function') {
		next();
	}
});

PostSchema.post('save', async function(doc) {
	try {
		const feedCache = require('../utils/feedCache');
		feedCache.invalidateFeed();
	} catch (err) {}

	try {
		// Fire-and-forget: never block the save (and the request behind it) on Kafka
		const kafkaProducer = require('../utils/kafkaProducer');
		const message = { type: "post.updated", payload: doc };
		if (typeof kafkaProducer.publishEventInBackground === 'function') {
			kafkaProducer.publishEventInBackground("post-events", message);
		} else if (typeof kafkaProducer.publishEvent === 'function') {
			Promise.resolve(kafkaProducer.publishEvent("post-events", message)).catch(() => {});
		}
	} catch (err) {
		console.error("Kafka publish error (Post):", err?.message || err);
	}

	try {
		const ActivityFeed = require('./ActivityFeed');
        
        if (doc.status === 'deleted') {
            await ActivityFeed.deleteOne({ type: "post", referenceId: doc._id });
            return;
        }
		const isQuarantined = Boolean(doc.isFlagged || doc.status === 'quarantined');

		const User = require('./User');
		const author = (doc.authorId && mongoose.isValidObjectId(doc.authorId))
			? await User.findById(doc.authorId).lean()
			: null;
		
		let recentLikerAvatars = [];
		if (doc.likedBy && doc.likedBy.length > 0) {
			const validLikers = doc.likedBy.slice(-3).filter(id => id && mongoose.isValidObjectId(id));
			const recentLikers = validLikers.length > 0
				? await User.find({ _id: { $in: validLikers } }).select('profilePic').lean()
				: [];
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
				authorRole: author?.role || "user",
				authorStreak: author?.stats?.winStreak || 0,
				title: doc.title,
				content: doc.content,
				image: doc.imageUrl,
				images: doc.imageUrls || [],
				videoUrl: doc.videoUrl || "",
				videoThumbnail: doc.videoThumbnail || "",
				audioUrl: doc.audioUrl || "",
				linkPreviews: doc.linkPreviews || [],
				tags: doc.tags || [],
				isPinned: doc.isPinned || false,
				category: doc.category || 'general',
				matchDetails: doc.matchDetails || null,
				playerMatchmaking: doc.playerMatchmaking || null,
				rsvp: doc.rsvp || null,
				challengeMatch: doc.challengeMatch || null,
				qaDetails: doc.qaDetails || null,
				gearDetails: doc.gearDetails || null,
				reactions: doc.reactions || [],
				likes: doc.likedBy?.length || 0,
				recentLikerAvatars: recentLikerAvatars,
				comments: doc.comments?.length || 0,
				createdAt: doc.createdAt || doc.timestamp,
				visibility: doc.visibility || 'PUBLIC',
				pendingReview: isQuarantined,
				score: (doc.reactions?.length || 0) + (doc.comments?.length || 0) * 2 + (doc.likedBy?.length || 0) * 2 + (doc.isPinned ? 1000 : 0),
				lastActivityAt: doc.lastActivityAt || doc.createdAt || doc.timestamp,
				originalPostId: doc.originalPostId || null,
				sharedThought: doc.sharedThought || "",
				shareCount: doc.shareCount || 0,
				isEdited: doc.isEdited || false,
				editedAt: doc.editedAt || null
			},
			{ upsert: true, returnDocument: 'after' }
		);

		const feedCache = require('../utils/feedCache');
		feedCache.invalidateFeed();
	} catch (e) {
		console.error("ActivityFeed sync error (Post):", e);
	}
});

PostSchema.post('findOneAndDelete', async function(doc) {
	try {
		const feedCache = require('../utils/feedCache');
		feedCache.invalidateFeed();
	} catch (err) {}

	if (!doc) return;
	try {
		const kafkaProducer = require('../utils/kafkaProducer');
		const message = { type: "post.deleted", payload: doc };
		if (typeof kafkaProducer.publishEventInBackground === 'function') {
			kafkaProducer.publishEventInBackground("post-events", message);
		} else if (typeof kafkaProducer.publishEvent === 'function') {
			Promise.resolve(kafkaProducer.publishEvent("post-events", message)).catch(() => {});
		}
	} catch (err) {
		console.error("Kafka publish error (Post delete):", err?.message || err);
	}
	try {
		const ActivityFeed = require('./ActivityFeed');
		await ActivityFeed.deleteOne({ type: "post", referenceId: doc._id });
	} catch (e) {
		console.error("ActivityFeed sync error (Post delete):", e);
	}
});

module.exports = mongoose.model("Post", PostSchema);
