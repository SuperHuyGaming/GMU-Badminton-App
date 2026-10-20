const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Court = require('../models/Court');
const TournamentMatch = require('../models/TournamentMatch');
const bwfRules = require('../utils/bwfRules');

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
            walkoverTimer: court.walkoverTimer,
            estimatedDurationMinutes: court.estimatedDurationMinutes,
            estimatedEndTime: court.estimatedEndTime,
            pacingSecondsPerPoint: court.pacingSecondsPerPoint,
            isStalled: court.isStalled,
            stallReason: court.stallReason,
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
 * Computes live point pacing and dynamic remaining match duration
 */
function computeMatchPacingAndDuration(court, match) {
    if (!match || match.matchStatus === 'COMPLETED' || match.matchStatus === 'SCHEDULED') {
        return;
    }
    const startTime = match.startTime ? new Date(match.startTime).getTime() : (court.warmupStartTime ? new Date(court.warmupStartTime).getTime() : Date.now());
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));

    // Count total points played across all games so far
    let pointsPlayed = (match.team1Score || 0) + (match.team2Score || 0);
    if (match.games && match.games.length > 0) {
        for (const g of match.games) {
            if (g.isFinished) {
                pointsPlayed += (g.team1Score || 0) + (g.team2Score || 0);
            }
        }
    }

    let livePacing = 28;
    if (pointsPlayed >= 5) {
        livePacing = Math.min(55, Math.max(18, Math.round(elapsedSeconds / pointsPlayed)));
    }
    court.pacingSecondsPerPoint = livePacing;

    // Remaining points estimation
    const currentG = match.currentGame || 1;
    const currentMax = Math.max(match.team1Score || 0, match.team2Score || 0);
    const currGameRem = Math.max(0, 21 - currentMax);
    const needGame3 = (match.team1GamesWon === 1 && match.team2GamesWon === 1) || (currentG < 3 && match.team1GamesWon === 0 && match.team2GamesWon === 0);
    const estimatedRemPoints = currGameRem + (needGame3 && currentG < 3 ? 38 : 0);

    const remSeconds = estimatedRemPoints * livePacing + 60; // 60s buffer for intervals
    const remMinutes = Math.max(2, Math.ceil(remSeconds / 60));
    court.estimatedDurationMinutes = remMinutes;
    court.estimatedEndTime = new Date(Date.now() + remMinutes * 60 * 1000);
    court.lastActivityAt = new Date();
}

/**
 * Automatically advances the court queue when a match completes or walkover is declared.
 */
async function autoAdvanceCourt(court, req) {
    if (!court.queue || court.queue.length === 0) {
        court.status = 'AVAILABLE';
        court.currentMatch = null;
        court.warmupStartTime = null;
        court.estimatedDurationMinutes = 0;
        court.estimatedEndTime = null;
        court.isStalled = false;
        court.stallReason = null;
        court.updatedAt = new Date();
        await court.save();
        emitUpdates(req, court, null);
        return null;
    }

    const nextMatchId = court.queue.shift();
    const nextMatch = await TournamentMatch.findById(nextMatchId);
    if (!nextMatch) {
        court.status = 'AVAILABLE';
        court.currentMatch = null;
        court.warmupStartTime = null;
        court.updatedAt = new Date();
        await court.save();
        emitUpdates(req, court, null);
        return null;
    }

    nextMatch.courtNumber = court.courtNumber;
    nextMatch.matchStatus = 'WARMUP';
    nextMatch.startTime = new Date();
    await nextMatch.save();

    court.status = 'WARMUP';
    court.warmupStartTime = new Date();
    court.lastActivityAt = new Date();
    court.isStalled = false;
    court.stallReason = null;
    court.currentMatch = buildMatchSnapshot(nextMatch);
    court.updatedAt = new Date();
    await court.save();

    emitUpdates(req, court, nextMatch);
    const io = req.io || req.app?.get('io');
    if (io) {
        io.emit('matchCalled', { courtNumber: court.courtNumber, matchId: nextMatch._id, match: nextMatch });
    }
    return nextMatch;
}

/**
 * Delegates official BWF best-of-3 scoring algorithm to bwfRules engine
 */
