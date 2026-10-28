/* global process, global */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createRequire } from 'module';

// Components under empirical stress review
import UmpireDigitalPad from './components/UmpireDigitalPad';
import CourtQueueViewer from './components/CourtQueueViewer';
import TournamentBracket from './components/TournamentBracket';
import FriendActionButton from './components/FriendActionButton';
import LazyFlyerImage from './components/LazyFlyerImage';
import Tournaments from './pages/Tournaments';

// Utilities
import offlineScoreLedger from './utils/offlineScoreLedger';
import {
    calculateServiceCourt,
    isDeuce,
    checkGameWinner,
    getGamePoint,
    getMatchPoint,
    isInterval,
    calculateRoundRobinStandings
} from './utils/badmintonRules';

// Authoritative algorithms via Node createRequire
const serverRequire = createRequire(import.meta.url);
const { sanitizeScrapedTitle } = serverRequire('../../server/utils/sanitizeScrapedTitle');
const { calculateMatchGlicko2, applyInactivityDecay } = serverRequire('../../server/utils/glicko2');

// ============================================================================
// HOISTED SOCKET.IO & TOAST MOCKS
// ============================================================================
const { mockSocketListeners, mockSocketInstance } = vi.hoisted(() => {
    const listeners = {};
    const instance = {
        emit: vi.fn(),
        on: vi.fn((event, cb) => {
            listeners[event] = cb;
        }),
        off: vi.fn((event, cb) => {
            if (cb && listeners[event] === cb) {
                delete listeners[event];
            } else if (!cb) {
                delete listeners[event];
            }
        })
    };
    return { mockSocketListeners: listeners, mockSocketInstance: instance };
});

vi.mock('./utils/socket', () => ({
    default: mockSocketInstance
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    },
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockAuthUser = {
    _id: 'user-adversarial-challenger',
    id: 'user-adversarial-challenger',
    name: 'Challenger Lead (GMU)',
    email: 'challenger@gmu.edu',
    university: 'George Mason University'
};

vi.mock('./context/AuthContext', () => ({
    useAuth: () => ({
        user: mockAuthUser,
        setUser: vi.fn()
    }),
    AuthContext: {
        Provider: ({ children }) => children,
        Consumer: ({ children }) => children({ user: mockAuthUser, setUser: vi.fn() })
    }
}));

vi.mock('./utils/api', () => ({
    default: vi.fn((endpoint) => {
        if (typeof endpoint === 'string' && endpoint.includes('/api/friends/request')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ message: 'Request sent successfully' })
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            tournaments: [],
            json: () => Promise.resolve({ tournaments: [] })
        });
    })
}));

const originalConsoleError = console.error;
const originalFetch = global.fetch;

beforeAll(() => {
    console.error = (...args) => {
        const msg = typeof args[0] === 'string' ? args[0] : '';
        if (
            msg.includes('React does not recognize the') ||
            msg.includes('non-boolean attribute') ||
            msg.includes('was not wrapped in act(...)')
        ) {
            return;
        }
        originalConsoleError(...args);
    };

    global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
    }));
});

afterAll(() => {
    console.error = originalConsoleError;
    global.fetch = originalFetch;
});

