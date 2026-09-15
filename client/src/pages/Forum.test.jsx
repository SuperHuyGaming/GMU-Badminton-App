import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// Mock the API fetch utility
vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

// Mock react-virtuoso because JSDOM doesn't support layout rendering well
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent }) => (
        <div data-testid="virtuoso-mock">
            {data.map((item, index) => (
                <div key={item._id || index}>
                    {itemContent(index, item)}
                </div>
            ))}
        </div>
    )
}));

const mockUser = { _id: 'user1', name: 'Test User' };

describe('Forum Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        apiFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 1000)));
        const { container } = renderWithProviders();
        
        // PostSkeleton contains MuiSkeleton-root
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders empty state when no posts are found', async () => {
        apiFetch.mockResolvedValueOnce({
            json: async () => []
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText(/No posts found for/i)).toBeInTheDocument();
            expect(screen.getByText('Be the first to start a thread!')).toBeInTheDocument();
        });
    });

    it('renders posts using Virtuoso mock when data is loaded', async () => {
        const mockPosts = [
            {
                _id: 'post1',
                title: 'Anyone down for singles?',
                content: 'Need a hitting partner.',
                authorId: { _id: 'user2', name: 'John Doe', profilePic: '' },
                targetDate: new Date().toISOString().split('T')[0],
                likes: [],
                comments: [],
                createdAt: new Date().toISOString()
            }
        ];

        apiFetch.mockResolvedValueOnce({
            json: async () => mockPosts
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Anyone down for singles?')).toBeInTheDocument();
            expect(screen.getByText('Need a hitting partner.')).toBeInTheDocument();
        });
    });
});
