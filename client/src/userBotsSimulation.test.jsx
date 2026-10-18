/* global process */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';

import Tournaments from './pages/Tournaments';
import TournamentBracket from './components/TournamentBracket';
import CourtQueueViewer from './components/CourtQueueViewer';
import UmpireDigitalPad from './components/UmpireDigitalPad';
import {
    calculateServiceCourt,
    checkGameWinner,
    getGamePoint,
    getMatchPoint,
    calculateRoundRobinStandings
} from './utils/badmintonRules';

vi.mock('./utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    }
}));

vi.mock('./utils/api', () => ({
    default: vi.fn(() => Promise.resolve({
        success: true,
        tournaments: [
            {
                _id: 't-1',
                tournamentName: '2026 GMU Badminton Open',
                eventDate: '2026-11-14T09:00:00.000Z',
                eventLocation: 'Fairfax, VA • RAC Center',
                status: 'ACTIVE',
                entryFee: 35,
                divisions: ["Men's Singles Open", "Women's Singles", "Mixed Doubles"]
            },
            {
                _id: 't-2',
                tournamentName: 'Mid-Atlantic Collegiate Championships',
                eventDate: '2026-12-05T08:30:00.000Z',
                eventLocation: 'College Park, MD • Reckord Armory',
                status: 'ACTIVE',
                entryFee: 40,
                divisions: ["Collegiate Team Championship", "Open Singles"]
            }
        ]
    }))
}));

vi.mock('./context/AuthContext', () => ({
    useAuth: () => ({
        user: { _id: 'user-alan', name: 'Alan Yang (GMU)' },
        setUser: vi.fn()
    })
}));

