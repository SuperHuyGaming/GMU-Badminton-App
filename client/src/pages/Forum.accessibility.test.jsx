import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Forum from './Forum';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

vi.mock('../utils/api', () => ({
	default: vi.fn()
}));

let socketHandlers = {};
vi.mock('../utils/socket', () => ({
	default: {
		on: vi.fn((event, cb) => { socketHandlers[event] = cb; }),
		off: vi.fn((event) => { delete socketHandlers[event]; }),
		emit: vi.fn()
	}
}));

vi.mock('@mui/lab/Masonry', () => ({
	default: ({ children }) => <div data-testid="masonry-mock">{children}</div>
}));

vi.mock('../components/PostCard', () => ({
	default: ({ post }) => (
		<article data-testid={`post-card-${post._id}`} aria-label={post.title}>
			<h3>{post.title}</h3>
			<p>{post.content}</p>
		</article>
	)
}));

const mockUser = { id: 'admin1', name: 'Admin Officer', role: 'admin' };

describe('Community Hub Phase 10: Accessibility (WCAG 2.1 AA) & Keyboard Navigation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		socketHandlers = {};
		window.IntersectionObserver = vi.fn().mockImplementation(() => ({
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn()
		}));
	});

	const renderWithProviders = (user = mockUser) => {
		return render(
			<AuthContext.Provider value={{ user, token: 'mock-token' }}>
				<BrowserRouter>
					<Forum />
				</BrowserRouter>
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

		// Search input accessible label
		const searchInput = screen.getByRole('textbox', { name: /Search community posts/i });
		expect(searchInput).toBeInTheDocument();
	});

	it('focuses search input when pressing "/" keyboard shortcut', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ feed: [], hasMore: false, tags: [] })
		});

		renderWithProviders();
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		const searchInput = screen.getByRole('textbox', { name: /Search community posts/i });

		// Trigger global '/' keydown
		fireEvent.keyDown(window, { key: '/', code: 'Slash' });

		expect(document.activeElement).toBe(searchInput);
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

	it('renders accessible Admin Moderation Queue dialog with aria-labelledby when triggered by admin', async () => {
		apiFetch.mockImplementation((url) => {
			if (url.includes('/reports')) {
				return Promise.resolve({ ok: true, json: async () => [] });
			}
			return Promise.resolve({ ok: true, json: async () => ({ feed: [], hasMore: false, tags: [] }) });
		});

		renderWithProviders();
		await waitFor(() => expect(screen.getByText('Community Hub')).toBeInTheDocument());

		const modBtn = screen.getByTestId('admin-moderation-queue-btn');
		fireEvent.click(modBtn);

		const dialogs = await screen.findAllByRole('dialog');
		const modDialog = dialogs.find(d => d.getAttribute('aria-labelledby') === 'moderation-queue-dialog-title');
		expect(modDialog).toBeInTheDocument();
	});
});
