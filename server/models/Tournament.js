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
    maxCapacity: { type: Number, default: 64, min: 1 },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    waitlist: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            registeredAt: { type: Date, default: Date.now },
            idempotencyKey: { type: String, trim: true }
        }
    ],
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
    linkStatus: { type: String, enum: ["valid", "expired", "warning", "unchecked"], default: "unchecked" },
    linkStatusCode: Number,
    linkLastChecked: Date,
    fallbackRegistrationUrl: { type: String, default: "" },
    createdAt: Date
}, { collection: "tournaments" }); // Match the Java service collection

tournamentSchema.index({ tournamentName: 1 });
tournamentSchema.index({ sourceUrl: 1 });
tournamentSchema.index({ status: 1, endDate: 1 });
tournamentSchema.index({ status: 1, startDate: 1 });
tournamentSchema.index({ linkStatus: 1 });
tournamentSchema.index({ "waitlist.userId": 1 });
tournamentSchema.index({ "waitlist.idempotencyKey": 1 }, { sparse: true });

module.exports = mongoose.model("Tournament", tournamentSchema);
