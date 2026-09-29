import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SearchResults from './SearchResults';
import apiFetch from '../utils/api';
import posthog from 'posthog-js';
import { useAuth } from '../context/AuthContext';

// Mock API fetch
vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

// Mock PostHog
vi.mock('posthog-js', () => ({
    default: {
        capture: vi.fn(),
    },
}));

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('SearchResults Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null,
        });
        window.IntersectionObserver = mockIntersectionObserver;
        
        useAuth.mockReturnValue({
            user: { _id: 'u1', name: 'Test User', university: 'GMU' }
        });
    });

    const renderSearchResults = (query = 'Alice') => {
        return render(
            <MemoryRouter initialEntries={[`/search?q=${encodeURIComponent(query)}`]}>
                <SearchResults />
            </MemoryRouter>
        );
    };

    it('renders the search results header and filter controls', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [] }),
        });

        renderSearchResults('Alice');
        expect(screen.getByText('Search Results for "Alice"')).toBeInTheDocument();
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByLabelText('Players')).toBeInTheDocument();
        expect(screen.getByLabelText('Posts')).toBeInTheDocument();
        expect(screen.getByLabelText('Beginner')).toBeInTheDocument();
        expect(screen.getByLabelText('Intermediate')).toBeInTheDocument();
        expect(screen.getByLabelText('Advanced')).toBeInTheDocument();

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalled();
        });
    });

    it('captures PostHog search_executed event', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [] }),
        });

        renderSearchResults('Alice');
        expect(posthog.capture).toHaveBeenCalledWith('search_executed', {
            query: 'Alice',
            type: 'players',
        });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalled();
        });
    });

    it('displays player results when API returns matches', async () => {
        const mockPlayers = [
            {
                _id: 'p1',
                name: 'Alice Cooper',
                skillLevel: 'Intermediate',
                university: 'GMU',
                bio: 'Love playing singles!',
            },
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: mockPlayers }),
        });

        renderSearchResults('Alice');

        await waitFor(() => {
            expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
            expect(screen.getByText(/Intermediate • GMU/)).toBeInTheDocument();
            expect(screen.getByText('Love playing singles!')).toBeInTheDocument();
        });
    });

    it('displays no results found message when result set is empty', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: [] }),
        });

        renderSearchResults('NonExistentUser');

        await waitFor(() => {
            expect(screen.getByText('No results found for "NonExistentUser".')).toBeInTheDocument();
        });
    });

    it('switches search type to posts and renders post results', async () => {
        // First call for players
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ results: [] }),
        });

        renderSearchResults('Tournament');

        // Setup mock for posts
        const mockPosts = [
            {
                _id: 'post-1',
                title: 'Mock post result 1 for "Tournament"',
                content: 'Some content',
                authorName: 'User',
                timestamp: new Date().toISOString()
            }
        ];
        
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ results: mockPosts }),
        });

        const postsRadio = screen.getByLabelText('Posts');
        fireEvent.click(postsRadio);

        await waitFor(() => {
            expect(screen.getByText(/Mock post result 1 for "Tournament"/i)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('renders with semantic h1 and accessible landmarks', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ matches: [] }),
        });

        renderSearchResults('Badminton');

        // Verify primary h1 heading for screen readers
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('Search Results for "Badminton"');

        // Verify aside landmark for filters
        expect(screen.getByRole('complementary', { name: 'Search filters' })).toBeInTheDocument();

        // Verify main landmark for results
        expect(screen.getByRole('main', { name: 'Search results list' })).toBeInTheDocument();

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalled();
        });
    });

    it('filters player results by skill level and home university', async () => {
        const mockPlayers = [
            { _id: 'p1', name: 'Alice Beginner', skillLevel: 'Beginner', university: 'GMU' },
            { _id: 'p2', name: 'Bob Advanced', skillLevel: 'Advanced', university: 'VT' },
        ];

        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: mockPlayers }),
        });

        renderSearchResults('Player');

        await waitFor(() => {
            expect(screen.getByText('Alice Beginner')).toBeInTheDocument();
            expect(screen.getByText('Bob Advanced')).toBeInTheDocument();
        });

        // Filter by Beginner skill
        const beginnerCheckbox = screen.getByLabelText('Beginner');
        fireEvent.click(beginnerCheckbox);

        await waitFor(() => {
            expect(screen.getByText('Alice Beginner')).toBeInTheDocument();
            expect(screen.queryByText('Bob Advanced')).not.toBeInTheDocument();
        });

        // Also filter by VT university (should result in 0 matches because Alice is GMU)
        const vtCheckbox = screen.getByLabelText('VT');
        fireEvent.click(vtCheckbox);

        await waitFor(() => {
            expect(screen.queryByText('Alice Beginner')).not.toBeInTheDocument();
            expect(screen.queryByText('Bob Advanced')).not.toBeInTheDocument();
            expect(screen.getByText('No results found for "Player".')).toBeInTheDocument();
        });
    });
        });
