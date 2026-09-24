const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const Match = require("../models/Match");
const EquipmentListing = require("../models/EquipmentListing");
const User = require("../models/User");

router.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // 1. Fetch recent Forum Posts
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("authorId", "name profilePic skillLevel homeUniversity")
            .lean();

        const formattedPosts = posts.map(post => ({
            type: "post",
            id: post._id,
            author: post.authorId,
            authorName: post.authorName, // Keep legacy field
            content: post.content,
            title: post.title,
            image: post.image,
            createdAt: post.createdAt,
            likes: post.likedBy?.length || 0,
            comments: post.comments?.length || 0
        }));

        // 2. Fetch recent Confirmed Matches
        const matches = await Match.find({ status: "confirmed" })
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .populate("team1", "name profilePic")
            .populate("team2", "name profilePic")
            .lean();

        const formattedMatches = matches.map(match => ({
            type: "match",
            id: match._id,
            matchType: match.type,
            team1: match.team1,
            team2: match.team2,
            team1Score: match.team1Score,
            team2Score: match.team2Score,
            winner: match.winner,
            createdAt: match.date
        }));

        // Combine all arrays
        const combinedFeed = [...formattedPosts, ...formattedMatches];

        // Sort chronologically (newest first)
        combinedFeed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // We fetched 'limit' items from each collection, so we have up to 2*limit items.
        // We only return the top 'limit' items to form a perfect chronological page.
        const paginatedFeed = combinedFeed.slice(0, limit);

        res.json({
            feed: paginatedFeed,
            hasMore: combinedFeed.length > limit // If we had more than limit items, there's likely another page
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
