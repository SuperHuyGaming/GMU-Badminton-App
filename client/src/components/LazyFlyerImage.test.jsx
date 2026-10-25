import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LazyFlyerImage from './LazyFlyerImage';

describe('LazyFlyerImage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders branded collegiate fallback banner when src is empty or null', () => {
        render(<LazyFlyerImage src="" fallbackHost="George Mason University" />);
        
        expect(screen.getByTestId('flyer-fallback-banner')).toBeInTheDocument();
        expect(screen.getByText(/George Mason University/i)).toBeInTheDocument();
    });

    it('renders image and skeleton placeholder when src is provided', () => {
        render(
            <LazyFlyerImage 
                src="https://example.com/flyer.png" 
                alt="GMU Badminton Open flyer"
                fallbackHost="GMU Badminton" 
            />
        );

        // Container is rendered
        expect(screen.getByTestId('lazy-flyer-container')).toBeInTheDocument();
        // Image element is present
        const img = screen.getByTestId('lazy-flyer-img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/flyer.png');
        expect(img).toHaveAttribute('alt', 'GMU Badminton Open flyer');
    });

    it('transitions to fallback banner upon image loading error', () => {
        render(
            <LazyFlyerImage 
                src="https://example.com/broken-link-404.png" 
                fallbackHost="Capital Badminton Club" 
            />
        );

        const img = screen.getByTestId('lazy-flyer-img');
        expect(img).toBeInTheDocument();

        // Simulate image error (e.g. 404 or broken external image)
        fireEvent.error(img);

        // Fallback banner should now replace broken image
        expect(screen.getByTestId('flyer-fallback-banner')).toBeInTheDocument();
        expect(screen.getByText(/Capital Badminton Club/i)).toBeInTheDocument();
    });

    it('renders "Sold Out" badge on image container and fallback banner', () => {
        const { unmount } = render(
            <LazyFlyerImage 
                src="https://example.com/flyer.png" 
                isSoldOut={true} 
            />
        );

        expect(screen.getByText('Sold Out')).toBeInTheDocument();
        unmount();

        // Test Sold Out badge on fallback banner as well
        render(
            <LazyFlyerImage 
                src="" 
                isSoldOut={true} 
            />
        );
        expect(screen.getByText('Sold Out')).toBeInTheDocument();
    });
});
