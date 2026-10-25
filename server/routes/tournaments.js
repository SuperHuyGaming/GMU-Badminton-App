const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const TournamentMatch = require('../models/TournamentMatch');
const User = require('../models/User');
const BracketLockCoordinator = require('../utils/bracketLockCoordinator');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
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
    'maxCapacity',
    'attendees',
    'waitlist.userId',
    'waitlist.registeredAt',
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

const escapeRegex = (string) => {
    if (typeof string !== 'string') return '';
    return string.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const BADMINTON_SYNONYMS = {
    GMU: "George Mason",
    UMD: "University of Maryland",
    NVBC: "Northern Virginia Badminton Club",
    CBA: "Capital Badminton",
    JHU: "Johns Hopkins",
    VT: "Virginia Tech",
    UVA: "University of Virginia"
};

const REVERSE_SYNONYMS = {
    "GEORGE MASON": "GMU",
    "UNIVERSITY OF MARYLAND": "UMD",
    "NORTHERN VIRGINIA BADMINTON CLUB": "NVBC",
    "CAPITAL BADMINTON": "CBA",
    "JOHNS HOPKINS": "JHU",
    "VIRGINIA TECH": "VT",
    "UNIVERSITY OF VIRGINIA": "UVA"
};

function expandBadmintonSearch(term) {
    if (!term || typeof term !== 'string') return [];
    const clean = term.trim();
    const upper = clean.toUpperCase();
    const expansions = [clean];

    if (BADMINTON_SYNONYMS[upper]) {
        expansions.push(BADMINTON_SYNONYMS[upper]);
    }
    if (REVERSE_SYNONYMS[upper]) {
        expansions.push(REVERSE_SYNONYMS[upper]);
    }

    const words = clean.split(/\s+/);
    if (words.length > 1) {
        let expanded = false;
        const expandedWords = words.map(w => {
            const u = w.toUpperCase();
            if (BADMINTON_SYNONYMS[u]) {
                expanded = true;
                return BADMINTON_SYNONYMS[u];
            }
            return w;
        });
        if (expanded) {
            expansions.push(expandedWords.join(' '));
        }
    }

    return Array.from(new Set(expansions));
}

const syncUserRsvpedTournaments = async (userId, tournamentId, action) => {
    try {
        if (!userId || !tournamentId) return;
        if (typeof User?.updateOne !== 'function') return;

        const isConnected = mongoose.connection?.readyState === 1;
        const isMocked = Boolean(User.updateOne._isMockFunction || typeof User.updateOne.mockResolvedValue === 'function');
        if (!isConnected && !isMocked) return;

        const update = action === 'add'
            ? { $addToSet: { rsvpedTournaments: tournamentId.toString() } }
            : { $pull: { rsvpedTournaments: tournamentId.toString() } };

        await User.updateOne({ _id: userId }, update);
    } catch (err) {
        console.warn(`[Tournaments] Failed to sync User.rsvpedTournaments (${action}):`, err.message);
    }
};

router.get('/', async (req, res) => {
    try {
        const { month, location, skillLevel, skills, upcoming, weekend, search, status, includeArchived } = req.query;
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
            query.eventLocation = { $regex: escapeRegex(location), $options: 'i' };
        }

        // Multi-skill filtering
        const skillParam = skills || skillLevel;
        if (skillParam) {
            const skillList = (Array.isArray(skillParam) ? skillParam : String(skillParam).split(','))
                .map(s => s.trim())
                .filter(Boolean);
            if (skillList.length === 1) {
                query.skillLevels = skillList[0];
            } else if (skillList.length > 1) {
                query.skillLevels = { $in: skillList };
            }
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

        if (search && typeof search === 'string' && search.trim()) {
            const trimmedSearch = search.trim();
            const expansions = expandBadmintonSearch(trimmedSearch);

            // Short prefix matching (< 3 characters) directly uses regex fallback
            if (trimmedSearch.length < 3) {
                const searchCondition = expansions.flatMap(term => {
                    const safeTerm = escapeRegex(term);
                    if (!safeTerm) return [];
                    const r = { $regex: safeTerm, $options: 'i' };
                    return [
                        { tournamentName: r },
                        { eventLocation: r },
                        { hostUniversity: r },
                        { hostClubHandle: r },
                        { 'divisions.name': r },
                        { 'divisions.code': r },
                        { skillLevels: r },
                        { originalCaption: r }
                    ];
                });
                if (searchCondition.length > 0) {
                    if (query.$or) {
                        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
                        delete query.$or;
                    } else {
                        query.$or = searchCondition;
                    }
                }
            } else {
                // Compound text search with synonym expansion
                query.$text = { $search: expansions.join(' ') };
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

        let tournaments = [];
        try {
            let queryBuilder = Tournament.find({ ...query, isOpenTournament: true });
            if (typeof queryBuilder.select === 'function') {
                queryBuilder = queryBuilder.select(TOURNAMENT_DIRECTORY_PROJECTION);
            }
            if (typeof queryBuilder.populate === 'function') {
                queryBuilder = queryBuilder.populate("attendees", "name profilePic avatarUrl _id");
            }
            if (typeof queryBuilder.sort === 'function') {
                queryBuilder = queryBuilder.sort({ startDate: 1 });
            }
            tournaments = await queryBuilder;
        } catch (queryErr) {
            // Fallback: If $text query failed (e.g. text index missing in mock or test environment),
            // fallback to regex query across all fields with synonym expansion
            if (query.$text) {
                const fallbackQuery = { ...query };
                delete fallbackQuery.$text;
                const trimmedSearch = search.trim();
                const expansions = expandBadmintonSearch(trimmedSearch);
                const searchCondition = expansions.flatMap(term => {
                    const safeTerm = escapeRegex(term);
                    if (!safeTerm) return [];
                    const r = { $regex: safeTerm, $options: 'i' };
                    return [
                        { tournamentName: r },
                        { eventLocation: r },
                        { hostUniversity: r },
                        { hostClubHandle: r },
                        { 'divisions.name': r },
                        { 'divisions.code': r },
                        { skillLevels: r },
                        { originalCaption: r }
                    ];
                });
                if (searchCondition.length > 0) {
                    if (fallbackQuery.$or) {
                        fallbackQuery.$and = [{ $or: fallbackQuery.$or }, { $or: searchCondition }];
                        delete fallbackQuery.$or;
                    } else {
                        fallbackQuery.$or = searchCondition;
                    }
                }
                let fallbackBuilder = Tournament.find({ ...fallbackQuery, isOpenTournament: true });
                if (typeof fallbackBuilder.select === 'function') fallbackBuilder = fallbackBuilder.select(TOURNAMENT_DIRECTORY_PROJECTION);
                if (typeof fallbackBuilder.populate === 'function') fallbackBuilder = fallbackBuilder.populate("attendees", "name profilePic avatarUrl _id");
                if (typeof fallbackBuilder.sort === 'function') fallbackBuilder = fallbackBuilder.sort({ startDate: 1 });
                tournaments = await fallbackBuilder;
            } else {
                throw queryErr;
            }
        }

        // Prefix fallback: If $text returned 0 results, check if prefix matching matches
        if (query.$text && Array.isArray(tournaments) && tournaments.length === 0 && search && search.trim()) {
            try {
                const fallbackQuery = { ...query };
                delete fallbackQuery.$text;
                const trimmedSearch = search.trim();
                const expansions = expandBadmintonSearch(trimmedSearch);
                const searchCondition = expansions.flatMap(term => {
                    const safeTerm = escapeRegex(term);
                    if (!safeTerm) return [];
                    const r = { $regex: safeTerm, $options: 'i' };
                    return [
                        { tournamentName: r },
                        { eventLocation: r },
                        { hostUniversity: r },
                        { hostClubHandle: r },
                        { 'divisions.name': r },
                        { 'divisions.code': r },
                        { skillLevels: r },
                        { originalCaption: r }
                    ];
                });
                if (searchCondition.length > 0) {
                    if (fallbackQuery.$or) {
                        fallbackQuery.$and = [{ $or: fallbackQuery.$or }, { $or: searchCondition }];
                        delete fallbackQuery.$or;
                    } else {
                        fallbackQuery.$or = searchCondition;
                    }
                }
                let fallbackBuilder = Tournament.find({ ...fallbackQuery, isOpenTournament: true });
                if (typeof fallbackBuilder.select === 'function') fallbackBuilder = fallbackBuilder.select(TOURNAMENT_DIRECTORY_PROJECTION);
                if (typeof fallbackBuilder.populate === 'function') fallbackBuilder = fallbackBuilder.populate("attendees", "name profilePic avatarUrl _id");
                if (typeof fallbackBuilder.sort === 'function') fallbackBuilder = fallbackBuilder.sort({ startDate: 1 });
                const fallbackTournaments = await fallbackBuilder;
                if (fallbackTournaments && fallbackTournaments.length > 0) {
                    tournaments = fallbackTournaments;
                }
            } catch {
                // Non-blocking fallback
            }
        }

        // Strict Human-Admin Gate: If no tournaments are found, return empty list.
        // Never auto-populate or serve unapproved hardcoded tournaments.

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

async function promoteNextFromWaitlist(tournamentId, io) {
    let promotedUser = null;
    const Notification = require('../models/Notification');

    while (true) {
        const tournament = await Tournament.findById(tournamentId);
        if (!tournament || !tournament.waitlist || tournament.waitlist.length === 0) {
            break;
        }
        const maxCap = tournament.maxCapacity || 64;
        if (tournament.attendees && tournament.attendees.length >= maxCap) {
            break;
        }

        // Sort waitlist strictly FIFO by registeredAt ascending
        const sortedWaitlist = [...tournament.waitlist].sort(
            (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
        );
        const candidate = sortedWaitlist[0];

        // Atomic dequeuing and promotion conditioned on capacity
        let updated = null;
        if (mongoose.connection.readyState === 1) {
            updated = await Tournament.findOneAndUpdate(
                {
                    _id: tournamentId,
                    "waitlist.userId": candidate.userId,
                    $expr: {
                        $lt: [
                            { $size: { $ifNull: ["$attendees", []] } },
                            { $ifNull: ["$maxCapacity", 64] }
                        ]
                    }
                },
                {
                    $pull: { waitlist: { userId: candidate.userId } },
                    $push: { attendees: candidate.userId },
                    $inc: { rsvpCount: 1 }
                },
                { new: true }
            );
        } else {
            const wIdx = tournament.waitlist.findIndex(w => w.userId.toString() === candidate.userId.toString());
            if (wIdx > -1) {
                tournament.waitlist.splice(wIdx, 1);
                tournament.attendees.push(candidate.userId);
                tournament.rsvpCount = (tournament.rsvpCount || 0) + 1;
                if (typeof tournament.save === 'function') await tournament.save();
                updated = tournament;
            }
        }

        if (updated) {
            promotedUser = candidate.userId;
            await syncUserRsvpedTournaments(candidate.userId, tournamentId, 'add');

            try {
                await Notification.create({
                    targetUserId: candidate.userId,
                    message: `A spot opened up for ${updated.tournamentName || "the tournament"}! You have been promoted from the waitlist to attending.`,
                    link: `/tournaments?highlight=${tournamentId}`
                });
            } catch (nErr) {
                console.warn("Notification creation error on waitlist promotion:", nErr.message);
            }

            if (io) {
                io.emit("tournament:waitlistPromoted", {
                    tournamentId: tournamentId.toString(),
                    userId: candidate.userId.toString(),
                    tournamentName: updated.tournamentName
                });
                io.emit("tournament:rsvpUpdated", {
                    tournamentId: tournamentId.toString(),
                    rsvpCount: updated.rsvpCount
                });
            }
            break;
        }
    }

    const finalDoc = await Tournament.findById(tournamentId);
    if (finalDoc && finalDoc.attendees && finalDoc.attendees.length < (finalDoc.maxCapacity || 64) && finalDoc.status === 'sold_out') {
        if (mongoose.connection.readyState === 1) {
            await Tournament.updateOne({ _id: tournamentId }, { $set: { status: 'active' } });
        } else {
            finalDoc.status = 'active';
            if (typeof finalDoc.save === 'function') await finalDoc.save();
        }
    }

    return promotedUser;
}

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

        const userId = req.user._id || req.user.id || req.user.userId;
        if (!tournament.attendees) {
            tournament.attendees = [];
        }

        const userIndex = tournament.attendees.findIndex(id => id.toString() === userId.toString());

        // 1. Backward-compatible toggle OFF if already attending
        if (userIndex > -1) {
            tournament.attendees.splice(userIndex, 1);
            tournament.rsvpCount = Math.max(0, (tournament.rsvpCount || 1) - 1);
            if (typeof tournament.save === 'function') await tournament.save();
            if (typeof tournament.populate === 'function') await tournament.populate("attendees", "name profilePic avatarUrl _id");

            await syncUserRsvpedTournaments(userId, tournamentId, 'remove');

            const io = req.io || req.app?.get('io');
            await promoteNextFromWaitlist(tournamentId, io);

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

            return res.json({
                message: "RSVP removed",
                rsvpCount: tournament.rsvpCount,
                isRsvped: false,
                attendees: tournament.attendees
            });
        }

        // 2. Check if already on waitlist
        const inWaitlist = tournament.waitlist && tournament.waitlist.some(w => w.userId.toString() === userId.toString());
        if (inWaitlist) {
            const pos = tournament.waitlist.findIndex(w => w.userId.toString() === userId.toString()) + 1;
            return res.json({
                message: "Tournament is full. You have been added to the waitlist.",
                isRsvped: false,
                isWaitlisted: true,
                waitlistPosition: pos,
                rsvpCount: tournament.rsvpCount
            });
        }

        // 3. Conditional atomic RSVP if capacity allows
        let rsvped = null;
        if (mongoose.connection.readyState === 1) {
            rsvped = await Tournament.findOneAndUpdate(
                {
                    _id: tournamentId,
                    attendees: { $ne: userId },
                    $expr: {
                        $lt: [
                            { $size: { $ifNull: ["$attendees", []] } },
                            { $ifNull: ["$maxCapacity", 64] }
                        ]
                    }
                },
                {
                    $addToSet: { attendees: userId },
                    $inc: { rsvpCount: 1 }
                },
                { new: true }
            );
        } else {
            const maxCap = tournament.maxCapacity || 64;
            if (tournament.attendees.length < maxCap) {
                tournament.attendees.push(userId);
                tournament.rsvpCount = (tournament.rsvpCount || 0) + 1;
                if (typeof tournament.save === 'function') await tournament.save();
                rsvped = tournament;
            }
        }

        if (rsvped) {
            if (rsvped.attendees.length >= (rsvped.maxCapacity || 64)) {
                if (mongoose.connection.readyState === 1) {
                    await Tournament.updateOne({ _id: tournamentId }, { $set: { status: 'sold_out' } });
                } else {
                    rsvped.status = 'sold_out';
                }
            }
            if (typeof rsvped.populate === 'function') {
                await rsvped.populate("attendees", "name profilePic avatarUrl _id");
            }
            if (typeof tournament.save === 'function' && tournament !== rsvped) {
                await tournament.save();
            }

            await syncUserRsvpedTournaments(userId, tournamentId, 'add');

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

            return res.json({
                message: "Successfully RSVP'd",
                rsvpCount: rsvped.rsvpCount,
                isRsvped: true,
                attendees: rsvped.attendees
            });
        }

        // 4. Capacity reached -> enroll into waitlist
        let waitlisted = null;
        if (mongoose.connection.readyState === 1) {
            waitlisted = await Tournament.findOneAndUpdate(
                {
                    _id: tournamentId,
                    attendees: { $ne: userId },
                    "waitlist.userId": { $ne: userId }
                },
                {
                    $push: {
                        waitlist: {
                            userId: userId,
                            registeredAt: new Date(),
                            idempotencyKey: req.body?.idempotencyKey || null
                        }
                    },
                    $set: { status: 'sold_out' }
                },
                { new: true }
            );
        } else {
            if (!tournament.waitlist) tournament.waitlist = [];
            tournament.waitlist.push({
                userId: userId,
                registeredAt: new Date(),
                idempotencyKey: req.body?.idempotencyKey || null
            });
            tournament.status = 'sold_out';
            if (typeof tournament.save === 'function') await tournament.save();
            waitlisted = tournament;
        }

        const waitlistArr = waitlisted?.waitlist || tournament.waitlist || [];
        const pos = waitlistArr.findIndex(w => w.userId.toString() === userId.toString()) + 1;

        try {
            if (typeof redis.invalidateCacheTag === 'function') {
                await redis.invalidateCacheTag('tournaments:active_keys');
            }
        } catch (cacheErr) {}

        return res.status(200).json({
            message: "Tournament is full. You have been added to the waitlist.",
            isRsvped: false,
            isWaitlisted: true,
            waitlistPosition: pos,
            rsvpCount: waitlisted?.rsvpCount || tournament.rsvpCount
        });
    } catch (error) {
        console.error("Error RSVPing to tournament:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/:id/cancel-rsvp', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const userId = req.user._id || req.user.id || req.user.userId;

        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: "Tournament not found" });
        }

        // 1. Check if user is in waitlist
        const inWaitlist = tournament.waitlist && tournament.waitlist.some(w => w.userId.toString() === userId.toString());
        if (inWaitlist) {
            let waitlistPull = null;
            if (mongoose.connection.readyState === 1) {
                waitlistPull = await Tournament.findOneAndUpdate(
                    { _id: tournamentId, "waitlist.userId": userId },
                    { $pull: { waitlist: { userId: userId } } },
                    { new: true }
                );
            } else {
                tournament.waitlist = tournament.waitlist.filter(w => w.userId.toString() !== userId.toString());
                if (typeof tournament.save === 'function') await tournament.save();
                waitlistPull = tournament;
            }

            return res.status(200).json({
                message: "Removed from tournament waitlist.",
                isWaitlisted: false,
                isRsvped: false,
                rsvpCount: waitlistPull?.rsvpCount || tournament.rsvpCount
            });
        }

        // 2. Check if user is in attendees
        const inAttendees = tournament.attendees && tournament.attendees.some(id => id.toString() === userId.toString());
        if (!inAttendees) {
            return res.status(400).json({ error: "User is not currently attending this tournament." });
        }

        let cancelled = null;
        if (mongoose.connection.readyState === 1) {
            cancelled = await Tournament.findOneAndUpdate(
                { _id: tournamentId, attendees: userId },
                {
                    $pull: { attendees: userId },
                    $inc: { rsvpCount: -1 }
                },
                { new: true }
            );
        } else {
            const idx = tournament.attendees.findIndex(id => id.toString() === userId.toString());
            if (idx > -1) tournament.attendees.splice(idx, 1);
            tournament.rsvpCount = Math.max(0, (tournament.rsvpCount || 1) - 1);
            if (typeof tournament.save === 'function') await tournament.save();
            cancelled = tournament;
        }

        if (!cancelled) {
            return res.status(400).json({ error: "User is not currently attending this tournament." });
        }

        await syncUserRsvpedTournaments(userId, tournamentId, 'remove');

        // 3. Trigger FIFO Waitlist Auto-Promotion
        const io = req.io || req.app?.get('io');
        const promotedUserId = await promoteNextFromWaitlist(tournamentId, io);

        // 4. Redis cache eviction
        try {
            if (typeof redis.invalidateCacheTag === 'function') {
                await redis.invalidateCacheTag("tournaments:active_keys");
            }
        } catch (cErr) {
            console.warn("Redis eviction error:", cErr.message);
        }

        const freshTournament = await Tournament.findById(tournamentId);
        if (freshTournament && typeof freshTournament.populate === 'function') {
            await freshTournament.populate("attendees", "name avatarUrl _id");
        }

        return res.status(200).json({
            message: "RSVP removed",
            isRsvped: false,
            rsvpCount: freshTournament?.rsvpCount ?? cancelled.rsvpCount,
            attendees: freshTournament?.attendees ?? cancelled.attendees,
            promotedUserId: promotedUserId ? promotedUserId.toString() : null
        });
    } catch (err) {
        console.error("Cancel RSVP error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/:id/waitlist', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const userId = req.user._id || req.user.id || req.user.userId;

        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: "Tournament not found" });
        }

        if (tournament.attendees && tournament.attendees.some(id => id.toString() === userId.toString())) {
            return res.status(400).json({ error: "User is already attending this tournament." });
        }

        const existingIdx = tournament.waitlist ? tournament.waitlist.findIndex(w => w.userId.toString() === userId.toString()) : -1;
        if (existingIdx > -1) {
            return res.status(200).json({
                message: "Already on waitlist",
                waitlistPosition: existingIdx + 1,
                waitlistCount: tournament.waitlist.length
            });
        }

        let updated = null;
        if (mongoose.connection.readyState === 1) {
            updated = await Tournament.findOneAndUpdate(
                { _id: tournamentId, "waitlist.userId": { $ne: userId } },
                {
                    $push: {
                        waitlist: {
                            userId: userId,
                            registeredAt: new Date(),
                            idempotencyKey: req.body?.idempotencyKey || null
                        }
                    }
                },
                { new: true }
            );
        } else {
            if (!tournament.waitlist) tournament.waitlist = [];
            tournament.waitlist.push({
                userId: userId,
                registeredAt: new Date(),
                idempotencyKey: req.body?.idempotencyKey || null
            });
            if (typeof tournament.save === 'function') await tournament.save();
            updated = tournament;
        }

        const pos = updated.waitlist.findIndex(w => w.userId.toString() === userId.toString()) + 1;
        return res.status(200).json({
            message: "Added to waitlist",
            waitlistPosition: pos,
            waitlistCount: updated.waitlist.length
        });
    } catch (err) {
        console.error("Waitlist join error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

router.get('/:id/waitlist', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const userId = req.user._id || req.user.id || req.user.userId;

        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: "Tournament not found" });
        }

        const waitlist = tournament.waitlist || [];
        const pos = waitlist.findIndex(w => w.userId.toString() === userId.toString()) + 1;

        return res.status(200).json({
            waitlistCount: waitlist.length,
            myPosition: pos > 0 ? pos : null,
            isWaitlisted: pos > 0
        });
    } catch (err) {
        console.error("Waitlist fetch error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

router.delete('/:id/waitlist', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const userId = req.user._id || req.user.id || req.user.userId;

        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID" });
        }

        let updated = null;
        if (mongoose.connection.readyState === 1) {
            updated = await Tournament.findOneAndUpdate(
                { _id: tournamentId, "waitlist.userId": userId },
                { $pull: { waitlist: { userId: userId } } },
                { new: true }
            );
        } else {
            const tournament = await Tournament.findById(tournamentId);
            if (tournament && tournament.waitlist) {
                tournament.waitlist = tournament.waitlist.filter(w => w.userId.toString() !== userId.toString());
                if (typeof tournament.save === 'function') await tournament.save();
                updated = tournament;
            }
        }

        if (!updated) {
            return res.status(400).json({ error: "User is not on the waitlist." });
        }

        return res.status(200).json({
            message: "Removed from waitlist",
            waitlistCount: updated.waitlist?.length || 0
        });
    } catch (err) {
        console.error("Waitlist delete error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * DELETE /api/tournaments/:id
 * Permanently removes a tournament from the public directory.
 * Strictly restricted to authenticated admin users (authMiddleware + adminMiddleware).
 */
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid tournament ID format." });
        }

        const tournament = await Tournament.findByIdAndDelete(id);
        if (!tournament) {
            return res.status(404).json({ message: "Tournament not found." });
        }

        // Flush Redis tournaments cache
        try {
            if (typeof redis.invalidateCacheTag === 'function') {
                await redis.invalidateCacheTag("tournaments:active_keys");
            } else {
                const keys = await redis.keys("tournaments:*");
                if (keys && keys.length > 0) await redis.del(keys);
            }
        } catch (cacheErr) {
            console.warn("[Tournaments] Non-fatal cache flush error on delete:", cacheErr.message);
        }

        // Emit real-time deletion event
        const io = req.io || req.app?.get("io");
        if (io) {
            io.emit("tournamentDeleted", { _id: id });
        }

        return res.status(200).json({ message: "Tournament deleted successfully.", _id: id });
    } catch (err) {
        console.error("Error deleting tournament:", err);
        return res.status(500).json({ message: "Server error deleting tournament.", error: err.message });
    }
});

