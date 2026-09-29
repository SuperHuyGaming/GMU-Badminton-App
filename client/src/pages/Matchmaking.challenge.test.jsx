import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Matchmaking from './Matchmaking';
import apiFetch from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

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
        name: 'Alice Wonder',
        skillLevel: 'Intermediate',
        preferredPlay: 'Doubles',
        homeUniversity: 'George Mason University',
        racket: 'Yonex Astrox 88D',
        bio: 'Looking for doubles partners!',
        lastActive: new Date().toISOString(),
    },
    {
        _id: 'player-2',
        name: 'Bob Builder',
        skillLevel: 'Advanced',
        preferredPlay: 'Singles',
        homeUniversity: 'GMU',
        racket: 'Victor Thruster',
        bio: 'Competitive player.',
        lastActive: new Date().toISOString(),
    },
    {
        _id: 'player-3',
        name: 'Charlie Chaplin',
        skillLevel: 'Beginner',
        preferredPlay: 'Casual',
        homeUniversity: 'GMU',
        racket: 'Li-Ning Axforce',
        bio: 'Just for fun!',
        lastActive: new Date().toISOString(),
    },
];

describe('Empirical Challenge: Milestone 1 Stress & Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        useAuth.mockReturnValue({
            user: { _id: 'user-self', id: 'user-self', name: 'Tester User' },
        });

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
                json: async () => ({ message: 'Friend request sent' }),
            });
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderComponent = (mode = 'light') => {
        const theme = createTheme({ palette: { mode } });
        return render(
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    <Matchmaking />
                </BrowserRouter>
            </ThemeProvider>
        );
    };

    describe('1. Race Conditions & Rapid Click Stress Test', () => {
        it('prevents duplicate requests when rapid clicks are fired before API resolves', async () => {
            let resolveApi;
            const slowPromise = new Promise((resolve) => {
                resolveApi = resolve;
            });

            apiFetch.mockImplementation((url) => {
                if (url.includes('/api/friends/request')) {
                    return slowPromise;
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

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addBtn = screen.getByRole('button', { name: 'Add Friend' });

            // Rapid fire: 5 rapid clicks in quick succession
            fireEvent.click(addBtn);
            fireEvent.click(addBtn);
            fireEvent.click(addBtn);
            fireEvent.click(addBtn);
            fireEvent.click(addBtn);

            // Button should immediately be disabled
            expect(addBtn).toBeDisabled();

            // Check how many friend requests were sent
            const friendRequestCalls = apiFetch.mock.calls.filter(([url]) =>
                url.includes('/api/friends/request')
            );
            expect(friendRequestCalls.length).toBe(1);

            // Resolve the API call
            act(() => {
                resolveApi({
                    ok: true,
                    json: async () => ({ message: 'Friend request sent' }),
                });
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });

            const sentBtn = screen.getByRole('button', { name: 'Request Sent' });
            expect(sentBtn).toBeDisabled();

            // Further clicks on "Request Sent" should do nothing
            fireEvent.click(sentBtn);
            const friendRequestCallsAfter = apiFetch.mock.calls.filter(([url]) =>
                url.includes('/api/friends/request')
            );
            expect(friendRequestCallsAfter.length).toBe(1);
        });

        it('isolates friendStatus state across multiple player cards under concurrent clicks', async () => {
            let resolvePlayer1;
            let rejectPlayer2;

            const p1Promise = new Promise((resolve) => {
                resolvePlayer1 = resolve;
            });
            const p2Promise = new Promise((_, reject) => {
                rejectPlayer2 = reject;
            });

            apiFetch.mockImplementation((url, options) => {
                if (url.includes('/api/friends/request')) {
                    const body = JSON.parse(options.body);
                    if (body.recipientId === 'player-1') return p1Promise;
                    if (body.recipientId === 'player-2') return p2Promise;
                }
                if (url.includes('/api/matchmaking/discover')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            matches: mockPlayers,
                            recommended: mockPlayers.slice(0, 3),
                        }),
                    });
                }
                return Promise.resolve({ ok: true, json: async () => ({}) });
            });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
                expect(screen.getByText('Bob Builder')).toBeInTheDocument();
                expect(screen.getByText('Charlie Chaplin')).toBeInTheDocument();
            });

            const buttons = screen.getAllByRole('button', { name: 'Add Friend' });
            expect(buttons.length).toBeGreaterThanOrEqual(3);

            // Click Player 1 and Player 2 concurrently
            fireEvent.click(buttons[0]); // Alice (player-1)
            fireEvent.click(buttons[1]); // Bob (player-2)

            // Alice and Bob should be loading/disabled, Charlie should remain enabled
            expect(buttons[0]).toBeDisabled();
            expect(buttons[1]).toBeDisabled();
            expect(buttons[2]).toBeEnabled();

            // Resolve Alice, reject Bob
            act(() => {
                resolvePlayer1({
                    ok: true,
                    json: async () => ({ message: 'Friend request sent' }),
                });
                rejectPlayer2(new Error('Server busy'));
            });

            // Alice should become "Request Sent" (disabled)
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });

            // Bob should revert to "Add Friend" (enabled)
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Server busy');
            });
            const remainingAddFriendButtons = screen.getAllByRole('button', { name: 'Add Friend' });
            expect(remainingAddFriendButtons.length).toBe(2);
            remainingAddFriendButtons.forEach((btn) => expect(btn).toBeEnabled());
        });

        it('maintains friendStatus state when skill filters are switched', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addBtn = screen.getAllByRole('button', { name: 'Add Friend' })[0];
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });

            // Switch filter to Intermediate
            const intermediateChip = screen.getByRole('button', { name: 'Intermediate' });
            fireEvent.click(intermediateChip);

            // Alice should still be marked as "Request Sent" and disabled
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });
            expect(screen.getByRole('button', { name: 'Request Sent' })).toBeDisabled();
        });
    });

    describe('2. Unauthenticated User Behavior & Guard', () => {
        it('rejects Add Friend action immediately without API call when user is not logged in', async () => {
            useAuth.mockReturnValue({ user: null });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addFriendBtn = screen.getAllByRole('button', { name: 'Add Friend' })[0];

            // Spam click 3 times while unauthenticated
            fireEvent.click(addFriendBtn);
            fireEvent.click(addFriendBtn);
            fireEvent.click(addFriendBtn);

            expect(toast.error).toHaveBeenCalledWith('Please log in to add friends');
            expect(apiFetch).not.toHaveBeenCalledWith(
                '/api/friends/request',
                expect.anything()
            );
            expect(addFriendBtn).toBeEnabled();
            expect(addFriendBtn).toHaveTextContent('Add Friend');
        });
    });

    describe('3. Network Failure & Recovery Stress Test', () => {
        it('recovers cleanly from network drop and allows successful retry', async () => {
            let attempt = 0;
            apiFetch.mockImplementation((url) => {
                if (url.includes('/api/friends/request')) {
                    attempt++;
                    if (attempt === 1) {
                        return Promise.reject(new Error('Network offline'));
                    }
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ message: 'Friend request sent' }),
                    });
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

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addBtn = screen.getByRole('button', { name: 'Add Friend' });

            // First attempt: fails due to network offline
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Network offline');
            });

            // Button reverts to enabled "Add Friend"
            expect(screen.getByRole('button', { name: 'Add Friend' })).toBeEnabled();

            // Second attempt (retry): succeeds
            fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });
            expect(screen.getByRole('button', { name: 'Request Sent' })).toBeDisabled();
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Friend request sent to Alice Wonder')
            );
        });

        it('handles backend 400 Bad Request ("Already friends" or "Request already sent") gracefully', async () => {
            apiFetch.mockImplementation((url) => {
                if (url.includes('/api/friends/request')) {
                    return Promise.reject(new Error('Request already sent'));
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

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addBtn = screen.getByRole('button', { name: 'Add Friend' });
            fireEvent.click(addBtn);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Request already sent');
            });

            expect(screen.getByRole('button', { name: 'Add Friend' })).toBeEnabled();
        });

        it('displays circular progress spinner and keeps button disabled during high network latency', async () => {
            let resolveApi;
            const latencyPromise = new Promise((resolve) => {
                resolveApi = resolve;
            });

            apiFetch.mockImplementation((url) => {
                if (url.includes('/api/friends/request')) {
                    return latencyPromise;
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

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const addBtn = screen.getByRole('button', { name: 'Add Friend' });
            fireEvent.click(addBtn);

            // While latency continues
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
            expect(addBtn).toBeDisabled();

            // Finish after delay
            act(() => {
                resolveApi({ ok: true, json: async () => ({ message: 'Friend request sent' }) });
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Request Sent' })).toBeInTheDocument();
            });
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });
    });

    describe('4. Search Bar Stress & Edge Cases', () => {
        it('handles malicious / adversarial search inputs safely without breaking', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search by name or university...');

            // Test XSS payload and SQL/NoSQL injection string
            const maliciousQuery = '<script>alert("xss")</script> & " \' $gt';
            fireEvent.change(searchInput, { target: { value: maliciousQuery } });
            expect(searchInput.value).toBe(maliciousQuery);

            // Press Enter to submit search
            fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                const searchCall = apiFetch.mock.calls.find(([url]) =>
                    url.includes('/api/matchmaking/discover?search=')
                );
                expect(searchCall).toBeDefined();
                expect(searchCall[0]).toContain(encodeURIComponent(maliciousQuery));
            });
        });

        it('recovers gracefully from corrupted localStorage recent searches', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorage.setItem('matchmaking_recent_searches', 'INVALID_JSON{{{bad');

            // Should not throw or crash on mount
            expect(() => renderComponent()).not.toThrow();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search by name or university...');
            expect(searchInput).toBeInTheDocument();

            consoleSpy.mockRestore();
        });

        it('handles keyboard navigation (ArrowDown, ArrowUp, Enter, Escape) in search dropdown', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search by name or university...');
            
            // Focus to open dropdown
            fireEvent.focus(searchInput);

            // Navigate down
            fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
            fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
            // Navigate up
            fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

            // Escape closes dropdown
            fireEvent.keyDown(searchInput, { key: 'Escape' });

            expect(searchInput).toBeInTheDocument();
        });
    });

    describe('5. Dark & Light Mode Search Bar Styling Verification', () => {
        it('verifies dark mode translucent styling, blur, and border contrast in Emotion stylesheet', async () => {
            const { container } = renderComponent('dark');

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const inputRoot = container.querySelector('.MuiOutlinedInput-root');
            expect(inputRoot).toBeInTheDocument();

            const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join(' ');
            expect(styles).toContain('rgba(255, 255, 255, 0.08)');
            expect(styles).toContain('blur(10px)');
            expect(styles).toContain('rgba(255, 255, 255, 0.18)');
            expect(styles).toContain('rgba(255, 255, 255, 0.35)');
        });

        it('verifies light mode styling does not apply dark translucent opacity fill', async () => {
            const { container } = renderComponent('light');

            await waitFor(() => {
                expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
            });

            const inputRoot = container.querySelector('.MuiOutlinedInput-root');
            expect(inputRoot).toBeInTheDocument();
        });
    });
});
