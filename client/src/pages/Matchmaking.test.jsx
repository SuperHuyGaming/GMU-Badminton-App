import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Matchmaking from './Matchmaking';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

describe('Matchmaking Page Component', () => {
    const mockUsers = [
        {
            _id: 'user-1',
            name: 'Alice Johnson',
            skillLevel: 'Intermediate',
            preferredPlay: 'Singles',
            homeUniversity: 'George Mason University',
            racket: 'Yonex Astrox 88D',
            bio: 'Looking for friendly matches after classes',
            lastActive: new Date().toISOString(),
        },
        {
            _id: 'user-2',
            name: 'Bob Smith',
            skillLevel: 'Advanced',
            preferredPlay: 'Doubles',
            homeUniversity: 'George Mason University',
            racket: 'Li-Ning Aeronaut 9000',
            bio: 'Competitive doubles player',
            lastActive: new Date().toISOString(),
        },
    ];

    const mockRecommended = [
        {
            _id: 'user-3',
            name: 'Charlie Brown',
            skillLevel: 'Beginner',
            preferredPlay: 'Singles',
            homeUniversity: 'George Mason University',
            bio: 'Just started playing badminton',
            lastActive: new Date().toISOString(),
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock IntersectionObserver
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null,
        });
        window.IntersectionObserver = mockIntersectionObserver;

        // Default API mock implementation
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/presence')) {
                return {
                    ok: true,
                    json: async () => ({ onlineUsers: [{ _id: 'user-1', name: 'Alice Johnson' }] })
                };
            }
            if (url.includes('/discover')) {
                return {
                    ok: true,
                    json: async () => ({
                        matches: mockUsers,
                        recommended: mockRecommended
                    })
                };
            }
            return {
                ok: true,
                json: async () => ({})
            };
        });
    });

    const renderMatchmaking = () => {
        return render(
            <MemoryRouter>
                <Matchmaking />
            </MemoryRouter>
        );
    };

    it('renders header, search input, and filter chips', async () => {
        renderMatchmaking();

        expect(screen.getByText('Community Directory')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search by name or university...')).toBeInTheDocument();
        expect(screen.getByText('Filter Skill:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Intermediate' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('People You May Know')).toBeInTheDocument();
        });
    });

    it('fetches and displays recommendations and presence', async () => {
        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('People You May Know')).toBeInTheDocument();
            expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        });

        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/matchmaking/presence'));
        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/matchmaking/discover?'));
    });

    it('filters players when a skill chip is clicked', async () => {
        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        });

        const intermediateChip = screen.getByRole('button', { name: 'Intermediate' });
        fireEvent.click(intermediateChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('skill=Intermediate'));
            expect(screen.getByText('Search Results')).toBeInTheDocument();
            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        });
    });

    it('sends friend request and updates button to Request Sent', async () => {
        apiFetch.mockImplementation(async (url, options) => {
            if (url === '/api/friends/request' && options?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ message: 'Friend request sent' })
                };
            }
            if (url.includes('/discover')) {
                return {
                    ok: true,
                    json: async () => ({
                        matches: mockUsers,
                        recommended: mockRecommended
                    })
                };
            }
            if (url.includes('/presence')) {
                return {
                    ok: true,
                    json: async () => ({ onlineUsers: [] })
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderMatchmaking();

        // Switch filter so player cards in search results appear
        const advancedChip = screen.getByRole('button', { name: 'Advanced' });
        fireEvent.click(advancedChip);

        await waitFor(() => {
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        });

        const addFriendButtons = screen.getAllByRole('button', { name: /add friend/i });
        expect(addFriendButtons.length).toBeGreaterThan(0);

        fireEvent.click(addFriendButtons[0]);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                '/api/friends/request',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ recipientId: 'user-1', friendId: 'user-1' })
                })
            );
            expect(screen.getByText('Request Sent')).toBeInTheDocument();
        });
    });
});
