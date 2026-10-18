const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Court = require('../models/Court');
const TournamentMatch = require('../models/TournamentMatch');

/**
 * Safely emit updates over Socket.io
 */
function emitUpdates(req, court, match, scorePayload = null) {
    const io = req.io || req.app?.get('io');
    if (!io) return;

    if (court) {
        io.emit('courtStatusUpdate', {
            courtNumber: court.courtNumber,
            courtName: court.courtName,
            status: court.status,
            venue: court.venue,
            currentMatch: court.currentMatch,
            queue: court.queue,
            warmupStartTime: court.warmupStartTime,
            updatedAt: court.updatedAt
        });
    }

    if (scorePayload) {
        io.emit('liveScoreUpdate', scorePayload);
    }
}

/**
 * Ensures RAC Courts 1 through 6 exist in database.
 */
async function ensureRACCourtsInitialized() {
    const courts = [];
    for (let i = 1; i <= 6; i++) {
        let court = await Court.findOne({ courtNumber: i });
        if (!court) {
            court = await Court.create({
                courtNumber: i,
                courtName: `RAC Court ${i}`,
                venue: "Recreation Athletic Complex (RAC)",
                status: "AVAILABLE",
                currentMatch: null,
                queue: []
            });
        }
        courts.push(court);
    }
    return courts;
}

/**
 * Helper to build a clean snapshot of match state for Court.currentMatch
 */
function buildMatchSnapshot(match) {
    if (!match) return null;
    return {
        matchId: match._id,
        tournamentId: match.tournamentId,
        tournamentName: match.tournamentName,
        division: match.division,
        round: match.round,
        team1: match.team1,
        team2: match.team2,
        currentGame: match.currentGame,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1GamesWon: match.team1GamesWon,
        team2GamesWon: match.team2GamesWon,
        currentServer: match.currentServer,
        servingCourt: match.servingCourt,
        shuttlePossession: match.shuttlePossession,
        games: match.games,
        matchStatus: match.matchStatus,
        winner: match.winner,
        isGamePoint: match.isGamePoint,
        isMatchPoint: match.isMatchPoint,
        isDeuce: match.isDeuce
    };
}

/**
 * Applies official BWF best-of-3 scoring algorithm
 */
