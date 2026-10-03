const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const authMiddleware = require('../middleware/auth');
const redis = require('../utils/redis');

router.get('/', async (req, res) => {
    try {
        const { month, location, skillLevel } = req.query;
        let query = {};
        if (month) {
            const startDate = new Date(month + "-01T00:00:00.000Z");
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            query.startDate = { $gte: startDate, $lt: endDate };
        }
        if (location) query.eventLocation = { $regex: location, $options: 'i' };
        if (skillLevel) query.skillLevels = skillLevel;

        const cacheKey = "tournaments:" + JSON.stringify(query);
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return res.json({ tournaments: JSON.parse(cachedData), cached: true });
        }

        const tournaments = await Tournament.find(query).sort({ startDate: 1 });
        await redis.setex(cacheKey, 3600, JSON.stringify(tournaments));

        res.json({ tournaments, cached: false });
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/:id/rsvp', authMiddleware, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ error: "Tournament not found" });

        tournament.rsvpCount = (tournament.rsvpCount || 0) + 1;
        await tournament.save();

        const keys = await redis.keys('tournaments:*');
        if (keys.length > 0) await redis.del(keys);

        res.json({ message: "Successfully RSVP'd", rsvpCount: tournament.rsvpCount });
    } catch (error) {
        console.error("Error RSVPing to tournament:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
