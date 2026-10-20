/**
 * server/utils/bwfRules.js
 * Official BWF 21-Point Rally Scoring & Rules Engine
 * Adheres to BWF Laws of Badminton (Laws 7, 8, 16)
 */

function calculateServiceCourt(score) {
    if (typeof score !== 'number' || isNaN(score) || score < 0) return 'RIGHT';
    return score % 2 === 0 ? 'RIGHT' : 'LEFT';
}

function checkGameWinner(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;

    // Golden point / ceiling rule: first to 30 points wins regardless of margin
    if (s1 >= cap) return 'team1';
    if (s2 >= cap) return 'team2';

    // Standard 2-point clear victory at or above targetScore
    if (s1 >= targetScore && (s1 - s2 >= 2)) return 'team1';
    if (s2 >= targetScore && (s2 - s1 >= 2)) return 'team2';

    return null;
}

function isDeuce(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;
    const deuceThreshold = targetScore - 1; // 20
    return s1 >= deuceThreshold && s2 >= deuceThreshold && s1 === s2 && s1 < cap - 1;
}

function isGoldenPoint(score1, score2, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;
    return s1 === cap - 1 && s2 === cap - 1; // 29 - 29
}

function getGamePoint(score1, score2, targetScore = 21, cap = 30) {
    const s1 = Number(score1) || 0;
    const s2 = Number(score2) || 0;

    if (s1 === cap - 1 && s2 === cap - 1) return 'both'; // 29-29 golden point

    const t1WinsOnNext = checkGameWinner(s1 + 1, s2, targetScore, cap) === 'team1';
    const t2WinsOnNext = checkGameWinner(s1, s2 + 1, targetScore, cap) === 'team2';

    if (t1WinsOnNext && t2WinsOnNext) return 'both';
    if (t1WinsOnNext) return 'team1';
    if (t2WinsOnNext) return 'team2';
    return null;
}

function getMatchPoint(score1, score2, gamesWon1, gamesWon2, currentGame = 1, gamesToWin = 2, targetScore = 21, cap = 30) {
    const gp = getGamePoint(score1, score2, targetScore, cap);
    if (!gp) return null;

    const t1IsMatchPoint = (gamesWon1 === gamesToWin - 1 || currentGame === 3);
    const t2IsMatchPoint = (gamesWon2 === gamesToWin - 1 || currentGame === 3);

    if (gp === 'both') {
        if (t1IsMatchPoint && t2IsMatchPoint) return 'both';
        if (t1IsMatchPoint) return 'team1';
        if (t2IsMatchPoint) return 'team2';
        return null;
    }

    if (gp === 'team1' && t1IsMatchPoint) return 'team1';
    if (gp === 'team2' && t2IsMatchPoint) return 'team2';
    return null;
}

function checkIntervalState(score1, score2, currentGame, technicalTaken = false) {
    const maxScore = Math.max(score1, score2);
    if (maxScore === 11 && !technicalTaken) {
        return {
            isInterval: true,
            intervalType: 'TECHNICAL_11',
            durationSeconds: 60,
            sideChangeRequired: currentGame === 3
        };
    }
    return {
        isInterval: false,
        intervalType: null,
        durationSeconds: 0,
        sideChangeRequired: false
    };
}

/**
 * Applies a scored point to a TournamentMatch document according to strict BWF rules.
 * Handles scoring increment, deuce detection, golden point ceiling, intervals, and Game 3 side changes.
 */