describe('🤖 4-USER SYNTHETIC BOT SUITE: END-TO-END FEATURE EXPLORATION', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // USER BOT 1: Alan Yang (Collegiate Tournament Director & Player)
    // =========================================================================
    describe('User Bot 1: Alan Yang (Tournament Director & Player)', () => {
        it('Alan explores Tournament Directory, filters draws, and checks division specs', async () => {
            render(
                <MemoryRouter>
                    <Tournaments />
                </MemoryRouter>
            );

            // Check page title and primary navigation
            expect(screen.getByText(/Discover DMV Tournaments/i)).toBeInTheDocument();
            expect(screen.getByTestId('tab-tournaments-directory')).toBeInTheDocument();
            expect(screen.getByTestId('tab-bracket-viewer')).toBeInTheDocument();
            expect(screen.getByTestId('tab-court-schedule')).toBeInTheDocument();
            expect(screen.getByTestId('tab-umpire-pad')).toBeInTheDocument();

            // Toggle view mode between List and Calendar
            const toggleCalendar = screen.getByRole('button', { name: /calendar/i });
            fireEvent.click(toggleCalendar);
            expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();

            const toggleList = screen.getByRole('button', { name: /list/i });
            fireEvent.click(toggleList);
        });

        it('Alan interacts with the Hardware-Accelerated Single Elimination Bracket & controls', async () => {
            render(<TournamentBracket />);

            // Verify single elimination draw components
            expect(screen.getByTestId('tournament-bracket-engine')).toBeInTheDocument();
            expect(screen.getByTestId('bracket-canvas-viewport')).toBeInTheDocument();

            // Test zoom controls
            const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
            const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
            const resetBtn = screen.getByRole('button', { name: /reset zoom/i });
            const fitBtn = screen.getByRole('button', { name: /fit to center/i });

            fireEvent.click(zoomInBtn);
            expect(screen.getByText('115%')).toBeInTheDocument();
            fireEvent.click(zoomOutBtn);
            expect(screen.getByText('100%')).toBeInTheDocument();
            fireEvent.click(resetBtn);
            expect(screen.getByText('100%')).toBeInTheDocument();
            fireEvent.click(fitBtn);
            expect(screen.getByText('85%')).toBeInTheDocument();

            // Test match card inspection dialog
            const matchCard = screen.getByTestId('match-node-m-qf-1');
            fireEvent.click(matchCard);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/Match Details/i)).toBeInTheDocument();

            // Close dialog
            const closeBtn = screen.getByRole('button', { name: /close/i });
            fireEvent.click(closeBtn);

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // USER BOT 2: Kevin Lin (Head Umpire & Referee)
    // =========================================================================
    describe('User Bot 2: Kevin Lin (Head Umpire & Referee)', () => {
        it('Kevin inspects RAC Courts 1-6 Queue, status badges, and warmup states', () => {
            render(<CourtQueueViewer />);

            expect(screen.getByTestId('court-queue-viewer')).toBeInTheDocument();
            expect(screen.getByText(/RAC Gymnasium Courts 1–6 Scheduling Hub/i)).toBeInTheDocument();

            // Verify RAC Courts 1 through 6 are all represented
            for (let c = 1; c <= 6; c++) {
                expect(screen.getByTestId(`court-card-${c}`)).toBeInTheDocument();
                expect(screen.getByTestId(`status-badge-court-${c}`)).toBeInTheDocument();
            }

            // Test calling next match into warmup state
            const callNextBtn = screen.getByTestId('btn-call-next-3');
            fireEvent.click(callNextBtn);
            expect(screen.getByTestId('status-badge-court-3')).toHaveTextContent(/WARMUP/i);
        });

        it('Kevin operates Mobile Touch Umpire Pad with full BWF scoring, deuce, 30-pt sudden death, undo & redo', () => {
            render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan Yang (GMU)"
                    initialPlayer2="Kevin Lin (UMD)"
                />
            );

            const score1Btn = screen.getByTestId('btn-score-team1');
            const undoBtn = screen.getByTestId('btn-undo-point');
            const redoBtn = screen.getByTestId('btn-redo-point');

            // 1. Point scoring
            fireEvent.click(score1Btn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('1');
            expect(screen.getByTestId('score-team2')).toHaveTextContent('0');

            // 2. Undo & Redo
            expect(undoBtn).toBeEnabled();
            expect(redoBtn).toBeDisabled();

            fireEvent.click(undoBtn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('0');
            expect(undoBtn).toBeDisabled();
            expect(redoBtn).toBeEnabled();

            fireEvent.click(redoBtn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('1');
            expect(undoBtn).toBeEnabled();

            // 3. Service court parity on 2D SVG
            // Score 1 (odd) -> Left service court
            const svgEl = screen.getByTestId('service-court-svg');
            expect(svgEl).toBeInTheDocument();

            // 4. Test Service Over toggle
            const serviceOverBtn = screen.getByTestId('btn-service-over');
            fireEvent.click(serviceOverBtn);
            expect(screen.getByTestId('serving-badge-team2')).toBeInTheDocument();

            // 5. Test Golden Point sudden death rule logic
            expect(checkGameWinner(30, 29)).toBe(1);
            expect(checkGameWinner(29, 30)).toBe(2);
            expect(getGamePoint(29, 29)).toBe(3); // Both sides at golden game point!
            expect(getMatchPoint(29, 29, 1, 1, 2)).toBe(3); // Both sides at golden match point!
        });
    });

    // =========================================================================
    // USER BOT 3: Sarah Chen (Collegiate Club Coordinator)
    // =========================================================================
    describe('User Bot 3: Sarah Chen (Collegiate Club Coordinator)', () => {
        it('Sarah tests Double Elimination bracket tabs (Winners, Losers, Grand Finals)', () => {
            render(<TournamentBracket />);

            const deBtn = screen.getByTestId('btn-double-elim');
            fireEvent.click(deBtn);

            // Winners tab
            const winnersTab = screen.getByTestId('tab-winners');
            expect(winnersTab).toBeInTheDocument();

            // Losers tab
            const losersTab = screen.getByTestId('tab-losers');
            fireEvent.click(losersTab);
            expect(screen.getByTestId('bracket-canvas-viewport')).toBeInTheDocument();

            // Grand Finals tab
            const finalsTab = screen.getByTestId('tab-grand');
            fireEvent.click(finalsTab);
            expect(screen.getByTestId('bracket-canvas-viewport')).toBeInTheDocument();
        });

        it('Sarah validates Round Robin pool standings, BWF GCR 16.2.2 sorting, and head-to-head matrix', () => {
            render(<TournamentBracket />);

            const rrBtn = screen.getByTestId('btn-round-robin');
            fireEvent.click(rrBtn);

            expect(screen.getByTestId('round-robin-view')).toBeInTheDocument();
            expect(screen.getByText(/Official Pool Standings/i)).toBeInTheDocument();
            expect(screen.getByText(/Head-to-Head Matrix View/i)).toBeInTheDocument();

            // Empirical verification of BWF GCR 16.2.2 (Set Differential takes precedence over Point Differential)
            const testTeams = ['Team Alpha', 'Team Beta', 'Team Gamma'];
            const testMatches = [
                // Alpha vs Gamma: Alpha wins 2-0 (42-38, +4 pt diff, +2 set diff)
                { team1: 'Team Alpha', team2: 'Team Gamma', points1: 42, points2: 38, sets1: 2, sets2: 0, winner: 'Team Alpha', status: 'COMPLETED' },
                // Beta vs Gamma: Beta wins 2-1 (47-30, +17 pt diff, +1 set diff)
                { team1: 'Team Beta', team2: 'Team Gamma', points1: 47, points2: 30, sets1: 2, sets2: 1, winner: 'Team Beta', status: 'COMPLETED' }
            ];

            const standings = calculateRoundRobinStandings(testTeams, testMatches);
            expect(standings[0].team).toBe('Team Alpha'); // Higher set diff (+2 vs +1) wins rank 1 despite lower point diff!
            expect(standings[0].rank).toBe(1);
            expect(standings[1].team).toBe('Team Beta');
            expect(standings[1].rank).toBe(2);
            expect(standings[2].team).toBe('Team Gamma');
            expect(standings[2].rank).toBe(3);
        });
    });

    // =========================================================================
    // USER BOT 4: Marcus Brody (Regional Tournament Organizer & Auditor)
    // =========================================================================
    describe('User Bot 4: Marcus Brody (Regional Tournament Organizer & Auditor)', () => {
        it('Marcus verifies the Master 50-Sprint Plan and GitHub Project Structuring', () => {
            const planPath = path.resolve(process.cwd(), '../enterprise_tournament_platform_50_sprint_plan.md');
            expect(fs.existsSync(planPath)).toBe(true);

            const planContent = fs.readFileSync(planPath, 'utf8');

            // Verify all 10 engineering roles
            const roles = [
                'Full Stack Engineer',
                'Backend & Distributed Systems Engineer',
                'Frontend & Mobile Web Engineer',
                'AI & Machine Learning Engineer',
                'UX/UI & Accessibility Designer',
                'Security & Compliance Engineer',
                'Software Test & Quality Assurance Lead',
                'DevOps & Platform Reliability Engineer',
                'Data Architect & Analytics Engineer',
                'Tournament Operations & Product Manager'
            ];

            roles.forEach(role => {
                expect(planContent).toContain(role);
            });

            // Verify all 5 strategic delivery phases
            expect(planContent).toContain('Phase 1 (Sprints 1–10)');
            expect(planContent).toContain('Phase 2 (Sprints 11–20)');
            expect(planContent).toContain('Phase 3 (Sprints 21–30)');
            expect(planContent).toContain('Phase 4 (Sprints 31–40)');
            expect(planContent).toContain('Phase 5 (Sprints 41–50)');

            // Verify GitHub Issue Template
            const issueTemplatePath = path.resolve(process.cwd(), '../.github/ISSUE_TEMPLATE/tournament_initiative.yml');
            expect(fs.existsSync(issueTemplatePath)).toBe(true);
        });

        it('Marcus audits BWF service court mathematical parity across 0 to 30 points', () => {
            for (let score = 0; score <= 30; score++) {
                const court = calculateServiceCourt(score);
                if (score % 2 === 0) {
                    expect(court).toBe('right');
                } else {
                    expect(court).toBe('left');
                }
            }
        });
    });
});
