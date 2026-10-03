const express = require("express");
const mongoose = require("mongoose");
const xss = require("xss");
const ProposedTournament = require("../models/ProposedTournament");
const Tournament = require("../models/Tournament");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();

// Enforce authentication and admin authorization for all tournament admin endpoints
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/tournaments/proposed
 * Retrieves all pending proposed tournaments sorted by confidenceScore descending.
 */
router.get("/proposed", async (req, res) => {
    try {
        const proposals = await ProposedTournament.find({ status: "pending" })
            .sort({ confidenceScore: -1 });
        return res.status(200).json(proposals);
    } catch (err) {
        return res.status(500).json({ message: "Server error fetching proposed tournaments", error: err.message });
    }
});

/**
 * POST /api/admin/tournaments/approve/:id
 * Approves a proposed tournament: creates a Tournament entry with isOpenTournament: true,
 * transitions proposal status to approved, and records audit metadata.
 */
router.post("/approve/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid proposed tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        if (proposed.status === "approved") {
            return res.status(400).json({ message: "Tournament proposal is already approved." });
        }

        const sourceLinks = Array.isArray(proposed.sourceLinks) ? proposed.sourceLinks : [];
        const scrapedImageUrls = Array.isArray(proposed.scrapedImageUrls) ? proposed.scrapedImageUrls : [];

        // Critical Invariant: isOpenTournament MUST be set to true so public feeds and calendar render it
        const tournament = new Tournament({
            tournamentName: proposed.tournamentName,
            eventLocation: proposed.location || "TBD",
            hostUniversity: "Local Club",
            startDate: proposed.date,
            endDate: proposed.date,
            registrationDeadline: proposed.registrationDeadline || proposed.date,
            registrationUrl: proposed.registrationLink || sourceLinks[0] || proposed.sourceUrl,
            sourceUrl: proposed.sourceUrl,
            flyerImageUrl: scrapedImageUrls[0] || "",
            skillLevels: proposed.skillLevels || [],
            originalCaption: proposed.rawCaption || "",
            isOpenTournament: true,
            rsvpCount: 0,
            hasSentDeadlineWarning: false,
            createdAt: new Date()
        });

        await tournament.save();

        proposed.status = "approved";
        proposed.approvedAt = new Date();
        proposed.approvedBy = req.user?.id || req.user?.userId || null;
        proposed.createdTournamentId = tournament._id;
        await proposed.save();

        const io = req.io || req.app?.get("io");
        if (io) {
            io.emit("tournamentApproved", tournament);
        }

        return res.status(200).json({
            message: "Tournament approved and published successfully",
            tournament,
            proposedTournament: proposed
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error approving tournament", error: err.message });
    }
});

/**
 * POST /api/admin/tournaments/reject/:id
 * Rejects a proposed tournament and logs the rejection reason.
 */
router.post("/reject/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid proposed tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        const reason = req.body && typeof req.body.reason === "string" && req.body.reason.trim()
            ? xss(req.body.reason.trim().slice(0, 500))
            : "Rejected by admin";

        proposed.status = "rejected";
        proposed.rejectedAt = new Date();
        proposed.rejectionReason = reason;
        await proposed.save();

        return res.status(200).json({
            message: "Tournament proposal rejected",
            proposedTournament: proposed
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error rejecting tournament", error: err.message });
    }
});