function applyBWFPoint(match, scoringTeam) {
    const currentG = match.currentGame || 1;
    let s1 = match.team1Score || 0;
    let s2 = match.team2Score || 0;

    // Guard: reject points if game or match already complete
    if (match.matchStatus === 'COMPLETED') {
        throw new Error("Match has already concluded.");
    }
    if (s1 >= 30 || s2 >= 30) {
        throw new Error("Game already concluded at 30 points ceiling.");
    }

    const previousState = {
        currentGame: currentG,
        team1Score: s1,
        team2Score: s2,
        team1GamesWon: match.team1GamesWon || 0,
        team2GamesWon: match.team2GamesWon || 0,
        servingCourt: match.servingCourt || "RIGHT",
        currentServer: match.currentServer || "",
        shuttlePossession: match.shuttlePossession || "team1",
        matchStatus: match.matchStatus || "MATCH_IN_PROGRESS",
        winner: match.winner || null,
        isGamePoint: match.isGamePoint || false,
        isMatchPoint: match.isMatchPoint || false,
        isDeuce: match.isDeuce || false,
        isGoldenPoint: match.isGoldenPoint || false,
        game3SideChanged: match.game3SideChanged || false,
        team1CourtSide: match.team1CourtSide || "LEFT",
        team2CourtSide: match.team2CourtSide || "RIGHT",
        games: JSON.parse(JSON.stringify(match.games || []))
    };

    if (scoringTeam === 'team1') {
        s1 += 1;
        match.team1Score = s1;
        match.shuttlePossession = 'team1';
        match.servingCourt = calculateServiceCourt(s1);
    } else {
        s2 += 1;
        match.team2Score = s2;
        match.shuttlePossession = 'team2';
        match.servingCourt = calculateServiceCourt(s2);
    }

    match.matchStatus = 'MATCH_IN_PROGRESS';
    match.isDeuce = isDeuce(s1, s2);
    match.isGoldenPoint = isGoldenPoint(s1, s2);

    // Check 11-point Technical Interval (Law 16.2.1)
    if (!match.intervalState) {
        match.intervalState = {
            active: false,
            type: null,
            startedAt: null,
            expiresAt: null,
            durationSeconds: 0,
            technicalTaken: new Map()
        };
    }
    const techKey = `game_${currentG}`;
    const technicalAlreadyTaken = match.intervalState.technicalTaken instanceof Map
        ? match.intervalState.technicalTaken.get(techKey)
        : match.intervalState.technicalTaken?.[techKey];

    const intervalCheck = checkIntervalState(s1, s2, currentG, Boolean(technicalAlreadyTaken));
    if (intervalCheck.isInterval) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + intervalCheck.durationSeconds * 1000);
        match.intervalState.active = true;
        match.intervalState.type = intervalCheck.intervalType;
        match.intervalState.startedAt = now;
        match.intervalState.expiresAt = expiresAt;
        match.intervalState.durationSeconds = intervalCheck.durationSeconds;

        if (match.intervalState.technicalTaken instanceof Map) {
            match.intervalState.technicalTaken.set(techKey, true);
        } else {
            match.intervalState.technicalTaken = {
                ...(match.intervalState.technicalTaken || {}),
                [techKey]: true
            };
        }

        // BWF Law 8.1.3: Game 3 Change of ends at 11 points
        if (currentG === 3 && !match.game3SideChanged) {
            match.game3SideChanged = true;
            const prevT1Side = match.team1CourtSide || 'LEFT';
            match.team1CourtSide = prevT1Side === 'LEFT' ? 'RIGHT' : 'LEFT';
            match.team2CourtSide = match.team1CourtSide === 'LEFT' ? 'RIGHT' : 'LEFT';
        }
    } else if (match.intervalState.active && match.intervalState.type === 'TECHNICAL_11') {
        // Play resumed beyond 11 points
        match.intervalState.active = false;
        match.intervalState.type = null;
    }

    // Check Game Winner
    const gameWinner = checkGameWinner(s1, s2);
    if (gameWinner) {
        if (!match.games) match.games = [];
        let gameRecord = match.games.find(g => g.gameNumber === currentG);
        if (!gameRecord) {
            gameRecord = {
                gameNumber: currentG,
                team1Score: s1,
                team2Score: s2,
                winner: gameWinner,
                isFinished: true
            };
            match.games.push(gameRecord);
        } else {
            gameRecord.team1Score = s1;
            gameRecord.team2Score = s2;
            gameRecord.winner = gameWinner;
            gameRecord.isFinished = true;
        }

        if (gameWinner === 'team1') {
            match.team1GamesWon = (match.team1GamesWon || 0) + 1;
        } else {
            match.team2GamesWon = (match.team2GamesWon || 0) + 1;
        }

        // Check Match Winner (Best of 3)
        if (match.team1GamesWon >= 2) {
            match.winner = 'team1';
            match.matchStatus = 'COMPLETED';
            match.endTime = new Date();
            match.intervalState.active = false;
            match.intervalState.type = null;
        } else if (match.team2GamesWon >= 2) {
            match.winner = 'team2';
            match.matchStatus = 'COMPLETED';
            match.endTime = new Date();
            match.intervalState.active = false;
            match.intervalState.type = null;
        } else {
            // Next Game rest interval: 120s (Law 16.2.2)
            match.currentGame = currentG + 1;
            match.team1Score = 0;
            match.team2Score = 0;
            match.servingCourt = 'RIGHT';

            // Change of ends between games (Law 8.1.1, 8.1.2)
            const prevT1Side = match.team1CourtSide || 'LEFT';
            match.team1CourtSide = prevT1Side === 'LEFT' ? 'RIGHT' : 'LEFT';
            match.team2CourtSide = match.team1CourtSide === 'LEFT' ? 'RIGHT' : 'LEFT';

            const now = new Date();
            match.intervalState.active = true;
            match.intervalState.type = 'GAME_BREAK_120';
            match.intervalState.startedAt = now;
            match.intervalState.expiresAt = new Date(now.getTime() + 120 * 1000);
            match.intervalState.durationSeconds = 120;
        }
    }

    match.isGamePoint = Boolean(getGamePoint(match.team1Score, match.team2Score));
    match.isMatchPoint = Boolean(getMatchPoint(match.team1Score, match.team2Score, match.team1GamesWon, match.team2GamesWon, match.currentGame));

    const newState = {
        currentGame: match.currentGame,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1GamesWon: match.team1GamesWon,
        team2GamesWon: match.team2GamesWon,
        servingCourt: match.servingCourt,
        currentServer: match.currentServer,
        shuttlePossession: match.shuttlePossession,
        matchStatus: match.matchStatus,
        winner: match.winner,
        isGamePoint: match.isGamePoint,
        isMatchPoint: match.isMatchPoint,
        isDeuce: match.isDeuce,
        isGoldenPoint: match.isGoldenPoint,
        game3SideChanged: match.game3SideChanged,
        team1CourtSide: match.team1CourtSide,
        team2CourtSide: match.team2CourtSide,
        intervalState: match.intervalState,
        games: JSON.parse(JSON.stringify(match.games || []))
    };

    if (!match.pointHistory) match.pointHistory = [];
    match.pointHistory.push({
        pointIndex: match.pointHistory.length + 1,
        scoringTeam,
        previousState,
        newState,
        timestamp: new Date()
    });

    return {
        match,
        previousState,
        newState,
        intervalStarted: match.intervalState?.active ? match.intervalState : null,
        sideChangeRequired: intervalCheck.sideChangeRequired
    };
}

module.exports = {
    calculateServiceCourt,
    checkGameWinner,
    isDeuce,
    isGoldenPoint,
    getGamePoint,
    getMatchPoint,
    checkIntervalState,
    applyBWFPoint
};
