// Regression tests for live chat on /messages (two-bot E2E findings):
// - a live message must render exactly once (it used to appear 2-3 times under StrictMode)
// - our own message's socket echo must replace the optimistic copy, not duplicate it
// - mark-as-read must fire exactly once per incoming message
import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Messages from './Messages';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';
import { isChatVisible } from '../utils/chatState';

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

const ALICE = { id: 'alice-1', _id: 'alice-1', name: 'Alice Bot' };
const BOB = { _id: 'bob-2', name: 'Bob Bot', profilePic: '' };

const emitSocket = (event, payload) => {
    act(() => {
        socketHandlers[event]?.forEach((cb) => cb(payload));
    });
};

const json = (data, ok = true) => ({ ok, json: async () => data });

// Chat bubbles only (the sidebar's last-message preview is a body2 Typography).
const bubbles = (text) => screen.queryAllByText(text, { selector: 'p.MuiTypography-body1' });

let postResponse;

const renderMessages = () =>
    render(
        <StrictMode>
            <AuthContext.Provider value={{ user: ALICE }}>
                <MemoryRouter initialEntries={['/messages']}>
                    <Messages />
                </MemoryRouter>
            </AuthContext.Provider>
        </StrictMode>
    );

const readCalls = () =>
    apiFetch.mock.calls.filter(([url, opts]) => url.startsWith('/api/messages/read/') && opts?.method === 'PUT');

describe('Messages page live chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
        Element.prototype.scrollIntoView = vi.fn();
        localStorage.setItem('activeChat', JSON.stringify(BOB));
        postResponse = null;
        apiFetch.mockImplementation(async (url, opts) => {
            if (url.startsWith('/api/friends/')) return json({ friends: [] });
            if (url.startsWith('/api/messages/recent/')) return json([]);
            if (url.startsWith('/api/messages/read/')) return json({ message: 'ok' });
            if (url === '/api/messages' && opts?.method === 'POST') return postResponse();
            if (url.startsWith(`/api/messages/${ALICE.id}/${BOB._id}`)) return json({ messages: [], hasMore: false });
            return json({});
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('registers exactly one privateMessage listener (even under StrictMode)', async () => {
        renderMessages();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/messages/${ALICE.id}/${BOB._id}?page=1&limit=50`));
        expect(socketHandlers.privateMessage?.size).toBe(1);
    });

    it('renders an incoming live message once and marks it read once', async () => {
        renderMessages();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/messages/${ALICE.id}/${BOB._id}?page=1&limit=50`));

        const incoming = {
            _id: 'msg-100',
            sender: { _id: BOB._id, name: BOB.name },
            receiver: { _id: ALICE.id, name: ALICE.name },
            content: 'Hello from Bob',
            timestamp: new Date().toISOString(),
        };
        emitSocket('privateMessage', incoming);
        // Same message delivered again (e.g. reconnect) must still render once.
        emitSocket('privateMessage', incoming);

        await waitFor(() => expect(bubbles('Hello from Bob')).toHaveLength(1));
        expect(readCalls()).toHaveLength(1);
        expect(readCalls()[0][0]).toBe(`/api/messages/read/${ALICE.id}/${BOB._id}`);
    });

    it('fires mark-as-read exactly once for a single incoming message', async () => {
        renderMessages();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/messages/${ALICE.id}/${BOB._id}?page=1&limit=50`));
        const before = readCalls().length;

        emitSocket('privateMessage', {
            _id: 'msg-200',
            sender: { _id: BOB._id, name: BOB.name },
            receiver: { _id: ALICE.id, name: ALICE.name },
            content: 'One read please',
            timestamp: new Date().toISOString(),
        });

        await waitFor(() => expect(bubbles('One read please')).toHaveLength(1));
        expect(readCalls().length - before).toBe(1);
    });

    it('does not duplicate my own message when the socket echo arrives before the POST response', async () => {
        let resolvePost;
        postResponse = () => new Promise((resolve) => { resolvePost = resolve; });
        renderMessages();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/messages/${ALICE.id}/${BOB._id}?page=1&limit=50`));

        const input = screen.getByRole('textbox', { name: 'Type a message' });
        fireEvent.change(input, { target: { value: 'Hi Bob' } });
        fireEvent.submit(input.closest('form'));

        // Optimistic copy shows immediately.
        await waitFor(() => expect(bubbles('Hi Bob')).toHaveLength(1));

        const saved = {
            _id: 'msg-300',
            sender: { _id: ALICE.id, name: ALICE.name },
            receiver: { _id: BOB._id, name: BOB.name },
            content: 'Hi Bob',
            timestamp: new Date().toISOString(),
        };
        // Echo first...
        emitSocket('privateMessage', saved);
        expect(bubbles('Hi Bob')).toHaveLength(1);
        // ...then the POST response.
        await act(async () => { resolvePost(json(saved)); });

        await waitFor(() => expect(bubbles('Hi Bob')).toHaveLength(1));
        // My own message never triggers mark-as-read.
        expect(readCalls().filter(([url]) => url.includes(ALICE.id + '/' + ALICE.id))).toHaveLength(0);
    });

    it('does not duplicate my own message when the POST response arrives before the socket echo', async () => {
        const saved = {
            _id: 'msg-400',
            sender: { _id: ALICE.id, name: ALICE.name },
            receiver: { _id: BOB._id, name: BOB.name },
            content: 'Second order',
            timestamp: new Date().toISOString(),
        };
        postResponse = async () => json(saved);
        renderMessages();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/messages/${ALICE.id}/${BOB._id}?page=1&limit=50`));

        const input = screen.getByRole('textbox', { name: 'Type a message' });
        fireEvent.change(input, { target: { value: 'Second order' } });
        await act(async () => { fireEvent.submit(input.closest('form')); });

        emitSocket('privateMessage', saved);
        await waitFor(() => expect(bubbles('Second order')).toHaveLength(1));
    });

    it('marks the open conversation as visible so the global badge ignores it', async () => {
        const { unmount } = renderMessages();
        await waitFor(() => expect(isChatVisible(BOB._id)).toBe(true));
        unmount();
        expect(isChatVisible(BOB._id)).toBe(false);
    });

    it('broadcasts chatRead for the partner when the conversation is opened', async () => {
        const events = [];
        const onRead = (e) => events.push(e.detail);
        window.addEventListener('chatRead', onRead);
        renderMessages();
        await waitFor(() => expect(events.some((d) => d.partnerId === BOB._id && !d.optimistic)).toBe(true));
        expect(events.some((d) => d.partnerId === BOB._id && d.optimistic)).toBe(true);
        window.removeEventListener('chatRead', onRead);
    });
});
