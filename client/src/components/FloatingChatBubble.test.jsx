import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FloatingChatBubble from './FloatingChatBubble';

describe('FloatingChatBubble Component', () => {
    const mockBubble = {
        _id: 'user-bubble-1',
        name: 'Taylor Lee',
        avatarUrl: 'https://example.com/taylor.png',
        unreadCount: 3
    };

    it('renders circular bubble with unread badge count', () => {
        render(
            <FloatingChatBubble
                bubble={mockBubble}
                isOnline={true}
                onClick={vi.fn()}
                onDismiss={vi.fn()}
            />
        );
        expect(screen.getByTestId('floating-chat-bubble-user-bubble-1')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByAltText('Taylor Lee')).toBeInTheDocument();
    });

    it('calls onClick when bubble avatar is clicked', () => {
        const onClick = vi.fn();
        render(
            <FloatingChatBubble
                bubble={mockBubble}
                onClick={onClick}
                onDismiss={vi.fn()}
            />
        );
        fireEvent.click(screen.getByTestId('floating-chat-bubble-user-bubble-1'));
        expect(onClick).toHaveBeenCalledWith('user-bubble-1');
    });

    it('calls onOpen when passed as alias for onClick', () => {
        const onOpen = vi.fn();
        render(
            <FloatingChatBubble
                bubble={mockBubble}
                onOpen={onOpen}
                onDismiss={vi.fn()}
            />
        );
        fireEvent.click(screen.getByTestId('floating-chat-bubble-user-bubble-1'));
        expect(onOpen).toHaveBeenCalledWith('user-bubble-1');
    });

    it('activates on keyboard Enter press', () => {
        const onClick = vi.fn();
        render(
            <FloatingChatBubble
                bubble={mockBubble}
                onClick={onClick}
                onDismiss={vi.fn()}
            />
        );
        fireEvent.keyDown(screen.getByTestId('floating-chat-bubble-user-bubble-1'), { key: 'Enter' });
        expect(onClick).toHaveBeenCalledWith('user-bubble-1');
    });

    it('calls onDismiss when dismiss "x" button is clicked and stops propagation', () => {
        const onClick = vi.fn();
        const onDismiss = vi.fn();
        render(
            <FloatingChatBubble
                bubble={mockBubble}
                onClick={onClick}
                onDismiss={onDismiss}
            />
        );
        const dismissBtn = screen.getByTestId('dismiss-chat-bubble-user-bubble-1');
        fireEvent.click(dismissBtn);
        expect(onDismiss).toHaveBeenCalledWith('user-bubble-1');
        expect(onClick).not.toHaveBeenCalled();
    });
});
