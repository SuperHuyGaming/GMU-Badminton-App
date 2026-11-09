import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostCommentsInline from './PostCommentsInline';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-hot-toast';
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
	default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
	toast: Object.assign(vi.fn(), {
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock('../utils/socket', () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
	},
}));

describe('PostCommentsInline Phase 8 QA Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockPost = {
		_id: 'post-100',
		authorId: 'author-1',
		authorName: 'Alex Author',
		comments: [
			{
				_id: 'c-1',
				authorId: 'author-1',
				authorName: 'Alex Author',
				content: 'First comment here',
				createdAt: '2026-10-20T10:00:00Z',
				likedBy: ['u1', 'u2', 'u3'],
				replies: [
					{
						_id: 'r-1',
						authorId: 'reply-1',
						authorName: 'Ben Player',
						content: 'Replying to Alex @Alex Author',
						createdAt: '2026-10-20T10:05:00Z',
					},
				],
			},
			{
				_id: 'c-2',
				authorId: 'author-2',
				authorName: 'Charlie Shuttler',
				content: 'Second comment but newest',
				createdAt: '2026-10-25T12:00:00Z',
				likedBy: [],
				replies: [],
			},
		],
	};

	const mockUser = {
		id: 'viewer-1',
		name: 'Viewer Player',
	};

	const renderComments = (post = mockPost, user = mockUser) => {
		return render(
			<BrowserRouter>
				<PostCommentsInline
					localPost={post}
					setLocalPost={vi.fn()}
					currentUser={user}
					highlightId={null}
					openLikes={vi.fn()}
				/>
			</BrowserRouter>
		);
	};

	it('renders comments header and comment sort dropdown', () => {
		renderComments();
		expect(screen.getByText('2 Comments')).toBeInTheDocument();
		expect(screen.getByTestId('comment-sort-select')).toBeInTheDocument();
	});

	it('sorts comments by Top by default (c-1 has 3 likes + 1 reply)', () => {
		renderComments();
		const commentTexts = screen.getAllByText(/comment/i);
		expect(commentTexts.length).toBeGreaterThan(0);
		expect(screen.getByText('First comment here')).toBeInTheDocument();
		expect(screen.getByText('Second comment but newest')).toBeInTheDocument();
	});

	it('allows switching sort mode to Newest', () => {
		renderComments();
		const sortSelect = screen.getByTestId('comment-sort-select');
		expect(sortSelect).toBeInTheDocument();

		// Change sort to newest
		const input = sortSelect.querySelector('input') || sortSelect;
		fireEvent.change(input, { target: { value: 'newest' } });
	});

	it('toggles nested subthread replies and reveals subthread-container', () => {
		renderComments();
		const toggleBtn = screen.getByTestId('toggle-subthread-btn');
		expect(toggleBtn).toBeInTheDocument();
		expect(toggleBtn).toHaveTextContent(/View 1 replies/i);

		// Click to expand
		fireEvent.click(toggleBtn);
		expect(screen.getByTestId('subthread-container')).toBeInTheDocument();
		expect(screen.getByText(/Replying to Alex/i)).toBeInTheDocument();

		// Click to hide
		fireEvent.click(toggleBtn);
		expect(screen.queryByTestId('subthread-container')).not.toBeInTheDocument();
	});

	it('triggers @mention autocomplete popover when typing @ in comment box and inserts user on selection', () => {
		renderComments();
		const input = screen.getByPlaceholderText(/Write a comment/i);
		expect(input).toBeInTheDocument();

		// Type @Al
		fireEvent.change(input, { target: { value: 'Hey @Al' } });

		// Autocomplete menu appears
		expect(screen.getByTestId('mention-autocomplete-menu')).toBeInTheDocument();
		expect(screen.getByText('@Alex Author')).toBeInTheDocument();

		// Select suggestion
		fireEvent.click(screen.getByText('@Alex Author'));

		// Mentions inserted into input
		expect(input.value).toBe('Hey @Alex Author ');
		expect(screen.queryByTestId('mention-autocomplete-menu')).not.toBeInTheDocument();
	});

	it('renders parsed @mentions as clickable links navigating to profile', () => {
		renderComments();
		const toggleBtn = screen.getByTestId('toggle-subthread-btn');
		fireEvent.click(toggleBtn);

		const mentionTag = screen.getByText('@Alex Author');
		expect(mentionTag).toBeInTheDocument();
		fireEvent.click(mentionTag);

		expect(mockNavigate).toHaveBeenCalledWith('/profile/author-1');
	});

	// ── Community audit fixes ──
	const renderWithSetter = (user = mockUser) => {
		const setLocalPost = vi.fn();
		render(
			<BrowserRouter>
				<PostCommentsInline
					localPost={mockPost}
					setLocalPost={setLocalPost}
					currentUser={user}
					highlightId={null}
					openLikes={vi.fn()}
				/>
			</BrowserRouter>
		);
		return { setLocalPost };
	};

	it('keeps the typed comment and shows the server message when posting fails', async () => {
		apiFetch.mockRejectedValueOnce(new Error('You are commenting too fast. Please wait a moment.'));
		const { setLocalPost } = renderWithSetter();

		const input = screen.getByPlaceholderText(/Write a comment/i);
		fireEvent.change(input, { target: { value: 'My important comment' } });
		fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('You are commenting too fast. Please wait a moment.');
		});
		expect(input.value).toBe('My important comment');
		expect(setLocalPost).not.toHaveBeenCalled();
	});

	it('keeps the typed comment when the request comes back { ok: false } (offline)', async () => {
		apiFetch.mockResolvedValueOnce({ ok: false, status: 0, json: async () => ({ message: 'Network offline' }) });
		renderWithSetter();

		const input = screen.getByPlaceholderText(/Write a comment/i);
		fireEvent.change(input, { target: { value: 'Offline comment' } });
		fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network offline'));
		expect(input.value).toBe('Offline comment');
	});

	it('clears the comment box only after the server accepted the comment', async () => {
		const updatedPost = { ...mockPost, comments: [...mockPost.comments] };
		apiFetch.mockResolvedValueOnce({ ok: true, json: async () => updatedPost });
		const { setLocalPost } = renderWithSetter();

		const input = screen.getByPlaceholderText(/Write a comment/i);
		fireEvent.change(input, { target: { value: 'Accepted comment' } });
		fireEvent.click(screen.getByRole('button', { name: /^Post$/ }));

		await waitFor(() => expect(input.value).toBe(''));
		expect(apiFetch).toHaveBeenCalledWith(
			`/api/forum/${mockPost._id}/comments`,
			expect.objectContaining({ method: 'POST', body: expect.stringContaining('Accepted comment') })
		);
		expect(setLocalPost).toHaveBeenCalledWith(updatedPost);
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('shows the server message when liking a comment fails', async () => {
		apiFetch.mockRejectedValueOnce(new Error('Comment not found'));
		renderWithSetter();

		fireEvent.click(screen.getAllByRole('button', { name: /^Like$/ })[0]);

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Comment not found'));
	});

	it('uses a toast (not a browser alert) when a signed-out visitor tries to like a comment', () => {
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
		renderWithSetter(null);

		fireEvent.click(screen.getAllByRole('button', { name: /^Like$/ })[0]);

		expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/log in/i));
		expect(alertSpy).not.toHaveBeenCalled();
		expect(apiFetch).not.toHaveBeenCalled();
		alertSpy.mockRestore();
	});

	describe('loading, error and empty states', () => {
		const emptyPost = {
			_id: 'post-empty',
			authorId: 'author-1',
			authorName: 'Alex Author',
			comments: [],
		};

		it('shows a small inline loading indicator (not empty state) while loading with no comments', () => {
			render(
				<BrowserRouter>
					<PostCommentsInline
						localPost={emptyPost}
						setLocalPost={vi.fn()}
						currentUser={mockUser}
						openLikes={vi.fn()}
						isLoading={true}
					/>
				</BrowserRouter>
			);

			expect(screen.getByTestId('comments-loading-indicator')).toBeInTheDocument();
			expect(screen.getByText('Loading comments...')).toBeInTheDocument();
			expect(screen.queryByTestId('comments-empty-state')).not.toBeInTheDocument();
			expect(screen.queryByText('No comments yet')).not.toBeInTheDocument();
		});

		it('shows an error message and Retry button when loading fails with no comments', () => {
			const onRetryMock = vi.fn();
			render(
				<BrowserRouter>
					<PostCommentsInline
						localPost={emptyPost}
						setLocalPost={vi.fn()}
						currentUser={mockUser}
						openLikes={vi.fn()}
						error="Failed to load comments"
						onRetry={onRetryMock}
					/>
				</BrowserRouter>
			);

			expect(screen.getByTestId('comments-error-state')).toBeInTheDocument();
			expect(screen.getByText('Failed to load comments')).toBeInTheDocument();
			const retryBtn = screen.getByRole('button', { name: /Retry/i });
			expect(retryBtn).toBeInTheDocument();
			expect(screen.queryByTestId('comments-empty-state')).not.toBeInTheDocument();

			fireEvent.click(retryBtn);
			expect(onRetryMock).toHaveBeenCalledTimes(1);
		});

		it('keeps showing existing comments with no error if a refresh fails', () => {
			render(
				<BrowserRouter>
					<PostCommentsInline
						localPost={mockPost}
						setLocalPost={vi.fn()}
						currentUser={mockUser}
						openLikes={vi.fn()}
						error="Refresh failed"
					/>
				</BrowserRouter>
			);

			expect(screen.getByText('First comment here')).toBeInTheDocument();
			expect(screen.queryByTestId('comments-error-state')).not.toBeInTheDocument();
			expect(screen.queryByTestId('comments-empty-state')).not.toBeInTheDocument();
		});

		it('shows "No comments yet" only after a successful response with zero comments', () => {
			render(
				<BrowserRouter>
					<PostCommentsInline
						localPost={emptyPost}
						setLocalPost={vi.fn()}
						currentUser={mockUser}
						openLikes={vi.fn()}
						isLoading={false}
						error={null}
					/>
				</BrowserRouter>
			);

			expect(screen.getByTestId('comments-empty-state')).toBeInTheDocument();
			expect(screen.getByText('No comments yet')).toBeInTheDocument();
			expect(screen.queryByTestId('comments-loading-indicator')).not.toBeInTheDocument();
			expect(screen.queryByTestId('comments-error-state')).not.toBeInTheDocument();
		});
	});
});
