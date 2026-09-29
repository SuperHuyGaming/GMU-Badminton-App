const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Match = require("../models/Match");
const User = require("../models/User");
const { calculateElo } = require("../utils/elo");
const { authMiddleware } = require("../middleware/auth");

const { redisClient, redisEnabled } = require("../config/redis");

const escapeRegex = (string) => {
    if (typeof string !== "string") return "";
    return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET: Leaderboard
router.get("/leaderboard", async (req, res, next) => {
    try {
        const type = req.query.type || 'singles';
        const { university, skillLevel, minMatches, search } = req.query;

        // Generate dynamic cache key based on all filters
        const cacheKey = `leaderboard:${type}:${university || 'any'}:${skillLevel || 'any'}:${minMatches || 0}:${typeof search === 'string' ? search.trim().slice(0, 100) : 'none'}`;

        if (redisEnabled) {
            const cachedLeaderboard = await redisClient.get(cacheKey);
            if (cachedLeaderboard) {
                return res.json(JSON.parse(cachedLeaderboard));
            }
        }

        const sortField = type === 'singles' ? 'singlesElo' : 'doublesElo';
        
        // Build the advanced aggregation pipeline
        const pipeline = [];

        // 1. $match stage: Multi-variable filtering
        const matchStage = {};
        
        if (university) matchStage.homeUniversity = university;
        if (skillLevel) matchStage.skillLevel = skillLevel;
        if (minMatches) matchStage['stats.totalMatches'] = { $gte: parseInt(minMatches, 10) };
        if (search) {
            const sanitizedSearch = escapeRegex(search);
            if (sanitizedSearch) {
                matchStage.name = { $regex: sanitizedSearch, $options: "i" };
            }
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // 2. $sort stage
        pipeline.push({ $sort: { [sortField]: -1, 'stats.totalMatches': -1 } });

        // 3. $limit stage
        pipeline.push({ $limit: 50 });

        // 4. $project stage to shape the response
        pipeline.push({
            $project: {
                name: 1,
                profilePic: 1,
                skillLevel: 1,
                homeUniversity: 1,
                [sortField]: 1,
                'stats.totalMatches': 1
            }
        });

        const users = await User.aggregate(pipeline);
            
        if (redisEnabled) {
            await redisClient.setex(cacheKey, 300, JSON.stringify(users));
        }

        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET: Pending matches for a user
router.get("/pending", authMiddleware, async (req, res, next) => {
    try {
        const matches = await Match.find({
            status: "pending",
            $or: [
                { team1: req.user.id },
                { team2: req.user.id }
            ],
            // We want to fetch matches the user has to confirm, so theoretically
            // submittedBy shouldn't be req.user.id, but let's return all pending for now
        })
        .sort({ date: -1 })
        .populate("team1", "name profilePic")
        .populate("team2", "name profilePic")
        .populate("submittedBy", "name profilePic");
        
        res.json(matches);
    } catch (error) {
        next(error);
    }
});

// GET: Match history for a user
router.get("/user/:userId", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user ID format." });
        }

        const matches = await Match.find({
            $or: [
                { team1: req.params.userId },
                { team2: req.params.userId }
            ]
        })
        .sort({ date: -1 })
        .populate("team1", "name profilePic")
        .populate("team2", "name profilePic")
        .limit(20);
        
        res.json(matches);
    } catch (error) {
        next(error);
    }
});

// POST: Submit a new match result
router.post("/", authMiddleware, async (req, res, next) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];

        if (redisEnabled && idempotencyKey) {
            const redisKey = `idempotency:match:${idempotencyKey}`;
            // Use SETNX to ensure atomic lock creation
            const isNew = await redisClient.setnx(redisKey, "1");
            if (!isNew) {
                return res.status(409).json({ message: "Duplicate match submission detected. Your score is already being processed." });
            }
            // Lock expires after 5 minutes
            await redisClient.expire(redisKey, 300);
        }

        const { type, team1, team2, team1Score, team2Score } = req.body;
        
        if (type !== "singles" && type !== "doubles") {
            return res.status(400).json({ message: "Match type must be either 'singles' or 'doubles'." });
        }

        const expectedTeamSize = type === "singles" ? 1 : 2;
        if (!Array.isArray(team1) || team1.length !== expectedTeamSize ||
            !Array.isArray(team2) || team2.length !== expectedTeamSize) {
            return res.status(400).json({ message: `Each team must have exactly ${expectedTeamSize} player(s) for ${type}.` });
        }

        const allPlayerIds = [...team1, ...team2].map(id => (id ? id.toString() : ""));
        const allValidIds = allPlayerIds.every(id => mongoose.isValidObjectId(id));
        if (!allValidIds) {
            return res.status(400).json({ message: "Invalid player ID format." });
        }

        if (new Set(allPlayerIds).size !== allPlayerIds.length) {
            return res.status(400).json({ message: "Duplicate player detected. A player cannot compete against themselves." });
        }

        const submittedBy = (req.user.id || req.user.userId).toString();
        const isAdmin = req.user.role === "admin";
        if (!isAdmin && !allPlayerIds.includes(submittedBy)) {
            return res.status(403).json({ message: "Unauthorized. You must be a player in the match to submit results." });
        }

        const s1 = parseInt(team1Score, 10);
        const s2 = parseInt(team2Score, 10);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) {
            return res.status(400).json({ message: "Scores must be distinct non-negative integers." });
        }

        const winner = s1 > s2 ? "team1" : "team2";
        
        const match = new Match({
            type,
            team1,
            team2,
            team1Score: s1,
            team2Score: s2,
            winner,
            submittedBy
        });
        
        await match.save();
        
        res.status(201).json(match);
    } catch (error) {
        // If it errors out, maybe remove the lock so they can retry?
        if (redisEnabled && req.headers['idempotency-key']) {
            await redisClient.del(`idempotency:match:${req.headers['idempotency-key']}`).catch(() => {});
        }
        next(error);
    }
});

