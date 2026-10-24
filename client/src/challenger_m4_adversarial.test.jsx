import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Components under adversarial review
import FriendActionButton from './components/FriendActionButton';
import UmpireDigitalPad from './components/UmpireDigitalPad';
import CourtQueueViewer from './components/CourtQueueViewer';
import TournamentBracket from './components/TournamentBracket';
import CommunityDirectory from './pages/CommunityDirectory';
import FriendsTab from './components/profile/FriendsTab';
import Messages from './pages/Messages';

// Utilities and Contexts
import apiFetch from './utils/api';
import { toast } from 'react-hot-toast';
import { AuthContext } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Hoisted mocks for Vitest
const { mockSocketListeners, mockSocketInstance } = vi.hoisted(() => {
    const listeners = {};
    const instance = {
        emit: vi.fn(),
        on: vi.fn((event, cb) => {
            listeners[event] = cb;
        }),
        off: vi.fn((event) => {
            delete listeners[event];
        }),
    };
    return { mockSocketListeners: listeners, mockSocketInstance: instance };
});

vi.mock('./utils/socket', () => ({
    default: mockSocketInstance,
}));

vi.mock('./utils/api', () => ({
    default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// ============================================================================
// MATHEMATICAL RELATIVE LUMINANCE & CONTRAST RATIO AUDIT (W3C WCAG 2.1)
// ============================================================================
function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(x => x + x).join('');
    }
    const num = parseInt(cleanHex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function calculateRelativeLuminance(rgb) {
    const [r, g, b] = rgb;
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function calculateWcagContrast(hex1, hex2) {
    const L1 = calculateRelativeLuminance(hexToRgb(hex1));
    const L2 = calculateRelativeLuminance(hexToRgb(hex2));
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

// Blend translucent color on background for contrast audit
function blendColors(fgHex, bgHex, alpha) {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    const blended = [
        Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
        Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
        Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
    ];
    return blended;
}

function calculateTranslucentContrast(fgHex, bgHex, alpha) {
    const blendedRgb = blendColors(fgHex, bgHex, alpha);
    const L1 = calculateRelativeLuminance(blendedRgb);
    const L2 = calculateRelativeLuminance(hexToRgb(bgHex));
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

describe('Adversarial Challenge Suite — Milestone 4 (challenger_2_m4_10)', () => {
    const mockUser = {
        id: 'usr_adversarial_tester',
        name: 'Adversarial Tester',
    };

    const renderWithAuth = (ui, authValue = { user: mockUser }) => {
        return render(
            <AuthContext.Provider value={authValue}>
                {ui}
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(key => delete mockSocketListeners[key]);
        if (typeof window !== 'undefined') {
            window.socket = mockSocketInstance;
        }
    });

    // ========================================================================
    // CHALLENGE 1: FRIEND ACTION BUTTON RAPID BURST CONTENTION & CONCURRENCY
    // ========================================================================
    describe('Challenge 1: Friend Action Button Rapid Burst Contention & Rollbacks', () => {
        it('suppresses rapid synchronous burst of 15 clicks to exactly 1 API call and renders spinner', async () => {
            let resolveApi;
            apiFetch.mockImplementation(
                () => new Promise((res) => { resolveApi = res; })
            );

            const onStatusChange = vi.fn();
            const { container } = renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_burst_1"
                    targetUserName="Dave"
                    initialStatus="none"
                    onStatusChange={onStatusChange}
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for dave/i });
            expect(btn).not.toBeDisabled();

            // Fire 15 rapid synchronous clicks in a burst
            for (let i = 0; i < 15; i++) {
                fireEvent.click(btn);
            }

            // Empirical verification: Exactly 1 API call made
            expect(apiFetch).toHaveBeenCalledTimes(1);

            // Verify call signature and idempotency header
            const callArgs = apiFetch.mock.calls[0];
            expect(callArgs[0]).toBe('/api/friends/request');
            expect(callArgs[1].headers).toHaveProperty('Idempotency-Key');
            expect(callArgs[1].headers['Idempotency-Key']).toMatch(/^friend-req-usr_adversarial_tester-target_player_burst_1-\d+-[a-z0-9]+$/);
            expect(JSON.parse(callArgs[1].body)).toEqual({
                recipientId: 'target_player_burst_1',
                friendId: 'target_player_burst_1',
            });

            // Button must immediately reflect disabled optimistic state and show spinner
            expect(btn).toBeDisabled();
            expect(btn).toHaveTextContent('Request Sent');
            expect(container.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();

            // Resolve promise and verify transition
            resolveApi({ ok: true, json: async () => ({ message: 'Request sent successfully' }) });

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Friend request sent to Dave!');
            });

            expect(btn).toBeDisabled();
            expect(btn).toHaveTextContent('Request Sent');
            expect(container.querySelector('.MuiCircularProgress-root')).toBeNull();
            expect(apiFetch).toHaveBeenCalledTimes(1);
        });

        it('suppresses rapid asynchronous burst clicks during in-flight network latency', async () => {
            let resolveApi;
            apiFetch.mockImplementation(
                () => new Promise((res) => { resolveApi = res; })
            );

            renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_async_2"
                    targetUserName="Bob"
                    initialStatus="none"
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for bob/i });
            fireEvent.click(btn);
            expect(apiFetch).toHaveBeenCalledTimes(1);
            expect(btn).toBeDisabled();

            // Simulate rapid user clicks while promise is in-flight
            for (let i = 0; i < 10; i++) {
                fireEvent.click(btn);
            }

            expect(apiFetch).toHaveBeenCalledTimes(1);

            resolveApi({ ok: true, json: async () => ({ message: 'Request sent' }) });

            await waitFor(() => {
                expect(btn).toHaveTextContent('Request Sent');
            });
            expect(apiFetch).toHaveBeenCalledTimes(1);
        });

        it('handles 12 rapid clicks on "Accept Request" with immediate optimistic UI and 1 API call', async () => {
            let resolveApi;
            apiFetch.mockImplementation(
                () => new Promise((res) => { resolveApi = res; })
            );

            const onStatusChange = vi.fn();
            renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_accept_3"
                    targetUserName="Carol"
                    initialStatus="request_received"
                    onStatusChange={onStatusChange}
                />
            );

            const btn = screen.getByRole('button', { name: /accept request for carol/i });

            for (let i = 0; i < 12; i++) {
                fireEvent.click(btn);
            }

            expect(apiFetch).toHaveBeenCalledTimes(1);
            expect(apiFetch.mock.calls[0][0]).toBe('/api/friends/accept');
            expect(onStatusChange).toHaveBeenCalledWith('friends', 'target_player_accept_3');
            expect(btn).toHaveTextContent('Friends');
            expect(btn).toBeDisabled();

            resolveApi({ ok: true, json: async () => ({ message: 'Accepted' }) });

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('You and Carol are now friends!');
            });
            expect(apiFetch).toHaveBeenCalledTimes(1);
        });

        it('handles HTTP 400 Bad Request error rollback after burst clicks', async () => {
            apiFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ message: 'Cannot friend yourself or invalid user ID' }),
            });

            const onStatusChange = vi.fn();
            renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_err_400"
                    targetUserName="Mallory"
                    initialStatus="none"
                    onStatusChange={onStatusChange}
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for mallory/i });

            // Burst clicks
            for (let i = 0; i < 5; i++) {
                fireEvent.click(btn);
            }
            expect(apiFetch).toHaveBeenCalledTimes(1);

            // Await rollback
            await waitFor(() => {
                expect(onStatusChange).toHaveBeenLastCalledWith('none', 'target_player_err_400');
                expect(btn).toHaveTextContent('Add Friend');
                expect(btn).not.toBeDisabled();
                expect(toast.error).toHaveBeenCalledWith('Cannot friend yourself or invalid user ID');
            });
        });

        it('handles HTTP 409 Conflict rollback after burst clicks', async () => {
            apiFetch.mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ message: 'Friend request already exists' }),
            });

            const onStatusChange = vi.fn();
            renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_err_409"
                    targetUserName="Frank"
                    initialStatus="none"
                    onStatusChange={onStatusChange}
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for frank/i });
            for (let i = 0; i < 8; i++) {
                fireEvent.click(btn);
            }
            expect(apiFetch).toHaveBeenCalledTimes(1);

            await waitFor(() => {
                expect(onStatusChange).toHaveBeenLastCalledWith('none', 'target_player_err_409');
                expect(btn).toHaveTextContent('Add Friend');
                expect(btn).not.toBeDisabled();
                expect(toast.error).toHaveBeenCalledWith('Friend request already exists');
            });
        });

        it('handles HTTP 409 "Request already sent" error by gracefully pinning pending status', async () => {
            apiFetch.mockRejectedValueOnce(new Error('Request already sent'));

            const onStatusChange = vi.fn();
            renderWithAuth(
                <FriendActionButton
                    targetUserId="target_player_already_sent"
                    targetUserName="Grace"
                    initialStatus="none"
                    onStatusChange={onStatusChange}
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for grace/i });
            fireEvent.click(btn);

            await waitFor(() => {
                // If backend returns 'Request already sent', status stays 'pending' without error toast
                expect(btn).toHaveTextContent('Request Sent');
                expect(btn).toBeDisabled();
                expect(toast.error).not.toHaveBeenCalled();
            });
        });

        it('survives component unmount while burst API call is in flight without throwing memory leaks', async () => {
            let resolveApi;
            apiFetch.mockImplementation(
                () => new Promise((res) => { resolveApi = res; })
            );

            const { unmount } = renderWithAuth(
                <FriendActionButton
                    targetUserId="target_unmount_test"
                    targetUserName="Heidi"
                    initialStatus="none"
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for heidi/i });
            for (let i = 0; i < 5; i++) {
                fireEvent.click(btn);
            }
            expect(apiFetch).toHaveBeenCalledTimes(1);

            // Unmount while API in flight
            unmount();

            // Resolving after unmount should be safe
            expect(() => {
                resolveApi({ ok: true, json: async () => ({ message: 'Success' }) });
            }).not.toThrow();
        });
    });

    // ========================================================================
    // CHALLENGE 2: WCAG 2.1 AA MATHEMATICAL RELATIVE LUMINANCE AUDIT
    // ========================================================================
    describe('Challenge 2: WCAG 2.1 AA Mathematical Relative Luminance Verification', () => {
        // 1. Warning token: #c43c00 vs #ffffff >= 4.5:1
        it('verifies light mode warning token #c43c00 meets >= 4.5:1 against white #ffffff', () => {
            const contrast = calculateWcagContrast('#c43c00', '#ffffff');
            expect(contrast).toBeGreaterThanOrEqual(4.5);
            expect(contrast).toBeGreaterThanOrEqual(5.0);
        });

        // 2. Primary tokens: #004d26 vs light backgrounds >= 4.5:1, #80e27e vs dark background >= 4.5:1
        it('verifies light mode primary #004d26 meets >= 4.5:1 against #ffffff and #f4f6f8', () => {
            const contrastWhite = calculateWcagContrast('#004d26', '#ffffff');
            const contrastDefaultBg = calculateWcagContrast('#004d26', '#f4f6f8');
            expect(contrastWhite).toBeGreaterThanOrEqual(4.5);
            expect(contrastDefaultBg).toBeGreaterThanOrEqual(4.5);
        });

        it('verifies dark mode primary #80e27e meets >= 4.5:1 against deep forest #02120a', () => {
            const contrast = calculateWcagContrast('#80e27e', '#02120a');
            expect(contrast).toBeGreaterThanOrEqual(4.5);
        });

        // 3. Bracket connectors: #64748b >= 3.0:1 on dark canvas (#0d131a) and light canvas (#f8fafc)
        it('verifies non-text bracket connector #64748b meets >= 3.0:1 on dark (#0d131a) and light (#f8fafc)', () => {
            const contrastDarkCanvas = calculateWcagContrast('#64748b', '#0d131a');
            const contrastLightCanvas = calculateWcagContrast('#64748b', '#f8fafc');
            expect(contrastDarkCanvas).toBeGreaterThanOrEqual(3.0);
            expect(contrastLightCanvas).toBeGreaterThanOrEqual(3.0);
        });

        // 4. Universal focus rings: #38bdf8 on dark >= 3.0:1, #004d26 on light >= 3.0:1
        it('verifies universal focus ring tokens meet >= 3.0:1 against respective backgrounds', () => {
            const darkFocusContrast = calculateWcagContrast('#38bdf8', '#02120a');
            const lightFocusContrast = calculateWcagContrast('#004d26', '#ffffff');
            const darkCanvasFocusContrast = calculateWcagContrast('#38bdf8', '#0d131a');

            expect(darkFocusContrast).toBeGreaterThanOrEqual(3.0);
            expect(darkCanvasFocusContrast).toBeGreaterThanOrEqual(3.0);
            expect(lightFocusContrast).toBeGreaterThanOrEqual(3.0);
        });

        // 5. CSS variables and text tokens
        it('verifies CSS variable light accent #7c3aed meets >= 4.5:1 against white #ffffff', () => {
            const contrast = calculateWcagContrast('#7c3aed', '#ffffff');
            expect(contrast).toBeGreaterThanOrEqual(4.5);
        });

        it('verifies text tokens against background meet >= 4.5:1', () => {
            // Light mode text
            const lightTextPrimary = calculateWcagContrast('#1a202c', '#f4f6f8');
            const lightTextSecondary = calculateWcagContrast('#404040', '#f4f6f8');
            expect(lightTextPrimary).toBeGreaterThanOrEqual(4.5);
            expect(lightTextSecondary).toBeGreaterThanOrEqual(4.5);

            // Dark mode text
            const darkTextPrimary = calculateWcagContrast('#ffffff', '#02120a');
            expect(darkTextPrimary).toBeGreaterThanOrEqual(4.5);

            // Dark mode secondary text (80% opacity white on #02120a)
            const darkTextSecondary = calculateTranslucentContrast('#ffffff', '#02120a', 0.8);
            expect(darkTextSecondary).toBeGreaterThanOrEqual(4.5);
        });
    });

    // ========================================================================
    // CHALLENGE 3: REAL-TIME DYNAMIC ARIA LIVE REGION STRESS
    // ========================================================================
    describe('Challenge 3: Real-Time Dynamic ARIA Live Region Stress', () => {
        it('stresses UmpireDigitalPad live announcer across a 15-point scoring sequence and 11-pt technical interval', () => {
            render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const announcer = screen.getByTestId('umpire-aria-live-announcer');
            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer).toHaveAttribute('aria-atomic', 'true');

            const team1Btn = screen.getByTestId('btn-score-team1');

            // Rapidly score 10 points
            for (let pt = 1; pt <= 10; pt++) {
                fireEvent.click(team1Btn);
                expect(announcer.textContent).toBe(
                    `Point scored by Alan Yang. Current score: Alan Yang ${pt}, Kevin Lin 0.`
                );
            }

            // Score 11th point -> BWF 60s technical interval triggers
            fireEvent.click(team1Btn);
            expect(announcer.textContent).toBe('60-second technical interval reached.');

            // Score 12th point -> Normal score resume
            fireEvent.click(team1Btn);
            expect(announcer.textContent).toBe(
                'Point scored by Alan Yang. Current score: Alan Yang 12, Kevin Lin 0.'
            );
        });

        it('verifies game conclusion and match conclusion live announcements in UmpireDigitalPad', () => {
            render(
                <UmpireDigitalPad
                    initialCourtNumber={2}
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const announcer = screen.getByTestId('umpire-aria-live-announcer');
            const team1Btn = screen.getByTestId('btn-score-team1');

            // Score up to 21 points to conclude Game 1
            for (let i = 1; i <= 21; i++) {
                fireEvent.click(team1Btn);
            }

            // Game 1 concludes
            expect(announcer.textContent).toBe('Game 1 concluded.');

            // Start Game 2
            const nextGameBtn = screen.getByRole('button', { name: /start game 2/i });
            fireEvent.click(nextGameBtn);

            // Score up to 21 points to conclude Game 2 and win Match
            for (let i = 1; i <= 21; i++) {
                fireEvent.click(team1Btn);
            }

            expect(announcer.textContent).toBe('Match concluded. Winner: Alan Yang.');
        });

        it('stresses CourtQueueViewer live announcer across rapid walkover timers and court updates', () => {
            render(<CourtQueueViewer />);
            const announcer = screen.getByTestId('court-queue-live-announcer');
            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer).toHaveAttribute('aria-atomic', 'true');

            // Burst 5 walkover timer events
            act(() => {
                for (let court = 1; court <= 5; court++) {
                    mockSocketListeners['walkoverTimerStarted']({
                        courtNumber: court,
                        targetTeam: `team${court}`,
                        targetPlayerName: `Player_${court}`,
                        durationSeconds: 600,
                    });
                }
            });

            // Announcer should reflect the latest walkover event cleanly
            expect(announcer.textContent).toMatch(/Walkover forfeit timer initiated on Court 5 for Player_5/i);
            expect(announcer.textContent).toMatch(/10 minutes remaining/i);

            // Burst 5 court status updates
            act(() => {
                for (let court = 1; court <= 5; court++) {
                    mockSocketListeners['courtStatusUpdate']({
                        courtNumber: court,
                        status: 'MATCH_IN_PROGRESS',
                    });
                }
            });

            expect(announcer.textContent).toBe('Court 5 status updated to MATCH IN PROGRESS');
        });

        it('stresses TournamentBracket live announcer under distributed lock and unlock events', () => {
            render(<TournamentBracket />);
            const announcer = screen.getByTestId('bracket-live-announcer');
            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer).toHaveAttribute('aria-atomic', 'true');

            // Fire lock status updates
            act(() => {
                mockSocketListeners['bracket:lockStatusUpdate']({
                    matchId: 'm-gmu-finals',
                    isLocked: true,
                    lockedBy: 'Umpire Dave',
                });
            });

            expect(announcer.textContent).toBe('Match m-gmu-finals locked by Umpire Dave');

            act(() => {
                mockSocketListeners['bracket:lockStatusUpdate']({
                    matchId: 'm-gmu-finals',
                    isLocked: false,
                });
            });

            expect(announcer.textContent).toBe('Match m-gmu-finals unlocked');
        });
    });

    // ========================================================================
    // CHALLENGE 4: KEYBOARD NAVIGATION & SEMANTICS AUDIT
    // ========================================================================
    describe('Challenge 4: Keyboard Navigation & Semantics Audit', () => {
        it('verifies all tournament bracket match nodes are keyboard accessible with Enter and Space handlers', () => {
            const onMatchSelect = vi.fn();
            render(<TournamentBracket onMatchSelect={onMatchSelect} />);

            const matchNodes = screen.getAllByTestId(/^match-node-/);
            expect(matchNodes.length).toBeGreaterThan(0);

            // Verify role, tabIndex, and aria-label on every single match node
            matchNodes.forEach((node) => {
                expect(node).toHaveAttribute('role', 'button');
                expect(node).toHaveAttribute('tabIndex', '0');
                const ariaLabel = node.getAttribute('aria-label');
                expect(ariaLabel).toBeTruthy();
                expect(ariaLabel).toMatch(/^Match /);
            });

            const firstNode = matchNodes[0];

            // Trigger Enter key
            fireEvent.keyDown(firstNode, { key: 'Enter', code: 'Enter' });
            expect(onMatchSelect).toHaveBeenCalledTimes(1);

            // Trigger Space key
            fireEvent.keyDown(firstNode, { key: ' ', code: 'Space' });
            expect(onMatchSelect).toHaveBeenCalledTimes(2);

            // Unrelated key should NOT trigger selection
            fireEvent.keyDown(firstNode, { key: 'ArrowDown', code: 'ArrowDown' });
            expect(onMatchSelect).toHaveBeenCalledTimes(2);
        });

        it('verifies absence of placeholder aria-label="icon button" across all key components', () => {
            // Render CommunityDirectory
            const { container: commContainer } = render(
                <AuthContext.Provider value={{ user: mockUser }}>
                    <BrowserRouter>
                        <CommunityDirectory />
                    </BrowserRouter>
                </AuthContext.Provider>
            );
            const genericInComm = commContainer.querySelectorAll('[aria-label="icon button"]');
            expect(genericInComm.length).toBe(0);

            // Render FriendsTab
            const { container: friendsContainer } = render(
                <AuthContext.Provider value={{ user: mockUser }}>
                    <BrowserRouter>
                        <FriendsTab user={mockUser} />
                    </BrowserRouter>
                </AuthContext.Provider>
            );
            const genericInFriends = friendsContainer.querySelectorAll('[aria-label="icon button"]');
            expect(genericInFriends.length).toBe(0);

            // Render Messages
            const { container: messagesContainer } = render(
                <AuthContext.Provider value={{ user: mockUser }}>
                    <BrowserRouter>
                        <Messages />
                    </BrowserRouter>
                </AuthContext.Provider>
            );
            const genericInMessages = messagesContainer.querySelectorAll('[aria-label="icon button"]');
            expect(genericInMessages.length).toBe(0);
        });
    });
});
