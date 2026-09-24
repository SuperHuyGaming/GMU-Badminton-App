const mongoose = require("mongoose");
const Post = require("../models/Post");
const Match = require("../models/Match");
const ActivityFeed = require("../models/ActivityFeed");

async function seedFeedIfEmpty() {
    try {
        const count = await ActivityFeed.countDocuments();
        if (count > 0) return;
        
        console.log("ActivityFeed is empty. Seeding from existing Posts and Matches...");
        
        const posts = await Post.find().populate("authorId", "name profilePic skillLevel").lean();
        for (const post of posts) {
            // Fix: If authorId population failed (e.g., dummy user or deleted), fallback to the original post.authorId or a generic ObjectId
            const resolvedAuthorId = post.authorId?._id || post.authorId || "000000000000000000000000";
            
            await ActivityFeed.create({
                type: "post",
                referenceId: post._id,
                authorId: resolvedAuthorId,
                authorName: post.authorId?.name || post.authorName || "Unknown User",
                authorProfilePic: post.authorId?.profilePic,
                authorSkillLevel: post.authorId?.skillLevel,
                title: post.title,
                content: post.content,
                image: post.image,
                likes: post.likedBy?.length || 0,
                comments: post.comments?.length || 0,
                createdAt: post.createdAt,
                score: (post.likedBy?.length || 0) * 2 + (post.comments?.length || 0) * 3
            }).catch((err) => console.error("Failed to seed post:", post._id, err.message));
        }

        const matches = await Match.find({ status: "confirmed" })
            .populate("team1", "name profilePic")
            .populate("team2", "name profilePic")
            .populate("submitterId", "name profilePic skillLevel")
            .lean();
            
        for (const match of matches) {
            await ActivityFeed.create({
                type: "match",
                referenceId: match._id,
                authorId: match.submitterId?._id,
                authorName: match.submitterId?.name,
                authorProfilePic: match.submitterId?.profilePic,
                authorSkillLevel: match.submitterId?.skillLevel,
                team1Score: match.team1Score,
                team2Score: match.team2Score,
                team1: match.team1?.map(u => u.name),
                team2: match.team2?.map(u => u.name),
                team1Avatars: match.team1?.map(u => u.profilePic),
                team2Avatars: match.team2?.map(u => u.profilePic),
                createdAt: match.date,
                score: match.team1Score + match.team2Score
            }).catch(() => {});
        }
        
        console.log("ActivityFeed seeding complete!");
    } catch (e) {
        console.error("Failed to seed ActivityFeed:", e);
    }
}

module.exports = seedFeedIfEmpty;
