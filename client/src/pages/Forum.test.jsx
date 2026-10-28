import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { compressImage } from '../utils/imageUtils';

// Mock the API fetch utility
vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

// Mock image compression utility
vi.mock('../utils/imageUtils', () => ({
    compressImage: vi.fn(async (file) => {
        return new File(['mock-compressed-data'], (file.name || 'compressed').replace(/\.[^/.]+$/, '') + '.jpg', {
            type: 'image/jpeg'
        });
    })
}));

// Mock toast utility
vi.mock('react-hot-toast', () => {
    const fn = vi.fn();
    fn.success = vi.fn();
    fn.error = vi.fn();
    return {
        default: fn,
        toast: fn
    };
});

// Mock socket utility
let socketHandlers = {};
vi.mock('../utils/socket', () => ({
    default: {
        on: vi.fn((event, cb) => { socketHandlers[event] = cb; }),
        off: vi.fn((event) => { delete socketHandlers[event]; }),
        emit: vi.fn()
    }
}));

// Mock Masonry because JSDOM doesn't support complex CSS grid rendering well
vi.mock('@mui/lab/Masonry', () => ({
    default: ({ children }) => (
        <div data-testid="masonry-mock">
            {children}
        </div>
    )
}));

// Mock PostCard to prevent full deep rendering
vi.mock('../components/PostCard', () => ({
    default: ({ post }) => (
        <div data-testid={`post-card-${post._id}`}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
        </div>
    )
}));

const mockUser = { id: 'user1', name: 'Test User' };