// PUT: Confirm a match and calculate Elo
router.put("/:matchId/confirm", authMiddleware, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.matchId)) {
            return res.status(400).json({ message: "Invalid match ID format." });
        }

        const match = await Match.findById(req.params.matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "pending") return res.status(400).json({ message: "Match is already processed" });
        
        // Basic check: only a player from the opposing team of the submitter can confirm
        const submitterId = match.submittedBy.toString();
        const team1Ids = match.team1.map(id => id.toString());
        const team2Ids = match.team2.map(id => id.toString());
        
        const submitterInTeam1 = team1Ids.includes(submitterId);
        const opposingTeam = submitterInTeam1 ? team2Ids : team1Ids;
        
        const currentUserId = (req.user.id || req.user.userId).toString();
        const isAdmin = req.user.role === "admin";
        if (!isAdmin && !opposingTeam.includes(currentUserId)) {
            return res.status(403).json({ message: "Only an opposing team member can confirm this match." });
        }
        
        match.status = "confirmed";
        
        // Calculate Elo
        // For doubles, we average the team's Elo, calculate change, and apply to both
        const getTeamElo = async (teamIds, type) => {
            const users = await User.find({ _id: { $in: teamIds } });
            const eloField = type === "singles" ? "singlesElo" : "doublesElo";
            const avgElo = users.reduce((sum, u) => sum + u[eloField], 0) / users.length;
            return { avgElo, users, eloField };
        };
        
        const t1 = await getTeamElo(match.team1, match.type);
        const t2 = await getTeamElo(match.team2, match.type);
        
        const score1 = match.winner === "team1" ? 1 : 0;
        const score2 = match.winner === "team2" ? 1 : 0;
        
        const { change1, change2 } = calculateElo(t1.avgElo, t2.avgElo, score1, score2);
        
        match.eloChanges = [];
        
        // Apply changes
        for (const u of t1.users) {
            u[t1.eloField] += change1;
            // Removed await u.save() from here because processMatchResults will save the user
            match.eloChanges.push({ userId: u._id, change: change1 });
        }
        
        for (const u of t2.users) {
            u[t2.eloField] += change2;
            match.eloChanges.push({ userId: u._id, change: change2 });
        }
        
        await match.save();

        // Process gamification and stats
        const { processMatchResults } = require("../services/gamification");
        // t1 won if change1 > 0 (actually t1 won if s1 > s2)
        const t1Won = match.team1Score > match.team2Score;
        const t1Ids = t1.users.map(u => u._id);
        const t2Ids = t2.users.map(u => u._id);
        
        await processMatchResults(req.io, t1Ids, t1Won);
        await processMatchResults(req.io, t2Ids, !t1Won);

        // 3. Invalidate Leaderboard Cache
        if (redisEnabled) {
            try {
                const keys = await redisClient.keys("leaderboard:*");
                if (keys && keys.length > 0) {
                    await redisClient.del(...keys);
                }
            } catch (cacheErr) {
                console.error("Leaderboard cache invalidation error:", cacheErr);
            }
        }
        
        // 4. Add to ActivityFeed so it appears in the Community tab
        const ActivityFeed = require("../models/ActivityFeed");
        const submitter = await User.findById(match.submittedBy).select("name profilePic skillLevel").lean();
        await ActivityFeed.create({
            type: "match",
            referenceId: match._id,
            authorId: submitter?._id || match.submittedBy,
            authorName: submitter?.name || "Player",
            authorProfilePic: submitter?.profilePic,
            authorSkillLevel: submitter?.skillLevel,
            team1Score: match.team1Score,
            team2Score: match.team2Score,
            team1: t1.users.map(u => u.name),
            team2: t2.users.map(u => u.name),
            team1Avatars: t1.users.map(u => u.profilePic),
            team2Avatars: t2.users.map(u => u.profilePic),
            createdAt: match.date || new Date(),
            score: match.team1Score + match.team2Score
        }).catch(e => console.error("ActivityFeed create error:", e));

        if (req.io) {
            req.io.emit("matchConfirmed");
        }

        res.json(match);
    } catch (error) {
        next(error);
    }
});

// PUT: Dispute/Reject a match
router.put("/:matchId/dispute", authMiddleware, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.matchId)) {
            return res.status(400).json({ message: "Invalid match ID format." });
        }

        const match = await Match.findById(req.params.matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "pending") return res.status(400).json({ message: "Match is already processed" });
        
        // Basic check: only a player from the opposing team of the submitter can dispute
        const submitterId = match.submittedBy.toString();
        const team1Ids = match.team1.map(id => id.toString());
        const team2Ids = match.team2.map(id => id.toString());
        
        const submitterInTeam1 = team1Ids.includes(submitterId);
        const opposingTeam = submitterInTeam1 ? team2Ids : team1Ids;
        
        const currentUserId = (req.user.id || req.user.userId).toString();
        const isAdmin = req.user.role === "admin";
        if (!isAdmin && !opposingTeam.includes(currentUserId)) {
            return res.status(403).json({ message: "Only an opposing team member can dispute this match." });
        }
        
        match.status = "rejected";
        await match.save();
        
        // Optionally notify the submitter that their match was disputed via socket
        if (req.io) {
            req.io.to(submitterId).emit("matchDisputed", match);
        }

        res.json(match);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
