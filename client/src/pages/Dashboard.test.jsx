// client/src/pages/Dashboard.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';
import { BrowserRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'user-123',
            _id: 'user-123',
            name: 'Patriot Player',
            role: 'admin',
            skillLevel: 'Advanced',
            homeUniversity: 'George Mason University',
            singlesElo: 1420,
            doublesElo: 1350,
            stats: { wins: 14, losses: 6, totalMatches: 20 },
            profilePic: ''
        }
    })
}));

vi.mock('../utils/socket', () => ({
    default: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    }
}));

vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

import apiFetch from '../utils/api';

describe('Personal Dashboard Page Component (Phase 1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('user', JSON.stringify({
            id: 'user-123',
            name: 'Patriot Player',
            role: 'admin'
        }));

        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/announcements') {
                return {
                    ok: true,
                    json: async () => [
                        {
                            _id: 'ann-1',
                            content: 'Racquet restringing clinic this Friday at RAC!',
                            authorName: 'Coach Alan',
                            createdAt: new Date().toISOString()
                        }
                    ]
                };
            }
            if (url === '/api/matches/pending') {
                return {
                    ok: true,
                    json: async () => [
                        {
                            _id: 'match-pending-1',
                            type: 'singles',
                            team1Score: 21,
                            team2Score: 19,
                            submittedBy: { _id: 'opponent-456', name: 'Rival Terrapin' }
                        }
                    ]
                };
            }
            if (url.startsWith('/api/matches/user/')) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            _id: 'match-1',
                            type: 'singles',
                            team1: [{ _id: 'user-123', name: 'Patriot Player' }],
                            team2: [{ _id: 'opp-1', name: 'Alex Smash' }],
                            team1Score: 21,
                            team2Score: 17,
                            winner: 'team1',
                            date: new Date().toISOString()
                        }
                    ]
                };
            }
            return { ok: false };
        });
    });

    it('1. Renders personalized welcome header with skill level badge and action buttons', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        expect(screen.getByText(/Welcome back, Patriot Player!/i)).toBeInTheDocument();
        expect(screen.getByText('Advanced')).toBeInTheDocument();
        expect(screen.getByText(/George Mason University/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Log Match/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Find Players/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Tournaments/i })).toBeInTheDocument();
    });

    it('2. Renders dynamic RAC Live Court Status hero widget', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        expect(screen.getByText(/REAL-TIME COURT STATUS/i)).toBeInTheDocument();
        expect(screen.getByText(/RAC Linn Gym Court B/i)).toBeInTheDocument();
        expect(screen.getByText(/Estimated Court Availability/i)).toBeInTheDocument();
    });

    it('3. Renders player Elo rating progression and career stats', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        expect(screen.getByText(/Player Rating & Tier Progression/i)).toBeInTheDocument();
        expect(screen.getByText('1420')).toBeInTheDocument(); // Singles Elo
        expect(screen.getByText('1350')).toBeInTheDocument(); // Doubles Elo
        expect(screen.getByText(/Career Record: 14W - 6L/i)).toBeInTheDocument();
        expect(screen.getByText('70% Win Rate')).toBeInTheDocument();
    });

    it('4. Renders pending match verifications banner with action buttons', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Pending Match Verifications/i)).toBeInTheDocument();
            expect(screen.getByText(/Reported by Rival Terrapin/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Dispute/i })).toBeInTheDocument();
        });
    });

    it('5. Renders recent match history with scores and victory chip', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/vs Alex Smash/i)).toBeInTheDocument();
            expect(screen.getByText('21 - 17')).toBeInTheDocument();
            expect(screen.getByText('VICTORY')).toBeInTheDocument();
        });
    });

    it('6. Renders club announcements and allows admin to publish updates', async () => {
        render(
            <BrowserRouter>
                <Dashboard />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Racquet restringing clinic this Friday at RAC!/i)).toBeInTheDocument();
        });

        // Admin publish form
        const input = screen.getByPlaceholderText(/Share tournament notices, court closures/i);
        fireEvent.change(input, { target: { value: 'New open drop-in hours added for Saturday!' } });

        const publishBtn = screen.getByRole('button', { name: /Publish Announcement/i });
        expect(publishBtn).not.toBeDisabled();
        fireEvent.click(publishBtn);

        expect(apiFetch).toHaveBeenCalledWith(
            '/api/announcements',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('New open drop-in hours added for Saturday!')
            })
        );
    });
});
