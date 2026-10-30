import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Forum from './pages/Forum';
import PostCard from './components/PostCard';
import MediaLightbox from './components/MediaLightbox';
import { AuthContext } from './context/AuthContext';
import apiFetch from './utils/api';

vi.mock('./utils/api', () => ({
	default: vi.fn(),
}));

vi.mock('./utils/socket', () => ({
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
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('🤖 Comprehensive Community User Bots Simulation Sprint', () => {
	const botAdmin = {
		id: 'bot-admin-1',
		name: 'Huy Admin',
		role: 'admin',
		profilePic: 'https://example.com/admin.jpg',
	};

	const botAlice = {
		id: 'bot-alice-2',
		name: 'Alice Smash',
		role: 'player',
		profilePic: 'https://example.com/alice.jpg',
	};

	const botBob = {
		id: 'bot-bob-3',
		name: 'Bob Drop',
		role: 'player',
		profilePic: 'https://example.com/bob.jpg',
	};

	const samplePosts = [
		{
			_id: 'post-101',
			title: 'Official GMU Club Megathread',
			content: 'Welcome to Fall 2026 Badminton season!',
			authorId: 'bot-admin-1',
			authorName: 'Huy Admin',
			authorPic: 'https://example.com/admin.jpg',
			category: 'general',
			visibility: 'PUBLIC',
			isPinned: true,
			createdAt: new Date().toISOString(),
			reactions: [{ userId: 'bot-bob-3', type: 'like' }],
			likes: 1,
			comments: [
				{
					_id: 'c-1',
					authorId: 'bot-alice-2',
					authorName: 'Alice Smash',
					content: 'Excited for the upcoming matches!',
					createdAt: new Date().toISOString(),
					replies: [
						{
							_id: 'r-1',
							authorId: 'bot-bob-3',
							authorName: 'Bob Drop',
							content: '@Alice Smash see you on court 1!',
							createdAt: new Date().toISOString(),
						},
					],
				},
			],
			imageUrls: [
				'https://example.com/img1.jpg',
				'https://example.com/img2.jpg',
			],
		},
		{
			_id: 'post-102',
			title: 'Looking for Doubles Partner at RAC',
			content: 'Intermediate doubles partner wanted for Friday 6pm.',
			authorId: 'bot-alice-2',
			authorName: 'Alice Smash',
			category: 'find_partner',
			visibility: 'FRIENDS_ONLY',
			isPinned: false,
			createdAt: new Date().toISOString(),
			reactions: [],
			likes: 0,
			comments: [],
			imageUrls: [],
		},
		{
			_id: 'post-103',
			title: 'Private Training Notes',
			content: 'Footwork drills reminder: 6-corner recovery.',
			authorId: 'bot-alice-2',
			authorName: 'Alice Smash',
			category: 'training',
			visibility: 'ONLY_ME',
			isPinned: false,
			createdAt: new Date().toISOString(),
			reactions: [],
			likes: 0,
			comments: [],
			imageUrls: [],
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollY = 0;
		window.scrollTo = vi.fn();
		window.IntersectionObserver = vi.fn().mockReturnValue({
			observe: () => null,
			unobserve: () => null,
			disconnect: () => null,
		});

		apiFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				feed: samplePosts,
				nextCursor: null,
				bookmarkedPosts: ['post-101'],
			}),
		});
	});

	const renderCommunity = (currentUser = botAlice) => {
		return render(
			<AuthContext.Provider value={{ user: currentUser, token: 'fake-token' }}>
				<MemoryRouter>
					<Forum />
				</MemoryRouter>
			</AuthContext.Provider>
		);
	};

	// ── WORKFLOW 1: POST COMPOSER, CATEGORIES & AUDIENCE PRIVACY ─────────────
	describe('1. Post Composer, Categories & Audience Privacy Workflow', () => {
		it('places "What\'s on your mind?" composer card prominently at the top of the feed', async () => {
			renderCommunity(botAlice);
			await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());
			const composer = screen.getByTestId('facebook-composer-card');
			expect(composer).toHaveTextContent("What's on your mind, Alice?");
		});

		it('allows Alice to open composer and select categories and audience visibility', async () => {
			renderCommunity(botAlice);
			await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

			fireEvent.click(screen.getByTestId('facebook-composer-card'));
			await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

			// Category Select
			const categorySelect = screen.getByLabelText('Post category');
			expect(categorySelect).toBeInTheDocument();

			// Privacy Select
			const privacySelect = screen.getByLabelText('Post privacy');
			expect(privacySelect).toBeInTheDocument();
		});

		it('renders audience privacy icons (Public, Friends Only, Only Me) on PostCard with tooltips', () => {
			render(
				<AuthContext.Provider value={{ user: botAlice, token: 'fake-token' }}>
					<MemoryRouter>
						<PostCard post={samplePosts[0]} currentUser={botAlice} />
						<PostCard post={samplePosts[1]} currentUser={botAlice} />
						<PostCard post={samplePosts[2]} currentUser={botAlice} />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			const privacyIcons = screen.getAllByTestId('post-privacy-icon');
			expect(privacyIcons).toHaveLength(3);
			expect(privacyIcons[0]).toHaveAttribute('aria-label', expect.stringContaining('Public'));
			expect(privacyIcons[1]).toHaveAttribute('aria-label', expect.stringContaining('Friends Only'));
			expect(privacyIcons[2]).toHaveAttribute('aria-label', expect.stringContaining('Only Me'));
		});
	});

	// ── WORKFLOW 2: FACEBOOK REACTION TOKENS & DOCK ─────────────────────────
	describe('2. Facebook Reactions Interaction Workflow', () => {
		it('renders authentic Facebook reaction tokens and supports reacting with Love', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					action: 'added',
					reaction: 'love',
					reactions: [{ userId: 'bot-bob-3', type: 'love' }],
				}),
			});

			render(
				<AuthContext.Provider value={{ user: botBob, token: 'fake-token' }}>
					<MemoryRouter>
						<PostCard post={samplePosts[1]} currentUser={botBob} />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			const reactBtn = screen.getByRole('button', { name: /react to post/i });
			expect(reactBtn).toBeInTheDocument();

			// Hover or click react button
			fireEvent.mouseEnter(reactBtn);
			const loveOption = await screen.findByLabelText(/React with Love/i);
			expect(loveOption).toBeInTheDocument();

			fireEvent.click(loveOption);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(
					expect.stringContaining(`/api/forum/${samplePosts[1]._id}/react`),
					expect.objectContaining({
						method: 'POST',
						body: JSON.stringify({ emoji: '❤️' }),
					})
				);
			});
		});
	});

	// ── WORKFLOW 3: THREADED COMMENTS & NESTED REPLIES ──────────────────────
	describe('3. Threaded Comments & Nested Replies Workflow', () => {
		it('renders top-level comments and nested reply bubbles when comments are opened', () => {
			render(
				<AuthContext.Provider value={{ user: botAlice, token: 'fake-token' }}>
					<MemoryRouter>
						<PostCard post={samplePosts[0]} currentUser={botAlice} />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			const commentBtn = screen.getByRole('button', { name: /^comment/i });
			fireEvent.click(commentBtn);

			// Check that Alice's comment and Bob's nested reply are present
			expect(screen.getByText('Excited for the upcoming matches!')).toBeInTheDocument();
			const toggleReplies = screen.getByTestId('toggle-subthread-btn');
			fireEvent.click(toggleReplies);
			expect(screen.getByText(/see you on court 1!/i)).toBeInTheDocument();
		});
	});

	// ── WORKFLOW 4: MEDIA LIGHTBOX GESTURES ─────────────────────────────────
	describe('4. Media Lightbox & Touch Navigation Workflow', () => {
		it('supports left and right navigation in MediaLightbox', () => {
			const mockImages = [
				'https://example.com/img1.jpg',
				'https://example.com/img2.jpg',
			];

			render(
				<MediaLightbox
					open={true}
					onClose={vi.fn()}
					images={mockImages}
					initialIndex={0}
					title="GMU Open"
					authorName="Huy Admin"
				/>
			);

			expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();

			// Click Next arrow
			const nextBtn = screen.getByRole('button', { name: /next image/i });
			fireEvent.click(nextBtn);
			expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();
		});
	});

	// ── WORKFLOW 5: MOBILE TOUCH PULL-TO-REFRESH & DESKTOP RELOAD ───────────
	describe('5. Mobile Pull-to-Refresh & Desktop Reload Workflow', () => {
		it('triggers feed refresh when pulling down on mobile', async () => {
			renderCommunity(botAlice);
			await waitFor(() => expect(screen.getByTestId('facebook-composer-card')).toBeInTheDocument());

			const composerCard = screen.getByTestId('facebook-composer-card');
			const feedContainer = composerCard.parentElement;

			// Swiping down on mobile
			fireEvent.touchStart(feedContainer, { touches: [{ clientY: 50 }] });
			fireEvent.touchMove(feedContainer, { touches: [{ clientY: 170 }] });

			// Release threshold exceeded
			expect(screen.getByTestId('mobile-pull-to-refresh-indicator')).toBeInTheDocument();
			expect(screen.getByText(/release to refresh/i)).toBeInTheDocument();

			apiFetch.mockClear();
			fireEvent.touchEnd(feedContainer);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/feed?tab=latest'));
			});
		});

		it('renders clean Facebook-style header without dated manual reload button', async () => {
			renderCommunity(botAlice);
			expect(screen.queryByTestId('feed-reload-btn')).not.toBeInTheDocument();
		});
	});

	// ── WORKFLOW 6: ADMIN PINNING VS NON-ADMIN DENIAL ────────────────────────
	describe('6. Admin Pinning Hierarchy & Authorization Workflow', () => {
		it('allows Admin user to toggle megathread pin', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ message: 'Post pin toggled', isPinned: true }),
			});

			render(
				<AuthContext.Provider value={{ user: botAdmin, token: 'fake-token' }}>
					<MemoryRouter>
						<PostCard post={samplePosts[1]} currentUser={botAdmin} />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			const moreBtn = screen.getByRole('button', { name: /more options/i });
			fireEvent.click(moreBtn);

			const pinItem = screen.getByRole('menuitem', { name: /📌 Pin Megathread/i });
			expect(pinItem).toBeInTheDocument();
			fireEvent.click(pinItem);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(
					`/api/forum/${samplePosts[1]._id}/pin`,
					expect.objectContaining({ method: 'PUT' })
				);
			});
		});

		it('strictly denies non-admin author from seeing the Pin Megathread option', () => {
			render(
				<AuthContext.Provider value={{ user: botAlice, token: 'fake-token' }}>
					<MemoryRouter>
						<PostCard post={samplePosts[1]} currentUser={botAlice} />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			const moreBtn = screen.getByRole('button', { name: /more options/i });
			fireEvent.click(moreBtn);

			expect(screen.queryByRole('menuitem', { name: /Pin Megathread/i })).not.toBeInTheDocument();
		});
	});

	// ── WORKFLOW 7: SEARCH, DENSITY & CATEGORY FILTERING ────────────────────
	describe('7. Search, Density & Category Filtering Workflow', () => {
		it('maintains clean comfortable feed layout without cluttered density button', async () => {
			renderCommunity(botAlice);
			expect(screen.queryByTestId('feed-density-toggle')).not.toBeInTheDocument();
		});

		it('filters feed when clicking category chip in trending strip', async () => {
			renderCommunity(botAlice);
			await waitFor(() => expect(screen.getByTestId('trending-tags-strip')).toBeInTheDocument());

			apiFetch.mockClear();
			const findPartnerChip = screen.getByText('🤝 Find Players');
			fireEvent.click(findPartnerChip);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('category=find_partner'));
			});
		});

		it('filters feed when searching with URL search query parameter', async () => {
			render(
				<AuthContext.Provider value={{ user: botAlice, token: 'fake-token' }}>
					<MemoryRouter initialEntries={['/community?search=Doubles']}>
						<Forum />
					</MemoryRouter>
				</AuthContext.Provider>
			);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('search=Doubles'));
			});
			expect(screen.getByTestId('active-search-indicator')).toBeInTheDocument();
		});
	});
});
