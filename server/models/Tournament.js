const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
    // We only need a subset of fields for calendar generation
    tournamentName: String,
    hostUniversity: String,
    eventLocation: String,
    registrationDeadline: Date,
    rideFormDeadline: Date,
    isOpenTournament: Boolean,
    registrationUrl: String,
    sourceUrl: String,
    flyerImageUrl: String,
    rsvpCount: { type: Number, default: 0 },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    entryFee: String,
    skillLevels: [String],
    divisions: [{
        name: { type: String, required: true },
        code: { type: String, required: true },
        category: { type: String, default: "Singles" },
        maxDraw: { type: Number, default: 32 },
        fee: { type: String, default: "$25" },
        feeAmount: { type: Number, default: 25 },
        eligibility: { type: String, default: "Open" },
        bracketType: { type: String, default: "single_elimination" }
    }],
    startDate: Date,
    endDate: Date,
    scraperLastRun: Date,
    instagramPostUrl: String,
    hostClubHandle: String,
    linktreeUrl: String,
    originalCaption: String,
    hasSentDeadlineWarning: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "sold_out", "canceled", "archived"], default: "active" },
    createdAt: Date
}, { collection: "tournaments" }); // Match the Java service collection

tournamentSchema.index({ tournamentName: 1 });
tournamentSchema.index({ sourceUrl: 1 });

module.exports = mongoose.model("Tournament", tournamentSchema);
