import { StrictMode, useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Messages from './Messages';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({ default: vi.fn() }));

const { socketHandlers, mockSocket } = vi.hoisted(() => {
    const handlers = {};
    const socket = {
        emit: vi.fn(),
        on: vi.fn((event, cb) => {
            (handlers[event] ||= new Set()).add(cb);
        }),
        off: vi.fn((event, cb) => {
            handlers[event]?.delete(cb);
        }),
    };
    return { socketHandlers: handlers, mockSocket: socket };
});
vi.mock('../utils/socket', () => ({ default: mockSocket }));

const ME = { id: 'me-user', _id: 'me-user', name: 'Current User' };
const FRIEND_A = { _id: 'user-a', name: 'Alice Smith', profilePic: 'https://example.com/a.jpg' };
const FRIEND_B = { _id: 'user-b', name: 'Bob Jones', profilePic: 'https://example.com/b.jpg' };
const FRIEND_C = { _id: 'user-c', name: 'Charlie Brown', profilePic: 'https://example.com/c.jpg' };

const json = (data, ok = true) => ({ ok, json: async () => data });

const emitSocket = (event, payload) => {
    act(() => {
        socketHandlers[event]?.forEach((cb) => cb(payload));
    });
};

const setMobileViewport = (isMobile) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: isMobile && (query.includes('max-width') || query.includes('899.95px') || query.includes('599.95px')),
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

// Component exposing router navigation for test assertions
let testNavigate;
const LocationTracker = ({ onChange }) => {
    const loc = useLocation();
    const nav = useNavigate();
    useEffect(() => {
        testNavigate = nav;
        onChange?.(loc);
    }, [loc, nav, onChange]);
    return null;
};

