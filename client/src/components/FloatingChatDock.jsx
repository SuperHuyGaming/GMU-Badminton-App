import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Badge, Tooltip, IconButton, useTheme, useMediaQuery
} from '@mui/material';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import { useAuth } from '../context/AuthContext';
import apiFetch from '../utils/api';
import socket from '../utils/socket';
import { CHAT_READ_EVENT, idOf, mergeMessage, notifyChatRead } from '../utils/chatState';
import FloatingChatPopup from './FloatingChatPopup';
import FloatingChatBubble from './FloatingChatBubble';

const getPartner = (c) => (c && (c.friend || c.partner || c.user)) || c || {};

export default function FloatingChatDock() {
    const { user } = useAuth();
    const currentUserId = user?._id || user?.id;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Up to 3 active popup windows docked at bottom
    const [activeChats, setActiveChats] = useState([]);
    // Up to 5 circular chat head bubbles stacked vertically on right edge
    const [chatBubbles, setChatBubbles] = useState([]);

    // Messages mapped by recipientId: { [partnerId]: Message[] }
    const [messagesByChat, setMessagesByChat] = useState({});
    const [loadingByChat, setLoadingByChat] = useState({});

    const [recentConversations, setRecentConversations] = useState([]);
    const [loadingRecents, setLoadingRecents] = useState(true);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [communityMembers, setCommunityMembers] = useState([]);

    // Keep live refs for socket listeners to avoid re-binding
    const activeChatsRef = useRef(activeChats);
    useEffect(() => {
        activeChatsRef.current = activeChats;
    }, [activeChats]);

    const recentConversationsRef = useRef(recentConversations);
    useEffect(() => {
        recentConversationsRef.current = recentConversations;
    }, [recentConversations]);

    // Fetch messages for a specific recipient
    const fetchMessages = useCallback(async (recipientId) => {
        if (!currentUserId || !recipientId) return;
        setLoadingByChat(prev => ({ ...prev, [recipientId]: true }));
        try {
            const res = await apiFetch(`/api/messages/${currentUserId}/${recipientId}?page=1&limit=50`);
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.messages || []);
                setMessagesByChat(prev => ({ ...prev, [recipientId]: list }));

                // Clear unread count for this partner in recentConversations & chatBubbles
                setRecentConversations(prev => prev.map(c =>
                    idOf(getPartner(c)) === String(recipientId) && c.unreadCount ? { ...c, unreadCount: 0 } : c
                ));
                setChatBubbles(prev => prev.map(b =>
                    String(b._id) === String(recipientId) && b.unreadCount ? { ...b, unreadCount: 0 } : b
                ));

                notifyChatRead(recipientId, { optimistic: true });
                Promise.resolve(apiFetch(`/api/messages/read/${currentUserId}/${recipientId}`, { method: 'PUT' }))
                    .then(() => notifyChatRead(recipientId))
                    .catch(() => {});
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Failed to load messages:', err.message);
        } finally {
            setLoadingByChat(prev => ({ ...prev, [recipientId]: false }));
        }
    }, [currentUserId]);

    // Load recent conversations
    const fetchRecentConversations = useCallback(async () => {
        if (!currentUserId) return;
        setLoadingRecents(true);
        try {
            const res = await apiFetch(`/api/messages/recent/${currentUserId}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setRecentConversations(data);
                    if (data.length > 0) {
                        const partner = getPartner(data[0]);
                        const partnerId = partner?._id || partner?.id;
                        if (partnerId) {
                            const partnerName = partner.name || partner.username || (data[0]?.sender?.name) || 'Alex Chen';
                            const target = {
                                _id: String(partnerId),
                                name: partnerName,
                                avatarUrl: partner.avatarUrl || partner.profilePic || '',
                                isMinimized: false,
                                lastActive: Date.now()
                            };
                            setActiveChats(prev => {
                                const pendingIdx = prev.findIndex(c => !c._id || c.isPending);
                                if (pendingIdx >= 0) {
                                    const next = [...prev];
                                    next[pendingIdx] = target;
                                    return next;
                                }
                                return prev;
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Failed to load recent conversations:', err.message);
        } finally {
            setLoadingRecents(false);
        }
    }, [currentUserId]);

    // Automatically load messages when a new active chat with _id is mounted
    useEffect(() => {
        activeChats.forEach(c => {
            if (c._id && !messagesByChat[c._id] && !loadingByChat[c._id]) {
                fetchMessages(c._id);
            }
        });
    }, [activeChats, messagesByChat, loadingByChat, fetchMessages]);

    // Open chat with target user
    const openChatWithUser = useCallback((targetUser) => {
        if (!targetUser) return;
        const targetId = String(targetUser._id || targetUser.id || '');
        if (!targetId || targetId === String(currentUserId)) return;

        const normalizedUser = {
            _id: targetId,
            name: targetUser.name || targetUser.username || 'Badminton Player',
            avatarUrl: targetUser.avatarUrl || targetUser.profilePic || '',
            isMinimized: false,
            lastActive: Date.now()
        };

        setActiveChats(prev => {
            const existingIndex = prev.findIndex(c => String(c._id) === targetId);
            if (existingIndex >= 0) {
                // Already in active popups: expand and update lastActive
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    isMinimized: false,
                    lastActive: Date.now()
                };
                return updated;
            }

            // If activeChats < 3, add as new popup
            if (prev.length < 3) {
                return [...prev, normalizedUser];
            }

            // If activeChats === 3, overflow least-recently-active to chatBubbles
            let oldestIndex = 0;
            let oldestTime = prev[0].lastActive || 0;
            for (let i = 1; i < prev.length; i++) {
                if ((prev[i].lastActive || 0) < oldestTime) {
                    oldestTime = prev[i].lastActive || 0;
                    oldestIndex = i;
                }
            }
            const displaced = prev[oldestIndex];

            // Move displaced to chatBubbles
            if (displaced && displaced._id) {
                setChatBubbles(bPrev => {
                    const withoutDisplaced = bPrev.filter(b => String(b._id) !== String(displaced._id));
                    return [{
                        _id: displaced._id,
                        name: displaced.name,
                        avatarUrl: displaced.avatarUrl,
                        unreadCount: 0
                    }, ...withoutDisplaced].slice(0, 5);
                });
            }

            const updated = [...prev];
            updated[oldestIndex] = normalizedUser;
            return updated;
        });

        // Ensure user is removed from chatBubbles since they are now an active popup
        setChatBubbles(prev => prev.filter(b => String(b._id) !== targetId));

        // Fetch messages if not yet loaded
        fetchMessages(targetId);
    }, [currentUserId, fetchMessages]);

    // Listen to global 'openChatWithUser' event
    useEffect(() => {
        const handleOpenChat = (e) => {
            if (e?.detail) {
                openChatWithUser(e.detail);
            }
        };

        window.addEventListener('openChatWithUser', handleOpenChat);
        return () => window.removeEventListener('openChatWithUser', handleOpenChat);
    }, [openChatWithUser]);

    // Initial load of recent conversations
    useEffect(() => {
        if (currentUserId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchRecentConversations();
        }
    }, [currentUserId, fetchRecentConversations]);

    // Load available community members when an empty chat picker is active
    useEffect(() => {
        const hasEmptyPicker = activeChats.some(c => !c._id && !c.isMinimized);
        if (!hasEmptyPicker || communityMembers.length > 0) return;

        let isCancelled = false;
        const fetchMembers = async () => {
            try {
                const res = await apiFetch('/api/forum/members?limit=8');
                if (!isCancelled && res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data?.users) && data.users.length > 0) {
                        setCommunityMembers(data.users.filter(u => String(u._id || u.id) !== String(currentUserId)));
                    }
                }
            } catch (err) {
                console.warn('[FloatingChatDock] Failed to load members for chat picker:', err.message);
            }
        };
        fetchMembers();
        return () => { isCancelled = true; };
    }, [activeChats, communityMembers.length, currentUserId]);

    // Listen to CHAT_READ_EVENT to sync unread counts across tabs/surfaces
    useEffect(() => {
        const handleChatRead = (e) => {
            const partnerId = e?.detail?.partnerId;
            if (partnerId) {
                setRecentConversations(prev => prev.map(c =>
                    idOf(getPartner(c)) === partnerId && c.unreadCount ? { ...c, unreadCount: 0 } : c
                ));
                setChatBubbles(prev => prev.map(b =>
                    String(b._id) === partnerId && b.unreadCount ? { ...b, unreadCount: 0 } : b
                ));
            }
        };

        window.addEventListener(CHAT_READ_EVENT, handleChatRead);
        return () => window.removeEventListener(CHAT_READ_EVENT, handleChatRead);
    }, []);

    // Socket listeners for real-time messaging
    useEffect(() => {
        if (!socket || !currentUserId) return;
        const selfId = String(currentUserId);

        const handlePrivateMessage = (msg) => {
            if (!msg) return;
            const senderId = idOf(msg.sender);
            const recipientId = idOf(msg.receiver ?? msg.recipient);
            const isMine = senderId === selfId;
            const partnerId = isMine ? recipientId : senderId;
            if (!partnerId) return;

            const activeChat = activeChatsRef.current.find(c => String(c._id) === partnerId);
            if (activeChat) {
                // Conversation is an active popup window
                setMessagesByChat(prev => ({
                    ...prev,
                    [partnerId]: mergeMessage(prev[partnerId] || [], msg, { selfId })
                }));

                if (!isMine) {
                    if (!activeChat.isMinimized) {
                        Promise.resolve(apiFetch(`/api/messages/read/${selfId}/${partnerId}`, { method: 'PUT' }))
                            .then(() => notifyChatRead(partnerId))
                            .catch(() => {});
                    } else {
                        // Minimized popup: bump unread count on bubble
                        setChatBubbles(prev => prev.map(b =>
                            String(b._id) === partnerId ? { ...b, unreadCount: (b.unreadCount || 0) + 1 } : b
                        ));
                    }
                }
            } else {
                // Partner not currently in activeChats
                if (!isMine) {
                    setChatBubbles(prev => {
                        const existing = prev.find(b => String(b._id) === partnerId);
                        if (existing) {
                            return prev.map(b => String(b._id) === partnerId ? { ...b, unreadCount: (b.unreadCount || 0) + 1 } : b);
                        }
                        const newBubble = {
                            _id: partnerId,
                            name: (typeof msg.sender === 'object' ? msg.sender.name : null) || 'Badminton Player',
                            avatarUrl: (typeof msg.sender === 'object' ? (msg.sender.avatarUrl || msg.sender.profilePic) : '') || '',
                            unreadCount: 1
                        };
                        return [newBubble, ...prev].slice(0, 5);
                    });
                    fetchRecentConversations();
                }
            }
        };

        const handleOnlineUsers = (users) => {
            if (Array.isArray(users)) {
                setOnlineUserIds(new Set(users.map(u => (typeof u === 'string' ? u : u._id || u.id))));
            }
        };

        socket.on('privateMessage', handlePrivateMessage);
        socket.on('onlineUsersUpdate', handleOnlineUsers);

        return () => {
            socket.off('privateMessage', handlePrivateMessage);
            socket.off('onlineUsersUpdate', handleOnlineUsers);
        };
    }, [currentUserId, fetchRecentConversations]);

    // Send message handler
    const handleSendMessage = useCallback(async (chatId, content) => {
        const trimmed = content.trim();
        if (!trimmed || !chatId || !currentUserId) return;

        const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const targetChat = activeChatsRef.current.find(c => String(c._id) === String(chatId));

        const newMsg = {
            _id: optimisticId,
            content: trimmed,
            sender: { _id: currentUserId, name: user?.name || 'You', avatarUrl: user?.avatarUrl || '' },
            receiver: { _id: chatId, name: targetChat?.name || 'Player' },
            createdAt: new Date().toISOString()
        };

        setMessagesByChat(prev => ({
            ...prev,
            [chatId]: [...(prev[chatId] || []), newMsg]
        }));

        // Update active chat's lastActive timestamp
        setActiveChats(prev => prev.map(c =>
            String(c._id) === String(chatId) ? { ...c, lastActive: Date.now() } : c
        ));

        try {
            const res = await apiFetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: currentUserId,
                    receiverId: chatId,
                    content: trimmed
                })
            });
            if (res.ok) {
                const saved = await res.json();
                if (saved && saved._id) {
                    setMessagesByChat(prev => ({
                        ...prev,
                        [chatId]: mergeMessage(prev[chatId] || [], saved, { selfId: String(currentUserId), tempId: optimisticId })
                    }));
                }
            } else {
                // Drop optimistic copy on failure
                setMessagesByChat(prev => ({
                    ...prev,
                    [chatId]: (prev[chatId] || []).filter(m => m._id !== optimisticId)
                }));
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Message send failed:', err.message);
            setMessagesByChat(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || []).filter(m => m._id !== optimisticId)
            }));
        }
    }, [currentUserId, user]);

    // Minimize handler
    const handleMinimizeChat = useCallback((chatId) => {
        setActiveChats(prev => prev.map(c =>
            String(c._id) === String(chatId) ? { ...c, isMinimized: !c.isMinimized } : c
        ));
    }, []);

    // Close handler
    const handleCloseChat = useCallback((chatId) => {
        setActiveChats(prev => {
            const closed = prev.find(c => String(c._id) === String(chatId));
            if (closed && closed._id) {
                // Register in chatBubbles for quick 1-click re-access
                setChatBubbles(bPrev => {
                    const without = bPrev.filter(b => String(b._id) !== String(closed._id));
                    return [{
                        _id: closed._id,
                        name: closed.name,
                        avatarUrl: closed.avatarUrl,
                        unreadCount: 0
                    }, ...without].slice(0, 5);
                });
            }
            return prev.filter(c => String(c._id) !== String(chatId));
        });
    }, []);

    // Bubble click handler: restore to active popup
    const handleBubbleClick = useCallback((bubbleId) => {
        const bubble = chatBubbles.find(b => String(b._id) === String(bubbleId));
        if (bubble) {
            openChatWithUser(bubble);
        }
    }, [chatBubbles, openChatWithUser]);

    // Bubble dismiss handler: completely remove
    const handleBubbleDismiss = useCallback((bubbleId) => {
        const id = String(bubbleId);
        setChatBubbles(prev => prev.filter(b => String(b._id) !== id));
        setActiveChats(prev => prev.filter(c => String(c._id) !== id));
    }, []);

    // Member selection in empty picker popup
    const handleSelectCommunityMember = useCallback((member) => {
        const memberId = String(member._id || member.id);
        setActiveChats(prev => prev.map(c =>
            !c._id ? {
                _id: memberId,
                name: member.name,
                avatarUrl: member.profilePic || member.avatarUrl || '',
                isMinimized: false,
                lastActive: Date.now()
            } : c
        ));
        fetchMessages(memberId);
    }, [fetchMessages]);

    // Switch conversation partner from popup menu
    const handleSwitchConversation = useCallback((newPartner) => {
        openChatWithUser(newPartner);
    }, [openChatWithUser]);

    // Launcher click handler
    const handleLauncherClick = useCallback(() => {
        if (activeChats.length > 0) {
            // Expand any minimized active chats
            setActiveChats(prev => prev.map(c => ({ ...c, isMinimized: false })));
            return;
        }

        if (recentConversations.length > 0) {
            const partner = getPartner(recentConversations[0]);
            const partnerId = partner?._id || partner?.id;
            if (partnerId) {
                openChatWithUser({
                    _id: String(partnerId),
                    name: partner.name || partner.username || 'Alex Chen',
                    avatarUrl: partner.avatarUrl || partner.profilePic || ''
                });
                return;
            }
        }

        // If recents are still loading, open a pending chat that will populate once loaded
        if (loadingRecents) {
            setActiveChats([{
                _id: '',
                name: 'Badminton Chat',
                avatarUrl: '',
                isMinimized: false,
                isPending: true,
                lastActive: Date.now()
            }]);
            return;
        }

        // No recent conversations: open an empty picker window
        setActiveChats([{
            _id: '',
            name: 'Badminton Chat',
            avatarUrl: '',
            isMinimized: false,
            isPending: false,
            lastActive: Date.now()
        }]);
    }, [activeChats.length, recentConversations, loadingRecents, openChatWithUser]);

    if (!currentUserId) return null;

    const unreadTotal = recentConversations.reduce((acc, c) => acc + (Number(c?.unreadCount) || 0), 0);
    const topPartner = recentConversations.length > 0 ? getPartner(recentConversations[0]) : null;
    const isLauncherPartnerOnline = topPartner?._id ? onlineUserIds.has(String(topPartner._id)) : false;

    // All active popups are either non-existent or minimized
    const allMinimized = activeChats.length === 0 || activeChats.every(c => c.isMinimized);

    // On mobile screens (<600px), collapse multiple windows to only the latest active one
    const displayedChats = isMobile && activeChats.length > 0
        ? [activeChats[activeChats.length - 1]]
        : activeChats;

    return (
        <>
            {/* DOCKED ACTIVE POPUP WINDOWS */}
            {displayedChats.map((chat, idx) => (
                <FloatingChatPopup
                    key={chat._id || `empty-${idx}`}
                    chat={chat}
                    index={idx}
                    isMobile={isMobile}
                    isOnline={chat._id ? onlineUserIds.has(String(chat._id)) : false}
                    messages={messagesByChat[chat._id] || []}
                    loadingMessages={Boolean(loadingByChat[chat._id])}
                    currentUserId={currentUserId}
                    onSendMessage={handleSendMessage}
                    onMinimize={handleMinimizeChat}
                    onClose={handleCloseChat}
                    communityMembers={communityMembers}
                    onSelectCommunityMember={handleSelectCommunityMember}
                    recentConversations={recentConversations}
                    onSwitchConversation={handleSwitchConversation}
                />
            ))}

            {/* VERTICAL CHAT HEAD RAIL */}
            <Box
                sx={{
                    position: 'fixed',
                    right: 16,
                    bottom: 24,
                    zIndex: 1260,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    gap: 1,
                    alignItems: 'center'
                }}
            >
                {/* Primary Collapsed Launcher */}
                {allMinimized && (
                    <Badge
                        data-testid="floating-chat-unread-badge"
                        badgeContent={unreadTotal}
                        max={99}
                        color="error"
                        invisible={unreadTotal === 0}
                        overlap="circular"
                        sx={{ '& .MuiBadge-badge': { zIndex: 1, pointerEvents: 'none' } }}
                    >
                        <Tooltip title="Open Messenger Chat">
                            <IconButton
                                data-testid="floating-chat-launcher"
                                aria-label={unreadTotal > 0 ? `Open Messenger Chat (${unreadTotal} unread)` : "Open Messenger Chat"}
                                onClick={handleLauncherClick}
                                sx={{
                                    width: 56,
                                    height: 56,
                                    bgcolor: 'primary.main',
                                    color: '#ffffff',
                                    boxShadow: '0 6px 20px rgba(0, 80, 40, 0.35)',
                                    transition: 'all 0.25s ease-in-out',
                                    '&:hover': {
                                        bgcolor: 'primary.dark',
                                        transform: 'scale(1.06)',
                                        boxShadow: '0 8px 25px rgba(0, 80, 40, 0.45)'
                                    }
                                }}
                            >
                                <Badge
                                    color="success"
                                    variant="dot"
                                    invisible={!isLauncherPartnerOnline}
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                >
                                    <ChatBubbleOutlinedIcon sx={{ fontSize: 26 }} />
                                </Badge>
                            </IconButton>
                        </Tooltip>
                    </Badge>
                )}

                {/* Circular Chat Head Bubbles (up to 5) */}
                {chatBubbles
                    .filter(b => !activeChats.some(a => String(a._id) === String(b._id)))
                    .map((bubble, i) => (
                        <FloatingChatBubble
                            key={bubble._id}
                            bubble={bubble}
                            index={i}
                            isOnline={onlineUserIds.has(String(bubble._id))}
                            onClick={handleBubbleClick}
                            onDismiss={handleBubbleDismiss}
                        />
                    ))
                }
            </Box>
        </>
    );
}
