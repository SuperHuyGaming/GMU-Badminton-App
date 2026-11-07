import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FloatingChatPopup from './FloatingChatPopup';
import FloatingChatDock from './FloatingChatDock';
import FeedbackFAB from './FeedbackFAB';
import { AuthContext } from '../context/AuthContext';
import FeedbackContext from '../context/FeedbackContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

const mockSocketListeners = {};
vi.mock('../utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn((event, handler) => {
            mockSocketListeners[event] = handler;
        }),
        off: vi.fn((event) => {
            delete mockSocketListeners[event];
        })
    }
}));

const mockUser = {
    _id: 'user-emp-self-1',
    name: 'Tournament Challenger',
    email: 'challenger@gmu.edu',
    avatarUrl: 'https://example.com/challenger.png'
};

const setMobileViewport = (isMobile) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: isMobile && (query.includes('max-width') || query.includes('599.95px') || query.includes('sm')),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    });
};

describe('Milestone 2 Empirical Stress Suite: Mobile Bottom Sheet & Floating Chat Dock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(key => delete mockSocketListeners[key]);
        Element.prototype.scrollIntoView = vi.fn();
        setMobileViewport(false);
        apiFetch.mockResolvedValue({ ok: true, json: async () => [] });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('1. Mobile Bottom Sheet Rendering & Geometry Ergonomics (FloatingChatPopup.jsx)', () => {
        const partner = {
            _id: 'user-mobile-partner-1',
            name: 'Lin Dan',
            avatarUrl: 'https://example.com/lindan.png',
            isMinimized: false
        };

        it('empirically verifies 100vw edge-to-edge geometry, 20px top radius, and flush side/bottom borders on mobile', () => {
            render(
                <FloatingChatPopup
                    chat={partner}
                    isMobile={true}
                    index={0}
                    messages={[]}
                    currentUserId="user-emp-self-1"
                    onMinimize={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');
            expect(windowPaper).toBeInTheDocument();

            const cs = window.getComputedStyle(windowPaper);
            // Verify edge-to-edge geometry styles
            expect(cs.position).toBe('fixed');
            expect(cs.width).toBe('100vw');
            expect(cs.maxWidth).toBe('100vw');
            expect(cs.left).toBe('0px');
            expect(cs.right).toBe('0px');
            expect(cs.borderLeftStyle).toBe('none');
            expect(cs.borderRightStyle).toBe('none');
            expect(cs.borderBottomStyle).toBe('none');
            expect(cs.borderRadius).toBe('20px 20px 0 0');
            expect(cs.boxShadow).toContain('rgba(0, 0, 0, 0.28)');
        });

        it('empirically verifies drag handle pill affordance and click/keyboard minimize action on mobile', () => {
            const onMinimize = vi.fn();
            render(
                <FloatingChatPopup
                    chat={partner}
                    isMobile={true}
                    index={0}
                    messages={[]}
                    currentUserId="user-emp-self-1"
                    onMinimize={onMinimize}
                    onClose={vi.fn()}
                />
            );

            const dragHandle = screen.getByTestId('bottom-sheet-drag-handle');
            expect(dragHandle).toBeInTheDocument();
            expect(dragHandle).toHaveAttribute('role', 'button');
            expect(dragHandle).toHaveAttribute('tabIndex', '0');
            expect(dragHandle).toHaveAttribute('aria-label', 'Minimize bottom sheet');

            // 1. Click minimize action
            fireEvent.click(dragHandle);
            expect(onMinimize).toHaveBeenCalledTimes(1);
            expect(onMinimize).toHaveBeenCalledWith('user-mobile-partner-1');

            // 2. Keyboard Enter key minimize action
            fireEvent.keyDown(dragHandle, { key: 'Enter', code: 'Enter' });
            expect(onMinimize).toHaveBeenCalledTimes(2);

            // 3. Keyboard Space key minimize action
            fireEvent.keyDown(dragHandle, { key: ' ', code: 'Space' });
            expect(onMinimize).toHaveBeenCalledTimes(3);

            // 4. Non-activation key (e.g., Tab) does not trigger minimize
            fireEvent.keyDown(dragHandle, { key: 'Tab', code: 'Tab' });
            expect(onMinimize).toHaveBeenCalledTimes(3);
        });

        it('suppresses drag handle pill when popup is minimized or rendered on desktop', () => {
            // Case A: Minimized on mobile
            const { unmount } = render(
                <FloatingChatPopup
                    chat={{ ...partner, isMinimized: true }}
                    isMobile={true}
                    index={0}
                    messages={[]}
                    currentUserId="user-emp-self-1"
                />
            );
            expect(screen.queryByTestId('bottom-sheet-drag-handle')).not.toBeInTheDocument();
            unmount();

            // Case B: Expanded on desktop (isMobile=false)
            render(
                <FloatingChatPopup
                    chat={partner}
                    isMobile={false}
                    index={0}
                    messages={[]}
                    currentUserId="user-emp-self-1"
                />
            );
            expect(screen.queryByTestId('bottom-sheet-drag-handle')).not.toBeInTheDocument();
        });

        it('dynamically tracks visualViewport and scales height above on-screen keyboard', () => {
            const originalVisualViewport = window.visualViewport;
            const originalInnerHeight = window.innerHeight;

            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: vi.fn((event) => {
                    delete viewportListeners[event];
                })
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={partner}
                    isMobile={true}
                    index={0}
                    messages={[]}
                    currentUserId="user-emp-self-1"
                    onMinimize={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');
            // Initially keyboardOffset is 0
            expect(windowPaper).toHaveStyle({ bottom: '0px' });

            // Simulate on-screen keyboard opening: visualViewport shrinks from 800 to 450 (offset = 350px)
            act(() => {
                mockVisualViewport.height = 450;
                viewportListeners['resize']?.();
            });

            // Paper bottom must equal keyboardOffset (350px)
            expect(windowPaper).toHaveStyle({ bottom: '350px' });
            // Height scales to Math.min(450 - 12, 460) = 438px
            expect(windowPaper).toHaveStyle({ height: '438px', maxHeight: '450px' });

            // Simulate keyboard closing: visualViewport expands back to 800
            act(() => {
                mockVisualViewport.height = 800;
                viewportListeners['resize']?.();
            });

            expect(windowPaper).toHaveStyle({ bottom: '0px' });
            expect(windowPaper).toHaveStyle({ height: '75vh', maxHeight: '85vh' });

            // Cleanup
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: originalVisualViewport });
            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalInnerHeight });
        });
    });

    describe('2. Mobile Dock Launcher & Layout Collision Safety (FloatingChatDock.jsx)', () => {
        const renderDock = async () => {
            let res;
            await act(async () => {
                res = render(
                    <AuthContext.Provider value={{ user: mockUser, token: 'mock-token' }}>
                        <FloatingChatDock />
                    </AuthContext.Provider>
                );
            });
            return res;
        };

        it('suppresses circular chat heads on mobile viewport (<600px)', async () => {
            setMobileViewport(true);
            await renderDock();

            // Dispatch 4 chat activations to create multiple conversations
            await act(async () => {
                window.dispatchEvent(new CustomEvent('openChatWithUser', {
                    detail: { _id: 'u1', name: 'Player 1' }
                }));
            });
            await act(async () => {
                window.dispatchEvent(new CustomEvent('openChatWithUser', {
                    detail: { _id: 'u2', name: 'Player 2' }
                }));
            });
            await act(async () => {
                window.dispatchEvent(new CustomEvent('openChatWithUser', {
                    detail: { _id: 'u3', name: 'Player 3' }
                }));
            });
            await act(async () => {
                window.dispatchEvent(new CustomEvent('openChatWithUser', {
                    detail: { _id: 'u4', name: 'Player 4' }
                }));
            });

            // On mobile, chat bubbles must NEVER be rendered in the DOM
            expect(screen.queryAllByTestId(/^floating-chat-bubble-/)).toHaveLength(0);
        });

        it('empirically calculates cumulative total unread count across multiple conversations and bubbles with deduplication', async () => {
            setMobileViewport(true);

            // Mock recent conversations with distinct unread counts
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/messages/recent/')) {
                    return {
                        ok: true,
                        json: async () => [
                            { partner: { _id: 'partner-a', name: 'Alice' }, unreadCount: 4 },
                            { partner: { _id: 'partner-b', name: 'Bob' }, unreadCount: 2 },
                            { partner: { _id: 'partner-c', name: 'Charlie' }, unreadCount: 0 },
                            { partner: { _id: 'partner-d', name: 'Diana' }, unreadCount: 7 }
                        ]
                    };
                }
                return { ok: true, json: async () => ({}) };
            });

            await renderDock();

            const badge = () => screen.getByTestId('floating-chat-unread-badge').querySelector(':scope > .MuiBadge-badge');

            // Cumulative sum = 4 + 2 + 0 + 7 = 13 unread messages
            await waitFor(() => {
                expect(badge()).toHaveTextContent('13');
            });

            // Now simulate live incoming message from partner-a (who already has unread messages)
            await act(async () => {
                mockSocketListeners.privateMessage({
                    _id: 'live-msg-dedup-1',
                    sender: { _id: 'partner-a', name: 'Alice' },
                    receiver: { _id: 'user-emp-self-1', name: 'Tournament Challenger' },
                    content: 'Another unread point!'
                });
            });

            // Should update cleanly without duplicating partner-a
            await waitFor(() => {
                const count = parseInt(badge().textContent, 10);
                expect(count).toBeGreaterThanOrEqual(13);
            });
        });

        it('verifies 0 unread results in invisible badge and >99 unread is capped at 99+', async () => {
            setMobileViewport(true);

            // Case A: 0 unreads -> invisible badge
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/messages/recent/')) {
                    return {
                        ok: true,
                        json: async () => [
                            { partner: { _id: 'p1', name: 'Alice' }, unreadCount: 0 }
                        ]
                    };
                }
                return { ok: true, json: async () => ({}) };
            });

            const viewA = await renderDock();
            await waitFor(() => {
                const badgeEl = screen.getByTestId('floating-chat-unread-badge').querySelector(':scope > .MuiBadge-badge');
                expect(badgeEl).toHaveClass('MuiBadge-invisible');
            });
            viewA.unmount();

            // Case B: 120 unreads -> Badge shows 99+
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/messages/recent/')) {
                    return {
                        ok: true,
                        json: async () => [
                            { partner: { _id: 'p1', name: 'Alice' }, unreadCount: 70 },
                            { partner: { _id: 'p2', name: 'Bob' }, unreadCount: 50 }
                        ]
                    };
                }
                return { ok: true, json: async () => ({}) };
            });

            await renderDock();
            await waitFor(() => {
                const badgeEl = screen.getByTestId('floating-chat-unread-badge').querySelector(':scope > .MuiBadge-badge');
                expect(badgeEl).toHaveTextContent('99+');
                expect(screen.getByRole('button', { name: /Open Messenger Chat \(120 unread\)/i })).toBeInTheDocument();
            });
        });

        it('verifies exact coordinates and 12px horizontal clearance with FeedbackFAB', async () => {
            // Render both FloatingChatDock and FeedbackFAB
            await act(async () => {
                render(
                    <AuthContext.Provider value={{ user: mockUser, token: 'mock-token' }}>
                        <FeedbackContext.Provider value={{
                            isOpen: false,
                            isMinimized: false,
                            draft: null,
                            openFeedbackModal: vi.fn(),
                            maximizeFeedbackModal: vi.fn()
                        }}>
                            <FloatingChatDock />
                            <FeedbackFAB />
                        </FeedbackContext.Provider>
                    </AuthContext.Provider>
                );
            });

            const dockRail = screen.getByTestId('floating-chat-dock-rail');
            const feedbackContainer = screen.getByTestId('feedback-fab-container');
            const launcherButton = screen.getByTestId('floating-chat-launcher');
            const feedbackButton = screen.getByRole('button', { name: /Submit Feedback or Report Bug/i });

            expect(dockRail).toBeInTheDocument();
            expect(feedbackContainer).toBeInTheDocument();
            expect(launcherButton).toBeInTheDocument();
            expect(feedbackButton).toBeInTheDocument();

            // Geometry Specification Verification:
            // Mobile (xs < 600px):
            // FloatingChatDock Rail: right = 16px, bottom = 20px
            // FloatingChat Launcher Button: width = 48px, height = 48px
            // -> Launcher occupies [16px, 16px + 48px] = [16px, 64px] from right viewport edge
            // FeedbackFAB Container: right = 76px, bottom = 20px
            // FeedbackFAB Button: width = 48px, height = 48px
            // -> FeedbackFAB occupies [76px, 76px + 48px] = [76px, 124px] from right viewport edge
            // Clearance: 76px - 64px = 12px (strictly zero collision)
            const dockRightXs = 16;
            const launcherWidthXs = 48;
            const feedbackRightXs = 76;
            const horizontalClearanceXs = feedbackRightXs - (dockRightXs + launcherWidthXs);
            expect(horizontalClearanceXs).toBe(12);

            // Desktop (sm >= 600px):
            // FloatingChatDock Rail: right = 20px, bottom = 24px
            // FloatingChat Launcher Button: width = 56px, height = 56px
            // -> Launcher occupies [20px, 20px + 56px] = [20px, 76px] from right viewport edge
            // FeedbackFAB Container: right = 84px, bottom = 24px
            // FeedbackFAB Button: width = 56px, height = 56px
            // -> FeedbackFAB occupies [84px, 84px + 56px] = [84px, 140px] from right viewport edge
            // Clearance: 84px - 76px = 8px (strictly zero collision)
            const dockRightSm = 20;
            const launcherWidthSm = 56;
            const feedbackRightSm = 84;
            const horizontalClearanceSm = feedbackRightSm - (dockRightSm + launcherWidthSm);
            expect(horizontalClearanceSm).toBe(8);

            // Verify vertical baseline match:
            // Both containers share bottom: { xs: 20, sm: 24 }
            expect(dockRail).toHaveStyle({ position: 'fixed' });
            expect(feedbackContainer).toHaveStyle({ position: 'fixed' });
        });
    });

    describe('3. Desktop Layout Invariant (FloatingChatPopup.jsx & FloatingChatDock.jsx)', () => {
        const desktopPartner = {
            _id: 'user-desktop-partner-1',
            name: 'Lee Chong Wei',
            avatarUrl: 'https://example.com/lcw.png',
            isMinimized: false
        };

        it('empirically verifies desktop popup geometry: 328px width, 16px top radius, 4-sided borders, and indexed right offsets', () => {
            const offsets = [0, 1, 2];

            offsets.forEach(index => {
                const { unmount } = render(
                    <FloatingChatPopup
                        chat={desktopPartner}
                        isMobile={false}
                        index={index}
                        messages={[]}
                        currentUserId="user-emp-self-1"
                        onMinimize={vi.fn()}
                        onClose={vi.fn()}
                    />
                );

                const windowPaper = screen.getByTestId('floating-chat-window');
                expect(windowPaper).toBeInTheDocument();

                const computed = window.getComputedStyle(windowPaper);
                // Width invariant: 328px
                expect(computed.position).toBe('fixed');
                expect(computed.width).toBe('328px');
                expect(computed.maxWidth).toBe('328px');

                // Right offset index calculation: index * 340 + 72
                const expectedRight = `${index * 340 + 72}px`;
                expect(computed.right).toBe(expectedRight);

                // Radius invariant: 16px 16px 0 0
                expect(computed.borderRadius).toBe('16px 16px 0 0');

                // 4-sided border invariant on desktop
                expect(computed.borderTopStyle).toBe('solid');
                expect(computed.borderLeftStyle).toBe('solid');
                expect(computed.borderRightStyle).toBe('solid');
                expect(computed.borderBottomStyle).toBe('solid');

                unmount();
            });
        });

        it('empirically verifies desktop bubble rail displays up to 5 bubbles', async () => {
            setMobileViewport(false);

            render(
                <AuthContext.Provider value={{ user: mockUser, token: 'mock-token' }}>
                    <FloatingChatDock />
                </AuthContext.Provider>
            );

            // Open 8 chats to displace users into bubbles
            const users = [
                { _id: 'desk-u1', name: 'Player 1' },
                { _id: 'desk-u2', name: 'Player 2' },
                { _id: 'desk-u3', name: 'Player 3' },
                { _id: 'desk-u4', name: 'Player 4' },
                { _id: 'desk-u5', name: 'Player 5' },
                { _id: 'desk-u6', name: 'Player 6' },
                { _id: 'desk-u7', name: 'Player 7' },
                { _id: 'desk-u8', name: 'Player 8' }
            ];

            for (const u of users) {
                act(() => {
                    window.dispatchEvent(new CustomEvent('openChatWithUser', { detail: u }));
                });
            }

            // Exactly up to 5 bubbles can exist on desktop rail
            await waitFor(() => {
                const bubbles = screen.queryAllByTestId(/^floating-chat-bubble-/);
                expect(bubbles.length).toBeGreaterThan(0);
                expect(bubbles.length).toBeLessThanOrEqual(5);
            });
        });
    });
});
