/**
 * Tournament bracket mock models, draw generator, and geometric layout helpers.
 * Fully supports Single Elimination, Double Elimination, and Round Robin.
 */

export const SAMPLE_TOURNAMENTS = [
    { id: 'gmu-open-2026', name: '2026 GMU Badminton Open (Championship Draw)', division: "Men's Singles Open" },
    { id: 'mid-atlantic-2026', name: 'Mid-Atlantic Collegiate Championships', division: 'Championship Flight' },
    { id: 'nvbc-spring-2026', name: 'NVBC Spring Open 2026', division: 'Open Singles' }
];

export const SAMPLE_SINGLE_ELIMINATION = {
    id: 'draw-se-gmu',
    tournamentName: '2026 GMU Badminton Open',
    division: "Men's Singles Open (Draw of 8)",
    format: 'SINGLE_ELIMINATION',
    rounds: [
        {
            id: 'r1',
            name: 'Quarterfinals',
            matches: [
                {
                    id: 'm-qf-1',
                    roundIndex: 0,
                    matchIndex: 0,
                    team1: { seed: 1, name: 'Alan Yang (GMU)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 8, name: 'David Nguyen (VT)', score: 0, sets: [14, 16], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 1',
                    winner: 'Alan Yang (GMU)'
                },
                {
                    id: 'm-qf-2',
                    roundIndex: 0,
                    matchIndex: 1,
                    team1: { seed: 4, name: 'Kevin Lin (UMD)', score: 2, sets: [21, 19, 21], isWinner: true },
                    team2: { seed: 5, name: 'Brian Zhao (UVA)', score: 1, sets: [17, 21, 18], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 2',
                    winner: 'Kevin Lin (UMD)'
                },
                {
                    id: 'm-qf-3',
                    roundIndex: 0,
                    matchIndex: 2,
                    team1: { seed: 3, name: 'Marcus Chen (GMU)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 6, name: 'Eric Song (Hopkins)', score: 0, sets: [15, 12], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 3',
                    winner: 'Marcus Chen (GMU)'
                },
                {
                    id: 'm-qf-4',
                    roundIndex: 0,
                    matchIndex: 3,
                    team1: { seed: 2, name: 'Alex Tran (JHU)', score: 2, sets: [21, 22], isWinner: true },
                    team2: { seed: 7, name: 'Jason Wu (GWU)', score: 0, sets: [18, 20], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 4',
                    winner: 'Alex Tran (JHU)'
                }
            ]
        },
        {
            id: 'r2',
            name: 'Semifinals',
            matches: [
                {
                    id: 'm-sf-1',
                    roundIndex: 1,
                    matchIndex: 0,
                    team1: { seed: 1, name: 'Alan Yang (GMU)', score: 1, sets: [21, 18, 14], isWinner: false },
                    team2: { seed: 4, name: 'Kevin Lin (UMD)', score: 2, sets: [17, 21, 21], isWinner: true },
                    status: 'COMPLETED',
                    court: 'RAC Court 1',
                    winner: 'Kevin Lin (UMD)'
                },
                {
                    id: 'm-sf-2',
                    roundIndex: 1,
                    matchIndex: 1,
                    team1: { seed: 3, name: 'Marcus Chen (GMU)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 2, name: 'Alex Tran (JHU)', score: 0, sets: [19, 18], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 2',
                    winner: 'Marcus Chen (GMU)'
                }
            ]
        },
        {
            id: 'r3',
            name: 'Grand Championship Final',
            matches: [
                {
                    id: 'm-fn-1',
                    roundIndex: 2,
                    matchIndex: 0,
                    team1: { seed: 4, name: 'Kevin Lin (UMD)', score: 1, sets: [21, 18, 16], isWinner: false },
                    team2: { seed: 3, name: 'Marcus Chen (GMU)', score: 2, sets: [18, 21, 21], isWinner: true },
                    status: 'COMPLETED',
                    court: 'RAC Court 1 (Championship Mat)',
                    winner: 'Marcus Chen (GMU)',
                    isChampion: true
                }
            ]
        }
    ]
};

export const SAMPLE_DOUBLE_ELIMINATION = {
    id: 'draw-de-gmu',
    tournamentName: '2026 GMU Badminton Open',
    division: "Men's Open Double Elimination",
    format: 'DOUBLE_ELIMINATION',
    winnersRounds: [
        {
            id: 'wr-1',
            name: 'Winners Semifinals',
            matches: [
                {
                    id: 'm-wsf-1',
                    roundIndex: 0,
                    matchIndex: 0,
                    team1: { seed: 1, name: 'Alan Yang (GMU)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 4, name: 'Kevin Lin (UMD)', score: 0, sets: [17, 19], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 1',
                    winner: 'Alan Yang (GMU)'
                },
                {
                    id: 'm-wsf-2',
                    roundIndex: 0,
                    matchIndex: 1,
                    team1: { seed: 3, name: 'Marcus Chen (GMU)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 2, name: 'Alex Tran (JHU)', score: 0, sets: [18, 14], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 2',
                    winner: 'Marcus Chen (GMU)'
                }
            ]
        },
        {
            id: 'wr-2',
            name: 'Winners Final',
            matches: [
                {
                    id: 'm-wf-1',
                    roundIndex: 1,
                    matchIndex: 0,
                    team1: { seed: 1, name: 'Alan Yang (GMU)', score: 2, sets: [21, 19, 21], isWinner: true },
                    team2: { seed: 3, name: 'Marcus Chen (GMU)', score: 1, sets: [18, 21, 17], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 1',
                    winner: 'Alan Yang (GMU)'
                }
            ]
        }
    ],
    losersRounds: [
        {
            id: 'lr-1',
            name: 'Losers Round 1',
            matches: [
                {
                    id: 'm-lr1-1',
                    roundIndex: 0,
                    matchIndex: 0,
                    team1: { seed: 4, name: 'Kevin Lin (UMD)', score: 2, sets: [21, 21], isWinner: true },
                    team2: { seed: 2, name: 'Alex Tran (JHU)', score: 0, sets: [16, 17], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 3',
                    winner: 'Kevin Lin (UMD)'
                }
            ]
        },
        {
            id: 'lr-2',
            name: 'Losers Final',
            matches: [
                {
                    id: 'm-lf-1',
                    roundIndex: 1,
                    matchIndex: 0,
                    team1: { seed: 3, name: 'Marcus Chen (GMU)', score: 2, sets: [21, 23], isWinner: true },
                    team2: { seed: 4, name: 'Kevin Lin (UMD)', score: 0, sets: [19, 21], isWinner: false },
                    status: 'COMPLETED',
                    court: 'RAC Court 2',
                    winner: 'Marcus Chen (GMU)'
                }
            ]
        }
    ],
    grandFinals: {
        id: 'gfr-1',
        name: 'Grand Finals (Championship)',
        matches: [
            {
                id: 'm-gf-1',
                roundIndex: 0,
                matchIndex: 0,
                team1: { seed: 1, name: 'Alan Yang (Winners Champ)', score: 2, sets: [21, 18, 21], isWinner: true },
                team2: { seed: 3, name: 'Marcus Chen (Losers Champ)', score: 1, sets: [17, 21, 19], isWinner: false },
                status: 'COMPLETED',
                court: 'RAC Court 1',
                winner: 'Alan Yang (Winners Champ)',
                isChampion: true
            }
        ]
    }
};

export const SAMPLE_ROUND_ROBIN = {
    id: 'draw-rr-gmu',
    tournamentName: '2026 GMU Badminton Open',
    division: 'Pool A - Collegiate Open Singles',
    format: 'ROUND_ROBIN',
    teams: ['Marcus Chen (GMU)', 'Kevin Lin (UMD)', 'David Nguyen (VT)', 'Brian Zhao (UVA)'],
    matches: [
        {
            id: 'rr-m1',
            team1: 'Marcus Chen (GMU)',
            team2: 'Kevin Lin (UMD)',
            score1: 42,
            score2: 37,
            sets1: 2,
            sets2: 0,
            scoreSummary: '21-18, 21-19',
            status: 'COMPLETED',
            winner: 'Marcus Chen (GMU)'
        },
        {
            id: 'rr-m2',
            team1: 'Marcus Chen (GMU)',
            team2: 'David Nguyen (VT)',
            score1: 42,
            score2: 29,
            sets1: 2,
            sets2: 0,
            scoreSummary: '21-14, 21-15',
            status: 'COMPLETED',
            winner: 'Marcus Chen (GMU)'
        },
        {
            id: 'rr-m3',
            team1: 'Marcus Chen (GMU)',
            team2: 'Brian Zhao (UVA)',
            score1: 42,
            score2: 31,
            sets1: 2,
            sets2: 0,
            scoreSummary: '21-16, 21-15',
            status: 'COMPLETED',
            winner: 'Marcus Chen (GMU)'
        },
        {
            id: 'rr-m4',
            team1: 'Kevin Lin (UMD)',
            team2: 'David Nguyen (VT)',
            score1: 42,
            score2: 35,
            sets1: 2,
            sets2: 0,
            scoreSummary: '21-18, 21-17',
            status: 'COMPLETED',
            winner: 'Kevin Lin (UMD)'
        },
        {
            id: 'rr-m5',
            team1: 'Kevin Lin (UMD)',
            team2: 'Brian Zhao (UVA)',
            score1: 42,
            score2: 38,
            sets1: 2,
            sets2: 0,
            scoreSummary: '21-19, 21-19',
            status: 'COMPLETED',
            winner: 'Kevin Lin (UMD)'
        },
        {
            id: 'rr-m6',
            team1: 'David Nguyen (VT)',
            team2: 'Brian Zhao (UVA)',
            score1: 42,
            score2: 39,
            sets1: 2,
            sets2: 1,
            scoreSummary: '21-19, 18-21, 21-19',
            status: 'COMPLETED',
            winner: 'David Nguyen (VT)'
        }
    ]
};

/**
 * Computes exact 2D coordinates for single-elimination rounds using geometric vertical midpoint routing.
 * Avoids any node collision by centering each child match directly between its feeder parent matches.
 */
export function computeBracketLayout(rounds, config = { cardWidth: 240, cardHeight: 96, xGap: 70, yGap: 36 }) {
    const { cardWidth, cardHeight, xGap, yGap } = config;
    const positions = {}; // matchId -> { x, y, width, height, centerX, centerY }
    const connectors = []; // Array of SVG path commands

    if (!rounds || rounds.length === 0) return { positions, connectors, totalWidth: 400, totalHeight: 400 };

    // Calculate Y for Round 0 (Feeder / base round)
    const baseMatches = rounds[0].matches || [];
    baseMatches.forEach((match, idx) => {
        const x = 20;
        const y = 30 + idx * (cardHeight + yGap);
        positions[match.id] = {
            x,
            y,
            width: cardWidth,
            height: cardHeight,
            rightX: x + cardWidth,
            leftX: x,
            centerY: y + cardHeight / 2
        };
    });

    // Compute Subsequent Rounds Y as midpoints of feeder matches
    for (let r = 1; r < rounds.length; r++) {
        const round = rounds[r];
        const prevRound = rounds[r - 1];
        const x = 20 + r * (cardWidth + xGap);

        (round.matches || []).forEach((match, mIdx) => {
            // Feeder 1 and Feeder 2 from previous round
            const feeder1 = prevRound.matches[mIdx * 2];
            const feeder2 = prevRound.matches[mIdx * 2 + 1];

            let centerY;
            if (feeder1 && feeder2 && positions[feeder1.id] && positions[feeder2.id]) {
                centerY = (positions[feeder1.id].centerY + positions[feeder2.id].centerY) / 2;
            } else if (feeder1 && positions[feeder1.id]) {
                centerY = positions[feeder1.id].centerY;
            } else {
                centerY = 30 + mIdx * (cardHeight + yGap * 2) + cardHeight / 2;
            }

            const y = centerY - cardHeight / 2;
            positions[match.id] = {
                x,
                y,
                width: cardWidth,
                height: cardHeight,
                rightX: x + cardWidth,
                leftX: x,
                centerY
            };

            // Generate orthogonal midpoint SVG connector paths from feeder 1 & 2 to current match
            [feeder1, feeder2].forEach(feeder => {
                if (!feeder || !positions[feeder.id]) return;
                const fPos = positions[feeder.id];
                const startX = fPos.rightX;
                const startY = fPos.centerY;
                const endX = x;
                const endY = centerY;
                const midX = startX + (endX - startX) / 2;

                const pathData = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
                connectors.push({
                    id: `conn-${feeder.id}-to-${match.id}`,
                    path: pathData,
                    isActive: match.status === 'COMPLETED' || match.status === 'IN_PROGRESS',
                    isWinnerPath: feeder.winner && (match.team1?.name === feeder.winner || match.team2?.name === feeder.winner)
                });
            });
        });
    }

    // Determine total dimensions
    let maxX = 0;
    let maxY = 0;
    Object.values(positions).forEach(pos => {
        if (pos.rightX > maxX) maxX = pos.rightX;
        if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
    });

    return {
        positions,
        connectors,
        totalWidth: Math.max(maxX + 60, 600),
        totalHeight: Math.max(maxY + 60, 450)
    };
}
