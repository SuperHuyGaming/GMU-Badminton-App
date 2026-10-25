
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PostCard from './PostCard';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Mock the API calls and navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

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
    
    const renderWithContext = (post, user) => {
        return render(
            <AuthContext.Provider value={{ user, token: 'fake-token' }}>
                <BrowserRouter>
                    <PostCard post={post} currentUser={user} onLike={vi.fn()} onComment={vi.fn()} />
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
});
