const mongoose = require("mongoose");

const activityFeedSchema = new mongoose.Schema({
    type: { type: String, enum: ["post", "match", "listing"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String },
    authorProfilePic: { type: String },
    authorSkillLevel: { type: String },
    
    // Extracted payload for O(1) reads without population
    title: { type: String },
    content: { type: String },
    image: { type: String },
    
    // Match specific
    team1Score: Number,
    team2Score: Number,
    team1: [String], // Array of names
    team2: [String],
	team1Avatars: [String], // Avatars
	team2Avatars: [String],
    
    // Engagement
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    
    // Scoring for personalization
    score: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },
});

// Index for fast chronological fetching
activityFeedSchema.index({ createdAt: -1 });
// Index for algorithmic sorting
activityFeedSchema.index({ score: -1, createdAt: -1 });
// Ensure we don't duplicate events
activityFeedSchema.index({ type: 1, referenceId: 1 }, { unique: true });

module.exports = mongoose.model("ActivityFeed", activityFeedSchema);
