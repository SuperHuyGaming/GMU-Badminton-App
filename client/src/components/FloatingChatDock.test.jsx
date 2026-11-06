import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FloatingChatDock from './FloatingChatDock';
import { AuthContext } from '../context/AuthContext';
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
    _id: 'user-self-1',
    name: 'Current Player',
    email: 'player@gmu.edu',
    avatarUrl: 'https://example.com/avatar.png'
};

const mockRecentConversations = [
    {
        partner: {
            _id: 'user-friend-1',
            name: 'Alex Chen',
            avatarUrl: 'https://example.com/tu.png'
        },
        lastMessage: 'Ready for court 3 tonight?'
    }
];

const mockMessages = [
    {
        _id: 'msg-1',
        sender: { _id: 'user-friend-1', name: 'Alex Chen' },
        recipient: { _id: 'user-self-1', name: 'Current Player' },
        content: 'Hey, are we playing doubles at RAC?',
        createdAt: new Date().toISOString()
    }
];

describe('FloatingChatDock Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(key => delete mockSocketListeners[key]);
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/messages/recent/')) {
                return {
                    ok: true,
                    json: async () => mockRecentConversations
                };
            }
            if (url.includes('/api/messages/user-self-1/user-friend-1')) {
                return {
                    ok: true,
                    json: async () => mockMessages
                };
            }
            if (url.includes('/api/messages/read/')) {
                return { ok: true, json: async () => ({}) };
            }
            return { ok: true, json: async () => ({}) };
        });
    });

    const renderChatDock = (authUser = mockUser) => {
        return render(
            <AuthContext.Provider value={{ user: authUser, token: 'mock-token' }}>
                <FloatingChatDock />
            </AuthContext.Provider>
        );
    };

    it('renders collapsed floating launcher button when user is logged in', async () => {
        renderChatDock();
        expect(screen.getByTestId('floating-chat-launcher')).toBeInTheDocument();
        expect(screen.queryByTestId('floating-chat-window')).not.toBeInTheDocument();
    });

    it('does not render launcher when user is unauthenticated', () => {
        renderChatDock(null);
        expect(screen.queryByTestId('floating-chat-launcher')).not.toBeInTheDocument();
    });

    it('expands chat window when floating launcher button is clicked', async () => {
        renderChatDock();
        const launcher = screen.getByTestId('floating-chat-launcher');
        fireEvent.click(launcher);

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
        });
        expect(screen.getByText('Alex Chen')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Aa')).toBeInTheDocument();
    });

    it('minimizes chat window when minimize button is clicked', async () => {
        renderChatDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
        });

        const minimizeBtn = screen.getByRole('button', { name: /minimize chat window/i });
        fireEvent.click(minimizeBtn);

        expect(screen.queryByTestId('floating-chat-window')).not.toBeInTheDocument();
        expect(screen.getByTestId('floating-chat-launcher')).toBeInTheDocument();
    });

    it('closes chat window when close button is clicked', async () => {
        renderChatDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
        });

        const closeBtn = screen.getByRole('button', { name: /close chat window/i });
        fireEvent.click(closeBtn);

        expect(screen.queryByTestId('floating-chat-window')).not.toBeInTheDocument();
    });

    it('opens chat directly with a user when openChatWithUser event is dispatched', async () => {
        renderChatDock();

        window.dispatchEvent(
            new CustomEvent('openChatWithUser', {
                detail: {
                    _id: 'user-friend-2',
                    name: 'David Kim',
                    avatarUrl: ''
                }
            })
        );

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
            expect(screen.getByText('David Kim')).toBeInTheDocument();
        });
    });

    it('submits a new message when send button is clicked', async () => {
        apiFetch.mockImplementation(async (url, opts) => {
            if (opts?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({
                        _id: 'msg-new-1',
                        content: 'Hey Alex!',
                        sender: { _id: 'user-self-1', name: 'Current Player' },
                        createdAt: new Date().toISOString()
                    })
                };
            }
            return { ok: true, json: async () => mockMessages };
        });

        renderChatDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
        });

        const input = screen.getByPlaceholderText('Aa');
        fireEvent.change(input, { target: { value: 'Hey Alex!' } });

        const sendBtn = screen.getByRole('button', { name: /send message/i });
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({
                method: 'POST'
            }));
            expect(screen.getByText('Hey Alex!')).toBeInTheDocument();
        });
    });
    it('allows choosing from active community members when opened without active recipient', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/messages/recent/')) {
                return { ok: true, json: async () => [] };
            }
            if (url.includes('/api/forum/members')) {
                return {
                    ok: true,
                    json: async () => ({
                        users: [
                            { _id: 'user-member-1', name: 'Jordan Smith', skillLevel: 'Advanced', profilePic: '' },
                            { _id: 'user-member-2', name: 'Taylor Lee', skillLevel: 'Intermediate', profilePic: '' }
                        ]
                    })
                };
            }
            if (url.includes('/api/messages/user-self-1/user-member-1')) {
                return { ok: true, json: async () => [] };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderChatDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
        });

        expect(screen.getByText(/Select a badminton partner to start chatting/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Jordan Smith')).toBeInTheDocument();
            expect(screen.getByText('Taylor Lee')).toBeInTheDocument();
        });

        const chatJordanBtn = screen.getByRole('button', { name: /chat with jordan smith/i });
        fireEvent.click(chatJordanBtn);

        await waitFor(() => {
            expect(screen.getByText('Say hi to Jordan Smith! 👋')).toBeInTheDocument();
        });

        const input = screen.getByPlaceholderText('Aa');
        expect(input).not.toBeDisabled();
    });
});

