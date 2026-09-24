const mongoose = require("mongoose");
const User = require("../models/User");
const ActivityFeed = require("../models/ActivityFeed");
const Post = require("../models/Post");

async function assignTopContributorBadges() {
    try {
        console.log("[Gamification] Computing Top Contributors...");
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const topContributors = await ActivityFeed.aggregate([
            { $match: { type: "post", createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: "$authorId", totalScore: { $sum: "$score" } } },
            { $sort: { totalScore: -1 } },
            { $limit: 3 }
        ]);

        const topIds = topContributors.map(c => c._id);

        // 1. Remove the badge from everyone who currently has it
        await User.updateMany(
            { badges: "top_contributor" },
            { $pull: { badges: "top_contributor" } }
        );

                // 2. Add the badge to the new top 3
        if (topIds.length > 0) {
            await User.updateMany(
                { _id: { $in: topIds } },
                { $addToSet: { badges: "top_contributor" } }
            );
            
            // Sync to ActivityFeed so old posts show the shiny badge
            await ActivityFeed.updateMany(
                { authorId: { $in: topIds } },
                { $addToSet: { authorBadges: "top_contributor" } }
            );
            
            console.log(`[Gamification] Awarded Top Contributor to ${topIds.length} users.`);
        }
            );
            console.log(`[Gamification] Awarded Top Contributor to ${topIds.length} users.`);
        }
    } catch (e) {
        console.error("[Gamification] Failed to compute Top Contributors:", e);
    }
}

async function createMatchOfTheWeek() {
    try {
        console.log("[Gamification] Checking for Match of the Week...");
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find the most intense/highest scoring match of the week
        const topMatch = await ActivityFeed.findOne({ 
            type: "match", 
            createdAt: { $gte: sevenDaysAgo } 
        }).sort({ score: -1 }).lean();

        if (!topMatch) return;

        // Check if we already highlighted a match recently (this week)
        const recentHighlight = await Post.findOne({
            authorName: "System Auto-Highlight",
            timestamp: { $gte: sevenDaysAgo }
        });

        if (recentHighlight) return; // Already did one this week

        // Create the highlighted post
        const content = `🏆 **MATCH OF THE WEEK** 🏆\n\nWhat an absolutely incredible showdown!\n\n${topMatch.team1.join(" & ")} went head-to-head against ${topMatch.team2.join(" & ")}, culminating in a breathtaking ${topMatch.team1Score} - ${topMatch.team2Score} finish!\n\nDrop a like to congratulate the players on leaving it all on the court! 🔥🏸`;

        const newPost = new Post({
            title: "🏆 Match of the Week Highlights!",
            content: content,
            authorName: "System Auto-Highlight",
            authorId: "000000000000000000000000", // system mock ID
            targetDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
        });

        await newPost.save(); // The Mongoose hook we built will auto-sync this to ActivityFeed!
        console.log("[Gamification] Match of the Week auto-generated!");
    } catch (e) {
        console.error("[Gamification] Failed to create Match of the Week:", e);
    }
}

function startCronJobs() {
    // Run immediately on boot
    assignTopContributorBadges();
    createMatchOfTheWeek();

    // Then run every hour
    setInterval(() => {
        assignTopContributorBadges();
        createMatchOfTheWeek();
    }, 1000 * 60 * 60);
}

module.exports = startCronJobs;
