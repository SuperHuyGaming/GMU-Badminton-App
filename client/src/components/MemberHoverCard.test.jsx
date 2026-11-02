import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MemberHoverCard from './MemberHoverCard';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
  default: vi.fn(),
}));

describe('MemberHoverCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const mockUser = {
    _id: 'user_hover_1',
    name: 'Sarah Connor',
    role: 'Member',
    skillLevel: 'Advanced',
    bio: 'Badminton enthusiast and tournament competitor',
    singlesElo: 1450,
    doublesElo: 1420,
    isOnline: true,
    friendshipStatus: 'none',
    stats: { winStreak: 4, winRate: 75 },
    currentCourtCheckIn: { courtNumber: 3 },
  };

  it('renders wrapped children trigger cleanly', () => {
    render(
      <MemberHoverCard userId="user_hover_1" user={mockUser}>
        <span data-testid="child-trigger">Hover Me</span>
      </MemberHoverCard>
    );

    expect(screen.getByTestId('child-trigger')).toBeInTheDocument();
  });

  it('opens hover popover after debounce delay on mouse enter', async () => {
    render(
      <MemberHoverCard userId="user_hover_1" user={mockUser}>
        <span data-testid="child-trigger">Sarah Avatar</span>
      </MemberHoverCard>
    );

    const trigger = screen.getByTestId('member-hover-card-trigger');
    act(() => {
      fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('member-hover-card-popover')).toBeInTheDocument();
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('1450')).toBeInTheDocument();
    expect(screen.getByText('1420')).toBeInTheDocument();
    expect(screen.getByText(/Checked in at RAC Court 3/i)).toBeInTheDocument();
    expect(screen.getByText(/4 Match Win Streak!/i)).toBeInTheDocument();
  });

  it('dispatches openChatWithUser event when clicking Message', async () => {
    const chatListener = vi.fn();
    window.addEventListener('openChatWithUser', chatListener);

    render(
      <MemberHoverCard userId="user_hover_1" user={mockUser}>
        <span>User</span>
      </MemberHoverCard>
    );

    const trigger = screen.getByTestId('member-hover-card-trigger');
    act(() => {
      fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(300);
    });

    const messageBtn = screen.getByRole('button', { name: /Message Sarah Connor/i });
    act(() => {
      fireEvent.click(messageBtn);
    });

    expect(chatListener).toHaveBeenCalledTimes(1);
    expect(chatListener.mock.calls[0][0].detail.name).toBe('Sarah Connor');

    window.removeEventListener('openChatWithUser', chatListener);
  });

  it('dispatches challengeUser event when clicking Challenge', async () => {
    const challengeListener = vi.fn();
    window.addEventListener('challengeUser', challengeListener);

    render(
      <MemberHoverCard userId="user_hover_1" user={mockUser}>
        <span>User</span>
      </MemberHoverCard>
    );

    const trigger = screen.getByTestId('member-hover-card-trigger');
    act(() => {
      fireEvent.mouseEnter(trigger);
      vi.advanceTimersByTime(300);
    });

    const challengeBtn = screen.getByRole('button', { name: /Challenge Sarah Connor/i });
    act(() => {
      fireEvent.click(challengeBtn);
    });

    expect(challengeListener).toHaveBeenCalledTimes(1);
    expect(challengeListener.mock.calls[0][0].detail.name).toBe('Sarah Connor');

    window.removeEventListener('challengeUser', challengeListener);
  });

  it('fetches member card from backend API when full details are not provided', async () => {
    vi.useRealTimers();
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          _id: 'user_fetched_99',
          name: 'Elena Rostova',
          skillLevel: 'Intermediate',
          singlesElo: 1350,
          doublesElo: 1310,
          isOnline: false,
          friendshipStatus: 'none',
        },
      }),
    });

    render(
      <MemberHoverCard userId="user_fetched_99">
        <span>Elena</span>
      </MemberHoverCard>
    );

    const trigger = screen.getByTestId('member-hover-card-trigger');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/forum/members/user_fetched_99/card');
    });
  });
  describe('hover popover is non-modal', () => {
    it('lets pointer events pass through the popover root while keeping the card interactive', () => {
      render(
        <MemberHoverCard userId="user_hover_1" user={mockUser}>
          <span>User</span>
        </MemberHoverCard>
      );

      act(() => {
        fireEvent.mouseEnter(screen.getByTestId('member-hover-card-trigger'));
        vi.advanceTimersByTime(300);
      });

      const root = document.querySelector('.MuiPopover-root');
      const paper = document.querySelector('.MuiPopover-paper');
      expect(root).not.toBeNull();
      expect(window.getComputedStyle(root).pointerEvents).toBe('none');
      expect(window.getComputedStyle(paper).pointerEvents).toBe('auto');
      // No scroll lock on the page while hovering
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('court check-in expiry', () => {
    it('does not show a check-in whose expiresAt is in the past', () => {
      render(
        <MemberHoverCard
          userId="user_expired_checkin"
          user={{
            ...mockUser,
            _id: 'user_expired_checkin',
            currentCourtCheckIn: { courtNumber: 5, expiresAt: new Date(Date.now() - 60000).toISOString() },
          }}
        >
          <span>User</span>
        </MemberHoverCard>
      );

      act(() => {
        fireEvent.mouseEnter(screen.getByTestId('member-hover-card-trigger'));
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      expect(screen.queryByText(/Checked in at RAC Court/i)).not.toBeInTheDocument();
    });
  });

  describe('member card cache', () => {
    const cardResponse = (overrides = {}) => ({
      ok: true,
      json: async () => ({ user: { _id: 'm', name: 'Cached Member', isOnline: true, ...overrides } }),
    });

    const hoverAndSettle = async () => {
      const trigger = screen.getByTestId('member-hover-card-trigger');
      await act(async () => {
        fireEvent.mouseEnter(trigger);
        await vi.advanceTimersByTimeAsync(300);
      });
      await act(async () => {
        fireEvent.mouseLeave(trigger);
        await vi.advanceTimersByTimeAsync(300);
      });
    };

    afterEach(() => {
      localStorage.removeItem('user');
    });

    it('reuses a cached card within the TTL and refetches after it expires', async () => {
      localStorage.setItem('user', JSON.stringify({ _id: 'viewer_ttl' }));
      apiFetch.mockResolvedValue(cardResponse());

      render(
        <MemberHoverCard userId="cache_ttl_member">
          <span>Member</span>
        </MemberHoverCard>
      );

      await hoverAndSettle();
      expect(apiFetch).toHaveBeenCalledTimes(1);

      await hoverAndSettle();
      expect(apiFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61 * 1000);
      });
      await hoverAndSettle();
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('does not share cached cards between different signed-in viewers', async () => {
      localStorage.setItem('user', JSON.stringify({ _id: 'viewer_one' }));
      apiFetch.mockResolvedValue(cardResponse());

      render(
        <MemberHoverCard userId="cache_viewer_member">
          <span>Member</span>
        </MemberHoverCard>
      );

      await hoverAndSettle();
      expect(apiFetch).toHaveBeenCalledTimes(1);

      localStorage.setItem('user', JSON.stringify({ _id: 'viewer_two' }));
      await hoverAndSettle();
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('lets fresh isOnline props win over cached presence', async () => {
      localStorage.setItem('user', JSON.stringify({ _id: 'viewer_presence' }));
      apiFetch.mockResolvedValue(cardResponse({ isOnline: true }));

      render(
        <MemberHoverCard userId="cache_presence_member" user={{ _id: 'cache_presence_member', name: 'Presence Member', isOnline: false }}>
          <span>Member</span>
        </MemberHoverCard>
      );

      const trigger = screen.getByTestId('member-hover-card-trigger');
      await act(async () => {
        fireEvent.mouseEnter(trigger);
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(apiFetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Presence Member')).toBeInTheDocument();
      const popover = screen.getByTestId('member-hover-card-popover');
      expect(popover.querySelector('.MuiBadge-colorSuccess')).toBeNull();
    });
  });
});
