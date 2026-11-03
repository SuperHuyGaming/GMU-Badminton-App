import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

vi.mock('../utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    }
}));

const mockPlayer = {
    _id: 'user-huy-1',
    name: 'Truong Ngoc Minh Huy',
    email: 'huy@gmu.edu',
    skillLevel: 'Advanced',
    profilePic: 'https://example.com/huy.png',
    role: 'user'
};

const mockFeedResponse = {
    feed: [
        {
            _id: 'post-1',
            referenceId: 'post-1',
            type: 'post',
            title: 'Who is going to GMU Open?',
            content: 'Looking for a competitive mixed partner for this weekend.',
            authorId: 'user-huy-1',
            authorName: 'Truong Ngoc Minh Huy',
            category: 'general',
            createdAt: new Date().toISOString(),
            reactions: [{ type: 'like', count: 1 }],
            comments: []
        }
    ],
    hasMore: false,
    nextCursor: null
};

describe('Forum 3-Column Facebook Layout & Ecosystem Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/feed')) {
                return {
                    ok: true,
                    json: async () => mockFeedResponse
                };
            }
            if (url.includes('/api/feed/trending-tags')) {
                return {
                    ok: true,
                    json: async () => [{ tag: 'Tournament', count: 5 }, { tag: 'RAC', count: 3 }]
                };
            }
            return { ok: true, json: async () => ({}) };
        });
    });

    const renderForum = (user = mockPlayer) => {
        return render(
            <AuthContext.Provider value={{ user, token: 'mock-token' }}>
                <BrowserRouter>
                    <Forum />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    it('renders Facebook 3-column ecosystem layout with Left and Right rails', async () => {
        renderForum();

        await waitFor(() => {
            expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument();
        });

        // Left rail shortcuts
        const leftRail = screen.getByTestId('facebook-left-rail');
        expect(leftRail).toBeInTheDocument();
        expect(within(leftRail).getByText('Quick Shortcuts')).toBeInTheDocument();
        expect(within(leftRail).getByRole('button', { name: /saved posts/i })).toBeInTheDocument();
        expect(within(leftRail).getByRole('button', { name: /find players/i })).toBeInTheDocument();
        expect(within(leftRail).getByRole('button', { name: /gear marketplace/i })).toBeInTheDocument();

        // Right rail widgets
        expect(screen.getByTestId('facebook-right-rail')).toBeInTheDocument();
        expect(screen.getByText('Upcoming Tournaments')).toBeInTheDocument();
        // No real tournaments in this mock, so the widget shows its empty state (never placeholder events)
        expect(await screen.findByText('No upcoming tournaments')).toBeInTheDocument();
        expect(screen.queryByText('Mason Fall Open 2026')).not.toBeInTheDocument();
        expect(screen.getByText('Badminton Buddies')).toBeInTheDocument();
        // RAC court check-in widget must be gone from the community page
        expect(screen.queryByText(/RAC Court Occupancy/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Check In to RAC Courts/i)).not.toBeInTheDocument();
    });

    it('shows a polite empty state (and no member dump) when the user has no play data', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/feed')) return { ok: true, json: async () => mockFeedResponse };
            if (url.includes('/api/profile')) return { ok: true, json: async () => ({ stats: { totalMatches: 0 } }) };
            if (url.includes('/api/forum/members')) {
                return { ok: true, json: async () => ({ users: [{ _id: 'u-dummy', name: 'Dummy Tester' }] }) };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderForum();

        expect(await screen.findByTestId('buddies-empty-state')).toHaveTextContent(
            'Play some matches to get buddy recommendations!'
        );
        expect(screen.queryByText('Dummy Tester')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^chat with/i })).not.toBeInTheDocument();
        expect(apiFetch).not.toHaveBeenCalledWith('/api/matchmaking/discover');
    });

    it('navigates to /tournaments when clicking Tournaments shortcut', async () => {
        renderForum();

        await waitFor(() => {
            expect(screen.getByTestId('facebook-left-rail')).toBeInTheDocument();
        });

        const tournamentsBtn = screen.getAllByRole('button', { name: /tournaments/i })[0];
        fireEvent.click(tournamentsBtn);

        expect(mockNavigate).toHaveBeenCalledWith('/tournaments');
    });

    it('dispatches openChatWithUser event when clicking Chat on a badminton buddy', async () => {
        const chatEventSpy = vi.fn();
        window.addEventListener('openChatWithUser', chatEventSpy);
        apiFetch.mockImplementation(async (url) => {
            if (url.includes('/api/feed')) return { ok: true, json: async () => mockFeedResponse };
            if (url.includes('/api/profile')) return { ok: true, json: async () => ({ stats: { totalMatches: 12 } }) };
            if (url.includes('/api/matchmaking/discover')) {
                return {
                    ok: true,
                    json: async () => ({
                        matches: [],
                        recommended: [{ _id: 'u-alex', name: 'Alex Chen', skillLevel: 'Advanced' }]
                    })
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderForum();

        await waitFor(() => {
            expect(screen.getByTestId('facebook-right-rail')).toBeInTheDocument();
        });

        const chatTuBtn = await screen.findByRole('button', { name: /chat with alex chen/i });
        fireEvent.click(chatTuBtn);

        expect(chatEventSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    name: 'Alex Chen'
                })
            })
        );

        window.removeEventListener('openChatWithUser', chatEventSpy);
    });
});
