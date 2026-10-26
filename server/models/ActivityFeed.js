const mongoose = require("mongoose");

const activityFeedSchema = new mongoose.Schema({
    type: { type: String, enum: ["post", "match", "listing"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String },
    authorProfilePic: { type: String },
    authorSkillLevel: { type: String },
    authorBadges: { type: [String], default: [] },
    authorRole: { type: String, default: "user" },
    authorStreak: { type: Number, default: 0 },
    
    // Extracted payload for O(1) reads without population
    title: { type: String },
    content: { type: String },
    image: { type: String },
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    category: { type: String, default: "general" },
    matchDetails: { type: mongoose.Schema.Types.Mixed },
    playerMatchmaking: { type: mongoose.Schema.Types.Mixed },
    challengeMatch: { type: mongoose.Schema.Types.Mixed },
    qaDetails: { type: mongoose.Schema.Types.Mixed },
    gearDetails: { type: mongoose.Schema.Types.Mixed },
    
    // Match specific
    team1Score: Number,
    team2Score: Number,
    team1: [String], // Array of names
    team2: [String],
	team1Avatars: [String], // Avatars
	team2Avatars: [String],
    
    // Engagement
    likes: { type: Number, default: 0 },
    recentLikerAvatars: { type: [String], default: [] },
    comments: { type: Number, default: 0 },
    
    // Scoring for personalization
    score: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    reactions: [
        {
            userId: String,
            userName: String,
            emoji: String,
            reactionType: String,
            createdAt: { type: Date, default: Date.now },
        }
    ],

    createdAt: { type: Date, default: Date.now },
    visibility: { type: String, enum: ['PUBLIC', 'FRIENDS_ONLY', 'ONLY_ME'], default: 'PUBLIC' },
});

// Index for fast chronological fetching (pinned posts first)
activityFeedSchema.index({ isPinned: -1, createdAt: -1 });
activityFeedSchema.index({ createdAt: -1 });
// Index for algorithmic sorting
activityFeedSchema.index({ isPinned: -1, score: -1, createdAt: -1 });
activityFeedSchema.index({ score: -1, createdAt: -1 });
activityFeedSchema.index({ category: 1, createdAt: -1 });
activityFeedSchema.index({ tags: 1, createdAt: -1 });
// Ensure we don't duplicate events
activityFeedSchema.index({ type: 1, referenceId: 1 }, { unique: true });

module.exports = mongoose.model("ActivityFeed", activityFeedSchema);
