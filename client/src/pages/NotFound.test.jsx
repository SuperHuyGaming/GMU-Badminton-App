import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NotFound from './NotFound';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('NotFound Page Component', () => {
    const theme = createTheme();

    const renderNotFound = () => {
        return render(
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    <NotFound />
                </BrowserRouter>
            </ThemeProvider>
        );
    };

    it('renders 404 header and fault chip', () => {
        renderNotFound();
        expect(screen.getByText('FAULT • 404 NOT FOUND')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument();
        expect(screen.getByText('Shuttlecock Out of Bounds!')).toBeInTheDocument();
    });

    it('renders authentic isometric badminton court illustration with accessible role', () => {
        renderNotFound();
        const svg = screen.getByRole('img', { name: /isometric badminton court showing a shuttlecock landing out of bounds/i });
        expect(svg).toBeInTheDocument();
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText('+ 16 mm')).toBeInTheDocument();
    });

    it('navigates to home when Return to Court button is clicked', () => {
        renderNotFound();
        const homeBtn = screen.getByRole('button', { name: /return to court/i });
        expect(homeBtn).toBeInTheDocument();
        fireEvent.click(homeBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('navigates to community when Community Feed button is clicked', () => {
        renderNotFound();
        const communityBtn = screen.getByRole('button', { name: /community feed/i });
        expect(communityBtn).toBeInTheDocument();
        fireEvent.click(communityBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/community');
    });
});
