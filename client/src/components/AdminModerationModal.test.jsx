import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminModerationModal from './AdminModerationModal';

vi.mock('../utils/api', () => ({
	default: vi.fn(),
}));

import apiFetch from '../utils/api';

describe('AdminModerationModal Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders empty state when there are zero reports', async () => {
		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => []
		});

		render(<AdminModerationModal open={true} onClose={vi.fn()} />);

		expect(await screen.findByText(/Community is Safe & Clean!/i)).toBeInTheDocument();
	});

	it('renders reported posts and allows approving a post', async () => {
		const mockReported = [
			{
				_id: 'post_123',
				title: 'Reported Post Title',
				content: 'Suspicious link preview here',
				authorName: 'Bad Actor',
				category: 'General',
				status: 'quarantined',
				isFlagged: true,
				reports: [{ reportedBy: { name: 'Vigilant User' }, reason: 'Spam URL' }]
			}
		];

		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockReported
		});

		const onPostResolvedMock = vi.fn();

		render(<AdminModerationModal open={true} onClose={vi.fn()} onPostResolved={onPostResolvedMock} />);

		expect(await screen.findByText('Reported Post Title')).toBeInTheDocument();
		expect(screen.getByText('Quarantined')).toBeInTheDocument();
		expect(screen.getByText(/1 report/i)).toBeInTheDocument();

		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ message: 'Post approved' })
		});

		const approveBtn = screen.getByRole('button', { name: /Approve & Clear/i });
		fireEvent.click(approveBtn);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(
				'/api/forum/reports/post_123/resolve',
				expect.objectContaining({
					method: 'PUT',
					body: JSON.stringify({ action: 'approve' })
				})
			);
			expect(onPostResolvedMock).toHaveBeenCalledWith('post_123', 'approve');
		});
	});
});
