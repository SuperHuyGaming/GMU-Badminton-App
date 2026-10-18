const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

const courtRoutes = require('../routes/courts');
const Court = require('../models/Court');
const TournamentMatch = require('../models/TournamentMatch');

describe("R3 Backend: Court Scheduling Engine & Umpire Digital Pad Suite", () => {
    let app;
    let mockIo;
    let emittedEvents;

    beforeEach(() => {
        emittedEvents = [];
        mockIo = {
            emit: jest.fn((event, data) => {
                emittedEvents.push({ event, data });
            })
        };

        jest.spyOn(TournamentMatch.prototype, 'save').mockImplementation(function () {
            return Promise.resolve(this);
        });
        jest.spyOn(Court.prototype, 'save').mockImplementation(function () {
            return Promise.resolve(this);
        });

        app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.io = mockIo;
            next();
        });
        app.use('/api/courts', courtRoutes);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("1. Court Initialization & Listing", () => {
        test("GET /api/courts auto-initializes RAC Courts 1 to 6 if empty and returns all 6 courts", async () => {
            const mockCourts = [1, 2, 3, 4, 5, 6].map(num => ({
                courtNumber: num,
                courtName: `RAC Court ${num}`,
                venue: "Recreation Athletic Complex (RAC)",
                status: "AVAILABLE",
                currentMatch: null,
                queue: []
            }));

            jest.spyOn(Court, "find").mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockResolvedValue(mockCourts)
            });

            const res = await request(app).get('/api/courts');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(6);
            expect(res.body.courts).toHaveLength(6);
            expect(res.body.courts[0].courtName).toBe("RAC Court 1");
            expect(res.body.courts[5].courtNumber).toBe(6);
        });

        test("POST /api/courts/initialize creates RAC Courts 1-6", async () => {
            jest.spyOn(Court, "findOne").mockResolvedValue(null);
            jest.spyOn(Court, "create").mockImplementation((data) => Promise.resolve({
                ...data,
                _id: new mongoose.Types.ObjectId()
            }));

            const res = await request(app).post('/api/courts/initialize');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.courts).toHaveLength(6);
        });

        test("GET /api/courts/:courtNumber returns 400 for invalid court numbers", async () => {
            const res1 = await request(app).get('/api/courts/0');
            expect(res1.status).toBe(400);

            const res2 = await request(app).get('/api/courts/7');
            expect(res2.status).toBe(400);

            const res3 = await request(app).get('/api/courts/invalid');
            expect(res3.status).toBe(400);
        });
    });

    describe("2. Match Assignment & Status Transitions", () => {
        test("POST /api/courts/:courtNumber/assign assigns match, sets status to WARMUP, and emits socket events", async () => {
            const mockCourt = {
                courtNumber: 1,
                courtName: "RAC Court 1",
                venue: "Recreation Athletic Complex (RAC)",
                status: "AVAILABLE",
                currentMatch: null,
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);

            const matchPayload = {
                tournamentName: "2026 GMU Badminton Open",
                division: "Men's Singles Open",
                round: "Quarterfinal",
                team1: [{ name: "Ethan Lin", seed: 1 }],
                team2: [{ name: "Marcus Vance", seed: 4 }]
            };

            const res = await request(app)
                .post('/api/courts/1/assign')
                .send(matchPayload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockCourt.status).toBe("WARMUP");
            expect(mockCourt.warmupStartTime).toBeDefined();
            expect(mockCourt.currentMatch).toBeDefined();
            expect(mockCourt.currentMatch.division).toBe("Men's Singles Open");
            expect(mockCourt.currentMatch.team1[0].name).toBe("Ethan Lin");

            // Verify Socket.io emissions
            expect(mockIo.emit).toHaveBeenCalledWith("courtStatusUpdate", expect.objectContaining({
                courtNumber: 1,
                status: "WARMUP"
            }));
            expect(mockIo.emit).toHaveBeenCalledWith("matchCalled", expect.objectContaining({
                courtNumber: 1
            }));
        });
    });

    describe("3. Point-by-Point BWF Scoring, Service Rules & Socket Updates", () => {
        test("scores points, computes service court (even=RIGHT, odd=LEFT), and emits liveScoreUpdate", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const mockMatch = {
                _id: matchId,
                courtNumber: 1,
                tournamentName: "2026 GMU Badminton Open",
                division: "Men's Singles Open",
                round: "Final",
                team1: [{ name: "Ethan Lin" }],
                team2: [{ name: "Marcus Vance" }],
                currentGame: 1,
                team1Score: 0,
                team2Score: 0,
                team1GamesWon: 0,
                team2GamesWon: 0,
                currentServer: "Ethan Lin",
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "WARMUP",
                save: jest.fn().mockResolvedValue(true)
            };

            const mockCourt = {
                courtNumber: 1,
                courtName: "RAC Court 1",
                status: "WARMUP",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(mockMatch);

            // Point 1: Team 1 scores -> score is 1-0 (1 is odd -> serving court is LEFT)
            const res1 = await request(app)
                .post('/api/courts/1/score/point')
                .send({ scoringTeam: 'team1' });

            expect(res1.status).toBe(200);
            expect(res1.body.scorePayload.team1Score).toBe(1);
            expect(res1.body.scorePayload.team2Score).toBe(0);
            expect(res1.body.scorePayload.servingCourt).toBe("LEFT");
            expect(res1.body.scorePayload.shuttlePossession).toBe("team1");
            expect(mockCourt.status).toBe("MATCH_IN_PROGRESS");

            expect(mockIo.emit).toHaveBeenCalledWith("liveScoreUpdate", expect.objectContaining({
                courtNumber: 1,
                team1Score: 1,
                team2Score: 0,
                servingCourt: "LEFT"
            }));

            // Point 2: Team 1 scores again -> score is 2-0 (2 is even -> serving court is RIGHT)
            const res2 = await request(app)
                .post('/api/courts/1/score/point')
                .send({ scoringTeam: 'team1' });

            expect(res2.status).toBe(200);
            expect(res2.body.scorePayload.team1Score).toBe(2);
            expect(res2.body.scorePayload.servingCourt).toBe("RIGHT");

            // Point 3: Team 2 scores -> score is 2-1 (team 2 score is 1, odd -> serving court is LEFT)
            const res3 = await request(app)
                .post('/api/courts/1/score/point')
                .send({ scoringTeam: 'team2' });

            expect(res3.status).toBe(200);
            expect(res3.body.scorePayload.team1Score).toBe(2);
            expect(res3.body.scorePayload.team2Score).toBe(1);
            expect(res3.body.scorePayload.servingCourt).toBe("LEFT");
            expect(res3.body.scorePayload.shuttlePossession).toBe("team2");
        });

        test("detects deuce at 20-20, game point, and completes game on 2-point lead", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const mockMatch = {
                _id: matchId,
                courtNumber: 2,
                team1: [{ name: "Player 1" }],
                team2: [{ name: "Player 2" }],
                currentGame: 1,
                team1Score: 19,
                team2Score: 20,
                team1GamesWon: 0,
                team2GamesWon: 0,
                currentServer: "Player 2",
                servingCourt: "RIGHT",
                shuttlePossession: "team2",
                games: [{ gameNumber: 1, team1Score: 19, team2Score: 20, winner: null, isFinished: false }],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                save: jest.fn().mockResolvedValue(true)
            };

            const mockCourt = {
                courtNumber: 2,
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(mockMatch);

            // Team 1 scores: 20-20 -> Deuce!
            const resDeuce = await request(app)
                .post('/api/courts/2/score/point')
                .send({ scoringTeam: 'team1' });

            expect(resDeuce.body.scorePayload.team1Score).toBe(20);
            expect(resDeuce.body.scorePayload.team2Score).toBe(20);
            expect(resDeuce.body.scorePayload.isDeuce).toBe(true);

            // Team 1 scores: 21-20 -> Game point for Team 1!
            const resGP = await request(app)
                .post('/api/courts/2/score/point')
                .send({ scoringTeam: 'team1' });

            expect(resGP.body.scorePayload.team1Score).toBe(21);
            expect(resGP.body.scorePayload.isGamePoint).toBe(true);

            // Team 1 scores: 22-20 -> Game 1 won by Team 1! Advances to Game 2!
            const resGameWin = await request(app)
                .post('/api/courts/2/score/point')
                .send({ scoringTeam: 'team1' });

            expect(mockMatch.team1GamesWon).toBe(1);
            expect(mockMatch.currentGame).toBe(2);
            expect(mockMatch.team1Score).toBe(0);
            expect(mockMatch.team2Score).toBe(0);
            expect(mockMatch.games[0].winner).toBe("team1");
            expect(mockMatch.games[0].isFinished).toBe(true);
        });

        test("completes match when a team wins 2 games (BWF Best-of-3)", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const mockMatch = {
                _id: matchId,
                courtNumber: 3,
                team1: [{ name: "Player 1" }],
                team2: [{ name: "Player 2" }],
                currentGame: 2,
                team1Score: 20,
                team2Score: 15,
                team1GamesWon: 1, // already won game 1
                team2GamesWon: 0,
                currentServer: "Player 1",
                servingCourt: "RIGHT",
                shuttlePossession: "team1",
                games: [
                    { gameNumber: 1, team1Score: 21, team2Score: 18, winner: "team1", isFinished: true },
                    { gameNumber: 2, team1Score: 20, team2Score: 15, winner: null, isFinished: false }
                ],
                pointHistory: [],
                matchStatus: "MATCH_IN_PROGRESS",
                save: jest.fn().mockResolvedValue(true)
            };

            const mockCourt = {
                courtNumber: 3,
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(mockMatch);

            // Score point 21-15 -> Team 1 wins game 2 and the entire match!
            const res = await request(app)
                .post('/api/courts/3/score/point')
                .send({ scoringTeam: 'team1' });

            expect(res.body.match.team1GamesWon).toBe(2);
            expect(res.body.match.matchStatus).toBe("COMPLETED");
            expect(res.body.match.winner).toBe("team1");
            expect(res.body.scorePayload.matchStatus).toBe("COMPLETED");
        });
    });

    describe("4. Undo Point Functionality", () => {
        test("POST /api/courts/:courtNumber/score/undo reverts last point and restores scores and serving court", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const mockMatch = {
                _id: matchId,
                courtNumber: 4,
                currentGame: 1,
                team1Score: 5,
                team2Score: 3,
                team1GamesWon: 0,
                team2GamesWon: 0,
                currentServer: "Player 1",
                servingCourt: "LEFT",
                shuttlePossession: "team1",
                matchStatus: "MATCH_IN_PROGRESS",
                winner: null,
                isGamePoint: false,
                isMatchPoint: false,
                isDeuce: false,
                games: [{ gameNumber: 1, team1Score: 5, team2Score: 3, winner: null, isFinished: false }],
                pointHistory: [
                    {
                        pointIndex: 1,
                        scoringTeam: "team1",
                        previousState: {
                            currentGame: 1,
                            team1Score: 4,
                            team2Score: 3,
                            team1GamesWon: 0,
                            team2GamesWon: 0,
                            servingCourt: "RIGHT",
                            currentServer: "Player 1",
                            shuttlePossession: "team1",
                            matchStatus: "MATCH_IN_PROGRESS",
                            winner: null,
                            isGamePoint: false,
                            isMatchPoint: false,
                            isDeuce: false,
                            games: [{ gameNumber: 1, team1Score: 4, team2Score: 3, winner: null, isFinished: false }]
                        },
                        newState: {
                            currentGame: 1,
                            team1Score: 5,
                            team2Score: 3,
                            team1GamesWon: 0,
                            team2GamesWon: 0,
                            servingCourt: "LEFT",
                            currentServer: "Player 1",
                            shuttlePossession: "team1",
                            matchStatus: "MATCH_IN_PROGRESS",
                            winner: null,
                            isGamePoint: false,
                            isMatchPoint: false,
                            isDeuce: false,
                            games: [{ gameNumber: 1, team1Score: 5, team2Score: 3, winner: null, isFinished: false }]
                        }
                    }
                ],
                save: jest.fn().mockResolvedValue(true)
            };

            const mockCourt = {
                courtNumber: 4,
                status: "MATCH_IN_PROGRESS",
                currentMatch: { matchId },
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(mockMatch);

            const res = await request(app).post('/api/courts/4/score/undo');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.scorePayload.team1Score).toBe(4);
            expect(res.body.scorePayload.servingCourt).toBe("RIGHT");
            expect(res.body.scorePayload.isUndo).toBe(true);

            expect(mockIo.emit).toHaveBeenCalledWith("liveScoreUpdate", expect.objectContaining({
                courtNumber: 4,
                team1Score: 4,
                isUndo: true
            }));
        });

        test("returns 400 when attempting to undo on empty point history", async () => {
            const matchId = new mongoose.Types.ObjectId();
            const mockMatch = {
                _id: matchId,
                pointHistory: []
            };

            const mockCourt = {
                courtNumber: 4,
                currentMatch: { matchId }
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);
            jest.spyOn(TournamentMatch, "findById").mockResolvedValue(mockMatch);

            const res = await request(app).post('/api/courts/4/score/undo');
            expect(res.status).toBe(400);
            expect(res.body.error).toContain("No points to undo");
        });
    });

    describe("5. Court Status Management & Queue", () => {
        test("POST /api/courts/:courtNumber/status updates status and emits courtStatusUpdate", async () => {
            const mockCourt = {
                courtNumber: 5,
                courtName: "RAC Court 5",
                status: "AVAILABLE",
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);

            const res = await request(app)
                .post('/api/courts/5/status')
                .send({ status: 'MAINTENANCE' });

            expect(res.status).toBe(200);
            expect(mockCourt.status).toBe("MAINTENANCE");
            expect(mockIo.emit).toHaveBeenCalledWith("courtStatusUpdate", expect.objectContaining({
                courtNumber: 5,
                status: "MAINTENANCE"
            }));
        });

        test("POST /api/courts/:courtNumber/queue adds match to court waiting queue", async () => {
            const mockCourt = {
                courtNumber: 6,
                queue: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(Court, "findOne").mockResolvedValue(mockCourt);

            const queuedMatchId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/courts/6/queue')
                .send({ matchId: queuedMatchId.toString() });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockCourt.queue).toContain(queuedMatchId.toString());
        });
    });
});
