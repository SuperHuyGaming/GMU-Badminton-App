import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Leaderboard from './Leaderboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiFetch from '../utils/api';

// Mock the API fetch utility
vi.mock('../utils/api', () => ({
    default: vi.fn()
}));

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
});

describe('Leaderboard Page Component', () => {
    beforeEach(() => {
        queryClient.clear();
        vi.clearAllMocks();
    });
    const renderWithProviders = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <Leaderboard />
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('renders the leaderboard header and title', () => {
        apiFetch.mockResolvedValueOnce({
            json: async () => []
        });

        renderWithProviders();
        expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    });

    it('displays loading skeletons initially', () => {
        // Mock a slow API response that doesn't resolve immediately
        apiFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 1000)));

        const { container } = renderWithProviders();
        // MUI Skeleton renders as span with 'MuiSkeleton-root' class
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders players when data is loaded', async () => {
        const mockUsers = [
            { _id: '1', name: 'Lin Dan', singlesElo: 2800, skillLevel: 'Advanced' },
            { _id: '2', name: 'Lee Chong Wei', singlesElo: 2750, skillLevel: 'Advanced' }
        ];

        apiFetch.mockResolvedValueOnce({
            json: async () => mockUsers
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Lin Dan')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Lee Chong Wei')).toBeInTheDocument();
        expect(screen.getByText('2800')).toBeInTheDocument();
        expect(screen.getByText('2750')).toBeInTheDocument();
        expect(screen.getAllByText('Advanced').length).toBe(2);
    });

    it('renders empty state when no players are found', async () => {
        apiFetch.mockResolvedValueOnce({
            json: async () => []
        });

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('No players found.')).toBeInTheDocument();
        });
    });
});
