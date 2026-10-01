const express = require("express");
const router = express.Router();
const ics = require("ics");
const User = require("../models/User");
const Tournament = require("../models/Tournament");

// GET /api/calendar/feed/:userId.ics
router.get("/feed/:userId.ics", async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // 1. Fetch user to verify and get RSVP'd tournaments
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send("User not found.");
        }

        let tournamentIds = user.rsvpedTournaments || [];
        
        // Optional fallback for demonstration if no RSVPs yet
        if (tournamentIds.length === 0) {
            // Uncomment to populate with upcoming open tournaments for testing if empty
            // const upcoming = await Tournament.find({ registrationDeadline: { $gte: new Date() } }).limit(3);
            // tournamentIds = upcoming.map(t => t._id.toString());
        }

        // 2. Fetch the corresponding tournaments
        const tournaments = await Tournament.find({
            _id: { $in: tournamentIds }
        });

        // 3. Transform to ICS events format
        const events = tournaments.map(t => {
            // Convert Date to [year, month, day, hour, minute] for ICS
            // Using registrationDeadline as the event time for now, 
            // since actual event dates aren't in the base schema.
            // (Assuming registrationDeadline is the event date if not separated)
            const date = t.registrationDeadline || new Date();
            const startArray = [
                date.getFullYear(),
                date.getMonth() + 1, // ICS expects 1-indexed months
                date.getDate(),
                date.getHours(),
                date.getMinutes()
            ];
            
            // Assume the tournament lasts roughly 8 hours
            const endDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
            const endArray = [
                endDate.getFullYear(),
                endDate.getMonth() + 1,
                endDate.getDate(),
                endDate.getHours(),
                endDate.getMinutes()
            ];

            return {
                title: t.tournamentName || "Badminton Tournament",
                description: `Host: ${t.hostUniversity}\nLink: ${t.registrationUrl || t.sourceUrl}\n\nSynced from Mason Badminton Connect.`,
                location: t.eventLocation || "TBD",
                url: t.registrationUrl || t.sourceUrl,
                status: "CONFIRMED",
                busyStatus: "BUSY",
                start: startArray,
                end: endArray,
                alarms: [
                    { action: 'display', description: 'Reminder', trigger: { hours: 24, minutes: 0, before: true } }
                ]
            };
        });

        // 4. Generate the ICS feed
        if (events.length === 0) {
            // Return an empty calendar if no events
            return res.type("text/calendar").send("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mason Badminton Connect//EN\r\nEND:VCALENDAR");
        }

        ics.createEvents(events, (error, value) => {
            if (error) {
                console.error("ICS generation error:", error);
                return res.status(500).send("Error generating calendar feed.");
            }
            
            // 5. Send as text/calendar for Apple Calendar / Google Calendar
            res.set("Content-Type", "text/calendar; charset=utf-8");
            res.set("Content-Disposition", `attachment; filename="mason-badminton-${userId}.ics"`);
            res.send(value);
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
