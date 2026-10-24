const { calculateEloCompatibility } = require("./glicko2");

/**
 * Legacy Elo Adapter — delegates directly to the Glicko-2 engine
 */
const calculateElo = (r1, r2, score1, score2) => {
    return calculateEloCompatibility(r1, r2, score1, score2);
};

module.exports = { calculateElo };

