import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MediaLightbox from './MediaLightbox';
import CommentThread from './CommentThread';
import PostCard from './PostCard';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('../utils/api', () => ({
	default: vi.fn().mockResolvedValue({
		ok: true,
		json: async () => ({ reactions: [] }),
	}),
}));

vi.mock('../utils/socket', () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
	},
}));

describe('Milestone 2 Adversarial Stress Suite (challenger_2_m2_14)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// =========================================================================
	// 1. J2 MediaLightbox Touch Gestures Stress Testing
	// =========================================================================
	describe('1. J2 MediaLightbox Touch Gestures Adversarial Suite', () => {
		const sampleImages = [
			'https://example.com/court1.jpg',
			'https://example.com/court2.jpg',
			'https://example.com/court3.jpg',
		];

		const renderLightbox = (props = {}) => {
			return render(
				<MediaLightbox
					open={true}
					onClose={vi.fn()}
					images={sampleImages}
					initialIndex={0}
					title="Campus Championship"
					authorName="Coach Davis"
					{...props}
				/>
			);
		};

		it('navigates to next image on intentional left swipe exceeding threshold (>50px)', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Swipe left: start at 250, end at 150 (diffX = -100px < -50px)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 250, clientY: 200 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 150, clientY: 205 }],
			});

			expect(screen.getByText('2 / 3')).toBeInTheDocument();
			expect(screen.getByAltText('Media attachment 2')).toHaveAttribute('src', sampleImages[1]);
		});

		it('navigates to prev image on intentional right swipe exceeding threshold (>50px)', () => {
			renderLightbox({ initialIndex: 1 });
			const container = screen.getByTestId('lightbox-main-container');

			// Swipe right: start at 100, end at 210 (diffX = +110px > 50px)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 100, clientY: 200 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 210, clientY: 202 }],
			});

			expect(screen.getByText('1 / 3')).toBeInTheDocument();
			expect(screen.getByAltText('Media attachment 1')).toHaveAttribute('src', sampleImages[0]);
		});

		it('strictly no-ops when horizontal swipe delta is <= 50px boundary', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Under-threshold tests: +50px, -50px, +49px, -49px, 0px
			const underThresholdDeltas = [50, -50, 49, -49, 10, -10, 0];

			for (const delta of underThresholdDeltas) {
				fireEvent.touchStart(container, {
					touches: [{ clientX: 200, clientY: 200 }],
				});
				fireEvent.touchEnd(container, {
					changedTouches: [{ clientX: 200 + delta, clientY: 200 }],
				});
				// Must remain at initial index 0 ('1 / 3')
				expect(screen.getByText('1 / 3')).toBeInTheDocument();
			}

			// Boundary +51px test -> should navigate
			fireEvent.touchStart(container, {
				touches: [{ clientX: 200, clientY: 200 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 251, clientY: 200 }], // diffX = +51px -> Prev (wraps to 3)
			});
			expect(screen.getByText('3 / 3')).toBeInTheDocument();
		});

		it('strictly no-ops on vertical-dominant or equal-diagonal swipes (abs(deltaY) >= abs(deltaX))', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Scenario A: Strong downward swipe with slight horizontal drag
			// diffX = -70px, diffY = +140px (abs(Y) 140 > abs(X) 70)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 200, clientY: 100 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 130, clientY: 240 }],
			});
			expect(screen.getByText('1 / 3')).toBeInTheDocument();

			// Scenario B: Strong upward swipe with slight horizontal drag
			// diffX = +90px, diffY = -180px (abs(Y) 180 > abs(X) 90)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 100, clientY: 300 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 190, clientY: 120 }],
			});
			expect(screen.getByText('1 / 3')).toBeInTheDocument();

			// Scenario C: Exact diagonal angle (abs(deltaX) === abs(deltaY))
			// diffX = +80px, diffY = +80px
			fireEvent.touchStart(container, {
				touches: [{ clientX: 100, clientY: 100 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 180, clientY: 180 }],
			});
			expect(screen.getByText('1 / 3')).toBeInTheDocument();
		});

		it('correctly wraps around when swiping left from last image and right from first image', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Swipe right from index 0 -> wraps to last image (index 2)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 100, clientY: 200 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 220, clientY: 200 }],
			});
			expect(screen.getByText('3 / 3')).toBeInTheDocument();
			expect(screen.getByAltText('Media attachment 3')).toHaveAttribute('src', sampleImages[2]);

			// Swipe left from index 2 -> wraps back to first image (index 0)
			fireEvent.touchStart(container, {
				touches: [{ clientX: 250, clientY: 200 }],
			});
			fireEvent.touchEnd(container, {
				changedTouches: [{ clientX: 100, clientY: 200 }],
			});
			expect(screen.getByText('1 / 3')).toBeInTheDocument();
			expect(screen.getByAltText('Media attachment 1')).toHaveAttribute('src', sampleImages[0]);
		});

		it('handles rapid sequential swipe bursts without state corruption', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Perform 10 rapid alternating swipes: Left (+1) then Right (-1)
			for (let i = 0; i < 10; i++) {
				// Left swipe (Next)
				fireEvent.touchStart(container, {
					touches: [{ clientX: 200, clientY: 200 }],
				});
				fireEvent.touchEnd(container, {
					changedTouches: [{ clientX: 100, clientY: 200 }],
				});

				// Right swipe (Prev)
				fireEvent.touchStart(container, {
					touches: [{ clientX: 100, clientY: 200 }],
				});
				fireEvent.touchEnd(container, {
					changedTouches: [{ clientX: 200, clientY: 200 }],
				});
			}

			// Should have cleanly returned to index 0
			expect(screen.getByText('1 / 3')).toBeInTheDocument();
		});

		it('safely handles missing touches array or abrupt touchEnd without initial touchStart', () => {
			renderLightbox({ initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// touchEnd fired with no prior touchStart (touchStartX.current === null)
			expect(() => {
				fireEvent.touchEnd(container, {
					changedTouches: [{ clientX: 100, clientY: 100 }],
				});
			}).not.toThrow();
			expect(screen.getByText('1 / 3')).toBeInTheDocument();

			// touchStart with empty touches
			expect(() => {
				fireEvent.touchStart(container, { touches: [] });
				fireEvent.touchEnd(container, { changedTouches: [] });
			}).not.toThrow();
			expect(screen.getByText('1 / 3')).toBeInTheDocument();
		});

		it('handles single-image gallery gracefully on swipe gestures without invalid index', () => {
			renderLightbox({ images: ['https://example.com/single.jpg'], initialIndex: 0 });
			const container = screen.getByTestId('lightbox-main-container');

			// Navigation buttons and counter chip should NOT be rendered for single photo
			expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
			expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
			expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();

			// Swiping should not throw or change the single photo
			expect(() => {
				fireEvent.touchStart(container, {
					touches: [{ clientX: 200, clientY: 200 }],
				});
				fireEvent.touchEnd(container, {
					changedTouches: [{ clientX: 100, clientY: 200 }],
				});
			}).not.toThrow();
			expect(screen.getByAltText('Media attachment 1')).toHaveAttribute('src', 'https://example.com/single.jpg');
		});
	});

	// =========================================================================
	// 2. J3 Threaded Comment Replies Stress Testing
	// =========================================================================
	describe('2. J3 Threaded Comment Replies Adversarial Suite', () => {
		const mockCommentWithReplies = {
			_id: 'comment-root-1',
			authorId: 'user-root',
			authorName: 'Master Shuttle',
			content: 'What string tension do you recommend for Astrox 88D Pro?',
			timestamp: new Date().toISOString(),
			isEdited: true,
			editedAt: new Date().toISOString(),
			replies: [
				{
					_id: 'reply-child-1',
					authorId: 'user-child-1',
					authorName: 'Coach Lin',
					content: '@Master Shuttle 26-28 lbs is optimal with BG80 string.',
					timestamp: new Date().toISOString(),
					isEdited: true,
					editedAt: new Date().toISOString(),
					likedBy: ['user-root'],
				},
				{
					_id: 'reply-child-2',
					authorId: 'user-child-2',
					authorName: 'Pro Player Kevin',
					content: 'Agreed, definitely avoid 30+ lbs unless you have elite forearm speed.',
					timestamp: new Date().toISOString(),
					isEdited: false,
					likedBy: [],
				},
			],
		};

		const mockLocalPost = {
			_id: 'post-thread-100',
			authorId: 'user-post-author',
			authorName: 'Author Rachel',
			comments: [mockCommentWithReplies],
		};

		const mockCurrentUser = {
			id: 'user-current-tester',
			name: 'Tester Samantha',
			role: 'player',
		};

		const renderCommentThread = (props = {}) => {
			const defaultProps = {
				comment: mockCommentWithReplies,
				localPost: mockLocalPost,
				currentUser: mockCurrentUser,
				highlightId: null,
				openLikes: vi.fn(),
				handleToggleLike: vi.fn(),
				apiCall: vi.fn(),
				formatTime: () => '5m ago',
				renderContentWithTags: (c) => <span>{c}</span>,
				clickableStyle: {},
				...props,
			};

			return {
				...render(
					<BrowserRouter>
						<CommentThread {...defaultProps} />
					</BrowserRouter>
				),
				apiCall: defaultProps.apiCall,
			};
		};

		it('renders curved connector lines (curved-connector-line) on nested reply bubbles', () => {
			renderCommentThread();

			// Expand replies
			const toggleBtn = screen.getByTestId('toggle-subthread-btn');
			expect(toggleBtn).toBeInTheDocument();
			fireEvent.click(toggleBtn);

			// Subthread container is visible
			expect(screen.getByTestId('subthread-container')).toBeInTheDocument();

			// Verify curved connector line elements exist for each reply
			const connectorLines = screen.getAllByTestId('curved-connector-line');
			expect(connectorLines).toHaveLength(2);

			connectorLines.forEach((line) => {
				expect(line).toHaveAttribute('aria-hidden', 'true');
			});
		});

		it('auto-focuses reply input and pre-fills @Author when clicking Reply on top-level comment', () => {
			renderCommentThread();

			// Click Reply button on top-level CommentBubble
			const topCommentArea = screen.getByText('What string tension do you recommend for Astrox 88D Pro?').closest('#comment-comment-root-1');
			const replyBtn = within(topCommentArea).getByText('Reply');
			fireEvent.click(replyBtn);

			// Input appears with prefilled @Master Shuttle
			const input = screen.getByRole('textbox', { name: /Reply to Master Shuttle/i });
			expect(input).toBeInTheDocument();
			expect(input.value).toBe('@Master Shuttle ');
			expect(document.activeElement).toBe(input);
		});

		it('auto-focuses reply input and pre-fills nested @Author when clicking Reply on reply bubble', () => {
			renderCommentThread();

			// Expand subthread
			fireEvent.click(screen.getByTestId('toggle-subthread-btn'));

			// Locate Coach Lin's reply
			const coachReplyArea = screen.getByText(/26-28 lbs is optimal/).closest('#comment-reply-child-1');
			const replyBtn = within(coachReplyArea).getByText('Reply');
			fireEvent.click(replyBtn);

			// Input updates with @Coach Lin
			const input = screen.getByRole('textbox', { name: /Reply to Master Shuttle/i });
			expect(input).toBeInTheDocument();
			expect(input.value).toBe('@Coach Lin ');
			expect(document.activeElement).toBe(input);
		});

		it('submits nested reply on Enter key (without shift) and calls apiCall with prefilled author content', async () => {
			const { apiCall } = renderCommentThread();

			// Click Reply
			const topCommentArea = screen.getByText('What string tension do you recommend for Astrox 88D Pro?').closest('#comment-comment-root-1');
			fireEvent.click(within(topCommentArea).getByText('Reply'));

			const input = screen.getByRole('textbox', { name: /Reply to Master Shuttle/i });
			fireEvent.change(input, { target: { value: '@Master Shuttle 27 lbs feels great on racket!' } });

			// Press Enter
			fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

			expect(apiCall).toHaveBeenCalledWith(
				`/api/forum/${mockLocalPost._id}/comments/${mockCommentWithReplies._id}/replies`,
				'POST',
				{
					authorId: mockCurrentUser.id,
					authorName: mockCurrentUser.name,
					content: '@Master Shuttle 27 lbs feels great on racket!',
				}
			);
		});

		it('prevents submitting whitespace-only replies and disables Reply submit button', () => {
			const { apiCall } = renderCommentThread();

			const topCommentArea = screen.getByText('What string tension do you recommend for Astrox 88D Pro?').closest('#comment-comment-root-1');
			fireEvent.click(within(topCommentArea).getByText('Reply'));

			const input = screen.getByRole('textbox', { name: /Reply to Master Shuttle/i });
			fireEvent.change(input, { target: { value: '    ' } });

			const buttons = screen.getAllByRole('button', { name: /^Reply$/i });
			const submitBtn = buttons.find((btn) => btn.tagName === 'BUTTON');
			expect(submitBtn).toBeDefined();
			expect(submitBtn).toBeDisabled();

			fireEvent.click(submitBtn);
			expect(apiCall).not.toHaveBeenCalled();
		});

		it('renders (Edited) tooltip badges on both comment and reply bubbles when isEdited is true', () => {
			renderCommentThread();

			// Top-level comment isEdited: true
			const commentEditedBadge = screen.getByTestId('comment-edited-badge');
			expect(commentEditedBadge).toBeInTheDocument();
			expect(commentEditedBadge).toHaveTextContent('(Edited)');

			// Expand replies
			fireEvent.click(screen.getByTestId('toggle-subthread-btn'));

			// Reply 1 isEdited: true
			const replyEditedBadge = screen.getByTestId('reply-edited-badge');
			expect(replyEditedBadge).toBeInTheDocument();
			expect(replyEditedBadge).toHaveTextContent('(Edited)');
		});
	});

	// =========================================================================
	// 3. J5 Pinning & J6 Privacy Stress Testing
	// =========================================================================
	describe('3. J5 Pinning & J6 Privacy Adversarial Suite', () => {
		const basePost = {
			_id: 'post-social-500',
			authorId: 'author-alice',
			authorName: 'Alice Champion',
			title: 'Annual Mason Open Tournament Details',
			content: 'All participants must check in by 8:30 AM at the RAC.',
			visibility: 'PUBLIC',
			isPinned: false,
			createdAt: new Date().toISOString(),
			likes: [],
			comments: [],
		};

		const renderPostWithUser = (post, user) => {
			return render(
				<AuthContext.Provider value={{ user, token: 'fake-jwt-token' }}>
					<BrowserRouter>
						<PostCard post={post} currentUser={user} onBookmarkToggle={vi.fn()} />
					</BrowserRouter>
				</AuthContext.Provider>
			);
		};

		it('allows author to toggle megathread pin and reflects status update', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ message: 'Post pin toggled', isPinned: true }),
			});

			const authorUser = { id: 'author-alice', name: 'Alice Champion', role: 'player' };
			renderPostWithUser(basePost, authorUser);

			// Open 3-dots menu
			const moreBtn = screen.getByRole('button', { name: /more options/i });
			fireEvent.click(moreBtn);

			// Pin option is present for author
			const pinMenuItem = screen.getByRole('menuitem', { name: /📌 Pin Megathread/i });
			expect(pinMenuItem).toBeInTheDocument();
			fireEvent.click(pinMenuItem);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(
					`/api/forum/${basePost._id}/pin`,
					expect.objectContaining({ method: 'PUT' })
				);
			});

			// Pinned ribbon should render
			expect(await screen.findByText('📌 Pinned Megathread')).toBeInTheDocument();
		});

		it('allows admin user to toggle megathread pin even if admin is NOT the author', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ message: 'Post pin toggled', isPinned: true }),
			});

			const adminUser = { id: 'admin-bob', name: 'Bob Admin', role: 'admin' };
			renderPostWithUser(basePost, adminUser);

			const moreBtn = screen.getByRole('button', { name: /more options/i });
			fireEvent.click(moreBtn);

			const pinMenuItem = screen.getByRole('menuitem', { name: /📌 Pin Megathread/i });
			expect(pinMenuItem).toBeInTheDocument();
			fireEvent.click(pinMenuItem);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(
					`/api/forum/${basePost._id}/pin`,
					expect.objectContaining({ method: 'PUT' })
				);
			});
		});

		it('strictly denies non-author non-admin user access to pin megathread (menu item hidden)', () => {
			const regularUser = { id: 'regular-charlie', name: 'Charlie Shuttler', role: 'player' };
			renderPostWithUser(basePost, regularUser);

			const moreBtn = screen.getByRole('button', { name: /more options/i });
			fireEvent.click(moreBtn);

			// Pin Megathread option must NOT exist for regular user
			expect(screen.queryByRole('menuitem', { name: /Pin Megathread/i })).not.toBeInTheDocument();
			// But Report Post and Share Post should exist
			expect(screen.getByRole('menuitem', { name: /🔗 Share Post/i })).toBeInTheDocument();
			expect(screen.getByRole('menuitem', { name: /🚩 Report Post/i })).toBeInTheDocument();
		});

		it('strictly hides 3-dots menu for unauthenticated visitors', () => {
			renderPostWithUser(basePost, null);
			expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument();
		});

		it('renders audience privacy icon for PUBLIC posts', () => {
			const publicPost = { ...basePost, visibility: 'PUBLIC' };
			renderPostWithUser(publicPost, null);

			const iconContainer = screen.getByLabelText(/Privacy: Public/i);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveAttribute('data-testid', 'post-privacy-icon');
		});

		it('renders audience privacy icon for FRIENDS_ONLY posts', () => {
			const friendsPost = { ...basePost, visibility: 'FRIENDS_ONLY' };
			renderPostWithUser(friendsPost, null);

			const iconContainer = screen.getByLabelText(/Privacy: Friends Only/i);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveAttribute('data-testid', 'post-privacy-icon');
		});

		it('renders audience privacy icon for ONLY_ME posts', () => {
			const privatePost = { ...basePost, visibility: 'ONLY_ME' };
			renderPostWithUser(privatePost, null);

			const iconContainer = screen.getByLabelText(/Privacy: Only Me/i);
			expect(iconContainer).toBeInTheDocument();
			expect(iconContainer).toHaveAttribute('data-testid', 'post-privacy-icon');
		});

		it('falls back gracefully to PUBLIC privacy icon when visibility is undefined', () => {
			const unspecPost = { ...basePost, visibility: undefined };
			renderPostWithUser(unspecPost, null);

			const iconContainer = screen.getByLabelText(/Privacy: Public/i);
			expect(iconContainer).toBeInTheDocument();
		});
	});
});
