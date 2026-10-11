import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Tournaments from './Tournaments';
import apiFetch from '../utils/api';
import { toast } from 'react-hot-toast';

vi.mock('../utils/api', () => ({
    default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const mockUser = {
    _id: 'user-current-1',
    name: 'Test Player',
    avatarUrl: 'https://example.com/avatar.png'
};

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        setUser: vi.fn()
    })
}));

const mockTournaments = [
    {
        _id: 't-1',
        tournamentName: 'Mason Open Championships 2027',
        hostUniversity: 'George Mason University',
        eventLocation: 'RAC Gym, Fairfax, VA',
        startDate: '2027-10-15T00:00:00.000Z',
        endDate: '2027-10-16T00:00:00.000Z',
        entryFee: '$30',
        skillLevels: ['Intermediate', 'Advanced'],
        registrationUrl: 'https://masonbadminton.com/register',
        flyerImageUrl: 'https://example.com/flyer1.png',
        rsvpCount: 2,
        attendees: [
            { _id: 'user-2', name: 'Alice', avatarUrl: '' },
            { _id: 'user-3', name: 'Bob', avatarUrl: '' }
        ],
        originalCaption: 'Join us for the biggest collegiate tournament in Virginia!'
    },
    {
        _id: 't-2',
        tournamentName: 'Capital Fall Invitational 2027',
        hostUniversity: 'Capital Badminton Club',
        eventLocation: 'Columbia, MD',
        startDate: '2027-11-05T00:00:00.000Z',
        endDate: '2027-11-06T00:00:00.000Z',
        entryFee: '$25',
        skillLevels: ['Beginner', 'Open'],
        registrationUrl: 'https://capitalbadminton.com/tourney',
        flyerImageUrl: '',
        rsvpCount: 0,
        attendees: [],
        originalCaption: 'Open division singles and doubles event.'
    }
];

describe('Public Tournaments Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ tournaments: mockTournaments })
        });
    });

    it('renders hero title and tournament list cards', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        expect(screen.getByText('Discover DMV Tournaments')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
            expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
        });

        expect(screen.getByText(/RAC Gym, Fairfax, VA/i)).toBeInTheDocument();
        expect(screen.getByText(/Fee: \$30/i)).toBeInTheDocument();
    });

    it('toggles view mode between List and Calendar', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        const calendarToggle = screen.getByRole('button', { name: /calendar view/i });
        fireEvent.click(calendarToggle);

        // Calendar header with month name should be rendered
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
        });
    });

    it('opens tournament detail modal on card click', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        const card = screen.getByTestId('tournament-card-t-1');
        fireEvent.click(card);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/POST DETAILS/i)).toBeInTheDocument();
            expect(screen.getByText(/biggest collegiate tournament in Virginia/i)).toBeInTheDocument();
        });
    });

    it('handles RSVP toggle action and calls backend API', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        apiFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                message: "Successfully RSVP'd",
                rsvpCount: 3,
                isRsvped: true,
                attendees: [...mockTournaments[0].attendees, mockUser]
            })
        });

        const rsvpBtn = screen.getAllByRole('button', { name: /rsvp i'm going/i })[0];
        fireEvent.click(rsvpBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/tournaments/t-1/rsvp', expect.objectContaining({
                method: 'POST'
            }));
            expect(toast.success).toHaveBeenCalledWith("Successfully RSVP'd");
        });
    });

    it('renders friendly empty state when no tournaments exist', async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ tournaments: [] })
        });

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Our AI is Hunting/i)).toBeInTheDocument();
        });
    });
});
