import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Landing from './Landing';
import { ThemeProvider, createTheme } from '@mui/material/styles';

describe('Landing Page Component', () => {
    const renderWithProviders = () => {
        const theme = createTheme();
        return render(
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    <Landing />
                </BrowserRouter>
            </ThemeProvider>
        );
    };

    it('renders the main hero text', () => {
        renderWithProviders();
        expect(screen.getByText('GMU Badminton Hub')).toBeInTheDocument();
        expect(screen.getByText(/The official community platform/i)).toBeInTheDocument();
    });

    it('renders all four feature cards', () => {
        renderWithProviders();
        expect(screen.getByText('Live RAC Status')).toBeInTheDocument();
        expect(screen.getByText('Elo Leaderboards')).toBeInTheDocument();
        expect(screen.getByText('Active Forum')).toBeInTheDocument();
        expect(screen.getByText('Player Profiles')).toBeInTheDocument();
    });

    it('contains a Join the Club CTA button', () => {
        renderWithProviders();
        const button = screen.getByRole('button', { name: /join the club/i });
        expect(button).toBeInTheDocument();
    });
});
