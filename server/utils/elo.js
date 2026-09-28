/**
 * Calculate new Elo ratings for two players/teams.
 * @param {number} r1 - Current rating of Team 1
 * @param {number} r2 - Current rating of Team 2
 * @param {number} score1 - 1 if Team 1 won, 0 if Team 1 lost, 0.5 for draw
 * @param {number} score2 - 1 if Team 2 won, 0 if Team 2 lost, 0.5 for draw
 * @returns {object} { newR1, newR2, change1, change2 }
 */
const getKFactor = (rating) => {
    if (rating < 2100) return 32;
    if (rating < 2400) return 24;
    return 16;
};

const calculateElo = (r1, r2, score1, score2) => {
    const K1 = getKFactor(r1);
    const K2 = getKFactor(r2);

    // Expected probability of winning
    const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

    // New ratings
    const newR1 = Math.round(r1 + K1 * (score1 - e1));
    const newR2 = Math.round(r2 + K2 * (score2 - e2));

    return {
        newR1,
        newR2,
        change1: newR1 - r1,
        change2: newR2 - r2
    };
};

module.exports = { calculateElo };
