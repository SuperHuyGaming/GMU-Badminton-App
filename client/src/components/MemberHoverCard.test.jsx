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
});
