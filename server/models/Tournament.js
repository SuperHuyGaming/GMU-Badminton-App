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
    rsvpCount: Number,
    skillLevels: [String],
    startDate: Date,
    endDate: Date,
    scraperLastRun: Date,
    instagramPostUrl: String,
    hostClubHandle: String,
    linktreeUrl: String,
    originalCaption: String,
    createdAt: Date
}, { collection: "tournaments" }); // Match the Java service collection

module.exports = mongoose.model("Tournament", tournamentSchema);