describe('FloatingChatDock unread badge + live message de-duplication', () => {
    const friend = { _id: 'user-friend-1', name: 'Alex Chen', profilePic: '' };
    let recent;
    let postResponse;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(key => delete mockSocketListeners[key]);
        recent = [{ friend, lastMessage: { _id: 'm0', content: 'yo' }, unreadCount: 0 }];
        postResponse = null;
        apiFetch.mockImplementation(async (url, opts) => {
            if (url.includes('/api/messages/recent/')) return { ok: true, json: async () => JSON.parse(JSON.stringify(recent)) };
            if (url.includes('/api/messages/read/')) return { ok: true, json: async () => ({}) };
            if (url === '/api/messages' && opts?.method === 'POST') return postResponse();
            if (url.includes('/api/messages/user-self-1/user-friend-1')) return { ok: true, json: async () => ({ messages: [], hasMore: false }) };
            return { ok: true, json: async () => ({}) };
        });
    });

    const renderDock = () => render(
        <AuthContext.Provider value={{ user: mockUser, token: 'mock-token' }}>
            <FloatingChatDock />
        </AuthContext.Provider>
    );
    const badgeEl = () => screen.getByTestId('floating-chat-unread-badge').querySelector(':scope > .MuiBadge-badge');
    const readCalls = () => apiFetch.mock.calls.filter(([url, o]) => url.startsWith('/api/messages/read/') && o?.method === 'PUT');

    it('shows the unread count on the launcher and clears it when the chat is read elsewhere', async () => {
        recent[0].unreadCount = 2;
        renderDock();
        await waitFor(() => expect(badgeEl()).toHaveTextContent('2'));
        expect(badgeEl()).not.toHaveClass('MuiBadge-invisible');

        act(() => {
            window.dispatchEvent(new CustomEvent('chatRead', { detail: { partnerId: 'user-friend-1', optimistic: true } }));
        });
        await waitFor(() => expect(badgeEl()).toHaveClass('MuiBadge-invisible'));
    });

    it('shows an unread badge when a message arrives while the dock is collapsed', async () => {
        renderDock();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/messages/recent/user-self-1'));
        expect(badgeEl()).toHaveClass('MuiBadge-invisible');

        recent[0].unreadCount = 1;
        act(() => {
            mockSocketListeners.privateMessage({
                _id: 'msg-live-1',
                sender: { _id: 'user-friend-1', name: 'Alex Chen' },
                receiver: { _id: 'user-self-1', name: 'Current Player' },
                content: 'You up for doubles?'
            });
        });
        await waitFor(() => expect(badgeEl()).toHaveTextContent('1'));
        expect(badgeEl()).not.toHaveClass('MuiBadge-invisible');
        // Collapsed: the message is NOT marked read.
        expect(readCalls()).toHaveLength(0);
    });

    it('opening the chat clears the badge and marks the conversation read once', async () => {
        recent[0].unreadCount = 1;
        renderDock();
        await waitFor(() => expect(badgeEl()).toHaveTextContent('1'));
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));
        await waitFor(() => expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument());
        await waitFor(() => expect(readCalls()).toHaveLength(1));
        fireEvent.click(screen.getByRole('button', { name: /minimize chat window/i }));
        expect(badgeEl()).toHaveClass('MuiBadge-invisible');
    });

    it('renders an incoming message once and marks it read once while the chat is open', async () => {
        renderDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));
        await waitFor(() => expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument());
        await waitFor(() => expect(readCalls()).toHaveLength(1)); // from opening the conversation
        const incoming = {
            _id: 'msg-live-2',
            sender: { _id: 'user-friend-1', name: 'Alex Chen' },
            receiver: { _id: 'user-self-1', name: 'Current Player' },
            content: 'See you at RAC'
        };
        act(() => { mockSocketListeners.privateMessage(incoming); });
        await waitFor(() => expect(screen.getAllByText('See you at RAC')).toHaveLength(1));
        await waitFor(() => expect(readCalls()).toHaveLength(2));
    });

    it('does not duplicate my own message when the socket echo arrives before the POST response', async () => {
        let resolvePost;
        postResponse = () => new Promise((resolve) => { resolvePost = resolve; });
        renderDock();
        fireEvent.click(screen.getByTestId('floating-chat-launcher'));
        await waitFor(() => expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument());
        await waitFor(() => expect(screen.getByPlaceholderText('Aa')).not.toBeDisabled());

        fireEvent.change(screen.getByPlaceholderText('Aa'), { target: { value: 'Ping' } });
        fireEvent.click(screen.getByRole('button', { name: /send message/i }));
        await waitFor(() => expect(screen.getAllByText('Ping')).toHaveLength(1));

        const saved = {
            _id: 'msg-saved-1',
            sender: { _id: 'user-self-1', name: 'Current Player' },
            receiver: { _id: 'user-friend-1', name: 'Alex Chen' },
            content: 'Ping'
        };
        act(() => { mockSocketListeners.privateMessage(saved); });
        expect(screen.getAllByText('Ping')).toHaveLength(1);
        await act(async () => { resolvePost({ ok: true, json: async () => saved }); });
        await waitFor(() => expect(screen.getAllByText('Ping')).toHaveLength(1));
    });
});

