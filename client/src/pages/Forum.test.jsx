import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// Mock the API fetch utility
vi.mock('../utils/api', () => ({
    default: vi.fn()
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
        // Setup default intersection observer
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;
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

    it('renders the 3-tab navigation system and trending topic chips', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        expect(screen.getByRole('tab', { name: /For You/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Top/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Latest/i })).toBeInTheDocument();
        expect(screen.getByText('#Tournament')).toBeInTheDocument();
        expect(screen.getByText('#RAC')).toBeInTheDocument();
    });

    it('opens Create Post modal with category selector and Phase 2 options', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        const createBtn = screen.getByRole('button', { name: /Create New Post/i });
        createBtn.click();

        await waitFor(() => {
            expect(screen.getByText('Create a Post')).toBeInTheDocument();
            expect(screen.getByText('Category')).toBeInTheDocument();
            expect(screen.getByText(/General Discussion/i)).toBeInTheDocument();
        });
    });

    it('renders post search bar, category group filter chips, and date range selector', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        expect(screen.getByPlaceholderText(/Search posts by title, author, court, tags/i)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Filter by date range/i })).toBeInTheDocument();
        expect(screen.getByText('Finding Players')).toBeInTheDocument();
        expect(screen.getByText('Finding Matches')).toBeInTheDocument();
        expect(screen.getByText('Q&A Forums')).toBeInTheDocument();
        expect(screen.getByText('Gear Exchange')).toBeInTheDocument();
        expect(screen.getByText('Match Scorecards')).toBeInTheDocument();
        expect(screen.getByText('Training & Tips')).toBeInTheDocument();
    });

    it('focuses search input on pressing "/" keyboard shortcut', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        expect(document.activeElement).not.toBe(searchInput);

        fireEvent.keyDown(window, { key: '/' });
        expect(document.activeElement).toBe(searchInput);
    });

    it('updates query param and feed when category group chip is clicked', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const findPlayersChip = screen.getByText('Finding Players');
        fireEvent.click(findPlayersChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('category=find_partner'));
        });
    });

    it('updates query param and feed when date range is changed', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
        fireEvent.mouseDown(dateSelect);

        const todayOption = await screen.findByRole('option', { name: /Today/i });
        fireEvent.click(todayOption);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('dateRange=today'));
        });
    });

    it('renders custom date range inputs when Custom Range is selected', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();

        const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
        fireEvent.mouseDown(dateSelect);

        const customOption = await screen.findByRole('option', { name: /Custom Range/i });
        fireEvent.click(customOption);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('dateRange=custom'));
        });
    });

    it('handles Enter key in search input to trigger immediate search', async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ feed: [], hasMore: false })
        });

        renderWithProviders();
        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);

        fireEvent.change(searchInput, { target: { value: 'smash' } });
        fireEvent.keyDown(searchInput, { key: 'Enter' });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('search=smash'));
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

        renderWithProviders();

        await waitFor(() => {
            expect(screen.getByText('Casual rally this Friday')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search posts by title, author, court, tags/i);
        fireEvent.change(searchInput, { target: { value: 'nonexistenttermxyz' } });

        await waitFor(() => {
            expect(screen.getByText(/No posts match "nonexistenttermxyz"./i)).toBeInTheDocument();
        });

        const clearBtn = screen.getByText('Clear Search');
        fireEvent.click(clearBtn);

        await waitFor(() => {
            expect(screen.getByText('Casual rally this Friday')).toBeInTheDocument();
        });
    });
});
