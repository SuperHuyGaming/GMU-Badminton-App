import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CourtCheckInModal from './CourtCheckInModal';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({
  default: vi.fn(),
}));

describe('CourtCheckInModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCourts = [1, 2, 3, 4, 5, 6].map((num) => ({
    courtNumber: num,
    recreationalOccupancy: {
      checkedInUsers: num === 2 ? [{ userId: 'u1', userName: 'Player 1' }] : [],
    },
  }));

  it('renders court selector dialog with RAC courts 1 to 6', () => {
    render(
      <CourtCheckInModal
        open={true}
        onClose={vi.fn()}
        selectedCourtNumber={1}
        courts={mockCourts}
      />
    );

    expect(screen.getByText(/RAC Court Check-In/i)).toBeInTheDocument();
    expect(screen.getByText('Court 1')).toBeInTheDocument();
    expect(screen.getByText('Court 6')).toBeInTheDocument();
    expect(screen.getByText('1 P')).toBeInTheDocument();
  });

  it('allows selecting a court and updates the confirm button label', () => {
    render(
      <CourtCheckInModal
        open={true}
        onClose={vi.fn()}
        selectedCourtNumber={1}
        courts={mockCourts}
      />
    );

    const court3Btn = screen.getByTestId('court-select-btn-3');
    fireEvent.click(court3Btn);

    expect(
      screen.getByRole('button', { name: /Check In to Court 3/i })
    ).toBeInTheDocument();
  });

  it('executes GPS check-in successfully when geolocation coordinates are within RAC', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 38.8315,
            longitude: -77.3075,
          },
        });
      }),
    };
    window.navigator.geolocation = mockGeolocation;

    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Successfully checked in to RAC Court 1',
        checkIn: { courtNumber: 1 },
      }),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <CourtCheckInModal
        open={true}
        onClose={handleClose}
        onCheckInSuccess={handleSuccess}
        selectedCourtNumber={1}
        courts={mockCourts}
      />
    );

    const checkInBtn = screen.getByTestId('confirm-check-in-btn');
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/courts/1/check-in',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ latitude: 38.8315, longitude: -77.3075 }),
        })
      );
      expect(handleSuccess).toHaveBeenCalledWith(1, { courtNumber: 1 });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays geofence warning alert when backend returns distance rejection', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 38.8977,
            longitude: -77.0365,
          },
        });
      }),
    };
    window.navigator.geolocation = mockGeolocation;

    apiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: 'You are 24591m away from the RAC. You must be physically at the RAC to check in.',
      }),
    });

    render(
      <CourtCheckInModal
        open={true}
        onClose={vi.fn()}
        selectedCourtNumber={1}
        courts={mockCourts}
      />
    );

    const checkInBtn = screen.getByTestId('confirm-check-in-btn');
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(screen.getByText(/You must be physically at the RAC to check in/i)).toBeInTheDocument();
    });
  });
});