describe('FloatingChatDock Multi-Chat & Bubble Rail Features', () => {
    const user1 = { _id: 'u1', name: 'Alex Chen', avatarUrl: '' };
    const user2 = { _id: 'u2', name: 'Bob Smith', avatarUrl: '' };
    const user3 = { _id: 'u3', name: 'Charlie Kim', avatarUrl: '' };
    const user4 = { _id: 'u4', name: 'Dave Wilson', avatarUrl: '' };
    const user5 = { _id: 'u5', name: 'Eve Davis', avatarUrl: '' };
    const user6 = { _id: 'u6', name: 'Frank Miller', avatarUrl: '' };
    const user7 = { _id: 'u7', name: 'Grace Hopper', avatarUrl: '' };

    const setMobileViewport = (isMobile) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            configurable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: isMobile && (query.includes('max-width') || query.includes('599.95px')),
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

    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockSocketListeners).forEach(k => delete mockSocketListeners[k]);
        Element.prototype.scrollIntoView = vi.fn();
        setMobileViewport(false);
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/messages/recent/')) return { ok: true, json: async () => [] };
            if (url.includes('/api/messages/read/')) return { ok: true, json: async () => ({}) };
            if (url.includes('/api/messages/')) return { ok: true, json: async () => [] };
            return { ok: true, json: async () => ({}) };
        });
    });

    const renderDock = () => render(
        <AuthContext.Provider value={{ user: mockUser, token: 'mock-token' }}>
            <FloatingChatDock />
        </AuthContext.Provider>
    );

    const openChat = (u) => {
        act(() => {
            window.dispatchEvent(new CustomEvent('openChatWithUser', { detail: u }));
        });
    };

    it('opens up to 3 popups side-by-side simultaneously', async () => {
        renderDock();
        openChat(user1);
        await waitFor(() => expect(screen.getByText('Alex Chen')).toBeInTheDocument());

        openChat(user2);
        await waitFor(() => expect(screen.getByText('Bob Smith')).toBeInTheDocument());

        openChat(user3);
        await waitFor(() => expect(screen.getByText('Charlie Kim')).toBeInTheDocument());

        // All 3 partner headers must be present simultaneously
        expect(screen.getByText('Alex Chen')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Charlie Kim')).toBeInTheDocument();

        expect(screen.getByTestId('floating-chat-popup-u1')).toBeInTheDocument();
        expect(screen.getByTestId('floating-chat-popup-u2')).toBeInTheDocument();
        expect(screen.getByTestId('floating-chat-popup-u3')).toBeInTheDocument();
    });

    it('auto-overflows oldest inactive chat to bubble rail when 4th chat is opened', async () => {
        renderDock();
        openChat(user1);
        openChat(user2);
        openChat(user3);
        await waitFor(() => expect(screen.getByText('Charlie Kim')).toBeInTheDocument());

        // Open 4th chat
        openChat(user4);
        await waitFor(() => expect(screen.getByText('Dave Wilson')).toBeInTheDocument());

        // Exactly 3 popups remain active
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Charlie Kim')).toBeInTheDocument();
        expect(screen.getByText('Dave Wilson')).toBeInTheDocument();

        // User 1 (Alex Chen) should now be in the bubble rail
        expect(screen.getByTestId('floating-chat-bubble-u1')).toBeInTheDocument();
    });

    it('restores popup from chat bubble when bubble is clicked', async () => {
        renderDock();
        openChat(user1);
        openChat(user2);
        openChat(user3);
        openChat(user4); // User 1 displaced to bubble

        await waitFor(() => expect(screen.getByTestId('floating-chat-bubble-u1')).toBeInTheDocument());

        // Click bubble for User 1
        fireEvent.click(screen.getByTestId('floating-chat-bubble-u1'));

        // User 1 is restored to an active popup
        await waitFor(() => expect(screen.getByTestId('floating-chat-popup-u1')).toBeInTheDocument());
        expect(screen.getByText('Alex Chen')).toBeInTheDocument();
    });

    it('enforces max 5 bubbles limit by dropping the oldest inactive bubble', async () => {
        renderDock();
        openChat(user1);
        openChat(user2);
        openChat(user3);
        await waitFor(() => expect(screen.getByText('Charlie Kim')).toBeInTheDocument());

        // Displace u1, u2, u3, u4, u5, u6 into bubbles
        openChat(user4);
        openChat(user5);
        openChat(user6);
        openChat(user7);
        openChat(user1);
        openChat(user2);

        await waitFor(() => expect(screen.getByTestId('floating-chat-popup-u2')).toBeInTheDocument());

        // Count bubbles currently rendered
        const bubbles = screen.queryAllByTestId(/^floating-chat-bubble-/);
        expect(bubbles.length).toBeLessThanOrEqual(5);
    });

    it('removes bubble completely when dismiss "x" is clicked', async () => {
        renderDock();
        openChat(user1);
        openChat(user2);
        openChat(user3);
        openChat(user4); // User 1 displaced to bubble

        await waitFor(() => expect(screen.getByTestId('floating-chat-bubble-u1')).toBeInTheDocument());

        const dismissBtn = screen.getByTestId('dismiss-chat-bubble-u1');
        fireEvent.click(dismissBtn);

        expect(screen.queryByTestId('floating-chat-bubble-u1')).not.toBeInTheDocument();
    });

    it('minimizing a popup collapses its height to title bar and restores on click', async () => {
        renderDock();
        openChat(user1);
        await waitFor(() => expect(screen.getByText('Alex Chen')).toBeInTheDocument());

        // Click minimize
        const minimizeBtn = screen.getByRole('button', { name: /minimize chat window/i });
        fireEvent.click(minimizeBtn);

        // Header remains visible but input is hidden
        expect(screen.getByText('Alex Chen')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Aa')).not.toBeInTheDocument();

        // Clicking the minimized header expands it back
        fireEvent.click(screen.getByText('Alex Chen'));
        await waitFor(() => expect(screen.getByPlaceholderText('Aa')).toBeInTheDocument());
    });

    it('collapses multi-window popups to a single drawer on mobile viewport', async () => {
        setMobileViewport(true);
        renderDock();
        openChat(user1);
        openChat(user2);

        // On mobile, only the latest active chat (user2) is displayed in the single responsive sheet
        await waitFor(() => expect(screen.getByText('Bob Smith')).toBeInTheDocument());
        expect(screen.queryByText('Alex Chen')).not.toBeInTheDocument();
    });

    it('routes incoming privateMessage to matching active popup and marks it read', async () => {
        renderDock();
        openChat(user1);
        openChat(user2);
        await waitFor(() => expect(screen.getByText('Bob Smith')).toBeInTheDocument());

        act(() => {
            mockSocketListeners.privateMessage({
                _id: 'live-msg-multi-1',
                sender: { _id: 'u1', name: 'Alex Chen' },
                receiver: { _id: 'user-self-1' },
                content: 'Match ready on court 4'
            });
        });

        await waitFor(() => expect(screen.getByText('Match ready on court 4')).toBeInTheDocument());
        const readCalls = apiFetch.mock.calls.filter(([url, o]) => url.startsWith('/api/messages/read/') && o?.method === 'PUT');
        expect(readCalls.some(([url]) => url.includes('/u1'))).toBe(true);
    });
});

