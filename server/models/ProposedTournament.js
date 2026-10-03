const mongoose = require("mongoose");

const proposedTournamentSchema = new mongoose.Schema({
    // Raw Scraped Data
    rawCaption: { type: String, default: "" },
    scrapedImageUrls: { type: [String], default: [] },
    sourceLinks: { type: [String], default: [] },

    // AI Structured Data
    tournamentName: { type: String, required: true, trim: true },
    date: { type: Date },
    location: { type: String, default: "TBD" },
    entryFee: { type: String, default: "" },
    registrationLink: { type: String, default: "" },
    skillLevels: { type: [String], default: [] },
    registrationDeadline: { type: Date },

    // Metadata
    sourceUrl: { type: String, required: true },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true
    },

    // Lifecycle & Auditing
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    createdTournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
proposedTournamentSchema.index({ status: 1, confidenceScore: -1 });
proposedTournamentSchema.index({ sourceUrl: 1 });

// Virtuals
proposedTournamentSchema.virtual("aiStructuredData")
    .get(function () {
        return {
            tournamentName: this.tournamentName,
            date: this.date,
            location: this.location,
            entryFee: this.entryFee,
            registrationLink: this.registrationLink,
            skillLevels: this.skillLevels,
            registrationDeadline: this.registrationDeadline
        };
    })
    .set(function (data) {
        if (!data || typeof data !== "object") return;
        if (data.tournamentName !== undefined) this.tournamentName = data.tournamentName;
        if (data.date !== undefined) this.date = data.date;
        if (data.location !== undefined) this.location = data.location;
        if (data.entryFee !== undefined) this.entryFee = data.entryFee;
        if (data.registrationLink !== undefined) this.registrationLink = data.registrationLink;
        if (data.skillLevels !== undefined) this.skillLevels = data.skillLevels;
        if (data.registrationDeadline !== undefined) this.registrationDeadline = data.registrationDeadline;
    });

proposedTournamentSchema.virtual("rawScrapedData")
    .get(function () {
        return {
            rawCaption: this.rawCaption,
            scrapedImageUrls: this.scrapedImageUrls,
            sourceLinks: this.sourceLinks
        };
    })
    .set(function (data) {
        if (!data || typeof data !== "object") return;
        if (data.rawCaption !== undefined) this.rawCaption = data.rawCaption;
        if (data.scrapedImageUrls !== undefined) this.scrapedImageUrls = data.scrapedImageUrls;
        if (data.sourceLinks !== undefined) this.sourceLinks = data.sourceLinks;
    });

module.exports = mongoose.model("ProposedTournament", proposedTournamentSchema);
