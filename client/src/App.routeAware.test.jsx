// On /messages (phone 390x844) the floating Messenger launcher and the feedback FAB covered the
// chat input and Send button. The launcher must not render on /messages, and the FAB is hidden
// there on small screens only.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./components/FloatingChatDock', () => ({
    default: () => <div data-testid="floating-chat-dock" />,
}));
vi.mock('./components/FeedbackFAB', () => ({
    default: ({ hideOnSmallScreens }) => (
        <div data-testid="feedback-fab" data-hide-small={String(Boolean(hideOnSmallScreens))} />
    ),
}));
vi.mock('./context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'u1', name: 'Bob Bot' } }),
}));

import { RouteAwareChatDock, RouteAwareFeedbackFAB } from './App';

const renderAt = (path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <RouteAwareChatDock />
            <RouteAwareFeedbackFAB />
        </MemoryRouter>
    );

describe('route-aware floating buttons', () => {
    it('hides the Messenger launcher on /messages', () => {
        renderAt('/messages');
        expect(screen.queryByTestId('floating-chat-dock')).not.toBeInTheDocument();
    });

    it('hides the feedback FAB on small screens on /messages', () => {
        renderAt('/messages');
        expect(screen.getByTestId('feedback-fab')).toHaveAttribute('data-hide-small', 'true');
    });

    it('keeps both everywhere else', () => {
        renderAt('/community');
        expect(screen.getByTestId('floating-chat-dock')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-fab')).toHaveAttribute('data-hide-small', 'false');
    });
});
