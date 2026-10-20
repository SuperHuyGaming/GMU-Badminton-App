import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CourtQueueViewer from './CourtQueueViewer';
import socket from '../utils/socket';

const socketListeners = {};

vi.mock('../utils/socket', () => ({
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

describe('RAC Courts 1-6 Queue Viewer Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all 6 RAC gymnasium courts with live status badges', () => {
        render(<CourtQueueViewer />);

        expect(screen.getByTestId('court-queue-viewer')).toBeInTheDocument();
        expect(screen.getByText(/RAC Gymnasium Courts 1–6 Scheduling Hub/i)).toBeInTheDocument();

        // Check all 6 courts are rendered
        for (let i = 1; i <= 6; i++) {
            expect(screen.getByTestId(`court-card-${i}`)).toBeInTheDocument();
            expect(screen.getByTestId(`status-badge-court-${i}`)).toBeInTheDocument();
        }

        // Court 1 should be MATCH_IN_PROGRESS
        expect(screen.getByTestId('status-badge-court-1')).toHaveTextContent(/MATCH IN PROGRESS/i);
        // Court 2 should be WARMUP
        expect(screen.getByTestId('status-badge-court-2')).toHaveTextContent(/WARMUP/i);
        // Court 3 should be AVAILABLE
        expect(screen.getByTestId('status-badge-court-3')).toHaveTextContent(/AVAILABLE/i);
        // Court 6 should be MAINTENANCE
        expect(screen.getByTestId('status-badge-court-6')).toHaveTextContent(/MAINTENANCE/i);
    });

    it('filters courts by status chips', () => {
        render(<CourtQueueViewer />);

        // Click Available chip
        const availChip = screen.getByText('Available');
        fireEvent.click(availChip);

        // Courts 3 and 5 are available, Court 1 is not
        expect(screen.getByTestId('court-card-3')).toBeInTheDocument();
        expect(screen.getByTestId('court-card-5')).toBeInTheDocument();
        expect(screen.queryByTestId('court-card-1')).not.toBeInTheDocument();

        // Click All (6)
        fireEvent.click(screen.getByText('All (6)'));
        expect(screen.getByTestId('court-card-1')).toBeInTheDocument();
    });

    it('calls next match from queue into WARMUP state and broadcasts over Socket.io', () => {
        render(<CourtQueueViewer />);

        // Court 3 is AVAILABLE with queued matches
        const callNextBtn = screen.getByTestId('btn-call-next-3');
        fireEvent.click(callNextBtn);

        // Court 3 transitions to WARMUP
        expect(screen.getByTestId('status-badge-court-3')).toHaveTextContent(/WARMUP/i);
        expect(screen.getByText(/Warmup Timer: 03:00 remaining/i)).toBeInTheDocument();

        // Socket.io event emitted
        expect(socket.emit).toHaveBeenCalledWith('courtStatusUpdate', expect.objectContaining({
            courtNumber: 3,
            status: 'WARMUP',
            warmupRemaining: 180
        }));
    });

    it('handles incoming real-time socket events for court status and live score updates', () => {
        render(<CourtQueueViewer />);

        // Simulate incoming live score update on Court 1
        act(() => {
            if (socketListeners.liveScoreUpdate) {
                socketListeners.liveScoreUpdate({
                    courtNumber: 1,
                    currentScore: { team1: 20, team2: 19 },
                    server: 'team1',
                    gameScores: [[21, 17], [20, 19]],
                    gameNumber: 2
                });
            }
        });

        // Live score on Court 1 updated
        expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('renders dynamic match pacing and duration estimates on active matches', () => {
        render(<CourtQueueViewer />);

        // Court 1 is MATCH_IN_PROGRESS
        const pacingEl = screen.getByTestId('pacing-estimate-court-1');
        expect(pacingEl).toBeInTheDocument();
        expect(pacingEl).toHaveTextContent(/Est\. ~18 mins remaining \(28s\/pt pacing\)/i);
    });

    it('renders live walkover countdown chip upon walkoverTimerStarted event', () => {
        render(<CourtQueueViewer />);

        // Initially no walkover chip
        expect(screen.queryByTestId('walkover-chip-court-2')).not.toBeInTheDocument();

        // Simulate walkover timer start on Court 2
        act(() => {
            if (socketListeners.walkoverTimerStarted) {
                socketListeners.walkoverTimerStarted({
                    courtNumber: 2,
                    targetTeam: 'team2',
                    targetPlayerName: 'Chloe Zhang',
                    durationSeconds: 600
                });
            }
        });

        const walkoverChip = screen.getByTestId('walkover-chip-court-2');
        expect(walkoverChip).toBeInTheDocument();
        expect(walkoverChip).toHaveTextContent(/WALKOVER: Chloe Zhang/i);
    });

    it('renders deadlock warning badge when a court is stalled', () => {
        render(<CourtQueueViewer />);

        // Initially no deadlock alert
        expect(screen.queryByTestId('deadlock-alert-court-4')).not.toBeInTheDocument();

        // Simulate stall update on Court 4
        act(() => {
            if (socketListeners.courtStatusUpdate) {
                socketListeners.courtStatusUpdate({
                    courtNumber: 4,
                    isStalled: true,
                    stallReason: 'No scoring activity for >30 minutes'
                });
            }
        });

        const deadlockAlert = screen.getByTestId('deadlock-alert-court-4');
        expect(deadlockAlert).toBeInTheDocument();
        expect(deadlockAlert).toHaveTextContent(/Stalled: No scoring activity for >30 minutes/i);
    });
});
