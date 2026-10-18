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
}, { timestamps: true });

tournamentMatchSchema.index({ tournamentId: 1, division: 1 });
tournamentMatchSchema.index({ courtNumber: 1, matchStatus: 1 });

module.exports = mongoose.model("TournamentMatch", tournamentMatchSchema);
