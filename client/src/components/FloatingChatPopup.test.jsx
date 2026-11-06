import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FloatingChatPopup from './FloatingChatPopup';

describe('FloatingChatPopup Component', () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    const mockPartner = {
        _id: 'user-partner-1',
        name: 'Jordan Smith',
        avatarUrl: 'https://example.com/jordan.png',
        isMinimized: false
    };

    const mockMessages = [
        { _id: 'm1', content: 'Ready for singles?', sender: { _id: 'user-partner-1' } }
    ];

    it('renders partner name, online status, and message history', () => {
        render(
            <FloatingChatPopup
                chat={mockPartner}
                messages={mockMessages}
                currentUserId="user-self-1"
                isOnline={true}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onSendMessage={vi.fn()}
            />
        );
        expect(screen.getByText('Jordan Smith')).toBeInTheDocument();
        expect(screen.getByText('Active now')).toBeInTheDocument();
        expect(screen.getByText('Ready for singles?')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Aa')).toBeInTheDocument();
    });

    it('renders in collapsed state when isMinimized is true', () => {
        const minimizedPartner = { ...mockPartner, isMinimized: true };
        render(
            <FloatingChatPopup
                chat={minimizedPartner}
                messages={mockMessages}
                currentUserId="user-self-1"
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onSendMessage={vi.fn()}
            />
        );
        expect(screen.getByText('Jordan Smith')).toBeInTheDocument();
        // Message thread and input composer should not be visible when minimized
        expect(screen.queryByPlaceholderText('Aa')).not.toBeInTheDocument();
        expect(screen.queryByText('Ready for singles?')).not.toBeInTheDocument();
    });

    it('triggers onMinimize when clicking the header bar of a minimized popup', () => {
        const onMinimize = vi.fn();
        const minimizedPartner = { ...mockPartner, isMinimized: true };
        render(
            <FloatingChatPopup
                chat={minimizedPartner}
                messages={[]}
                currentUserId="user-self-1"
                onMinimize={onMinimize}
                onClose={vi.fn()}
            />
        );
        fireEvent.click(screen.getByText('Jordan Smith'));
        expect(onMinimize).toHaveBeenCalledWith('user-partner-1');
    });

    it('triggers onMinimize and onClose when action buttons are clicked', () => {
        const onMinimize = vi.fn();
        const onClose = vi.fn();
        render(
            <FloatingChatPopup
                chat={mockPartner}
                messages={[]}
                currentUserId="user-self-1"
                onMinimize={onMinimize}
                onClose={onClose}
                onSendMessage={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /minimize chat window/i }));
        expect(onMinimize).toHaveBeenCalledWith('user-partner-1');

        fireEvent.click(screen.getByRole('button', { name: /close chat window/i }));
        expect(onClose).toHaveBeenCalledWith('user-partner-1');
    });

    it('submits typed message via onSendMessage callback', () => {
        const onSendMessage = vi.fn();
        render(
            <FloatingChatPopup
                chat={mockPartner}
                messages={[]}
                currentUserId="user-self-1"
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onSendMessage={onSendMessage}
            />
        );
        const input = screen.getByPlaceholderText('Aa');
        fireEvent.change(input, { target: { value: 'Doubles tonight?' } });
        fireEvent.click(screen.getByRole('button', { name: /send message/i }));
        expect(onSendMessage).toHaveBeenCalledWith('user-partner-1', 'Doubles tonight?');
    });

    it('renders community member suggestions when opened without recipient', () => {
        const onSelect = vi.fn();
        render(
            <FloatingChatPopup
                chat={{ _id: '', name: 'Badminton Chat', isMinimized: false }}
                communityMembers={[
                    { _id: 'm1', name: 'Taylor Lee', skillLevel: 'Intermediate' }
                ]}
                currentUserId="user-self-1"
                onSelectCommunityMember={onSelect}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Select a badminton partner to start chatting/i)).toBeInTheDocument();
        expect(screen.getByText('Taylor Lee')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /chat with taylor lee/i }));
        expect(onSelect).toHaveBeenCalled();
    });
});
