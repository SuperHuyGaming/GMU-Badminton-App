import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import EmptyState from './EmptyState';

describe('EmptyState Component', () => {
    const theme = createTheme();

    const renderWithTheme = (ui) => {
        return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
    };

    it('renders default no-results state with standard copy and accessible SVG', () => {
        renderWithTheme(<EmptyState />);
        expect(screen.getByText('No Matches Found')).toBeInTheDocument();
        expect(screen.getByText(/We couldn't find anything matching your search/i)).toBeInTheDocument();
        const svg = screen.getByRole('img', { name: /magnifying glass/i });
        expect(svg).toBeInTheDocument();
    });

    it('renders no-players empty state with court illustration', () => {
        renderWithTheme(<EmptyState type="no-players" />);
        expect(screen.getByText('No Players on Court')).toBeInTheDocument();
        expect(screen.getByText(/Looks like everyone is currently off court/i)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Peaceful empty badminton court/i })).toBeInTheDocument();
    });

    it('renders no-tournaments empty state with trophy illustration', () => {
        renderWithTheme(<EmptyState type="no-tournaments" />);
        expect(screen.getByText('No Events Scheduled')).toBeInTheDocument();
        expect(screen.getByText(/There are currently no tournaments matching your filters/i)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Tournament championship trophy/i })).toBeInTheDocument();
    });

    it('renders no-buddies empty state with crossed rackets illustration', () => {
        renderWithTheme(<EmptyState type="no-buddies" />);
        expect(screen.getByText('Find Hitting Partners')).toBeInTheDocument();
        expect(screen.getByText(/Connect with badminton players at your skill level/i)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Two crossed badminton rackets/i })).toBeInTheDocument();
    });

    it('resolves legacy aliases (court-empty, events, find-partners, search)', () => {
        const { unmount: u1 } = renderWithTheme(<EmptyState type="court-empty" />);
        expect(screen.getByText('No Players on Court')).toBeInTheDocument();
        u1();

        const { unmount: u2 } = renderWithTheme(<EmptyState type="events" />);
        expect(screen.getByText('No Events Scheduled')).toBeInTheDocument();
        u2();

        const { unmount: u3 } = renderWithTheme(<EmptyState type="find-partners" />);
        expect(screen.getByText('Find Hitting Partners')).toBeInTheDocument();
        u3();

        renderWithTheme(<EmptyState type="search" />);
        expect(screen.getByText('No Matches Found')).toBeInTheDocument();
    });

    it('allows overriding title and description props', () => {
        renderWithTheme(
            <EmptyState 
                type="no-players" 
                title="Custom Court Empty Title" 
                description="Custom description text for testing." 
            />
        );
        expect(screen.getByText('Custom Court Empty Title')).toBeInTheDocument();
        expect(screen.getByText('Custom description text for testing.')).toBeInTheDocument();
        expect(screen.queryByText('No Players on Court')).not.toBeInTheDocument();
    });

    it('supports backward-compatible subtitle prop alias for description', () => {
        renderWithTheme(
            <EmptyState 
                type="no-results" 
                title="Search Query Failed" 
                subtitle="Legacy subtitle string support" 
            />
        );
        expect(screen.getByText('Search Query Failed')).toBeInTheDocument();
        expect(screen.getByText('Legacy subtitle string support')).toBeInTheDocument();
    });

    it('renders primary action button and triggers onAction callback when clicked', () => {
        const handleAction = vi.fn();
        renderWithTheme(
            <EmptyState 
                type="no-players" 
                actionLabel="Clear Filters" 
                onAction={handleAction} 
            />
        );

        const button = screen.getByRole('button', { name: /clear filters/i });
        expect(button).toBeInTheDocument();
        fireEvent.click(button);
        expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it('renders secondary action button and triggers onSecondaryAction when clicked', () => {
        const handleSecondary = vi.fn();
        renderWithTheme(
            <EmptyState 
                type="no-tournaments" 
                actionLabel="Reset Search" 
                onAction={() => {}} 
                secondaryActionLabel="Submit Discovery" 
                onSecondaryAction={handleSecondary} 
            />
        );

        const secondaryBtn = screen.getByRole('button', { name: /submit discovery/i });
        expect(secondaryBtn).toBeInTheDocument();
        fireEvent.click(secondaryBtn);
        expect(handleSecondary).toHaveBeenCalledTimes(1);
    });

    it('renders compact mode with scaled graphic', () => {
        renderWithTheme(
            <EmptyState 
                type="no-buddies" 
                compact 
                title="Compact Buddy List" 
            />
        );
        expect(screen.getByText('Compact Buddy List')).toBeInTheDocument();
        const svg = screen.getByRole('img', { name: /Two crossed badminton rackets/i });
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveStyle({ maxHeight: '120px' });
    });

    it('renders custom children slot', () => {
        renderWithTheme(
            <EmptyState type="no-results">
                <div data-testid="custom-child-slot">Suggested filters</div>
            </EmptyState>
        );
        expect(screen.getByTestId('custom-child-slot')).toBeInTheDocument();
        expect(screen.getByText('Suggested filters')).toBeInTheDocument();
    });

    it('renders no-posts empty state with discussion card graphic', () => {
        renderWithTheme(<EmptyState type="no-posts" />);
        expect(screen.getByText('No Discussions Yet')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /discussion board card/i })).toBeInTheDocument();
    });

    it('renders no-messages empty state with chat bubbles graphic', () => {
        renderWithTheme(<EmptyState type="no-messages" />);
        expect(screen.getByText('No Messages Yet')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /speech bubbles indicating no chat messages/i })).toBeInTheDocument();
    });

    it('ensures courtAmbientGlow gradient is self-contained in all graphics using it', () => {
        const typesWithCourtAmbientGlow = ['no-players', 'no-tournaments', 'no-posts', 'no-messages'];
        for (const type of typesWithCourtAmbientGlow) {
            const { container, unmount } = renderWithTheme(<EmptyState type={type} />);
            const gradient = container.querySelector('#courtAmbientGlow');
            expect(gradient, `Expected #courtAmbientGlow to exist in SVG defs for ${type}`).not.toBeNull();
            unmount();
        }
    });
});
