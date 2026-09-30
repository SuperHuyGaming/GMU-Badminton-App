import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FriendActionButton from './FriendActionButton';
import apiFetch from '../utils/api';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

vi.mock('../utils/api', () => ({
  default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FriendActionButton Component', () => {
  const mockUser = {
    id: 'user_self_123',
    name: 'Self User',
  };

  const renderWithAuth = (ui, authValue = { user: mockUser }) => {
    return render(
      <AuthContext.Provider value={authValue}>
        {ui}
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Add Friend" button by default when initialStatus is "none"', () => {
    renderWithAuth(
      <FriendActionButton targetUserId="target_user_456" targetUserName="Bob" />
    );

    const button = screen.getByRole('button', { name: /add friend for bob/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Add Friend');
  });

  it('renders "Request Sent" and is disabled when initialStatus is "pending"', () => {
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        initialStatus="pending"
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Request Sent');
  });

  it('renders "Friends" and is disabled when initialStatus is "friends"', () => {
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        initialStatus="friends"
      />
    );

    const button = screen.getByRole('button', { name: /friends for bob/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Friends');
  });

  it('renders "Accept Request" when initialStatus is "request_received"', () => {
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        initialStatus="request_received"
      />
    );

    const button = screen.getByRole('button', { name: /accept request for bob/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Accept Request');
  });

  it('does not render anything if targetUserId matches current user id', () => {
    const { container } = renderWithAuth(
      <FriendActionButton targetUserId="user_self_123" targetUserName="Self" />
    );

    expect(container.firstChild).toBeNull();
  });

  it('optimistically transitions to "Cancel Request" (disabled) on click and calls apiFetch', async () => {
    let resolveApi;
    apiFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApi = resolve;
        })
    );

    const onStatusChange = vi.fn();
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        onStatusChange={onStatusChange}
      />
    );

    const button = screen.getByRole('button', { name: /add friend for bob/i });
    fireEvent.click(button);

    // Optimistic transition
    expect(onStatusChange).toHaveBeenCalledWith('pending', 'target_user_456');
    expect(screen.getByRole('button')).toHaveTextContent('Request Sent');
    expect(screen.getByRole('button')).toBeDisabled();

    // Resolve API
    resolveApi({ ok: true, json: async () => ({ message: 'Friend request sent' }) });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/friends/request',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            recipientId: 'target_user_456',
            friendId: 'target_user_456',
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith('Friend request sent to Bob!');
    });

    expect(screen.getByRole('button')).toHaveTextContent('Request Sent');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('rolls back to "Add Friend" on API error and shows toast error', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Server error occurred'));

    const onStatusChange = vi.fn();
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        onStatusChange={onStatusChange}
      />
    );

    const button = screen.getByRole('button', { name: /add friend for bob/i });
    fireEvent.click(button);

    // Initially optimistic
    expect(onStatusChange).toHaveBeenCalledWith('pending', 'target_user_456');

    await waitFor(() => {
      // Rolled back
      expect(onStatusChange).toHaveBeenCalledWith('pending', 'target_user_456');
      expect(screen.getByRole('button')).toHaveTextContent('Add Friend');
      expect(screen.getByRole('button')).not.toBeDisabled();
      expect(toast.error).toHaveBeenCalledWith('Server error occurred');
    });
  });

  it('optimistically accepts friend request when status is "request_received"', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Friend request accepted' }),
    });

    const onStatusChange = vi.fn();
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        initialStatus="request_received"
        onStatusChange={onStatusChange}
      />
    );

    const button = screen.getByRole('button', { name: /accept request for bob/i });
    fireEvent.click(button);

    // Optimistic transition
    expect(onStatusChange).toHaveBeenCalledWith('friends', 'target_user_456');

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/friends/accept',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            requesterId: 'target_user_456',
            friendId: 'target_user_456',
            userId: 'user_self_123',
          }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith('You and Bob are now friends!');
      expect(screen.getByRole('button')).toHaveTextContent('Friends');
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('rolls back to "request_received" when accept API call fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Network disconnected'));

    const onStatusChange = vi.fn();
    renderWithAuth(
      <FriendActionButton
        targetUserId="target_user_456"
        targetUserName="Bob"
        initialStatus="request_received"
        onStatusChange={onStatusChange}
      />
    );

    const button = screen.getByRole('button', { name: /accept request for bob/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('request_received', 'target_user_456');
      expect(screen.getByRole('button')).toHaveTextContent('Accept Request');
      expect(toast.error).toHaveBeenCalledWith('Network disconnected');
    });
  });
});
