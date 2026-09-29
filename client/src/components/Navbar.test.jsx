import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './Navbar';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { ColorModeContext } from '../App';

// Mock apiFetch
vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
        i18n: { changeLanguage: vi.fn(), language: 'en' },
    }),
}));

// Mock useNotifications hook
vi.mock('../hooks/useNotifications', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: 0,
        unreadMessages: 0,
        markAsRead: vi.fn(),
        markSingleAsRead: vi.fn(),
        clearNotifications: vi.fn(),
    }),
}));

// Mock LanguageSwitcher
vi.mock('./LanguageSwitcher', () => ({
    default: () => <div data-testid="language-switcher">Lang</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Navbar Component & Global Search UI', () => {
    const mockUser = { id: 'u1', name: 'John Doe', role: 'member' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderNavbar = (user = mockUser) => {
        return render(
            <AuthContext.Provider value={{ user, logout: vi.fn() }}>
                <ColorModeContext.Provider value={{ toggleColorMode: vi.fn() }}>
                    <BrowserRouter>
                        <Navbar />
                    </BrowserRouter>
                </ColorModeContext.Provider>
            </AuthContext.Provider>
        );
    };

    it('renders the brand title and global search input', () => {
        renderNavbar();
        expect(screen.getByText('GMU Badminton')).toBeInTheDocument();
        const searchInput = screen.getByPlaceholderText('Search players...');
        expect(searchInput).toBeInTheDocument();
    });

    it('fetches player search results after typing', async () => {
        const mockMatches = [
            { _id: 'player-1', name: 'Alice Smith', profilePic: '' },
            { _id: 'player-2', name: 'Bob Jones', profilePic: '' },
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: mockMatches }),
        });

        renderNavbar();
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: 'Alice' } });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/search?q=Alice');
        }, { timeout: 1500 });

        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });
    });

    it('does not trigger API call when input is empty or whitespace', async () => {
        renderNavbar();
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: '   ' } });

        // Wait to verify no call was made
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('navigates to player profile when an option is clicked', async () => {
        const mockMatches = [
            { _id: 'player-1', name: 'Alice Smith', profilePic: '' },
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: mockMatches }),
        });

        renderNavbar();
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: 'Alice' } });

        await waitFor(() => {
            expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Alice Smith'));

        expect(mockNavigate).toHaveBeenCalledWith('/profile/player-1');
    });

    it('navigates to search page when Enter is pressed with a valid query', () => {
        renderNavbar();
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: 'Alice' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

        expect(mockNavigate).toHaveBeenCalledWith('/search?q=Alice');
    });

    it('does not navigate when Enter is pressed with whitespace or empty query', () => {
        renderNavbar();
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: '   ' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('renders with accessible ARIA attributes and responsive mobile search button', () => {
        renderNavbar();

        // Search input is rendered with accessible placeholder
        const searchInput = screen.getByPlaceholderText('Search players...');
        expect(searchInput).toBeInTheDocument();

        // Hamburger button has accessible open navigation menu label and controls
        const hamburgerBtn = screen.getByLabelText('Open navigation menu');
        expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
        expect(hamburgerBtn).toHaveAttribute('aria-controls', 'mobile-menu');

        // Responsive mobile search button is available
        const mobileSearchBtn = screen.getByRole('link', { name: 'Search' });
        expect(mobileSearchBtn).toBeInTheDocument();
        expect(mobileSearchBtn).toHaveAttribute('href', '/search');
    });
});

