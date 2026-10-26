import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostCommentsInline from './PostCommentsInline';
import { BrowserRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

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
});
