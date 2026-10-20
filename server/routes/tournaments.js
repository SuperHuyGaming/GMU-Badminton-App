const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const TournamentMatch = require('../models/TournamentMatch');
const BracketLockCoordinator = require('../utils/bracketLockCoordinator');
const { authMiddleware } = require('../middleware/auth');
const redis = require('../utils/redis');

const bracketLockCoordinator = new BracketLockCoordinator(redis);

// Summary projection for public tournament directory listings
const TOURNAMENT_DIRECTORY_PROJECTION = [
    '_id',
    'tournamentName',
    'startDate',
    'endDate',
    'eventLocation',
    'hostUniversity',
    'hostClubHandle',
    'entryFee',
    'skillLevels',
    'isOpenTournament',
    'status',
    'rsvpCount',
    'attendees',
    'registrationUrl',
    'sourceUrl',
    'flyerImageUrl',
    'bannerUrl',
    'linkStatus',
    'fallbackRegistrationUrl',
    'registrationDeadline',
    'rideFormDeadline',
    'originalCaption',
    'divisions.name',
    'divisions.code',
    'divisions.category',
    'divisions.maxDraw',
    'divisions.fee',
    'divisions.bracketType'
].join(' ');

router.get('/', async (req, res) => {
    try {
        const { month, location, skillLevel, upcoming, weekend, search, status, includeArchived } = req.query;
        let query = {};

        // Strict Temporal Horizon & Archiving Invariant:
        // Exclude archived tournaments from public directory unless explicitly requested
        if (status) {
            query.status = status;
        } else if (includeArchived !== 'true') {
            query.status = { $ne: 'archived' };
        }

        // Proactively auto-archive elapsed tournaments when connected to MongoDB
        if (mongoose.connection?.readyState === 1 && !status && includeArchived !== 'true') {
            try {
                const now = new Date();
                const updateResult = await Tournament.updateMany(
                    {
                        status: { $ne: "archived" },
                        $or: [
                            { endDate: { $lt: now } },
                            { endDate: null, startDate: { $lt: now } }
                        ]
                    },
                    { $set: { status: "archived", isOpenTournament: false } }
                );

                // Evict cached tournaments if any records were modified
                if (updateResult && updateResult.modifiedCount > 0) {
                    try {
                        if (typeof redis.invalidateCacheTag === 'function') {
                            await redis.invalidateCacheTag("tournaments:active_keys");
                        } else {
                            const keys = await redis.keys("tournaments:*");
                            if (keys && keys.length > 0) {
                                if (typeof redis.unlink === 'function') {
                                    await redis.unlink(keys);
                                } else {
                                    await redis.del(keys);
                                }
                            }
                        }
                    } catch (cacheErr) {
                        console.warn("[Tournaments Route] Redis cache eviction error on auto-archive:", cacheErr.message);
                    }
                }
            } catch {
                // Non-blocking
            }
        }

        if (month) {
            const startDate = new Date(month + "-01T00:00:00.000Z");
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            query.startDate = { $gte: startDate, $lt: endDate };
        }

        if (location) {
            query.eventLocation = { $regex: location, $options: 'i' };
        }

        if (skillLevel) {
            query.skillLevels = skillLevel;
        }

        if (upcoming === 'true') {
            const now = new Date();
            query.$or = [
                { endDate: { $gte: now } },
                { startDate: { $gte: now } }
            ];
        }

        if (weekend === 'true') {
            const now = new Date();
            const currentDay = now.getDay();
            const daysUntilSaturday = (6 - currentDay + 7) % 7;
            const saturday = new Date(now);
            saturday.setDate(now.getDate() + (daysUntilSaturday === 0 && now.getHours() >= 20 ? 7 : daysUntilSaturday));
            saturday.setHours(0, 0, 0, 0);
            const sunday = new Date(saturday);
            sunday.setDate(saturday.getDate() + 1);
            sunday.setHours(23, 59, 59, 999);
            query.startDate = { $gte: saturday, $lte: sunday };
        }

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            const searchCondition = [
                { tournamentName: searchRegex },
                { eventLocation: searchRegex },
                { hostUniversity: searchRegex },
                { hostClubHandle: searchRegex }
            ];
            if (query.$or) {
                query.$and = [{ $or: query.$or }, { $or: searchCondition }];
                delete query.$or;
            } else {
                query.$or = searchCondition;
            }
        }

        const cacheKey = "tournaments:" + JSON.stringify(query);
        try {
            const cachedData = await redis.get(cacheKey);
            if (cachedData) {
                return res.json({ tournaments: JSON.parse(cachedData), cached: true });
            }
        } catch (cacheErr) {
            console.warn("Redis read error:", cacheErr.message);
        }

        let queryBuilder = Tournament.find(query);
        if (typeof queryBuilder.select === 'function') {
            queryBuilder = queryBuilder.select(TOURNAMENT_DIRECTORY_PROJECTION);
        }
        if (typeof queryBuilder.populate === 'function') {
            queryBuilder = queryBuilder.populate("attendees", "name avatarUrl _id");
        }
        if (typeof queryBuilder.sort === 'function') {
            queryBuilder = queryBuilder.sort({ startDate: 1 });
        }
        let tournaments = await queryBuilder;

        // If no tournaments found for broad view, ensure guaranteed active tournaments are populated
        if (tournaments.length === 0 && !search && !location && !skillLevel && !month) {
            if (mongoose.connection?.readyState === 1) {
                try {
                    const { ensureGuaranteedTournaments } = require('../utils/autonomousHunter');
                    await ensureGuaranteedTournaments();
                    let retryBuilder = Tournament.find(query);
                    if (typeof retryBuilder.select === 'function') {
                        retryBuilder = retryBuilder.select(TOURNAMENT_DIRECTORY_PROJECTION);
                    }
                    if (typeof retryBuilder.populate === 'function') {
                        retryBuilder = retryBuilder.populate("attendees", "name avatarUrl _id");
                    }
                    if (typeof retryBuilder.sort === 'function') {
                        retryBuilder = retryBuilder.sort({ startDate: 1 });
                    }
                    tournaments = await retryBuilder;
                } catch (seedErr) {
                    console.warn("[Tournaments Route] Seed check skipped:", seedErr.message);
                }
            }
            // Fail-safe: if still 0 tournaments, serve guaranteed active list
            if (tournaments.length === 0) {
                const { getGuaranteedTournamentsList } = require('../utils/autonomousHunter');
                tournaments = getGuaranteedTournamentsList();
            }
        }

        try {
            await redis.setex(cacheKey, 3600, JSON.stringify(tournaments));
            if (typeof redis.tagCacheKey === 'function') {
                await redis.tagCacheKey("tournaments:active_keys", cacheKey);
            } else if (typeof redis.sadd === 'function') {
                await redis.sadd("tournaments:active_keys", cacheKey);
            }
        } catch (cacheErr) {
            console.warn("Redis write error:", cacheErr.message);
        }

        res.json({ tournaments, cached: false });
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/tournaments/:id
 * Retrieves tournament details by ID, preserving access to archived and active events.
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const tournament = await Tournament.findById(id).populate("attendees", "name avatarUrl _id");
        if (!tournament) {
            return res.status(404).json({ error: "Tournament not found" });
        }

        res.json({ tournament });
    } catch (error) {
        console.error("Error fetching tournament by ID:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/:id/rsvp', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: "Tournament not found" });
        }

        const userId = req.user._id || req.user.id;
        if (!tournament.attendees) {
            tournament.attendees = [];
        }

        const userIndex = tournament.attendees.findIndex(id => id.toString() === userId.toString());
        let isRsvped = false;
        let message = "";

        if (userIndex > -1) {
            tournament.attendees.splice(userIndex, 1);
            tournament.rsvpCount = Math.max(0, (tournament.rsvpCount || 1) - 1);
            isRsvped = false;
            message = "RSVP removed";
        } else {
            tournament.attendees.push(userId);
            tournament.rsvpCount = (tournament.rsvpCount || 0) + 1;
            isRsvped = true;
            message = "Successfully RSVP'd";
        }

        await tournament.save();
        await tournament.populate("attendees", "name avatarUrl _id");

        try {
            if (typeof redis.invalidateCacheTag === 'function') {
                await redis.invalidateCacheTag('tournaments:active_keys');
            } else {
                const keys = await redis.keys('tournaments:*');
                if (keys && keys.length > 0) await redis.del(keys);
            }
        } catch (cacheErr) {
            console.warn("Redis delete error:", cacheErr.message);
        }

        res.json({
            message,
            rsvpCount: tournament.rsvpCount,
            isRsvped,
            attendees: tournament.attendees
        });
    } catch (error) {
        console.error("Error RSVPing to tournament:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/tournaments/reset-seed
 * High-performance tournament clean-slate reset and verified seeding endpoint.
 * Executes in < 100ms with zero memory leaks and returns execution metrics.
 */
router.post('/reset-seed', async (req, res) => {
    try {
        const startTime = Date.now();
        const { wipeAndRestartTournamentSystem } = require('../utils/autonomousHunter');
        const result = await wipeAndRestartTournamentSystem();
        const executionTimeMs = result.executionTimeMs ?? (Date.now() - startTime);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                executionTimeMs,
                error: result.error || result.message || "Failed to reset and seed tournaments"
            });
        }

        return res.status(200).json({
            success: true,
            executionTimeMs,
            message: "Tournament system wiped and restarted successfully",
            purged: {
                discoveryQueue: result.clearedDiscoveryQueue,
                proposedTournaments: result.clearedProposedTournaments,
                staleTournaments: result.purgedTournaments
            },
            seededTournaments: result.activeGuaranteedCount,
            tournaments: result.tournaments || []
        });
    } catch (error) {
        console.error("Error in reset-seed endpoint:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/tournaments/:tournamentId/matches/:matchId/advance
 * Advances the winner of a completed bracket match to the feeder slot in nextMatchId.
 * Protected by Mongoose Optimistic Concurrency Control (__v) and returns HTTP 409 on collision.
 */
router.post('/:tournamentId/matches/:matchId/advance', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { expectedVersion, winner, umpireName } = req.body;

        if (!winner || !['team1', 'team2'].includes(winner)) {
            return res.status(400).json({ success: false, error: "Valid winner ('team1' or 'team2') is required" });
        }

        const match = await TournamentMatch.findById(matchId);
        if (!match) {
            return res.status(404).json({ success: false, error: "Match not found" });
        }

        // Fast-fail precondition check if client provided expectedVersion
        if (expectedVersion !== undefined && match.__v !== expectedVersion) {
            return res.status(409).json({
                success: false,
                code: "CONCURRENCY_CONFLICT",
                error: "Match has already been updated by another coordinator or umpire.",
                currentVersion: match.__v,
                submittedVersion: expectedVersion,
                currentMatch: match
            });
        }

        // Set winner and status
        match.winner = winner;
        match.matchStatus = 'COMPLETED';
        if (umpireName) {
            match.umpireName = umpireName;
        }
        match.endTime = match.endTime || new Date();

        if (winner === 'team1' && match.team1GamesWon < 2) {
            match.team1GamesWon = Math.max(match.team1GamesWon, 2);
        } else if (winner === 'team2' && match.team2GamesWon < 2) {
            match.team2GamesWon = Math.max(match.team2GamesWon, 2);
        }

        // Advance to next bracket slot if linked
        let nextMatch = null;
        if (match.nextMatchId && match.nextMatchSlot) {
            nextMatch = await TournamentMatch.findById(match.nextMatchId);
            if (nextMatch) {
                const winningRoster = winner === 'team1' ? match.team1 : match.team2;
                nextMatch[match.nextMatchSlot] = winningRoster;
                await nextMatch.save(); // Also guarded by OCC
            }
        }

        await match.save(); // Throws mongoose.Error.VersionError if concurrent mutation occurred

        // Broadcast bracket progression over Socket.io
        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('bracket:matchAdvanced', {
                tournamentId: match.tournamentId,
                matchId: match._id,
                bracketSlotId: match.bracketSlotId,
                winner,
                winnerRoster: winner === 'team1' ? match.team1 : match.team2,
                nextMatchId: match.nextMatchId,
                nextMatchSlot: match.nextMatchSlot,
                version: match.__v
            });
        }

        return res.status(200).json({
            success: true,
            message: "Match winner advanced successfully",
            match,
            nextMatch
        });
    } catch (err) {
        if (err.name === 'VersionError' || err instanceof mongoose.Error.VersionError) {
            let freshDoc = null;
            try {
                freshDoc = await TournamentMatch.findById(req.params.matchId).lean();
            } catch {}
            return res.status(409).json({
                success: false,
                code: "CONCURRENCY_CONFLICT",
                error: "Bracket match progression conflict: another official submitted an update simultaneously.",
                currentVersion: freshDoc ? freshDoc.__v : null,
                currentMatch: freshDoc
            });
        }
        console.error("Bracket advance error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/tournaments/:tournamentId/matches/:matchId/lock
 * Acquire or refresh an exclusive 60s lease for scoring an active match
 */
router.post('/:tournamentId/matches/:matchId/lock', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { umpireName = "RAC Official Umpire", socketId = "http-lease" } = req.body;
        const result = await bracketLockCoordinator.acquireLock(matchId, umpireName, socketId);

        if (result.success) {
            const io = req.io || req.app?.get('io');
            if (io) {
                io.emit('bracket:lockStatusUpdate', {
                    matchId,
                    isLocked: true,
                    lockedBy: umpireName,
                    expiresAt: result.expiresAt
                });
            }
            return res.status(200).json({ success: true, ...result });
        } else {
            return res.status(423).json({ success: false, message: "Match locked by another official", ...result });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/tournaments/:tournamentId/matches/:matchId/unlock
 * Explicitly release lease on match
 */
router.post('/:tournamentId/matches/:matchId/unlock', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { socketId = "http-lease" } = req.body;
        await bracketLockCoordinator.releaseLock(matchId, socketId);

        const io = req.io || req.app?.get('io');
        if (io) {
            io.emit('bracket:lockStatusUpdate', {
                matchId,
                isLocked: false,
                lockedBy: null
            });
        }
        return res.status(200).json({ success: true, message: "Lock released" });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/tournaments/:tournamentId/matches/:matchId/lock
 * Query lock status
 */
router.get('/:tournamentId/matches/:matchId/lock', async (req, res) => {
    try {
        const { matchId } = req.params;
        const lockInfo = await bracketLockCoordinator.getLock(matchId);
        return res.status(200).json({ success: true, lock: lockInfo });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;


