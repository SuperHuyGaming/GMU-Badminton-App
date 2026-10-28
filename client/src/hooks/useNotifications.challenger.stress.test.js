import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import { ForumRedirect } from '../App';

// Hoisted socket mock for challenger stress tests
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

let mockUser = { _id: 'challenger_user_1', id: 'challenger_user_1', name: 'Challenger' };
vi.mock('../context/AuthContext', () => ({
	useAuth: () => ({
		user: mockUser,
		setToastMessage: vi.fn(),
	}),
}));

vi.mock('../utils/api', () => ({
	default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
	toast: vi.fn(),
}));

import apiFetch from '../utils/api';

describe('Adversarial Stress Test: useNotifications Hook & Deep-Link Preservation', () => {
	const baseNotifications = [
		{ _id: 'base_1', targetUserId: 'challenger_user_1', message: 'Existing Notif 1', read: false, time: '2026-10-28T00:00:00Z' },
		{ _id: 'base_2', targetUserId: 'challenger_user_1', message: 'Existing Notif 2', read: true, time: '2026-10-28T00:01:00Z' },
		{ _id: 'base_3', targetUserId: 'challenger_user_1', message: 'Existing Notif 3', read: false, time: '2026-10-28T00:02:00Z' },
	];

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem('accessToken', 'mock-challenger-token');
		mockUser = { _id: 'challenger_user_1', id: 'challenger_user_1', name: 'Challenger' };

		apiFetch.mockImplementation(async (url) => {
			if (url === '/api/forum/notifications/challenger_user_1') {
				return {
					ok: true,
					json: async () => JSON.parse(JSON.stringify(baseNotifications)),
				};
			}
			if (url === '/api/messages/recent/challenger_user_1') {
				return {
					ok: true,
					json: async () => [],
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

	// =========================================================================
	// SUITE 1: RAPID DUPLICATE SOCKET EVENTS & CONCURRENCY
	// =========================================================================
	describe('1. Rapid Duplicate Socket Events & Deduplication Invariants', () => {
		it('empirically survives a burst of 100 identical socket events with identical _id without duplication', async () => {
			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.notifications).toHaveLength(3);
			expect(result.current.unreadCount).toBe(2);

			// Fire 100 duplicate socket events rapidly in a tight loop
			act(() => {
				for (let i = 0; i < 100; i++) {
					mockSocketListeners['newNotification']({
						_id: 'burst_notif_999',
						targetUserId: 'challenger_user_1',
						message: `Burst comment update attempt ${i}`,
						read: false,
						time: '2026-10-28T01:30:00Z',
					});
				}
			});

			// Invariant: exactly 1 new notification prepended (total 4)
			expect(result.current.notifications).toHaveLength(4);
			expect(result.current.notifications[0]._id).toBe('burst_notif_999');
			// Invariant: contains latest updated message
			expect(result.current.notifications[0].message).toBe('Burst comment update attempt 99');
			// Invariant: unreadCount incremented by exactly 1 (2 -> 3), not 100
			expect(result.current.unreadCount).toBe(3);

			// Verify no duplicate IDs in the entire array
			const idSet = new Set(result.current.notifications.map((n) => n._id));
			expect(idSet.size).toBe(4);
		});

		it('empirically handles 250 shuffled interleaved events across 25 distinct IDs without duplicates', async () => {
			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));

			// Generate 25 distinct IDs, each repeated 10 times (250 events)
			const distinctIds = Array.from({ length: 25 }, (_, i) => `item_${i + 1}`);
			const eventQueue = [];
			distinctIds.forEach((id) => {
				for (let v = 0; v < 10; v++) {
					eventQueue.push({
						_id: id,
						targetUserId: 'challenger_user_1',
						message: `Message for ${id} (version ${v})`,
						read: false,
						version: v,
					});
				}
			});

			// Pseudo-random shuffle of the 250 events
			for (let i = eventQueue.length - 1; i > 0; i--) {
				const j = (i * 37 + 13) % (i + 1);
				[eventQueue[i], eventQueue[j]] = [eventQueue[j], eventQueue[i]];
			}

			// Fire all 250 events in rapid succession
			act(() => {
				eventQueue.forEach((event) => {
					mockSocketListeners['newNotification'](event);
				});
			});

			// Invariant: 3 base notifications + 25 new unique items = 28 total
			expect(result.current.notifications).toHaveLength(28);

			// Invariant: zero duplicate IDs
			const uniqueIds = new Set(result.current.notifications.map((n) => n._id || n.id));
			expect(uniqueIds.size).toBe(28);

			// Invariant: unreadCount must equal exactly the count of unread items
			const expectedUnread = result.current.notifications.filter((n) => !n.read).length;
			expect(result.current.unreadCount).toBe(expectedUnread);
			expect(result.current.unreadCount).toBe(2 + 25); // 2 initial unread + 25 new unread
		});

		it('deduplicates seamlessly when duplicate events interchange _id and id properties', async () => {
			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));

			// First event with `_id`
			act(() => {
				mockSocketListeners['newNotification']({
					_id: 'dual_id_notif',
					targetUserId: 'challenger_user_1',
					message: 'Created with _id',
					read: false,
				});
			});
			expect(result.current.notifications).toHaveLength(4);

			// Second event with `id` only (no _id)
			act(() => {
				mockSocketListeners['newNotification']({
					id: 'dual_id_notif',
					targetUserId: 'challenger_user_1',
					message: 'Updated with id',
					read: false,
				});
			});

			// Invariant: length remains 4, message updated to 'Updated with id'
			expect(result.current.notifications).toHaveLength(4);
			expect(result.current.notifications[0].message).toBe('Updated with id');
		});

		it('resiliently ignores malformed, null, undefined, or cross-tenant socket payloads during high load', async () => {
			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));

			act(() => {
				mockSocketListeners['newNotification'](null);
				mockSocketListeners['newNotification'](undefined);
				mockSocketListeners['newNotification']({});
				mockSocketListeners['newNotification']({ targetUserId: 'different_user_456', _id: 'rogue_1' });
				mockSocketListeners['newNotification']('invalid-string');
				mockSocketListeners['notificationsMarkedRead'](null);
				mockSocketListeners['notificationsMarkedRead']({ userId: 'other_user' });
				mockSocketListeners['notificationsCleared'](null);
				mockSocketListeners['notificationsCleared']({ userId: 'other_user' });
				mockSocketListeners['notificationRead'](null);
				mockSocketListeners['notificationRead']({});
			});

			// Invariant: original 3 items remain intact without crashing
			expect(result.current.notifications).toHaveLength(3);
			expect(result.current.unreadCount).toBe(2);
		});
	});

	// =========================================================================
	// SUITE 2: OPTIMISTIC STATE UPDATES WITHOUT DELAY
	// =========================================================================
	describe('2. Optimistic markAsRead & clearNotifications Zero-Delay Execution', () => {
		it('markAsRead updates state synchronously to read:true and unreadCount:0 BEFORE backend API resolves', async () => {
			let resolveApiPromise;
			const slowApiPromise = new Promise((resolve) => {
				resolveApiPromise = resolve;
			});
			apiFetch.mockImplementation(async (url, options) => {
				if (options?.method === 'PUT' && url.includes('/read')) {
					return slowApiPromise;
				}
				if (url === '/api/forum/notifications/challenger_user_1') {
					return {
						ok: true,
						json: async () => JSON.parse(JSON.stringify(baseNotifications)),
					};
				}
				return { ok: true, json: async () => [] };
			});

			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.unreadCount).toBe(2);

			let actionPromise;
			act(() => {
				// Call markAsRead without awaiting backend response
				actionPromise = result.current.markAsRead();
			});

			// EMPIRICAL ASSERTION: The state MUST have updated optimistically NOW,
			// while the API call is still pending!
			expect(result.current.unreadCount).toBe(0);
			expect(result.current.notifications.every((n) => n.read === true)).toBe(true);

			// Now resolve the backend call
			await act(async () => {
				resolveApiPromise({ ok: true, json: async () => ({ success: true }) });
				await actionPromise;
			});

			// Invariant holds after backend resolution
			expect(result.current.unreadCount).toBe(0);
			expect(result.current.notifications.every((n) => n.read === true)).toBe(true);
		});

		it('clearNotifications updates state synchronously to [] and unreadCount:0 BEFORE backend API resolves', async () => {
			let resolveApiPromise;
			const slowApiPromise = new Promise((resolve) => {
				resolveApiPromise = resolve;
			});
			apiFetch.mockImplementation(async (url, options) => {
				if (options?.method === 'DELETE') {
					return slowApiPromise;
				}
				if (url === '/api/forum/notifications/challenger_user_1') {
					return {
						ok: true,
						json: async () => JSON.parse(JSON.stringify(baseNotifications)),
					};
				}
				return { ok: true, json: async () => [] };
			});

			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.notifications).toHaveLength(3);
			expect(result.current.unreadCount).toBe(2);

			let actionPromise;
			act(() => {
				// Call clearNotifications without awaiting backend response
				actionPromise = result.current.clearNotifications();
			});

			// EMPIRICAL ASSERTION: State cleared immediately
			expect(result.current.notifications).toEqual([]);
			expect(result.current.unreadCount).toBe(0);

			// Now resolve the backend call
			await act(async () => {
				resolveApiPromise({ ok: true, json: async () => ({ success: true }) });
				await actionPromise;
			});

			expect(result.current.notifications).toEqual([]);
			expect(result.current.unreadCount).toBe(0);
		});

		it('markSingleAsRead updates state synchronously to read:true BEFORE backend API resolves', async () => {
			let resolveApiPromise;
			const slowApiPromise = new Promise((resolve) => {
				resolveApiPromise = resolve;
			});
			apiFetch.mockImplementation(async (url, options) => {
				if (options?.method === 'PUT' && url.includes('/single/')) {
					return slowApiPromise;
				}
				if (url === '/api/forum/notifications/challenger_user_1') {
					return {
						ok: true,
						json: async () => JSON.parse(JSON.stringify(baseNotifications)),
					};
				}
				return { ok: true, json: async () => [] };
			});

			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));
			expect(result.current.unreadCount).toBe(2);

			let actionPromise;
			act(() => {
				actionPromise = result.current.markSingleAsRead('base_1');
			});

			// EMPIRICAL ASSERTION: Target item is immediately read and unreadCount decremented to 1
			const updatedItem = result.current.notifications.find((n) => n._id === 'base_1');
			expect(updatedItem.read).toBe(true);
			expect(result.current.unreadCount).toBe(1);

			await act(async () => {
				resolveApiPromise({ ok: true, json: async () => ({ success: true }) });
				await actionPromise;
			});

			expect(result.current.unreadCount).toBe(1);
		});

		it('optimistic actions gracefully absorb API rejection without unhandled rejection or app crash', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			apiFetch.mockImplementation(async () => {
				throw new Error('500 Internal Server Error (Simulated Network Failure)');
			});

			const { result } = renderHook(() => useNotifications());
			await waitFor(() => expect(result.current.loading).toBe(false));

			// Should not throw or crash
			await act(async () => {
				await result.current.markAsRead();
				await result.current.markSingleAsRead('base_1');
				await result.current.clearNotifications();
			});

			expect(consoleErrorSpy).toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});
	});

	// =========================================================================
	// SUITE 3: FORUM REDIRECT QUERY & HASH FRAGMENT PRESERVATION
	// =========================================================================
	describe('3. ForumRedirect Complex Query Parameters & Hash Preservation', () => {
		const LocationVerifier = () => {
			const location = useLocation();
			return React.createElement(
				'div',
				null,
				React.createElement('span', { 'data-testid': 'pathname' }, location.pathname),
				React.createElement('span', { 'data-testid': 'search' }, location.search),
				React.createElement('span', { 'data-testid': 'hash' }, location.hash)
			);
		};

		it('faithfully preserves complex, nested, URL-encoded parameters and deep hash fragments', () => {
			const complexSearch =
				'?postId=post_789&highlight=comm_999&filter=%5B%22singles%22%2C%22tournament%22%5D&title=RAC%20Court%20%26%20Matches%3F&source=notification_bell';
			const complexHash = '#comment-comm_999/reply-branch';

			const { getByTestId } = render(
				React.createElement(
					MemoryRouter,
					{ initialEntries: [`/forum${complexSearch}${complexHash}`] },
					React.createElement(
						Routes,
						null,
						React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
						React.createElement(Route, { path: '/community', element: React.createElement(LocationVerifier) })
					)
				)
			);

			expect(getByTestId('pathname').textContent).toBe('/community');
			expect(getByTestId('search').textContent).toBe(complexSearch);
			expect(getByTestId('hash').textContent).toBe(complexHash);
		});

		it('faithfully preserves repeated array query parameters and anchor-only URLs', () => {
			// Array params e.g. ?cat=gear&cat=matches
			const repeatedQuery = '?cat=gear&cat=matches&author=alice%20smith';
			const { getByTestId } = render(
				React.createElement(
					MemoryRouter,
					{ initialEntries: [`/forum${repeatedQuery}`] },
					React.createElement(
						Routes,
						null,
						React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
						React.createElement(Route, { path: '/community', element: React.createElement(LocationVerifier) })
					)
				)
			);

			expect(getByTestId('pathname').textContent).toBe('/community');
			expect(getByTestId('search').textContent).toBe(repeatedQuery);
			expect(getByTestId('hash').textContent).toBe('');
		});

		it('faithfully preserves hash-only URLs without query parameters', () => {
			const targetHash = '#guidelines-and-code-of-conduct';
			const { getByTestId } = render(
				React.createElement(
					MemoryRouter,
					{ initialEntries: [`/forum${targetHash}`] },
					React.createElement(
						Routes,
						null,
						React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
						React.createElement(Route, { path: '/community', element: React.createElement(LocationVerifier) })
					)
				)
			);

			expect(getByTestId('pathname').textContent).toBe('/community');
			expect(getByTestId('search').textContent).toBe('');
			expect(getByTestId('hash').textContent).toBe(targetHash);
		});

		it('redirects cleanly when navigation has empty trailing query or hash (? or #)', () => {
			const { getByTestId } = render(
				React.createElement(
					MemoryRouter,
					{ initialEntries: ['/forum'] },
					React.createElement(
						Routes,
						null,
						React.createElement(Route, { path: '/forum', element: React.createElement(ForumRedirect) }),
						React.createElement(Route, { path: '/community', element: React.createElement(LocationVerifier) })
					)
				)
			);

			expect(getByTestId('pathname').textContent).toBe('/community');
			expect(getByTestId('search').textContent).toBe('');
			expect(getByTestId('hash').textContent).toBe('');
		});
	});
});
