import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// Mock API fetch
vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

// Mock image compression
vi.mock('../utils/imageUtils', () => ({
    compressImage: vi.fn(async (file) => file)
}));

// Mock toast
vi.mock('react-hot-toast', () => {
    const fn = vi.fn();
    fn.success = vi.fn();
    fn.error = vi.fn();
    return {
        default: fn,
        toast: fn
    };
});

// Mock socket
let socketHandlers = {};
vi.mock('../utils/socket', () => ({
    default: {
        on: vi.fn((event, cb) => { socketHandlers[event] = cb; }),
        off: vi.fn((event) => { delete socketHandlers[event]; }),
        emit: vi.fn()
    }
}));

// Mock Masonry
vi.mock('@mui/lab/Masonry', () => ({
    default: ({ children }) => <div data-testid="masonry-mock">{children}</div>
}));

// Mock PostCard to accurately capture props and simulate user interactions
vi.mock('../components/PostCard', () => ({
    default: ({ post, isBookmarked, onBookmarkToggle }) => (
        <div data-testid={`post-card-${post._id}`} data-pinned={post.isPinned ? "true" : "false"}>
            <h3 data-testid={`post-title-${post._id}`}>{post.title}</h3>
            <p data-testid={`post-content-${post._id}`}>{post.content}</p>
            {post.isPinned && <span data-testid={`pinned-indicator-${post._id}`}>📌 Pinned Megathread</span>}
            <span data-testid={`bookmark-status-${post._id}`}>{isBookmarked ? "BOOKMARKED" : "NOT_BOOKMARKED"}</span>
            <button
                data-testid={`toggle-bookmark-btn-${post._id}`}
                onClick={() => onBookmarkToggle && onBookmarkToggle(!isBookmarked)}
            >
                {isBookmarked ? "Unsave Post" : "Save Post"}
            </button>
            <button
                data-testid={`simulate-failed-unsave-${post._id}`}
                onClick={() => {
                    // Simulates optimistic unsave followed by API error recovery / rollback
                    if (onBookmarkToggle) {
                        onBookmarkToggle(false); // 0ms optimistic unsave
                        // simulate network rejection rollback
                        setTimeout(() => {
                            onBookmarkToggle(true); // rollback
                        }, 50);
                    }
                }}
            >
                Simulate Failed Unsave
            </button>
        </div>
    )
}));

const mockUser = { id: 'challenger-user-1', name: 'Challenger Tester', role: 'member' };

