/**
 * server/utils/glicko2.js
 * Mark Glickman Glicko-2 Enterprise Rating Engine with Inactivity Decay & Illinois Root-Finding.
 * Implements Dr. Mark E. Glickman (2013) specification.
 */

const SCALE = 173.71779276149092; // 400 / ln(10)
const TAU = 0.5;                  // System constant (volatility constraint)
const EPSILON = 1e-6;             // Convergence tolerance
const RATING_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14-day rating period
const MAX_RD = 350;
const MIN_RD = 30;
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOLATILITY = 0.06;

/**
 * Step 2: Convert to Glicko-2 scale (mu, phi)
 */
const toGlicko2Scale = (rating, rd) => ({
    mu: (rating - DEFAULT_RATING) / SCALE,
    phi: rd / SCALE
});

/**
 * Step 8: Convert back to Glicko scale (R, RD)
 */
const toGlickoScale = (mu, phi) => ({
    rating: Math.round(mu * SCALE + DEFAULT_RATING),
    rd: Math.max(MIN_RD, Math.min(MAX_RD, Math.round(phi * SCALE)))
});

/**
 * Step 3: g(phi) variance discount factor
 */
const g = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/**
 * Step 3: Expected outcome E(mu, muj, phij)
 */
const expectedScore = (mu, muj, phij) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/**
 * Step 5: Illinois numerical algorithm for volatility root-finding
 */
const computeNewVolatility = (delta, phi, v, sigma, tau = TAU) => {
    const a = Math.log(sigma * sigma);
    const phiSq = phi * phi;

    const f = (x) => {
        const ex = Math.exp(x);
        const denom = 2 * Math.pow(phiSq + v + ex, 2);
        const num = ex * (delta * delta - phiSq - v - ex);
        return (num / denom) - (x - a) / (tau * tau);
    };

    let A = a;
    let B;

    if (delta * delta > phiSq + v) {
        B = Math.log(delta * delta - phiSq - v);
    } else {
        let k = 1;
        while (f(a - k * tau) < 0 && k < 100) {
            k++;
        }
        B = a - k * tau;
    }

    let fA = f(A);
    let fB = f(B);

    let iterations = 0;
    while (Math.abs(B - A) > EPSILON && iterations < 100) {
        iterations++;
        const C = A + (A - B) * fA / (fB - fA);
        const fC = f(C);

        if (fC * fB < 0) {
            A = B;
            fA = fB;
        } else {
            fA = fA / 2; // Illinois adjustment
        }
        B = C;
        fB = fC;
    }

    return Math.exp(A / 2);
};

/**
 * Step 6: Inactivity Temporal Decay
 * Expands RD over elapsed 14-day rating periods while strictly preserving nominal rating.
 * @param {object} player - { rating, rd, volatility, lastMatchDate }
 * @param {Date} [currentDate=new Date()]
 * @returns {object} updated player with decayed rd
 */
const applyInactivityDecay = (player, currentDate = new Date()) => {
    if (!player) return null;
    const lastDate = player.lastMatchDate ? new Date(player.lastMatchDate) : new Date();
    const elapsedMs = Math.max(0, currentDate.getTime() - lastDate.getTime());
    const elapsedPeriods = Math.floor(elapsedMs / RATING_PERIOD_MS);

    if (elapsedPeriods <= 0) {
        return { ...player };
    }

    const { phi } = toGlicko2Scale(player.rating, player.rd);
    const sigma = player.volatility || DEFAULT_VOLATILITY;

    // phi' = sqrt(phi^2 + t * sigma^2)
    const phiDecayed = Math.sqrt(phi * phi + elapsedPeriods * sigma * sigma);
    const decayedRd = Math.min(MAX_RD, Math.round(phiDecayed * SCALE));

    return {
        ...player,
        rd: decayedRd,
        lastMatchDate: new Date(lastDate.getTime() + elapsedPeriods * RATING_PERIOD_MS)
    };
};

