import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TournamentBracket from './TournamentBracket';

describe('Interactive Tournament Bracket Engine Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders single elimination draw by default with hardware-accelerated canvas', () => {
        render(<TournamentBracket />);

        expect(screen.getByTestId('tournament-bracket-engine')).toBeInTheDocument();
        expect(screen.getByTestId('bracket-canvas-viewport')).toBeInTheDocument();
        expect(screen.getByTestId('bracket-motion-container')).toBeInTheDocument();

        // Round headers
        expect(screen.getAllByText('Quarterfinals').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Semifinals').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Grand Championship Final').length).toBeGreaterThan(0);

        // Key players
        expect(screen.getAllByText(/Alan Yang \(GMU\)/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Marcus Chen \(GMU\)/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Kevin Lin \(UMD\)/i).length).toBeGreaterThan(0);

        // Initial scale at 100%
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('supports interactive zoom controls (Zoom In, Zoom Out, Reset, Fit View)', () => {
        render(<TournamentBracket />);

        const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
        const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
        const resetBtn = screen.getByRole('button', { name: /reset zoom/i });
        const fitBtn = screen.getByRole('button', { name: /fit to center/i });

        // Initial 100%
        expect(screen.getByText('100%')).toBeInTheDocument();

        // Zoom in -> 115%
        fireEvent.click(zoomInBtn);
        expect(screen.getByText('115%')).toBeInTheDocument();

        // Zoom out -> 100%
        fireEvent.click(zoomOutBtn);
        expect(screen.getByText('100%')).toBeInTheDocument();

        // Zoom out -> 85%
        fireEvent.click(zoomOutBtn);
        expect(screen.getByText('85%')).toBeInTheDocument();

        // Reset -> 100%
        fireEvent.click(resetBtn);
        expect(screen.getByText('100%')).toBeInTheDocument();

        // Fit to center -> 85%
        fireEvent.click(fitBtn);
        expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('opens match snapshot dialog on match node click', async () => {
        const onSelect = vi.fn();
        render(<TournamentBracket onMatchSelect={onSelect} />);

        const matchCard = screen.getByTestId('match-node-m-qf-1');
        fireEvent.click(matchCard);
        expect(onSelect).toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Match Details/i)).toBeInTheDocument();

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-qf-1' }));

        // Close dialog
        const closeBtn = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('switches to Double Elimination draw and toggles between Winners, Losers, and Grand Finals tabs', () => {
        render(<TournamentBracket />);

        const doubleElimBtn = screen.getByTestId('btn-double-elim');
        fireEvent.click(doubleElimBtn);

        // Sub-tabs should be rendered
        expect(screen.getByTestId('tab-winners')).toBeInTheDocument();
        expect(screen.getByTestId('tab-losers')).toBeInTheDocument();
        expect(screen.getByTestId('tab-grand')).toBeInTheDocument();

        // In Winners tab by default
        expect(screen.getAllByText(/Winners Semifinals/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Winners Final/i).length).toBeGreaterThan(0);

        // Switch to Losers Tab
        fireEvent.click(screen.getByTestId('tab-losers'));
        expect(screen.getAllByText(/Losers Round 1/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Losers Final/i).length).toBeGreaterThan(0);

        // Switch to Grand Championship Finals
        fireEvent.click(screen.getByTestId('tab-grand'));
        expect(screen.getAllByText(/Grand Finals/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Winners Champ/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Losers Champ/i).length).toBeGreaterThan(0);
    });

    it('switches to Round Robin draw, displaying Standings Table and Head-to-Head Cross Matrix', () => {
        render(<TournamentBracket />);

        const roundRobinBtn = screen.getByTestId('btn-round-robin');
        fireEvent.click(roundRobinBtn);

        expect(screen.getByTestId('round-robin-view')).toBeInTheDocument();
        expect(screen.getByText('Official Pool Standings')).toBeInTheDocument();
        expect(screen.getByText('Head-to-Head Matrix View')).toBeInTheDocument();

        // Verify standings calculations
        expect(screen.getAllByText('Marcus Chen (GMU)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Kevin Lin (UMD)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Knockout Q').length).toBe(2); // Top 2 qualify
    });

    it('handles legacy rootMatch prop gracefully', () => {
        const legacyMatch = {
            id: 'legacy-final',
            player1: 'Alice Smith',
            player2: 'Bob Jones',
            score1: 21,
            score2: 19,
            winner: 'Alice Smith',
            nextMatches: [
                {
                    id: 'legacy-semi-1',
                    player1: 'Alice Smith',
                    player2: 'Charlie Brown',
                    score1: 21,
                    score2: 15,
                    winner: 'Alice Smith'
                }
            ]
        };

        render(<TournamentBracket rootMatch={legacyMatch} />);

        expect(screen.getByTestId('tournament-bracket-engine')).toBeInTheDocument();
        expect(screen.getAllByText(/Alice Smith/i).length).toBeGreaterThan(0);
    });

    it('renders gold lock chip when match is actively locked by an umpire', () => {
        const customBracket = {
            tournamentName: 'Locked Match Draw',
            rounds: [
                {
                    id: 'r-1',
                    name: 'Finals',
                    matches: [
                        {
                            id: 'm-locked-1',
                            team1: { name: 'Player A', score: 11 },
                            team2: { name: 'Player B', score: 9 },
                            status: 'IN_PROGRESS',
                            lock: { isLocked: true, lockedByUmpireName: 'Umpire Sarah' }
                        }
                    ]
                }
            ]
        };

        render(<TournamentBracket bracketData={customBracket} />);

        const lockChip = screen.getByTestId('match-lock-m-locked-1');
        expect(lockChip).toBeInTheDocument();
        expect(lockChip).toHaveTextContent('Umpire Sarah');
    });
});

