const {
    calculateServiceCourt,
    checkGameWinner,
    isDeuce,
    isGoldenPoint,
    getGamePoint,
    getMatchPoint,
    checkIntervalState,
    applyBWFPoint
} = require("../utils/bwfRules");

describe("Problem 12: Strict BWF 21-Point Rally Scoring & Rules Engine", () => {
    describe("1. Service Court Parity", () => {
        test("computes service court based on score parity (even = RIGHT, odd = LEFT)", () => {
            expect(calculateServiceCourt(0)).toBe("RIGHT");
            expect(calculateServiceCourt(1)).toBe("LEFT");
            expect(calculateServiceCourt(2)).toBe("RIGHT");
            expect(calculateServiceCourt(20)).toBe("RIGHT");
            expect(calculateServiceCourt(21)).toBe("LEFT");
            expect(calculateServiceCourt(29)).toBe("LEFT");
            expect(calculateServiceCourt(30)).toBe("RIGHT");
        });
    });

    describe("2. Game Winner & 2-Point Clear Margin", () => {
        test("regular 21-point win requires at least a 2-point lead", () => {
            expect(checkGameWinner(20, 19)).toBeNull();
            expect(checkGameWinner(21, 19)).toBe("team1");
            expect(checkGameWinner(19, 21)).toBe("team2");
            expect(checkGameWinner(21, 20)).toBeNull(); // Only 1-point lead at 21
            expect(checkGameWinner(22, 20)).toBe("team1");
        });

        test("deuce rule requires 2-point lead beyond 20-20 up to 29-29", () => {
            expect(isDeuce(20, 20)).toBe(true);
            expect(isDeuce(21, 21)).toBe(true);
            expect(isDeuce(28, 28)).toBe(true);
            expect(isDeuce(29, 29)).toBe(false); // 29-29 is golden point, not deuce

            expect(checkGameWinner(24, 23)).toBeNull();
            expect(checkGameWinner(25, 23)).toBe("team1");
            expect(checkGameWinner(28, 29)).toBeNull();
        });

        test("golden point sudden death at 29-29: next point (30th point) wins instantly", () => {
            expect(isGoldenPoint(29, 29)).toBe(true);
            expect(isGoldenPoint(28, 29)).toBe(false);

            // 30-29 wins directly without needing 2-point lead
            expect(checkGameWinner(30, 29)).toBe("team1");
            expect(checkGameWinner(29, 30)).toBe("team2");
        });
    });

    describe("3. Game Point and Match Point Detection", () => {
        test("detects game point correctly", () => {
            expect(getGamePoint(20, 18)).toBe("team1");
            expect(getGamePoint(18, 20)).toBe("team2");
            expect(getGamePoint(20, 20)).toBeNull();
            expect(getGamePoint(21, 20)).toBe("team1");
            expect(getGamePoint(29, 29)).toBe("both");
        });

        test("detects match point correctly in Game 2 or deciding Game 3", () => {
            // Team 1 won Game 1, now in Game 2 at 20-18 -> Match Point
            expect(getMatchPoint(20, 18, 1, 0, 2)).toBe("team1");
            // Team 1 at 20-18 in Game 1 -> only game point, not match point
            expect(getMatchPoint(20, 18, 0, 0, 1)).toBeNull();
            // Deciding Game 3 at 20-19 -> Match Point for Team 1
            expect(getMatchPoint(20, 19, 1, 1, 3)).toBe("team1");
            // Deciding Game 3 at 29-29 -> Golden Match Point for both
            expect(getMatchPoint(29, 29, 1, 1, 3)).toBe("both");
        });
    });

    describe("4. Technical Intervals & Game Break Intervals", () => {
        test("triggers 60s technical interval when leading score reaches 11 points", () => {
            const res1 = checkIntervalState(11, 8, 1, false);
            expect(res1.isInterval).toBe(true);
            expect(res1.intervalType).toBe("TECHNICAL_11");
            expect(res1.durationSeconds).toBe(60);
            expect(res1.sideChangeRequired).toBe(false);

            // If already taken, does not re-trigger
            const res2 = checkIntervalState(11, 8, 1, true);
            expect(res2.isInterval).toBe(false);
        });

        test("triggers Game 3 11-point change of ends flag", () => {
            const resGame3 = checkIntervalState(11, 9, 3, false);
            expect(resGame3.isInterval).toBe(true);
            expect(resGame3.sideChangeRequired).toBe(true);
        });
    });

    describe("5. End-to-End applyBWFPoint Integration", () => {
        test("applies point, increments score, records interval at 11, and enforces 30-point ceiling", () => {
            const mockMatch = {
                currentGame: 1,
                team1Score: 10,
                team2Score: 8,
                team1GamesWon: 0,
                team2GamesWon: 0,
                servingCourt: "RIGHT",
                matchStatus: "MATCH_IN_PROGRESS",
                pointHistory: [],
                games: []
            };

            // 1. Point to reach 11 -> Technical Interval
            const step1 = applyBWFPoint(mockMatch, "team1");
            expect(mockMatch.team1Score).toBe(11);
            expect(mockMatch.servingCourt).toBe("LEFT"); // 11 is odd -> LEFT
            expect(mockMatch.intervalState.active).toBe(true);
            expect(mockMatch.intervalState.type).toBe("TECHNICAL_11");
            expect(step1.intervalStarted).toBeDefined();

            // 2. Play to 29-29 Golden Point
            mockMatch.team1Score = 29;
            mockMatch.team2Score = 29;
            mockMatch.intervalState.active = false;

            applyBWFPoint(mockMatch, "team1");
            expect(mockMatch.team1Score).toBe(0); // Won game 1! Next game initialized with 0-0
            expect(mockMatch.team1GamesWon).toBe(1);
            expect(mockMatch.currentGame).toBe(2);
            expect(mockMatch.intervalState.active).toBe(true);
            expect(mockMatch.intervalState.type).toBe("GAME_BREAK_120"); // 120s rest between games
        });

        test("in Game 3 at 11 points, swaps court sides", () => {
            const mockMatch = {
                currentGame: 3,
                team1Score: 10,
                team2Score: 7,
                team1GamesWon: 1,
                team2GamesWon: 1,
                team1CourtSide: "LEFT",
                team2CourtSide: "RIGHT",
                game3SideChanged: false,
                servingCourt: "RIGHT",
                matchStatus: "MATCH_IN_PROGRESS",
                pointHistory: [],
                games: []
            };

            const result = applyBWFPoint(mockMatch, "team1");
            expect(mockMatch.team1Score).toBe(11);
            expect(mockMatch.game3SideChanged).toBe(true);
            expect(mockMatch.team1CourtSide).toBe("RIGHT"); // Sides swapped!
            expect(mockMatch.team2CourtSide).toBe("LEFT");
            expect(result.sideChangeRequired).toBe(true);
        });

        test("rejects points when score is already at 30 or match completed", () => {
            const finishedMatch = {
                matchStatus: "COMPLETED",
                team1Score: 21,
                team2Score: 18
            };
            expect(() => applyBWFPoint(finishedMatch, "team1")).toThrow(/concluded/i);

            const cappedMatch = {
                matchStatus: "MATCH_IN_PROGRESS",
                team1Score: 30,
                team2Score: 29
            };
            expect(() => applyBWFPoint(cappedMatch, "team1")).toThrow(/30 points ceiling/i);
        });
    });
});
