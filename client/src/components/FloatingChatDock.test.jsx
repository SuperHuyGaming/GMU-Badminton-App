import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
            name: 'Tu Pham',
            avatarUrl: 'https://example.com/tu.png'
        },
        lastMessage: 'Cuối tuần đi đánh cầu không?'
    }
];

const mockMessages = [
    {
        _id: 'msg-1',
        sender: { _id: 'user-friend-1', name: 'Tu Pham' },
        recipient: { _id: 'user-self-1', name: 'Current Player' },
        content: 'sao roi ong',
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
        expect(screen.getByText('Tu Pham')).toBeInTheDocument();
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
                    name: 'Nhat Quang',
                    avatarUrl: ''
                }
            })
        );

        await waitFor(() => {
            expect(screen.getByTestId('floating-chat-window')).toBeInTheDocument();
            expect(screen.getByText('Nhat Quang')).toBeInTheDocument();
        });
    });

    it('submits a new message when send button is clicked', async () => {
        apiFetch.mockImplementation(async (url, opts) => {
            if (opts?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({
                        _id: 'msg-new-1',
                        content: 'Hey Tu!',
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
        fireEvent.change(input, { target: { value: 'Hey Tu!' } });

        const sendBtn = screen.getByRole('button', { name: /send message/i });
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/messages', expect.objectContaining({
                method: 'POST'
            }));
            expect(screen.getByText('Hey Tu!')).toBeInTheDocument();
        });
    });
});