function applyBWFPoint(match, scoringTeam) {
    const prev = {
        currentGame: match.currentGame,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1GamesWon: match.team1GamesWon,
        team2GamesWon: match.team2GamesWon,
        servingCourt: match.servingCourt,
        currentServer: match.currentServer,
        shuttlePossession: match.shuttlePossession,
        matchStatus: match.matchStatus,
        winner: match.winner,
        isGamePoint: match.isGamePoint,
        isMatchPoint: match.isMatchPoint,
        isDeuce: match.isDeuce,
        games: JSON.parse(JSON.stringify(match.games || []))
    };

    let t1 = match.team1Score;
    let t2 = match.team2Score;
    const cg = match.currentGame;

    if (scoringTeam === 'team1') {
        t1 += 1;
        match.shuttlePossession = 'team1';
        match.currentServer = match.team1?.[0]?.name || 'Team 1';
        // BWF Service Court Rule: Even score = Right court, Odd score = Left court
        match.servingCourt = (t1 % 2 === 0) ? 'RIGHT' : 'LEFT';
    } else {
        t2 += 1;
        match.shuttlePossession = 'team2';
        match.currentServer = match.team2?.[0]?.name || 'Team 2';
        match.servingCourt = (t2 % 2 === 0) ? 'RIGHT' : 'LEFT';
    }

    match.team1Score = t1;
    match.team2Score = t2;

    // Check if the game is won
    // BWF Rule: First to 21 with lead of 2, deuce from 20-20 up to 29-29, 30th point wins directly
    let isGameWon = false;
    let gameWinner = null;

    if (t1 >= 21 && (t1 - t2 >= 2)) {
        isGameWon = true;
        gameWinner = 'team1';
    } else if (t2 >= 21 && (t2 - t1 >= 2)) {
        isGameWon = true;
        gameWinner = 'team2';
    } else if (t1 === 30) {
        isGameWon = true;
        gameWinner = 'team1';
    } else if (t2 === 30) {
        isGameWon = true;
        gameWinner = 'team2';
    }

    // Ensure games array has entry for current game
    if (!match.games) match.games = [];
    while (match.games.length < cg) {
        match.games.push({
            gameNumber: match.games.length + 1,
            team1Score: 0,
            team2Score: 0,
            winner: null,
            isFinished: false
        });
    }

    if (isGameWon) {
        match.games[cg - 1] = {
            gameNumber: cg,
            team1Score: t1,
            team2Score: t2,
            winner: gameWinner,
            isFinished: true
        };

        if (gameWinner === 'team1') {
            match.team1GamesWon += 1;
        } else {
            match.team2GamesWon += 1;
        }

        // Check if match is won (best 2 of 3)
        if (match.team1GamesWon === 2 || match.team2GamesWon === 2) {
            match.matchStatus = 'COMPLETED';
            match.winner = gameWinner;
            match.endTime = new Date();
            match.isGamePoint = false;
            match.isMatchPoint = false;
            match.isDeuce = false;
        } else {
            // Next game setup
            match.currentGame = cg + 1;
            match.team1Score = 0;
            match.team2Score = 0;
            match.shuttlePossession = gameWinner;
            match.currentServer = (gameWinner === 'team1') ? (match.team1?.[0]?.name || 'Team 1') : (match.team2?.[0]?.name || 'Team 2');
            match.servingCourt = 'RIGHT'; // 0 is even -> Right court
            match.isDeuce = false;
            match.isGamePoint = false;
            match.isMatchPoint = false;

            match.games.push({
                gameNumber: match.currentGame,
                team1Score: 0,
                team2Score: 0,
                winner: null,
                isFinished: false
            });
        }
    } else {
        match.games[cg - 1] = {
            gameNumber: cg,
            team1Score: t1,
            team2Score: t2,
            winner: null,
            isFinished: false
        };

        // Deuce detection
        match.isDeuce = (t1 >= 20 && t2 >= 20 && t1 === t2 && t1 < 29);

        // Game point detection
        const t1GP = (t1 >= 20 && t1 - t2 >= 1) || (t1 === 29 && t2 === 29);
        const t2GP = (t2 >= 20 && t2 - t1 >= 1) || (t1 === 29 && t2 === 29);
        match.isGamePoint = t1GP || t2GP;

        // Match point detection (at game point and already won 1 game, or in game 3)
        const t1MP = t1GP && (match.team1GamesWon === 1 || cg === 3);
        const t2MP = t2GP && (match.team2GamesWon === 1 || cg === 3);
        match.isMatchPoint = t1MP || t2MP;
    }

    const nextState = {
        currentGame: match.currentGame,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1GamesWon: match.team1GamesWon,
        team2GamesWon: match.team2GamesWon,
        servingCourt: match.servingCourt,
        currentServer: match.currentServer,
        shuttlePossession: match.shuttlePossession,
        matchStatus: match.matchStatus,
        winner: match.winner,
        isGamePoint: match.isGamePoint,
        isMatchPoint: match.isMatchPoint,
        isDeuce: match.isDeuce,
        games: JSON.parse(JSON.stringify(match.games || []))
    };

    if (!match.pointHistory) match.pointHistory = [];
    match.pointHistory.push({
        pointIndex: match.pointHistory.length + 1,
        scoringTeam,
        previousState: prev,
        newState: nextState,
        timestamp: new Date()
    });
}

/**
 * GET /api/courts
 * Returns status, active match, and queue for RAC Courts 1 to 6.
 */
