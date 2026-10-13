const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const { authMiddleware } = require('../middleware/auth');
const redis = require('../utils/redis');

router.get('/', async (req, res) => {
    try {
        const { month, location, skillLevel, upcoming, weekend, search } = req.query;
        let query = {};

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

        let tournaments = await Tournament.find(query)
            .populate("attendees", "name avatarUrl _id")
            .sort({ startDate: 1 });

        // If no tournaments found for broad view and database is connected, ensure guaranteed active tournaments are populated
        if (mongoose.connection?.readyState === 1 && tournaments.length === 0 && !search && !location && !skillLevel && !month) {
            try {
                const { ensureGuaranteedTournaments } = require('../utils/autonomousHunter');
                await ensureGuaranteedTournaments();
                tournaments = await Tournament.find(query)
                    .populate("attendees", "name avatarUrl _id")
                    .sort({ startDate: 1 });
            } catch (seedErr) {
                console.warn("[Tournaments Route] Seed check skipped:", seedErr.message);
            }
        }

        try {
            await redis.setex(cacheKey, 3600, JSON.stringify(tournaments));
        } catch (cacheErr) {
            console.warn("Redis write error:", cacheErr.message);
        }

        res.json({ tournaments, cached: false });
    } catch (error) {
        console.error("Error fetching tournaments:", error);
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
            const keys = await redis.keys('tournaments:*');
            if (keys && keys.length > 0) await redis.del(keys);
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

module.exports = router;

