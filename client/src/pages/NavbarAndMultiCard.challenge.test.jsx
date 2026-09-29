import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Matchmaking from './Matchmaking';
import Navbar from '../components/Navbar';
import apiFetch from '../utils/api';
import { AuthContext, useAuth } from '../context/AuthContext';
import { ColorModeContext } from '../App';
import { toast } from 'react-hot-toast';

// Mock apiFetch
vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { changeLanguage: vi.fn(), language: 'en' },
    }),
}));

// Mock useNotifications hook
vi.mock('../hooks/useNotifications', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: 0,
        unreadMessages: 0,
        markAsRead: vi.fn(),
        markSingleAsRead: vi.fn(),
        clearNotifications: vi.fn(),
    }),
}));

// Mock LanguageSwitcher
vi.mock('../components/LanguageSwitcher', () => ({
    default: () => <div data-testid="language-switcher">Lang</div>,
}));

// Mock useAuth
vi.mock('../context/AuthContext', async () => {
    const actual = await vi.importActual('../context/AuthContext');
    return {
        ...actual,
        useAuth: vi.fn(),
    };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Generate 12 mock players
const generateMockPlayers = (count = 12) => {
    return Array.from({ length: count }, (_, i) => ({
        _id: `player-id-${i + 1}`,
        name: `Player Candidate ${i + 1}`,
        skillLevel: i % 3 === 0 ? 'Advanced' : i % 2 === 0 ? 'Intermediate' : 'Beginner',
        preferredPlay: i % 2 === 0 ? 'Doubles' : 'Singles',
        homeUniversity: 'George Mason University',
        racket: `Yonex Voltric ${i + 1}`,
        bio: `Bio for player ${i + 1}`,
        lastActive: new Date().toISOString(),
    }));
};

describe('Empirical Challenge: Navbar Deprecation & Mobile Drawer', () => {
    const mockUser = { id: 'u1', name: 'Test User', role: 'member' };

    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() });
    });

    const renderNavbar = (initialRoute = '/') => {
        return render(
            <AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
                <ColorModeContext.Provider value={{ toggleColorMode: vi.fn() }}>
                    <MemoryRouter initialEntries={[initialRoute]}>
                        <Navbar />
                    </MemoryRouter>
                </ColorModeContext.Provider>
            </AuthContext.Provider>
        );
    };

    it('verifies "Players" link is completely removed from desktop and mobile drawer navigation', () => {
        renderNavbar();

        // 1. Assert "Players" does NOT exist anywhere
        expect(screen.queryByRole('link', { name: /^Players$/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/^Players$/i)).not.toBeInTheDocument();

        // 2. Assert standard links are present in Desktop navigation
        const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
        expect(dashboardLink).toBeInTheDocument();
        expect(dashboardLink).toHaveAttribute('href', '/');

        const communityLink = screen.getByRole('link', { name: 'Community' });
        expect(communityLink).toBeInTheDocument();
        expect(communityLink).toHaveAttribute('href', '/community');

        const tournamentsLink = screen.getByRole('link', { name: 'Tournaments' });
        expect(tournamentsLink).toBeInTheDocument();
        expect(tournamentsLink).toHaveAttribute('href', '/tournaments');
    });

    it('verifies mobile drawer opens, contains only valid links, and toggles without "Players"', () => {
        renderNavbar();

        // Hamburger button
        const hamburgerBtn = screen.getByLabelText('Open navigation menu');
        expect(hamburgerBtn).toBeInTheDocument();
        expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');

        // Open mobile drawer
        fireEvent.click(hamburgerBtn);

        // Mobile drawer navigation list
        const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation links' });
        expect(mobileNav).toBeInTheDocument();

        // Check mobile navigation items inside mobileNav
        const mobileSearch = within(mobileNav).getByRole('link', { name: 'Search' });
        expect(mobileSearch).toBeInTheDocument();
        expect(mobileSearch).toHaveAttribute('href', '/search');

        const mobileDashboard = within(mobileNav).getByRole('link', { name: 'Dashboard' });
        expect(mobileDashboard).toBeInTheDocument();
        expect(mobileDashboard).toHaveAttribute('href', '/');

        const mobileCommunity = within(mobileNav).getByRole('link', { name: 'Community' });
        expect(mobileCommunity).toBeInTheDocument();
        expect(mobileCommunity).toHaveAttribute('href', '/community');

        const mobileTournaments = within(mobileNav).getByRole('link', { name: 'Tournaments' });
        expect(mobileTournaments).toBeInTheDocument();
        expect(mobileTournaments).toHaveAttribute('href', '/tournaments');

        // Confirm "Players" does not exist inside mobileNav
        expect(within(mobileNav).queryByText(/^Players$/i)).not.toBeInTheDocument();

        // Clicking a mobile navigation item toggles drawer
        fireEvent.click(mobileCommunity);
    });
});

