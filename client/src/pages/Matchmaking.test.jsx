import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Matchmaking from './Matchmaking';
import apiFetch from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const mockPlayers = [
    {
        _id: 'player-1',
        name: 'John Doe',
        skillLevel: 'Intermediate',
        preferredPlay: 'Doubles',
        homeUniversity: 'George Mason University',
        racket: 'Yonex Astrox 88D',
        bio: 'Looking for doubles partners!',
        lastActive: new Date().toISOString(),
    },
    {
        _id: 'player-2',
        name: 'Jane Smith',
        skillLevel: 'Advanced',
        preferredPlay: 'Singles',
        homeUniversity: 'GMU',
        racket: 'Victor Thruster',
        bio: 'Competitive player.',
        lastActive: new Date().toISOString(),
    },
];

describe('Matchmaking Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            user: { _id: 'user-self', id: 'user-self', name: 'Current User' },
        });

        // Default API response for discover returns players in recommended
        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers,
                        recommended: mockPlayers,
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({}),
            });
        });
    });

    const renderMatchmaking = (mode = 'light') => {
        const theme = createTheme({ palette: { mode } });
        return render(
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    <Matchmaking />
                </BrowserRouter>
            </ThemeProvider>
        );
    };

    it('renders the search bar with proper placeholder, aria-label, and attributes', async () => {
        renderMatchmaking();

        const searchInput = screen.getByPlaceholderText('Search by name or university...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('aria-label', 'Search players');
        expect(searchInput).toHaveAttribute('autoComplete', 'off');

        // Test typing in the search bar
        fireEvent.change(searchInput, { target: { value: 'John' } });
        expect(searchInput.value).toBe('John');

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    it('renders search bar with translucent styling in dark mode', async () => {
        const { container } = renderMatchmaking('dark');

        const inputRoot = container.querySelector('.MuiOutlinedInput-root');
        expect(inputRoot).toBeInTheDocument();

        // Verify Emotion compiled dark mode translucent styling and blur into style tags
        const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join(' ');
        expect(styles).toContain('rgba(255, 255, 255, 0.08)');
        expect(styles).toContain('blur(10px)');

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    it('renders player cards with "Add Friend" buttons initially enabled', async () => {
        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        const addFriendButtons = screen.getAllByRole('button', { name: 'Add Friend' });
        expect(addFriendButtons.length).toBeGreaterThanOrEqual(2);
        addFriendButtons.forEach((btn) => {
            expect(btn).toBeEnabled();
        });
    });

    it('handles "Add Friend" click: displays loading state, sends request, transitions to disabled "Request Sent"', async () => {
        let resolveApi;
        const pendingPromise = new Promise((resolve) => {
            resolveApi = resolve;
        });

        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/friends/request')) {
                return pendingPromise;
            }
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers,
                        recommended: [mockPlayers[0]],
                    }),
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        const addFriendBtn = screen.getByRole('button', { name: 'Add Friend' });
        fireEvent.click(addFriendBtn);

        // While pending: progress spinner should be visible, button disabled
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(addFriendBtn).toBeDisabled();

        // Resolve the API call
        resolveApi({
            ok: true,
            json: async () => ({ message: 'Friend request sent' }),
        });

        // After resolution: transitions to disabled "Request Sent"
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
        });

        const sentBtn = screen.getByRole('button', { name: 'Request Sent' });
        expect(sentBtn).toBeDisabled();

        // Check apiFetch was called with correct arguments
        expect(apiFetch).toHaveBeenCalledWith('/api/friends/request', {
            method: 'POST',
            body: JSON.stringify({ recipientId: mockPlayers[0]._id }),
        });

        expect(toast.success).toHaveBeenCalledWith(
            expect.stringContaining(`Friend request sent to ${mockPlayers[0].name}`)
        );
    });

    it('shows toast error and does not call API when unauthenticated user clicks "Add Friend"', async () => {
        useAuth.mockReturnValue({ user: null });

        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        const addFriendBtn = screen.getAllByRole('button', { name: 'Add Friend' })[0];
        fireEvent.click(addFriendBtn);

        expect(toast.error).toHaveBeenCalledWith('Please log in to add friends');
        expect(apiFetch).not.toHaveBeenCalledWith('/api/friends/request', expect.anything());
        expect(addFriendBtn).toBeEnabled();
    });

    it('shows toast error and reverts to enabled "Add Friend" button when request fails', async () => {
        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/friends/request')) {
                return Promise.reject(new Error('Network connection error'));
            }
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers,
                        recommended: [mockPlayers[0]],
                    }),
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        const addFriendBtn = screen.getByRole('button', { name: 'Add Friend' });
        fireEvent.click(addFriendBtn);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Network connection error');
        });

        // Button reverts to enabled "Add Friend"
        expect(screen.getByRole('button', { name: 'Add Friend' })).toBeEnabled();
    });
});
