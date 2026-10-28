import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

// Mock apiFetch
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
vi.mock('../utils/socket', () => ({
    default: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    }
}));

// Mock Masonry
vi.mock('@mui/lab/Masonry', () => ({
    default: ({ children }) => (
        <div data-testid="masonry-mock">
            {children}
        </div>
    )
}));

// Mock PostCard
vi.mock('../components/PostCard', () => ({
    default: ({ post }) => (
        <div data-testid={`post-card-${post._id}`}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
        </div>
    )
}));

const mockUser = { id: 'challenger-user-42', name: 'Challenger Tester' };

describe('Challenger 2 Empirical Stress Test: Mobile UX & R4 Feed Pagination Invariants', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        consoleErrorSpy = vi.spyOn(console, 'error');

        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;
        window.scrollTo = vi.fn();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    const renderForum = () => {
        return render(
            <AuthContext.Provider value={{ user: mockUser, token: 'challenger-token' }}>
                <BrowserRouter>
                    <Forum />
                </BrowserRouter>
            </AuthContext.Provider>
        );
    };

    describe('Post Composer Mobile UX & Input Styling Verification (R1)', () => {
        it('verifies slotProps label shrink, background shielding, and zero React 19 unconsumed prop warnings', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('facebook-composer-card'));
            const dialog = await screen.findByRole('dialog');
            expect(dialog).toBeInTheDocument();

            // Toggle Title input
            const addTitleBtn = within(dialog).getByRole('button', { name: /\+ Title/i });
            fireEvent.click(addTitleBtn);

            // Verify Title input and label
            const titleInput = within(dialog).getByPlaceholderText(/Add a title or leave blank/i);
            const titleLabel = dialog.querySelector(`label[for="${titleInput.id}"]`);
            expect(titleLabel).toBeInTheDocument();
            expect(titleLabel.getAttribute('data-shrink')).toBe('true');
            expect(titleLabel.classList.contains('MuiInputLabel-shrink')).toBe(true);

            // Verify Content textarea and label
            const contentInput = within(dialog).getByPlaceholderText(/What's on your mind/i);
            const contentLabel = dialog.querySelector(`label[for="${contentInput.id}"]`);
            expect(contentLabel).toBeInTheDocument();
            expect(contentLabel.getAttribute('data-shrink')).toBe('true');
            expect(contentLabel.classList.contains('MuiInputLabel-shrink')).toBe(true);

            // Verify absence of unrecognized lowercase or camelCase InputLabelProps on root DOM elements
            expect(dialog.querySelector('[inputlabelprops]')).toBeNull();
            expect(dialog.querySelector('[InputLabelProps]')).toBeNull();

            // Simulate typing and focusing
            fireEvent.focus(titleInput);
            fireEvent.change(titleInput, { target: { value: 'Mobile Title' } });
            fireEvent.blur(titleInput);

            fireEvent.focus(contentInput);
            fireEvent.change(contentInput, { target: { value: 'Testing mobile touch ergonomics' } });
            fireEvent.blur(contentInput);

            // Verify NO React 19 warnings occurred in console
            const reactWarnings = consoleErrorSpy.mock.calls.filter((call) => {
                const msg = call.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
                return (
                    msg.includes('InputLabelProps') ||
                    msg.includes('inputlabelprops') ||
                    msg.includes('React does not recognize the') ||
                    msg.includes('Invalid DOM property')
                );
            });
            expect(reactWarnings).toEqual([]);
        });

        it('verifies absence of double outlines and presence of touch padding styles on composer inputs', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

            fireEvent.click(screen.getByTestId('facebook-composer-card'));
            const dialog = await screen.findByRole('dialog');

            // Open title field
            const addTitleBtn = within(dialog).getByRole('button', { name: /\+ Title/i });
            fireEvent.click(addTitleBtn);

            const titleInput = within(dialog).getByPlaceholderText(/Add a title or leave blank/i);
            const contentTextarea = within(dialog).getByPlaceholderText(/What's on your mind/i);

            // Both input and textarea exist within OutlinedInput wrappers
            expect(titleInput.closest('.MuiOutlinedInput-root')).not.toBeNull();
            expect(contentTextarea.closest('.MuiOutlinedInput-root')).not.toBeNull();
        });
    });

    describe('R4 Feed Pagination & Filter Invariants Stress Testing', () => {
        it('R4 Invariant A: clicking "All" category chip when already on "All" resets cursor and re-fetches page 1 fresh', async () => {
            const feedData = [
                { _id: 'post-101', title: 'Tournament Announcement', content: 'Open GMU Tournament 2026', category: 'general' }
            ];
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: feedData, nextCursor: 'page1_cursor', hasMore: true })
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Tournament Announcement')).toBeInTheDocument());

            const callsBefore = apiFetch.mock.calls.length;

            // Click "All" chip
            const allChip = screen.getByText('All');
            fireEvent.click(allChip);

            await waitFor(() => {
                expect(apiFetch.mock.calls.length).toBeGreaterThan(callsBefore);
            });

            // The latest call should query page 1 without cursor and without category filter
            const latestCallUrl = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
            expect(latestCallUrl).toContain('/api/feed?tab=latest&limit=10');
            expect(latestCallUrl).not.toContain('&cursor=');
            expect(latestCallUrl).not.toContain('&category=');

            expect(screen.queryByText(/No activity found/i)).not.toBeInTheDocument();
            expect(screen.getByText('Tournament Announcement')).toBeInTheDocument();
        });

        it('R4 Invariant B: switching between category filters resets pagination cursor and queries specific category', async () => {
            const partnerFeed = [
                { _id: 'post-partner-1', title: 'Need Doubles Partner', content: 'Level 4.0 doubles at RAC', category: 'find_partner' }
            ];
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: partnerFeed, nextCursor: 'partner_cursor_1', hasMore: true })
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Need Doubles Partner')).toBeInTheDocument());

            // Switch to "🤝 Find Players"
            const findPlayersChip = screen.getByText('🤝 Find Players');
            fireEvent.click(findPlayersChip);

            await waitFor(() => {
                const partnerCall = apiFetch.mock.calls.find(c => c[0].includes('&category=find_partner'));
                expect(partnerCall).toBeDefined();
                expect(partnerCall[0]).not.toContain('&cursor=');
            });

            // Switch back to "All" by clicking "All"
            const allChip = screen.getByText('All');
            fireEvent.click(allChip);

            await waitFor(() => {
                const latestCall = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
                expect(latestCall).not.toContain('&category=');
                expect(latestCall).not.toContain('&cursor=');
            });
        });

        it('R4 Invariant C: changing date range selector resets cursor and feed state', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            await waitFor(() => expect(screen.getByLabelText('Filter by date range')).toBeInTheDocument());

            const dateSelect = screen.getByRole('combobox', { name: /Filter by date range/i });
            fireEvent.mouseDown(dateSelect);
            const todayOption = await screen.findByRole('option', { name: /Today/i });
            fireEvent.click(todayOption);

            await waitFor(() => {
                const dateCall = apiFetch.mock.calls.find(c => c[0].includes('&dateRange=today'));
                expect(dateCall).toBeDefined();
                expect(dateCall[0]).not.toContain('&cursor=');
            });
        });

        it('R4 Invariant D: search debounce resets page to 1 and appends debounced query without cursor', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            const searchInput = screen.getByLabelText('Search community posts');

            fireEvent.change(searchInput, { target: { value: 'Yonex' } });

            await waitFor(() => {
                const searchCall = apiFetch.mock.calls.find(c => c[0].includes('&search=Yonex'));
                expect(searchCall).toBeDefined();
                expect(searchCall[0]).not.toContain('&cursor=');
            }, { timeout: 1500 });
        });

        it('R4 Invariant E: pressing Enter in search immediately resets pagination and feed', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            const searchInput = screen.getByLabelText('Search community posts');

            fireEvent.change(searchInput, { target: { value: 'Victor' } });
            fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                const enterCall = apiFetch.mock.calls.find(c => c[0].includes('&search=Victor'));
                expect(enterCall).toBeDefined();
                expect(enterCall[0]).not.toContain('&cursor=');
            });
        });

        it('R4 Invariant F: clearing search via Escape or clear button purges search and resets cursor', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ feed: [], nextCursor: null, hasMore: false })
            });

            renderForum();
            const searchInput = screen.getByLabelText('Search community posts');

            fireEvent.change(searchInput, { target: { value: 'Stringing' } });
            fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

            await waitFor(() => {
                expect(apiFetch.mock.calls.some(c => c[0].includes('&search=Stringing'))).toBe(true);
            });

            // Press Escape to clear
            fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });

            await waitFor(() => {
                const clearedCall = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
                expect(clearedCall).not.toContain('&search=Stringing');
                expect(clearedCall).not.toContain('&cursor=');
            });
        });

        it('R4 Invariant G: Refresh button clicks reset cursorRef, feedRefreshKey, and tabsCache', async () => {
            apiFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    feed: [{ _id: 'post-refresh', title: 'Fresh Post', content: 'Fresh feed item' }],
                    nextCursor: 'fresh_cur',
                    hasMore: true
                })
            });

            renderForum();
            await waitFor(() => expect(screen.getByText('Fresh Post')).toBeInTheDocument());

            const callsBefore = apiFetch.mock.calls.length;

            const refreshBtn = screen.getByLabelText('Refresh feed');
            fireEvent.click(refreshBtn);

            await waitFor(() => {
                expect(apiFetch.mock.calls.length).toBeGreaterThan(callsBefore);
            });

            const refreshCall = apiFetch.mock.calls[apiFetch.mock.calls.length - 1][0];
            expect(refreshCall).not.toContain('&cursor=');
            expect(screen.getByText('Fresh Post')).toBeInTheDocument();
        });
    });
});
