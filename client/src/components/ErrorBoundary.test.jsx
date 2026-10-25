import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

const mockOpenFeedbackModal = vi.fn();

vi.mock('../context/FeedbackContext', () => ({
    useFeedback: () => ({
        openFeedbackModal: mockOpenFeedbackModal,
        isFeedbackModalOpen: false,
        activeTab: 'feedback',
        draftFeedback: {}
    })
}));

const BrokenComponent = () => {
    throw new Error('Test crash in component');
};

const WorkingComponent = () => <div>Normal Working Screen</div>;

describe('ErrorBoundary Component', () => {
    const originalConsoleError = console.error;

    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress expected React boundary error logging
        console.error = vi.fn();
    });

    afterEach(() => {
        console.error = originalConsoleError;
    });

    it('renders children when there are no errors', () => {
        render(
            <ErrorBoundary>
                <WorkingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Normal Working Screen')).toBeInTheDocument();
    });

    it('catches render error and displays graceful UI fallback with triggers', () => {
        render(
            <ErrorBoundary>
                <BrokenComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
        expect(screen.getByText(/An unexpected issue occurred while rendering this page/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /report issue/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /return home/i })).toBeInTheDocument();
    });

    it('supports custom fallback node when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom Error Fallback</div>}>
                <BrokenComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument();
    });

    it('calls onReset when Try Again button is clicked', () => {
        const onResetMock = vi.fn();
        render(
            <ErrorBoundary onReset={onResetMock}>
                <BrokenComponent />
            </ErrorBoundary>
        );

        const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(tryAgainBtn);

        expect(onResetMock).toHaveBeenCalledTimes(1);
    });

    it('opens feedback modal with prefilled error details when Report Issue is clicked', () => {
        render(
            <ErrorBoundary>
                <BrokenComponent />
            </ErrorBoundary>
        );

        const reportBtn = screen.getByRole('button', { name: /report issue/i });
        fireEvent.click(reportBtn);

        expect(mockOpenFeedbackModal).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'bug',
                severity: 'critical',
                initialData: expect.objectContaining({
                    type: 'bug',
                    severity: 'critical',
                    title: expect.stringContaining('Test crash in component')
                })
            })
        );
    });
});
