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

let mockNotificationState = {
    notifications: [],
    unreadCount: 0,
    unreadMessages: 0,
    markAsRead: vi.fn(),
    markSingleAsRead: vi.fn(),
    clearNotifications: vi.fn(),
};

// Mock useNotifications hook
vi.mock('../hooks/useNotifications', () => ({
    useNotifications: () => mockNotificationState,
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
        mockNotificationState = {
            notifications: [],
            unreadCount: 0,
            unreadMessages: 0,
            markAsRead: vi.fn(),
            markSingleAsRead: vi.fn(),
            clearNotifications: vi.fn(),
        };
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

    it('appends searcherHomeUniversity when user has university', async () => {
        const mockMatches = [
            { _id: 'player-1', name: 'Alice Smith', profilePic: '' },
        ];
        apiFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ results: mockMatches }),
        });

        renderNavbar({ id: 'u2', name: 'Bob', university: 'GMU' });
        const searchInput = screen.getByPlaceholderText('Search players...');
        fireEvent.change(searchInput, { target: { value: 'Alice' } });

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/search?q=Alice&searcherHomeUniversity=GMU');
        }, { timeout: 1500 });
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

    it('does not render the Leaderboard navigation link', () => {
        renderNavbar();

        expect(screen.queryByRole('link', { name: 'Leaderboard' })).not.toBeInTheDocument();
    });

    describe('Milestone M3: Notification Bell, Dropdown UX & Filtering', () => {
        it('renders notification bell with correct initial unread count badge', () => {
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'First unread', read: false, time: new Date().toISOString() },
                    { _id: 'n2', message: 'Second unread', read: false, time: new Date().toISOString() },
                    { _id: 'n3', message: 'Third unread', read: false, time: new Date().toISOString() },
                ],
                unreadCount: 3,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            const notifButton = screen.getByLabelText(/view notifications/i);
            expect(notifButton).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('clicking notification bell immediately clears unread badge to 0 and calls markAsRead', () => {
            const markAsReadMock = vi.fn();
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Alert 1', read: false, time: new Date().toISOString() },
                    { _id: 'n2', message: 'Alert 2', read: false, time: new Date().toISOString() },
                ],
                unreadCount: 2,
                unreadMessages: 0,
                markAsRead: markAsReadMock,
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            expect(screen.getByText('2')).toBeInTheDocument();

            const notifButton = screen.getByLabelText(/view notifications/i);
            fireEvent.click(notifButton);

            // Mark as read was called asynchronously
            expect(markAsReadMock).toHaveBeenCalledTimes(1);

            // Badge counter is immediately hidden via badgeContent={notifOpen ? 0 : unreadCount}
            const badge = screen.getByLabelText(/view notifications/i).querySelector('.MuiBadge-badge');
            expect(badge).toHaveClass('MuiBadge-invisible');
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('does not trigger markAsRead if unreadCount is 0 when opening bell', () => {
            const markAsReadMock = vi.fn();
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Already read item', read: true, time: new Date().toISOString() },
                ],
                unreadCount: 0,
                unreadMessages: 0,
                markAsRead: markAsReadMock,
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            const notifButton = screen.getByLabelText(/view notifications/i);
            fireEvent.click(notifButton);

            expect(markAsReadMock).not.toHaveBeenCalled();
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('segmented tabs "All" and "Unread" toggle correctly and filter displayed items', () => {
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Unread notice', read: false, time: new Date().toISOString() },
                    { _id: 'n2', message: 'Read notice', read: true, time: new Date().toISOString() },
                ],
                unreadCount: 1,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            // Default "All" tab displays both
            expect(screen.getByText('Unread notice')).toBeInTheDocument();
            expect(screen.getByText('Read notice')).toBeInTheDocument();

            // Toggle to "Unread" tab
            const unreadTab = screen.getByTestId('notif-tab-unread');
            fireEvent.click(unreadTab);

            // Unread item remains visible, read item is filtered out
            expect(screen.getByText('Unread notice')).toBeInTheDocument();
            expect(screen.queryByText('Read notice')).not.toBeInTheDocument();

            // Toggle back to "All" tab
            const allTab = screen.getByTestId('notif-tab-all');
            fireEvent.click(allTab);

            // Both items visible again
            expect(screen.getByText('Unread notice')).toBeInTheDocument();
            expect(screen.getByText('Read notice')).toBeInTheDocument();
        });

        it('unread items have distinct visual styling with circular indicator pip', () => {
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Active unread notice', read: false, time: new Date().toISOString() },
                    { _id: 'n2', message: 'Finished read notice', read: true, time: new Date().toISOString() },
                ],
                unreadCount: 1,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            // Only one unread pip rendered
            const pips = screen.getAllByTestId('unread-pip');
            expect(pips).toHaveLength(1);

            const unreadItem = screen.getByLabelText(/unread: active unread notice/i);
            expect(unreadItem).toBeInTheDocument();
            expect(unreadItem.querySelector('[data-testid="unread-pip"]')).toBeInTheDocument();

            const readItem = screen.getByLabelText(/read: finished read notice/i);
            expect(readItem).toBeInTheDocument();
            expect(readItem.querySelector('[data-testid="unread-pip"]')).toBeNull();
        });

        it('"Mark all as read" bulk action triggers markAsRead', () => {
            const markAsReadMock = vi.fn();
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Item 1', read: false, time: new Date().toISOString() },
                ],
                unreadCount: 1,
                unreadMessages: 0,
                markAsRead: markAsReadMock,
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));
            markAsReadMock.mockClear(); // Reset bell click invocation

            const markAllBtn = screen.getByRole('button', { name: /mark all as read/i });
            fireEvent.click(markAllBtn);

            expect(markAsReadMock).toHaveBeenCalledTimes(1);
        });

        it('"Clear All" bulk action triggers clearNotifications', () => {
            const clearNotificationsMock = vi.fn();
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Item to clear', read: false, time: new Date().toISOString() },
                ],
                unreadCount: 1,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: clearNotificationsMock,
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
            fireEvent.click(clearAllBtn);

            expect(clearNotificationsMock).toHaveBeenCalledTimes(1);
        });

        it('clicking a notification item closes the menu, navigates to link, and marks single item as read', () => {
            const markSingleMock = vi.fn();
            mockNotificationState = {
                notifications: [
                    {
                        _id: 'notif-456',
                        message: 'Alice commented on your post',
                        read: false,
                        link: '/community?postId=post123&highlight=comment789',
                        time: new Date().toISOString(),
                    },
                ],
                unreadCount: 1,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: markSingleMock,
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            const notifItem = screen.getByText('Alice commented on your post');
            fireEvent.click(notifItem);

            expect(markSingleMock).toHaveBeenCalledWith('notif-456');
            expect(mockNavigate).toHaveBeenCalledWith('/community?postId=post123&highlight=comment789');
        });

        it('contextual empty states render when there are no notifications ("All caught up" vs "No notifications")', () => {
            mockNotificationState = {
                notifications: [],
                unreadCount: 0,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            // In "All" tab when notifications array is empty
            expect(screen.getByText('No notifications')).toBeInTheDocument();

            // Switch to "Unread" tab
            const unreadTab = screen.getByTestId('notif-tab-unread');
            fireEvent.click(unreadTab);

            // In "Unread" tab when unread is empty
            expect(screen.getByText('All caught up! 🎉')).toBeInTheDocument();
        });

        it('renders "All caught up! 🎉" in Unread tab when all existing notifications are already read', () => {
            mockNotificationState = {
                notifications: [
                    { _id: 'n1', message: 'Old read message', read: true, time: new Date().toISOString() },
                ],
                unreadCount: 0,
                unreadMessages: 0,
                markAsRead: vi.fn(),
                markSingleAsRead: vi.fn(),
                clearNotifications: vi.fn(),
            };
            renderNavbar();

            fireEvent.click(screen.getByLabelText(/view notifications/i));

            // In "All" tab, the read notification is displayed
            expect(screen.getByText('Old read message')).toBeInTheDocument();

            // Switch to "Unread" tab
            const unreadTab = screen.getByTestId('notif-tab-unread');
            fireEvent.click(unreadTab);

            // Read item is hidden, empty state is displayed
            expect(screen.queryByText('Old read message')).not.toBeInTheDocument();
            expect(screen.getByText('All caught up! 🎉')).toBeInTheDocument();
        });
    });
});