describe('Empirical Challenge: Multi-Player Card State Isolation (10+ Players)', () => {
    const mockPlayers12 = generateMockPlayers(12);

    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            user: { _id: 'self-user-id', id: 'self-user-id', name: 'Self User' },
        });

        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers12,
                        recommended: mockPlayers12,
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({ message: 'ok' }),
            });
        });
    });

    const renderMatchmaking = () => {
        const theme = createTheme({ palette: { mode: 'dark' } });
        return render(
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    <Matchmaking />
                </BrowserRouter>
            </ThemeProvider>
        );
    };

    it('renders all 12 player cards and verifies each Add Friend button starts in idle enabled state', async () => {
        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('Player Candidate 1')).toBeInTheDocument();
            expect(screen.getByText('Player Candidate 12')).toBeInTheDocument();
        });

        // Find all player cards
        const addButtons = screen.getAllByRole('button', { name: 'Add Friend' });
        expect(addButtons.length).toBe(12);

        // Every button must be enabled
        addButtons.forEach((btn) => {
            expect(btn).toBeEnabled();
            expect(within(btn).queryByRole('progressbar')).not.toBeInTheDocument();
        });
    });

    it('rigorously tests isolation across 12 player cards: single click, pending, success, and error states', async () => {
        let resolvePlayer3;
        const promisePlayer3 = new Promise((resolve) => {
            resolvePlayer3 = resolve;
        });

        let resolvePlayer7;
        const promisePlayer7 = new Promise((resolve) => {
            resolvePlayer7 = resolve;
        });

        let rejectPlayer10;
        const promisePlayer10 = new Promise((_, reject) => {
            rejectPlayer10 = reject;
        });

        apiFetch.mockImplementation((url, options) => {
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers12,
                        recommended: mockPlayers12,
                    }),
                });
            }
            if (url.includes('/api/friends/request')) {
                const body = JSON.parse(options.body);
                if (body.recipientId === 'player-id-3') {
                    return promisePlayer3;
                }
                if (body.recipientId === 'player-id-7') {
                    return promisePlayer7;
                }
                if (body.recipientId === 'player-id-10') {
                    return promisePlayer10;
                }
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('Player Candidate 3')).toBeInTheDocument();
            expect(screen.getByText('Player Candidate 7')).toBeInTheDocument();
            expect(screen.getByText('Player Candidate 10')).toBeInTheDocument();
        });

        const initialAddButtons = screen.getAllByRole('button', { name: 'Add Friend' });
        expect(initialAddButtons.length).toBe(12);

        // Step 1: Click "Add Friend" for Player 3 (index 2)
        fireEvent.click(initialAddButtons[2]);

        // Verify Player 3 has progressbar and is disabled
        expect(initialAddButtons[2]).toBeDisabled();
        expect(within(initialAddButtons[2]).getByRole('progressbar')).toBeInTheDocument();

        // Verify ALL OTHER 11 buttons remain idle, enabled, and have NO progressbar
        initialAddButtons.forEach((btn, idx) => {
            if (idx === 2) return;
            expect(btn).toBeEnabled();
            expect(within(btn).queryByRole('progressbar')).not.toBeInTheDocument();
            expect(btn).toHaveTextContent('Add Friend');
        });

        // Step 2: Resolve Player 3 friend request
        resolvePlayer3({ ok: true, json: async () => ({ message: 'Friend request sent' }) });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
        });

        const sentButtonPlayer3 = screen.getByRole('button', { name: 'Request Sent' });
        expect(sentButtonPlayer3).toBeDisabled();

        // Exactly 1 button should now be "Request Sent", and 11 should be "Add Friend"
        expect(screen.getAllByRole('button', { name: 'Request Sent' })).toHaveLength(1);
        const remainingAddButtons = screen.getAllByRole('button', { name: 'Add Friend' });
        expect(remainingAddButtons).toHaveLength(11);
        remainingAddButtons.forEach((btn) => {
            expect(btn).toBeEnabled();
        });

        // Step 3: Concurrently click Player 7 and Player 10
        // Find Player 7's button (which was original index 6)
        // Find Player 10's button (which was original index 9)
        const player7Card = screen.getByText('Player Candidate 7').closest('.MuiCard-root');
        const player7Btn = within(player7Card).getByRole('button', { name: 'Add Friend' });

        const player10Card = screen.getByText('Player Candidate 10').closest('.MuiCard-root');
        const player10Btn = within(player10Card).getByRole('button', { name: 'Add Friend' });

        fireEvent.click(player7Btn);
        fireEvent.click(player10Btn);

        // Both Player 7 and Player 10 must be in loading state
        expect(player7Btn).toBeDisabled();
        expect(within(player7Btn).getByRole('progressbar')).toBeInTheDocument();

        expect(player10Btn).toBeDisabled();
        expect(within(player10Btn).getByRole('progressbar')).toBeInTheDocument();

        // Player 3 must STILL be disabled "Request Sent"
        expect(sentButtonPlayer3).toHaveTextContent('Request Sent');
        expect(sentButtonPlayer3).toBeDisabled();

        // The remaining 9 players must STILL be enabled "Add Friend"
        expect(screen.getAllByRole('button', { name: 'Add Friend' })).toHaveLength(9);
        screen.getAllByRole('button', { name: 'Add Friend' }).forEach((btn) => {
            expect(btn).toBeEnabled();
            expect(within(btn).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Step 4: Resolve Player 7 with success, reject Player 10 with network failure
        resolvePlayer7({ ok: true, json: async () => ({ message: 'Friend request sent' }) });
        rejectPlayer10(new Error('Connection timeout'));

        await waitFor(() => {
            // There should now be 2 "Request Sent" buttons (Player 3 and Player 7)
            expect(screen.getAllByRole('button', { name: 'Request Sent' })).toHaveLength(2);
        });

        // Player 10 should have reverted to enabled "Add Friend"
        await waitFor(() => {
            const revertedPlayer10Btn = within(player10Card).getByRole('button', { name: 'Add Friend' });
            expect(revertedPlayer10Btn).toBeEnabled();
        });

        // Total "Request Sent" buttons = 2 (Player 3 and 7)
        expect(screen.getAllByRole('button', { name: 'Request Sent' })).toHaveLength(2);
        // Total "Add Friend" buttons = 10 (Player 10 reverted + 9 untouched)
        expect(screen.getAllByRole('button', { name: 'Add Friend' })).toHaveLength(10);

        // Verify toast notifications
        expect(toast.success).toHaveBeenCalledWith('Friend request sent to Player Candidate 3');
        expect(toast.success).toHaveBeenCalledWith('Friend request sent to Player Candidate 7');
        expect(toast.error).toHaveBeenCalledWith('Connection timeout');
    });

    it('stress tests rapid concurrent clicks across 5 players simultaneously', async () => {
        let resolvers = {};
        const playerIdsToClick = [1, 2, 4, 5, 8].map(i => `player-id-${i}`);

        playerIdsToClick.forEach(id => {
            new Promise((resolve) => {
                resolvers[id] = resolve;
            });
        });

        apiFetch.mockImplementation((url, options) => {
            if (url.includes('/api/matchmaking/discover')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        matches: mockPlayers12,
                        recommended: mockPlayers12,
                    }),
                });
            }
            if (url.includes('/api/friends/request')) {
                const body = JSON.parse(options.body);
                return new Promise((resolve) => {
                    resolvers[body.recipientId] = resolve;
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        renderMatchmaking();

        await waitFor(() => {
            expect(screen.getByText('Player Candidate 1')).toBeInTheDocument();
        });

        // Trigger clicks on players 1, 2, 4, 5, 8
        const candidateIndices = [0, 1, 3, 4, 7];
        const buttons = screen.getAllByRole('button', { name: 'Add Friend' });

        candidateIndices.forEach(idx => {
            fireEvent.click(buttons[idx]);
        });

        // All 5 clicked buttons should now be disabled and have progressbar
        candidateIndices.forEach(idx => {
            expect(buttons[idx]).toBeDisabled();
            expect(within(buttons[idx]).getByRole('progressbar')).toBeInTheDocument();
        });

        // The remaining 7 buttons should remain enabled with no progressbar
        const unclickedIndices = [2, 5, 6, 8, 9, 10, 11];
        unclickedIndices.forEach(idx => {
            expect(buttons[idx]).toBeEnabled();
            expect(within(buttons[idx]).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Resolve 3 of them (player 1, 2, 4), and verify only those 3 become "Request Sent"
        resolvers['player-id-1']({ ok: true, json: async () => ({ message: 'sent' }) });
        resolvers['player-id-2']({ ok: true, json: async () => ({ message: 'sent' }) });
        resolvers['player-id-4']({ ok: true, json: async () => ({ message: 'sent' }) });

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Request Sent' })).toHaveLength(3);
        });

        // Players 5 and 8 are still loading
        expect(buttons[4]).toBeDisabled();
        expect(within(buttons[4]).getByRole('progressbar')).toBeInTheDocument();
        expect(buttons[7]).toBeDisabled();
        expect(within(buttons[7]).getByRole('progressbar')).toBeInTheDocument();

        // Finish players 5 and 8
        resolvers['player-id-5']({ ok: true, json: async () => ({ message: 'sent' }) });
        resolvers['player-id-8']({ ok: true, json: async () => ({ message: 'sent' }) });

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Request Sent' })).toHaveLength(5);
        });

        // Remaining 7 are untouched
        expect(screen.getAllByRole('button', { name: 'Add Friend' })).toHaveLength(7);
    });
});
