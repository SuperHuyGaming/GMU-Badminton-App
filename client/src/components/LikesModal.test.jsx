import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LikesModal from './LikesModal';
import { BrowserRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

describe('LikesModal Component Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const sampleReactions = [
		{ userId: 'u1', userName: 'Alice Wong', emoji: '👍', reactionType: 'like', profilePic: 'https://example.com/alice.jpg' },
		{ userId: 'u2', userName: 'Bob Chen', emoji: '❤️', reactionType: 'love' },
		{ userId: 'u3', userName: 'Charlie Kim', emoji: '😂', reactionType: 'haha' },
	];

	const sampleLikes = [
		{ id: 'u4', name: 'David Lee', profilePic: '' }
	];

	it('renders dialog title and close button', () => {
		const onClose = vi.fn();
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={onClose} />
			</BrowserRouter>
		);

		expect(screen.getByText('Post Reactions')).toBeInTheDocument();
		const closeBtn = screen.getByTestId('likes-modal-close-btn');
		expect(closeBtn).toBeInTheDocument();
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it('renders canonical Facebook reaction tabs for All, Like, Love, Haha with correct counts', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByTestId('likes-modal-tab-all')).toHaveTextContent('All (4)');
		expect(screen.getByTestId('likes-modal-tab-like')).toHaveTextContent('👍 2');
		expect(screen.getByTestId('likes-modal-tab-love')).toHaveTextContent('❤️ 1');
		expect(screen.getByTestId('likes-modal-tab-haha')).toHaveTextContent('😂 1');
	});

	it('filters user list when switching tabs to ❤️ Love', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByText('Alice Wong')).toBeInTheDocument();
		expect(screen.getByText('Bob Chen')).toBeInTheDocument();

		// Click Love tab
		const loveTab = screen.getByTestId('likes-modal-tab-love');
		fireEvent.click(loveTab);

		expect(screen.getByText('Bob Chen')).toBeInTheDocument();
		expect(screen.queryByText('Alice Wong')).not.toBeInTheDocument();
		expect(screen.queryByText('Charlie Kim')).not.toBeInTheDocument();
	});

	it('filters user list when switching tabs to 👍 Like', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		const likeTab = screen.getByTestId('likes-modal-tab-like');
		fireEvent.click(likeTab);

		expect(screen.getByText('Alice Wong')).toBeInTheDocument();
		expect(screen.getByText('David Lee')).toBeInTheDocument();
		expect(screen.queryByText('Bob Chen')).not.toBeInTheDocument();
	});

	it('seamlessly maps legacy reactions (💥, 🧊) to Like tab without breaking', () => {
		const legacyReactions = [
			{ userId: 'u-leg-1', userName: 'Old Player', emoji: '💥', reactionType: 'smash' },
		];
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={[]} reactions={legacyReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByTestId('likes-modal-tab-all')).toHaveTextContent('All (1)');
		expect(screen.getByTestId('likes-modal-tab-like')).toHaveTextContent('👍 1');
		expect(screen.getByText('Old Player')).toBeInTheDocument();
	});

	it('navigates to player profile when clicking a user row', () => {
		const onClose = vi.fn();
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={onClose} />
			</BrowserRouter>
		);

		const aliceRow = screen.getByText('Alice Wong');
		fireEvent.click(aliceRow);

		expect(mockNavigate).toHaveBeenCalledWith('/profile/u1');
		expect(onClose).toHaveBeenCalled();
	});

	it('displays empty state when list has no entries', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={[]} reactions={[]} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByText('No reactions in this category.')).toBeInTheDocument();
	});
});
