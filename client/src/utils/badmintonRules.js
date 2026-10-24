/**
 * BWF Official Badminton Scoring and Rules Engine
 * Implements 3x21 Rally Point System with 2-point clear margin (cap at 30)
 * and correct service court positioning.
 */

/**
 * Calculates service court based on player/team score.
 * Even score (0, 2, 4...) -> Right service court
 * Odd score (1, 3, 5...) -> Left service court
 * 
 * @param {number} score 
 * @returns {'right' | 'left'}
 */
export function calculateServiceCourt(score) {
    if (typeof score !== 'number' || isNaN(score) || score < 0) return 'right';
    return score % 2 === 0 ? 'right' : 'left';
}

/**
 * Checks if current score state is at Deuce.
 * Deuce occurs when both sides reach 20 points (or any tied score >= 20 below 29).
 */
export function isDeuce(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;
    const deuceThreshold = targetScore - 1; // 20
    return s1 >= deuceThreshold && s2 >= deuceThreshold && s1 === s2 && s1 < cap - 1;
}

/**
 * Checks if a game winner has been determined.
 * A side wins when:
 * 1. Score >= 21 and leads by >= 2 points
 * 2. Score reaches 30 (sudden death cap)
 * 
 * @returns {1 | 2 | null} Winner index (1 or 2), or null if game is ongoing
 */
export function checkGameWinner(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;

    if (s1 >= cap) return 1;
    if (s2 >= cap) return 2;

    if (s1 >= targetScore && s1 - s2 >= 2) return 1;
    if (s2 >= targetScore && s2 - s1 >= 2) return 2;

    return null;
}

/**
 * Checks if a player is at Game Point (1 point away from winning the current game).
 * 
 * @returns {1 | 2 | null} 1 if team 1 is at game point, 2 if team 2, null otherwise
 */
export function getGamePoint(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;

    const t1CanWin = checkGameWinner(s1 + 1, s2, targetScore, cap) === 1;
    const t2CanWin = checkGameWinner(s1, s2 + 1, targetScore, cap) === 2;

    if (t1CanWin && t2CanWin) return 3; // Both players at golden game point (e.g. at 29-29)
    if (t1CanWin) return 1;
    if (t2CanWin) return 2;

    return null;
}

/**
 * Checks if a player is at Match Point (1 point away from winning the deciding game).
 * 
 * @param {number} score1 
 * @param {number} score2 
 * @param {number} gamesWon1 
 * @param {number} gamesWon2 
 * @param {number} gamesToWin 
 * @returns {1 | 2 | 3 | null} 1/2 for single team, 3 for both (golden match point), null otherwise
 */
export function getMatchPoint(score1, score2, gamesWon1, gamesWon2, gamesToWin = 2, targetScore = 21, cap = 30) {
    const gp = getGamePoint(score1, score2, targetScore, cap);
    if (!gp) return null;

    const t1AtMatchPoint = (gp === 1 || gp === 3) && gamesWon1 === gamesToWin - 1;
    const t2AtMatchPoint = (gp === 2 || gp === 3) && gamesWon2 === gamesToWin - 1;

    if (t1AtMatchPoint && t2AtMatchPoint) return 3; // Both at golden match point
    if (t1AtMatchPoint) return 1;
    if (t2AtMatchPoint) return 2;

    return null;
}

/**
 * Checks if mid-game 60s interval is reached (first side to 11 points).
 */
export function isInterval(score1, score2, intervalThreshold = 11) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;
    return (s1 === intervalThreshold && s2 < intervalThreshold) || 
           (s2 === intervalThreshold && s1 < intervalThreshold);
}

/**
 * Dynamic Round Robin Standings Calculator
 * Computes: Played, Won, Lost, Sets W-L, Points For, Points Against, Diff
 * 
 * @param {Array<string>} teams List of team/player names
 * @param {Array<Object>} matches List of matches with { team1, team2, score1, score2, sets1, sets2, winner }
 * @returns {Array<Object>} Sorted standings according to BWF GCR 16.2.2
 */
export function calculateRoundRobinStandings(teams, matches = []) {
    const table = {};

    teams.forEach(team => {
        table[team] = {
            team,
            played: 0,
            won: 0,
            lost: 0,
            setsWon: 0,
            setsLost: 0,
            setDiff: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            pointDiff: 0,
            rank: 1,
        };
    });

    matches.forEach(m => {
        if (!m || !m.team1 || !m.team2 || !table[m.team1] || !table[m.team2]) return;
        if (m.status !== 'COMPLETED' && !m.winner) return;

        const t1 = table[m.team1];
        const t2 = table[m.team2];

        t1.played += 1;
        t2.played += 1;

        if (m.winner === m.team1) {
            t1.won += 1;
            t2.lost += 1;
        } else if (m.winner === m.team2) {
            t2.won += 1;
            t1.lost += 1;
        }

        const sets1 = Number(m.sets1) || 0;
        const sets2 = Number(m.sets2) || 0;
        t1.setsWon += sets1;
        t1.setsLost += sets2;
        t2.setsWon += sets2;
        t2.setsLost += sets1;

        const pts1 = Number(m.points1 !== undefined ? m.points1 : m.score1) || 0;
        const pts2 = Number(m.points2 !== undefined ? m.points2 : m.score2) || 0;
        t1.pointsFor += pts1;
        t1.pointsAgainst += pts2;
        t2.pointsFor += pts2;
        t2.pointsAgainst += pts1;
    });

    const list = Object.values(table).map(t => ({
        ...t,
        setDiff: (t.setsWon || 0) - (t.setsLost || 0),
        pointDiff: t.pointsFor - t.pointsAgainst,
    }));

    // BWF GCR 16.2.2 sorting priority:
    // 1. Matches Won (descending)
    // 2. Set (Game) Differential (descending)
    // 3. Point Differential (descending)
    // 4. Points For (descending)
    list.sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return b.pointsFor - a.pointsFor;
    });

    list.forEach((entry, idx) => {
        if (idx > 0) {
            const prev = list[idx - 1];
            if (
                entry.won === prev.won &&
                entry.setDiff === prev.setDiff &&
                entry.pointDiff === prev.pointDiff &&
                entry.pointsFor === prev.pointsFor
            ) {
                entry.rank = prev.rank;
            } else {
                entry.rank = idx + 1;
            }
        } else {
            entry.rank = 1;
        }
    });

    return list;
}