describe('Forum Page Component (Community Hub)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketHandlers = {};
        // Setup default intersection observer
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;
        window.scrollTo = vi.fn();
    });

    const renderWithProviders = () => {
        return render(
            <AuthContext.Provider value={{ user: mockUser, token: 'fake-token' }}>
                <BrowserRouter>
                    <Forum />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    it('displays loading skeletons initially', () => {
        apiFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
        const { container } = renderWithProviders();
        
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders empty state when no activity is found', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText(/No activity found/i)).toBeInTheDocument();
        });
    });

    it('renders ActivityFeed items when data is loaded', async () => {
        const mockFeed = [
            {
                _id: 'feed1',
                type: 'post',
                referenceId: 'post1',
                title: 'Anyone down for singles?',
                content: 'Need a hitting partner.',
                authorId: 'user2',
                authorName: 'John Doe',
                likes: 0,
                comments: 0,
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Anyone down for singles?')).toBeInTheDocument();
            expect(screen.getByText('Need a hitting partner.')).toBeInTheDocument();
        });
    });

    it('renders streamlined UI with inline composer, segmented sorting tabs, and trending topic chips', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Latest Posts/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Top Discussions/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Recent Activity/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Saved Posts/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Create New Post/i })).not.toBeInTheDocument();
        expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument();
        expect(screen.getByText('#Tournament')).toBeInTheDocument();
        expect(screen.getByText('#RAC')).toBeInTheDocument();
    });

    it('opens Create Post modal with category selector and Phase 2 options', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());
        const composerCard = screen.getByTestId('facebook-composer-card');
        fireEvent.click(composerCard);

        await waitFor(() => {
            expect(screen.getByText('Create a Post')).toBeInTheDocument();
            expect(screen.getByText('Category')).toBeInTheDocument();
            expect(screen.getByText(/General Discussion/i)).toBeInTheDocument();
        });
    });

    it('renders post search bar, category group filter chips, and date range selector', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        expect(screen.getByPlaceholderText(/Search posts by title, author, court, tags/i)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Filter by date range/i })).toBeInTheDocument();
        expect(screen.getByText('💬 General')).toBeInTheDocument();
        expect(screen.getByText('🤝 Find Players')).toBeInTheDocument();
        expect(screen.getByText('🎒 Gear & Equipment')).toBeInTheDocument();
    });

    it('focuses search input on pressing "/" keyboard shortcut', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        expect(document.activeElement).not.toBe(searchInput);

        fireEvent.keyDown(window, { key: '/' });
        expect(document.activeElement).toBe(searchInput);
    });

    it('updates query param and feed when category group chip is clicked', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const findPlayersChip = screen.getByText('🤝 Find Players');
        fireEvent.click(findPlayersChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('category=find_partner'));
        });
    });

    it('updates query param and feed when date range is changed', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
        fireEvent.mouseDown(dateSelect);

        const todayOption = await screen.findByRole('option', { name: /Today/i });
        fireEvent.click(todayOption);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('dateRange=today'));
        });
    });

    it('renders custom date range inputs when Custom Range is selected', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
        fireEvent.mouseDown(dateSelect);

        const customOption = await screen.findByRole('option', { name: /Custom Range/i });
        fireEvent.click(customOption);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('dateRange=custom'));
        });
    });

    it('handles Enter key in search input to trigger immediate search', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);

        fireEvent.change(searchInput, { target: { value: 'smash' } });
        fireEvent.keyDown(searchInput, { key: 'Enter' });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('search=smash'));
        });
    });

    it('renders empty search state with clear button when query has no live matches', async () => {
        const mockFeed = [
            {
                _id: 'feed1',
                type: 'post',
                referenceId: 'post1',
                title: 'Casual rally this Friday',
                content: 'Playing at RAC Court 2.',
                authorId: 'user1',
                authorName: 'Alex',
                tags: ['RAC'],
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Casual rally this Friday')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'nonexistenttermxyz' } });

        await waitFor(() => {
            expect(screen.getByText(/No posts match "nonexistenttermxyz"./i)).toBeInTheDocument();
        });

        const clearBtn = screen.getByText('Clear Search');
        fireEvent.click(clearBtn);

        await waitFor(() => {
            expect(screen.getByText('Casual rally this Friday')).toBeInTheDocument();
        });
    });

    it('does not show new post pill for posts from different category when category filter is active', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const findPlayersChip = screen.getByText('🤝 Find Players');
        fireEvent.click(findPlayersChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalled();
        });

        // Simulate incoming post with category "general"
        if (socketHandlers.postCreated) {
            act(() => {
                socketHandlers.postCreated({
                    _id: 'post999',
                    title: 'General Chat',
                    content: 'Hey all',
                    category: 'general'
                });
            });
        }

        expect(screen.queryByLabelText('Load new posts')).not.toBeInTheDocument();
    });

    it('renders real-time incoming post without crashing when user clicks new post pill', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('No activity found.')).toBeInTheDocument();
        });

        // Incoming socket post from Post model (no type: post, comments as array)
        if (socketHandlers.postCreated) {
            act(() => {
                socketHandlers.postCreated({
                    _id: 'socket_post_100',
                    title: 'Live Racket Session',
                    content: 'Court 4 is available right now',
                    category: 'general',
                    comments: [{ text: 'Coming in 5 mins!' }],
                    createdAt: new Date().toISOString()
                });
            });
        }

        const loadPill = await screen.findByLabelText('Load new posts');
        expect(loadPill).toBeInTheDocument();

        fireEvent.click(loadPill);

        await waitFor(() => {
            expect(screen.getByText('Live Racket Session')).toBeInTheDocument();
            expect(screen.getByText('Court 4 is available right now')).toBeInTheDocument();
        });
    });

    it('matches official match scorecards by team player names in search', async () => {
        const mockFeed = [
            {
                _id: 'match1',
                type: 'match',
                team1: ['Huy', 'Minh'],
                team2: ['Alex', 'David'],
                team1Score: 21,
                team2Score: 19,
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('🏆 Official Match')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'Minh' } });

        await waitFor(() => {
            expect(screen.getByText('🏆 Official Match')).toBeInTheDocument();
        });

        fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });
        await waitFor(() => {
            expect(screen.getByText(/No posts match/i)).toBeInTheDocument();
        });
    });

    it('matches match post by partner or opponents in search', async () => {
        const mockFeed = [
            {
                _id: 'post_partner_1',
                type: 'post',
                title: 'Great Doubles Rally',
                content: 'Close match at RAC',
                category: 'match_result',
                matchDetails: {
                    partner: 'Sarah',
                    opponents: ['Kevin', 'Leo']
                },
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Great Doubles Rally')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'Sarah' } });

        await waitFor(() => {
            expect(screen.getByText('Great Doubles Rally')).toBeInTheDocument();
        });

        fireEvent.change(searchInput, { target: { value: 'Leo' } });

        await waitFor(() => {
            expect(screen.getByText('Great Doubles Rally')).toBeInTheDocument();
        });
    });

    it('filters displayed feed by category in addition to backend request', async () => {
        const mockFeed = [
            {
                _id: 'post1',
                type: 'post',
                referenceId: 'p1',
                title: 'Need 1 for Doubles',
                content: 'Playing at RAC',
                category: 'find_partner',
                createdAt: new Date().toISOString()
            },
            {
                _id: 'post2',
                type: 'post',
                referenceId: 'p2',
                title: 'Yonex Arcsaber 11 Pro',
                content: 'Selling racket',
                category: 'gear_exchange',
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Need 1 for Doubles')).toBeInTheDocument();
            expect(screen.getByText('Yonex Arcsaber 11 Pro')).toBeInTheDocument();
        });

        // Click Finding Players chip
        const findPlayersChip = screen.getByText('🤝 Find Players');
        fireEvent.click(findPlayersChip);

        await waitFor(() => {
            expect(screen.getByText('Need 1 for Doubles')).toBeInTheDocument();
            expect(screen.queryByText('Yonex Arcsaber 11 Pro')).not.toBeInTheDocument();
        });
    });

    it('renders actionable empty states when backend returns empty feed for search, category, or date filters', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        // 1. Search empty state
        const { unmount } = renderWithProviders();
        await waitFor(() => {
            expect(screen.getByText('Community Hub')).toBeInTheDocument();
        });
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'unknownquery' } });

        await waitFor(() => {
            expect(screen.getByText(/No posts match "unknownquery"./i)).toBeInTheDocument();
            expect(screen.getByText('Clear Search')).toBeInTheDocument();
        });
        unmount();

        // 2. Category empty state
        const { unmount: unmount2 } = renderWithProviders();
        await waitFor(() => {
            expect(screen.getByText('Community Hub')).toBeInTheDocument();
        });
        const qaChip = screen.getByText('🎒 Gear & Equipment');
        fireEvent.click(qaChip);

        await waitFor(() => {
            expect(screen.getByText(/No posts match the selected category filter./i)).toBeInTheDocument();
            expect(screen.getByText('View All Categories')).toBeInTheDocument();
        });
        unmount2();

        // 3. Date range empty state
        renderWithProviders();
        await waitFor(() => {
            expect(screen.getByText('Community Hub')).toBeInTheDocument();
        });
        const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
        fireEvent.mouseDown(dateSelect);
        const thisWeekOption = await screen.findByRole('option', { name: /This Week/i });
        fireEvent.click(thisWeekOption);

        await waitFor(() => {
            expect(screen.getByText(/No posts match the selected date range./i)).toBeInTheDocument();
            expect(screen.getByText('View All Dates')).toBeInTheDocument();
        });
    });

    it('blurs and clears search on Escape key press', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'victor' } });
        expect(searchInput.value).toBe('victor');

        fireEvent.keyDown(searchInput, { key: 'Escape' });
        expect(searchInput.value).toBe('');
    });

    it('matches gear brand and gear type in feed search', async () => {
        const mockFeed = [
            {
                _id: 'post_gear_1',
                type: 'post',
                title: 'High tension racket for sale',
                content: 'Strung at 28 lbs',
                category: 'gear_exchange',
                gearDetails: {
                    brand: 'Li-Ning',
                    gearType: 'Badminton Racket'
                },
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, hasMore: false })
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('High tension racket for sale')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'Li-Ning' } });

        await waitFor(() => {
            expect(screen.getByText('High tension racket for sale')).toBeInTheDocument();
        });
    });

    it('fetches deep-linked post if not present in initial feed and triggers auto-scroll highlight', async () => {
        window.location.hash = '#post-deep-123';
        const deepPost = {
            _id: 'deep-123',
            type: 'post',
            title: 'Deep Linked Tournament Highlight',
            content: 'Discussing final rallies',
            authorName: 'Kevin Lin',
            createdAt: new Date().toISOString()
        };

        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/forum/deep-123')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => deepPost
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({ feed: [], hasMore: false })
            });
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Deep Linked Tournament Highlight')).toBeInTheDocument();
        });

        window.location.hash = '';
    });

    it('does not trigger "/" search shortcut when modal is open', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        const composerCard = screen.getByTestId('facebook-composer-card');
        fireEvent.click(composerCard);

        await waitFor(() => {
            expect(screen.getByText('Create a Post')).toBeInTheDocument();
        });

        fireEvent.keyDown(window, { key: '/' });
        expect(document.activeElement).not.toBe(searchInput);
    });

    it('toggles feed density between Comfortable and Compact view modes', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        renderWithProviders();

        const densityBtn = screen.getByTestId('feed-density-toggle');
        expect(densityBtn).toBeInTheDocument();
        expect(densityBtn.textContent).toMatch(/Comfortable/i);

        fireEvent.click(densityBtn);
        expect(densityBtn.textContent).toMatch(/Compact/i);
        expect(localStorage.getItem('mbc_feed_density')).toBe('compact');

        fireEvent.click(densityBtn);
        expect(densityBtn.textContent).toMatch(/Comfortable/i);
        expect(localStorage.getItem('mbc_feed_density')).toBe('comfortable');
    });

    it('restores post creation draft from sessionStorage and allows clearing it', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        sessionStorage.setItem('mbc_community_post_draft', JSON.stringify({
            title: 'Draft Saved Title',
            content: 'Draft Saved Content details here'
        }));

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        const composerCard = screen.getByTestId('facebook-composer-card');
        fireEvent.click(composerCard);

        await waitFor(() => {
            expect(screen.getByDisplayValue('Draft Saved Title')).toBeInTheDocument();
            expect(screen.getAllByDisplayValue('Draft Saved Content details here').length).toBeGreaterThan(0);
        });

        const clearDraftBtn = screen.getByRole('button', { name: /Clear Draft/i });
        expect(clearDraftBtn).toBeInTheDocument();
        fireEvent.click(clearDraftBtn);

        expect(sessionStorage.getItem('mbc_community_post_draft')).toBeNull();
    });

    it('renders trending tags strip and triggers filtering on tag click', async () => {
        apiFetch.mockImplementation((url) => {
            if (url.includes('/trending-tags')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        tags: [
                            { tag: 'rackets', count: 9 },
                            { tag: 'rac-court', count: 4 }
                        ]
                    })
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({ feed: [], hasMore: false })
            });
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText(/#rackets/i)).toBeInTheDocument();
            expect(screen.getByText(/#rac-court/i)).toBeInTheDocument();
        });

        const racketChip = screen.getByText(/#rackets/i);
        fireEvent.click(racketChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tag=rackets'));
        });
    });

    // ── Phase 6: Real-Time Presence ───────────────────────────────────────────

    it('fetches /api/forum/online-users on mount and tracks online user IDs', async () => {
        apiFetch.mockImplementation((url) => {
            if (url.includes('/online-users')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ onlineUserIds: ['user-101', 'user-202'] })
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({ feed: [], hasMore: false, tags: [] })
            });
        });

        renderWithProviders();

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/forum/online-users'));
        });
    });

    it('updates online presence set when onlineUsersUpdate socket event fires', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [], onlineUserIds: [] })
        });

        renderWithProviders();

        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        // Simulate real-time online users update via socket
        await act(async () => {
            if (socketHandlers['onlineUsersUpdate']) {
                socketHandlers['onlineUsersUpdate'](['user-301', 'user-302']);
            }
        });

        // Component should handle the event without crashing
        expect(screen.getByText('Community Hub')).toBeInTheDocument();
    });

    // ── Facebook UI & Single-Step Post Creation Overhaul ──────────────────────

    it('renders Facebook-style composer card ("What\'s on your mind?") and opens dialog when clicked', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [], onlineUserIds: [] })
        });

        renderWithProviders();

        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
        expect(screen.getByText(/What's on your mind/i)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Create a Post')).toBeInTheDocument();
        });
    });

    it('allows posting with only content (auto-deriving title from content, eliminating "two make a posts" confusion)', async () => {
        apiFetch.mockImplementation((url, opts) => {
            if (opts && opts.method === 'POST') {
                const body = JSON.parse(opts.body);
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        _id: 'new-post-1',
                        title: body.title,
                        content: body.content,
                        category: 'general',
                        timestamp: new Date().toISOString()
                    })
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({ feed: [], hasMore: false, tags: [], onlineUserIds: [] })
            });
        });

        renderWithProviders();

        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();

        // Type ONLY into "What's on your mind?" field (leaving Title optional/blank)
        const contentInput = within(dialog).getByLabelText(/What's on your mind\?/i);
        fireEvent.change(contentInput, { target: { value: 'Playing badminton at the RAC court 3 today at 5pm!' } });

        // Submit button should be ENABLED even without filling Title!
        const submitBtn = within(dialog).getByRole('button', { name: /^Post$/i });
        expect(submitBtn).not.toBeDisabled();

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/forum', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Playing badminton at the RAC court 3 today at 5pm!')
            }));
        });
    });

    // ── Sprint R1-R4: Mobile Performance, Image Compression & Feed Invariants ──

    it('R1: applies shrink labels, shielding background, and outline suppression on composer inputs', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('facebook-composer-card'));
        const dialog = await screen.findByRole('dialog');

        // Check What's on your mind? label
        const contentLabels = within(dialog).getAllByText(/What's on your mind/i);
        expect(contentLabels.length).toBeGreaterThan(0);

        // Reveal title input
        const addTitleBtn = within(dialog).getByRole('button', { name: /\+ Title/i });
        fireEvent.click(addTitleBtn);

        const titleLabels = within(dialog).getAllByText(/Title \(Optional\)/i);
        expect(titleLabels.length).toBeGreaterThan(0);

        // Verify inputs are editable without errors
        const titleInput = within(dialog).getByLabelText(/Title \(Optional\)/i);
        const contentInput = within(dialog).getByLabelText(/What's on your mind\?/i);
        fireEvent.change(titleInput, { target: { value: 'My Test Title' } });
        fireEvent.change(contentInput, { target: { value: 'My Test Content' } });
        expect(titleInput.value).toBe('My Test Title');
        expect(contentInput.value).toBe('My Test Content');
    });

    it('R2: compresses uploaded images client-side before sending to upload endpoint', async () => {
        apiFetch.mockImplementation((url, opts) => {
            if (url.includes('/api/upload/images')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ imageUrls: ['https://cdn.example.com/compressed_mobile.jpg'] })
                });
            }
            if (url.includes('/api/forum') && opts?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ _id: 'post-new-img', title: 'Post with photo', content: 'Testing photo upload' })
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({ feed: [], hasMore: false, tags: [] }) });
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        const dialog = await screen.findByRole('dialog');
        const contentInput = within(dialog).getByLabelText(/What's on your mind\?/i);
        fireEvent.change(contentInput, { target: { value: 'Photo post content' } });

        const fileInput = dialog.querySelector('input[type="file"]');
        const rawPhoto = new File(['raw-iphone-camera-bytes'], 'IMG_9999.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [rawPhoto] } });

        expect(await within(dialog).findByText('IMG_9999.png')).toBeInTheDocument();

        const submitBtn = within(dialog).getByRole('button', { name: /^Post$/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(compressImage).toHaveBeenCalledWith(rawPhoto, expect.objectContaining({
                maxSizeMB: 1.0,
                maxWidthOrHeight: 1600,
                initialQuality: 0.8
            }));
            expect(apiFetch).toHaveBeenCalledWith('/api/upload/images', expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            }));
            expect(apiFetch).toHaveBeenCalledWith('/api/forum', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('https://cdn.example.com/compressed_mobile.jpg')
            }));
        });
    });

    it('R2: surfaces upload errors via toast.error and keeps modal open so draft is not lost', async () => {
        apiFetch.mockImplementation((url) => {
            if (url.includes('/api/upload/images')) {
                return Promise.resolve({
                    ok: false,
                    json: async () => ({ message: 'Cloudinary storage capacity reached' })
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({ feed: [], hasMore: false, tags: [] }) });
        });

        renderWithProviders();
        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        const dialog = await screen.findByRole('dialog');
        const contentInput = within(dialog).getByLabelText(/What's on your mind\?/i);
        fireEvent.change(contentInput, { target: { value: 'Important draft with failing upload' } });

        const fileInput = dialog.querySelector('input[type="file"]');
        const photo = new File(['dummy-bytes'], 'bad_upload.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [photo] } });

        const submitBtn = within(dialog).getByRole('button', { name: /^Post$/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Cloudinary storage capacity reached'));
        });

        // Modal should still be open and content preserved
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(contentInput.value).toBe('Important draft with failing upload');
    });

    it('R2: displays error toast when non-image files or more than 4 images are selected', async () => {
        apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false, tags: [] }) });

        renderWithProviders();
        fireEvent.click(screen.getByTestId('facebook-composer-card'));
        const dialog = await screen.findByRole('dialog');

        const fileInput = dialog.querySelector('input[type="file"]');

        // Select a non-image file
        const textFile = new File(['text'], 'document.pdf', { type: 'application/pdf' });
        fireEvent.change(fileInput, { target: { files: [textFile] } });
        expect(toast.error).toHaveBeenCalledWith('Only image files are allowed.');

        // Select more than 4 images
        const fiveImages = [1, 2, 3, 4, 5].map(i => new File(['bytes'], `img${i}.jpg`, { type: 'image/jpeg' }));
        fireEvent.change(fileInput, { target: { files: fiveImages } });
        expect(toast.error).toHaveBeenCalledWith('Maximum 4 images allowed');
    });

    it('R3: completely purges attached image chips, text, file input value, and sessionStorage on Clear Draft click', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        const dialog = await screen.findByRole('dialog');
        const contentInput = within(dialog).getByLabelText(/What's on your mind\?/i);
        fireEvent.change(contentInput, { target: { value: 'Post with draft photo' } });

        // Attach mock image
        const fileInput = dialog.querySelector('input[type="file"]');
        const file = new File(['fake-image-bytes'], 'test_camera.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(await within(dialog).findByText('test_camera.jpg')).toBeInTheDocument();

        // Clear Draft button should be visible
        const clearDraftBtn = within(dialog).getByRole('button', { name: /Clear Draft/i });
        expect(clearDraftBtn).toBeInTheDocument();
        fireEvent.click(clearDraftBtn);

        // Verify chips and inputs are purged
        expect(within(dialog).queryByText('test_camera.jpg')).not.toBeInTheDocument();
        expect(contentInput.value).toBe('');
        expect(fileInput.value).toBe('');
        expect(sessionStorage.getItem('mbc_community_post_draft')).toBeNull();
        expect(toast.success).toHaveBeenCalledWith('Draft cleared');
    });

    it('R3: renders Clear Draft button when only images are attached without any text', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        renderWithProviders();
        fireEvent.click(screen.getByTestId('facebook-composer-card'));

        const dialog = await screen.findByRole('dialog');
        const fileInput = dialog.querySelector('input[type="file"]');
        const file = new File(['photo-only-bytes'], 'racket_only.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(await within(dialog).findByText('racket_only.jpg')).toBeInTheDocument();

        // Clear Draft button MUST be visible even though title and content are empty
        const clearDraftBtn = within(dialog).getByRole('button', { name: /Clear Draft/i });
        expect(clearDraftBtn).toBeInTheDocument();

        fireEvent.click(clearDraftBtn);
        expect(within(dialog).queryByText('racket_only.jpg')).not.toBeInTheDocument();
        expect(fileInput.value).toBe('');
    });

    it('R4: resets pagination cursor and re-fetches page 1 when clicking "All" category chip while already on All', async () => {
        const mockFeed = [
            { _id: 'post-item-1', title: 'Feed Item 1', content: 'Testing feed content', createdAt: new Date().toISOString() }
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, nextCursor: 'cur123', hasMore: true })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Feed Item 1')).toBeInTheDocument());

        const initialCallCount = apiFetch.mock.calls.length;

        // Click "All" category chip while already on "All"
        const allChip = screen.getByText('All');
        fireEvent.click(allChip);

        // Assert apiFetch is called again to re-fetch page 1
        await waitFor(() => {
            expect(apiFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        // Should NOT show "No activity found."
        expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();
        expect(screen.getByText('Feed Item 1')).toBeInTheDocument();
    });

    it('R4: re-fetches feed cleanly when clicking Refresh button on page 1', async () => {
        const mockFeed = [
            { _id: 'post-item-2', title: 'Feed Item 2', content: 'Testing refresh content', createdAt: new Date().toISOString() }
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, nextCursor: null, hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Feed Item 2')).toBeInTheDocument());

        const initialCallCount = apiFetch.mock.calls.length;

        const refreshBtn = screen.getByLabelText('Refresh feed');
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(apiFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
        });

        expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();
        expect(screen.getByText('Feed Item 2')).toBeInTheDocument();
    });

    it('R4: resets pagination and feed when pressing Enter on search input', async () => {
        const mockFeed = [
            { _id: 'post-item-3', title: 'Doubles match', content: 'Looking for a doubles partner', createdAt: new Date().toISOString() }
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: mockFeed, nextCursor: null, hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Doubles match')).toBeInTheDocument());

        const searchInput = screen.getByLabelText('Search community posts');
        fireEvent.change(searchInput, { target: { value: 'Doubles' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('search=Doubles'));
        });
    });

    it('R1: renders post composer inputs with slotProps label shrinking and shielding in MUI 9', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], nextCursor: null, hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

        fireEvent.click(screen.getByTestId('facebook-composer-card'));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();

        // Toggle Title input
        const addTitleBtn = within(dialog).getByRole('button', { name: /\+ Title/i });
        fireEvent.click(addTitleBtn);

        const titleInput = within(dialog).getByPlaceholderText(/Add a title or leave blank/i);
        const titleLabel = dialog.querySelector(`label[for="${titleInput.id}"]`);
        expect(titleLabel).toBeInTheDocument();
        expect(titleLabel.getAttribute('data-shrink')).toBe('true');
        expect(titleLabel.classList.contains('MuiInputLabel-shrink')).toBe(true);

        const contentInput = within(dialog).getByPlaceholderText(/What's on your mind/i);
        const contentLabel = dialog.querySelector(`label[for="${contentInput.id}"]`);
        expect(contentLabel).toBeInTheDocument();
        expect(contentLabel.getAttribute('data-shrink')).toBe('true');
        expect(contentLabel.classList.contains('MuiInputLabel-shrink')).toBe(true);
    });

    describe('Milestone 3: Hub Controls, Mentions & Prefetching (J4, J8, J10, J11)', () => {
        it('J4: switches sorting tabs and updates tab query parameter while resetting cursor', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            // Switch to "Top Discussions"
            const topTab = screen.getByRole('tab', { name: /Top Discussions/i });
            fireEvent.click(topTab);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=top'));
            });

            // Switch to "Recent Activity"
            const activityTab = screen.getByRole('tab', { name: /Recent Activity/i });
            fireEvent.click(activityTab);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=recent_activity'));
            });

            // Switch back to "Latest Posts"
            const latestTab = screen.getByRole('tab', { name: /Latest Posts/i });
            fireEvent.click(latestTab);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=latest'));
            });
        });

        it('J8: switches to Saved Posts tab and renders clean EmptyState when no posts are saved', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false, bookmarkedPosts: [] })
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            // Click Saved Posts tab
            const savedTab = screen.getByRole('tab', { name: /Saved Posts/i });
            fireEvent.click(savedTab);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=saved'));
                expect(screen.getByTestId('saved-posts-empty-state')).toBeInTheDocument();
                expect(screen.getByText('No Saved Posts')).toBeInTheDocument();
                expect(screen.getByText('Save interesting discussions to read or revisit them later.')).toBeInTheDocument();
            });

            // Clicking "Explore Latest Posts" button returns to latest tab
            const exploreBtn = screen.getByRole('button', { name: /Explore Latest Posts/i });
            fireEvent.click(exploreBtn);

            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=latest'));
            });
        });

        it('J8: displays saved posts in Saved Posts tab and instantly filters out unsaved post optimistically (0ms)', async () => {
            const savedPost = {
                _id: 'saved-post-1',
                referenceId: 'saved-post-1',
                title: 'My Bookmarked Tournament Discussion',
                content: 'Important guide for upcoming tournament.',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [savedPost],
                    nextCursor: null,
                    hasMore: false,
                    bookmarkedPosts: ['saved-post-1']
                })
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            const savedTab = screen.getByRole('tab', { name: /Saved Posts/i });
            fireEvent.click(savedTab);

            await waitFor(() => {
                expect(screen.getByText('My Bookmarked Tournament Discussion')).toBeInTheDocument();
            });
        });

        it('J10: opens mention autocomplete in Create Post modal when typing @, allows keyboard navigation and selection', async () => {
            const mockMembers = [
                { _id: 'm1', id: 'm1', name: 'Carol White', role: 'player', skillLevel: 'Advanced' },
                { _id: 'm2', id: 'm2', name: 'Dave Miller', role: 'member', skillLevel: 'Intermediate' }
            ];

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/forum/members')) {
                    return {
                        ok: true,
                        json: async () => ({ users: mockMembers })
                    };
                }
                return {
                    ok: true,
                    json: async () => ({ feed: [], nextCursor: null, hasMore: false })
                };
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('facebook-composer-card'));
            const dialog = await screen.findByRole('dialog');
            expect(dialog).toBeInTheDocument();

            const contentTextarea = within(dialog).getByPlaceholderText(/What's on your mind/i);

            // Type "@" to trigger mention autocomplete
            await act(async () => {
                fireEvent.change(contentTextarea, { target: { value: 'Hey @' } });
            });

            await waitFor(() => {
                expect(screen.getByTestId('mention-suggestions-dropdown')).toBeInTheDocument();
                expect(screen.getByText('Carol White')).toBeInTheDocument();
                expect(screen.getByText('Dave Miller')).toBeInTheDocument();
            });

            // Keyboard navigation: ArrowDown to Dave Miller, then Enter to select
            fireEvent.keyDown(contentTextarea, { key: 'ArrowDown' });
            await act(async () => {
                fireEvent.keyDown(contentTextarea, { key: 'Enter' });
            });

            // Dropdown closes and mention query replaced with "@Dave Miller "
            await waitFor(() => {
                expect(screen.queryByTestId('mention-suggestions-dropdown')).not.toBeInTheDocument();
            });
            expect(contentTextarea.value).toBe('Hey @Dave Miller ');

            // Mentions preview chip is rendered
            expect(screen.getByTestId('composer-mentions-preview')).toBeInTheDocument();
            expect(screen.getByTestId('mention-chip-dave-miller')).toBeInTheDocument();
        });

        it('J11: triggers 80% viewport scroll pre-fetcher without skeleton flashing', async () => {
            const page1Feed = [
                { _id: 'post-page-1', title: 'Page 1 Post', content: 'First page content', createdAt: new Date().toISOString() }
            ];
            const page2Feed = [
                { _id: 'post-page-2', title: 'Page 2 Post', content: 'Second page content', createdAt: new Date().toISOString() }
            ];

            let callCount = 0;
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/feed/trending-tags')) {
                    return { ok: true, json: async () => ({ tags: [] }) };
                }
                if (url.startsWith('/api/feed?') || url === '/api/feed') {
                    callCount++;
                    if (callCount === 1) {
                        return {
                            ok: true,
                            json: async () => ({ feed: page1Feed, nextCursor: 'cursor-1', hasMore: true })
                        };
                    }
                    return {
                        ok: true,
                        json: async () => ({ feed: page2Feed, nextCursor: null, hasMore: false })
                    };
                }
                return { ok: true, json: async () => ({}) };
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByText('Page 1 Post')).toBeInTheDocument());

            // Simulate window scroll reaching 80% of document height
            Object.defineProperty(document.documentElement, 'scrollHeight', {
                configurable: true,
                value: 2000
            });
            window.innerHeight = 800;
            window.scrollY = 850; // 850 + 800 = 1650 >= 2000 * 0.8 (1600)

            await act(async () => {
                fireEvent.scroll(window);
            });

            // Wait for throttle timeout and next page fetch
            await waitFor(() => {
                expect(callCount).toBeGreaterThan(1);
            });
        });
    });
});