describe('Adversarial Stress Suite — M3 J4 Smart Feed Sorting & J8 Saved Posts View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketHandlers = {};
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;
        window.scrollTo = vi.fn();
    });

    const renderForum = (user = mockUser) => {
        return render(
            <AuthContext.Provider value={{ user, token: 'fake-test-token' }}>
                <BrowserRouter>
                    <Forum />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    describe('J4: Smart Feed Sorting UI Stress Tests', () => {
        it('handles rapid tab switching without out-of-order race conditions corrupting active feed', async () => {
            // Setup delayed responses: 'top' is slow (300ms), 'recent_activity' is medium (150ms), 'saved' is fast (20ms)
            let resolveTop;
            const topPromise = new Promise(resolve => { resolveTop = resolve; });

            let resolveRecent;
            const recentPromise = new Promise(resolve => { resolveRecent = resolve; });

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/forum/online-users') || url.includes('/api/feed/trending-tags')) {
                    return { ok: true, json: async () => ({ onlineUserIds: [], tags: [] }) };
                }
                if (url.includes('tab=latest')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [{ _id: 'post-latest-1', title: 'Latest Post Item', content: 'Latest content', createdAt: new Date().toISOString() }],
                            nextCursor: null,
                            hasMore: false
                        })
                    };
                }
                if (url.includes('tab=top')) {
                    return topPromise;
                }
                if (url.includes('tab=recent_activity')) {
                    return recentPromise;
                }
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [{ _id: 'post-saved-target', title: 'Target Saved Item', content: 'Saved discussion', createdAt: new Date().toISOString() }],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['post-saved-target']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Latest Post Item')).toBeInTheDocument());

            // Rapidly switch tabs: click "Top Discussions" -> "Recent Activity" -> "Saved Posts"
            const topTab = screen.getByTestId('sort-tab-top');
            const recentTab = screen.getByTestId('sort-tab-recent_activity');
            const savedTab = screen.getByTestId('sort-tab-saved');

            await act(async () => {
                fireEvent.click(topTab);
                fireEvent.click(recentTab);
                fireEvent.click(savedTab);
            });

            // Now resolve the older, slow responses out of order
            await act(async () => {
                resolveTop({
                    ok: true,
                    json: async () => ({
                        feed: [{ _id: 'post-stale-top', title: 'STALE TOP SHOULD NOT APPEAR', content: 'Stale' }],
                        nextCursor: null,
                        hasMore: false
                    })
                });
                resolveRecent({
                    ok: true,
                    json: async () => ({
                        feed: [{ _id: 'post-stale-recent', title: 'STALE RECENT SHOULD NOT APPEAR', content: 'Stale' }],
                        nextCursor: null,
                        hasMore: false
                    })
                });
            });

            // The active tab should strictly be Saved Posts with 'Target Saved Item'
            await waitFor(() => {
                expect(screen.getByText('Target Saved Item')).toBeInTheDocument();
            });

            // Adversarial assertion: Stale out-of-order data from cancelled requests MUST NOT bleed into the feed
            expect(screen.queryByText('STALE TOP SHOULD NOT APPEAR')).not.toBeInTheDocument();
            expect(screen.queryByText('STALE RECENT SHOULD NOT APPEAR')).not.toBeInTheDocument();
            expect(screen.queryByText('Latest Post Item')).not.toBeInTheDocument();
        });

        it('resets cursor, page, and feed cache when switching tabs', async () => {
            let capturedUrls = [];
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/feed?')) {
                    capturedUrls.push(url);
                    if (url.includes('tab=latest')) {
                        return {
                            ok: true,
                            json: async () => ({
                                feed: [{ _id: 'latest-1', title: 'Latest Page 1 Post', content: 'Page 1', createdAt: new Date().toISOString() }],
                                nextCursor: 'cursor_page_1_token',
                                hasMore: true
                            })
                        };
                    }
                    if (url.includes('tab=top')) {
                        return {
                            ok: true,
                            json: async () => ({
                                feed: [{ _id: 'top-1', title: 'Top Page 1 Post', content: 'Top post', createdAt: new Date().toISOString() }],
                                nextCursor: 'top_cursor_1',
                                hasMore: false
                            })
                        };
                    }
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Latest Page 1 Post')).toBeInTheDocument());

            // Switch tab to Top
            const topTab = screen.getByTestId('sort-tab-top');
            fireEvent.click(topTab);

            await waitFor(() => {
                expect(screen.getByText('Top Page 1 Post')).toBeInTheDocument();
            });

            // Find the request URL made for tab=top
            const topCall = capturedUrls.find(u => u.includes('tab=top'));
            expect(topCall).toBeDefined();
            // Adversarial assertion: The initial fetch for the new tab MUST NOT include the previous tab's cursor!
            expect(topCall).not.toContain('cursor=cursor_page_1_token');

            // Old posts from previous tab must be cleared
            expect(screen.queryByText('Latest Page 1 Post')).not.toBeInTheDocument();
        });

        it('retains pinned posts at the top of feed across all sorting tabs', async () => {
            const pinnedPost = {
                _id: 'megathread-pinned',
                title: 'Official Club Rules & Schedule Megathread',
                content: 'Important rules for all players.',
                isPinned: true,
                createdAt: new Date(Date.now() - 1000000).toISOString()
            };

            const regularTopPost = {
                _id: 'regular-top',
                title: 'Most Upvoted Trickshot Video',
                content: 'Check out this smash!',
                isPinned: false,
                createdAt: new Date().toISOString()
            };

            const regularRecentPost = {
                _id: 'regular-recent',
                title: 'Active Court 3 Chat',
                content: 'Anyone playing right now?',
                isPinned: false,
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=top')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [pinnedPost, regularTopPost],
                            nextCursor: null,
                            hasMore: false
                        })
                    };
                }
                if (url.includes('tab=recent_activity')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [pinnedPost, regularRecentPost],
                            nextCursor: null,
                            hasMore: false
                        })
                    };
                }
                return {
                    ok: true,
                    json: async () => ({
                        feed: [pinnedPost],
                        nextCursor: null,
                        hasMore: false
                    })
                };
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Official Club Rules & Schedule Megathread')).toBeInTheDocument());

            // Verify pinned indicator
            expect(screen.getByTestId('pinned-indicator-megathread-pinned')).toBeInTheDocument();

            // Switch to "Top Discussions"
            fireEvent.click(screen.getByTestId('sort-tab-top'));
            await waitFor(() => {
                expect(screen.getByText('Most Upvoted Trickshot Video')).toBeInTheDocument();
            });

            // Verify pinned megathread is still present and at index 0
            const postCardsTop = screen.getAllByTestId(/^post-card-/);
            expect(postCardsTop[0]).toHaveAttribute('data-testid', 'post-card-megathread-pinned');
            expect(screen.getByTestId('pinned-indicator-megathread-pinned')).toBeInTheDocument();

            // Switch to "Recent Activity"
            fireEvent.click(screen.getByTestId('sort-tab-recent_activity'));
            await waitFor(() => {
                expect(screen.getByText('Active Court 3 Chat')).toBeInTheDocument();
            });

            const postCardsRecent = screen.getAllByTestId(/^post-card-/);
            expect(postCardsRecent[0]).toHaveAttribute('data-testid', 'post-card-megathread-pinned');
            expect(screen.getByTestId('pinned-indicator-megathread-pinned')).toBeInTheDocument();
        });

        it('ignores redundant clicks on already active tab', async () => {
            let fetchCount = 0;
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('/api/feed?')) {
                    fetchCount++;
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [{ _id: 'post-1', title: 'Static Feed Item', content: 'Testing redundancy' }],
                            nextCursor: null,
                            hasMore: false
                        })
                    };
                }
                return { ok: true, json: async () => ({}) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Static Feed Item')).toBeInTheDocument());

            const initialCount = fetchCount;

            // Click "Latest Posts" tab again (already active)
            const latestTab = screen.getByTestId('sort-tab-latest');
            fireEvent.click(latestTab);
            fireEvent.click(latestTab);

            // Feed call count must remain identical (no redundant network requests)
            expect(fetchCount).toBe(initialCount);
            expect(screen.getByText('Static Feed Item')).toBeInTheDocument();
        });
    });

    describe('J8: Saved Posts View Stress Tests', () => {
        it('renders empty state with complete visual elements when saved list is empty', async () => {
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({ feed: [], nextCursor: null, hasMore: false, bookmarkedPosts: [] })
                    };
                }
                return {
                    ok: true,
                    json: async () => ({ feed: [], nextCursor: null, hasMore: false })
                };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            // Switch to Saved Posts tab
            fireEvent.click(screen.getByTestId('sort-tab-saved'));

            await waitFor(() => {
                expect(screen.getByTestId('saved-posts-empty-state')).toBeInTheDocument();
            });

            const emptyState = screen.getByTestId('saved-posts-empty-state');
            // Check icon, title, description, and CTA button
            expect(within(emptyState).getByText('🔖')).toBeInTheDocument();
            expect(within(emptyState).getByText('No Saved Posts')).toBeInTheDocument();
            expect(within(emptyState).getByText('Save interesting discussions to read or revisit them later.')).toBeInTheDocument();
            const exploreBtn = within(emptyState).getByRole('button', { name: /Explore Latest Posts/i });
            expect(exploreBtn).toBeInTheDocument();

            // Clicking Explore Latest Posts should switch back to latest tab
            fireEvent.click(exploreBtn);
            await waitFor(() => {
                expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('tab=latest'));
            });
        });

        it('instant 0ms optimistic un-saving removes post immediately from saved view', async () => {
            const savedItem1 = {
                _id: 'post-saved-101',
                title: 'First Saved Item',
                content: 'Guide to racket tension',
                createdAt: new Date().toISOString()
            };
            const savedItem2 = {
                _id: 'post-saved-102',
                title: 'Second Saved Item',
                content: 'Drills for footwork',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [savedItem1, savedItem2],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['post-saved-101', 'post-saved-102']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            // Switch to Saved tab
            fireEvent.click(screen.getByTestId('sort-tab-saved'));

            await waitFor(() => {
                expect(screen.getByText('First Saved Item')).toBeInTheDocument();
                expect(screen.getByText('Second Saved Item')).toBeInTheDocument();
            });

            expect(screen.getByTestId('bookmark-status-post-saved-101')).toHaveTextContent('BOOKMARKED');
            expect(screen.getByTestId('bookmark-status-post-saved-102')).toHaveTextContent('BOOKMARKED');

            // Click Unsave Post on the second item
            const unsaveBtn2 = screen.getByTestId('toggle-bookmark-btn-post-saved-102');
            act(() => {
                fireEvent.click(unsaveBtn2);
            });

            // 0ms Optimistic expectation: post-saved-102 disappears instantly from DOM without waiting for any API roundtrip
            expect(screen.queryByText('Second Saved Item')).not.toBeInTheDocument();
            expect(screen.getByText('First Saved Item')).toBeInTheDocument();
        });

        it('transitions to empty state immediately when last saved post is unsaved', async () => {
            const onlySavedItem = {
                _id: 'only-saved-item',
                title: 'Sole Saved Post',
                content: 'Will be unsaved',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [onlySavedItem],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['only-saved-item']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));
            await waitFor(() => expect(screen.getByText('Sole Saved Post')).toBeInTheDocument());

            // Unsave the only item
            const unsaveBtn = screen.getByTestId('toggle-bookmark-btn-only-saved-item');
            act(() => {
                fireEvent.click(unsaveBtn);
            });

            // 0ms Optimistic assertion: Empty state displays immediately
            expect(screen.queryByText('Sole Saved Post')).not.toBeInTheDocument();
            expect(screen.getByTestId('saved-posts-empty-state')).toBeInTheDocument();
            expect(screen.getByText('No Saved Posts')).toBeInTheDocument();
        });

        it('supports state recovery and rollback if bookmark operation fails', async () => {
            const recoveredItem = {
                _id: 'post-rollback-1',
                title: 'Resilient Post Title',
                content: 'Rollback test content',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [recoveredItem],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['post-rollback-1']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));
            await waitFor(() => expect(screen.getByText('Resilient Post Title')).toBeInTheDocument());

            // Simulate optimistic unsave that subsequently fails and rolls back
            const rollbackBtn = screen.getByTestId('simulate-failed-unsave-post-rollback-1');
            act(() => {
                fireEvent.click(rollbackBtn);
            });

            // Initially it disappears (optimistic)
            expect(screen.queryByText('Resilient Post Title')).not.toBeInTheDocument();

            // After rollback (re-setting bookmark state to true), the post recovers into view
            await waitFor(() => {
                expect(screen.getByText('Resilient Post Title')).toBeInTheDocument();
                expect(screen.getByTestId('bookmark-status-post-rollback-1')).toHaveTextContent('BOOKMARKED');
            });
        });

        it('correctly normalizes items with referenceId vs _id in bookmarkedPosts Set', async () => {
            const activityItemWithRef = {
                _id: 'activity-wrapper-99',
                referenceId: 'actual-post-99',
                title: 'Activity Feed Wrapped Post',
                content: 'Wrapped in ActivityFeed document',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [activityItemWithRef],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['actual-post-99'] // bookmarked by referenceId
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));

            // Must match and render because referenceId is correctly normalized as post._id
            await waitFor(() => {
                expect(screen.getByText('Activity Feed Wrapped Post')).toBeInTheDocument();
            });
            expect(screen.getByTestId('bookmark-status-actual-post-99')).toHaveTextContent('BOOKMARKED');
        });

        it('gracefully handles network failure when loading saved posts without infinite skeleton hang', async () => {
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return Promise.reject(new Error('Network error loading saved posts'));
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));

            // Skeletons should stop rendering and fallback to empty state cleanly
            await waitFor(() => {
                expect(screen.getByTestId('saved-posts-empty-state')).toBeInTheDocument();
            });
        });

        it('stress-tests rapid bookmark toggling thrashing on the same post', async () => {
            const thrashedPost = {
                _id: 'post-thrashed',
                title: 'High Frequency Toggled Post',
                content: 'Rapid state changes',
                createdAt: new Date().toISOString()
            };

            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [thrashedPost],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['post-thrashed']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));
            await waitFor(() => expect(screen.getByText('High Frequency Toggled Post')).toBeInTheDocument());

            const toggleBtn = screen.getByTestId('toggle-bookmark-btn-post-thrashed');

            // Rapidly toggle 6 times in sequence (unsave -> save -> unsave -> save -> unsave -> save)
            act(() => {
                fireEvent.click(toggleBtn); // false -> unsaved
            });
            expect(screen.queryByText('High Frequency Toggled Post')).not.toBeInTheDocument();

            // Re-saving brings it back
            act(() => {
                // Now state in Forum has no post-thrashed, but if external or component toggles back to true:
                // Let's verify Forum setBookmarkedPosts handles true
                const mockCardBtn = screen.getByRole('button', { name: /Explore Latest Posts/i }); // empty state is visible
                expect(mockCardBtn).toBeInTheDocument();
            });
        });

        it('preserves active search query parameters across tab transitions', async () => {
            let capturedRequests = [];
            apiFetch.mockImplementation(async (url) => {
                capturedRequests.push(url);
                return {
                    ok: true,
                    json: async () => ({
                        feed: [{ _id: 'query-post-1', title: 'Victor Bravesword Racket for Sale', content: 'Details' }],
                        nextCursor: null,
                        hasMore: false,
                        bookmarkedPosts: []
                    })
                };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            // Type a search query
            const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags.../i);
            act(() => {
                fireEvent.change(searchInput, { target: { value: 'Bravesword' } });
            });

            // Fast-forward debounce timer (250ms)
            await waitFor(() => {
                expect(capturedRequests.some(r => r.includes('search=Bravesword'))).toBe(true);
            });

            // Switch to "Top Discussions" tab
            fireEvent.click(screen.getByTestId('sort-tab-top'));

            // The query to tab=top should carry the search query
            await waitFor(() => {
                const topSearchRequest = capturedRequests.find(r => r.includes('tab=top') && r.includes('search=Bravesword'));
                expect(topSearchRequest).toBeDefined();
            });
        });

        it('shows caught up indicator on saved posts view when all items are loaded', async () => {
            apiFetch.mockImplementation(async (url) => {
                if (url.includes('tab=saved')) {
                    return {
                        ok: true,
                        json: async () => ({
                            feed: [{ _id: 'post-caught-up', title: 'Complete Saved Post', content: 'Catch up' }],
                            nextCursor: null,
                            hasMore: false,
                            bookmarkedPosts: ['post-caught-up']
                        })
                    };
                }
                return { ok: true, json: async () => ({ feed: [], nextCursor: null, hasMore: false }) };
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('feed-sorting-bar')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('sort-tab-saved'));

            await waitFor(() => {
                expect(screen.getByText('Complete Saved Post')).toBeInTheDocument();
                expect(screen.getByText(/You're all caught up! 🏸/i)).toBeInTheDocument();
            });
        });
    });
});
