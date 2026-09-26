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
	toxicityScore: { type: Number, default: 0 }, // NEW: Sentiment toxicity tracking
	isEdited: { type: Boolean, default: false }, // NEW: Track post edits
	imageUrl: { type: String, default: "" }, // Legacy
	imageUrls: { type: [String], default: [] }, // NEW: Multiple images
	tags: { type: [String], default: [] }, // NEW: Post categorization tags
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
		const ActivityFeed = require('./ActivityFeed');
        
        if (doc.isFlagged) {
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
				likes: doc.likedBy?.length || 0,
				recentLikerAvatars: recentLikerAvatars,
				comments: doc.comments?.length || 0,
				createdAt: doc.timestamp,
				visibility: doc.visibility,
				score: (doc.likedBy?.length || 0) * 2 + (doc.comments?.length || 0) * 3
			},
			{ upsert: true, new: true }
		);
	} catch (e) {
		console.error("ActivityFeed sync error (Post):", e);
	}
});

PostSchema.post('findOneAndDelete', async function(doc) {
	if (!doc) return;
	try {
		const ActivityFeed = require('./ActivityFeed');
		await ActivityFeed.deleteOne({ type: "post", referenceId: doc._id });
	} catch (e) {}
});

module.exports = mongoose.model("Post", PostSchema);
