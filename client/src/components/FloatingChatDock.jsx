import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Paper, Typography, Avatar, IconButton, TextField,
    Badge, Tooltip, CircularProgress, Menu, MenuItem, ListItemAvatar, ListItemText, Button
} from '@mui/material';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import SendIcon from '@mui/icons-material/Send';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { useAuth } from '../context/AuthContext';
import apiFetch from '../utils/api';
import socket from '../utils/socket';

export default function FloatingChatDock() {
    const { user } = useAuth();
    const currentUserId = user?._id || user?.id;

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeRecipient, setActiveRecipient] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [recentConversations, setRecentConversations] = useState([]);
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [conversationsMenuAnchor, setConversationsMenuAnchor] = useState(null);
    const [communityMembers, setCommunityMembers] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Scroll to bottom on new message
    const scrollToBottom = useCallback(() => {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    // Load recent conversations
    const fetchRecentConversations = useCallback(async () => {
        if (!currentUserId) return;
        try {
            const res = await apiFetch(`/api/messages/recent/${currentUserId}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setRecentConversations(data);
                    // Default to the most recent conversation partner if no active chat
                    if (data.length > 0) {
                        const first = data[0];
                        const partner = first.partner || first.user || first;
                        if (partner && (partner._id || partner.id)) {
                            setActiveRecipient(prev => prev || {
                                _id: partner._id || partner.id,
                                name: partner.name || partner.username || 'Badminton Player',
                                avatarUrl: partner.avatarUrl || partner.profilePic || ''
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Failed to load recent conversations:', err.message);
        }
    }, [currentUserId]);

    // Fetch conversation messages with activeRecipient
    const fetchMessages = useCallback(async (recipientId) => {
        if (!currentUserId || !recipientId) return;
        setLoadingMessages(true);
        try {
            const res = await apiFetch(`/api/messages/${currentUserId}/${recipientId}?page=1&limit=50`);
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.messages || []);
                setMessages(list);
                // Mark messages as read
                apiFetch(`/api/messages/read/${currentUserId}/${recipientId}`, { method: 'PUT' }).catch(() => {});
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Failed to load messages:', err.message);
        } finally {
            setLoadingMessages(false);
            setTimeout(scrollToBottom, 100);
        }
    }, [currentUserId, scrollToBottom]);

    // Open chat when external event 'openChatWithUser' fires
    useEffect(() => {
        const handleOpenChat = (e) => {
            const targetUser = e.detail;
            if (!targetUser) return;
            const targetId = targetUser._id || targetUser.id;
            if (!targetId || targetId === currentUserId) return;

            setActiveRecipient({
                _id: targetId,
                name: targetUser.name || targetUser.username || 'Badminton Player',
                avatarUrl: targetUser.avatarUrl || targetUser.profilePic || ''
            });
            setIsOpen(true);
            setIsMinimized(false);
            fetchMessages(targetId);
            setTimeout(() => inputRef.current?.focus(), 200);
        };

        window.addEventListener('openChatWithUser', handleOpenChat);
        return () => window.removeEventListener('openChatWithUser', handleOpenChat);
    }, [currentUserId, fetchMessages]);

    // Initial load
    useEffect(() => {
        if (currentUserId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchRecentConversations();
        }
    }, [currentUserId, fetchRecentConversations]);

    // When activeRecipient changes, load their conversation
    useEffect(() => {
        if (activeRecipient?._id && isOpen && !isMinimized) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchMessages(activeRecipient._id);
        }
    }, [activeRecipient, isOpen, isMinimized, fetchMessages]);

    // Load available community members when chat is open without active recipient
    useEffect(() => {
        if (!isOpen || isMinimized || activeRecipient) return;
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
    }, [isOpen, isMinimized, activeRecipient, currentUserId]);

    // Socket listeners for real-time messaging
    useEffect(() => {
        if (!socket || !currentUserId) return;

        const handlePrivateMessage = (msg) => {
            const senderId = typeof msg.sender === 'object' ? (msg.sender?._id || msg.sender?.id) : msg.sender;
            const recipientId = typeof msg.recipient === 'object' ? (msg.recipient?._id || msg.recipient?.id) : msg.recipient;

            // If message belongs to active chat, append it
            if (
                activeRecipient && 
                (senderId === activeRecipient._id || recipientId === activeRecipient._id)
            ) {
                setMessages(prev => {
                    if (prev.some(m => (m._id || m.id) === (msg._id || msg.id))) return prev;
                    return [...prev, msg];
                });
                setTimeout(scrollToBottom, 50);

                if (isOpen && !isMinimized && senderId === activeRecipient._id) {
                    apiFetch(`/api/messages/read/${currentUserId}/${activeRecipient._id}`, { method: 'PUT' }).catch(() => {});
                }
            } else {
                // Refresh recent conversations to update preview/unread
                fetchRecentConversations();
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
    }, [currentUserId, activeRecipient, isOpen, isMinimized, scrollToBottom, fetchRecentConversations]);

    // Send message handler
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        const trimmed = inputMessage.trim();
        if (!trimmed || !activeRecipient?._id || !currentUserId) return;

        const optimisticId = `temp-${Date.now()}`;
        const newMsg = {
            _id: optimisticId,
            content: trimmed,
            sender: { _id: currentUserId, name: user?.name || 'You', avatarUrl: user?.avatarUrl || '' },
            recipient: { _id: activeRecipient._id, name: activeRecipient.name },
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, newMsg]);
        setInputMessage('');
        setTimeout(scrollToBottom, 50);

        try {
            const res = await apiFetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: currentUserId,
                    receiverId: activeRecipient._id,
                    content: trimmed
                })
            });
            if (res.ok) {
                const saved = await res.json();
                // Replace optimistic message with server version
                setMessages(prev => prev.map(m => m._id === optimisticId ? saved : m));
            }
        } catch (err) {
            console.warn('[FloatingChatDock] Message send failed:', err.message);
        }
    };

    if (!currentUserId) return null;

    const isRecipientOnline = activeRecipient?._id ? onlineUserIds.has(activeRecipient._id) : false;

    // 1. COLLAPSED FLOATING LAUNCHER (When closed or minimized)
    if (!isOpen || isMinimized) {
        return (
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 1200
                }}
            >
                <Tooltip title={isMinimized && activeRecipient ? `Chat with ${activeRecipient.name}` : "Open Messenger Chat"}>
                    <IconButton
                        data-testid="floating-chat-launcher"
                        aria-label="Open Messenger Chat"
                        onClick={() => {
                            setIsOpen(true);
                            setIsMinimized(false);
                            if (activeRecipient?._id) fetchMessages(activeRecipient._id);
                            else fetchRecentConversations();
                        }}
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
                            invisible={!isRecipientOnline}
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        >
                            <ChatBubbleOutlinedIcon sx={{ fontSize: 26 }} />
                        </Badge>
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }

    // 2. EXPANDED FACEBOOK-STYLE CHAT WINDOW
    return (
        <Paper
            elevation={10}
            data-testid="floating-chat-window"
            sx={{
                position: 'fixed',
                bottom: 20,
                right: { xs: 16, sm: 24 },
                width: { xs: 'calc(100vw - 32px)', sm: 340 },
                height: 440,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 3.5,
                overflow: 'hidden',
                zIndex: 1250,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22)'
            }}
        >
            {/* CHAT HEADER */}
            <Box
                sx={{
                    px: 1.75,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, overflow: 'hidden' }}>
                    <Badge
                        color="success"
                        variant="dot"
                        invisible={!isRecipientOnline}
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <Avatar
                            src={activeRecipient?.avatarUrl}
                            alt={activeRecipient?.name || 'Chat'}
                            sx={{ width: 34, height: 34, fontSize: '0.85rem', bgcolor: 'primary.main' }}
                        >
                            {activeRecipient?.name ? activeRecipient.name.charAt(0).toUpperCase() : 'P'}
                        </Avatar>
                    </Badge>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight="bold"
                            noWrap
                            sx={{ lineHeight: 1.2, fontSize: '0.9rem' }}
                        >
                            {activeRecipient?.name || 'Badminton Chat'}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: !activeRecipient ? 'text.secondary' : (isRecipientOnline ? 'success.main' : 'text.secondary'),
                                fontSize: '0.72rem',
                                fontWeight: 500,
                                display: 'block'
                            }}
                        >
                            {!activeRecipient ? 'Choose a player' : (isRecipientOnline ? 'Active now' : 'Offline')}
                        </Typography>
                    </Box>
                </Box>

                {/* Control Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {recentConversations.length > 1 && (
                        <Tooltip title="Switch Conversation">
                            <IconButton
                                size="small"
                                aria-label="Switch conversation partner"
                                onClick={(e) => setConversationsMenuAnchor(e.currentTarget)}
                                sx={{ color: 'text.secondary', p: 0.5 }}
                            >
                                <PeopleAltIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}

                    <Tooltip title="Minimize">
                        <IconButton
                            size="small"
                            aria-label="Minimize chat window"
                            onClick={() => setIsMinimized(true)}
                            sx={{ color: 'text.secondary', p: 0.5 }}
                        >
                            <RemoveIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Close">
                        <IconButton
                            size="small"
                            aria-label="Close chat window"
                            onClick={() => setIsOpen(false)}
                            sx={{ color: 'text.secondary', p: 0.5 }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* SWITCH CONVERSATION MENU */}
            <Menu
                anchorEl={conversationsMenuAnchor}
                open={Boolean(conversationsMenuAnchor)}
                onClose={() => setConversationsMenuAnchor(null)}
                slotProps={{ paper: { sx: { width: 260, maxHeight: 300, borderRadius: 2 } } }}
            >
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', fontWeight: 'bold', color: 'text.secondary' }}>
                    Recent Chats
                </Typography>
                {recentConversations.map((c, i) => {
                    const partner = c.partner || c.user || c;
                    const partnerId = partner._id || partner.id;
                    const isSelected = activeRecipient?._id === partnerId;
                    return (
                        <MenuItem
                            key={partnerId || i}
                            selected={isSelected}
                            onClick={() => {
                                setActiveRecipient({
                                    _id: partnerId,
                                    name: partner.name || partner.username || 'Player',
                                    avatarUrl: partner.avatarUrl || partner.profilePic || ''
                                });
                                setConversationsMenuAnchor(null);
                            }}
                        >
                            <ListItemAvatar sx={{ minWidth: 40 }}>
                                <Avatar src={partner.avatarUrl || partner.profilePic} sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                    {partner.name ? partner.name.charAt(0) : 'U'}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={partner.name || 'Player'}
                                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500 }}
                            />
                        </MenuItem>
                    );
                })}
            </Menu>

            {/* MESSAGE STREAM */}
            <Box
                sx={{
                    flex: 1,
                    p: 1.5,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    bgcolor: 'background.default'
                }}
            >
                {loadingMessages ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : !activeRecipient ? (
                    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 0.5, fontWeight: 500 }}>
                            Select a badminton partner to start chatting! 🏸
                        </Typography>
                        {(communityMembers.length > 0 ? communityMembers : [
                            { _id: '65f01a1b2c3d4e5f6a7b8c91', name: 'Alex Chen', role: 'Advanced Singles' },
                            { _id: '65f01a1b2c3d4e5f6a7b8c92', name: 'David Kim', role: 'Intermediate Doubles' }
                        ]).map((m) => (
                            <Box
                                key={m._id || m.id}
                                onClick={() => {
                                    const targetId = m._id || m.id;
                                    setActiveRecipient({
                                        _id: targetId,
                                        name: m.name,
                                        avatarUrl: m.profilePic || m.avatarUrl || ''
                                    });
                                    fetchMessages(targetId);
                                    setTimeout(() => inputRef.current?.focus(), 200);
                                }}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 1,
                                    borderRadius: 2,
                                    bgcolor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                    <Avatar src={m.profilePic || m.avatarUrl} sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                                        {m.name ? m.name.charAt(0) : 'U'}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="body2" fontWeight="600" sx={{ fontSize: '0.85rem' }}>
                                            {m.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
                                            {m.skillLevel || m.role || 'Member'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    aria-label={`Chat with ${m.name}`}
                                    sx={{
                                        borderRadius: 4,
                                        fontSize: '0.72rem',
                                        py: 0.2,
                                        px: 1.2,
                                        textTransform: 'none',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Chat
                                </Button>
                            </Box>
                        ))}
                    </Box>
                ) : messages.length === 0 ? (
                    <Box sx={{ m: 'auto', textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            No messages yet.
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Say hi to {activeRecipient.name}! 👋
                        </Typography>
                    </Box>
                ) : (
                    messages.map((m, idx) => {
                        const senderId = typeof m.sender === 'object' ? (m.sender?._id || m.sender?.id) : m.sender;
                        const isSelf = senderId === currentUserId;

                        return (
                            <Box
                                key={m._id || m.id || idx}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isSelf ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    alignSelf: isSelf ? 'flex-end' : 'flex-start'
                                }}
                            >
                                <Paper
                                    elevation={0}
                                    sx={{
                                        px: 1.75,
                                        py: 1,
                                        borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                        bgcolor: isSelf ? 'primary.main' : 'action.hover',
                                        color: isSelf ? '#ffffff' : 'text.primary',
                                        fontSize: '0.88rem',
                                        lineHeight: 1.4,
                                        wordBreak: 'break-word',
                                        boxShadow: isSelf ? '0 1px 4px rgba(0, 80, 40, 0.2)' : 'none'
                                    }}
                                >
                                    {m.content}
                                </Paper>
                            </Box>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </Box>

            {/* MESSAGE INPUT FORM */}
            <Box
                component="form"
                onSubmit={handleSendMessage}
                sx={{
                    p: 1.25,
                    bgcolor: 'background.paper',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}
            >
                <TextField
                    inputRef={inputRef}
                    placeholder="Aa"
                    size="small"
                    fullWidth
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={!activeRecipient?._id}
                    slotProps={{
                        htmlInput: {
                            'aria-label': 'Type a message'
                        }
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 6,
                            bgcolor: 'action.hover',
                            fontSize: '0.9rem',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' }
                        }
                    }}
                />
                <IconButton
                    type="submit"
                    color="primary"
                    disabled={!inputMessage.trim() || !activeRecipient?._id}
                    aria-label="Send message"
                    size="small"
                    sx={{
                        width: 36,
                        height: 36,
                        bgcolor: inputMessage.trim() ? 'primary.main' : 'transparent',
                        color: inputMessage.trim() ? '#ffffff' : 'text.disabled',
                        '&:hover': {
                            bgcolor: inputMessage.trim() ? 'primary.dark' : 'transparent'
                        }
                    }}
                >
                    <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
        </Paper>
    );
}
