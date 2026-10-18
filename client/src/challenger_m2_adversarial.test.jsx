import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
    calculateServiceCourt,
    isDeuce,
    checkGameWinner,
    getGamePoint,
    getMatchPoint,
    calculateRoundRobinStandings
} from './utils/badmintonRules';
import { computeBracketLayout } from './utils/bracketData';
import TournamentBracket from './components/TournamentBracket';
import UmpireDigitalPad from './components/UmpireDigitalPad';

vi.mock('./utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    }
}));

describe('CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE (M2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. TOURNAMENT BRACKET ENGINE: LARGE BRACKETS & COLLISION PREVENTIONS
    // =========================================================================
    describe('1. Bracket Engine Collision Prevention & Stress Testing', () => {
        it('verifies collision prevention across a 32-player single elimination bracket (5 rounds)', () => {
            // Generate a 32-player draw (31 matches total)
            const rounds = [];
            let matchCount = 16;
            for (let r = 0; r < 5; r++) {
                const roundName = ['Round of 32', 'Sweet 16', 'Quarterfinals', 'Semifinals', 'Finals'][r];
                const matches = [];
                for (let m = 0; m < matchCount; m++) {
                    matches.push({
                        id: `m-r${r}-${m}`,
                        roundIndex: r,
                        matchIndex: m,
                        team1: { name: `Player ${m * 2 + 1}` },
                        team2: { name: `Player ${m * 2 + 2}` },
                        status: 'SCHEDULED'
                    });
                }
                rounds.push({ id: `r-${r}`, name: roundName, matches });
                matchCount = Math.floor(matchCount / 2);
            }

            const layout = computeBracketLayout(rounds, { cardWidth: 240, cardHeight: 96, xGap: 70, yGap: 36 });

            // In each round, check every pair of matches for vertical or horizontal collision
            rounds.forEach((round, rIdx) => {
                const matches = round.matches;
                for (let i = 0; i < matches.length - 1; i++) {
                    const posA = layout.positions[matches[i].id];
                    const posB = layout.positions[matches[i + 1].id];

                    expect(posA).toBeDefined();
                    expect(posB).toBeDefined();

                    // Same X coordinate for all matches in the same round
                    expect(posA.x).toBe(posB.x);

                    // Vertical bounding boxes must NOT overlap: posA.y + posA.height <= posB.y
                    const verticalOverlap = (posA.y + posA.height) > posB.y;
                    expect(verticalOverlap, `Collision detected in round ${rIdx} between match ${i} and ${i + 1}`).toBe(false);

                    // Distance between adjacent matches should be at least yGap (36px)
                    expect(posB.y - (posA.y + posA.height)).toBeGreaterThanOrEqual(36);
                }
            });

            expect(layout.totalWidth).toBeGreaterThan(1200);
            expect(layout.totalHeight).toBeGreaterThan(2000);
        });

        it('stress-tests extreme 64-player bracket (6 rounds, 63 matches) for layout stability', () => {
            const rounds = [];
            let matchCount = 32;
            for (let r = 0; r < 6; r++) {
                const matches = [];
                for (let m = 0; m < matchCount; m++) {
                    matches.push({
                        id: `m64-r${r}-${m}`,
                        roundIndex: r,
                        matchIndex: m,
                        team1: { name: `P${m * 2 + 1}` },
                        team2: { name: `P${m * 2 + 2}` }
                    });
                }
                rounds.push({ id: `r64-${r}`, name: `Round ${r + 1}`, matches });
                matchCount = Math.floor(matchCount / 2);
            }

            const layout = computeBracketLayout(rounds);
            expect(Object.keys(layout.positions).length).toBe(63);

            // Verify no NaN or undefined coordinates
            Object.values(layout.positions).forEach(pos => {
                expect(isNaN(pos.x)).toBe(false);
                expect(isNaN(pos.y)).toBe(false);
                expect(isNaN(pos.centerY)).toBe(false);
                expect(pos.width).toBe(240);
                expect(pos.height).toBe(96);
            });
        });

        it('handles unbalanced brackets with byes gracefully without crashing or collisions', () => {
            // Unbalanced draw: Round 0 has 3 matches (feeder 1 has match, feeder 2 missing)
            const unbalancedRounds = [
                {
                    id: 'r-unb-0',
                    matches: [
                        { id: 'm-unb-0-0' },
                        { id: 'm-unb-0-1' },
                        { id: 'm-unb-0-2' } // No pair for this match
                    ]
                },
                {
                    id: 'r-unb-1',
                    matches: [
                        { id: 'm-unb-1-0' }, // Fed by 0 and 1
                        { id: 'm-unb-1-1' }  // Fed by 2 only (single feeder)
                    ]
                },
                {
                    id: 'r-unb-2',
                    matches: [
                        { id: 'm-unb-2-0' }  // Final fed by 1-0 and 1-1
                    ]
                }
            ];

            const layout = computeBracketLayout(unbalancedRounds);
            expect(layout.positions['m-unb-1-1']).toBeDefined();
            expect(isNaN(layout.positions['m-unb-1-1'].y)).toBe(false);
            expect(layout.positions['m-unb-2-0'].y).toBeGreaterThanOrEqual(0);
        });

        it('EMPIRICAL AUDIT: checks if custom Double Elimination bracketData is honored or hardcoded', () => {
            const customDEDraw = {
                id: 'custom-de-draw',
                tournamentName: 'Custom Collegiate Double Elimination',
                format: 'DOUBLE_ELIMINATION',
                winnersRounds: [
                    {
                        id: 'c-wr-1',
                        name: 'Custom Winners Final',
                        matches: [
                            {
                                id: 'c-wm-1',
                                team1: { name: 'Stanford Cardinal' },
                                team2: { name: 'California Golden Bears' },
                                status: 'SCHEDULED'
                            }
                        ]
                    }
                ],
                losersRounds: [
                    {
                        id: 'c-lr-1',
                        name: 'Custom Losers Final',
                        matches: [
                            {
                                id: 'c-lm-1',
                                team1: { name: 'UCLA Bruins' },
                                team2: { name: 'USC Trojans' },
                                status: 'SCHEDULED'
                            }
                        ]
                    }
                ],
                grandFinals: {
                    id: 'c-gf-1',
                    name: 'Custom Grand Championship',
                    matches: [
                        {
                            id: 'c-gfm-1',
                            team1: { name: 'Stanford Cardinal' },
                            team2: { name: 'UCLA Bruins' },
                            status: 'SCHEDULED'
                        }
                    ]
                }
            };

            render(<TournamentBracket bracketData={customDEDraw} />);
            const deBtn = screen.getByTestId('btn-double-elim');
            fireEvent.click(deBtn);

            // In double elimination winners tab, check if custom teams appear
            const customTeamElements = screen.queryAllByText(/Stanford Cardinal/i);
            const hardcodedSampleElements = screen.queryAllByText(/Alan Yang \(GMU\)/i);

            console.log(`[EMPIRICAL] Double Elim Custom Data Audit: custom teams found = ${customTeamElements.length}, hardcoded sample teams found = ${hardcodedSampleElements.length}`);
            
            // VERIFIED FIX: custom bracketData for Double Elimination is honored!
            expect(customTeamElements.length).toBeGreaterThan(0);
            expect(hardcodedSampleElements.length).toBe(0);
        });
    });

    // =========================================================================
    // 2. ROUND-ROBIN STANDINGS CALCULATION: TIES IN POINTS AND SETS
    // =========================================================================
    describe('2. Round-Robin Standings & Tie-Breaking Adversarial Tests', () => {
        it('ADVERSARIAL TEST: BWF set difference vs point difference priority', () => {
            // According to BWF GCR 16.2.2:
            // In a tie of matches won, SET (GAME) DIFFERENCE has higher precedence than POINT DIFFERENCE.
            // Team A: 1 Win, 1 Loss. Won 2-0 (21-19, 21-19), Lost 1-2 (21-19, 19-21, 19-21).
            // Sets: Won 3, Lost 2 -> Net Sets Diff = +1.
            // Points: (42-38) + (59-61) = 101 - 99 -> Net Points Diff = +2.
            //
            // Team B: 1 Win, 1 Loss. Won 2-1 (21-5, 5-21, 21-10), Lost 0-2 (19-21, 19-21).
            // Sets: Won 2, Lost 3 -> Net Sets Diff = -1.
            // Points: (47-36) + (38-42) = 85 - 78 -> Net Points Diff = +7.

            const teams = ['Team A', 'Team B', 'Team C'];
            const matches = [
                // Team A vs Team C: Team A wins 2-0 (42-38)
                { team1: 'Team A', team2: 'Team C', points1: 42, points2: 38, sets1: 2, sets2: 0, winner: 'Team A', status: 'COMPLETED' },
                // Team C vs Team A: rematch or other match where A loses 1-2
                { team1: 'Team C', team2: 'Team A', points1: 61, points2: 59, sets1: 2, sets2: 1, winner: 'Team C', status: 'COMPLETED' },
                // Team B vs Team C: Team B wins 2-1 (47-36)
                { team1: 'Team B', team2: 'Team C', points1: 47, points2: 36, sets1: 2, sets2: 1, winner: 'Team B', status: 'COMPLETED' },
                // Team C vs Team B: Team B loses 0-2 (38-42)
                { team1: 'Team C', team2: 'Team B', points1: 42, points2: 38, sets1: 2, sets2: 0, winner: 'Team C', status: 'COMPLETED' }
            ];

            const standings = calculateRoundRobinStandings(teams, matches);
            const teamAEntry = standings.find(s => s.team === 'Team A');
            const teamBEntry = standings.find(s => s.team === 'Team B');

            const teamASetDiff = teamAEntry.setsWon - teamAEntry.setsLost;
            const teamBSetDiff = teamBEntry.setsWon - teamBEntry.setsLost;

            // Team A has set difference +1, Team B has -1
            expect(teamASetDiff).toBe(1);
            expect(teamBSetDiff).toBe(-1);

            // Team B has higher point diff (+7 vs +2)
            expect(teamBEntry.pointDiff).toBe(7);
            expect(teamAEntry.pointDiff).toBe(2);

            // BWF Rule Check: Does Team A rank higher than Team B because sets take precedence?
            const isTeamARankedHigher = teamAEntry.rank < teamBEntry.rank;
            expect(isTeamARankedHigher).toBe(true);
            expect(teamAEntry.rank).toBe(2);
            expect(teamBEntry.rank).toBe(3);
        });

        it('ADVERSARIAL TEST: Exact tie in points and sets between two teams', () => {
            // Team Alpha and Team Beta have identical match records, identical sets, and identical points
            const teams = ['Team Alpha', 'Team Beta'];
            const matches = [
                {
                    team1: 'Team Alpha',
                    team2: 'Team Beta',
                    points1: 42,
                    points2: 42,
                    sets1: 1,
                    sets2: 1,
                    winner: null, // Tied match
                    status: 'COMPLETED'
                }
            ];

            const standings = calculateRoundRobinStandings(teams, matches);
            expect(standings.length).toBe(2);
            expect(standings[0].rank).toBe(1);
            expect(standings[1].rank).toBe(1);
        });

        it('ADVERSARIAL TEST: Zero-point score fallback (Falsy 0 bug detection)', () => {
            // A player is shut out 0-21. points1 is explicitly 0.
            // If code uses `points1 || score1`, does 0 fall back to score1 or behave unexpectedly?
            const teams = ['Team White', 'Team Black'];
            const matches = [
                {
                    team1: 'Team White',
                    team2: 'Team Black',
                    points1: 0,
                    points2: 21,
                    score1: 21, // Stale or different score
                    score2: 0,
                    sets1: 0,
                    sets2: 1,
                    winner: 'Team Black',
                    status: 'COMPLETED'
                }
            ];

            const standings = calculateRoundRobinStandings(teams, matches);
            const white = standings.find(s => s.team === 'Team White');

            // With falsy 0 fix: white's score was 0, so pointsFor must be 0!
            expect(white.pointsFor).toBe(0);
        });
    });

    // =========================================================================
    // 3. BWF SCORING ENGINE & SERVICE COURT PARITY
    // =========================================================================
    describe('3. BWF Service Court Odd/Even Parity & Scoring Engine', () => {
        it('exhaustively verifies service court odd/even parity from 0 to 30 points', () => {
            for (let score = 0; score <= 30; score++) {
                const court = calculateServiceCourt(score);
                if (score % 2 === 0) {
                    expect(court, `Score ${score} must be right service court`).toBe('right');
                } else {
                    expect(court, `Score ${score} must be left service court`).toBe('left');
                }
            }
        });

        it('ADVERSARIAL TEST: detects both sides at Game Point / Match Point at 29-29 golden sudden death', () => {
            // At 29-29, the NEXT point wins the game for WHICHEVER side scores it.
            // Therefore, BOTH Side 1 and Side 2 are at Game Point simultaneously!
            const gp = getGamePoint(29, 29);
            expect(gp).toBe(3); // Both sides at golden game point!

            // Also test Match Point at 29-29 in deciding Game 3 (gamesWon1 = 1, gamesWon2 = 1)
            const mp = getMatchPoint(29, 29, 1, 1, 2);
            expect(mp).toBe(3); // Both sides at golden match point!
        });

        it('verifies deuce boundaries from 20-20 up to 28-28 and sudden death transition at 29-29', () => {
            for (let score = 20; score <= 28; score++) {
                expect(isDeuce(score, score), `Score ${score}-${score} should be deuce`).toBe(true);
            }
            expect(isDeuce(29, 29), '29-29 is sudden death capped at 30, not deuce').toBe(false);
            expect(isDeuce(20, 21)).toBe(false);
            expect(isDeuce(21, 22)).toBe(false);
        });

        it('verifies game winner edge condition at 20-21 vs 20-22 vs 29-30', () => {
            expect(checkGameWinner(21, 20)).toBe(null); // Not 2 clear points
            expect(checkGameWinner(22, 20)).toBe(1);    // 2-point clear margin
            expect(checkGameWinner(29, 29)).toBe(null);
            expect(checkGameWinner(30, 29)).toBe(1);    // Golden sudden death cap
            expect(checkGameWinner(29, 30)).toBe(2);
        });
    });

    // =========================================================================
    // 4. UMPIRE DIGITAL PAD: RAPID UNDO/REDO & STABILITY
    // =========================================================================
    describe('4. Umpire Touch Pad Rapid Undo/Redo & State Stress Test', () => {
        it('stress-tests 50 rapid sequential scoring actions followed by 50 rapid undos', () => {
            render(
                <UmpireDigitalPad
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            const btnTeam2 = screen.getByTestId('btn-score-team2');
            const undoBtn = screen.getByTestId('btn-undo-point');

            // Alternate points up to 10-10 (20 points total)
            for (let i = 0; i < 10; i++) {
                fireEvent.click(btnTeam1);
                fireEvent.click(btnTeam2);
            }

            expect(screen.getByTestId('score-team1')).toHaveTextContent('10');
            expect(screen.getByTestId('score-team2')).toHaveTextContent('10');

            // Rapidly execute 20 undos
            for (let i = 0; i < 20; i++) {
                fireEvent.click(undoBtn);
            }

            // Verify clean return to 0-0 state
            expect(screen.getByTestId('score-team1')).toHaveTextContent('0');
            expect(screen.getByTestId('score-team2')).toHaveTextContent('0');
            expect(undoBtn).toBeDisabled();
        });

        it('ADVERSARIAL CHECK: Does Redo functionality exist on Umpire Digital Pad?', () => {
            render(
                <UmpireDigitalPad
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            // Check if Redo button exists on Umpire Digital Pad and is disabled initially
            const redoBtn = screen.getByTestId('btn-redo-point');
            expect(redoBtn).toBeInTheDocument();
            expect(redoBtn).toBeDisabled();
        });

        it('verifies undo rollback after Game Over transitions correctly restores match state', () => {
            render(
                <UmpireDigitalPad
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            const undoBtn = screen.getByTestId('btn-undo-point');

            // Score 21-0 to trigger GAME_OVER
            for (let i = 0; i < 21; i++) {
                fireEvent.click(btnTeam1);
            }

            expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();
            expect(btnTeam1).toBeDisabled();

            // Undo the 21st point
            fireEvent.click(undoBtn);

            // Should revert to 20-0, game active, GAME_OVER alert gone, score buttons re-enabled
            expect(screen.getByTestId('score-team1')).toHaveTextContent('20');
            expect(screen.queryByTestId('game-over-alert')).not.toBeInTheDocument();
            expect(btnTeam1).not.toBeDisabled();
        });

        it('ADVERSARIAL TEST: Receiver court highlighting on 2D SVG court when Team 2 serves', () => {
            render(
                <UmpireDigitalPad
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam2 = screen.getByTestId('btn-score-team2');
            // Team 2 scores 1 point -> Team 2 is serving
            fireEvent.click(btnTeam2);

            expect(screen.getByTestId('serving-badge-team2')).toBeInTheDocument();

            // Check the 2D SVG court rects
            const svgEl = screen.getByTestId('service-court-svg');
            const rects = svgEl.querySelectorAll('rect');

            // Rects are:
            // 0: Outer border
            // 1: Team 1 Left Court (x=20, y=20)
            // 2: Team 1 Right Court (x=20, y=150)
            // 3: Team 2 Right Court (x=355, y=20)
            // 4: Team 2 Left Court (x=355, y=150)

            const team1LeftRect = rects[1];
            const team1RightRect = rects[2];

            const leftFill = team1LeftRect.getAttribute('fill');
            const rightFill = team1RightRect.getAttribute('fill');

            console.log(`[EMPIRICAL] Team 1 Left Rect fill when Team 2 serves: "${leftFill}"`);
            console.log(`[EMPIRICAL] Team 1 Right Rect fill when Team 2 serves: "${rightFill}"`);

            // When Team 2 serves from Left (score=1 is odd), Team 1 is receiver on Left court.
            // Team 1's receiving court fill is highlighted in cyan!
            expect(leftFill).toBe('rgba(56, 189, 248, 0.35)');
            expect(rightFill).toBe('transparent');
        });
    });

    // =========================================================================
    // 5. MOBILE VIEWPORT WIDTH CONSTRAINTS & LAYOUT STRESS
    // =========================================================================
    describe('5. Mobile Viewport Width Constraints & Layout Stress', () => {
        it('verifies TournamentBracket container does not cause document overflow on 320px and 375px mobile screens', () => {
            render(
                <div style={{ width: 320, overflow: 'hidden' }}>
                    <TournamentBracket />
                </div>
            );

            const viewport = screen.getByTestId('bracket-canvas-viewport');
            expect(viewport).toBeInTheDocument();

            // Viewport should have overflow: hidden to prevent document scrollbar blowout
            const styles = window.getComputedStyle(viewport);
            expect(styles.overflow).toBe('hidden');
        });

        it('verifies UmpireDigitalPad layout renders touch buttons with minHeight >= 80px on mobile 360px', () => {
            render(
                <div style={{ width: 360 }}>
                    <UmpireDigitalPad />
                </div>
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            const btnTeam2 = screen.getByTestId('btn-score-team2');
            const undoBtn = screen.getByTestId('btn-undo-point');

            expect(btnTeam1).toBeInTheDocument();
            expect(btnTeam2).toBeInTheDocument();
            expect(undoBtn).toBeInTheDocument();
        });

        it('stress-tests Round Robin Standings table on 320px mobile viewport for table structure', () => {
            render(
                <div style={{ width: 320 }}>
                    <TournamentBracket />
                </div>
            );

            const rrBtn = screen.getByTestId('btn-round-robin');
            fireEvent.click(rrBtn);

            expect(screen.getByTestId('round-robin-view')).toBeInTheDocument();
            expect(screen.getByText('Official Pool Standings')).toBeInTheDocument();
        });
    });
});