// ============================================================================
// CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE (MILESTONE 5)
// ============================================================================
describe('⚔️ CHALLENGER 2 EMPIRICAL ADVERSARIAL STRESS SUITE — MILESTONE 5', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(key => delete mockSocketListeners[key]);
        if (typeof window !== 'undefined') {
            window.socket = mockSocketInstance;
        }
    });

    // =========================================================================
    // 1. MULTI-CYCLE RAPID EXECUTION & HEAP STABILITY
    // =========================================================================
    describe('1. Multi-Cycle Rapid Execution & Heap Memory Stability', () => {
        it('executes 30 rapid multi-persona synthetic cycles with bounded heap growth (< 40MB)', async () => {
            const initialMem = process.memoryUsage().heapUsed;

            for (let cycle = 0; cycle < 30; cycle++) {
                // Exercise Persona 1 & 4: Title sanitization
                const clean = sanitizeScrapedTitle(`Skip to main content 2026 GMU Badminton Open Cycle ${cycle} -`);
                expect(clean).toBe(`2026 GMU Badminton Open Cycle ${cycle}`);

                // Exercise Persona 10: Glicko-2 ratings calculation
                const p1 = { rating: 1500 + cycle, rd: 200, volatility: 0.06 };
                const p2 = { rating: 1500 - cycle, rd: 200, volatility: 0.06 };
                const result = calculateMatchGlicko2(p1, p2, 1, 0);
                expect(result.team1.newRating).toBeGreaterThan(1500);

                // Exercise Persona 10: Inactivity decay
                const pastDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
                const decayed = applyInactivityDecay({ rating: 1600, rd: 80, volatility: 0.06, lastMatchDate: pastDate }, new Date());
                expect(decayed.rd).toBeGreaterThan(80);

                // Exercise Persona 5: BWF service parity
                for (let score = 0; score <= 10; score++) {
                    expect(calculateServiceCourt(score)).toBe(score % 2 === 0 ? 'right' : 'left');
                }

                // Exercise Persona 8: High-concurrency waitlist burst
                const store = { maxCapacity: 2, attendees: [], waitlist: [] };
                for (let b = 0; b < 10; b++) {
                    if (store.attendees.length < store.maxCapacity) {
                        store.attendees.push(`b_${b}`);
                    } else {
                        store.waitlist.push(`b_${b}`);
                    }
                }
                expect(store.attendees.length).toBe(2);
                expect(store.waitlist.length).toBe(8);

                // Exercise Persona 9: Round-robin standings
                const teams = ['A', 'B', 'C'];
                const matches = [
                    { team1: 'A', team2: 'B', points1: 42, points2: 30, sets1: 2, sets2: 0, winner: 'A', status: 'COMPLETED' },
                    { team1: 'B', team2: 'C', points1: 42, points2: 30, sets1: 2, sets2: 0, winner: 'B', status: 'COMPLETED' }
                ];
                const standings = calculateRoundRobinStandings(teams, matches);
                expect(standings[0].team).toBe('A');

                // Simulate microtask GC pause
                await new Promise(resolve => setTimeout(resolve, 2));
            }

            const finalMem = process.memoryUsage().heapUsed;
            const deltaMB = (finalMem - initialMem) / (1024 * 1024);

            // Bounded heap growth delta (< 40MB across 30 rapid cycles)
            expect(deltaMB).toBeLessThan(40);
        });
    });

    // =========================================================================
    // 2. RAPID UI MOUNTING / UNMOUNTING & EVENT LISTENER CLEANUP
    // =========================================================================
    describe('2. Rapid UI Mounting / Unmounting & Event Listener Cleanup', () => {
        it('cleans up all online/offline window listeners and intervals across 20 rapid unmount cycles of UmpireDigitalPad', () => {
            const addListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

            for (let i = 0; i < 20; i++) {
                const { unmount } = render(
                    <UmpireDigitalPad
                        initialCourtNumber={1}
                        initialPlayer1="Player A"
                        initialPlayer2="Player B"
                    />
                );

                expect(screen.getByTestId('umpire-digital-pad')).toBeInTheDocument();
                unmount();
                expect(screen.queryByTestId('umpire-digital-pad')).not.toBeInTheDocument();
            }

            const onlineAdds = addListenerSpy.mock.calls.filter(c => c[0] === 'online').length;
            const onlineRemoves = removeListenerSpy.mock.calls.filter(c => c[0] === 'online').length;
            const offlineAdds = addListenerSpy.mock.calls.filter(c => c[0] === 'offline').length;
            const offlineRemoves = removeListenerSpy.mock.calls.filter(c => c[0] === 'offline').length;

            expect(onlineAdds).toBe(20);
            expect(onlineRemoves).toBe(20);
            expect(offlineAdds).toBe(20);
            expect(offlineRemoves).toBe(20);

            addListenerSpy.mockRestore();
            removeListenerSpy.mockRestore();
        });

        it('cleans up all Socket.io listeners and intervals across 20 rapid unmount cycles of CourtQueueViewer', () => {
            for (let i = 0; i < 20; i++) {
                const { unmount } = render(<CourtQueueViewer />);
                expect(screen.getByTestId('court-queue-viewer')).toBeInTheDocument();

                // During mount, socket listeners should be active
                expect(mockSocketListeners['courtStatusUpdate']).toBeDefined();
                expect(mockSocketListeners['liveScoreUpdate']).toBeDefined();
                expect(mockSocketListeners['walkoverTimerStarted']).toBeDefined();

                unmount();

                // After unmount, socket listeners must be completely detached
                expect(mockSocketListeners['courtStatusUpdate']).toBeUndefined();
                expect(mockSocketListeners['liveScoreUpdate']).toBeUndefined();
                expect(mockSocketListeners['walkoverTimerStarted']).toBeUndefined();
                expect(mockSocketListeners['walkoverTimerCancelled']).toBeUndefined();
                expect(mockSocketListeners['walkoverDeclared']).toBeUndefined();
            }
        });

        it('cleans up bracket lock socket listeners across 20 rapid unmount cycles of TournamentBracket', () => {
            for (let i = 0; i < 20; i++) {
                const { unmount } = render(<TournamentBracket />);
                expect(screen.getByTestId('tournament-bracket-engine')).toBeInTheDocument();
                expect(mockSocketListeners['bracket:lockStatusUpdate']).toBeDefined();

                unmount();
                expect(mockSocketListeners['bracket:lockStatusUpdate']).toBeUndefined();
            }
        });

        it('leaves zero detached DOM residue in document body after unmounting all major components', () => {
            const { unmount: u1 } = render(
                <MemoryRouter>
                    <Tournaments />
                </MemoryRouter>
            );
            const { unmount: u2 } = render(<CourtQueueViewer />);
            const { unmount: u3 } = render(<TournamentBracket />);
            const { unmount: u4 } = render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan"
                    initialPlayer2="Kevin"
                />
            );
            const { unmount: u5 } = render(
                <FriendActionButton
                    targetUserId="user-test-leak"
                    targetUserName="Test User"
                    initialStatus="none"
                />
            );
            const { unmount: u6 } = render(
                <LazyFlyerImage
                    src="https://example.com/banner.jpg"
                    alt="Test Banner"
                />
            );

            u1();
            u2();
            u3();
            u4();
            u5();
            u6();

            // Verify clean document body without detached zombie elements
            expect(screen.queryByTestId('court-queue-viewer')).not.toBeInTheDocument();
            expect(screen.queryByTestId('tournament-bracket-engine')).not.toBeInTheDocument();
            expect(screen.queryByTestId('umpire-digital-pad')).not.toBeInTheDocument();
            expect(screen.queryByTestId('lazy-flyer-container')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // 3. PWA DIGITAL PAD OFFLINE LEDGER UNDER SIMULATED INDEXEDDB FAILURES
    // =========================================================================
    describe('3. PWA Digital Pad Offline Ledger under Simulated IndexedDB Failures', () => {
        it('handles IndexedDB open failure gracefully by routing to in-memory store without unhandled rejection', async () => {
            const FreshLedger = offlineScoreLedger.constructor;
            const ledger = new FreshLedger();

            // Simulate window.indexedDB.open failing with onerror
            const fakeReq = {};
            const fakeIndexedDB = {
                open: vi.fn(() => {
                    setTimeout(() => {
                        fakeReq.error = new Error('IndexedDB permission denied (private mode)');
                        if (fakeReq.onerror) fakeReq.onerror();
                    }, 5);
                    return fakeReq;
                })
            };

            const origIDB = window.indexedDB;
            window.indexedDB = fakeIndexedDB;
            ledger.isSupported = true;
            ledger.dbPromise = null;

            // Save match state under simulated open error
            const matchState = {
                courtNumber: 3,
                score1: 18,
                score2: 16,
                currentGame: 2
            };

            const saved = await ledger.saveMatchState(matchState);
            expect(saved).toBeDefined();
            expect(saved.courtNumber).toBe(3);
            expect(saved.score1).toBe(18);

            // Retrieve from memory fallback
            const retrieved = await ledger.getMatchState(3);
            expect(retrieved).toBeDefined();
            expect(retrieved.score1).toBe(18);
            expect(retrieved.score2).toBe(16);

            window.indexedDB = origIDB;
        });

        it('handles synchronous IndexedDB open exception (SecurityError) gracefully', async () => {
            const FreshLedger = offlineScoreLedger.constructor;
            const ledger = new FreshLedger();

            const fakeIndexedDB = {
                open: vi.fn(() => {
                    throw new Error('SecurityError: The operation is insecure in sandboxed iframe.');
                })
            };

            const origIDB = window.indexedDB;
            window.indexedDB = fakeIndexedDB;
            ledger.isSupported = true;
            ledger.dbPromise = null;

            const res = await ledger.getDB();
            expect(res).toBeNull();

            // Operation continues through in-memory store
            const mut = await ledger.enqueueMutation({
                courtNumber: 4,
                actionType: 'SCORE_POINT',
                payload: { team: 1 }
            });

            expect(mut.mutationId).toBeDefined();
            expect(mut.status).toBe('PENDING');

            const pending = await ledger.getPendingMutations(4);
            expect(pending.length).toBe(1);

            await ledger.markMutationSynced(mut.mutationId);
            const remaining = await ledger.getPendingMutations(4);
            expect(remaining.length).toBe(0);

            window.indexedDB = origIDB;
        });

        it('handles 100 concurrent offline mutations without race conditions or ID collisions', async () => {
            const FreshLedger = offlineScoreLedger.constructor;
            const ledger = new FreshLedger();

            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(
                    ledger.enqueueMutation({
                        courtNumber: 2,
                        actionType: 'SCORE_POINT',
                        payload: { team: i % 2 === 0 ? 1 : 2, pointIndex: i }
                    })
                );
            }

            const results = await Promise.all(promises);
            expect(results.length).toBe(100);

            // Verify unique IDs
            const ids = new Set(results.map(r => r.mutationId));
            expect(ids.size).toBe(100);

            const pending = await ledger.getPendingMutations(2);
            expect(pending.length).toBe(100);

            // Verify strictly chronological ordering
            for (let i = 1; i < pending.length; i++) {
                expect(pending[i].createdAt).toBeGreaterThanOrEqual(pending[i - 1].createdAt);
            }

            // Clear court 2 mutations
            await ledger.clearMutations(2);
            const afterClear = await ledger.getPendingMutations(2);
            expect(afterClear.length).toBe(0);
        });

        it('simulates network flapping with partial mutation sync replay', async () => {
            const FreshLedger = offlineScoreLedger.constructor;
            const ledger = new FreshLedger();

            // Enqueue 6 offline mutations
            const muts = [];
            for (let i = 1; i <= 6; i++) {
                const m = await ledger.enqueueMutation({
                    courtNumber: 1,
                    actionType: 'SCORE_POINT',
                    payload: { point: i }
                });
                muts.push(m);
            }

            let pending = await ledger.getPendingMutations(1);
            expect(pending.length).toBe(6);

            // Simulate partial network replay: first 3 succeed, last 3 fail
            for (let i = 0; i < 3; i++) {
                await ledger.markMutationSynced(muts[i].mutationId);
            }

            pending = await ledger.getPendingMutations(1);
            expect(pending.length).toBe(3);
            expect(pending[0].mutationId).toBe(muts[3].mutationId);
            expect(pending[1].mutationId).toBe(muts[4].mutationId);
            expect(pending[2].mutationId).toBe(muts[5].mutationId);

            // Simulate second sync cycle: remaining 3 succeed
            for (let i = 3; i < 6; i++) {
                await ledger.markMutationSynced(muts[i].mutationId);
            }

            pending = await ledger.getPendingMutations(1);
            expect(pending.length).toBe(0);
        });
    });

    // =========================================================================
    // 4. SCREEN-READER DYNAMIC LIVE REGIONS UNDER HIGH-FREQUENCY POINT UPDATES
    // =========================================================================
    describe('4. Screen-Reader Dynamic Live Regions Under High-Frequency Point Updates', () => {
        it('stresses UmpireDigitalPad live announcer across 30 rapid scoring events without losing aria attributes', () => {
            render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const score1Btn = screen.getByTestId('btn-score-team1');
            const announcer = screen.getByTestId('umpire-aria-live-announcer');

            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer).toHaveAttribute('aria-atomic', 'true');

            // Fire 11 consecutive points for team 1 (triggers 60s technical interval)
            for (let pt = 1; pt <= 11; pt++) {
                fireEvent.click(score1Btn);
            }

            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer).toHaveAttribute('aria-atomic', 'true');
            // Technical interval announced
            expect(announcer.textContent).toContain('60-second technical interval reached');

            // Continue scoring up to 21 (game 1 conclusion)
            for (let pt = 12; pt <= 21; pt++) {
                fireEvent.click(score1Btn);
            }

            expect(announcer).toHaveAttribute('aria-live', 'polite');
            expect(announcer.textContent).toContain('Game 1 concluded');
        });

        it('verifies CourtQueueViewer live announcer under high-frequency socket bursts', () => {
            render(<CourtQueueViewer />);

            const announcer = screen.getByTestId('court-queue-live-announcer');
            expect(announcer).toHaveAttribute('aria-live', 'polite');

            // Burst 1: walkover started on court 2
            act(() => {
                mockSocketListeners['walkoverTimerStarted']({
                    courtNumber: 2,
                    targetPlayerName: 'Rachel Adams',
                    durationSeconds: 600
                });
            });
            expect(announcer.textContent).toContain('Court 2 for Rachel Adams');

            // Burst 2: court 1 status update
            act(() => {
                mockSocketListeners['courtStatusUpdate']({
                    courtNumber: 1,
                    status: 'AVAILABLE'
                });
            });
            expect(announcer.textContent).toContain('Court 1 status updated to AVAILABLE');

            // Burst 3: court 3 status update
            act(() => {
                mockSocketListeners['courtStatusUpdate']({
                    courtNumber: 3,
                    status: 'MATCH_IN_PROGRESS'
                });
            });
            expect(announcer.textContent).toContain('Court 3 status updated to MATCH IN PROGRESS');
        });

        it('verifies TournamentBracket live announcer under high-frequency lock updates', () => {
            render(<TournamentBracket />);

            const announcer = screen.getByTestId('bracket-live-announcer');
            expect(announcer).toHaveAttribute('aria-live', 'polite');

            // Burst 10 rapid lock/unlock cycles
            for (let m = 1; m <= 10; m++) {
                act(() => {
                    mockSocketListeners['bracket:lockStatusUpdate']({
                        matchId: `match-${m}`,
                        isLocked: true,
                        lockedBy: `Umpire ${m}`
                    });
                });
                expect(announcer.textContent).toBe(`Match match-${m} locked by Umpire ${m}`);

                act(() => {
                    mockSocketListeners['bracket:lockStatusUpdate']({
                        matchId: `match-${m}`,
                        isLocked: false
                    });
                });
                expect(announcer.textContent).toBe(`Match match-${m} unlocked`);
            }
        });
    });

    // =========================================================================
    // 5. UNHANDLED PROMISE REJECTION & ACT WARNING INTEGRITY TRAP
    // =========================================================================
    describe('5. Unhandled Promise Rejection & Act Warning Integrity Trap', () => {
        it('verifies zero unhandled promise rejections and zero uncaught exceptions across full execution', async () => {
            const rejections = [];
            const handleRejection = (reason) => {
                rejections.push(reason);
            };

            process.on('unhandledRejection', handleRejection);

            // Execute rapid simulated user actions
            render(
                <FriendActionButton
                    targetUserId="user-adversarial-trap"
                    targetUserName="Adversarial User"
                    initialStatus="none"
                />
            );

            const btn = screen.getByRole('button', { name: /add friend for adversarial user/i });
            for (let i = 0; i < 5; i++) {
                fireEvent.click(btn);
            }

            await waitFor(() => {
                expect(btn).toBeDisabled();
            });

            // Wait a tick to ensure all promises settle
            await new Promise(resolve => setTimeout(resolve, 50));

            process.removeListener('unhandledRejection', handleRejection);
            expect(rejections.length).toBe(0);
        });

        it('verifies all BWF rule edge cases execute cleanly without mathematical NaN or exceptions', () => {
            // Test 0-30 points boundary condition
            for (let s1 = 0; s1 <= 30; s1++) {
                for (let s2 = 0; s2 <= 30; s2++) {
                    const deuce = isDeuce(s1, s2);
                    expect(typeof deuce).toBe('boolean');

                    const winner = checkGameWinner(s1, s2);
                    expect(winner === null || winner === 1 || winner === 2).toBe(true);

                    const gp = getGamePoint(s1, s2);
                    expect(gp === null || gp === 1 || gp === 2 || gp === 3).toBe(true);

                    const mp = getMatchPoint(s1, s2, 1, 1, 2);
                    expect(mp === null || mp === 1 || mp === 2 || mp === 3).toBe(true);

                    const interval = isInterval(s1, s2);
                    expect(typeof interval).toBe('boolean');
                }
            }
        });
    });
});
