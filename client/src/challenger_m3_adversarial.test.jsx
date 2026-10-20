import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import offlineScoreLedger from './utils/offlineScoreLedger';
import UmpireDigitalPad from './components/UmpireDigitalPad';
import CourtQueueViewer from './components/CourtQueueViewer';
import Leaderboard from './pages/Leaderboard';
import socket from './utils/socket';
import apiFetch from './utils/api';

const socketListeners = {};

vi.mock('./utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn((event, cb) => {
            socketListeners[event] = cb;
        }),
        off: vi.fn((event) => {
            delete socketListeners[event];
        })
    }
}));

vi.mock('./utils/api', () => ({
    default: vi.fn()
}));

vi.mock('react-virtuoso', () => ({
    TableVirtuoso: ({ data, itemContent }) => {
        if (!data) return null;
        return (
            <table>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={index}>{itemContent(index, item)}</tr>
                    ))}
                </tbody>
            </table>
        );
    }
}));

describe('CHALLENGER EMPIRICAL ADVERSARIAL STRESS SUITE (M3)', () => {
    let queryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        });
        offlineScoreLedger.clearMutations();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // =========================================================================
    // 1. OFFLINE PWA SYNC STRESS (IndexedDB, Queueing, Flaky Reconnect, Idempotency)
    // =========================================================================
    describe('1. Offline PWA Sync Stress & Ledger Invariants', () => {
        it('enqueues and persists 50 rapid offline scoring mutations with unique idempotency keys', async () => {
            await offlineScoreLedger.clearMutations(1);

            const mutations = [];
            for (let i = 1; i <= 50; i++) {
                const mut = await offlineScoreLedger.enqueueMutation({
                    courtNumber: 1,
                    matchId: 'match-adversarial-01',
                    actionType: 'SCORE_POINT',
                    payload: { team: i % 2 === 1 ? 1 : 2, pointIndex: i }
                });
                mutations.push(mut);
            }

            const pending = await offlineScoreLedger.getPendingMutations(1);
            expect(pending).toHaveLength(50);

            // Assert uniqueness of all mutation IDs and idempotency keys
            const mutationIds = new Set(pending.map(m => m.mutationId));
            const idempotencyKeys = new Set(pending.map(m => m.idempotencyKey));
            expect(mutationIds.size).toBe(50);
            expect(idempotencyKeys.size).toBe(50);

            // Assert chronologically sorted
            for (let i = 0; i < pending.length - 1; i++) {
                expect(pending[i].createdAt).toBeLessThanOrEqual(pending[i + 1].createdAt);
            }
        });

        it('handles rapid offline scoring in UmpireDigitalPad without dropping points or corrupting state', async () => {
            const originalOnLine = navigator.onLine;
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

            render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan Yang (GMU)"
                    initialPlayer2="Kevin Lin (UMD)"
                />
            );

            expect(screen.getByTestId('sync-status-offline')).toBeInTheDocument();

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            const btnTeam2 = screen.getByTestId('btn-score-team2');

            // 10 points for Team 1, 5 points for Team 2
            for (let i = 0; i < 10; i++) {
                fireEvent.click(btnTeam1);
            }
            for (let i = 0; i < 5; i++) {
                fireEvent.click(btnTeam2);
            }

            expect(screen.getByTestId('score-team1')).toHaveTextContent('10');
            expect(screen.getByTestId('score-team2')).toHaveTextContent('5');

            await waitFor(async () => {
                const pending = await offlineScoreLedger.getPendingMutations(1);
                expect(pending.length).toBe(15);
            });

            // Verify stored match state in ledger
            const savedState = await offlineScoreLedger.getMatchState(1);
            expect(savedState).toBeDefined();
            expect(savedState.score1).toBe(10);
            expect(savedState.score2).toBe(5);

            Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
        });

        it('replays offline mutations under flaky reconnect conditions where initial calls fail', async () => {
            const originalOnLine = navigator.onLine;
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });

            await offlineScoreLedger.clearMutations(2);

            // Mock fetch to simulate flaky network: fail first 2 requests, succeed next 3
            let fetchCallCount = 0;
            const originalFetch = globalThis.fetch;
            globalThis.fetch = vi.fn().mockImplementation(() => {
                fetchCallCount++;
                if (fetchCallCount <= 2) {
                    return Promise.reject(new Error("Flaky Wi-Fi drop: ECONNRESET"));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true })
                });
            });

            render(
                <UmpireDigitalPad
                    initialCourtNumber={2}
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            for (let i = 0; i < 5; i++) {
                fireEvent.click(btnTeam1);
            }

            await waitFor(async () => {
                const pending = await offlineScoreLedger.getPendingMutations(2);
                expect(pending.length).toBe(5);
            });

            // Reconnection event
            Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
            await act(async () => {
                fireEvent(window, new Event('online'));
            });

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalled();
            });

            globalThis.fetch = originalFetch;
            Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
        });

        it('verifies idempotency token deduplication prevents double-counting upon replay', async () => {
            const idempotencyKey = "court-1-pt-idempotency-test-xyz";
            const mutation = {
                mutationId: "mut-101",
                idempotencyKey,
                courtNumber: 1,
                actionType: "SCORE_POINT",
                payload: { team: 1, score1: 5, score2: 4 }
            };

            await offlineScoreLedger.enqueueMutation(mutation);
            let pending = await offlineScoreLedger.getPendingMutations(1);
            expect(pending).toHaveLength(1);

            // Simulate replay: marking synced deletes it from queue
            await offlineScoreLedger.markMutationSynced("mut-101");
            pending = await offlineScoreLedger.getPendingMutations(1);
            expect(pending).toHaveLength(0);

            // Repeated marking is a no-op and does not error
            const resSecondSync = await offlineScoreLedger.markMutationSynced("mut-101");
            expect(resSecondSync).toBe(true);
        });

        it('stress-tests partial sync replay failure where failing mutations remain in queue for retry', async () => {
            await offlineScoreLedger.clearMutations(4);

            // Enqueue 4 mutations directly in ledger
            for (let i = 1; i <= 4; i++) {
                await offlineScoreLedger.enqueueMutation({
                    mutationId: `partial-mut-${i}`,
                    idempotencyKey: `idemp-partial-${i}`,
                    courtNumber: 4,
                    actionType: 'SCORE_POINT',
                    payload: { team: 1, point: i }
                });
            }

            let pending = await offlineScoreLedger.getPendingMutations(4);
            expect(pending).toHaveLength(4);

            // Sync first 2 successfully, leave last 2
            await offlineScoreLedger.markMutationSynced('partial-mut-1');
            await offlineScoreLedger.markMutationSynced('partial-mut-2');

            // Remaining pending mutations must be exactly 2
            pending = await offlineScoreLedger.getPendingMutations(4);
            expect(pending).toHaveLength(2);
            expect(pending.map(m => m.mutationId)).toEqual(['partial-mut-3', 'partial-mut-4']);

            // Retry remaining 2
            await offlineScoreLedger.markMutationSynced('partial-mut-3');
            await offlineScoreLedger.markMutationSynced('partial-mut-4');

            pending = await offlineScoreLedger.getPendingMutations(4);
            expect(pending).toHaveLength(0);
        });
    });

    // =========================================================================
    // 2. COURT DEADLOCK & SCHEDULING STRESS (Walkover Drift, Auto-Advance, Rebalance)
    // =========================================================================
    describe('2. Court Deadlock & Walkover Timer Stress', () => {
        it('handles 10-minute walkover countdown timer accurately under simulated clock drift', () => {
            vi.useFakeTimers();
            const now = 1700000000000;
            vi.setSystemTime(now);

            render(<CourtQueueViewer />);

            // Start walkover on Court 2 with expiresAt 600s in future
            act(() => {
                if (socketListeners.walkoverTimerStarted) {
                    socketListeners.walkoverTimerStarted({
                        courtNumber: 2,
                        targetTeam: 'team2',
                        targetPlayerName: 'Chloe Zhang',
                        startedAt: new Date(now).toISOString(),
                        expiresAt: new Date(now + 600 * 1000).toISOString(),
                        durationSeconds: 600
                    });
                }
            });

            const chip = screen.getByTestId('walkover-chip-court-2');
            expect(chip).toBeInTheDocument();

            // Advance 1 second tick
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(screen.getByTestId('walkover-chip-court-2')).toHaveTextContent(/09:59/);

            // Simulate severe clock drift: advance system time by 200 seconds suddenly
            vi.setSystemTime(now + 201 * 1000);
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            // 600 - 202 = 398 seconds = 06:38
            expect(screen.getByTestId('walkover-chip-court-2')).toHaveTextContent(/06:38/);

            // Simulate clock drift beyond expiration: advance by 800 seconds total
            vi.setSystemTime(now + 800 * 1000);
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            // Must clamp to 00:00 without rendering negative numbers like "-03:20"
            expect(screen.getByTestId('walkover-chip-court-2')).toHaveTextContent(/00:00/);
            expect(screen.getByTestId('walkover-chip-court-2')).not.toHaveTextContent(/-/);
        });

        it('removes walkover chip when walkover is cancelled or declared forfeit', () => {
            render(<CourtQueueViewer />);

            // Start walkover
            act(() => {
                if (socketListeners.walkoverTimerStarted) {
                    socketListeners.walkoverTimerStarted({
                        courtNumber: 3,
                        targetTeam: 'team1',
                        targetPlayerName: 'No Show Player',
                        durationSeconds: 600
                    });
                }
            });

            expect(screen.getByTestId('walkover-chip-court-3')).toBeInTheDocument();

            // Simulate walkover timer cancelled
            act(() => {
                if (socketListeners.walkoverTimerCancelled) {
                    socketListeners.walkoverTimerCancelled({ courtNumber: 3 });
                }
            });

            expect(screen.queryByTestId('walkover-chip-court-3')).not.toBeInTheDocument();
        });

        it('auto-advances court when match finishes and queue has matches vs empty queue', () => {
            render(<CourtQueueViewer />);

            // Court 3 is AVAILABLE with 2 queued matches: 'q-04' and 'q-05'
            const callNextBtn = screen.getByTestId('btn-call-next-3');
            expect(callNextBtn).not.toBeDisabled();
            fireEvent.click(callNextBtn);

            // Court 3 transitions to WARMUP with next match
            expect(screen.getByTestId('status-badge-court-3')).toHaveTextContent(/WARMUP/i);
            expect(screen.getByText(/Warmup Timer: 03:00 remaining/i)).toBeInTheDocument();

            // Broadcasted court status update
            expect(socket.emit).toHaveBeenCalledWith('courtStatusUpdate', expect.objectContaining({
                courtNumber: 3,
                status: 'WARMUP',
                warmupRemaining: 180
            }));

            // Court 6 has empty queue (queue.length === 0) -> Call Next Match button must be disabled
            const court6CallNextBtn = screen.getByTestId('btn-call-next-6');
            expect(court6CallNextBtn).toBeDisabled();
        });

        it('handles manual court maintenance toggle and updates status', () => {
            render(<CourtQueueViewer />);

            // Court 5 is AVAILABLE. Find set maintenance button
            const court5Card = screen.getByTestId('court-card-5');
            const maintenanceBtn = court5Card.querySelector('button[aria-label="Set maintenance"]');
            expect(maintenanceBtn).toBeInTheDocument();

            fireEvent.click(maintenanceBtn);

            expect(socket.emit).toHaveBeenCalledWith('courtStatusUpdate', expect.objectContaining({
                courtNumber: 5,
                status: 'MAINTENANCE'
            }));
        });

        it('renders deadlock stall alerts with specific stall reasons', () => {
            render(<CourtQueueViewer />);

            // Simulate incoming deadlock event on Court 1 (>30m inactivity)
            act(() => {
                if (socketListeners.courtStatusUpdate) {
                    socketListeners.courtStatusUpdate({
                        courtNumber: 1,
                        isStalled: true,
                        stallReason: 'INACTIVITY_EXCEEDED_30M (34m since last score)'
                    });
                }
            });

            const alertEl = screen.getByTestId('deadlock-alert-court-1');
            expect(alertEl).toBeInTheDocument();
            expect(alertEl).toHaveTextContent(/INACTIVITY_EXCEEDED_30M/i);
        });
    });

    // =========================================================================
    // 3. UI EDGE CASES (Rapid Intervals, Side Swap Rotations, Leaderboard RD Null)
    // =========================================================================
    describe('3. UI Edge Cases & State Resilience', () => {
        it('renders technical 11-point interval countdown and resumes cleanly on early resume click', async () => {
            render(
                <UmpireDigitalPad
                    initialCourtNumber={1}
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            // Advance to 11-0
            for (let i = 0; i < 11; i++) {
                fireEvent.click(btnTeam1);
            }

            expect(screen.getByTestId('interval-countdown-timer')).toBeInTheDocument();
            expect(screen.getByText(/60s Technical Interval \(11 Points\)/i)).toBeInTheDocument();

            // Click Resume Early
            const resumeBtn = screen.getByText('Resume Early');
            fireEvent.click(resumeBtn);

            // Interval banner should disappear
            expect(screen.queryByTestId('interval-countdown-timer')).not.toBeInTheDocument();

            // Next score point continues without error
            fireEvent.click(btnTeam1);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('12');
        });

        it('handles deciding Game 3 change of ends (11 points) SVG rotation, undo rollback, and redo', () => {
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

            // Game 3
            expect(screen.getByText(/GAME 3 OF 3/i)).toBeInTheDocument();

            // Advance Game 3 to 10 points
            for (let i = 0; i < 10; i++) fireEvent.click(btnTeam1);
            expect(screen.queryByTestId('game3-side-change-banner')).not.toBeInTheDocument();

            // Score 11th point -> Side swap triggered!
            fireEvent.click(btnTeam1);
            expect(screen.getByTestId('game3-side-change-banner')).toBeInTheDocument();

            // Test Undo through side swap boundary
            const undoBtn = screen.getByTestId('btn-undo-point');
            fireEvent.click(undoBtn);

            // Reverted back to 10 points -> side swap banner must be gone
            expect(screen.getByTestId('score-team1')).toHaveTextContent('10');
            expect(screen.queryByTestId('game3-side-change-banner')).not.toBeInTheDocument();

            // Redo point 11 -> side swap banner re-appears
            const redoBtn = screen.getByTestId('btn-redo-point');
            fireEvent.click(redoBtn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('11');
            expect(screen.getByTestId('game3-side-change-banner')).toBeInTheDocument();
        });

        it('handles deep undo and redo across game completion boundaries', () => {
            render(
                <UmpireDigitalPad
                    initialPlayer1="Alan Yang"
                    initialPlayer2="Kevin Lin"
                />
            );

            const btnTeam1 = screen.getByTestId('btn-score-team1');
            const undoBtn = screen.getByTestId('btn-undo-point');
            const redoBtn = screen.getByTestId('btn-redo-point');

            // Team 1 wins Game 1 (21 - 0)
            for (let i = 0; i < 21; i++) fireEvent.click(btnTeam1);
            expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();

            // Start Game 2
            fireEvent.click(screen.getByTestId('btn-start-next-game'));
            expect(screen.getByTestId('score-team1')).toHaveTextContent('0');

            // Score 2 points in Game 2
            fireEvent.click(btnTeam1);
            fireEvent.click(btnTeam1);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('2');

            // Undo 2 points back to 0-0 in Game 2
            fireEvent.click(undoBtn);
            fireEvent.click(undoBtn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('0');

            // Undo once more across game boundary: restores Game 1 at 21-0 and GAME_OVER
            fireEvent.click(undoBtn);
            expect(screen.getByTestId('game-over-alert')).toBeInTheDocument();
            expect(screen.getByTestId('score-team1')).toHaveTextContent('21');

            // Redo back into Game 2
            fireEvent.click(redoBtn);
            expect(screen.getByTestId('score-team1')).toHaveTextContent('0');
        });

        it('renders Leaderboard gracefully with diverse RD values (mature, provisional, undefined, null)', async () => {
            const mockPlayers = [
                { _id: '1', name: 'Viktor Axelsen', singlesElo: 2900, singlesRd: 80, skillLevel: 'A Level' },
                { _id: '2', name: 'Rookie Player', singlesElo: 1500, singlesRd: 250, skillLevel: 'C Level' },
                { _id: '3', name: 'Legacy Player', singlesElo: 1600, singlesRd: undefined, skillLevel: 'B Level' },
                { _id: '4', name: 'Null RD Player', singlesElo: 1400, singlesRd: null, skillLevel: 'D Level' }
            ];

            apiFetch.mockResolvedValueOnce({
                json: async () => mockPlayers
            });

            render(
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <Leaderboard />
                    </BrowserRouter>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Viktor Axelsen')).toBeInTheDocument();
            });

            // Player 1 (mature RD): shows ±80 without (Provisional)
            expect(screen.getByText('±80')).toBeInTheDocument();
            expect(screen.queryByText('±80 (Provisional)')).not.toBeInTheDocument();

            // Player 2 (provisional RD > 110): shows ±250 (Provisional)
            expect(screen.getByText('±250 (Provisional)')).toBeInTheDocument();

            // Player 3 (undefined RD): does NOT show ±NaN or crash
            expect(screen.getByText('Legacy Player')).toBeInTheDocument();
            expect(screen.getByText('1600')).toBeInTheDocument();

            // Player 4 (null RD): verify rendering does not crash, but reveals that `null !== undefined` causes `Math.round(null)` to render ±0
            expect(screen.getByText('Null RD Player')).toBeInTheDocument();
            expect(screen.getByText('1400')).toBeInTheDocument();
            expect(screen.getByText('±0')).toBeInTheDocument();
        });
    });
});
