import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import { ForumRedirect } from '../App';

// Hoisted socket mock
const { mockSocketListeners, mockSocketInstance } = vi.hoisted(() => {
	const listeners = {};
	const instance = {
		emit: vi.fn(),
		on: vi.fn((event, cb) => {
			listeners[event] = cb;
		}),
		off: vi.fn((event, cb) => {
			if (cb && listeners[event] === cb) {
				delete listeners[event];
			} else if (!cb) {
				delete listeners[event];
			}
		}),
	};
	return { mockSocketListeners: listeners, mockSocketInstance: instance };
});

vi.mock('../utils/socket', () => ({
	default: mockSocketInstance,
}));

const mockSetToastMessage = vi.fn();
let mockUser = { _id: 'user_123', id: 'user_123', name: 'Test User' };
vi.mock('../context/AuthContext', () => ({
	useAuth: () => ({
		user: mockUser,
		setToastMessage: mockSetToastMessage,
	}),
}));

vi.mock('../utils/api', () => ({
	default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
	toast: vi.fn(),
}));

import apiFetch from '../utils/api';
import { toast } from 'react-hot-toast';

describe('useNotifications hook', () => {
	const initialNotifs = [
		{ _id: 'n1', targetUserId: 'user_123', message: 'Comment on your post', read: false, time: '2026-10-28T01:00:00Z' },
		{ _id: 'n2', targetUserId: 'user_123', message: 'Alice liked your post', read: true, time: '2026-10-28T00:50:00Z' },
		{ _id: 'n3', targetUserId: 'user_123', message: 'Bob challenged you', read: false, time: '2026-10-28T00:40:00Z' },
	];

	const initialChats = [
		{ _id: 'c1', friend: { _id: 'u2', name: 'Charlie' }, unreadCount: 2 },
		{ _id: 'c2', friend: { _id: 'u3', name: 'Dave' }, unreadCount: 1 },
	];

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem('accessToken', 'mock-token');
		mockUser = { _id: 'user_123', id: 'user_123', name: 'Test User' };

		apiFetch.mockImplementation(async (url) => {
			if (url === '/api/forum/notifications/user_123') {
				return {
					ok: true,
					json: async () => JSON.parse(JSON.stringify(initialNotifs)),
				};
			}
			if (url === '/api/messages/recent/user_123') {
				return {
					ok: true,
					json: async () => JSON.parse(JSON.stringify(initialChats)),
				};
			}
			return {
				ok: true,
				json: async () => ({ success: true }),
			};
		});
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('fetches initial notifications and computes unreadCount and unreadMessages', async () => {
		const { result } = renderHook(() => useNotifications());

		// Initially loading
		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(mockSocketInstance.emit).toHaveBeenCalledWith('joinUserRoom', 'user_123');
		expect(result.current.notifications).toHaveLength(3);
		expect(result.current.unreadCount).toBe(2);
		expect(result.current.unreadMessages).toBe(3);
	});

	it('handles incoming socket newNotification: prepends item, deduplicates by _id, increments unreadCount, and fires toast', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.notifications).toHaveLength(3);
		});

		// 1. Receive new unread notification
		act(() => {
			mockSocketListeners['newNotification']({
				_id: 'n4',
				targetUserId: 'user_123',
				message: 'New match challenge received',
				read: false,
			});
		});

		expect(result.current.notifications).toHaveLength(4);
		expect(result.current.notifications[0]._id).toBe('n4');
		expect(result.current.unreadCount).toBe(3);
		expect(toast).toHaveBeenCalledWith('New match challenge received', { icon: '🔔' });

		// 2. Receive duplicate notification with same _id (should update, not duplicate)
		act(() => {
			mockSocketListeners['newNotification']({
				_id: 'n4',
				targetUserId: 'user_123',
				message: 'New match challenge received (updated)',
				read: false,
			});
		});

		expect(result.current.notifications).toHaveLength(4);
		expect(result.current.notifications[0].message).toBe('New match challenge received (updated)');
		expect(result.current.unreadCount).toBe(3);

		// 3. Ignore notification for another user
		act(() => {
			mockSocketListeners['newNotification']({
				_id: 'n5',
				targetUserId: 'other_user_999',
				message: 'Not for this user',
				read: false,
			});
		});

		expect(result.current.notifications).toHaveLength(4);
	});

	it('handles multi-tab sync: socket notificationsMarkedRead sets unreadCount to 0 and all items to read', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.unreadCount).toBe(2);
		});

		act(() => {
			mockSocketListeners['notificationsMarkedRead']({
				userId: 'user_123',
				unreadCount: 0,
			});
		});

		expect(result.current.unreadCount).toBe(0);
		expect(result.current.notifications.every((n) => n.read === true)).toBe(true);

		// Does not affect current user if payload is for different userId
		act(() => {
			mockSocketListeners['notificationsMarkedRead']({
				userId: 'someone_else',
				unreadCount: 0,
			});
		});
		expect(result.current.notifications).toHaveLength(3);
	});

	it('handles multi-tab sync: socket notificationsCleared clears notifications array and unreadCount', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.notifications).toHaveLength(3);
		});

		act(() => {
			mockSocketListeners['notificationsCleared']({
				userId: 'user_123',
			});
		});

		expect(result.current.notifications).toHaveLength(0);
		expect(result.current.unreadCount).toBe(0);
	});

	it('handles multi-tab sync: socket notificationRead marks matching notification read and recomputes unreadCount', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.unreadCount).toBe(2);
		});

		act(() => {
			mockSocketListeners['notificationRead']({
				notifId: 'n1',
				read: true,
			});
		});

		const n1 = result.current.notifications.find((n) => n._id === 'n1');
		expect(n1.read).toBe(true);
		expect(result.current.unreadCount).toBe(1);
	});

	it('action markAsRead optimistically updates local notifications to read, zeroes unreadCount, and calls PUT endpoint', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.unreadCount).toBe(2);
		});

		await act(async () => {
			await result.current.markAsRead();
		});

		expect(result.current.unreadCount).toBe(0);
		expect(result.current.notifications.every((n) => n.read === true)).toBe(true);
		expect(apiFetch).toHaveBeenCalledWith('/api/forum/notifications/user_123/read', {
			method: 'PUT',
		});
	});

	it('action clearNotifications optimistically clears notifications, zeroes unreadCount, and calls DELETE endpoint', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.notifications).toHaveLength(3);
		});

		await act(async () => {
			await result.current.clearNotifications();
		});

		expect(result.current.notifications).toHaveLength(0);
		expect(result.current.unreadCount).toBe(0);
		expect(apiFetch).toHaveBeenCalledWith('/api/forum/notifications/user_123', {
			method: 'DELETE',
		});
	});

	it('action markSingleAsRead optimistically sets notification read: true and calls single read PUT endpoint', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.unreadCount).toBe(2);
		});

		await act(async () => {
			await result.current.markSingleAsRead('n3');
		});

		const n3 = result.current.notifications.find((n) => n._id === 'n3');
		expect(n3.read).toBe(true);
		expect(result.current.unreadCount).toBe(1);
		expect(apiFetch).toHaveBeenCalledWith('/api/forum/notifications/single/n3/read', {
			method: 'PUT',
		});
	});

	it('handles privateMessage socket event by incrementing unreadMessages and firing toast', async () => {
		const { result } = renderHook(() => useNotifications());

		await waitFor(() => {
			expect(result.current.unreadMessages).toBe(3);
		});

		act(() => {
			mockSocketListeners['privateMessage']({
				receiver: 'user_123',
				sender: { name: 'Alice' },
			});
		});

		expect(result.current.unreadMessages).toBe(4);
		expect(toast).toHaveBeenCalledWith('New message from Alice', { icon: '💬' });
	});

	it('cleans up all socket listeners and window event listeners on unmount', async () => {
		const { unmount } = renderHook(() => useNotifications());

		expect(mockSocketInstance.on).toHaveBeenCalledWith('newNotification', expect.any(Function));
		expect(mockSocketInstance.on).toHaveBeenCalledWith('notificationsMarkedRead', expect.any(Function));
		expect(mockSocketInstance.on).toHaveBeenCalledWith('notificationsCleared', expect.any(Function));
		expect(mockSocketInstance.on).toHaveBeenCalledWith('notificationRead', expect.any(Function));
		expect(mockSocketInstance.on).toHaveBeenCalledWith('privateMessage', expect.any(Function));

		unmount();

		expect(mockSocketInstance.off).toHaveBeenCalledWith('newNotification', expect.any(Function));
		expect(mockSocketInstance.off).toHaveBeenCalledWith('notificationsMarkedRead', expect.any(Function));
		expect(mockSocketInstance.off).toHaveBeenCalledWith('notificationsCleared', expect.any(Function));
		expect(mockSocketInstance.off).toHaveBeenCalledWith('notificationRead', expect.any(Function));
		expect(mockSocketInstance.off).toHaveBeenCalledWith('privateMessage', expect.any(Function));
	});

	it('does not join socket room or make API calls when unauthenticated (no token)', async () => {
		localStorage.clear();

		const { result } = renderHook(() => useNotifications());

		expect(mockSocketInstance.emit).not.toHaveBeenCalled();
		expect(apiFetch).not.toHaveBeenCalled();
		expect(result.current.notifications).toEqual([]);
		expect(result.current.unreadCount).toBe(0);
	});
});

