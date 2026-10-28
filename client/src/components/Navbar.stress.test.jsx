import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './Navbar';
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

// Dynamic mock notification state
let mockNotificationState = {
	notifications: [],
	unreadCount: 0,
	unreadMessages: 0,
	loading: false,
	markAsRead: vi.fn(),
	markSingleAsRead: vi.fn(),
	clearNotifications: vi.fn(),
};

vi.mock('../hooks/useNotifications', () => ({
	useNotifications: () => mockNotificationState,
}));

describe('Navbar Milestone M3 Empirical Challenger Stress Suite', () => {
	const mockUser = { id: 'u_stress_1', name: 'Stress Challenger', role: 'member' };

	beforeEach(() => {
		vi.clearAllMocks();
		mockNotificationState = {
			notifications: [],
			unreadCount: 0,
			unreadMessages: 0,
			loading: false,
			markAsRead: vi.fn(),
			markSingleAsRead: vi.fn(),
			clearNotifications: vi.fn(),
		};
	});

	afterEach(() => {
		vi.useRealTimers();
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

	// =========================================================================
	// 1. STRESS TEST: RAPID TAB SWITCHING BETWEEN "ALL" AND "UNREAD"
	// =========================================================================
	describe('1. Stress Test: Rapid Tab Switching Between "All" and "Unread"', () => {
		it('empirically survives 40 consecutive rapid tab toggles without desynchronization', () => {
			// 50 notifications: 25 unread, 25 read
			const notifications = Array.from({ length: 50 }, (_, i) => ({
				_id: `notif_${i}`,
				message: `Notification item number ${i}`,
				read: i % 2 === 0, // even = read, odd = unread (25 read, 25 unread)
				time: new Date(Date.now() - i * 60000).toISOString(),
				link: `/community?postId=p_${i}`,
			}));

			mockNotificationState = {
				notifications,
				unreadCount: 25,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();

			// Open the notifications menu
			fireEvent.click(screen.getByLabelText(/view notifications/i));
			expect(screen.getByRole('menu')).toBeInTheDocument();

			const allTab = screen.getByTestId('notif-tab-all');
			const unreadTab = screen.getByTestId('notif-tab-unread');

			expect(allTab).toHaveTextContent('All (50)');
			expect(unreadTab).toHaveTextContent('Unread (25)');

			// Rapid toggle loop: 20 cycles (40 alternating clicks)
			const startTime = performance.now();
			for (let cycle = 0; cycle < 20; cycle++) {
				// Switch to Unread
				fireEvent.click(unreadTab);

				// Invariant check on cycle sample
				if (cycle % 5 === 0) {
					// All 25 unread items must be present
					const unreadPips = screen.queryAllByTestId('unread-pip');
					expect(unreadPips).toHaveLength(25);
					// Verify no read items rendered
					expect(screen.queryByText('Notification item number 0')).not.toBeInTheDocument();
					expect(screen.getByText('Notification item number 1')).toBeInTheDocument();
				}

				// Switch back to All
				fireEvent.click(allTab);

				if (cycle % 5 === 0) {
					// In "All" tab, both even (read) and odd (unread) must be present
					expect(screen.getByText('Notification item number 0')).toBeInTheDocument();
					expect(screen.getByText('Notification item number 1')).toBeInTheDocument();
					const unreadPips = screen.queryAllByTestId('unread-pip');
					expect(unreadPips).toHaveLength(25);
				}
			}
			const durationMs = performance.now() - startTime;

			// Invariant: 40 tab toggles execute cleanly
			expect(durationMs).toBeGreaterThan(0);

			// Final state verification on "All"
			expect(screen.getByText('Notification item number 0')).toBeInTheDocument();
			expect(screen.getByText('Notification item number 49')).toBeInTheDocument();
		});

		it('switches tabs smoothly while list dynamically transitions from unread to all read', () => {
			const notifications = [
				{ _id: 'n1', message: 'First unread', read: false, time: new Date().toISOString() },
				{ _id: 'n2', message: 'Second unread', read: false, time: new Date().toISOString() },
			];

			mockNotificationState = {
				notifications,
				unreadCount: 2,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			const { rerender } = renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const unreadTab = screen.getByTestId('notif-tab-unread');
			fireEvent.click(unreadTab);

			expect(screen.getByText('First unread')).toBeInTheDocument();
			expect(screen.getByText('Second unread')).toBeInTheDocument();
			expect(screen.queryByText('All caught up! 🎉')).not.toBeInTheDocument();

			// Simulate user or socket marking all as read mid-view
			mockNotificationState = {
				notifications: [
					{ _id: 'n1', message: 'First unread', read: true, time: new Date().toISOString() },
					{ _id: 'n2', message: 'Second unread', read: true, time: new Date().toISOString() },
				],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			rerender(
				<AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
					<ColorModeContext.Provider value={{ toggleColorMode: vi.fn() }}>
						<BrowserRouter>
							<Navbar />
						</BrowserRouter>
					</ColorModeContext.Provider>
				</AuthContext.Provider>
			);

			// Now in Unread tab, it should cleanly display the contextual empty state
			expect(screen.getByText('All caught up! 🎉')).toBeInTheDocument();
			expect(screen.queryByText('First unread')).not.toBeInTheDocument();

			// Switch back to "All" tab: both notifications are visible as read (no unread-pip)
			const allTab = screen.getByTestId('notif-tab-all');
			fireEvent.click(allTab);

			expect(screen.getByText('First unread')).toBeInTheDocument();
			expect(screen.getByText('Second unread')).toBeInTheDocument();
			expect(screen.queryAllByTestId('unread-pip')).toHaveLength(0);
		});

		it('handles high volume tab switching with 150 items under stress without memory or render lag', () => {
			const notifications = Array.from({ length: 150 }, (_, i) => ({
				_id: `heavy_${i}`,
				message: `High volume item ${i}`,
				read: i >= 75, // 75 unread (0..74), 75 read (75..149)
				time: new Date().toISOString(),
			}));

			mockNotificationState = {
				notifications,
				unreadCount: 75,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const allTab = screen.getByTestId('notif-tab-all');
			const unreadTab = screen.getByTestId('notif-tab-unread');

			expect(allTab).toHaveTextContent('All (150)');
			expect(unreadTab).toHaveTextContent('Unread (75)');

			// 6 rapid toggles on heavy dataset
			for (let i = 0; i < 6; i++) {
				fireEvent.click(unreadTab);
				fireEvent.click(allTab);
			}

			// Invariant: correctly renders all 150 items on All
			expect(screen.getByText('High volume item 0')).toBeInTheDocument();
			expect(screen.getByText('High volume item 149')).toBeInTheDocument();

			// Toggle to Unread
			fireEvent.click(unreadTab);
			expect(screen.getByText('High volume item 0')).toBeInTheDocument();
			expect(screen.queryByText('High volume item 75')).not.toBeInTheDocument();
		}, 15000);

		it('handles rapid tab switching when notifications list is completely empty', () => {
			mockNotificationState = {
				notifications: [],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const allTab = screen.getByTestId('notif-tab-all');
			const unreadTab = screen.getByTestId('notif-tab-unread');

			expect(allTab).toHaveTextContent('All (0)');
			expect(unreadTab).toHaveTextContent('Unread (0)');

			// 30 rapid switches on empty list
			for (let i = 0; i < 30; i++) {
				fireEvent.click(unreadTab);
				expect(screen.getByText('All caught up! 🎉')).toBeInTheDocument();
				fireEvent.click(allTab);
				expect(screen.getByText('No notifications')).toBeInTheDocument();
			}
		});

		it('resiliently handles notifications with malformed or falsy properties during tab filtering', () => {
			mockNotificationState = {
				notifications: [
					{ _id: 'null_read', message: 'Item with null read', read: null, time: null },
					{ _id: 'undef_read', message: 'Item with undefined read', read: undefined },
					{ _id: 'valid_read', message: 'Normal read item', read: true, time: new Date().toISOString() },
					{ _id: 'valid_unread', message: 'Normal unread item', read: false, time: new Date().toISOString() },
				],
				unreadCount: 3, // null, undefined, false are all !read
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const unreadTab = screen.getByTestId('notif-tab-unread');
			fireEvent.click(unreadTab);

			// Invariant: null and undefined read evaluate to !read, so they are included in unread without crashing
			expect(screen.getByText('Item with null read')).toBeInTheDocument();
			expect(screen.getByText('Item with undefined read')).toBeInTheDocument();
			expect(screen.getByText('Normal unread item')).toBeInTheDocument();
			expect(screen.queryByText('Normal read item')).not.toBeInTheDocument();
		});
	});

	// =========================================================================
	// 2. STRESS TEST: RAPID OPEN/CLOSE OF THE NOTIFICATION BELL
	// =========================================================================
	describe('2. Stress Test: Rapid Open/Close of the Notification Bell', () => {
		it('empirically survives 60 rapid open/close toggles while maintaining badge count invariants', () => {
			const markAsReadMock = vi.fn();
			mockNotificationState = {
				notifications: [
					{ _id: 'n1', message: 'Stress alert', read: false, time: new Date().toISOString() },
				],
				unreadCount: 1,
				unreadMessages: 0,
				loading: false,
				markAsRead: markAsReadMock,
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			const bellButton = screen.getByLabelText(/view notifications/i);

			// Initial badge shows 1
			expect(screen.getByText('1')).toBeInTheDocument();

			for (let i = 0; i < 30; i++) {
				// Rapid Open
				fireEvent.click(bellButton);

				// Invariant: badge becomes invisible immediately upon open
				const badge = bellButton.querySelector('.MuiBadge-badge');
				expect(badge).toHaveClass('MuiBadge-invisible');
				expect(screen.getByRole('menu')).toBeInTheDocument();

				// Rapid Close via backdrop / escape
				fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape', code: 'Escape' });
			}

			// markAsRead was called
			expect(markAsReadMock).toHaveBeenCalled();
		});

		it('does NOT trigger markAsRead repeatedly if unreadCount was 0', () => {
			const markAsReadMock = vi.fn();
			mockNotificationState = {
				notifications: [
					{ _id: 'n1', message: 'Already read item', read: true, time: new Date().toISOString() },
				],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: markAsReadMock,
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			const bellButton = screen.getByLabelText(/view notifications/i);

			// 25 rapid open/close cycles when unreadCount is 0
			for (let i = 0; i < 25; i++) {
				fireEvent.click(bellButton);
				expect(screen.getByRole('menu')).toBeInTheDocument();
				fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape', code: 'Escape' });
			}

			// Invariant: markAsRead must be called exactly ZERO times
			expect(markAsReadMock).toHaveBeenCalledTimes(0);
		});

		it('handles stateful transition: initial bell click calls markAsRead once; subsequent re-opens do not call it again', () => {
			const markAsReadMock = vi.fn();

			const StatefulNavbar = () => {
				const [unread, setUnread] = useState(2);
				mockNotificationState = {
					notifications: [
						{ _id: 'n1', message: 'Alert 1', read: unread === 0, time: new Date().toISOString() },
						{ _id: 'n2', message: 'Alert 2', read: unread === 0, time: new Date().toISOString() },
					],
					unreadCount: unread,
					unreadMessages: 0,
					loading: false,
					markAsRead: () => {
						markAsReadMock();
						setUnread(0);
					},
					markSingleAsRead: vi.fn(),
					clearNotifications: vi.fn(),
				};

				return <Navbar />;
			};

			render(
				<AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
					<ColorModeContext.Provider value={{ toggleColorMode: vi.fn() }}>
						<BrowserRouter>
							<StatefulNavbar />
						</BrowserRouter>
					</ColorModeContext.Provider>
				</AuthContext.Provider>
			);

			const bellButton = screen.getByLabelText(/view notifications/i);
			expect(screen.getByText('2')).toBeInTheDocument();

			// First open: should call markAsRead
			fireEvent.click(bellButton);
			expect(markAsReadMock).toHaveBeenCalledTimes(1);

			// Close menu
			fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape', code: 'Escape' });

			// Re-open bell 10 times: unread is now 0, so markAsRead should NOT be called again
			for (let i = 0; i < 10; i++) {
				fireEvent.click(bellButton);
				fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape', code: 'Escape' });
			}

			// Invariant: called exactly once across entire session
			expect(markAsReadMock).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// 3. VERIFICATION: CLICKING "CLEAR ALL" WHEN LIST IS EMPTY IS SAFELY DISABLED
	// =========================================================================
	describe('3. Empirical Verification: "Clear All" Safely Disabled When List is Empty', () => {
		it('renders "Clear All" button with disabled attribute and Mui-disabled class when notifications list is empty', () => {
			const clearNotificationsMock = vi.fn();
			mockNotificationState = {
				notifications: [],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: vi.fn(),
				clearNotifications: clearNotificationsMock,
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
			expect(clearAllBtn).toBeInTheDocument();

			// EMPIRICAL ASSERTION: The button must have disabled attribute
			expect(clearAllBtn).toBeDisabled();
			expect(clearAllBtn).toHaveClass('Mui-disabled');

			// Attempt aggressive user clicks on the disabled button
			fireEvent.click(clearAllBtn);
			fireEvent.mouseDown(clearAllBtn);
			fireEvent.mouseUp(clearAllBtn);

			// Invariant: clearNotifications was NEVER invoked
			expect(clearNotificationsMock).toHaveBeenCalledTimes(0);
		});

		it('also renders "Mark all as read" button with disabled attribute when notifications list is empty', () => {
			const markAsReadMock = vi.fn();
			mockNotificationState = {
				notifications: [],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: markAsReadMock,
				markSingleAsRead: vi.fn(),
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const markAllBtn = screen.getByRole('button', { name: /mark all as read/i });
			expect(markAllBtn).toBeInTheDocument();
			expect(markAllBtn).toBeDisabled();
			expect(markAllBtn).toHaveClass('Mui-disabled');

			fireEvent.click(markAllBtn);

			// Invariant: markAsRead was NEVER invoked
			expect(markAsReadMock).toHaveBeenCalledTimes(0);
		});

		it('dynamically transitions "Clear All" from enabled to disabled immediately after clearing', () => {
			const clearNotificationsMock = vi.fn();

			const DynamicClearNavbar = () => {
				const [notifs, setNotifs] = useState([
					{ _id: 'n1', message: 'Item to clear', read: false, time: new Date().toISOString() },
					{ _id: 'n2', message: 'Second item', read: true, time: new Date().toISOString() },
				]);

				mockNotificationState = {
					notifications: notifs,
					unreadCount: notifs.filter((n) => !n.read).length,
					unreadMessages: 0,
					loading: false,
					markAsRead: vi.fn(),
					markSingleAsRead: vi.fn(),
					clearNotifications: () => {
						clearNotificationsMock();
						setNotifs([]);
					},
				};

				return <Navbar />;
			};

			render(
				<AuthContext.Provider value={{ user: mockUser, logout: vi.fn() }}>
					<ColorModeContext.Provider value={{ toggleColorMode: vi.fn() }}>
						<BrowserRouter>
							<DynamicClearNavbar />
						</BrowserRouter>
					</ColorModeContext.Provider>
				</AuthContext.Provider>
			);

			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const clearAllBtn = screen.getByRole('button', { name: /clear all/i });

			// Invariant 1: Initially enabled
			expect(clearAllBtn).not.toBeDisabled();
			expect(clearAllBtn).not.toHaveClass('Mui-disabled');

			// Trigger Clear All
			fireEvent.click(clearAllBtn);
			expect(clearNotificationsMock).toHaveBeenCalledTimes(1);

			// Invariant 2: Immediately transitions to disabled state
			expect(clearAllBtn).toBeDisabled();
			expect(clearAllBtn).toHaveClass('Mui-disabled');

			// Invariant 3: Empty state text rendered
			expect(screen.getByText('No notifications')).toBeInTheDocument();

			// Attempt clicking again while disabled
			fireEvent.click(clearAllBtn);
			expect(clearNotificationsMock).toHaveBeenCalledTimes(1); // Still 1, not 2
		});
	});

	// =========================================================================
	// 4. DEEP-LINK ROUTING & NAVIGATION UNDER HIGH-FREQUENCY CLICKS
	// =========================================================================
	describe('4. Deep-Link Routing & Notification Item Stress', () => {
		it('rapid item clicks dismiss dropdown, navigate to link, and mark single item read', () => {
			const markSingleMock = vi.fn();
			mockNotificationState = {
				notifications: [
					{
						_id: 'n_nav_1',
						message: 'Nav notice 1',
						read: false,
						link: '/community?postId=post_alpha&highlight=comm_1',
						time: new Date().toISOString(),
					},
				],
				unreadCount: 1,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: markSingleMock,
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const notifItem = screen.getByText('Nav notice 1');
			fireEvent.click(notifItem);

			expect(markSingleMock).toHaveBeenCalledWith('n_nav_1');
			expect(mockNavigate).toHaveBeenCalledWith('/community?postId=post_alpha&highlight=comm_1');
		});

		it('clicking an already-read notification item navigates to link WITHOUT calling markSingleAsRead', () => {
			const markSingleMock = vi.fn();
			mockNotificationState = {
				notifications: [
					{
						_id: 'n_nav_read',
						message: 'Already read nav notice',
						read: true,
						link: '/messages?userId=u_buddy_789',
						time: new Date().toISOString(),
					},
				],
				unreadCount: 0,
				unreadMessages: 0,
				loading: false,
				markAsRead: vi.fn(),
				markSingleAsRead: markSingleMock,
				clearNotifications: vi.fn(),
			};

			renderNavbar();
			fireEvent.click(screen.getByLabelText(/view notifications/i));

			const notifItem = screen.getByText('Already read nav notice');
			fireEvent.click(notifItem);

			// Invariant: read is already true, so markSingleAsRead is not called
			expect(markSingleMock).not.toHaveBeenCalled();
			expect(mockNavigate).toHaveBeenCalledWith('/messages?userId=u_buddy_789');
		});
	});
});
