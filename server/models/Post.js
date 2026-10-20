// server/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
	title: { type: String, required: true },
	content: { type: String, required: true },
	authorName: { type: String, required: true },
	authorId: { type: String, required: true },
	targetDate: { type: String, required: true },
	timestamp: { type: Date, default: Date.now },
	visibility: { type: String, enum: ['PUBLIC', 'FRIENDS_ONLY', 'ONLY_ME'], default: 'PUBLIC' },
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
				reactions: doc.reactions || [],
				likes: doc.likedBy?.length || 0,
				recentLikerAvatars: recentLikerAvatars,
				comments: doc.comments?.length || 0,
				createdAt: doc.timestamp,
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
