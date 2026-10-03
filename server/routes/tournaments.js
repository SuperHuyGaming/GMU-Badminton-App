const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const authMiddleware = require('../middleware/auth'); // assuming standard auth middleware

// 22. Public API - List
// GET /api/tournaments with filters for month, location, and skill level.
router.get('/', async (req, res) => {
    try {
        const { month, location, skillLevel } = req.query;
        let query = {};

        if (month) {
            // e.g. "2026-10"
            const startDate = new Date(${month}-01T00:00:00.000Z);
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

        const tournaments = await Tournament.find(query).sort({ startDate: 1 });
        res.json({ tournaments });
    } catch (error) {
        console.error("Error fetching tournaments:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 23. Public API - RSVP
// POST /api/tournaments/:id/rsvp
// Note: We need a way to store attendees. For now, increment rsvpCount if attendees array isn't there, 
// or maybe we should add an attendees array to Tournament schema if missing.
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

        // Just increment rsvpCount as a mock, since Phase 3 says "mark themselves as Going"
        tournament.rsvpCount = (tournament.rsvpCount || 0) + 1;
        await tournament.save();

        res.json({ message: "Successfully RSVP'd", rsvpCount: tournament.rsvpCount });
    } catch (error) {
        console.error("Error RSVPing to tournament:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