describe('Milestone 1 Challenger Empirical Stress Suite: Messages.jsx', () => {
    let mockFriends = [];
    let mockRecentChats = [];
    let lastLocation = null;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
        Element.prototype.scrollIntoView = vi.fn();
        localStorage.clear();
        setMobileViewport(false);

        mockFriends = [];
        mockRecentChats = [];
        lastLocation = null;
        testNavigate = null;

        apiFetch.mockImplementation(async (url, opts) => {
            if (url.startsWith('/api/friends/search/')) {
                const query = url.split('/search/')[1];
                if (query === 'Alice') return json([FRIEND_A]);
                return json([]);
            }
            if (url.startsWith('/api/friends/')) return json({ friends: mockFriends });
            if (url.startsWith('/api/messages/recent/')) return json(mockRecentChats);
            if (url.startsWith('/api/messages/read/')) return json({ message: 'ok' });
            if (url.startsWith('/api/profile/user-b')) return json(FRIEND_B);
            if (url.startsWith('/api/profile/user-a')) return json(FRIEND_A);
            if (url === '/api/messages' && opts?.method === 'POST') {
                const body = JSON.parse(opts.body);
                return json({
                    _id: `msg-${Date.now()}`,
                    sender: { _id: ME.id, name: ME.name },
                    receiver: { _id: body.receiverId },
                    content: body.content,
                    timestamp: new Date().toISOString()
                });
            }
            if (url.startsWith('/api/messages/')) return json({ messages: [], hasMore: false });
            return json({});
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    const renderWithRouter = (initialEntries = ['/messages']) => {
        return render(
            <StrictMode>
                <AuthContext.Provider value={{ user: ME }}>
                    <MemoryRouter initialEntries={initialEntries}>
                        <LocationTracker onChange={(loc) => { lastLocation = loc; }} />
                        <Routes>
                            <Route path="/messages" element={<Messages />} />
                        </Routes>
                    </MemoryRouter>
                </AuthContext.Provider>
            </StrictMode>
        );
    };

    describe('1. Active Now Deduplication & Graceful Collapse', () => {
        it('deduplicates users present in both friends list and recentChats, and excludes self and disconnected users', async () => {
            mockFriends = [FRIEND_A, FRIEND_B];
            mockRecentChats = [
                {
                    friend: FRIEND_A, // Duplicate of FRIEND_A
                    lastMessage: { content: 'Hi Alice', timestamp: new Date().toISOString() },
                    unreadCount: 0
                },
                {
                    friend: FRIEND_C, // Not in mockFriends
                    lastMessage: { content: 'Hi Charlie', timestamp: new Date().toISOString() },
                    unreadCount: 0
                }
            ];

            renderWithRouter();

            // Emit socket online users containing: current user, Alice, Bob, Charlie, and disconnected stranger
            emitSocket('onlineUsersUpdate', ['me-user', 'user-a', 'user-b', 'user-c', 'disconnected-user-999']);

            await waitFor(() => {
                expect(screen.getByText('Active Now')).toBeInTheDocument();
            });

            // Exactly 3 online (Alice, Bob, Charlie)
            expect(screen.getByText('3 online')).toBeInTheDocument();

            // Alice must only appear once in Active Now carousel
            const aliceActiveButtons = screen.getAllByRole('button', { name: 'Chat with Alice Smith' });
            expect(aliceActiveButtons).toHaveLength(1);

            // Charlie from recentChats is also included
            expect(screen.getByRole('button', { name: 'Chat with Charlie Brown' })).toBeInTheDocument();

            // Current logged in user must NOT appear in Active Now
            expect(screen.queryByRole('button', { name: 'Chat with Current User' })).toBeNull();
        });

        it('gracefully collapses Active Now carousel when 0 friends are online', async () => {
            mockFriends = [FRIEND_A, FRIEND_B];
            mockRecentChats = [];

            renderWithRouter();

            // Emit only non-friends and self
            emitSocket('onlineUsersUpdate', ['stranger-123', 'me-user']);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalled();
            });

            expect(screen.queryByText('Active Now')).toBeNull();
            expect(screen.queryByText(/online/i)).toBeNull();
        });

        it('gracefully collapses Active Now carousel when onlineUsers is empty or malformed', async () => {
            mockFriends = [FRIEND_A];
            renderWithRouter();

            emitSocket('onlineUsersUpdate', []);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalled();
            });

            expect(screen.queryByText('Active Now')).toBeNull();
        });

        it('collapses Active Now carousel when search query is entered', async () => {
            mockFriends = [FRIEND_A];
            renderWithRouter();
            emitSocket('onlineUsersUpdate', ['user-a']);

            await waitFor(() => {
                expect(screen.getByText('Active Now')).toBeInTheDocument();
            });

            const searchInput = screen.getByRole('textbox', { name: 'Search users' });
            fireEvent.change(searchInput, { target: { value: 'Alice' } });

            await waitFor(() => {
                expect(screen.queryByText('Active Now')).toBeNull();
            });
        });

        it('1-tap on Active Now avatar directly opens chat and updates URL query param', async () => {
            mockFriends = [FRIEND_A];
            renderWithRouter();
            emitSocket('onlineUsersUpdate', ['user-a']);

            const avatarBtn = await screen.findByRole('button', { name: 'Chat with Alice Smith' });
            fireEvent.click(avatarBtn);

            await waitFor(() => {
                expect(lastLocation?.search).toBe('?userId=user-a');
            });
        });
    });

    describe('2. Filter Controls & Unread Badging', () => {
        beforeEach(() => {
            mockFriends = [FRIEND_A, FRIEND_B, FRIEND_C];
            mockRecentChats = [
                {
                    friend: FRIEND_A,
                    lastMessage: { content: 'Unread message 1', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
                    unreadCount: 3
                },
                {
                    friend: FRIEND_B,
                    lastMessage: { content: 'Read message 2', timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
                    unreadCount: 0
                },
                {
                    friend: FRIEND_C,
                    lastMessage: { content: 'Unread message 3', timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
                    unreadCount: 150 // High unread count for 99+ test
                }
            ];
        });

        it('displays correct unread badge count on Unread filter chip and "Unread" when 0', async () => {
            renderWithRouter();

            // Unread chip should show "Unread (2)" because 2 chats have unread messages
            const unreadChip = await screen.findByRole('button', { name: 'Show unread messages (2)' });
            expect(unreadChip).toBeInTheDocument();
        });

        it('formats 99+ cap for high unread counts in contact list', async () => {
            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('99+')).toBeInTheDocument();
                expect(screen.getByText('3')).toBeInTheDocument();
            });
        });

        it('filters conversation list when switching to "Unread" tab and restores on "All"', async () => {
            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Conversation with Alice Smith' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Conversation with Bob Jones' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Conversation with Charlie Brown' })).toBeInTheDocument();
            });

            // Switch to Unread tab
            const unreadChip = screen.getByRole('button', { name: 'Show unread messages (2)' });
            fireEvent.click(unreadChip);

            // Bob Jones (unreadCount = 0) is filtered out
            expect(screen.getByRole('button', { name: 'Conversation with Alice Smith' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Conversation with Charlie Brown' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Conversation with Bob Jones' })).toBeNull();

            // Switch back to All tab
            const allChip = screen.getByRole('button', { name: 'Show all messages' });
            fireEvent.click(allChip);

            // Bob Jones is back
            expect(screen.getByRole('button', { name: 'Conversation with Bob Jones' })).toBeInTheDocument();
        });

        it('shows "No unread messages." when unread filter is active and 0 unread chats exist', async () => {
            mockRecentChats = [
                {
                    friend: FRIEND_B,
                    lastMessage: { content: 'All caught up', timestamp: new Date().toISOString() },
                    unreadCount: 0
                }
            ];

            renderWithRouter();

            const unreadChip = await screen.findByRole('button', { name: 'Show unread messages' });
            fireEvent.click(unreadChip);

            expect(screen.getByText('No unread messages.')).toBeInTheDocument();
        });
    });

    describe('3. Relative Timestamps Formatting & Precision', () => {
        it('calculates "now", "5m", and "2h" relative timestamps correctly', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.setSystemTime(new Date(2026, 10, 7, 15, 0, 0));
            const now = Date.now();
            mockRecentChats = [
                {
                    friend: FRIEND_A,
                    lastMessage: { content: 'Just now message', timestamp: new Date(now - 10 * 1000).toISOString() },
                    unreadCount: 0
                },
                {
                    friend: FRIEND_B,
                    lastMessage: { content: 'Five minutes ago', timestamp: new Date(now - 5 * 60 * 1000).toISOString() },
                    unreadCount: 0
                },
                {
                    friend: FRIEND_C,
                    lastMessage: { content: 'Two hours ago', timestamp: new Date(now - 2 * 3600 * 1000).toISOString() },
                    unreadCount: 0
                }
            ];

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('now')).toBeInTheDocument();
                expect(screen.getByText('5m')).toBeInTheDocument();
                expect(screen.getByText('2h')).toBeInTheDocument();
            });
            vi.useRealTimers();
        });

        it('calculates "Yesterday" correctly for messages sent previous day', async () => {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            yesterday.setHours(12, 0, 0, 0);

            mockRecentChats = [
                {
                    friend: FRIEND_A,
                    lastMessage: { content: 'Sent yesterday', timestamp: yesterday.toISOString() },
                    unreadCount: 0
                }
            ];

            renderWithRouter();

            await waitFor(() => {
                expect(screen.getByText('Yesterday')).toBeInTheDocument();
            });
        });
    });

    describe('4. Touch-First Composer & Interactions', () => {
        it('renders dynamic 👍 Quick Like button when empty and swaps to Send button when text is entered', async () => {
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Send a thumbs-up' })).toBeInTheDocument();
            });

            // Tap thumbs-up sends 👍
            const thumbsUpBtn = screen.getByRole('button', { name: 'Send a thumbs-up' });
            fireEvent.click(thumbsUpBtn);

            expect(apiFetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"content":"👍"')
            }));

            // Typing text swaps thumbs-up to paper-plane send button
            const input = screen.getByRole('textbox', { name: 'Type a message' });
            fireEvent.change(input, { target: { value: 'Hello Bob!' } });

            expect(screen.queryByRole('button', { name: 'Send a thumbs-up' })).toBeNull();
            expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
        });

        it('validates image attachments and rejects files over 10MB', async () => {
            window.alert = vi.fn();
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Attach photo or image' })).toBeInTheDocument();
            });

            const fileInput = document.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();

            // Try uploading oversized file (>10MB)
            const oversizedFile = new File(['x'.repeat(1024)], 'giant.png', { type: 'image/png' });
            Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 });

            fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('exceeds 10MB'));
        });

        it('rejects non-image files upon attachment', async () => {
            window.alert = vi.fn();
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Attach photo or image' })).toBeInTheDocument();
            });

            const fileInput = document.querySelector('input[type="file"]');
            const pdfFile = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });

            fireEvent.change(fileInput, { target: { files: [pdfFile] } });

            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('valid image file'));
        });
    });

    describe('5. Browser & Hardware Back Navigation State', () => {
        it('activates conversation when mounted with ?userId= query parameter', async () => {
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                // Verifies conversation header profile details button is rendered
                expect(screen.getByRole('button', { name: "View Bob Jones's profile details" })).toBeInTheDocument();
                expect(apiFetch).toHaveBeenCalledWith('/api/profile/user-b');
            });
        });

        it('clears activeChat and navigates back to inbox via in-app Back button on mobile', async () => {
            setMobileViewport(true);
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Back to conversations' })).toBeInTheDocument();
            });

            const backBtn = screen.getByRole('button', { name: 'Back to conversations' });
            fireEvent.click(backBtn);

            await waitFor(() => {
                expect(lastLocation?.pathname).toBe('/messages');
                expect(lastLocation?.search).toBe('');
                expect(localStorage.getItem('activeChat')).toBeNull();
            });
        });

        it('clears activeChat on mobile when navigating back to /messages with no query params', async () => {
            setMobileViewport(true);
            mockFriends = [FRIEND_B];
            renderWithRouter(['/messages?userId=user-b']);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: "View Bob Jones's profile details" })).toBeInTheDocument();
            });

            // Navigate back to /messages without userId query param
            act(() => {
                testNavigate('/messages');
            });

            await waitFor(() => {
                expect(localStorage.getItem('activeChat')).toBeNull();
                expect(screen.queryByRole('button', { name: "View Bob Jones's profile details" })).toBeNull();
            });
        });
    });
});
