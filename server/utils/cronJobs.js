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

const cron = require('node-cron');
const { runInstagramScraper } = require('./instagramScraper');
const { huntGoogleForTournaments, processDiscoveryQueue } = require('./autonomousHunter');
const Tournament = require('../models/Tournament');
const { sendPushToAllUsers } = require('./pushNotifications');

async function checkTournamentDeadlines() {
    try {
        console.log("[Cron] Checking for approaching tournament registration deadlines...");
        const now = new Date();
        const in48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        // Find tournaments whose registration deadline is between now and 48 hours from now
        // and we haven't warned about them yet.
        const approachingTournaments = await Tournament.find({
            registrationDeadline: { $gte: now, $lte: in48Hours },
            hasSentDeadlineWarning: { $ne: true }
        });

        for (const tourney of approachingTournaments) {
            console.log(`[Cron] Sending 48-hour deadline warning for ${tourney.tournamentName}`);
            await sendPushToAllUsers(
                "🚨 Registration Closing Soon!",
                `Registration for ${tourney.tournamentName} at ${tourney.hostUniversity || 'local courts'} closes in less than 48 hours!`,
                "/tournaments"
            );
            
            tourney.hasSentDeadlineWarning = true;
            await tourney.save();
        }
    } catch (e) {
        console.error("[Cron] Failed to check tournament deadlines:", e);
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
        checkTournamentDeadlines();
    }, 1000 * 60 * 60);

    // Run Autonomous Web Search Hunter every Sunday at 2:00 AM EST
    cron.schedule('0 2 * * 0', () => {
        console.log("Running scheduled Autonomous Google Search Hunter...");
        huntGoogleForTournaments();
    }, {
        timezone: "America/New_York"
    });

    // Process the Discovery Queue every hour
    cron.schedule('0 * * * *', () => {
        console.log("Running scheduled AI Evaluation of Discovery Queue...");
        processDiscoveryQueue();
    });

    // Run Instagram Scraper every night at 3:00 AM EST
    cron.schedule('0 3 * * *', () => {
        console.log("Running scheduled DMV Instagram Scraper...");
        runInstagramScraper();
    }, {
        timezone: "America/New_York"
    });

    // Run Deadline Checker every morning at 9:00 AM EST
    cron.schedule('0 9 * * *', () => {
        console.log("Running scheduled Tournament Deadline checker...");
        checkTournamentDeadlines();
    }, {
        timezone: "America/New_York"
    });
}

module.exports = startCronJobs;
