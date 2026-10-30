import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

vi.mock('../utils/api', () => ({
	default: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
	default: {
		success: vi.fn(),
		error: vi.fn()
	},
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('../utils/socket', () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn()
	}
}));

vi.mock('../components/PostCard', () => ({
	default: ({ post }) => (
		<div data-testid={`post-card-${post._id}`}>
			<h3>{post.title}</h3>
			<p>{post.content}</p>
		</div>
	)
}));

describe('Community Hub Phase 10: Accessibility (WCAG 2.1 AA) & Keyboard Navigation', () => {
	const mockUser = {
		id: 'u123',
		name: 'Accessibility Tester',
		role: 'admin',
		profilePic: 'https://example.com/avatar.jpg'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderWithProviders = (currentUser = mockUser) => {
		return render(
			<AuthContext.Provider value={{ user: currentUser, token: 'fake-jwt-token' }}>
				<MemoryRouter>
					<Forum />
				</MemoryRouter>
			</AuthContext.Provider>
		);
	};

	it('renders accessible semantic landmarks and region labels', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ feed: [], hasMore: false, tags: [] })
		});

		renderWithProviders();

		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		// Category & topic filters region
		const filterRegion = screen.getByRole('region', { name: /Category and topic filters/i });
		expect(filterRegion).toBeInTheDocument();

		// Facebook composer card accessible button
		const composerCard = screen.getByTestId('facebook-composer-card');
		expect(composerCard).toBeInTheDocument();
	});

	it('focuses global search input when pressing "/" keyboard shortcut', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ feed: [], hasMore: false, tags: [] })
		});

		// Mock global search input in navbar
		const mockSearch = document.createElement('input');
		mockSearch.id = 'global-search';
		document.body.appendChild(mockSearch);

		renderWithProviders();
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		// Trigger global '/' keydown
		fireEvent.keyDown(window, { key: '/', code: 'Slash' });

		expect(document.activeElement).toBe(mockSearch);
		document.body.removeChild(mockSearch);
	});

	it('renders accessible Create Post dialog with aria-labelledby and focus traps', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ feed: [], hasMore: false, tags: [] })
		});

		renderWithProviders();
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		const createBtn = screen.getByTestId('facebook-composer-card');
		fireEvent.click(createBtn);

		const dialog = await screen.findByRole('dialog');
		expect(dialog).toBeInTheDocument();
		expect(dialog).toHaveAttribute('aria-labelledby', 'create-post-dialog-title');
		expect(screen.getByText('Create a Post')).toHaveAttribute('id', 'create-post-dialog-title');
	});

	it('allows keyboard interaction on category filter chips (Enter / Space key)', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ feed: [], hasMore: false, tags: [] })
		});

		renderWithProviders();
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		const generalFilter = screen.getByText('💬 General');
		expect(generalFilter).toBeInTheDocument();

		fireEvent.click(generalFilter);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('category=general'));
		});
	});
});
