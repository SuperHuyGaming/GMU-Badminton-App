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
		{ userId: 'u1', userName: 'Alice Wong', emoji: '💥', reactionType: 'smash', profilePic: 'https://example.com/alice.jpg' },
		{ userId: 'u2', userName: 'Bob Chen', emoji: '🧊', reactionType: 'ice_drop' },
		{ userId: 'u3', userName: 'Charlie Kim', emoji: '⚡', reactionType: 'clutch' },
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

	it('renders reaction tabs for All, Smash, Ice Drop, Clutch with correct counts', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByTestId('likes-modal-tab-all')).toHaveTextContent('All (4)');
		expect(screen.getByTestId('likes-modal-tab-smash')).toHaveTextContent('💥 1');
		expect(screen.getByTestId('likes-modal-tab-ice_drop')).toHaveTextContent('🧊 1');
		expect(screen.getByTestId('likes-modal-tab-clutch')).toHaveTextContent('⚡ 1');
	});

	it('filters user list when switching tabs to 💥 Smash', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		expect(screen.getByText('Alice Wong')).toBeInTheDocument();
		expect(screen.getByText('Bob Chen')).toBeInTheDocument();

		// Click Smash tab
		const smashTab = screen.getByTestId('likes-modal-tab-smash');
		fireEvent.click(smashTab);

		expect(screen.getByText('Alice Wong')).toBeInTheDocument();
		expect(screen.queryByText('Bob Chen')).not.toBeInTheDocument();
		expect(screen.queryByText('Charlie Kim')).not.toBeInTheDocument();
	});

	it('filters user list when switching tabs to 🧊 Ice Drop', () => {
		render(
			<BrowserRouter>
				<LikesModal open={true} title="Post Reactions" list={sampleLikes} reactions={sampleReactions} onClose={vi.fn()} />
			</BrowserRouter>
		);

		const iceTab = screen.getByTestId('likes-modal-tab-ice_drop');
		fireEvent.click(iceTab);

		expect(screen.getByText('Bob Chen')).toBeInTheDocument();
		expect(screen.queryByText('Alice Wong')).not.toBeInTheDocument();
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
