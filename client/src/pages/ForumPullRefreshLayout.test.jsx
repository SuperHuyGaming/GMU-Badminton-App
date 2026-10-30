import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Forum from './Forum';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
	default: vi.fn(),
}));

vi.mock('../utils/socket', () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
	},
}));

vi.mock('react-hot-toast', () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('Forum Pull-to-Refresh, Facebook Top Search & Admin Pin Tests', () => {
	const mockAdmin = {
		id: 'admin-101',
		name: 'Admin Huy',
		role: 'admin',
	};

	const mockPlayer = {
		id: 'player-202',
		name: 'Player Alex',
		role: 'player',
	};

	const mockFeedData = {
		feed: [
			{
				_id: 'post-1',
				title: 'Important Club Announcement',
				content: 'RAC courts booked tomorrow 6pm.',
				authorId: 'player-202',
				authorName: 'Player Alex',
				category: 'general',
				visibility: 'PUBLIC',
				isPinned: true,
				createdAt: new Date().toISOString(),
				reactions: [],
				comments: [],
			},
			{
				_id: 'post-2',
				title: 'Doubles match at RAC',
				content: 'Looking for 2 doubles partners!',
				authorId: 'player-303',
				authorName: 'Player Bob',
				category: 'find_partner',
				visibility: 'FRIENDS_ONLY',
				isPinned: false,
				createdAt: new Date().toISOString(),
				reactions: [],
				comments: [],
			},
		],
		nextCursor: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollY = 0;
		window.IntersectionObserver = vi.fn().mockReturnValue({
			observe: () => null,
			unobserve: () => null,
			disconnect: () => null,
		});
		window.scrollTo = vi.fn();
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => mockFeedData,
		});
	});

	const renderForum = (user = mockAdmin) => {
		return render(
			<AuthContext.Provider value={{ user, token: 'mock-token' }}>
				<BrowserRouter>
					<Forum />
				</BrowserRouter>
			</AuthContext.Provider>
		);
	};

	it('renders Facebook Composer Card prominently at top of the feed', async () => {
		renderForum(mockPlayer);
		await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
		const composer = screen.getByTestId('facebook-composer-card');
		expect(composer).toHaveTextContent("What's on your mind, Player?");
	});

	it('renders clean Facebook-style header without cluttered reload button or inline search', async () => {
		renderForum(mockPlayer);
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());
		expect(screen.queryByRole('button', { name: /refresh feed/i })).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Search community posts')).not.toBeInTheDocument();
		expect(screen.queryByTestId('feed-density-toggle')).not.toBeInTheDocument();
	});

	it('supports mobile touch pull-to-refresh down gesture and refreshes feed', async () => {
		renderForum(mockPlayer);
		await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

		// Locate feed container (which has onTouchStart/Move/End handlers)
		const composerCard = screen.getByTestId('facebook-composer-card');
		const feedContainer = composerCard.parentElement;

		// 1. Touch start at top of window
		fireEvent.touchStart(feedContainer, {
			touches: [{ clientY: 100 }],
		});

		// 2. Touch move downwards > 60px
		fireEvent.touchMove(feedContainer, {
			touches: [{ clientY: 220 }],
		});

		// Visual pull indicator appears
		expect(screen.getByTestId('mobile-pull-to-refresh-indicator')).toBeInTheDocument();
		expect(screen.getByText(/release to refresh/i)).toBeInTheDocument();

		// 3. Touch release
		apiFetch.mockClear();
		fireEvent.touchEnd(feedContainer);

		// Refresh should be triggered
		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/feed?tab=latest'));
		});
	});

	it('renders active search indicator when URL contains search and clears it', async () => {
		render(
			<AuthContext.Provider value={{ user: mockPlayer, token: 'mock-token' }}>
				<BrowserRouter>
					<Forum />
				</BrowserRouter>
			</AuthContext.Provider>
		);
		// Simulate URL search parameter
		window.history.pushState({}, '', '/community?search=Doubles');
		render(
			<AuthContext.Provider value={{ user: mockPlayer, token: 'mock-token' }}>
				<BrowserRouter>
					<Forum />
				</BrowserRouter>
			</AuthContext.Provider>
		);
		await waitFor(() => expect(screen.getByTestId('active-search-indicator')).toBeInTheDocument());
		expect(screen.getByText(/showing posts matching/i)).toBeInTheDocument();
		expect(screen.getByText(/"Doubles"/i)).toBeInTheDocument();

		const clearBtn = screen.getByRole('button', { name: /clear/i });
		fireEvent.click(clearBtn);
	});

	it('includes full categories and privacy selections in Create Post modal', async () => {
		renderForum(mockPlayer);
		await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

		fireEvent.click(screen.getByTestId('facebook-composer-card'));
		await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

		// Verify category select is present
		const categorySelect = screen.getByLabelText('Post category');
		expect(categorySelect).toBeInTheDocument();

		// Verify privacy select is present
		const privacySelect = screen.getByLabelText('Post privacy');
		expect(privacySelect).toBeInTheDocument();
	});
});