router.get('/', async (req, res) => {
    try {
        let courts = await Court.find({ courtNumber: { $gte: 1, $lte: 6 } })
            .populate('queue')
            .sort({ courtNumber: 1 });

        if (courts.length < 6) {
            courts = await ensureRACCourtsInitialized();
        }

        return res.status(200).json({
            success: true,
            count: courts.length,
            courts
        });
    } catch (err) {
        console.error("Error fetching courts:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/initialize
 * Ensures all RAC Courts 1 to 6 exist in database.
 */
router.post('/initialize', async (req, res) => {
    try {
        const courts = await ensureRACCourtsInitialized();
        return res.status(200).json({
            success: true,
            message: "RAC Courts 1-6 initialized successfully",
            courts
        });
    } catch (err) {
        console.error("Error initializing courts:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/courts/:courtNumber
 * Returns status and active match for a specific RAC court.
 */
router.get('/:courtNumber', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        let court = await Court.findOne({ courtNumber }).populate('queue');
        if (!court) {
            court = await Court.create({
                courtNumber,
                courtName: `RAC Court ${courtNumber}`,
                venue: "Recreation Athletic Complex (RAC)",
                status: "AVAILABLE",
                currentMatch: null,
                queue: []
            });
        }

        return res.status(200).json({ success: true, court });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/assign
 * Assigns a match to a court, switches court status to WARMUP, and emits courtStatusUpdate.
 */
router.post('/:courtNumber/assign', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        let court = await Court.findOne({ courtNumber });
        if (!court) {
            court = await Court.create({
                courtNumber,
                courtName: `RAC Court ${courtNumber}`,
                venue: "Recreation Athletic Complex (RAC)",
                status: "AVAILABLE",
                currentMatch: null,
                queue: []
            });
        }

        const { matchId, tournamentId, tournamentName, division, round, team1, team2 } = req.body;
        let match;

        if (matchId && mongoose.Types.ObjectId.isValid(matchId)) {
            match = await TournamentMatch.findById(matchId);
            if (!match) {
                return res.status(404).json({ success: false, error: "Match not found" });
            }
        } else {
            // Create a new match document if assigning directly
            match = new TournamentMatch({
                tournamentId: tournamentId || null,
                tournamentName: tournamentName || "2026 GMU Badminton Open",
                division: division || "Men's Singles Open",
                round: round || "R32",
                courtNumber,
                team1: team1 || [{ name: "Player 1" }],
                team2: team2 || [{ name: "Player 2" }],
                games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winner: null, isFinished: false }],
                currentGame: 1,
                team1Score: 0,
                team2Score: 0,
                currentServer: (team1 && team1[0]?.name) || "Player 1",
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                matchStatus: "WARMUP",
                startTime: new Date()
            });
        }

        match.courtNumber = courtNumber;
        match.matchStatus = "WARMUP";
        if (!match.startTime) match.startTime = new Date();
        await match.save();

        court.status = "WARMUP";
        court.warmupStartTime = new Date();
        court.currentMatch = buildMatchSnapshot(match);
        court.updatedAt = new Date();
        await court.save();

        emitUpdates(req, court, match);

        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('matchCalled', { courtNumber, matchId: match._id, match });
        }

        return res.status(200).json({
            success: true,
            message: `Match assigned to RAC Court ${courtNumber}`,
            court,
            match
        });
    } catch (err) {
        console.error("Error assigning match to court:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/score/point
 * Awards point to team1 or team2, calculates BWF score and serving court,
 * updates pointHistory, and emits liveScoreUpdate and courtStatusUpdate.
 */
router.post('/:courtNumber/score/point', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        const { scoringTeam } = req.body;
        if (scoringTeam !== 'team1' && scoringTeam !== 'team2') {
            return res.status(400).json({ success: false, error: "scoringTeam must be 'team1' or 'team2'" });
        }

        const court = await Court.findOne({ courtNumber });
        if (!court || !court.currentMatch || !court.currentMatch.matchId) {
            return res.status(400).json({ success: false, error: "No active match assigned to this court" });
        }

        const match = await TournamentMatch.findById(court.currentMatch.matchId);
        if (!match) {
            return res.status(404).json({ success: false, error: "Tournament match not found" });
        }

        if (match.matchStatus === 'COMPLETED') {
            return res.status(400).json({ success: false, error: "Match has already concluded" });
        }

        // Apply BWF scoring
        applyBWFPoint(match, scoringTeam);

        // Transition court status if it was in WARMUP
        if (court.status === 'WARMUP') {
            court.status = 'MATCH_IN_PROGRESS';
            match.matchStatus = 'MATCH_IN_PROGRESS';
        }

        await match.save();

        court.currentMatch = buildMatchSnapshot(match);
        court.updatedAt = new Date();
        await court.save();

        const scorePayload = {
            courtNumber,
            matchId: match._id,
            currentGame: match.currentGame,
            team1Score: match.team1Score,
            team2Score: match.team2Score,
            team1GamesWon: match.team1GamesWon,
            team2GamesWon: match.team2GamesWon,
            scoringTeam,
            currentServer: match.currentServer,
            servingCourt: match.servingCourt,
            shuttlePossession: match.shuttlePossession,
            games: match.games,
            isDeuce: match.isDeuce,
            isGamePoint: match.isGamePoint,
            isMatchPoint: match.isMatchPoint,
            matchStatus: match.matchStatus,
            winner: match.winner
        };

        emitUpdates(req, court, match, scorePayload);

        return res.status(200).json({
            success: true,
            scorePayload,
            court,
            match
        });
    } catch (err) {
        console.error("Error scoring point:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/score/undo
 * Reverts the last scored point from history and emits real-time updates.
 */
router.post('/:courtNumber/score/undo', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        const court = await Court.findOne({ courtNumber });
        if (!court || !court.currentMatch || !court.currentMatch.matchId) {
            return res.status(400).json({ success: false, error: "No active match on this court" });
        }

        const match = await TournamentMatch.findById(court.currentMatch.matchId);
        if (!match) {
            return res.status(404).json({ success: false, error: "Match not found" });
        }

        if (!match.pointHistory || match.pointHistory.length === 0) {
            return res.status(400).json({ success: false, error: "No points to undo" });
        }

        const lastPoint = match.pointHistory.pop();
        const prev = lastPoint.previousState;

        match.currentGame = prev.currentGame;
        match.team1Score = prev.team1Score;
        match.team2Score = prev.team2Score;
        match.team1GamesWon = prev.team1GamesWon;
        match.team2GamesWon = prev.team2GamesWon;
        match.servingCourt = prev.servingCourt;
        match.currentServer = prev.currentServer;
        match.shuttlePossession = prev.shuttlePossession;
        match.matchStatus = prev.matchStatus;
        match.winner = prev.winner;
        match.isGamePoint = prev.isGamePoint;
        match.isMatchPoint = prev.isMatchPoint;
        match.isDeuce = prev.isDeuce;
        match.games = prev.games;

        if (match.matchStatus !== 'COMPLETED') {
            court.status = 'MATCH_IN_PROGRESS';
        }

        await match.save();

        court.currentMatch = buildMatchSnapshot(match);
        court.updatedAt = new Date();
        await court.save();

        const scorePayload = {
            courtNumber,
            matchId: match._id,
            currentGame: match.currentGame,
            team1Score: match.team1Score,
            team2Score: match.team2Score,
            team1GamesWon: match.team1GamesWon,
            team2GamesWon: match.team2GamesWon,
            scoringTeam: null,
            currentServer: match.currentServer,
            servingCourt: match.servingCourt,
            shuttlePossession: match.shuttlePossession,
            games: match.games,
            isDeuce: match.isDeuce,
            isGamePoint: match.isGamePoint,
            isMatchPoint: match.isMatchPoint,
            matchStatus: match.matchStatus,
            winner: match.winner,
            isUndo: true
        };

        emitUpdates(req, court, match, scorePayload);

        return res.status(200).json({
            success: true,
            message: "Point undone successfully",
            scorePayload,
            court,
            match
        });
    } catch (err) {
        console.error("Error undoing point:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/status
 * Updates court status (AVAILABLE, WARMUP, MATCH_IN_PROGRESS, MAINTENANCE) and emits courtStatusUpdate.
 */
router.post('/:courtNumber/status', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        const { status } = req.body;
        const validStatuses = ["AVAILABLE", "WARMUP", "MATCH_IN_PROGRESS", "MAINTENANCE"];
        const normalizedStatus = (status || "").toUpperCase();

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            });
        }

        let court = await Court.findOne({ courtNumber });
        if (!court) {
            court = await Court.create({
                courtNumber,
                courtName: `RAC Court ${courtNumber}`,
                venue: "Recreation Athletic Complex (RAC)",
                status: normalizedStatus,
                currentMatch: null,
                queue: []
            });
        } else {
            court.status = normalizedStatus;
            if (normalizedStatus === 'WARMUP') {
                court.warmupStartTime = new Date();
            } else if (normalizedStatus === 'AVAILABLE') {
                court.currentMatch = null;
                court.warmupStartTime = null;
            }
            court.updatedAt = new Date();
            await court.save();
        }

        emitUpdates(req, court, null);

        return res.status(200).json({
            success: true,
            message: `RAC Court ${courtNumber} status updated to ${normalizedStatus}`,
            court
        });
    } catch (err) {
        console.error("Error updating court status:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/queue
 * Adds a match to the court waiting queue.
 */
router.post('/:courtNumber/queue', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        const { matchId } = req.body;

        if (!matchId || !mongoose.Types.ObjectId.isValid(matchId)) {
            return res.status(400).json({ success: false, error: "Valid matchId required" });
        }

        const court = await Court.findOne({ courtNumber });
        if (!court) {
            return res.status(404).json({ success: false, error: "Court not found" });
        }

        if (!court.queue) court.queue = [];
        court.queue.push(matchId);
        court.updatedAt = new Date();
        await court.save();

        emitUpdates(req, court, null);

        return res.status(200).json({
            success: true,
            message: "Match added to court queue",
            queue: court.queue
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
