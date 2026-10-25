import { describe, it, expect } from 'vitest';
import {
    calculateServiceCourt,
    isDeuce,
    checkGameWinner,
    getGamePoint,
    getMatchPoint,
    isInterval,
    calculateRoundRobinStandings
} from './badmintonRules';

describe('BWF Badminton Scoring Rules Engine Unit Tests', () => {
    describe('calculateServiceCourt', () => {
        it('returns right for even scores and left for odd scores', () => {
            expect(calculateServiceCourt(0)).toBe('right');
            expect(calculateServiceCourt(1)).toBe('left');
            expect(calculateServiceCourt(2)).toBe('right');
            expect(calculateServiceCourt(21)).toBe('left');
            expect(calculateServiceCourt(30)).toBe('right');
        });

        it('handles invalid inputs gracefully by defaulting to right', () => {
            expect(calculateServiceCourt(null)).toBe('right');
            expect(calculateServiceCourt(undefined)).toBe('right');
            expect(calculateServiceCourt(-5)).toBe('right');
        });
    });

    describe('isDeuce', () => {
        it('detects deuce when both sides have >= 20 and are tied below 29', () => {
            expect(isDeuce(20, 20)).toBe(true);
            expect(isDeuce(21, 21)).toBe(true);
            expect(isDeuce(28, 28)).toBe(true);
            expect(isDeuce(19, 19)).toBe(false);
            expect(isDeuce(20, 21)).toBe(false);
            expect(isDeuce(29, 29)).toBe(false); // Sudden death, not deuce
        });
    });

    describe('checkGameWinner', () => {
        it('identifies winner when >= 21 with a 2-point clear margin', () => {
            expect(checkGameWinner(21, 19)).toBe(1);
            expect(checkGameWinner(19, 21)).toBe(2);
            expect(checkGameWinner(21, 20)).toBe(null); // Need 2-pt margin
            expect(checkGameWinner(22, 20)).toBe(1);
            expect(checkGameWinner(28, 30)).toBe(2);
        });

        it('enforces sudden death golden point at 30 points', () => {
            expect(checkGameWinner(30, 29)).toBe(1);
            expect(checkGameWinner(29, 30)).toBe(2);
        });
    });

    describe('getGamePoint and getMatchPoint', () => {
        it('detects game point correctly', () => {
            expect(getGamePoint(20, 18)).toBe(1);
            expect(getGamePoint(18, 20)).toBe(2);
            expect(getGamePoint(20, 20)).toBe(null);
            expect(getGamePoint(21, 20)).toBe(1);
            expect(getGamePoint(29, 29)).toBe(3); // Both sides at golden game point!
        });

        it('detects match point when player is 1 point away in deciding set', () => {
            // Player 1 has 1 game won, leads 20-18 in Game 2 -> Match Point!
            expect(getMatchPoint(20, 18, 1, 0, 2)).toBe(1);
            // Player 1 leads 20-18 in Game 1 -> Game Point, NOT Match Point
            expect(getMatchPoint(20, 18, 0, 0, 2)).toBe(null);
        });
    });

    describe('isInterval', () => {
        it('detects 11-point interval when first player reaches 11', () => {
            expect(isInterval(11, 8)).toBe(true);
            expect(isInterval(7, 11)).toBe(true);
            expect(isInterval(11, 11)).toBe(false);
            expect(isInterval(12, 10)).toBe(false);
        });
    });

    describe('calculateRoundRobinStandings', () => {
        it('calculates standings, ranks, and point differential', () => {
            const teams = ['Team A', 'Team B', 'Team C'];
            const matches = [
                { team1: 'Team A', team2: 'Team B', points1: 42, points2: 30, sets1: 2, sets2: 0, winner: 'Team A' },
                { team1: 'Team A', team2: 'Team C', points1: 42, points2: 25, sets1: 2, sets2: 0, winner: 'Team A' },
                { team1: 'Team B', team2: 'Team C', points1: 42, points2: 38, sets1: 2, sets2: 1, winner: 'Team B' }
            ];

            const standings = calculateRoundRobinStandings(teams, matches);

            expect(standings[0].team).toBe('Team A');
            expect(standings[0].won).toBe(2);
            expect(standings[0].pointDiff).toBe((42 - 30) + (42 - 25));
            expect(standings[0].rank).toBe(1);

            expect(standings[1].team).toBe('Team B');
            expect(standings[1].won).toBe(1);
            expect(standings[1].rank).toBe(2);

            expect(standings[2].team).toBe('Team C');
            expect(standings[2].won).toBe(0);
            expect(standings[2].rank).toBe(3);
        });
    });
});
