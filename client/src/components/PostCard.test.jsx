import { render, screen,  } from '@testing-library/react';
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
                    <PostCard post={post} onLike={vi.fn()} onComment={vi.fn()} />
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
        // The outer Paper component is usually what we click
        const cardArea = container.querySelector(`#post-${mockPost._id}`);
        // Since we explicitly added userSelect: 'none' to the Card to prevent blue highlights
        expect(cardArea).toHaveStyle({ userSelect: 'none' });
    });
});