/**
 * PUT /api/admin/tournaments/:id
 * Edits AI Structured Data fields on a proposed tournament before approval.
 */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid proposed tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        const payload = req.body || {};
        const sourceData = payload.aiStructuredData && typeof payload.aiStructuredData === "object"
            ? { ...payload, ...payload.aiStructuredData }
            : payload;

        if (sourceData.tournamentName !== undefined) {
            if (typeof sourceData.tournamentName !== "string" || !sourceData.tournamentName.trim()) {
                return res.status(400).json({ message: "Tournament name cannot be empty." });
            }
            proposed.tournamentName = xss(sourceData.tournamentName.trim());
        }

        if (sourceData.location !== undefined && typeof sourceData.location === "string") {
            proposed.location = xss(sourceData.location.trim().slice(0, 200)) || "TBD";
        }

        if (sourceData.entryFee !== undefined && typeof sourceData.entryFee === "string") {
            proposed.entryFee = xss(sourceData.entryFee.trim().slice(0, 100));
        }

        if (sourceData.registrationLink !== undefined && typeof sourceData.registrationLink === "string") {
            proposed.registrationLink = xss(sourceData.registrationLink.trim());
        }

        if (sourceData.skillLevels !== undefined && Array.isArray(sourceData.skillLevels)) {
            proposed.skillLevels = sourceData.skillLevels
                .filter((s) => typeof s === "string")
                .map((s) => xss(s.trim()));
        }

        if (sourceData.date !== undefined) {
            proposed.date = sourceData.date ? new Date(sourceData.date) : undefined;
        }

        if (sourceData.registrationDeadline !== undefined) {
            proposed.registrationDeadline = sourceData.registrationDeadline
                ? new Date(sourceData.registrationDeadline)
                : undefined;
        }

        if (sourceData.confidenceScore !== undefined) {
            const score = Number(sourceData.confidenceScore);
            if (!isNaN(score) && score >= 0 && score <= 100) {
                proposed.confidenceScore = score;
            } else {
                return res.status(400).json({ message: "Confidence score must be a number between 0 and 100." });
            }
        }

        await proposed.save();

        return res.status(200).json({
            message: "Tournament proposal updated successfully",
            proposedTournament: proposed
        });
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({ message: err.message });
        }
        return res.status(500).json({ message: "Server error updating tournament proposal", error: err.message });
    }
});

/**
 * POST /api/admin/tournaments/manual
 * Manually creates a new tournament in the tournaments collection with isOpenTournament: true.
 * Emits tournamentApproved event via Socket.io if available.
 */
router.post("/manual", async (req, res) => {
    try {
        const body = req.body || {};
        const tournamentName = body.tournamentName;

        if (!tournamentName || typeof tournamentName !== "string" || !tournamentName.trim()) {
            return res.status(400).json({ message: "Tournament name is required." });
        }

        const sanitizedName = xss(tournamentName.trim());
        const eventLocation = body.eventLocation || body.location;
        const sanitizedLocation = eventLocation && typeof eventLocation === "string" && eventLocation.trim()
            ? xss(eventLocation.trim().slice(0, 200))
            : "TBD";

        const startDate = body.startDate || body.date ? new Date(body.startDate || body.date) : undefined;
        const endDate = body.endDate
            ? new Date(body.endDate)
            : (body.startDate || body.date ? new Date(body.startDate || body.date) : undefined);
        const registrationDeadline = body.registrationDeadline
            ? new Date(body.registrationDeadline)
            : startDate;

        const regUrl = body.registrationUrl || body.registrationLink || "";
        const sanitizedRegUrl = typeof regUrl === "string" ? xss(regUrl.trim()) : "";

        const flyerUrl = body.flyerImageUrl || "";
        const sanitizedFlyerUrl = typeof flyerUrl === "string" ? xss(flyerUrl.trim()) : "";

        const skillLevels = Array.isArray(body.skillLevels)
            ? body.skillLevels.filter((s) => typeof s === "string").map((s) => xss(s.trim()))
            : [];

        const originalCaption = body.originalCaption || body.rawCaption || "";
        const sanitizedCaption = typeof originalCaption === "string" ? xss(originalCaption.trim()) : "";

        const tournament = new Tournament({
            tournamentName: sanitizedName,
            eventLocation: sanitizedLocation,
            hostUniversity: body.hostUniversity && typeof body.hostUniversity === "string" ? xss(body.hostUniversity.trim()) : "Local Club",
            startDate,
            endDate,
            registrationDeadline,
            registrationUrl: sanitizedRegUrl,
            sourceUrl: body.sourceUrl ? xss(body.sourceUrl.trim()) : "",
            flyerImageUrl: sanitizedFlyerUrl,
            skillLevels,
            originalCaption: sanitizedCaption,
            isOpenTournament: true,
            rsvpCount: 0,
            hasSentDeadlineWarning: false,
            createdAt: new Date()
        });

        await tournament.save();

        const io = req.io || req.app?.get("io");
        if (io) {
            io.emit("tournamentApproved", tournament);
        }

        return res.status(201).json({
            message: "Tournament created successfully",
            tournament
        });
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({ message: err.message });
        }
        return res.status(500).json({ message: "Server error creating manual tournament", error: err.message });
    }
});

module.exports = router;
