const mongoose = require("mongoose");

const courtSchema = new mongoose.Schema({
    courtNumber: {
        type: Number,
        required: true,
        unique: true,
        min: 1,
        max: 6
    },
    courtName: {
        type: String,
        required: true,
        default: function () {
            return `RAC Court ${this.courtNumber}`;
        }
    },
    venue: {
        type: String,
        default: "Recreation Athletic Complex (RAC)"
    },
    status: {
        type: String,
        enum: ["AVAILABLE", "WARMUP", "MATCH_IN_PROGRESS", "MAINTENANCE"],
        default: "AVAILABLE"
    },
    currentMatch: {
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch", default: null },
        tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", default: null },
        tournamentName: { type: String, default: "" },
        division: { type: String, default: "" },
        round: { type: String, default: "" },
        team1: { type: Array, default: [] },
        team2: { type: Array, default: [] },
        currentGame: { type: Number, default: 1 },
        team1Score: { type: Number, default: 0 },
        team2Score: { type: Number, default: 0 },
        team1GamesWon: { type: Number, default: 0 },
        team2GamesWon: { type: Number, default: 0 },
        currentServer: { type: String, default: "" },
        servingCourt: { type: String, enum: ["RIGHT", "LEFT"], default: "RIGHT" },
        shuttlePossession: { type: String, enum: ["team1", "team2"], default: "team1" },
        games: { type: Array, default: [] },
        matchStatus: { type: String, default: "SCHEDULED" },
        winner: { type: String, default: null },
        isGamePoint: { type: Boolean, default: false },
        isMatchPoint: { type: Boolean, default: false },
        isDeuce: { type: Boolean, default: false }
    },
    queue: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TournamentMatch"
    }],
    warmupStartTime: {
        type: Date,
        default: null
    },
    walkoverTimer: {
        active: { type: Boolean, default: false },
        targetTeam: { type: String, enum: ['team1', 'team2', 'both', null], default: null },
        targetPlayerName: { type: String, default: '' },
        startedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        durationSeconds: { type: Number, default: 600 } // 10 minutes
    },
    estimatedDurationMinutes: { type: Number, default: 35 },
    estimatedEndTime: { type: Date, default: null },
    pacingSecondsPerPoint: { type: Number, default: 28 },
    lastActivityAt: { type: Date, default: Date.now },
    isStalled: { type: Boolean, default: false },
    stallReason: { type: String, default: null },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("Court", courtSchema);
