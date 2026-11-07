import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FloatingChatPopup from './FloatingChatPopup';

describe('Milestone 2 Challenger 2 Empirical Stress Suite: FloatingChatPopup.jsx', () => {
    let originalVisualViewport;
    let originalInnerHeight;
    let scrollIntoViewMock;

    const mockPartner = {
        _id: 'user-partner-stress-1',
        name: 'Challenger Partner',
        avatarUrl: 'https://example.com/partner.png',
        isMinimized: false
    };

    const mockMessages = [
        { _id: 'm1', content: 'Match at 6 PM?', sender: { _id: 'user-partner-stress-1' }, createdAt: new Date().toISOString() },
        { _id: 'm2', content: 'Court 3 booked!', sender: { _id: 'user-partner-stress-1' }, createdAt: new Date().toISOString() }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        scrollIntoViewMock = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoViewMock;

        originalVisualViewport = window.visualViewport;
        originalInnerHeight = window.innerHeight;
    });

    afterEach(() => {
        if (originalVisualViewport !== undefined) {
            Object.defineProperty(window, 'visualViewport', {
                writable: true,
                configurable: true,
                value: originalVisualViewport
            });
        } else {
            delete window.visualViewport;
        }

        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: originalInnerHeight
        });

        vi.restoreAllMocks();
    });

    describe('1. visualViewport Keyboard Tracking & Height Dynamics', () => {
        it('tracks window.visualViewport resize and scroll events, scaling bottom offset and height', async () => {
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
                    chat={mockPartner}
                    isMobile={true}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                    onMinimize={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');
            expect(windowPaper).toBeInTheDocument();

            // Initial state: keyboard closed
            expect(windowPaper).toHaveStyle({ bottom: '0px' });
            expect(windowPaper).toHaveStyle({ height: '75vh', maxHeight: '85vh' });

            // Composer initial pb should include safe-area padding
            const composerForm = screen.getByPlaceholderText('Aa').closest('form');
            expect(composerForm).toHaveStyle({ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' });

            // SIMULATE ON-SCREEN KEYBOARD (300px keyboard, visualViewport shrinks to 500px)
            act(() => {
                mockVisualViewport.height = 500;
                viewportListeners['resize']?.();
            });

            // Bottom offset updates to 800 - 500 = 300px
            expect(windowPaper).toHaveStyle({ bottom: '300px' });
            // Height scales to Math.min(500 - 12, 460) = 460px
            expect(windowPaper).toHaveStyle({ height: '460px', maxHeight: '500px' });
            // Composer pb removes safe-area padding when keyboard is open (pb: 1 => 8px)
            expect(composerForm).toHaveStyle({ paddingBottom: '8px' });

            // SIMULATE SCROLL EVENT ON VISUAL VIEWPORT (e.g. user scrolls page while keyboard open)
            act(() => {
                viewportListeners['scroll']?.();
            });
            expect(windowPaper).toHaveStyle({ bottom: '300px' });

            // SIMULATE SMALLER VIEWPORT (400px remaining height, keyboard = 400px)
            act(() => {
                mockVisualViewport.height = 400;
                viewportListeners['resize']?.();
            });
            // Bottom offset = 400px
            expect(windowPaper).toHaveStyle({ bottom: '400px' });
            // Height scales to Math.min(400 - 12, 460) = 388px
            expect(windowPaper).toHaveStyle({ height: '388px', maxHeight: '400px' });

            // SIMULATE KEYBOARD DISMISS (visualViewport expands back to 800px)
            act(() => {
                mockVisualViewport.height = 800;
                viewportListeners['resize']?.();
            });
            expect(windowPaper).toHaveStyle({ bottom: '0px' });
            expect(windowPaper).toHaveStyle({ height: '75vh', maxHeight: '85vh' });
            expect(composerForm).toHaveStyle({ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' });
        });

        it('cleans up visualViewport event listeners on unmount', () => {
            const viewportListeners = {};
            const removeEventListenerSpy = vi.fn((event) => {
                delete viewportListeners[event];
            });

            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: removeEventListenerSpy
            };

            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            const { unmount } = render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    messages={[]}
                    currentUserId="user-self-1"
                />
            );

            expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
            expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
        });
    });

    describe('2. Auto-Scroll Mechanics', () => {
        it('invokes scrollIntoView smoothly when messages update and when popup mounts', () => {
            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
        });

        it('invokes scrollIntoView when keyboard offset opens on mobile after 80ms timer', async () => {
            vi.useFakeTimers();

            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: vi.fn()
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            scrollIntoViewMock.mockClear();

            // Simulate keyboard opening (height drops from 800 to 500)
            act(() => {
                mockVisualViewport.height = 500;
                viewportListeners['resize']?.();
            });

            // Before 80ms timer, keyboard auto-scroll should not have fired yet
            expect(scrollIntoViewMock).not.toHaveBeenCalled();

            // Advance timers by 80ms
            act(() => {
                vi.advanceTimersByTime(80);
            });

            expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });

            vi.useRealTimers();
        });

        it('invokes scrollIntoView immediately and after 150ms when message input receives focus', () => {
            vi.useFakeTimers();

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            // Flush initial auto-focus timer on mount (150ms) and its secondary scroll timer (+150ms = 300ms)
            act(() => {
                vi.advanceTimersByTime(400);
            });

            scrollIntoViewMock.mockClear();

            const input = screen.getByPlaceholderText('Aa');
            fireEvent.focus(input);

            // Immediate scrollIntoView call from onFocus
            expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
            expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });

            // Advance timers by 150ms for delayed scrollIntoView call
            act(() => {
                vi.advanceTimersByTime(150);
            });

            expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });

        it('suppresses auto-scroll completely when chat is minimized', () => {
            const minimizedPartner = { ...mockPartner, isMinimized: true };
            render(
                <FloatingChatPopup
                    chat={minimizedPartner}
                    isMobile={true}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            // Minimized popup should not trigger scrollIntoView on mount or message update
            expect(scrollIntoViewMock).not.toHaveBeenCalled();
        });

        it('handles missing scrollIntoView implementation gracefully without throwing', () => {
            Element.prototype.scrollIntoView = undefined;

            expect(() => {
                render(
                    <FloatingChatPopup
                        chat={mockPartner}
                        isMobile={true}
                        messages={mockMessages}
                        currentUserId="user-self-1"
                    />
                );
            }).not.toThrow();
        });
    });

    describe('3. Fallback Robustness When visualViewport is Undefined', () => {
        it('falls back safely to window.innerHeight and window resize listener when visualViewport is undefined', () => {
            delete window.visualViewport;
            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 750 });

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            const { unmount } = render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            // Should have registered window resize listener
            expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

            const windowPaper = screen.getByTestId('floating-chat-window');
            expect(windowPaper).toBeInTheDocument();
            // In fallback mode, keyboardOffset is 0 and bottom is 0px
            expect(windowPaper).toHaveStyle({ bottom: '0px', height: '75vh' });

            // Fire window resize event
            act(() => {
                window.innerHeight = 700;
                window.dispatchEvent(new Event('resize'));
            });

            expect(windowPaper).toHaveStyle({ bottom: '0px' });

            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        });
    });

    describe('4. Desktop Layout Invariants & Responsive Boundaries', () => {
        it('enforces desktop layout geometry (328px width, 420px height, 16px radius, indexed right offset)', () => {
            [0, 1, 2].forEach(index => {
                const { unmount } = render(
                    <FloatingChatPopup
                        chat={mockPartner}
                        isMobile={false}
                        index={index}
                        messages={mockMessages}
                        currentUserId="user-self-1"
                    />
                );

                const windowPaper = screen.getByTestId('floating-chat-window');
                const cs = window.getComputedStyle(windowPaper);

                expect(cs.position).toBe('fixed');
                expect(cs.width).toBe('328px');
                expect(cs.maxWidth).toBe('328px');
                expect(cs.height).toBe('420px');
                expect(cs.bottom).toBe('0px');
                expect(cs.right).toBe(`${index * 340 + 72}px`);
                expect(cs.borderRadius).toBe('16px 16px 0 0');

                // 4-sided borders
                expect(cs.borderTopStyle).toBe('solid');
                expect(cs.borderLeftStyle).toBe('solid');
                expect(cs.borderRightStyle).toBe('solid');
                expect(cs.borderBottomStyle).toBe('solid');

                // Desktop composer padding is fixed pb: 1 (8px) without safe-area formula
                const composerForm = screen.getByPlaceholderText('Aa').closest('form');
                expect(composerForm).toHaveStyle({ paddingBottom: '8px' });

                // Drag handle pill affordance is never rendered on desktop
                expect(screen.queryByTestId('bottom-sheet-drag-handle')).not.toBeInTheDocument();

                unmount();
            });
        });

        it('strictly maintains bottom: 0 on desktop even when visualViewport detects offset', () => {
            const viewportListeners = {};
            const mockVisualViewport = {
                height: 400,
                addEventListener: vi.fn((e, h) => { viewportListeners[e] = h; }),
                removeEventListener: vi.fn()
            };
            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={false}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');
            // On desktop, bottom is always 0
            expect(windowPaper).toHaveStyle({ bottom: '0px', height: '420px' });
        });
    });

    describe('5. Adversarial Stress & Edge Cases', () => {
        it('withstands 50 rapid sequential resize and scroll bursts without desynchronizing state', () => {
            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: vi.fn()
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');

            // Fire 50 rapid alternating resize and scroll events
            act(() => {
                for (let i = 0; i < 50; i++) {
                    mockVisualViewport.height = 800 - (i % 2 === 0 ? 300 : 100);
                    viewportListeners['resize']?.();
                    viewportListeners['scroll']?.();
                }
            });

            // Final state: 800 - 100 = 700px viewport, offset = 100px
            expect(windowPaper).toHaveStyle({ bottom: '100px' });
            // Height = Math.min(700 - 12, 460) = 460px
            expect(windowPaper).toHaveStyle({ height: '460px', maxHeight: '700px' });
        });

        it('handles extreme keyboard occlusion safely (viewport shrinks to 80px)', () => {
            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: vi.fn()
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');

            // Massive keyboard: 720px keyboard, viewport height only 80px
            act(() => {
                mockVisualViewport.height = 80;
                viewportListeners['resize']?.();
            });

            // Bottom offset = 800 - 80 = 720px
            expect(windowPaper).toHaveStyle({ bottom: '720px' });
            // Height = Math.min(80 - 12, 460) = 68px
            expect(windowPaper).toHaveStyle({ height: '68px', maxHeight: '80px' });
        });

        it('clamps negative offset when visualViewport height exceeds innerHeight', () => {
            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((event, handler) => {
                    viewportListeners[event] = handler;
                }),
                removeEventListener: vi.fn()
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    index={0}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            const windowPaper = screen.getByTestId('floating-chat-window');

            // visualViewport expands beyond innerHeight (e.g. browser bar hidden)
            act(() => {
                mockVisualViewport.height = 920;
                viewportListeners['resize']?.();
            });

            // offset clamped to 0 by Math.max(0, window.innerHeight - curHeight)
            expect(windowPaper).toHaveStyle({ bottom: '0px', height: '75vh' });
        });

        it('clears pending timers cleanly on unmount without state update warnings', () => {
            vi.useFakeTimers();

            const viewportListeners = {};
            const mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn((e, h) => { viewportListeners[e] = h; }),
                removeEventListener: vi.fn()
            };

            Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
            Object.defineProperty(window, 'visualViewport', { writable: true, configurable: true, value: mockVisualViewport });

            const { unmount } = render(
                <FloatingChatPopup
                    chat={mockPartner}
                    isMobile={true}
                    messages={mockMessages}
                    currentUserId="user-self-1"
                />
            );

            // Trigger keyboard offset to start 80ms timer
            act(() => {
                mockVisualViewport.height = 500;
                viewportListeners['resize']?.();
            });

            // Unmount immediately before timer expires
            unmount();

            // Advancing timers should not throw or cause warning
            expect(() => {
                act(() => {
                    vi.advanceTimersByTime(200);
                });
            }).not.toThrow();

            vi.useRealTimers();
        });
    });
});
