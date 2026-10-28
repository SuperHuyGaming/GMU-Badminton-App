import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PostCard from './PostCard';
import ShareModal from './ShareModal';
import CommentBubble from './comments/CommentBubble';
import ReplyBubble from './comments/ReplyBubble';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';
import socket from '../utils/socket';
import { toast } from 'react-hot-toast';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

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
	toast: Object.assign(vi.fn(), {
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

describe('Milestone 2 Challenger 1 Adversarial Suite (J1, J7, J9)', () => {
	const mockUser = {
		_id: 'user-challenger-1',
		id: 'user-challenger-1',
		name: 'Challenger One',
		profilePic: 'https://example.com/challenger.jpg',
	};

	const basePost = {
		_id: 'post-test-101',
		authorId: 'user-author-999',
		authorName: 'Alex Shuttle',
		authorPic: 'https://example.com/alex.jpg',
		title: 'Advanced Smash Mechanics Seminar',
		content: 'Join us tomorrow at RAC Court 3 for jump smash footwork drills and biomechanics analysis.',
		category: 'training',
		createdAt: new Date().toISOString(),
		timestamp: new Date().toISOString(),
		reactions: [],
		comments: [],
		likedBy: [],
	};

	const renderPostCard = (post = basePost, user = mockUser, extraProps = {}) => {
		return render(
			<AuthContext.Provider value={{ user, token: 'mock-token' }}>
				<BrowserRouter>
					<PostCard post={post} currentUser={user} {...extraProps} />
				</BrowserRouter>
			</AuthContext.Provider>
		);
	};

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		window.alert = vi.fn();
	});

	// =========================================================================
	// 1. J1 REACTIONS DOCK ADVERSARIAL STRESS TESTS
	// =========================================================================
	describe('1. J1 Reactions Dock Hover/Touch Transitions & Multi-Emoji Stress', () => {
		it('renders reactions dock on mouseEnter and removes it on mouseLeave', async () => {
			renderPostCard();

			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			const reactionBox = reactBtn.closest('.MuiBox-root');
			expect(screen.queryByTestId('reactions-dock')).not.toBeInTheDocument();

			// Trigger hover
			fireEvent.mouseEnter(reactionBox);
			const dock = await screen.findByTestId('reactions-dock');
			expect(dock).toBeInTheDocument();

			// Verify all 6 Facebook reactions are rendered with accessible aria labels
			expect(within(dock).getByRole('button', { name: /React with Like/i })).toBeInTheDocument();
			expect(within(dock).getByRole('button', { name: /React with Love/i })).toBeInTheDocument();
			expect(within(dock).getByRole('button', { name: /React with Smash/i })).toBeInTheDocument();
			expect(within(dock).getByRole('button', { name: /React with Wow/i })).toBeInTheDocument();
			expect(within(dock).getByRole('button', { name: /React with Haha/i })).toBeInTheDocument();
			expect(within(dock).getByRole('button', { name: /React with Sad/i })).toBeInTheDocument();

			// Trigger unhover
			fireEvent.mouseLeave(reactionBox);
			await waitFor(() => {
				expect(screen.queryByTestId('reactions-dock')).not.toBeInTheDocument();
			});
		});

		it('supports mobile long-press touch: quick tap (<400ms) does not show dock, sustained touch (>=400ms) reveals dock', async () => {
			vi.useFakeTimers();
			renderPostCard();

			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			const reactionBox = reactBtn.closest('.MuiBox-root');

			// Quick tap: touchStart then touchEnd after 150ms
			fireEvent.touchStart(reactionBox);
			act(() => {
				vi.advanceTimersByTime(150);
			});
			fireEvent.touchEnd(reactionBox);

			act(() => {
				vi.advanceTimersByTime(300);
			});
			expect(screen.queryByTestId('reactions-dock')).not.toBeInTheDocument();

			// Sustained long-press: touchStart held for 450ms
			fireEvent.touchStart(reactionBox);
			act(() => {
				vi.advanceTimersByTime(450);
			});

			expect(screen.getByTestId('reactions-dock')).toBeInTheDocument();
			vi.useRealTimers();
		});

		it('optimistically updates reaction state to ❤️ and rolls back on API failure (500)', async () => {
			apiFetch.mockRejectedValueOnce(new Error('Network failure: 500 Internal Server Error'));

			renderPostCard();
			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			const reactionBox = reactBtn.closest('.MuiBox-root');

			fireEvent.mouseEnter(reactionBox);
			const dock = await screen.findByTestId('reactions-dock');
			const loveBtn = within(dock).getByRole('button', { name: /React with Love/i });

			// Click Love reaction
			fireEvent.click(loveBtn);

			// 0ms Optimistic check: immediately shows Love ❤️
			expect(within(reactBtn).getByText('❤️')).toBeInTheDocument();
			expect(within(reactBtn).getByText('Love')).toBeInTheDocument();

			// Wait for API rejection to trigger rollback
			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith(
					expect.stringContaining(`/api/forum/${basePost._id}/react`),
					expect.objectContaining({
						method: 'POST',
						body: JSON.stringify({ emoji: '❤️' }),
					})
				);
				// Rolled back to default
				expect(within(reactBtn).getByText('💥')).toBeInTheDocument();
				expect(within(reactBtn).getByText('Smash')).toBeInTheDocument();
			});
		});

		it('optimistically toggles off active reaction and rolls back on API failure (res.ok = false)', async () => {
			const postWithLove = {
				...basePost,
				reactions: [
					{
						userId: mockUser.id,
						userName: mockUser.name,
						emoji: '❤️',
						reactionType: 'love',
					},
				],
			};

			apiFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ message: 'Database transaction lock timeout' }),
			});

			renderPostCard(postWithLove);
			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			expect(within(reactBtn).getByText('❤️')).toBeInTheDocument();
			expect(within(reactBtn).getByText('Love')).toBeInTheDocument();

			// Clicking the main button with active reaction calls handleReaction with the same emoji (toggle off)
			fireEvent.click(reactBtn);

			// Optimistic check: immediately removed, resets to Smash
			expect(within(reactBtn).getByText('💥')).toBeInTheDocument();
			expect(within(reactBtn).getByText('Smash')).toBeInTheDocument();

			// Wait for failed API response to roll back
			await waitFor(() => {
				expect(within(reactBtn).getByText('❤️')).toBeInTheDocument();
				expect(within(reactBtn).getByText('Love')).toBeInTheDocument();
			});
		});

		it('optimistically switches reaction from 👍 to 😂 and rolls back on error', async () => {
			const postWithLike = {
				...basePost,
				reactions: [
					{
						userId: mockUser.id,
						userName: mockUser.name,
						emoji: '👍',
						reactionType: 'like',
					},
				],
			};

			apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

			renderPostCard(postWithLike);
			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			expect(within(reactBtn).getByText('👍')).toBeInTheDocument();
			expect(within(reactBtn).getByText('Like')).toBeInTheDocument();

			// Open dock and select Haha 😂
			const reactionBox = reactBtn.closest('.MuiBox-root');
			fireEvent.mouseEnter(reactionBox);
			const dock = await screen.findByTestId('reactions-dock');
			const hahaBtn = within(dock).getByRole('button', { name: /React with Haha/i });

			fireEvent.click(hahaBtn);

			// Optimistically switched to Haha
			expect(within(reactBtn).getByText('😂')).toBeInTheDocument();
			expect(within(reactBtn).getByText('Haha')).toBeInTheDocument();

			// Rollback restores Like 👍
			await waitFor(() => {
				expect(within(reactBtn).getByText('👍')).toBeInTheDocument();
				expect(within(reactBtn).getByText('Like')).toBeInTheDocument();
			});
		});

		it('empirically survives rapid multi-emoji clicking stress test without crashing or race faults', async () => {
			let callCount = 0;
			apiFetch.mockImplementation(async () => {
				callCount++;
				return {
					ok: true,
					json: async () => ({
						...basePost,
						reactions: [
							{ userId: mockUser.id, emoji: '🏸', reactionType: 'smash' },
						],
					}),
				};
			});

			renderPostCard();
			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			const reactionBox = reactBtn.closest('.MuiBox-root');

			// Hover to reveal dock
			fireEvent.mouseEnter(reactionBox);
			const dock = await screen.findByTestId('reactions-dock');

			const likeBtn = within(dock).getByRole('button', { name: /React with Like/i });
			const loveBtn = within(dock).getByRole('button', { name: /React with Love/i });
			const smashBtn = within(dock).getByRole('button', { name: /React with Smash/i });

			// Rapid fire clicks in immediate succession
			fireEvent.click(likeBtn);
			fireEvent.click(loveBtn);
			fireEvent.click(smashBtn);

			expect(callCount).toBeGreaterThanOrEqual(1);

			await waitFor(() => {
				expect(within(reactBtn).getByText('🏸')).toBeInTheDocument();
				expect(within(reactBtn).getByText('Smash')).toBeInTheDocument();
			});
		});

		it('strictly halts and alerts when unauthenticated user attempts to react', async () => {
			renderPostCard(basePost, null);

			const reactBtn = screen.getByRole('button', { name: /React to post/i });
			fireEvent.click(reactBtn);

			expect(window.alert).toHaveBeenCalledWith(
				expect.stringContaining('You must be logged in to react to posts!')
			);
			expect(apiFetch).not.toHaveBeenCalled();
		});

		it('synchronizes reactions in real-time when Socket.io reactionUpdated event fires', async () => {
			let socketHandler = null;
			socket.on.mockImplementation((event, handler) => {
				if (event === 'reactionUpdated') {
					socketHandler = handler;
				}
			});

			renderPostCard();

			expect(socket.on).toHaveBeenCalledWith('reactionUpdated', expect.any(Function));
			expect(socketHandler).toBeTypeOf('function');

			// Simulate socket event from another user reacting
			act(() => {
				socketHandler({
					postId: basePost._id,
					reactions: [
						{ userId: 'u-1', userName: 'Player 1', emoji: '❤️', reactionType: 'love' },
						{ userId: 'u-2', userName: 'Player 2', emoji: '😮', reactionType: 'wow' },
						{ userId: 'u-3', userName: 'Player 3', emoji: '🏸', reactionType: 'smash' },
					],
				});
			});

			await waitFor(() => {
				const reactionsBtn = screen.getByTestId('view-reactions-btn');
				expect(reactionsBtn).toHaveTextContent('3');
			});

			// Simulate socket event for a DIFFERENT post — must NOT affect this post
			act(() => {
				socketHandler({
					postId: 'different-post-888',
					reactions: [],
				});
			});

			// Count remains 3
			expect(screen.getByTestId('view-reactions-btn')).toHaveTextContent('3');

			// Simulate socket event with empty reactions (all removed)
			act(() => {
				socketHandler({
					postId: basePost._id,
					reactions: [],
				});
			});

			await waitFor(() => {
				expect(screen.queryByTestId('view-reactions-btn')).not.toBeInTheDocument();
			});
		});
	});

	// =========================================================================
	// 2. J7 SHAREMODAL & QUOTE PREVIEWS ADVERSARIAL STRESS TESTS
	// =========================================================================
	describe('2. J7 ShareModal & Quote Previews Adversarial Suite', () => {
		const sampleRepost = {
			...basePost,
			_id: 'repost-202',
			title: 'Repost: Regional Tournament Schedule',
			content: 'Check out the bracket schedule guys, we play at 9 AM!',
			originalPostId: 'orig-post-555',
			originalPost: {
				_id: 'orig-post-555',
				title: 'Collegiate Mid-Atlantic Open Draw',
				content: 'Draws and seeds are officially locked in for both Men and Women Singles.',
				authorName: 'Tournament Director',
				authorPic: 'https://example.com/td.jpg',
				category: 'match_result',
				imageUrls: ['https://example.com/bracket.png'],
			},
		};

		it('renders quote preview card with author, title, content snippet, and image thumbnail', () => {
			renderPostCard(sampleRepost);

			const quoteCard = screen.getByTestId('post-quote-card');
			expect(quoteCard).toBeInTheDocument();
			expect(within(quoteCard).getByText('Tournament Director')).toBeInTheDocument();
			expect(within(quoteCard).getByText(/Match Result/)).toBeInTheDocument();
			expect(within(quoteCard).getByText('Collegiate Mid-Atlantic Open Draw')).toBeInTheDocument();
			expect(within(quoteCard).getByText(/Draws and seeds are officially locked in/)).toBeInTheDocument();

			const thumbnail = within(quoteCard).getByAltText('Original post thumbnail');
			expect(thumbnail).toHaveAttribute('src', 'https://example.com/bracket.png');
		});

		it('gracefully renders fallback values when originalPost is missing/unpopulated', () => {
			const unpopulatedRepost = {
				...basePost,
				_id: 'repost-203',
				originalPostId: 'orig-post-unpopulated',
				originalPost: null,
			};

			renderPostCard(unpopulatedRepost);

			const quoteCard = screen.getByTestId('post-quote-card');
			expect(quoteCard).toBeInTheDocument();
			expect(within(quoteCard).getByText('Club Member')).toBeInTheDocument();
			expect(within(quoteCard).getByText('Click to view original discussion')).toBeInTheDocument();
		});

		it('handles navigation on click and keyboard accessibility (Enter/Space) on quote card', () => {
			renderPostCard(sampleRepost);

			const quoteCard = screen.getByTestId('post-quote-card');

			// Click
			fireEvent.click(quoteCard);
			expect(mockNavigate).toHaveBeenCalledWith('/community#post-orig-post-555');

			// Keyboard Enter
			mockNavigate.mockClear();
			fireEvent.keyDown(quoteCard, { key: 'Enter' });
			expect(mockNavigate).toHaveBeenCalledWith('/community#post-orig-post-555');

			// Keyboard Space
			mockNavigate.mockClear();
			fireEvent.keyDown(quoteCard, { key: ' ' });
			expect(mockNavigate).toHaveBeenCalledWith('/community#post-orig-post-555');
		});

		it('ShareModal: submits thoughts and originalPostId to /api/forum with toast feedback', async () => {
			const onClose = vi.fn();
			const onShareSuccess = vi.fn();
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ _id: 'new-shared-post-303' }),
			});

			render(
				<ShareModal
					open={true}
					onClose={onClose}
					post={basePost}
					currentUser={mockUser}
					onShareSuccess={onShareSuccess}
				/>
			);

			const thoughtsInput = screen.getByTestId('share-thoughts-input');
			fireEvent.change(thoughtsInput, { target: { value: 'Incredible smash tips from Alex!' } });

			const submitBtn = screen.getByTestId('share-to-feed-btn');
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith('/api/forum', {
					method: 'POST',
					body: JSON.stringify({
						title: `Repost: ${basePost.title}`,
						content: 'Incredible smash tips from Alex!',
						originalPostId: basePost._id,
						isRepost: true,
						visibility: 'PUBLIC',
					}),
				});
				expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Post shared to your feed'));
				expect(onShareSuccess).toHaveBeenCalled();
				expect(onClose).toHaveBeenCalled();
			});
		});

		it('ShareModal: gracefully falls back to default content when user enters empty/whitespace thoughts', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ _id: 'repost-whitespace' }),
			});

			render(
				<ShareModal
					open={true}
					onClose={vi.fn()}
					post={basePost}
					currentUser={mockUser}
				/>
			);

			const thoughtsInput = screen.getByTestId('share-thoughts-input');
			fireEvent.change(thoughtsInput, { target: { value: '     ' } });

			const submitBtn = screen.getByTestId('share-to-feed-btn');
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(apiFetch).toHaveBeenCalledWith('/api/forum', {
					method: 'POST',
					body: JSON.stringify({
						title: `Repost: ${basePost.title}`,
						content: `Shared a post by ${basePost.authorName}`,
						originalPostId: basePost._id,
						isRepost: true,
						visibility: 'PUBLIC',
					}),
				});
			});
		});

		it('ShareModal: displays error toast when backend rejects post creation', async () => {
			apiFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ message: 'Rate limit: Max 5 reposts per hour' }),
			});

			render(
				<ShareModal
					open={true}
					onClose={vi.fn()}
					post={basePost}
					currentUser={mockUser}
				/>
			);

			const submitBtn = screen.getByTestId('share-to-feed-btn');
			fireEvent.click(submitBtn);

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Rate limit: Max 5 reposts per hour');
			});
		});

		it('ShareModal: handles clipboard copy rejection gracefully and executes toast fallback', async () => {
			const onClose = vi.fn();
			const failingWriteText = vi.fn().mockRejectedValue(new Error('Clipboard permission denied'));
			Object.assign(navigator, {
				clipboard: {
					writeText: failingWriteText,
				},
			});

			render(
				<ShareModal
					open={true}
					onClose={onClose}
					post={basePost}
					currentUser={mockUser}
				/>
			);

			const copyBtn = screen.getByTestId('copy-link-btn');
			fireEvent.click(copyBtn);

			await waitFor(() => {
				expect(failingWriteText).toHaveBeenCalled();
				// Fallback toast is invoked with URL directly
				expect(toast).toHaveBeenCalledWith(expect.stringContaining(`/community#post-${basePost._id}`));
				expect(onClose).toHaveBeenCalled();
			});
		});

		it('ShareModal: handles Send via Direct Message button with clipboard fallback', async () => {
			const onClose = vi.fn();
			const failingWriteText = vi.fn().mockRejectedValue(new Error('Clipboard blocked in iframe'));
			Object.assign(navigator, {
				clipboard: {
					writeText: failingWriteText,
				},
			});

			render(
				<ShareModal
					open={true}
					onClose={onClose}
					post={basePost}
					currentUser={mockUser}
				/>
			);

			const sendDmBtn = screen.getByTestId('send-dm-btn');
			fireEvent.click(sendDmBtn);

			await waitFor(() => {
				expect(failingWriteText).toHaveBeenCalled();
				expect(toast).toHaveBeenCalledWith(expect.stringContaining(`/community#post-${basePost._id}`));
				expect(onClose).toHaveBeenCalled();
			});
		});
	});

	// =========================================================================
	// 3. J9 EDIT TOOLTIPS & TIMESTAMP TRANSPARENCY ADVERSARIAL STRESS TESTS
	// =========================================================================
	describe('3. J9 Edit Tooltips & Formatting Adversarial Suite', () => {
		it('renders (Edited) badge on PostCard when isEdited is true and hides when false', () => {
			const uneditedPost = { ...basePost, isEdited: false };
			const { unmount } = renderPostCard(uneditedPost);
			expect(screen.queryByTestId('post-edited-badge')).not.toBeInTheDocument();
			unmount();

			const editedPost = {
				...basePost,
				isEdited: true,
				editedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
			};
			renderPostCard(editedPost);
			const badge = screen.getByTestId('post-edited-badge');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('(Edited)');
		});

		it('renders (Edited) badge on CommentBubble when isEdited is true', () => {
			const mockComment = {
				_id: 'comment-1',
				authorId: 'u-1',
				authorName: 'Lin Dan',
				content: 'Solid analysis on racket tension!',
				timestamp: new Date().toISOString(),
				isEdited: true,
				editedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
				likes: [],
			};

			const formatTime = (ts) => (ts ? '2h ago' : 'Just now');

			render(
				<BrowserRouter>
					<CommentBubble
						comment={mockComment}
						localPostId="post-1"
						postAuthorId="u-1"
						currentUser={mockUser}
						formatTime={formatTime}
						renderContentWithTags={(content) => content}
					/>
				</BrowserRouter>
			);

			const badge = screen.getByTestId('comment-edited-badge');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('(Edited)');
		});

		it('renders (Edited) badge on ReplyBubble when isEdited is true', () => {
			const mockReply = {
				_id: 'reply-1',
				authorId: 'u-2',
				authorName: 'Lee Chong Wei',
				content: 'Agreed, 28 lbs BG80 gives great repulsion.',
				timestamp: new Date().toISOString(),
				isEdited: true,
				editedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
				likes: [],
			};

			const formatTime = (ts) => (ts ? '30m ago' : 'Just now');

			render(
				<BrowserRouter>
					<ReplyBubble
						reply={mockReply}
						commentId="c-1"
						localPostId="p-1"
						postAuthorId="u-1"
						currentUser={mockUser}
						formatTime={formatTime}
						renderContentWithTags={(content) => content}
					/>
				</BrowserRouter>
			);

			const badge = screen.getByTestId('reply-edited-badge');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('(Edited)');
		});

		it('empirically validates relative date formatting across boundary conditions in PostCard', () => {
			// Helper to test PostCard relative formatting logic
			const now = Date.now();
			const testCases = [
				{ time: new Date(now - 10 * 1000).toISOString(), expectedRegex: /Just now/ },
				{ time: new Date(now - 45 * 1000).toISOString(), expectedRegex: /Just now/ },
				{ time: new Date(now - 5 * 60 * 1000).toISOString(), expectedRegex: /5m ago/ },
				{ time: new Date(now - 3 * 60 * 60 * 1000).toISOString(), expectedRegex: /3h ago/ },
				{ time: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), expectedRegex: /2d ago/ },
				{ time: null, expectedRegex: /Just now/ },
			];

			testCases.forEach(({ time, expectedRegex }) => {
				const post = {
					...basePost,
					timestamp: time,
				};
				const { unmount } = renderPostCard(post);
				expect(screen.getByText(expectedRegex)).toBeInTheDocument();
				unmount();
			});
		});
	});
});
