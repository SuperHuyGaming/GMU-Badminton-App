import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

vi.mock('../utils/socket', () => ({
    default: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    }
}));

let currentAuthUser = {
    _id: 'user-current-1',
    name: 'Test Player',
    role: 'user',
    avatarUrl: 'https://example.com/avatar.png'
};

const mockUser = currentAuthUser;

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: currentAuthUser,
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
        divisions: [{ name: 'Men Singles Open', code: 'MSO' }],
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
        divisions: [{ name: 'Mixed Doubles C', code: 'XDC' }],
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
        currentAuthUser = {
            _id: 'user-current-1',
            name: 'Test Player',
            role: 'user',
            avatarUrl: 'https://example.com/avatar.png'
        };
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

    it('renders as a dedicated tournament directory without top navigation tabs or subordinate components', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        // Top navigation tabs should not exist
        expect(screen.queryByTestId('tab-tournaments-directory')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tab-bracket-viewer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tab-court-schedule')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tab-umpire-pad')).not.toBeInTheDocument();

        // Subordinate tool components should not exist
        expect(screen.queryByTestId('tournament-bracket-engine')).not.toBeInTheDocument();
        expect(screen.queryByTestId('court-queue-viewer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('umpire-digital-pad')).not.toBeInTheDocument();

        // Dedicated search bar and directory should exist
        expect(screen.getByPlaceholderText(/Search tournaments/i)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });
    });

    it('performs instant in-memory search across tournamentName, hostUniversity, eventLocation, divisions, and skillLevels without skeleton flash', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
            expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search tournaments/i);

        // Filter by location (Columbia)
        fireEvent.change(searchInput, { target: { value: 'Columbia' } });
        expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
        expect(screen.queryByText('Mason Open Championships 2027')).not.toBeInTheDocument();

        // Filter by division (MSO)
        fireEvent.change(searchInput, { target: { value: 'MSO' } });
        expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        expect(screen.queryByText('Capital Fall Invitational 2027')).not.toBeInTheDocument();

        // Filter by skill level (Beginner)
        fireEvent.change(searchInput, { target: { value: 'Beginner' } });
        expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
        expect(screen.queryByText('Mason Open Championships 2027')).not.toBeInTheDocument();

        // Filter by host university (George Mason)
        fireEvent.change(searchInput, { target: { value: 'George Mason' } });
        expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        expect(screen.queryByText('Capital Fall Invitational 2027')).not.toBeInTheDocument();

        // Filter by badminton acronym synonym (GMU -> George Mason)
        fireEvent.change(searchInput, { target: { value: 'GMU' } });
        expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        expect(screen.queryByText('Capital Fall Invitational 2027')).not.toBeInTheDocument();

        // Filter by club acronym synonym (CBA -> Capital Badminton)
        fireEvent.change(searchInput, { target: { value: 'CBA' } });
        expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
        expect(screen.queryByText('Mason Open Championships 2027')).not.toBeInTheDocument();

        // Empty search restores all
        fireEvent.change(searchInput, { target: { value: '' } });
        expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        expect(screen.getByText('Capital Fall Invitational 2027')).toBeInTheDocument();
    });

    it('handles multi-skill filter chips and includes skills query param in API requests', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Click Intermediate skill chip
        const intermediateChip = screen.getByRole('button', { name: 'Intermediate' });
        fireEvent.click(intermediateChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/skills=Intermediate/));
        });

        // Click Advanced skill chip to multi-select
        const advancedChip = screen.getByRole('button', { name: 'Advanced' });
        fireEvent.click(advancedChip);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/skills=Intermediate%2CAdvanced|skills=Intermediate,Advanced/));
        });
    });

    it('triggers refresh action and re-fetches published tournaments', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        const refreshBtn = screen.getByRole('button', { name: /refresh/i });
        expect(refreshBtn).toBeInTheDocument();

        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Tournaments refreshed!');
        });
    });

    it('opens clear & reset confirmation dialog and executes reset-seed call on confirm', async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === '/api/tournaments/reset-seed') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        success: true,
                        message: 'Tournament system wiped and restarted successfully'
                    })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ tournaments: mockTournaments })
            };
        });

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        const clearBtn = screen.getByRole('button', { name: /clear & reset/i });
        expect(clearBtn).toBeInTheDocument();

        fireEvent.click(clearBtn);

        // Dialog should open
        await waitFor(() => {
            expect(screen.getByText('Reset Tournament Schedule?')).toBeInTheDocument();
        });

        // Click confirm in dialog
        const confirmBtn = screen.getByRole('button', { name: /reset now/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/tournaments/reset-seed', { method: 'POST' });
            expect(toast.success).toHaveBeenCalledWith('Tournament system wiped and restarted successfully');
        });
    });

    it('strictly hides tournament delete button from regular users and guests', async () => {
        currentAuthUser = {
            _id: 'user-player-1',
            name: 'Regular Player',
            role: 'user'
        };

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Delete buttons should NOT exist in the DOM for regular players
        const deleteButtons = screen.queryAllByLabelText(/Delete tournament/i);
        expect(deleteButtons).toHaveLength(0);
    });

    it('allows authenticated admin users to see delete button and permanently delete a tournament', async () => {
        currentAuthUser = {
            _id: 'admin-1',
            name: 'Club Admin',
            role: 'admin'
        };

        apiFetch.mockImplementation(async (url, opts) => {
            if (url === '/api/tournaments/t-1' && opts?.method === 'DELETE') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ message: 'Tournament deleted successfully.', _id: 't-1' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ tournaments: mockTournaments })
            };
        });

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Admin should see delete button
        const deleteBtn = screen.getByLabelText('Delete tournament Mason Open Championships 2027');
        expect(deleteBtn).toBeInTheDocument();

        fireEvent.click(deleteBtn);

        // Delete confirmation dialog should open
        await waitFor(() => {
            expect(screen.getByText('Delete Tournament?')).toBeInTheDocument();
            expect(screen.getByText(/"Mason Open Championships 2027"/i)).toBeInTheDocument();
        });

        // Confirm deletion
        const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete$/i });
        fireEvent.click(confirmDeleteBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/tournaments/t-1', { method: 'DELETE' });
            expect(toast.success).toHaveBeenCalledWith('"Mason Open Championships 2027" deleted.');
        });
    });

    it('renders live tournament stats counter and collegiate badminton badge in modern hero banner', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Collegiate badge in hero banner
        expect(screen.getByText(/Mason Collegiate Circuit & DMV Open Hub/i)).toBeInTheDocument();

        // Live stats counters in hero banner
        expect(screen.getByText(/Active Events/i)).toBeInTheDocument();
        expect(screen.getByText(/Players RSVP'd/i)).toBeInTheDocument();
        expect(screen.getByText(/Host Clubs & Colleges/i)).toBeInTheDocument();
    });

    it('renders crisp View Details call-to-action button and opens detail modal on click', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        const viewDetailsButtons = screen.getAllByRole('button', { name: /view details/i });
        expect(viewDetailsButtons.length).toBeGreaterThan(0);

        fireEvent.click(viewDetailsButtons[0]);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/POST DETAILS/i)).toBeInTheDocument();
        });
    });

    it('renders premier empty state with exact prompt required copy when no tournaments exist', async () => {
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
            expect(screen.getByText(/No approved tournaments currently scheduled. Check back soon or submit a tournament discovery!/i)).toBeInTheDocument();
            expect(screen.getByText(/Our AI is Hunting/i)).toBeInTheDocument();
        });
    });

    it('renders clean division and flight chips, fee chip, and crisp Register CTA button on tournament cards', async () => {
        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Fee chip
        expect(screen.getByText(/Fee: \$30/i)).toBeInTheDocument();

        // Division chip (MSO -> MS)
        expect(screen.getByText('MS')).toBeInTheDocument();

        // Register CTA button
        const registerButtons = screen.getAllByRole('link', { name: /register/i });
        expect(registerButtons.length).toBeGreaterThan(0);
        expect(registerButtons[0]).toHaveAttribute('href', 'https://masonbadminton.com/register');
    });

    it('allows admin to delete tournament directly from within the detail modal', async () => {
        currentAuthUser = {
            _id: 'admin-1',
            name: 'Club Admin',
            role: 'admin'
        };

        apiFetch.mockImplementation(async (url, opts) => {
            if (url === '/api/tournaments/t-1' && opts?.method === 'DELETE') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ message: 'Tournament deleted successfully.', _id: 't-1' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ tournaments: mockTournaments })
            };
        });

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Open detail modal via View Details button
        const viewDetailsBtn = screen.getAllByRole('button', { name: /view details/i })[0];
        fireEvent.click(viewDetailsBtn);

        let dialog;
        await waitFor(() => {
            dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
            expect(screen.getByText(/Offered Divisions & Flights/i)).toBeInTheDocument();
        });

        // Admin delete icon button in modal dialog header
        const deleteBtnInModal = within(dialog).getByLabelText('Delete tournament Mason Open Championships 2027');
        expect(deleteBtnInModal).toBeInTheDocument();

        fireEvent.click(deleteBtnInModal);

        // Delete confirmation dialog
        await waitFor(() => {
            expect(screen.getByText('Delete Tournament?')).toBeInTheDocument();
        });

        const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/tournaments/t-1', { method: 'DELETE' });
            expect(toast.success).toHaveBeenCalledWith('"Mason Open Championships 2027" deleted.');
        });
    });

    it('opens discovery submission dialog and submits pending tournament to API', async () => {
        apiFetch.mockImplementation(async (url, opts) => {
            if (url === '/api/scrape/submit-pending' && opts?.method === 'POST') {
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({ message: 'Tournament submitted for admin approval!' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ tournaments: mockTournaments })
            };
        });

        render(
            <MemoryRouter initialEntries={['/tournaments']}>
                <Tournaments />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Mason Open Championships 2027')).toBeInTheDocument();
        });

        // Click Submit Discovery button
        const submitDiscoveryBtn = screen.getByRole('button', { name: /submit discovery/i });
        fireEvent.click(submitDiscoveryBtn);

        await waitFor(() => {
            expect(screen.getByText('Submit Tournament Discovery')).toBeInTheDocument();
        });

        // Fill tournament name
        const nameInput = screen.getByLabelText(/Tournament Name/i);
        fireEvent.change(nameInput, { target: { value: '2027 GMU Spring Invitational' } });

        // Submit form
        const submitBtn = screen.getByRole('button', { name: /^Submit Discovery$/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith('/api/scrape/submit-pending', expect.objectContaining({
                method: 'POST'
            }));
            expect(toast.success).toHaveBeenCalledWith('Tournament submitted for admin approval!');
        });
    });
});
