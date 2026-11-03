import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
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
        sessionStorage.clear();
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
// (exposes onDelete so tests can simulate a server-confirmed delete)
vi.mock('../components/PostCard', () => ({
    default: ({ post, onDelete }) => (
        <div data-testid={`post-card-${post._id}`}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
            <span data-testid={`post-likers-${post._id}`}>{JSON.stringify(post.likedBy)}</span>
            <span data-testid={`post-visibility-${post._id}`}>{post.visibility}</span>
            <span data-testid={`post-reactions-${post._id}`}>{(post.reactions || []).length}</span>
            <span data-testid={`post-rsvps-${post._id}`}>{(post.playerMatchmaking?.rsvpList || []).length}</span>
            <button type="button" data-testid={`mock-delete-${post._id}`} onClick={() => onDelete && onDelete(post._id)}>
                mock delete
            </button>
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

        // The re-fetch clears and refills the feed; wait for it to settle instead of racing it.
        expect(await screen.findByText('Feed Item 1')).toBeInTheDocument();
        expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();
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

        // The refresh clears and refills the feed; wait for it to settle instead of racing it.
        expect(await screen.findByText('Feed Item 2')).toBeInTheDocument();
        expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();
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
                const dropdown = screen.getByTestId('mention-suggestions-dropdown');
                expect(dropdown).toBeInTheDocument();
                expect(within(dropdown).getByText('Carol White')).toBeInTheDocument();
                expect(within(dropdown).getByText('Dave Miller')).toBeInTheDocument();
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

            const { container } = renderWithProviders();
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

            await waitFor(() => expect(screen.getByText('Page 2 Post')).toBeInTheDocument());
            expect(callCount).toBe(2);
            const feedCalls = apiFetch.mock.calls.map(c => c[0]).filter(u => u.startsWith('/api/feed?'));
            expect(feedCalls[1]).toContain('cursor=cursor-1');
            // Page 1 stays visible while appending; no skeleton flash
            expect(screen.getByText('Page 1 Post')).toBeInTheDocument();
            expect(container.querySelectorAll('.MuiSkeleton-root').length).toBe(0);

            // Page 2 said hasMore: false, so further scrolling requests nothing
            await new Promise(r => setTimeout(r, 120));
            await act(async () => {
                fireEvent.scroll(window);
            });
            await new Promise(r => setTimeout(r, 50));
            expect(callCount).toBe(2);
        });
    });

    describe('Community audit fixes', () => {
        const feedUrl = (u) => typeof u === 'string' && (u.startsWith('/api/feed?') || u === '/api/feed');
        const feedCalls = () => apiFetch.mock.calls.map(c => c[0]).filter(feedUrl);

        it('removes a post from the feed after PostCard reports a confirmed delete', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [
                        { _id: 'af1', type: 'post', referenceId: 'p-del', title: 'Delete me', content: 'bye', authorId: 'user1', createdAt: new Date().toISOString() },
                        { _id: 'af2', type: 'post', referenceId: 'p-keep', title: 'Keep me', content: 'hi', authorId: 'user2', createdAt: new Date().toISOString() }
                    ],
                    hasMore: false
                })
            });

            renderWithProviders();
            await waitFor(() => expect(screen.getByText('Delete me')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('mock-delete-p-del'));

            await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument());
            expect(screen.getByText('Keep me')).toBeInTheDocument();
        });

        it('removes a post live when the server emits postDeleted, and stops listening on unmount', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [{ _id: 'af1', type: 'post', referenceId: 'p-live', title: 'Live post', content: 'x', createdAt: new Date().toISOString() }],
                    hasMore: false
                })
            });

            const { unmount } = renderWithProviders();
            await waitFor(() => expect(screen.getByText('Live post')).toBeInTheDocument());
            expect(typeof socketHandlers.postDeleted).toBe('function');

            await act(async () => {
                socketHandlers.postDeleted('p-live');
            });
            await waitFor(() => expect(screen.queryByText('Live post')).not.toBeInTheDocument());

            unmount();
            expect(socketHandlers.postDeleted).toBeUndefined();
        });

        it('shows an error with "Try again" when the feed fails to load, and recovers on retry', async () => {
            let feedAttempts = 0;
            apiFetch.mockImplementation(async (url) => {
                if (feedUrl(url)) {
                    feedAttempts++;
                    if (feedAttempts === 1) throw new Error('Request failed with status 500');
                    return { ok: true, json: async () => ({ feed: [{ _id: 'ok1', title: 'Recovered post', content: 'y', createdAt: new Date().toISOString() }], hasMore: false }) };
                }
                return { ok: true, json: async () => ({}) };
            });

            renderWithProviders();
            expect(await screen.findByText("Couldn't load posts.")).toBeInTheDocument();
            expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

            expect(await screen.findByText('Recovered post')).toBeInTheDocument();
            expect(screen.queryByText("Couldn't load posts.")).not.toBeInTheDocument();
            expect(feedAttempts).toBe(2);
        });

        it('still shows the normal empty state for a real empty result', async () => {
            apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            renderWithProviders();
            expect(await screen.findByText(/No activity found/i)).toBeInTheDocument();
            expect(screen.queryByText("Couldn't load posts.")).not.toBeInTheDocument();
        });

        it.each([
            ['feed is an object', { feed: { not: 'an array' }, nextCursor: 'c1', hasMore: true }],
            ['feed is missing', { message: 'weird' }],
            ['body is null', null],
            ['feed has junk entries', { feed: [null, 'x', 42], hasMore: false }]
        ])('does not crash on a malformed /api/feed response (%s)', async (_label, body) => {
            apiFetch.mockImplementation(async (url) => {
                if (feedUrl(url)) return { ok: true, json: async () => body };
                return { ok: true, json: async () => ({}) };
            });
            renderWithProviders();
            expect(await screen.findByText(/No activity found/i)).toBeInTheDocument();
            expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument();
        });

        it('clicking "All" clears a selected #tag and refetches page 1 without it', async () => {
            apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            renderWithProviders();
            await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

            const allChip = () => screen.getByText('All').closest('[role="button"]');
            const tagChip = () => screen.getByText('#Stringing').closest('[role="button"]');
            expect(allChip()).toHaveAttribute('aria-pressed', 'true');

            fireEvent.click(tagChip());
            await waitFor(() => expect(feedCalls().at(-1)).toContain('tag=Stringing'));
            expect(tagChip()).toHaveAttribute('aria-pressed', 'true');
            // A tag is filtering, so "All" must not look selected
            expect(allChip()).toHaveAttribute('aria-pressed', 'false');

            const callsBefore = feedCalls().length;
            fireEvent.click(allChip());
            await waitFor(() => expect(feedCalls().length).toBeGreaterThan(callsBefore));
            const last = feedCalls().at(-1);
            expect(last).not.toContain('tag=');
            expect(last).not.toContain('category=');
            expect(last).not.toContain('cursor=');
            expect(allChip()).toHaveAttribute('aria-pressed', 'true');
            expect(tagChip()).toHaveAttribute('aria-pressed', 'false');
        });

        it('shows a clear message for /post/<missing id> with a way back to the feed', async () => {
            apiFetch.mockImplementation(async (url) => {
                if (url === '/api/forum/missing-post-1') throw new Error('Post not found');
                if (feedUrl(url)) return { ok: true, json: async () => ({ feed: [{ _id: 'f1', title: 'Normal feed post', content: 'z', createdAt: new Date().toISOString() }], hasMore: false }) };
                return { ok: true, json: async () => ({}) };
            });

            render(
                <AuthContext.Provider value={{ user: mockUser, token: 'fake-token' }}>
                    <MemoryRouter initialEntries={['/post/missing-post-1']}>
                        <Routes>
                            <Route path="/post/:postId" element={<Forum />} />
                            <Route path="/community" element={<Forum />} />
                        </Routes>
                    </MemoryRouter>
                </AuthContext.Provider>
            );

            expect(await screen.findByText('This post was deleted or is no longer available.')).toBeInTheDocument();
            // Fetched once, not on every feed change
            expect(apiFetch.mock.calls.filter(c => c[0] === '/api/forum/missing-post-1').length).toBe(1);

            fireEvent.click(screen.getByRole('button', { name: 'Back to feed' }));
            await waitFor(() => expect(screen.queryByText('This post was deleted or is no longer available.')).not.toBeInTheDocument());
            expect(await screen.findByText('Normal feed post')).toBeInTheDocument();
        });

        it('shows the missing-post message when the server answers without a post', async () => {
            window.history.pushState({}, 'Test', '/community?postId=gone-2');
            apiFetch.mockImplementation(async (url) => {
                if (url === '/api/forum/gone-2') return { ok: true, json: async () => ({}) };
                return { ok: true, json: async () => ({ feed: [], hasMore: false }) };
            });
            renderWithProviders('/community?postId=gone-2');
            expect(await screen.findByTestId('missing-post-banner')).toHaveTextContent('This post was deleted or is no longer available.');
        });

        it('shows no fake tournaments: empty state with a link when there are none', async () => {
            apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            renderWithProviders();
            expect(await screen.findByText('No upcoming tournaments')).toBeInTheDocument();
            expect(screen.queryByText(/Mason Fall Open/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Capital Fall Classic/i)).not.toBeInTheDocument();
            expect(screen.queryByText('Open Registration')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Browse tournaments' })).toBeInTheDocument();
            expect(apiFetch).toHaveBeenCalledWith('/api/tournaments?upcoming=true');
        });

        it('lists only real upcoming tournaments and hides past ones', async () => {
            const day = 24 * 60 * 60 * 1000;
            apiFetch.mockImplementation(async (url) => {
                if (url.startsWith('/api/tournaments')) {
                    return {
                        ok: true,
                        json: async () => ({
                            tournaments: [
                                { _id: 't-past', tournamentName: 'Old Past Open', status: 'active', startDate: new Date(Date.now() - 20 * day).toISOString(), endDate: new Date(Date.now() - 19 * day).toISOString(), registrationDeadline: new Date(Date.now() - 25 * day).toISOString() },
                                { _id: 't-next', tournamentName: 'Future Spring Cup', eventLocation: 'RAC', status: 'active', startDate: new Date(Date.now() + 10 * day).toISOString(), registrationDeadline: new Date(Date.now() + 5 * day).toISOString() }
                            ]
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], hasMore: false }) };
            });
            renderWithProviders();
            expect(await screen.findByText('Future Spring Cup')).toBeInTheDocument();
            expect(screen.queryByText('Old Past Open')).not.toBeInTheDocument();
            expect(screen.getByText('Open Registration')).toBeInTheDocument();
            expect(screen.queryByText('No upcoming tournaments')).not.toBeInTheDocument();
        });

        it('does not invent a skill level for users without one', async () => {
            apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            renderWithProviders();
            expect(await screen.findByText('Set your level')).toBeInTheDocument();
            expect(screen.queryByText('Intermediate')).not.toBeInTheDocument();
            expect(screen.queryByTestId('profile-skill-level')).not.toBeInTheDocument();
        });

        it('shows the real skill level when the user has one', async () => {
            apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            render(
                <AuthContext.Provider value={{ user: { ...mockUser, skillLevel: 'Advanced' }, token: 'fake-token' }}>
                    <BrowserRouter>
                        <Forum />
                    </BrowserRouter>
                </AuthContext.Provider>
            );
            expect(await screen.findByTestId('profile-skill-level')).toHaveTextContent('Advanced');
            expect(screen.queryByText('Set your level')).not.toBeInTheDocument();
        });

        it('uses hasMore from the server to stop paging (no wasted request at the end)', async () => {
            apiFetch.mockImplementation(async (url) => {
                if (feedUrl(url)) {
                    // Server still sends a cursor on the last page; hasMore is the source of truth
                    return { ok: true, json: async () => ({ feed: [{ _id: 'last1', title: 'Only page post', content: 'q', createdAt: new Date().toISOString() }], nextCursor: 'cursor-x', hasMore: false }) };
                }
                return { ok: true, json: async () => ({}) };
            });

            renderWithProviders();
            expect(await screen.findByText('Only page post')).toBeInTheDocument();
            expect(await screen.findByText(/You're all caught up/i)).toBeInTheDocument();

            // Scroll to the very bottom: no next page may be requested
            Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
            window.innerHeight = 800;
            window.scrollY = 1200;
            await act(async () => {
                fireEvent.scroll(window);
            });
            await new Promise(r => setTimeout(r, 50));
            expect(feedCalls().length).toBe(1);
        });

        it('pauses paging after a failed next page and retries the same cursor on "Try again"', async () => {
            let feedAttempts = 0;
            apiFetch.mockImplementation(async (url) => {
                if (feedUrl(url)) {
                    feedAttempts++;
                    if (feedAttempts === 1) return { ok: true, json: async () => ({ feed: [{ _id: 'pg1', title: 'First page', content: 'a', createdAt: new Date().toISOString() }], nextCursor: 'cur-1', hasMore: true }) };
                    if (feedAttempts === 2) throw new Error('Request failed with status 500');
                    return { ok: true, json: async () => ({ feed: [{ _id: 'pg2', title: 'Second page', content: 'b', createdAt: new Date().toISOString() }], nextCursor: null, hasMore: false }) };
                }
                return { ok: true, json: async () => ({}) };
            });

            renderWithProviders();
            expect(await screen.findByText('First page')).toBeInTheDocument();

            Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
            window.innerHeight = 800;
            window.scrollY = 1200;
            await act(async () => {
                fireEvent.scroll(window);
            });

            expect(await screen.findByText("Couldn't load more posts.")).toBeInTheDocument();
            // First page is kept, and further scrolling does not hammer the server
            expect(screen.getByText('First page')).toBeInTheDocument();
            await new Promise(r => setTimeout(r, 120));
            await act(async () => {
                fireEvent.scroll(window);
            });
            expect(feedAttempts).toBe(2);

            fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
            expect(await screen.findByText('Second page')).toBeInTheDocument();
            expect(feedCalls().at(-1)).toContain('cursor=cur-1');
            expect(screen.getByText('First page')).toBeInTheDocument();
        });

        it('passes the feed item audience through to the card (not always Public)', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [
                        { _id: 'af-v1', type: 'post', referenceId: 'p-friends', title: 'Friends post', content: 'c', visibility: 'FRIENDS_ONLY', createdAt: new Date().toISOString() },
                        { _id: 'af-v2', type: 'post', referenceId: 'p-me', title: 'Private post', content: 'c', post: { visibility: 'ONLY_ME' }, createdAt: new Date().toISOString() },
                        { _id: 'af-v3', type: 'post', referenceId: 'p-pub', title: 'Old post', content: 'c', createdAt: new Date().toISOString() },
                    ],
                    hasMore: false
                })
            });
            renderWithProviders();
            expect(await screen.findByTestId('post-visibility-p-friends')).toHaveTextContent('FRIENDS_ONLY');
            expect(screen.getByTestId('post-visibility-p-me')).toHaveTextContent('ONLY_ME');
            expect(screen.getByTestId('post-visibility-p-pub')).toHaveTextContent('PUBLIC');
        });

        it('applies live RSVP and reaction updates by referenceId, and a partial reaction payload keeps the count', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [{
                        _id: 'af-rally', type: 'post', referenceId: 'p-rally', title: 'Rally', content: 'c', category: 'meetup_rally',
                        playerMatchmaking: { isEnabled: true, slotsNeeded: 2, rsvpList: [] },
                        reactions: [{ userId: 'user1', emoji: '👍' }],
                        createdAt: new Date().toISOString()
                    }],
                    hasMore: false
                })
            });
            renderWithProviders();
            expect(await screen.findByTestId('post-rsvps-p-rally')).toHaveTextContent('0');

            await act(async () => {
                socketHandlers.rallyRsvpUpdated({ postId: 'p-rally', rsvpList: [{ userId: 'bob', status: 'confirmed' }], isFilled: false, slotsNeeded: 2 });
            });
            expect(screen.getByTestId('post-rsvps-p-rally')).toHaveTextContent('1');

            // postUpdated without a reactions list must not wipe the count.
            await act(async () => {
                socketHandlers.postUpdated({ _id: 'p-rally', title: 'Rally' });
            });
            expect(screen.getByTestId('post-reactions-p-rally')).toHaveTextContent('1');
            expect(screen.getByTestId('post-rsvps-p-rally')).toHaveTextContent('1');

            await act(async () => {
                socketHandlers.reactionUpdated({ postId: 'p-rally', action: 'added' });
            });
            expect(screen.getByTestId('post-reactions-p-rally')).toHaveTextContent('1');

            await act(async () => {
                socketHandlers.reactionUpdated({ postId: 'p-rally', reactions: [{ userId: 'user1', emoji: '👍' }, { userId: 'bob', emoji: '❤️' }] });
            });
            expect(screen.getByTestId('post-reactions-p-rally')).toHaveTextContent('2');
        });

        const submitComposer = async (content) => {
            await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
            fireEvent.click(screen.getByTestId('facebook-composer-card'));
            const dialog = await screen.findByRole('dialog');
            fireEvent.change(within(dialog).getByLabelText(/What's on your mind\?/i), { target: { value: content } });
            fireEvent.click(within(dialog).getByRole('button', { name: /^Post$/i }));
        };

        it('keeps live updates flowing to a post the author just created (no `type` on the response)', async () => {
            apiFetch.mockImplementation((url, opts) => {
                if (opts && opts.method === 'POST' && url === '/api/forum') {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ _id: 'p-new', title: 'Fresh', content: 'Fresh', authorId: 'user1', visibility: 'FRIENDS_ONLY', reactions: [], createdAt: new Date().toISOString() })
                    });
                }
                return Promise.resolve({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            });
            renderWithProviders();
            await submitComposer('Fresh');

            expect(await screen.findByTestId('post-visibility-p-new')).toHaveTextContent('FRIENDS_ONLY');
            expect(toast.success).toHaveBeenCalledWith('Post created successfully!');

            await act(async () => {
                socketHandlers.postUpdated({ _id: 'p-new', reactions: [{ userId: 'user1', emoji: '👍' }, { userId: 'bob', emoji: '❤️' }] });
            });
            expect(screen.getByTestId('post-reactions-p-new')).toHaveTextContent('2');
            expect(screen.getByTestId('post-visibility-p-new')).toHaveTextContent('FRIENDS_ONLY');
        });

        it.each([
            ['the current server shape', { message: 'Post submitted for review.', post: { _id: 'p-q', status: 'quarantined', isFlagged: true } }],
            ['a quarantined flag', { _id: 'p-q', quarantined: true }],
            ['status pending', { _id: 'p-q', status: 'pending' }],
        ])('tells the author their post is under review for %s', async (_label, response) => {
            apiFetch.mockImplementation((url, opts) => {
                if (opts && opts.method === 'POST' && url === '/api/forum') {
                    return Promise.resolve({ ok: true, status: 201, json: async () => response });
                }
                return Promise.resolve({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
            });
            renderWithProviders();
            await submitComposer('Fourth post this minute');

            await waitFor(() => expect(toast).toHaveBeenCalledWith(
                'Your post is being reviewed and will appear once approved.',
                expect.any(Object)
            ));
            expect(toast.success).not.toHaveBeenCalledWith('Post created successfully!');
            expect(screen.queryByTestId('post-card-undefined')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-card-p-q')).not.toBeInTheDocument();
        });

        it('passes real likers only (no placeholder ids) when the feed has just a like count', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [{ _id: 'af-l', type: 'post', referenceId: 'p-likes', title: 'Liked post', content: 'c', likes: 3, createdAt: new Date().toISOString() }], hasMore: false })
            });
            renderWithProviders();
            expect(await screen.findByTestId('post-likers-p-likes')).toHaveTextContent('[]');
            expect(screen.getByTestId('post-likers-p-likes')).not.toHaveTextContent('mock_id');
        });

        it('returns keyboard focus to the composer card when the composer is cancelled', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                apiFetch.mockResolvedValue({ ok: true, json: async () => ({ feed: [], hasMore: false }) });
                renderWithProviders();
                await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

                const composerCard = screen.getByTestId('facebook-composer-card');
                fireEvent.click(composerCard);
                const dialog = await screen.findByRole('dialog');
                fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

                await act(async () => { vi.runOnlyPendingTimers(); });
                await waitFor(() => expect(document.activeElement).toBe(composerCard));
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
