/**
 * server/tests/glicko2.test.js
 * Verification of the Glicko-2 Enterprise MMR Engine against Dr. Mark Glickman (2013) specifications.
 */

const {
    toGlicko2Scale,
    toGlickoScale,
    g,
    expectedScore,
    computeNewVolatility,
    updatePlayerGlicko2,
    applyInactivityDecay,
    calculateMatchGlicko2,
    calculateEloCompatibility,
    RATING_PERIOD_MS
} = require("../utils/glicko2");

describe("Glicko-2 Mathematical Engine Specification Tests", () => {
    test("converts accurately between Glicko and Glicko-2 scales", () => {
        const { mu, phi } = toGlicko2Scale(1500, 350);
        expect(mu).toBeCloseTo(0, 5);
        expect(phi).toBeCloseTo(2.01476, 4);

        const convertedBack = toGlickoScale(mu, phi);
        expect(convertedBack.rating).toBe(1500);
        expect(convertedBack.rd).toBe(350);
    });

    test("computes g(phi) variance discount factor correctly", () => {
        // High uncertainty opponent (phi ~ 2.01) has reduced weight (~0.669)
        const gHigh = g(2.01476);
        expect(gHigh).toBeLessThan(0.7);
        expect(gHigh).toBeGreaterThan(0.6);

        // Very low uncertainty opponent (phi ~ 0.17) has near full weight
        const gLow = g(30 / 173.7178);
        expect(gLow).toBeGreaterThan(0.99);
    });

    test("computes expected score with logistic sigmoid curve", () => {
        const evenMatch = expectedScore(0, 0, 1.0);
        expect(evenMatch).toBeCloseTo(0.5, 5);

        const higherRated = expectedScore(1.0, 0, 0.5);
        expect(higherRated).toBeGreaterThan(0.5);

        const lowerRated = expectedScore(-1.0, 0, 0.5);
        expect(lowerRated).toBeLessThan(0.5);
    });

    test("matches Dr. Mark Glickman 2013 canonical reference test vector", () => {
        // Canonical Player: R = 1500, RD = 200, sigma = 0.06
        const player = { rating: 1500, rd: 200, volatility: 0.06 };

        // 3 Opponents from Glickman 2013 paper:
        // Opponent 1: R1 = 1400, RD1 = 30, Score s1 = 1 (Win)
        // Opponent 2: R2 = 1550, RD2 = 100, Score s2 = 0 (Loss)
        // Opponent 3: R3 = 1700, RD3 = 300, Score s3 = 0 (Loss)
        const opponents = [
            { rating: 1400, rd: 30, score: 1 },
            { rating: 1550, rd: 100, score: 0 },
            { rating: 1700, rd: 300, score: 0 }
        ];

        const updated = updatePlayerGlicko2(player, opponents, 0.5);

        // Expected in Dr. Glickman's paper:
        // R' = 1464.06 (integer rounded: 1464)
        // RD' = 151.52 (integer rounded: 152)
        // sigma' = 0.05999 (rounded: 0.06)
        expect(updated.rating).toBe(1464);
        expect(updated.rd).toBe(152);
        expect(updated.volatility).toBeCloseTo(0.06, 3);
    });

    test("inactivity temporal decay expands RD without degrading nominal rating", () => {
        const player = {
            rating: 1850,
            rd: 85,
            volatility: 0.06,
            lastMatchDate: new Date(Date.now() - 4 * RATING_PERIOD_MS) // 4 rating periods inactive (~8 weeks)
        };

        const decayed = applyInactivityDecay(player, new Date());

        // Nominal rating must be strictly preserved
        expect(decayed.rating).toBe(1850);
        // Rating deviation must expand reflecting increased uncertainty
        expect(decayed.rd).toBeGreaterThan(85);
        expect(decayed.rd).toBeLessThanOrEqual(350);
    });

    test("inactivity decay returns identical player when within current rating period", () => {
        const now = new Date();
        const player = {
            rating: 1600,
            rd: 120,
            volatility: 0.06,
            lastMatchDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago (< 14 days)
        };

        const result = applyInactivityDecay(player, now);
        expect(result.rating).toBe(1600);
        expect(result.rd).toBe(120);
    });

    test("calculateMatchGlicko2 computes symmetrical and inverse rating adjustments", () => {
        const t1 = { rating: 1500, rd: 200, volatility: 0.06 };
        const t2 = { rating: 1500, rd: 200, volatility: 0.06 };

        const result = calculateMatchGlicko2(t1, t2, 1, 0);

        expect(result.team1.newRating).toBeGreaterThan(1500);
        expect(result.team2.newRating).toBeLessThan(1500);
        expect(result.team1.change).toBeGreaterThan(0);
        expect(result.team2.change).toBeLessThan(0);
        // Both deviations should contract after playing a match
        expect(result.team1.newRd).toBeLessThan(200);
        expect(result.team2.newRd).toBeLessThan(200);
    });

    test("backward compatibility adapter calculateEloCompatibility behaves like classic Elo", () => {
        const res = calculateEloCompatibility(1200, 1200, 1, 0);

        expect(res.newR1).toBeGreaterThan(1200);
        expect(res.newR2).toBeLessThan(1200);
        expect(res.change1).toBeGreaterThan(0);
        expect(res.change2).toBeLessThan(0);
        expect(res.newR1 - 1200).toBe(res.change1);
    });
});