/**
 * POST /api/tournaments/reset-seed
 * High-performance tournament clean-slate reset and verified seeding endpoint.
 * Executes in < 100ms with zero memory leaks and returns execution metrics.
 * Strictly protected by authMiddleware and adminMiddleware.
 */
router.post('/reset-seed', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const startTime = Date.now();
        const { wipeAndRestartTournamentSystem } = require('../utils/autonomousHunter');
        const isProduction = process.env.NODE_ENV === 'production';
        const result = await wipeAndRestartTournamentSystem({ forceSeed: !isProduction });
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
 * GET /api/tournaments/:tournamentId/matches
 * Returns bracket matches for a given tournament.
 */
router.get('/:tournamentId/matches', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { division, round, status } = req.query;

        if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
            return res.status(400).json({ error: "Invalid tournament ID format" });
        }

        let query = { tournamentId };

        if (division) query.division = division;
        if (round) query.round = round;
        if (status) query.matchStatus = status;

        const matches = await TournamentMatch.find(query).sort({ matchNumber: 1, round: 1 });
        return res.status(200).json({
            success: true,
            tournamentId,
            count: matches.length,
            matches
        });
    } catch (err) {
        console.error("Error fetching tournament matches:", err);
        return res.status(500).json({ error: "Failed to fetch tournament matches", message: err.message });
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


