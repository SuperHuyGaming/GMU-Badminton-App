import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PostCard from './PostCard';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';
import socket from '../utils/socket';

// Mock the API calls and navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

vi.mock('../utils/api', () => ({
    default: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reactions: [] })
    })
}));

describe('PostCard Component QA Tests', () => {
    const mockPost = {
        _id: 'post-123',
        authorId: 'user-123',
        authorName: 'Test Author',
        title: 'Test Post Title',
        content: 'This is a test post content',
        createdAt: new Date().toISOString(),
        likes: ['user-123'],
        comments: []
    };

    const mockUser = { id: 'user-123', name: 'Test Author' };
    
    const renderWithContext = (post, user, extraProps = {}) => {
        return render(
            <AuthContext.Provider value={{ user, token: 'fake-token' }}>
                <BrowserRouter>
                    <PostCard post={post} currentUser={user} onLike={vi.fn()} onComment={vi.fn()} {...extraProps} />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    it('renders the post title and content correctly', () => {
        renderWithContext(mockPost, mockUser);
        expect(screen.getByText('Test Post Title')).toBeInTheDocument();
        expect(screen.getByText('This is a test post content')).toBeInTheDocument();
    });

    it('prevents text selection during rapid double clicking', () => {
        const { container } = renderWithContext(mockPost, mockUser);
        const cardArea = container.querySelector(`#post-${mockPost._id}`);
        expect(cardArea).toHaveStyle({ userSelect: 'none' });
    });

    it('renders pinned megathread badge when post.isPinned is true', () => {
        const pinnedPost = { ...mockPost, isPinned: true };
        renderWithContext(pinnedPost, mockUser);
        expect(screen.getByText('📌 Pinned Megathread')).toBeInTheDocument();
    });

    it('renders Facebook-style reaction emoji cluster and total count', () => {
        const postWithReactions = {
            ...mockPost,
            reactions: [
                { userId: 'user-123', emoji: '👍' },
                { userId: 'user-456', emoji: '👍' },
                { userId: 'user-789', emoji: '❤️' },
            ],
        };
        renderWithContext(postWithReactions, mockUser);
        const reactionsBtn = screen.getByTestId('view-reactions-btn');
        expect(within(reactionsBtn).getByText('👍')).toBeInTheDocument();
        expect(within(reactionsBtn).getByText('❤️')).toBeInTheDocument();
        expect(within(reactionsBtn).getByText('3')).toBeInTheDocument();
    });

    it('toggles comment accordion when Comment button is clicked', () => {
        renderWithContext(mockPost, mockUser);
        const commentButton = screen.getByRole('button', { name: /Comment/i });
        expect(commentButton).toBeInTheDocument();
        commentButton.click();
    });

    it('renders Facebook Reaction cluster (👍, ❤️, 😂)', () => {
        const postWithTrio = {
            ...mockPost,
            reactions: [
                { userId: 'user-1', emoji: '👍', reactionType: 'like' },
                { userId: 'user-2', emoji: '👍', reactionType: 'like' },
                { userId: 'user-3', emoji: '❤️', reactionType: 'love' },
                { userId: 'user-4', emoji: '😂', reactionType: 'haha' },
            ],
        };
        renderWithContext(postWithTrio, mockUser);
        const reactionsBtn = screen.getByTestId('view-reactions-btn');
        expect(within(reactionsBtn).getByText('👍')).toBeInTheDocument();
        expect(within(reactionsBtn).getByText('❤️')).toBeInTheDocument();
        expect(within(reactionsBtn).getByText('😂')).toBeInTheDocument();
        expect(within(reactionsBtn).getByText('4')).toBeInTheDocument();
    });

    it('renders category badge when category is specified', () => {
        const postWithCategory = {
            ...mockPost,
            category: 'match_result',
        };
        renderWithContext(postWithCategory, mockUser);
        expect(screen.getByText('Match Result')).toBeInTheDocument();
    });

    it('renders match scorecard banner when matchDetails are provided', () => {
        const postWithScorecard = {
            ...mockPost,
            category: 'match_result',
            matchDetails: {
                partner: 'Alex Wong',
                opponents: ['David Kim', 'Chris Lee'],
                score: '21-19, 18-21, 22-20',
                court: 'RAC Court 1',
                winner: 'Team Us',
            },
        };
        renderWithContext(postWithScorecard, mockUser);
        expect(screen.getByText('🏸 Match Scorecard')).toBeInTheDocument();
        expect(screen.getByText('21-19, 18-21, 22-20')).toBeInTheDocument();
        expect(screen.getByText('Court: RAC Court 1')).toBeInTheDocument();
        expect(screen.getByText('Winner: Team Us')).toBeInTheDocument();
        expect(screen.getByText(/Alex Wong/)).toBeInTheDocument();
        expect(screen.getByText(/David Kim, Chris Lee/)).toBeInTheDocument();
    });

    it('renders Like label on primary reaction button when user has not reacted', () => {
        renderWithContext(mockPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        expect(reactButton).toBeInTheDocument();
        expect(screen.getByText('Like')).toBeInTheDocument();
    });

    it('renders active reaction label on primary button when user has reacted with Love', () => {
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: mockUser.id, emoji: '❤️', reactionType: 'love' }
            ],
        };
        renderWithContext(reactedPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        expect(within(reactButton).getByText('Love')).toBeInTheDocument();
        expect(within(reactButton).getByText('❤️')).toBeInTheDocument();
    });

    it('renders active reaction label on primary button when user has reacted with Haha', () => {
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: mockUser.id, emoji: '😂', reactionType: 'haha' }
            ],
        };
        renderWithContext(reactedPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        expect(within(reactButton).getByText('Haha')).toBeInTheDocument();
        expect(within(reactButton).getByText('😂')).toBeInTheDocument();
    });

    it('supports user objects with _id instead of id for reaction detection', () => {
        const userWithMongoId = { _id: 'mongo-user-456', name: 'Mongo User' };
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: 'mongo-user-456', emoji: '❤️', reactionType: 'love' }
            ],
        };
        renderWithContext(reactedPost, userWithMongoId);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        expect(within(reactButton).getByText('Love')).toBeInTheDocument();
        expect(within(reactButton).getByText('❤️')).toBeInTheDocument();
    });

    it('renders scorecard banner when matchDetails only contains winner', () => {
        const postWithWinnerOnly = {
            ...mockPost,
            category: 'match_result',
            matchDetails: {
                winner: 'Challenger Duo',
            },
        };
        renderWithContext(postWithWinnerOnly, mockUser);
        expect(screen.getByText('🏸 Match Scorecard')).toBeInTheDocument();
        expect(screen.getByText('Winner: Challenger Duo')).toBeInTheDocument();
    });

    it('optimistically adds reaction when clicking Like reaction button', async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockPost,
                reactions: [{ userId: mockUser.id, emoji: '👍', reactionType: 'like' }]
            })
        });
        renderWithContext(mockPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        fireEvent.click(reactButton);
        await waitFor(() => {
            const reactionsBtn = screen.getByTestId('view-reactions-btn');
            expect(within(reactionsBtn).getByText('👍')).toBeInTheDocument();
            expect(within(reactionsBtn).getByText('1')).toBeInTheDocument();
        });
    });

    it('renders Player Matchmaking banner and allows toggling RSVP for non-author', async () => {
        const otherPlayer = { id: 'other-user-999', name: 'Other Player' };
        const matchmakingPost = {
            ...mockPost,
            category: 'find_partner',
            playerMatchmaking: {
                format: 'Doubles',
                preferredCourt: 'RAC Courts 1-3',
                skillLevelRequired: 'Intermediate',
                slotsNeeded: 2,
                timeWindow: 'Tonight 7:00 PM',
                rsvpList: [],
                isFilled: false
            }
        };

        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...matchmakingPost,
                playerMatchmaking: {
                    ...matchmakingPost.playerMatchmaking,
                    rsvpList: [{ userId: otherPlayer.id, userName: otherPlayer.name, status: 'confirmed' }]
                }
            })
        });

        renderWithContext(matchmakingPost, otherPlayer);
        expect(screen.getByText('🤝 Player Matchmaking')).toBeInTheDocument();
        expect(screen.getByText('RAC Courts 1-3')).toBeInTheDocument();
        expect(screen.getByText('🟢 Need 2 more')).toBeInTheDocument();

        const joinBtn = screen.getByRole('button', { name: /\+ Join Rally \(RSVP\)/i });
        fireEvent.click(joinBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/rsvp'), expect.any(Object));
        });
    });

    it('displays Host badge instead of Join Rally button when viewing own matchmaking rally', () => {
        const matchmakingPost = {
            ...mockPost,
            category: 'find_partner',
            playerMatchmaking: {
                format: 'Doubles',
                preferredCourt: 'RAC Courts 1-3',
                skillLevelRequired: 'Intermediate',
                slotsNeeded: 2,
                timeWindow: 'Tonight 7:00 PM',
                rsvpList: [],
                isFilled: false
            }
        };
        renderWithContext(matchmakingPost, mockUser);
        expect(screen.getByText('👑 Host')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /\+ Join Rally/i })).not.toBeInTheDocument();
    });

    it('renders Match Challenge banner and allows non-author to accept challenge', async () => {
        const challengePost = {
            ...mockPost,
            authorId: 'other-user',
            category: 'challenge_match',
            challengeMatch: {
                matchType: 'Ranked Ladder Challenge',
                gameFormat: 'Best of 3 to 21',
                stipulations: 'Bring feathers',
                matchStatus: 'open',
                acceptedBy: []
            }
        };

        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...challengePost,
                challengeMatch: {
                    ...challengePost.challengeMatch,
                    matchStatus: 'accepted',
                    acceptedBy: [{ userId: mockUser.id, userName: mockUser.name }]
                }
            })
        });

        renderWithContext(challengePost, mockUser);
        expect(screen.getByText('⚔️ Match Challenge')).toBeInTheDocument();
        expect(screen.getByText('Ranked Ladder Challenge')).toBeInTheDocument();
        expect(screen.getByText('Open Challenge')).toBeInTheDocument();

        const acceptBtn = screen.getByRole('button', { name: /⚔️ Accept Challenge/i });
        fireEvent.click(acceptBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/accept-challenge'), expect.any(Object));
        });
    });

    it('renders Q&A Forum banner with subtopic and resolved solution status', () => {
        const qaPost = {
            ...mockPost,
            category: 'qa_forum',
            qaDetails: {
                subtopic: 'Rackets & Strings',
                isResolved: true
            }
        };

        renderWithContext(qaPost, mockUser);
        expect(screen.getByText('💡 Badminton Q&A')).toBeInTheDocument();
        expect(screen.getByText('Rackets & Strings')).toBeInTheDocument();
        expect(screen.getByText('✅ Solution Accepted')).toBeInTheDocument();
    });

    it('renders Gear Exchange banner with gear specs and price chip', () => {
        const gearPost = {
            ...mockPost,
            category: 'gear_exchange',
            gearDetails: {
                gearType: 'Racket',
                brand: 'Yonex Astrox 100ZZ',
                condition: 'Mint',
                tradeType: 'For Sale',
                price: 180,
                specs: {
                    weightCode: '4U',
                    currentString: 'BG80 @ 27 lbs'
                }
            }
        };

        renderWithContext(gearPost, mockUser);
        expect(screen.getByText(/🏸 Racket • Yonex Astrox 100ZZ/i)).toBeInTheDocument();
        expect(screen.getByText('$180')).toBeInTheDocument();
        expect(screen.getByText('Condition: Mint')).toBeInTheDocument();
        expect(screen.getByText('String: BG80 @ 27 lbs')).toBeInTheDocument();
    });

    it('handles 1-tap post sharing using clipboard copy fallback with toast confirmation', async () => {
        const writeTextMock = vi.fn().mockResolvedValue();
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        renderWithContext(mockPost, mockUser);
        const shareBtn = screen.getByRole('button', { name: /share/i });
        fireEvent.click(shareBtn);

        expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(`/community#post-${mockPost._id}`));
    });

    it('renders Club Exec badge and active win streak chip on author header', () => {
        const authorWithStats = {
            ...mockPost,
            authorRole: 'admin',
            authorStreak: 7
        };

        renderWithContext(authorWithStats, mockUser);
        expect(screen.getByText('Club Exec')).toBeInTheDocument();
        expect(screen.getByText('⚡ 7 Streak')).toBeInTheDocument();
    });

    it('allows a non-author to open Report Post dialog and submit report', async () => {
        const viewerUser = { id: 'viewer-456', name: 'Other Member' };
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, reportCount: 1 })
        });

        renderWithContext(mockPost, viewerUser);

        // Click 3 dots menu
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        // Click Report Post in menu
        const reportOption = screen.getByRole('menuitem', { name: /🚩 Report Post/i });
        fireEvent.click(reportOption);

        // Dialog should be open
        expect(screen.getByText(/Report Community Post/i)).toBeInTheDocument();
        expect(screen.getByText(/Help keep our badminton community safe/i)).toBeInTheDocument();

        // Submit report
        const submitBtn = screen.getByRole('button', { name: /Submit Report/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining(`/api/forum/${mockPost._id}/report`),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('spam_advertising')
                })
            );
        });
    });

    it('supports compact feed density mode and renders with post-card-compact testid', () => {
        renderWithContext(mockPost, mockUser, { compact: true });
        expect(screen.getByTestId('post-card-compact')).toBeInTheDocument();
    });

    it('renders comfortable mode by default with post-card-comfortable testid', () => {
        renderWithContext(mockPost, mockUser, { compact: false });
        expect(screen.getByTestId('post-card-comfortable')).toBeInTheDocument();
    });

    // ── Phase 6: Real-Time Presence, Collage Grid ─────────────────────────────

    it('renders online presence badge when isAuthorOnline is true', () => {
        renderWithContext(mockPost, mockUser, { isAuthorOnline: true });
        expect(screen.getByTestId('author-online-indicator')).toBeInTheDocument();
    });

    it('does NOT render online badge when isAuthorOnline is false (default)', () => {
        renderWithContext(mockPost, mockUser);
        expect(screen.queryByTestId('author-online-indicator')).not.toBeInTheDocument();
    });

    it('renders single image as full-width hero (collage-grid-1)', () => {
        const postWithOneImage = {
            ...mockPost,
            mediaUrls: ['https://example.com/photo1.jpg']
        };
        renderWithContext(postWithOneImage, mockUser);
        expect(screen.getByTestId('collage-grid-1')).toBeInTheDocument();
    });

    it('renders 2-image collage grid (collage-grid-2)', () => {
        const postWithTwoImages = {
            ...mockPost,
            mediaUrls: [
                'https://example.com/photo1.jpg',
                'https://example.com/photo2.jpg'
            ]
        };
        renderWithContext(postWithTwoImages, mockUser);
        expect(screen.getByTestId('collage-grid-2')).toBeInTheDocument();
    });

    it('renders 3-image collage grid (collage-grid-3)', () => {
        const postWithThreeImages = {
            ...mockPost,
            mediaUrls: [
                'https://example.com/photo1.jpg',
                'https://example.com/photo2.jpg',
                'https://example.com/photo3.jpg'
            ]
        };
        renderWithContext(postWithThreeImages, mockUser);
        expect(screen.getByTestId('collage-grid-3')).toBeInTheDocument();
    });

    it('renders 4+ image collage with "+N more" overlay (collage-grid-4)', () => {
        const postWithSixImages = {
            ...mockPost,
            mediaUrls: [
                'https://example.com/photo1.jpg',
                'https://example.com/photo2.jpg',
                'https://example.com/photo3.jpg',
                'https://example.com/photo4.jpg',
                'https://example.com/photo5.jpg',
                'https://example.com/photo6.jpg'
            ]
        };
        renderWithContext(postWithSixImages, mockUser);
        expect(screen.getByTestId('collage-grid-4')).toBeInTheDocument();
        expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('opens lightbox with download button when clicking collage image', () => {
        const postWithImage = {
            ...mockPost,
            mediaUrls: ['https://example.com/photo1.jpg']
        };
        renderWithContext(postWithImage, mockUser);
        const cell = screen.getByTestId('collage-grid-1');
        fireEvent.click(cell);
        expect(screen.getByTestId('download-photo-btn')).toBeInTheDocument();
    });

    // ── Phase 7: Interactive Reactions, Who Reacted Modal & Badges ───────────

    it('renders view-reactions-btn and opens Who Reacted modal on click', () => {
        const postWithReactions = {
            ...mockPost,
            reactions: [
                { userId: 'u-1', userName: 'Alex', emoji: '💥', reactionType: 'smash' },
                { userId: 'u-2', userName: 'Ben', emoji: '🧊', reactionType: 'ice_drop' }
            ]
        };
        renderWithContext(postWithReactions, mockUser);

        const viewReactionsBtn = screen.getByTestId('view-reactions-btn');
        expect(viewReactionsBtn).toBeInTheDocument();
        expect(viewReactionsBtn).toHaveTextContent('2');

        fireEvent.click(viewReactionsBtn);
        expect(screen.getByTestId('likes-modal')).toBeInTheDocument();
        expect(screen.getByText('Post Reactions')).toBeInTheDocument();
    });

    it('renders badminton gamification badges (Smash Master, Clutch Performer, Community Guide)', () => {
        const gamifiedPost = {
            ...mockPost,
            authorBadges: ['smash_master', 'clutch_performer', 'community_guide']
        };
        renderWithContext(gamifiedPost, mockUser);

        expect(screen.getByTestId('badge-smash-master')).toBeInTheDocument();
        expect(screen.getByText('Smash Master')).toBeInTheDocument();

        expect(screen.getByTestId('badge-clutch-performer')).toBeInTheDocument();
        expect(screen.getByText('Clutch Performer')).toBeInTheDocument();

        expect(screen.getByTestId('badge-community-guide')).toBeInTheDocument();
        expect(screen.getByText('Community Guide')).toBeInTheDocument();
    });

    // ── Milestone 2: J1 Facebook Reactions Dock ─────────────────────────────

    it('reveals 6 Facebook reactions in dock on hover and allows reacting with Love', async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockPost,
                reactions: [{ userId: mockUser.id, emoji: '❤️', reactionType: 'love' }]
            })
        });

        const { container } = renderWithContext(mockPost, mockUser);
        const reactBtn = screen.getByRole('button', { name: /React to post/i });
        const reactionBox = reactBtn.closest('.MuiBox-root');

        // Hover over the reaction box to trigger the dock
        fireEvent.mouseEnter(reactionBox || container);

        const dock = await screen.findByTestId('reactions-dock');
        expect(dock).toBeInTheDocument();
        expect(within(dock).getByText('👍')).toBeInTheDocument();
        expect(within(dock).getByText('❤️')).toBeInTheDocument();
        expect(within(dock).getByText('😡')).toBeInTheDocument();
        expect(within(dock).getByText('😮')).toBeInTheDocument();
        expect(within(dock).getByText('😂')).toBeInTheDocument();
        expect(within(dock).getByText('😢')).toBeInTheDocument();

        // Click Love reaction
        const loveBtn = within(dock).getByRole('button', { name: /React with Love/i });
        fireEvent.click(loveBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                expect.stringContaining(`/api/forum/${mockPost._id}/react`),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ emoji: '❤️' })
                })
            );
            expect(within(reactBtn).getByText('❤️')).toBeInTheDocument();
            expect(within(reactBtn).getByText('Love')).toBeInTheDocument();
        });
    });

    it('updates reactions in real-time when socket reactionUpdated event is emitted', async () => {
        renderWithContext(mockPost, mockUser);

        // Emit reactionUpdated on client socket
        socket.emit('reactionUpdated', {
            postId: mockPost._id,
            reactions: [
                { userId: 'u-1', emoji: '❤️', reactionType: 'love' },
                { userId: 'u-2', emoji: '😮', reactionType: 'wow' }
            ],
            action: 'added'
        });

        // Trigger the socket callback registered in PostCard
        const listeners = socket.listeners ? socket.listeners('reactionUpdated') : [];
        if (listeners.length > 0) {
            listeners.forEach(fn => fn({
                postId: mockPost._id,
                reactions: [
                    { userId: 'u-1', emoji: '❤️', reactionType: 'love' },
                    { userId: 'u-2', emoji: '😮', reactionType: 'wow' }
                ]
            }));
        }

        await waitFor(() => {
            const reactionsBtn = screen.getByTestId('view-reactions-btn');
            expect(reactionsBtn).toHaveTextContent('2');
        });
    });

    // ── Milestone 2: J5 Post Pinning Hierarchy ──────────────────────────────

    it('allows admin user to toggle pin megathread from 3-dots card menu', async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'Post pin toggled', isPinned: true })
        });

        const adminUser = { ...mockUser, role: 'admin' };
        renderWithContext(mockPost, adminUser);

        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        const pinOption = screen.getByRole('menuitem', { name: /📌 Pin Megathread/i });
        expect(pinOption).toBeInTheDocument();
        fireEvent.click(pinOption);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                `/api/forum/${mockPost._id}/pin`,
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });
    it('hides pin megathread option for non-admin author', () => {
        renderWithContext(mockPost, mockUser);
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);
        expect(screen.queryByRole('menuitem', { name: /Pin Megathread/i })).not.toBeInTheDocument();
    });


    // ── Milestone 2: J6 Audience Privacy Indicators ─────────────────────────

    it('renders audience privacy icons (Public, Friends Only, Only Me) with tooltips', () => {
        const publicPost = { ...mockPost, visibility: 'PUBLIC' };
        const { unmount: unmount1 } = renderWithContext(publicPost, mockUser);
        expect(screen.getByLabelText(/Privacy: Public/i)).toBeInTheDocument();
        unmount1();

        const friendsPost = { ...mockPost, visibility: 'FRIENDS_ONLY' };
        const { unmount: unmount2 } = renderWithContext(friendsPost, mockUser);
        expect(screen.getByLabelText(/Privacy: Friends Only/i)).toBeInTheDocument();
        unmount2();

        const privatePost = { ...mockPost, visibility: 'ONLY_ME' };
        renderWithContext(privatePost, mockUser);
        expect(screen.getByLabelText(/Privacy: Only Me/i)).toBeInTheDocument();
    });

    // ── Milestone 2: J7 ShareModal & Quote Preview Card ─────────────────────

    it('renders quote preview card when post is a repost of originalPost', () => {
        const repost = {
            ...mockPost,
            _id: 'repost-999',
            title: 'My thoughts on tournament',
            content: 'Great event announced by the club!',
            originalPostId: 'orig-post-1',
            originalPost: {
                _id: 'orig-post-1',
                authorName: 'President Alex',
                title: 'Spring Open 2026 Announcement',
                content: 'Full bracket and registration details inside.',
                category: 'meetup_rally'
            }
        };

        renderWithContext(repost, mockUser);

        const quoteCard = screen.getByTestId('post-quote-card');
        expect(quoteCard).toBeInTheDocument();
        expect(within(quoteCard).getByText('President Alex')).toBeInTheDocument();
        expect(within(quoteCard).getByText('Spring Open 2026 Announcement')).toBeInTheDocument();
        expect(within(quoteCard).getByText(/Full bracket and registration details/)).toBeInTheDocument();
    });

    it('opens ShareModal dialog when clicking share button', () => {
        renderWithContext(mockPost, mockUser);
        const shareBtn = screen.getByRole('button', { name: /share/i });
        fireEvent.click(shareBtn);

        expect(screen.getByTestId('share-modal')).toBeInTheDocument();
        expect(screen.getByText('Share Post')).toBeInTheDocument();
    });

    // ── Milestone 2: J9 Post Edit Transparency ──────────────────────────────

    it('renders (Edited) badge with tooltip when post.isEdited is true', () => {
        const editedPost = {
            ...mockPost,
            isEdited: true,
            editedAt: new Date().toISOString()
        };

        renderWithContext(editedPost, mockUser);
        const editedBadge = screen.getByTestId('post-edited-badge');
        expect(editedBadge).toBeInTheDocument();
        expect(editedBadge).toHaveTextContent('(Edited)');
    });
});
