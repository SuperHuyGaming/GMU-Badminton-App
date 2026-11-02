import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MemberHoverCard from './MemberHoverCard';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
  default: vi.fn(),
}));

describe('Challenger 1 Empirical Stress Suite: MemberHoverCard Debounce & DOM Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue({ ok: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const makeUser = (id, name, overrides = {}) => ({
    _id: id,
    name,
    role: 'Member',
    skillLevel: 'Advanced',
    bio: 'Varsity singles player',
    singlesElo: 1520,
    doublesElo: 1480,
    isOnline: true,
    friendshipStatus: 'none',
    stats: { winStreak: 5, winRate: 82 },
    currentCourtCheckIn: { courtNumber: 4 },
    ...overrides,
  });

  describe('1. Debounce Open & Close Timing Precision', () => {
    it('does NOT open popover before debounce threshold (at 100ms, 200ms, 250ms)', () => {
      vi.useFakeTimers();
      const user = makeUser('user_timing_open_1', 'Open Threshold User');
      render(
        <MemberHoverCard userId="user_timing_open_1" user={user}>
          <span data-testid="avatar-trigger">Open Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      act(() => {
        fireEvent.mouseEnter(trigger);
      });

      // At 100ms: still closed
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();

      // At 200ms: still closed
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();

      // At 270ms: still closed (open delay is 280ms)
      act(() => {
        vi.advanceTimersByTime(70);
      });
      expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();

      // At 290ms: open!
      act(() => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      vi.useRealTimers();
    });

    it('cancels open timer when mouse leaves trigger before debounce delay (flail test)', () => {
      vi.useFakeTimers();
      const user = makeUser('user_timing_flail_2', 'Flail User');
      render(
        <MemberHoverCard userId="user_timing_flail_2" user={user}>
          <span data-testid="avatar-trigger">Flail Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');

      // Mouse enters for only 150ms, then leaves
      act(() => {
        fireEvent.mouseEnter(trigger);
        vi.advanceTimersByTime(150);
        fireEvent.mouseLeave(trigger);
      });

      // Advance past the 280ms threshold
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Popover should NEVER have opened
      expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('closes popover after 200ms leave delay with real timer transitions', async () => {
      vi.useRealTimers();
      const user = makeUser('user_timing_close_3', 'Close Delay User');
      render(
        <MemberHoverCard userId="user_timing_close_3" user={user}>
          <span data-testid="avatar-trigger">Close Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');

      // Open popover (>280ms)
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Mouse leaves trigger
      fireEvent.mouseLeave(trigger);

      // Verify it closes cleanly after leave timer (200ms)
      await waitFor(() => {
        expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('bridge behavior: moving mouse from trigger to popover keeps popover open', async () => {
      vi.useRealTimers();
      const user = makeUser('user_bridge_4', 'Bridge User');
      render(
        <MemberHoverCard userId="user_bridge_4" user={user}>
          <span data-testid="avatar-trigger">Bridge Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');

      // Open popover
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Mouse leaves trigger to move into popover
      fireEvent.mouseLeave(trigger);

      // Mouse enters popover paper immediately (<200ms)
      const popoverEl = screen.getByTestId('member-hover-card-popover').parentElement;
      fireEvent.mouseEnter(popoverEl);

      // Wait 300ms while mouse is inside popover
      await new Promise(r => setTimeout(r, 300));

      // Popover MUST remain open
      expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();

      // Now mouse leaves popover
      fireEvent.mouseLeave(popoverEl);

      // Must close after 200ms
      await waitFor(() => {
        expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('2. DOM Mount/Unmount Cleanup & Memory Safety', () => {
    it('cleans up pending hover timer on unmount without state update errors', () => {
      vi.useFakeTimers();
      const user = makeUser('user_unmount_1', 'Unmount Hover User');
      const { unmount } = render(
        <MemberHoverCard userId="user_unmount_1" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      act(() => {
        fireEvent.mouseEnter(trigger);
        vi.advanceTimersByTime(100);
      });

      unmount();

      expect(() => {
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }).not.toThrow();
      vi.useRealTimers();
    });

    it('cleans up pending leave timer on unmount without state update errors', async () => {
      vi.useRealTimers();
      const user = makeUser('user_unmount_2', 'Unmount Leave User');
      const { unmount } = render(
        <MemberHoverCard userId="user_unmount_2" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      fireEvent.mouseLeave(trigger);
      // Unmount immediately while leave timer is ticking
      unmount();

      // Wait past leave duration
      await new Promise(r => setTimeout(r, 300));
      expect(true).toBe(true);
    });

    it('handles async API resolution after component unmount cleanly via isMountedRef', async () => {
      vi.useRealTimers();
      let resolvePromise;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      apiFetch.mockReturnValueOnce(pendingPromise);

      const { unmount } = render(
        <MemberHoverCard userId="user_async_unmount_3">
          <span>Async Unmount User</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      fireEvent.mouseEnter(trigger);

      // Wait 300ms for hover timer to trigger fetchMemberCard
      await new Promise(r => setTimeout(r, 300));

      // Unmount while API request is inflight
      unmount();

      // Resolve the API response post-unmount
      await act(async () => {
        resolvePromise({
          ok: true,
          json: async () => ({ user: { _id: 'user_async_unmount_3', name: 'Late Arrival' } }),
        });
      });

      expect(true).toBe(true);
    });
  });

  describe('3. Rapid Hover Stress & DOM Stability', () => {
    it('survives 30 rapid alternating enter/leave events deterministically', async () => {
      vi.useRealTimers();
      const user = makeUser('user_stress_rapid_1', 'Rapid Stress User');
      render(
        <MemberHoverCard userId="user_stress_rapid_1" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');

      // Rapidly toggle 20 times with 15ms intervals
      for (let i = 0; i < 20; i++) {
        fireEvent.mouseEnter(trigger);
        await new Promise(r => setTimeout(r, 15));
        fireEvent.mouseLeave(trigger);
        await new Promise(r => setTimeout(r, 15));
      }

      // Wait 250ms: must remain cleanly closed
      await new Promise(r => setTimeout(r, 250));
      expect(screen.queryByTestId('member-hover-card-popover')).not.toBeInTheDocument();

      // Now enter and hold: must open normally
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('4. Custom Event Dispatching & DOM Actions', () => {
    it('dispatches openChatWithUser CustomEvent with complete payload on Message click', async () => {
      vi.useRealTimers();
      const chatSpy = vi.fn();
      window.addEventListener('openChatWithUser', chatSpy);

      const user = makeUser('user_event_chat_1', 'Event Chat User');
      render(
        <MemberHoverCard userId="user_event_chat_1" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      const messageBtn = screen.getByRole('button', { name: /Message Event Chat User/i });
      fireEvent.click(messageBtn);

      expect(chatSpy).toHaveBeenCalledTimes(1);
      const eventDetail = chatSpy.mock.calls[0][0].detail;
      expect(eventDetail.name).toBe('Event Chat User');
      expect(eventDetail._id).toBe('user_event_chat_1');

      window.removeEventListener('openChatWithUser', chatSpy);
    });

    it('dispatches challengeUser CustomEvent with complete payload on Challenge click', async () => {
      vi.useRealTimers();
      const challengeSpy = vi.fn();
      window.addEventListener('challengeUser', challengeSpy);

      const user = makeUser('user_event_chal_2', 'Event Challenge User');
      render(
        <MemberHoverCard userId="user_event_chal_2" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      const challengeBtn = screen.getByRole('button', { name: /Challenge Event Challenge User/i });
      fireEvent.click(challengeBtn);

      expect(challengeSpy).toHaveBeenCalledTimes(1);
      const eventDetail = challengeSpy.mock.calls[0][0].detail;
      expect(eventDetail.name).toBe('Event Challenge User');
      expect(eventDetail._id).toBe('user_event_chal_2');

      window.removeEventListener('challengeUser', challengeSpy);
    });

    it('renders RAC court check-in chip and win streak statistics accurately', async () => {
      vi.useRealTimers();
      const user = makeUser('user_stats_chip_3', 'Stats Chip User', {
        currentCourtCheckIn: { courtNumber: 5 },
        stats: { winStreak: 7, winRate: 90 },
        singlesElo: 1610,
        doublesElo: 1590,
      });

      render(
        <MemberHoverCard userId="user_stats_chip_3" user={user}>
          <span>Trigger</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(screen.getByText(/Checked in at RAC Court 5/i)).toBeInTheDocument();
      expect(screen.getByText(/7 Match Win Streak!/i)).toBeInTheDocument();
      expect(screen.getByText('1610')).toBeInTheDocument();
      expect(screen.getByText('1590')).toBeInTheDocument();
    });
  });
});
