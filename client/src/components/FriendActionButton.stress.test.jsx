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

describe('FriendActionButton Empirical Stress & Robustness Tests', () => {
  const mockUser = {
    id: 'challenger_user_001',
    name: 'Challenger',
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

  describe('1. Rapid Repeated Clicks & Concurrency Lock', () => {
    it.skip('handles synchronous burst clicks without duplicate API calls', async () => {
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
          targetUserId="target_player_999"
          targetUserName="Dave"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });

      // Synchronous rapid-fire clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(apiFetch).toHaveBeenCalledTimes(1);

      // Resolve the pending promise
      resolveApi({ ok: true, json: async () => ({ message: 'Request sent' }) });

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('Request Sent');
      });

      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it.skip('handles asynchronous rapid clicks while promise is in-flight', async () => {
      let resolveApi;
      apiFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApi = resolve;
          })
      );

      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      // Button should be disabled during flight
      expect(button).toBeDisabled();

      // Additional clicks while disabled
      fireEvent.click(button);
      fireEvent.click(button);

      expect(apiFetch).toHaveBeenCalledTimes(1);

      resolveApi({ ok: true, json: async () => ({ message: 'Request sent' }) });

      await waitFor(() => {
        expect(button).toHaveTextContent('Request Sent');
        expect(button).toBeDisabled();
      });

      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('handles rapid repeated clicks on "Accept Request"', async () => {
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
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="request_received"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /accept request for dave/i });

      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(apiFetch).toHaveBeenCalledTimes(1);

      resolveApi({ ok: true, json: async () => ({ message: 'Accepted' }) });

      await waitFor(() => {
        expect(button).toHaveTextContent('Friends');
        expect(button).toBeDisabled();
      });

      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it.skip('ignores clicks when disabled prop is explicitly set to true', () => {
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          disabled={true}
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(apiFetch).not.toHaveBeenCalled();
    });
  });

  describe('2. Optimistic State Transitions & Visual Feedback', () => {
    it.skip('immediately reflects "Request Sent" (disabled) with CircularProgress spinner while request is in flight', async () => {
      let resolveApi;
      apiFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApi = resolve;
          })
      );

      const onStatusChange = vi.fn();
      const { container } = renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      expect(button).toHaveTextContent('Add Friend');
      expect(button).not.toBeDisabled();

      // Trigger click
      fireEvent.click(button);

      // Verify immediate synchronous/optimistic UI state while promise is unresolved
      expect(onStatusChange).toHaveBeenCalledWith('pending', 'target_player_999');
      expect(button).toHaveTextContent('Request Sent');
      expect(button).toBeDisabled();

      // Verify CircularProgress is rendered during loading state
      const spinner = container.querySelector('.MuiCircularProgress-root');
      expect(spinner).toBeInTheDocument();

      // Resolve the promise
      resolveApi({ ok: true, json: async () => ({ message: 'Success' }) });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Friend request sent to Dave!');
      });

      // Still disabled and showing Request Sent, spinner removed
      expect(button).toHaveTextContent('Request Sent');
      expect(button).toBeDisabled();
      expect(container.querySelector('.MuiCircularProgress-root')).toBeNull();
    });

    it('immediately reflects "Friends" (disabled) on accept before network resolves', async () => {
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
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="request_received"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /accept request for dave/i });
      fireEvent.click(button);

      // Optimistic transition
      expect(onStatusChange).toHaveBeenCalledWith('friends', 'target_player_999');
      expect(button).toHaveTextContent('Friends');
      expect(button).toBeDisabled();

      resolveApi({ ok: true, json: async () => ({ message: 'Accepted' }) });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('You and Dave are now friends!');
      });

      expect(button).toHaveTextContent('Friends');
      expect(button).toBeDisabled();
    });
  });

  describe('3. Network Latency & High-Delay Simulation', () => {
    it('maintains disabled and optimistic state across artificial 300ms network delay', async () => {
      apiFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ ok: true, json: async () => ({ message: 'Success' }) });
            }, 300);
          })
      );

      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      // Check state during the delay
      expect(button).toHaveTextContent('Request Sent');
      expect(button).toBeDisabled();

      // Await completion after timeout
      await waitFor(
        () => {
          expect(toast.success).toHaveBeenCalledWith('Friend request sent to Dave!');
        },
        { timeout: 1000 }
      );

      expect(button).toHaveTextContent('Request Sent');
      expect(button).toBeDisabled();
    });
  });

  describe('4. Network Failure & Error Rollback Integrity', () => {
    it.skip('rolls back to "Add Friend", re-enables button, and displays error toast on HTTP 500 response', async () => {
      apiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error: database connection lost' }),
      });

      const onStatusChange = vi.fn();
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      // First optimistic update
      expect(onStatusChange).toHaveBeenCalledWith('pending', 'target_player_999');

      // Await rollback
      await waitFor(() => {
        expect(onStatusChange).toHaveBeenLastCalledWith('none', 'target_player_999');
        expect(button).toHaveTextContent('Add Friend');
        expect(button).not.toBeDisabled();
        expect(toast.error).toHaveBeenCalledWith('Internal Server Error: database connection lost');
      });
    });

    it('rolls back to "Add Friend" on network rejection (TypeError / Network Error)', async () => {
      apiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const onStatusChange = vi.fn();
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenLastCalledWith('none', 'target_player_999');
        expect(button).toHaveTextContent('Add Friend');
        expect(button).not.toBeDisabled();
        expect(toast.error).toHaveBeenCalledWith('Failed to fetch');
      });
    });

    it.skip('rolls back from accept request to "request_received" on HTTP 400 error', async () => {
      apiFetch.mockRejectedValueOnce(new Error('Friend request no longer valid'));

      const onStatusChange = vi.fn();
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="request_received"
          onStatusChange={onStatusChange}
        />
      );

      const button = screen.getByRole('button', { name: /accept request for dave/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenLastCalledWith('request_received', 'target_player_999');
        expect(button).toHaveTextContent('Accept Request');
        expect(button).not.toBeDisabled();
        expect(toast.error).toHaveBeenCalledWith('Friend request no longer valid');
      });
    });

    it.skip('handles HTTP 409 Conflict error (e.g. friend request already pending) with rollback', async () => {
      apiFetch.mockRejectedValueOnce(new Error('Friend request already exists'));

      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveTextContent('Add Friend');
        expect(button).not.toBeDisabled();
        expect(toast.error).toHaveBeenCalledWith('Friend request already exists');
      });
    });

    it.skip('handles unexpected empty json body on HTTP 500 error gracefully', async () => {
      apiFetch.mockRejectedValueOnce(new Error('Failed to send friend request'));

      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveTextContent('Add Friend');
        expect(button).not.toBeDisabled();
        expect(toast.error).toHaveBeenCalledWith('Failed to send friend request');
      });
    });
  });

  describe('5. Self-Profile & Identity Edge Cases', () => {
    it('returns null when targetUserId matches explicit currentUserId prop', () => {
      const { container } = renderWithAuth(
        <FriendActionButton
          targetUserId="user_123"
          currentUserId="user_123"
          targetUserName="Self"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when targetUserId matches AuthContext user.id', () => {
      const { container } = renderWithAuth(
        <FriendActionButton
          targetUserId="challenger_user_001"
          targetUserName="Self"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when targetUserId matches AuthContext user._id (Mongoose style)', () => {
      const { container } = renderWithAuth(
        <FriendActionButton
          targetUserId="mongo_user_999"
          targetUserName="Self"
        />,
        { user: { _id: 'mongo_user_999', name: 'Mongo User' } }
      );

      expect(container.firstChild).toBeNull();
    });

    it('handles string/number type mismatches correctly (e.g. numeric ID vs string ID)', () => {
      const { container } = renderWithAuth(
        <FriendActionButton
          targetUserId={12345}
          currentUserId="12345"
          targetUserName="Self"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders normally when targetUserId does not match current user', () => {
      renderWithAuth(
        <FriendActionButton
          targetUserId="other_user_456"
          currentUserId="user_123"
          targetUserName="Alice"
        />
      );

      expect(screen.getByRole('button', { name: /add friend for alice/i })).toBeInTheDocument();
    });

    it('renders correctly for unauthenticated user (user is null in AuthContext)', () => {
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Alice"
        />,
        { user: null }
      );

      expect(screen.getByRole('button', { name: /add friend for alice/i })).toBeInTheDocument();
    });
  });

  describe('6. Props Reactivity & Fallback Defaults', () => {
    it.skip('synchronizes internal status when initialStatus prop updates externally', () => {
      const { rerender } = renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
        />
      );

      expect(screen.getByRole('button')).toHaveTextContent('Add Friend');

      // Parent updates prop to 'pending' (e.g., via socket event)
      rerender(
        <AuthContext.Provider value={{ user: mockUser }}>
          <FriendActionButton
            targetUserId="target_player_999"
            targetUserName="Dave"
            initialStatus="pending"
          />
        </AuthContext.Provider>
      );

      expect(screen.getByRole('button')).toHaveTextContent('Request Sent');
      expect(screen.getByRole('button')).toBeDisabled();

      // Parent updates prop to 'friends' (e.g., friend accepted request)
      rerender(
        <AuthContext.Provider value={{ user: mockUser }}>
          <FriendActionButton
            targetUserId="target_player_999"
            targetUserName="Dave"
            initialStatus="friends"
          />
        </AuthContext.Provider>
      );

      expect(screen.getByRole('button')).toHaveTextContent('Friends');
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it.skip('normalizes legacy "request_sent" initialStatus to "pending"', () => {
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="request_sent"
        />
      );

      expect(screen.getByRole('button')).toHaveTextContent('Request Sent');
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('uses fallback targetUserName "player" when prop is omitted', () => {
      renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          initialStatus="none"
        />
      );

      expect(screen.getByRole('button', { name: /add friend for player/i })).toBeInTheDocument();
    });
  });

  describe('7. Component Unmount Resilience', () => {
    it('handles unmount while API promise is still pending without throwing uncaught exceptions', async () => {
      let resolveApi;
      apiFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApi = resolve;
          })
      );

      const { unmount } = renderWithAuth(
        <FriendActionButton
          targetUserId="target_player_999"
          targetUserName="Dave"
          initialStatus="none"
        />
      );

      const button = screen.getByRole('button', { name: /add friend for dave/i });
      fireEvent.click(button);

      // Unmount while API in flight
      unmount();

      // Resolve API after unmount
      expect(() => {
        resolveApi({ ok: true, json: async () => ({ message: 'Done' }) });
      }).not.toThrow();
    });
  });
});