function applyBWFPoint(match, scoringTeam) {
    return bwfRules.applyBWFPoint(match, scoringTeam);
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
 * GET /api/courts/deadlocks
 * Scans all RAC Courts 1-6 for stall conditions:
 * - Warmup stalls > 12 minutes
 * - Inactivity stalls > 30 minutes without points
 * - Overrun matches > 60 minutes with waiting queues while other courts sit idle
 */
router.get('/deadlocks', async (req, res) => {
    try {
        const courts = await Court.find({ courtNumber: { $gte: 1, $lte: 6 } }).populate('queue');
        const now = Date.now();
        const deadlocks = [];

        const hasAvailableCourt = courts.some(c => c.status === 'AVAILABLE' && (!c.queue || c.queue.length === 0));

        for (const court of courts) {
            let isStalled = false;
            let reason = null;

            if (court.status === 'WARMUP' && court.warmupStartTime) {
                const warmupMins = (now - new Date(court.warmupStartTime).getTime()) / (60 * 1000);
                if (warmupMins > 12) {
                    isStalled = true;
                    reason = `WARMUP_EXCEEDED_12M (${Math.round(warmupMins)}m in warmup)`;
                }
            } else if (court.status === 'MATCH_IN_PROGRESS') {
                const lastActivity = court.lastActivityAt ? new Date(court.lastActivityAt).getTime() : (court.warmupStartTime ? new Date(court.warmupStartTime).getTime() : now);
                const inactiveMins = (now - lastActivity) / (60 * 1000);
                if (inactiveMins > 30) {
                    isStalled = true;
                    reason = `INACTIVITY_EXCEEDED_30M (${Math.round(inactiveMins)}m since last score)`;
                } else if (hasAvailableCourt && court.queue && court.queue.length >= 2) {
                    const matchStart = court.warmupStartTime ? new Date(court.warmupStartTime).getTime() : now;
                    const elapsedMins = (now - matchStart) / (60 * 1000);
                    if (elapsedMins > 60) {
                        isStalled = true;
                        reason = `OVERRUN_QUEUE_STARVATION (${Math.round(elapsedMins)}m with ${court.queue.length} matches queued)`;
                    }
                }
            }

            court.isStalled = isStalled;
            court.stallReason = reason;
            await court.save();

            if (isStalled) {
                deadlocks.push({
                    courtNumber: court.courtNumber,
                    courtName: court.courtName,
                    status: court.status,
                    reason,
                    queueLength: court.queue ? court.queue.length : 0
                });
            }
        }

        return res.status(200).json({
            success: true,
            totalStalled: deadlocks.length,
            deadlocks
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/rebalance-queues
 * Shifts queued matches from congested or stalled courts to available RAC courts.
 */
router.post('/rebalance-queues', async (req, res) => {
    try {
        const courts = await Court.find({ courtNumber: { $gte: 1, $lte: 6 } }).sort({ courtNumber: 1 });
        const availableCourts = courts.filter(c => c.status === 'AVAILABLE' && (!c.queue || c.queue.length === 0));
        let rebalancedCount = 0;
        const rebalancedMatches = [];

        if (availableCourts.length > 0) {
            for (const congested of courts) {
                if (congested.queue && congested.queue.length >= 2) {
                    while (congested.queue.length > 1 && availableCourts.length > 0) {
                        const targetCourt = availableCourts.shift();
                        const shiftedMatchId = congested.queue.pop();

                        targetCourt.queue = [shiftedMatchId];
                        await targetCourt.save();
                        await congested.save();

                        // Advance the target court to WARMUP with the new match
                        await autoAdvanceCourt(targetCourt, req);

                        rebalancedCount++;
                        rebalancedMatches.push({
                            matchId: shiftedMatchId,
                            fromCourt: congested.courtNumber,
                            toCourt: targetCourt.courtNumber
                        });
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            rebalancedCount,
            rebalancedMatches
        });
    } catch (err) {
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

        const { scoringTeam, idempotencyKey } = req.body;
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

        // Problem 11: Idempotency check against pointHistory
        if (idempotencyKey && match.pointHistory && match.pointHistory.length > 0) {
            const existing = match.pointHistory.find(p => p.idempotencyKey === idempotencyKey);
            if (existing) {
                return res.status(200).json({
                    success: true,
                    idempotentReplay: true,
                    message: "Point already recorded (idempotent response)",
                    scorePayload: {
                        courtNumber,
                        matchId: match._id,
                        ...(existing.newState || {})
                    },
                    court,
                    match
                });
            }
        }

        if (match.matchStatus === 'COMPLETED') {
            return res.status(400).json({ success: false, error: "Match has already concluded" });
        }

        // Apply BWF scoring
        const bwfResult = applyBWFPoint(match, scoringTeam);
        if (idempotencyKey && match.pointHistory && match.pointHistory.length > 0) {
            match.pointHistory[match.pointHistory.length - 1].idempotencyKey = idempotencyKey;
        }

        // Transition court status if it was in WARMUP
        if (court.status === 'WARMUP') {
            court.status = 'MATCH_IN_PROGRESS';
            match.matchStatus = 'MATCH_IN_PROGRESS';
            if (!match.startTime) match.startTime = new Date();
        }

        // Update match duration estimation and pacing
        computeMatchPacingAndDuration(court, match);

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
            isGoldenPoint: match.isGoldenPoint,
            matchStatus: match.matchStatus,
            winner: match.winner
        };

        emitUpdates(req, court, match, scorePayload);

        const io = req.io || req.app?.get('io');
        if (io) {
            if (bwfResult.intervalStarted) {
                io.emit('intervalStarted', {
                    courtNumber,
                    matchId: match._id,
                    ...bwfResult.intervalStarted
                });
            }
            if (bwfResult.sideChangeRequired) {
                io.emit('sideChangeRequired', {
                    courtNumber,
                    matchId: match._id,
                    currentGame: match.currentGame,
                    team1CourtSide: match.team1CourtSide,
                    team2CourtSide: match.team2CourtSide
                });
            }
        }

        // If match concluded, auto-advance court to next match in queue if one is waiting
        if (match.matchStatus === 'COMPLETED' && court.queue && court.queue.length > 0) {
            await autoAdvanceCourt(court, req);
        }

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

/**
 * POST /api/courts/:courtNumber/walkover/start
 * Starts a 10-minute forfeit countdown timer for an un-reported team/player.
 */
router.post('/:courtNumber/walkover/start', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 6) {
            return res.status(400).json({ success: false, error: "Court number must be between 1 and 6" });
        }

        const court = await Court.findOne({ courtNumber });
        if (!court || !court.currentMatch) {
            return res.status(400).json({ success: false, error: "No active match on this court" });
        }

        const { targetTeam = 'team1', targetPlayerName = '', durationSeconds = 600 } = req.body;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

        court.walkoverTimer = {
            active: true,
            targetTeam,
            targetPlayerName,
            startedAt: now,
            expiresAt,
            durationSeconds
        };
        court.updatedAt = new Date();
        await court.save();

        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('walkoverTimerStarted', {
                courtNumber,
                matchId: court.currentMatch.matchId,
                walkoverTimer: court.walkoverTimer
            });
        }
        emitUpdates(req, court, null);

        return res.status(200).json({
            success: true,
            message: "Walkover countdown started",
            walkoverTimer: court.walkoverTimer
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/walkover/cancel
 * Cancels an active walkover forfeit timer.
 */
router.post('/:courtNumber/walkover/cancel', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        const court = await Court.findOne({ courtNumber });
        if (!court) {
            return res.status(404).json({ success: false, error: "Court not found" });
        }

        court.walkoverTimer = {
            active: false,
            targetTeam: null,
            targetPlayerName: '',
            startedAt: null,
            expiresAt: null,
            durationSeconds: 600
        };
        court.updatedAt = new Date();
        await court.save();

        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('walkoverTimerCancelled', { courtNumber });
        }
        emitUpdates(req, court, null);

        return res.status(200).json({
            success: true,
            message: "Walkover timer cancelled successfully"
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/courts/:courtNumber/walkover/forfeit
 * Finalizes walkover forfeiture: awards victory to opponent, closes match, and auto-advances the court.
 */
router.post('/:courtNumber/walkover/forfeit', async (req, res) => {
    try {
        const courtNumber = parseInt(req.params.courtNumber, 10);
        const court = await Court.findOne({ courtNumber });
        if (!court || !court.currentMatch || !court.currentMatch.matchId) {
            return res.status(400).json({ success: false, error: "No active match on this court" });
        }

        const match = await TournamentMatch.findById(court.currentMatch.matchId);
        if (!match) {
            return res.status(404).json({ success: false, error: "Match not found" });
        }

        const forfeitingTeam = court.walkoverTimer?.targetTeam || req.body.targetTeam || 'team1';
        const winningTeam = forfeitingTeam === 'team1' ? 'team2' : 'team1';

        match.matchStatus = 'WALKOVER';
        match.winner = winningTeam;
        match.walkoverForfeitTeam = forfeitingTeam;
        match.endTime = new Date();

        if (winningTeam === 'team1') {
            match.team1GamesWon = 2;
            match.team2GamesWon = 0;
            match.team1Score = 21;
            match.team2Score = 0;
        } else {
            match.team1GamesWon = 0;
            match.team2GamesWon = 2;
            match.team1Score = 0;
            match.team2Score = 21;
        }

        await match.save();

        court.walkoverTimer = {
            active: false,
            targetTeam: null,
            targetPlayerName: '',
            startedAt: null,
            expiresAt: null,
            durationSeconds: 600
        };

        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('walkoverDeclared', {
                courtNumber,
                matchId: match._id,
                forfeitingTeam,
                winningTeam
            });
        }

        // Auto advance queue
        await autoAdvanceCourt(court, req);

        return res.status(200).json({
            success: true,
            message: `Walkover declared. Victory awarded to ${winningTeam}`,
            winner: winningTeam,
            match
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;