describe('ForumRedirect deep-link parameter and hash preservation', () => {
	const LocationDisplay = () => {
		const location = useLocation();
		return React.createElement(
			'div',
			null,
			React.createElement('span', { 'data-testid': 'pathname' }, location.pathname),
			React.createElement('span', { 'data-testid': 'search' }, location.search),
			React.createElement('span', { 'data-testid': 'hash' }, location.hash)
		);
	};

	it('preserves query parameters and hash fragments during /forum redirect to /community', () => {
		const { getByTestId } = render(
			React.createElement(
				MemoryRouter,
				{ initialEntries: ['/forum?postId=post_123&highlight=comm_456#comment-comm_456'] },
				React.createElement(
					Routes,
					null,
					React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
					React.createElement(Route, { path: '/community', element: React.createElement(LocationDisplay) })
				)
			)
		);

		expect(getByTestId('pathname').textContent).toBe('/community');
		expect(getByTestId('search').textContent).toBe('?postId=post_123&highlight=comm_456');
		expect(getByTestId('hash').textContent).toBe('#comment-comm_456');
	});

	it('redirects cleanly when no query parameters or hash are present', () => {
		const { getByTestId } = render(
			React.createElement(
				MemoryRouter,
				{ initialEntries: ['/forum'] },
				React.createElement(
					Routes,
					null,
					React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
					React.createElement(Route, { path: '/community', element: React.createElement(LocationDisplay) })
				)
			)
		);

		expect(getByTestId('pathname').textContent).toBe('/community');
		expect(getByTestId('search').textContent).toBe('');
		expect(getByTestId('hash').textContent).toBe('');
	});
});

