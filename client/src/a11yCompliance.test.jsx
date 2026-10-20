import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UmpireDigitalPad from './components/UmpireDigitalPad';
import CourtQueueViewer from './components/CourtQueueViewer';
import TournamentBracket from './components/TournamentBracket';

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

// WCAG 2.1 Formula Helpers
function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance(rgb) {
    return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}

function getContrastRatio(hex1, hex2) {
    const l1 = getLuminance(hexToRgb(hex1));
    const l2 = getLuminance(hexToRgb(hex2));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

describe('Problem 19: Full WCAG 2.1 AA Accessibility & Contrast Compliance Suite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Pillar 1: Color Contrast Verification (WCAG 2.1 Criterion 1.4.3 & 1.4.11)', () => {
        it('asserts light mode primary #004d26 exceeds 4.5:1 against light background', () => {
            expect(getContrastRatio('#004d26', '#f4f6f8')).toBeGreaterThanOrEqual(4.5);
        });

        it('asserts updated light mode warning #c43c00 exceeds 4.5:1 against white', () => {
            expect(getContrastRatio('#c43c00', '#ffffff')).toBeGreaterThanOrEqual(4.5);
        });

        it('asserts dark mode primary #80e27e exceeds 4.5:1 against #02120a', () => {
            expect(getContrastRatio('#80e27e', '#02120a')).toBeGreaterThanOrEqual(4.5);
        });

        it('asserts dark mode elevated muted text #94a3b8 exceeds 4.5:1 against #0f172a and #1e293b', () => {
            expect(getContrastRatio('#94a3b8', '#0f172a')).toBeGreaterThanOrEqual(4.5);
            expect(getContrastRatio('#94a3b8', '#1e293b')).toBeGreaterThanOrEqual(4.5);
        });

        it('asserts non-text bracket connector #64748b exceeds 3.0:1 on canvas surfaces', () => {
            expect(getContrastRatio('#64748b', '#0d131a')).toBeGreaterThanOrEqual(3.0);
            expect(getContrastRatio('#64748b', '#f8fafc')).toBeGreaterThanOrEqual(3.0);
        });

        it('asserts focus ring #38bdf8 on dark surfaces exceeds 3.0:1', () => {
            expect(getContrastRatio('#38bdf8', '#02120a')).toBeGreaterThanOrEqual(3.0);
        });

        it('asserts updated index.css light accent #7c3aed exceeds 4.5:1 against white', () => {
            expect(getContrastRatio('#7c3aed', '#ffffff')).toBeGreaterThanOrEqual(4.5);
        });
    });

    describe('Pillar 2: Dynamic ARIA Live Regions (WCAG 4.1.3)', () => {
        it('announces point scores dynamically in UmpireDigitalPad', () => {
            render(<UmpireDigitalPad initialPlayer1="Alan Yang" initialPlayer2="Kevin Lin" />);
            const liveRegion = screen.getByTestId('umpire-aria-live-announcer');
            expect(liveRegion).toHaveAttribute('aria-live', 'polite');
            expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

            // Click +1 Point for Team 1
            const scoreBtn = screen.getByTestId('btn-score-team1');
            fireEvent.click(scoreBtn);

            expect(liveRegion.textContent).toMatch(/Point scored by Alan Yang/i);
            expect(liveRegion.textContent).toMatch(/Current score: Alan Yang 1, Kevin Lin 0/i);
        });

        it('announces walkover timer events and court status updates in CourtQueueViewer', () => {
            render(<CourtQueueViewer />);
            const liveRegion = screen.getByTestId('court-queue-live-announcer');
            expect(liveRegion).toHaveAttribute('aria-live', 'polite');
            expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

            // Simulate walkover timer start event
            act(() => {
                if (socketListeners['walkoverTimerStarted']) {
                    socketListeners['walkoverTimerStarted']({
                        courtNumber: 2,
                        targetTeam: 'team2',
                        targetPlayerName: 'Alex Mercer',
                        durationSeconds: 600
                    });
                }
            });

            expect(liveRegion.textContent).toMatch(/Walkover forfeit timer initiated on Court 2 for Alex Mercer/i);

            // Simulate court status update event
            act(() => {
                if (socketListeners['courtStatusUpdate']) {
                    socketListeners['courtStatusUpdate']({
                        courtNumber: 3,
                        status: 'MATCH_IN_PROGRESS'
                    });
                }
            });

            expect(liveRegion.textContent).toMatch(/Court 3 status updated to MATCH IN PROGRESS/i);
        });

        it('announces lock status updates in TournamentBracket', () => {
            render(<TournamentBracket />);
            const liveRegion = screen.getByTestId('bracket-live-announcer');
            expect(liveRegion).toHaveAttribute('aria-live', 'polite');
            expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
        });
    });

    describe('Pillar 3: Keyboard Navigation & ARIA Semantics (WCAG 2.1.1 & 4.1.2)', () => {
        it('renders tournament bracket match nodes as accessible keyboard buttons', () => {
            render(<TournamentBracket />);
            const matchNodes = screen.getAllByTestId(/^match-node-/);
            expect(matchNodes.length).toBeGreaterThan(0);
            matchNodes.forEach(node => {
                expect(node).toHaveAttribute('role', 'button');
                expect(node).toHaveAttribute('tabIndex', '0');
                expect(node.getAttribute('aria-label')).toBeTruthy();
            });
        });

        it('ensures all CourtQueueViewer action buttons have contextual aria-labels', () => {
            render(<CourtQueueViewer onSelectMatchForUmpire={() => {}} />);
            const callNextButtons = screen.getAllByRole('button', { name: /Call next match for Court/i });
            expect(callNextButtons.length).toBeGreaterThanOrEqual(6);
            const umpireButtons = screen.getAllByRole('button', { name: /Score match on Court \d in Umpire Pad/i });
            expect(umpireButtons.length).toBeGreaterThan(0);
        });

        it('ensures UmpireDigitalPad touch score buttons and visualizer have accessible labels', () => {
            render(<UmpireDigitalPad initialPlayer1="Alan Yang" initialPlayer2="Kevin Lin" />);
            const team1Btn = screen.getByTestId('btn-score-team1');
            const team2Btn = screen.getByTestId('btn-score-team2');
            expect(team1Btn).toHaveAttribute('aria-label', 'Award 1 point to Alan Yang');
            expect(team2Btn).toHaveAttribute('aria-label', 'Award 1 point to Kevin Lin');

            const svgVisualizer = screen.getByTestId('service-court-svg').querySelector('svg');
            expect(svgVisualizer).toHaveAttribute('role', 'img');
            expect(svgVisualizer.getAttribute('aria-label')).toMatch(/Badminton service court visualizer/i);
        });
    });
});
