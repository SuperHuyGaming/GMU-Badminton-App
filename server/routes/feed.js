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

        // 1. Fetch recent Forum Posts
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("authorId", "name profilePic skillLevel homeUniversity")
            .lean();

        const formattedPosts = posts.map(post => ({
            type: "post",
            id: post._id,
            author: post.authorId,
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

        // 3. Fetch recent Marketplace Listings
        const listings = await EquipmentListing.find({ status: "available" })
            .sort({ date: -1 })
            .limit(limit)
            .populate("sellerId", "name profilePic")
            .lean();

        const formattedListings = listings.map(listing => ({
            type: "listing",
            id: listing._id,
            seller: listing.sellerId,
            title: listing.title,
            price: listing.price,
            category: listing.category,
            condition: listing.condition,
            image: listing.images?.[0] || null,
            createdAt: listing.date
        }));

        // Combine all arrays
        const combinedFeed = [...formattedPosts, ...formattedMatches, ...formattedListings];

        // Sort chronologically (newest first)
        combinedFeed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Paginate the combined feed in memory
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedFeed = combinedFeed.slice(startIndex, endIndex);

        res.json({
            feed: paginatedFeed,
            hasMore: endIndex < combinedFeed.length
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
