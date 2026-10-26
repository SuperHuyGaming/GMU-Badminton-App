import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PostCard from './PostCard';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

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

    it('renders interactive badminton emoji reaction chips', () => {
        const postWithReactions = {
            ...mockPost,
            reactions: [
                { userId: 'user-123', emoji: '🏸' },
                { userId: 'user-456', emoji: '🏸' },
                { userId: 'user-789', emoji: '🔥' },
            ],
        };
        renderWithContext(postWithReactions, mockUser);
        expect(screen.getByText('🏸 2')).toBeInTheDocument();
        expect(screen.getByText('🔥 1')).toBeInTheDocument();
    });

    it('toggles comment accordion when Comment button is clicked', () => {
        renderWithContext(mockPost, mockUser);
        const commentButton = screen.getByRole('button', { name: /Comment/i });
        expect(commentButton).toBeInTheDocument();
        commentButton.click();
    });

    it('renders Badminton Reaction Trio chips (💥, 🧊, ⚡)', () => {
        const postWithTrio = {
            ...mockPost,
            reactions: [
                { userId: 'user-1', emoji: '💥', reactionType: 'smash' },
                { userId: 'user-2', emoji: '💥', reactionType: 'smash' },
                { userId: 'user-3', emoji: '🧊', reactionType: 'ice_drop' },
                { userId: 'user-4', emoji: '⚡', reactionType: 'clutch' },
            ],
        };
        renderWithContext(postWithTrio, mockUser);
        expect(screen.getByText('💥 2')).toBeInTheDocument();
        expect(screen.getByText('🧊 1')).toBeInTheDocument();
        expect(screen.getByText('⚡ 1')).toBeInTheDocument();
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

    it('renders Smash label on primary reaction button when user has not reacted', () => {
        renderWithContext(mockPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        expect(reactButton).toBeInTheDocument();
        expect(screen.getByText('Smash')).toBeInTheDocument();
        expect(screen.getByText('💥')).toBeInTheDocument();
    });

    it('renders active reaction label on primary button when user has reacted with Ice Drop', () => {
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: mockUser.id, emoji: '🧊', reactionType: 'ice_drop' }
            ],
        };
        renderWithContext(reactedPost, mockUser);
        expect(screen.getByText('Ice Drop')).toBeInTheDocument();
        expect(screen.getByText('🧊')).toBeInTheDocument();
    });

    it('renders active reaction label on primary button when user has reacted with Clutch', () => {
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: mockUser.id, emoji: '⚡', reactionType: 'clutch' }
            ],
        };
        renderWithContext(reactedPost, mockUser);
        expect(screen.getByText('Clutch')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('supports user objects with _id instead of id for reaction detection', () => {
        const userWithMongoId = { _id: 'mongo-user-456', name: 'Mongo User' };
        const reactedPost = {
            ...mockPost,
            reactions: [
                { userId: 'mongo-user-456', emoji: '💥', reactionType: 'smash' }
            ],
        };
        renderWithContext(reactedPost, userWithMongoId);
        expect(screen.getByText('Smash')).toBeInTheDocument();
        expect(screen.getByText('💥')).toBeInTheDocument();
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

    it('optimistically adds reaction when clicking Smash reaction button', async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockPost,
                reactions: [{ userId: mockUser.id, emoji: '💥', reactionType: 'smash' }]
            })
        });
        renderWithContext(mockPost, mockUser);
        const reactButton = screen.getByRole('button', { name: /React to post/i });
        fireEvent.click(reactButton);
        await waitFor(() => {
            expect(screen.getByText('💥 1')).toBeInTheDocument();
        });
    });

    it('renders Player Matchmaking banner and allows toggling RSVP', async () => {
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
                    rsvpList: [{ userId: mockUser.id, userName: mockUser.name, status: 'confirmed' }]
                }
            })
        });

        renderWithContext(matchmakingPost, mockUser);
        expect(screen.getByText('🤝 Player Matchmaking')).toBeInTheDocument();
        expect(screen.getByText('RAC Courts 1-3')).toBeInTheDocument();
        expect(screen.getByText('🟢 Need 2 more')).toBeInTheDocument();

        const joinBtn = screen.getByRole('button', { name: /\+ Join Rally \(RSVP\)/i });
        fireEvent.click(joinBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/rsvp'), expect.any(Object));
        });
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
});
