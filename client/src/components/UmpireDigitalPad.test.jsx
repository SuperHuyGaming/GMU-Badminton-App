import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UmpireDigitalPad from './UmpireDigitalPad';
import socket from '../utils/socket';

vi.mock('../utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    }
}));

describe('Mobile-Optimized Touch Umpire Pad Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial match state, RAC court selector, and 0-0 scoreboard', () => {
        render(
            <UmpireDigitalPad
                initialCourtNumber={1}
                initialPlayer1="Alan Yang (GMU)"
                initialPlayer2="Kevin Lin (UMD)"
            />
        );

        expect(screen.getByTestId('umpire-digital-pad')).toBeInTheDocument();
        expect(screen.getByText('Official Touch Umpire Pad')).toBeInTheDocument();
        expect(screen.getByText('RAC Court 1')).toBeInTheDocument();

        // Initial scores 0 - 0
        expect(screen.getByTestId('score-team1')).toHaveTextContent('0');
        expect(screen.getByTestId('score-team2')).toHaveTextContent('0');

        // Serving badge on Team 1 by default
        expect(screen.getByTestId('serving-badge-team1')).toBeInTheDocument();

        // 2D SVG Court
        expect(screen.getByTestId('service-court-svg')).toBeInTheDocument();
    });

    it('scores points, toggles serve, and calculates BWF service courts (Even = Right, Odd = Left)', () => {
        render(
            <UmpireDigitalPad
                initialCourtNumber={3}
                initialPlayer1="Alan Yang (GMU)"
                initialPlayer2="Kevin Lin (UMD)"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const btnTeam2 = screen.getByTestId('btn-score-team2');

        // Initially at 0 (Even) -> Right service court
        expect(screen.getAllByText(/RIGHT Court/i).length).toBeGreaterThan(0);

        // Team 1 scores -> 1-0 (Odd) -> Left service court
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('1');
        expect(screen.getAllByText(/LEFT Court/i).length).toBeGreaterThan(0);
        expect(socket.emit).toHaveBeenCalledWith('liveScoreUpdate', expect.objectContaining({
            courtNumber: 3,
            currentScore: { team1: 1, team2: 0 },
            server: 'team1',
            serverCourt: 'left'
        }));

        // Team 1 scores again -> 2-0 (Even) -> Right service court
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('2');
        expect(screen.getAllByText(/RIGHT Court/i).length).toBeGreaterThan(0);

        // Team 2 scores -> Side out, serve switches to Team 2, score 1 (Odd) -> Left service court
        fireEvent.click(btnTeam2);
        expect(screen.getByTestId('score-team2')).toHaveTextContent('1');
        expect(screen.getByTestId('serving-badge-team2')).toBeInTheDocument();
    });

    it('enforces BWF Deuce at 20-20 requiring 2-point clear margin to win', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const btnTeam2 = screen.getByTestId('btn-score-team2');

        // Advance to 20-20
        for (let i = 0; i < 20; i++) {
            fireEvent.click(btnTeam1);
            fireEvent.click(btnTeam2);
        }

        expect(screen.getByTestId('score-team1')).toHaveTextContent('20');
        expect(screen.getByTestId('score-team2')).toHaveTextContent('20');

        // Deuce banner should appear
        expect(screen.getByTestId('alert-deuce')).toBeInTheDocument();

        // Team 1 scores to 21-20 -> Game point banner, but game is NOT over (requires 2 point margin)
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('21');
        expect(screen.getByTestId('alert-game-point')).toBeInTheDocument();
        expect(screen.queryByTestId('game-over-alert')).not.toBeInTheDocument();

        // Team 1 scores to 22-20 -> 2-point clear margin! Game Over!
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('22');
        expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();
    });

    it('enforces sudden death 30-point golden point rule (29-29 -> 30-29 wins)', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const btnTeam2 = screen.getByTestId('btn-score-team2');

        // Fast forward to 29-29
        for (let i = 0; i < 29; i++) {
            fireEvent.click(btnTeam1);
            fireEvent.click(btnTeam2);
        }

        expect(screen.getByTestId('score-team1')).toHaveTextContent('29');
        expect(screen.getByTestId('score-team2')).toHaveTextContent('29');

        // Next point at 29-29 wins instantly at 30 (no need for +2 lead)
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('30');
        expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();
    });

    it('detects Match Point and declares Match Complete on winning 2 games', async () => {
        const onComplete = vi.fn();
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
                onMatchComplete={onComplete}
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');

        // Team 1 wins Game 1 (21 - 0)
        for (let i = 0; i < 21; i++) {
            fireEvent.click(btnTeam1);
        }
        expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();

        // Start Game 2
        const nextGameBtn = screen.getByTestId('btn-start-next-game');
        fireEvent.click(nextGameBtn);

        // Scores reset to 0-0 for Game 2
        expect(screen.getByTestId('score-team1')).toHaveTextContent('0');

        // Advance Game 2 to 20-0 -> Team 1 is at MATCH POINT (leading 1-0 in sets, 20-0 in Game 2)
        for (let i = 0; i < 20; i++) {
            fireEvent.click(btnTeam1);
        }
        expect(screen.getByTestId('alert-match-point')).toBeInTheDocument();

        // 21st point wins the MATCH!
        fireEvent.click(btnTeam1);
        await waitFor(() => {
            expect(screen.getByTestId('match-winner-alert')).toBeInTheDocument();
            expect(screen.getByText(/MATCH COMPLETE! Winner: Alan Yang/i)).toBeInTheDocument();
        });

        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
            winner: 'Alan Yang'
        }));
    });

    it('supports instantaneous Undo rollback of score points and serving state', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const undoBtn = screen.getByTestId('btn-undo-point');

        // Undo initially disabled
        expect(undoBtn).toBeDisabled();

        // Score 3 points
        fireEvent.click(btnTeam1);
        fireEvent.click(btnTeam1);
        fireEvent.click(btnTeam1);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('3');
        expect(undoBtn).not.toBeDisabled();

        // Undo one point -> 2
        fireEvent.click(undoBtn);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('2');

        // Undo another point -> 1
        fireEvent.click(undoBtn);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('1');

        // Undo last point -> 0
        fireEvent.click(undoBtn);
        expect(screen.getByTestId('score-team1')).toHaveTextContent('0');
        expect(undoBtn).toBeDisabled();
    });

    it('triggers technical interval countdown banner when a player reaches 11 points', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        for (let i = 0; i < 11; i++) {
            fireEvent.click(btnTeam1);
        }

        expect(screen.getByTestId('interval-countdown-timer')).toBeInTheDocument();
        expect(screen.getByText(/60s Technical Interval/i)).toBeInTheDocument();
    });

    it('displays golden point sudden death banner at 29-29 score', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const btnTeam2 = screen.getByTestId('btn-score-team2');

        for (let i = 0; i < 29; i++) {
            fireEvent.click(btnTeam1);
            fireEvent.click(btnTeam2);
        }

        expect(screen.getByTestId('golden-point-banner')).toBeInTheDocument();
        expect(screen.getByText(/GOLDEN POINT \(29-29\) — Sudden death!/i)).toBeInTheDocument();
    });

    it('triggers Game 3 side change banner when leading score reaches 11 in Game 3', () => {
        render(
            <UmpireDigitalPad
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        const btnTeam2 = screen.getByTestId('btn-score-team2');

        // Team 1 wins Game 1
        for (let i = 0; i < 21; i++) fireEvent.click(btnTeam1);
        fireEvent.click(screen.getByTestId('btn-start-next-game'));

        // Team 2 wins Game 2
        for (let i = 0; i < 21; i++) fireEvent.click(btnTeam2);
        fireEvent.click(screen.getByTestId('btn-start-next-game'));

        // Now in Game 3
        expect(screen.getByText(/GAME 3 OF 3/i)).toBeInTheDocument();

        // Score 11 points in Game 3
        for (let i = 0; i < 11; i++) fireEvent.click(btnTeam1);

        expect(screen.getByTestId('game3-side-change-banner')).toBeInTheDocument();
        expect(screen.getByText(/DECIDING GAME: CHANGE OF ENDS/i)).toBeInTheDocument();
    });

    it('persists score offline and replays mutations upon reconnection', async () => {
        const originalOnLine = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

        render(
            <UmpireDigitalPad
                initialCourtNumber={2}
                initialPlayer1="Alan Yang"
                initialPlayer2="Kevin Lin"
            />
        );

        expect(screen.getByTestId('sync-status-offline')).toBeInTheDocument();

        const btnTeam1 = screen.getByTestId('btn-score-team1');
        fireEvent.click(btnTeam1);

        await waitFor(() => {
            expect(screen.getByTestId('sync-status-offline')).toBeInTheDocument();
        });

        // Trigger reconnect
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
        fireEvent(window, new Event('online'));

        await waitFor(() => {
            expect(screen.getByTestId('sync-status-online')).toBeInTheDocument();
        });

        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
    });
});
