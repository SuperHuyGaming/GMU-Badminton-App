import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CourtOccupancyCard from './CourtOccupancyCard';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
  default: vi.fn(),
}));

const mockSocketListeners = {};
vi.mock('../utils/socket', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      mockSocketListeners[event] = handler;
    }),
    off: vi.fn((event) => {
      delete mockSocketListeners[event];
    }),
  },
}));

describe('CourtOccupancyCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    _id: 'user_self_1',
    name: 'George Mason',
  };

  const mockCourtsData = [1, 2, 3, 4, 5, 6].map((num) => ({
    courtNumber: num,
    courtName: `RAC Court ${num}`,
    recreationalOccupancy: {
      isCheckedIn: num === 2,
      checkedInUsers:
        num === 2
          ? [
              {
                userId: 'user_other',
                userName: 'Player Two',
                avatarUrl: '',
              },
            ]
          : [],
      queueCount: 0,
      estimatedWaitMinutes: 0,
    },
  }));

  const renderCard = (user = mockUser) => {
    return render(
      <AuthContext.Provider value={{ user }}>
        <CourtOccupancyCard />
      </AuthContext.Provider>
    );
  };

  it('fetches and renders RAC Courts 1 through 6', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        courts: mockCourtsData,
      }),
    });

    renderCard();

    expect(screen.getByText(/RAC Court Occupancy/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Court 1')).toBeInTheDocument();
      expect(screen.getByText('Court 2')).toBeInTheDocument();
      expect(screen.getByText('Court 6')).toBeInTheDocument();
      expect(screen.getByText('1 In Play')).toBeInTheDocument();
    });
  });

  it('opens check-in modal when clicking Check In button', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        courts: mockCourtsData,
      }),
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByTestId('open-check-in-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('open-check-in-btn'));

    expect(screen.getByText(/RAC Court Check-In/i)).toBeInTheDocument();
  });

  it('displays user check-in badge and checkout button when current user is checked in', async () => {
    const userCheckedInCourts = mockCourtsData.map((c) =>
      c.courtNumber === 1
        ? {
            ...c,
            recreationalOccupancy: {
              isCheckedIn: true,
              checkedInUsers: [
                {
                  userId: 'user_self_1',
                  userName: 'George Mason',
                },
              ],
            },
          }
        : c
    );

    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        courts: userCheckedInCourts,
      }),
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText(/At Court 1/i)).toBeInTheDocument();
      expect(screen.getByTestId('checkout-btn')).toBeInTheDocument();
    });

    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Successfully checked out',
      }),
    });
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        courts: mockCourtsData,
      }),
    });

    fireEvent.click(screen.getByTestId('checkout-btn'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/courts/1/check-out',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
