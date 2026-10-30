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
        window.history.pushState({}, 'Test', '/community');
        window.location.hash = '';
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

    const renderWithProviders = (initialPath) => {
        window.history.pushState({}, 'Test', initialPath || ('/community' + (window.location.hash || '')));
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

        expect(screen.queryByTestId('feed-sorting-bar')).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Latest Posts/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Top Discussions/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Recent Activity/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /Saved Posts/i })).not.toBeInTheDocument();
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

    it('renders clean Facebook-style header and category filters correctly', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        expect(screen.queryByTestId('feed-reload-btn')).not.toBeInTheDocument();
        expect(screen.queryByTestId('feed-density-toggle')).not.toBeInTheDocument();
        expect(screen.getByText('💬 General')).toBeInTheDocument();
        expect(screen.getByText('🤝 Find Players')).toBeInTheDocument();
        expect(screen.getByText('🎒 Gear & Equipment')).toBeInTheDocument();
    });

    it('focuses global search input on pressing "/" keyboard shortcut', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        const mockSearch = document.createElement('input');
        mockSearch.id = 'global-search';
        document.body.appendChild(mockSearch);

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        fireEvent.keyDown(window, { key: '/' });
        expect(document.activeElement).toBe(mockSearch);
        document.body.removeChild(mockSearch);
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

    it('filters feed when URL contains search query parameter', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders('/community?search=smash');

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('search=smash'));
        });
    });

    it('renders active search indicator when URL contains search parameter', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders('/community?search=smash');

        await waitFor(() => {
            expect(screen.getByTestId('active-search-indicator')).toBeInTheDocument();
            expect(screen.getByText(/smash/i)).toBeInTheDocument();
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

        renderWithProviders('/community?search=nonexistenttermxyz');

        await waitFor(() => {
            expect(screen.getByText(/No posts match "nonexistenttermxyz"./i)).toBeInTheDocument();
        });

        const clearBtn = screen.getByText('Clear Search');
        expect(clearBtn).toBeInTheDocument();
        fireEvent.click(clearBtn);
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

        renderWithProviders('/community?search=Minh');

        await waitFor(() => {
            expect(screen.getByText('🏆 Official Match')).toBeInTheDocument();
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

        renderWithProviders('/community?search=Sarah');

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
        const { unmount } = renderWithProviders('/community?search=unknownquery');
        await waitFor(() => {
            expect(screen.getByText(/No posts match "unknownquery"./i)).toBeInTheDocument();
            expect(screen.getByText('Clear Search')).toBeInTheDocument();
        });
        unmount();

        // 2. Category empty state
        renderWithProviders();
        await waitFor(() => {
            expect(screen.getByText('Community Hub')).toBeInTheDocument();
        });
        const qaChip = screen.getByText('🎒 Gear & Equipment');
        fireEvent.click(qaChip);

        await waitFor(() => {
            expect(screen.getByText(/No posts match the selected category filter./i)).toBeInTheDocument();
            expect(screen.getByText('View All Categories')).toBeInTheDocument();
        });
    });

    it('filters feed when tag filter is clicked', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());
        const tagChip = screen.getByText('#Stringing');
        fireEvent.click(tagChip);
        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tag=Stringing'));
        });
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

        renderWithProviders('/community?search=Li-Ning');

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

        const mockSearch = document.createElement('input');
        mockSearch.id = 'global-search';
        document.body.appendChild(mockSearch);

        renderWithProviders();
        const composerCard = screen.getByTestId('facebook-composer-card');
        fireEvent.click(composerCard);

        await waitFor(() => {
            expect(screen.getByText('Create a Post')).toBeInTheDocument();
        });

        fireEvent.keyDown(window, { key: '/' });
        expect(document.activeElement).not.toBe(mockSearch);
        document.body.removeChild(mockSearch);
    });

    it('renders clean Facebook-style comfortable card layout', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false, tags: [] })
        });

        renderWithProviders();
        await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

        expect(screen.queryByTestId('feed-density-toggle')).not.toBeInTheDocument();
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

    it('R4: re-fetches feed cleanly on mobile pull-to-refresh on page 1', async () => {
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

        const composerCard = screen.getByTestId('facebook-composer-card');
        const feedContainer = composerCard.parentElement;

        fireEvent.touchStart(feedContainer, { touches: [{ clientY: 50 }] });
        fireEvent.touchMove(feedContainer, { touches: [{ clientY: 170 }] });
        fireEvent.touchEnd(feedContainer);

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

        renderWithProviders('/community?search=Doubles');
        await waitFor(() => expect(screen.getByText('Doubles match')).toBeInTheDocument());

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
        it('does not render feed sorting tabs and defaults to clean latest feed', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

            expect(screen.queryByTestId('feed-sorting-bar')).not.toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: /Top Discussions/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: /Recent Activity/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: /Saved Posts/i })).not.toBeInTheDocument();
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
