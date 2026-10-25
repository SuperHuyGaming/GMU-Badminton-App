const mongoose = require("mongoose");

const tournamentMatchSchema = new mongoose.Schema({
    tournamentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tournament",
        default: null
    },
    tournamentName: {
        type: String,
        default: "2026 GMU Badminton Open"
    },
    division: {
        type: String,
        required: true
    },
    round: {
        type: String,
        required: true,
        default: "R32"
    },
    matchNumber: {
        type: Number,
        default: 1
    },
    courtNumber: {
        type: Number,
        min: 1,
        max: 6,
        default: null
    },
    bracketSlotId: {
        type: String,
        default: null
    },
    nextMatchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TournamentMatch",
        default: null
    },
    nextMatchSlot: {
        type: String,
        enum: ["team1", "team2", null],
        default: null
    },
    lock: {
        isLocked: { type: Boolean, default: false },
        lockedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        lockedByUmpireName: { type: String, default: null },
        socketId: { type: String, default: null },
        lockedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null }
    },
    team1: [{
        name: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        seed: { type: Number, default: null }
    }],
    team2: [{
        name: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        seed: { type: Number, default: null }
    }],
    games: [{
        gameNumber: { type: Number, required: true },
        team1Score: { type: Number, default: 0 },
        team2Score: { type: Number, default: 0 },
        winner: { type: String, default: null },
        isFinished: { type: Boolean, default: false }
    }],
    currentGame: {
        type: Number,
        default: 1,
        min: 1,
        max: 3
    },
    team1Score: {
        type: Number,
        default: 0
    },
    team2Score: {
        type: Number,
        default: 0
    },
    team1GamesWon: {
        type: Number,
        default: 0
    },
    team2GamesWon: {
        type: Number,
        default: 0
    },
    currentServer: {
        type: String,
        default: ""
    },
    servingCourt: {
        type: String,
        enum: ["RIGHT", "LEFT"],
        default: "RIGHT"
    },
    shuttlePossession: {
        type: String,
        enum: ["team1", "team2"],
        default: "team1"
    },
    pointHistory: [{
        pointIndex: { type: Number, required: true },
        idempotencyKey: { type: String, default: null },
        scoringTeam: { type: String, enum: ["team1", "team2"], required: true },
        previousState: {
            currentGame: Number,
            team1Score: Number,
            team2Score: Number,
            team1GamesWon: Number,
            team2GamesWon: Number,
            servingCourt: String,
            currentServer: String,
            shuttlePossession: String,
            matchStatus: String,
            winner: String,
            isGamePoint: Boolean,
            isMatchPoint: Boolean,
            isDeuce: Boolean,
            games: [Object]
        },
        newState: {
            currentGame: Number,
            team1Score: Number,
            team2Score: Number,
            team1GamesWon: Number,
            team2GamesWon: Number,
            servingCourt: String,
            currentServer: String,
            shuttlePossession: String,
            matchStatus: String,
            winner: String,
            isGamePoint: Boolean,
            isMatchPoint: Boolean,
            isDeuce: Boolean,
            games: [Object]
        },
        timestamp: { type: Date, default: Date.now }
    }],
    matchStatus: {
        type: String,
        enum: ["SCHEDULED", "QUEUED", "WARMUP", "MATCH_IN_PROGRESS", "COMPLETED", "WALKOVER"],
        default: "SCHEDULED"
    },
    winner: {
        type: String,
        enum: ["team1", "team2", null],
        default: null
    },
    isGamePoint: {
        type: Boolean,
        default: false
    },
    isMatchPoint: {
        type: Boolean,
        default: false
    },
    isDeuce: {
        type: Boolean,
        default: false
    },
    isGoldenPoint: {
        type: Boolean,
        default: false
    },
    intervalState: {
        active: { type: Boolean, default: false },
        type: { type: String, enum: ["TECHNICAL_11", "GAME_BREAK_120", null], default: null },
        startedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        durationSeconds: { type: Number, default: 0 },
        technicalTaken: { type: Map, of: Boolean, default: {} }
    },
    game3SideChanged: {
        type: Boolean,
        default: false
    },
    team1CourtSide: {
        type: String,
        enum: ["LEFT", "RIGHT"],
        default: "LEFT"
    },
    team2CourtSide: {
        type: String,
        enum: ["LEFT", "RIGHT"],
        default: "RIGHT"
    },
    walkoverForfeitTeam: {
        type: String,
        enum: ["team1", "team2", null],
        default: null
    },
    umpireName: {
        type: String,
        default: "RAC Official Umpire"
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: '__v'
});

tournamentMatchSchema.index({ tournamentId: 1, division: 1 });
tournamentMatchSchema.index({ courtNumber: 1, matchStatus: 1 });
tournamentMatchSchema.index({ bracketSlotId: 1 });

module.exports = mongoose.model("TournamentMatch", tournamentMatchSchema);