/**
 * Computes updated Glicko-2 rating for a player against a set of match outcomes
 * @param {object} player - { rating, rd, volatility }
 * @param {Array<{ rating: number, rd: number, score: number }>} opponents
 * @param {number} [tau=TAU]
 */
const updatePlayerGlicko2 = (player, opponents, tau = TAU) => {
    const { mu, phi } = toGlicko2Scale(player.rating, player.rd);
    const sigma = player.volatility || DEFAULT_VOLATILITY;

    if (!opponents || opponents.length === 0) {
        // Did not compete in period: decay RD only
        const phiStar = Math.sqrt(phi * phi + sigma * sigma);
        const rescaled = toGlickoScale(mu, phiStar);
        return {
            rating: rescaled.rating,
            rd: rescaled.rd,
            volatility: sigma
        };
    }

    let vInv = 0;
    let deltaSum = 0;

    for (const opp of opponents) {
        const oppGlicko = toGlicko2Scale(opp.rating, opp.rd);
        const gVal = g(oppGlicko.phi);
        const eVal = expectedScore(mu, oppGlicko.mu, oppGlicko.phi);

        vInv += gVal * gVal * eVal * (1 - eVal);
        deltaSum += gVal * (opp.score - eVal);
    }

    const v = 1 / vInv;
    const delta = v * deltaSum;

    const newSigma = computeNewVolatility(delta, phi, v, sigma, tau);
    const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
    const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const muPrime = mu + phiPrime * phiPrime * deltaSum;

    const finalScale = toGlickoScale(muPrime, phiPrime);

    return {
        rating: finalScale.rating,
        rd: finalScale.rd,
        volatility: newSigma
    };
};

/**
 * 1v1 or Team vs Team Match Processor
 * @param {object} t1 - Team 1 { rating, rd, volatility }
 * @param {object} t2 - Team 2 { rating, rd, volatility }
 * @param {number} score1 - 1 if T1 won, 0 if T1 lost, 0.5 draw
 * @param {number} score2 - 1 if T2 won, 0 if T2 lost, 0.5 draw
 */
const calculateMatchGlicko2 = (t1, t2, score1, score2) => {
    const update1 = updatePlayerGlicko2(
        { rating: t1.rating, rd: t1.rd, volatility: t1.volatility },
        [{ rating: t2.rating, rd: t2.rd, score: score1 }]
    );

    const update2 = updatePlayerGlicko2(
        { rating: t2.rating, rd: t2.rd, volatility: t2.volatility },
        [{ rating: t1.rating, rd: t1.rd, score: score2 }]
    );

    return {
        team1: {
            newRating: update1.rating,
            newRd: update1.rd,
            newVolatility: update1.volatility,
            change: update1.rating - t1.rating
        },
        team2: {
            newRating: update2.rating,
            newRd: update2.rd,
            newVolatility: update2.volatility,
            change: update2.rating - t2.rating
        }
    };
};

/**
 * Backward compatibility adapter for legacy calculateElo callers
 */
const calculateEloCompatibility = (r1, r2, score1, score2) => {
    const res = calculateMatchGlicko2(
        { rating: r1, rd: 200, volatility: 0.06 },
        { rating: r2, rd: 200, volatility: 0.06 },
        score1,
        score2
    );
    return {
        newR1: res.team1.newRating,
        newR2: res.team2.newRating,
        change1: res.team1.change,
        change2: res.team2.change
    };
};

module.exports = {
    SCALE,
    TAU,
    RATING_PERIOD_MS,
    DEFAULT_RATING,
    DEFAULT_RD,
    DEFAULT_VOLATILITY,
    toGlicko2Scale,
    toGlickoScale,
    g,
    expectedScore,
    computeNewVolatility,
    applyInactivityDecay,
    updatePlayerGlicko2,
    calculateMatchGlicko2,
    calculateEloCompatibility
};
