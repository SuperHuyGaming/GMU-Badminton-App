const express = require("express");
const router = express.Router();
const Match = require("../models/Match");
const User = require("../models/User");
const { calculateElo } = require("../utils/elo");
const { authMiddleware } = require("../middleware/auth");

// GET: Leaderboard
router.get("/leaderboard", async (req, res, next) => {
    try {
        const type = req.query.type || 'singles'; // 'singles' or 'doubles'
        const sortField = type === 'singles' ? 'singlesElo' : 'doublesElo';
        
        const users = await User.find({})
            .sort({ [sortField]: -1 })
            .limit(50)
            .select(`name profilePic skillLevel ${sortField}`);
            
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET: Match history for a user
router.get("/user/:userId", async (req, res, next) => {
    try {
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
        const { type, team1, team2, team1Score, team2Score } = req.body;
        const submittedBy = req.user.id; // from authMiddleware
        
        const winner = team1Score > team2Score ? "team1" : "team2";
        
        const match = new Match({
            type,
            team1,
            team2,
            team1Score,
            team2Score,
            winner,
            submittedBy
        });
        
        await match.save();
        
        // Notify the other team they need to confirm (Could add Socket.io emit here)
        // ...
        
        res.status(201).json(match);
    } catch (error) {
        next(error);
    }
});

// PUT: Confirm a match and calculate Elo
router.put("/:matchId/confirm", authMiddleware, async (req, res, next) => {
    try {
        const match = await Match.findById(req.params.matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });
        if (match.status !== "pending") return res.status(400).json({ message: "Match is already processed" });
        
        // Basic check: only a player from the opposing team of the submitter can confirm
        const submitterId = match.submittedBy.toString();
        const team1Ids = match.team1.map(id => id.toString());
        const team2Ids = match.team2.map(id => id.toString());
        
        const submitterInTeam1 = team1Ids.includes(submitterId);
        const opposingTeam = submitterInTeam1 ? team2Ids : team1Ids;
        
        if (!opposingTeam.includes(req.user.id)) {
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
        
        res.json(match);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
