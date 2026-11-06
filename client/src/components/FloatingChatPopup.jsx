import PropTypes from 'prop-types';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, Avatar, IconButton, TextField,
    Badge, Tooltip, CircularProgress, Menu, MenuItem, ListItemAvatar, ListItemText, Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PhoneIcon from '@mui/icons-material/Phone';
import VideocamIcon from '@mui/icons-material/Videocam';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { motion } from 'framer-motion';
import { markChatVisible, idOf } from '../utils/chatState';

const getPartnerFromConv = (c) => (c && (c.friend || c.partner || c.user)) || c || {};

export default function FloatingChatPopup({
    chat,
    partner: partnerProp,
    index = 0,
    isMobile = false,
    isOnline = false,
    messages = [],
    loadingMessages = false,
    currentUserId,
    onSendMessage,
    onMinimize,
    onClose,
    communityMembers = [],
    onSelectCommunityMember,
    recentConversations = [],
    onSwitchConversation
}) {
    const activeTarget = chat || partnerProp || {};
    const partnerId = String(activeTarget._id || activeTarget.id || '');
    const partnerName = activeTarget.name || activeTarget.username || (partnerId ? 'Badminton Player' : 'Badminton Chat');
    const avatarUrl = activeTarget.avatarUrl || activeTarget.profilePic || '';
    const initial = partnerName ? partnerName.charAt(0).toUpperCase() : 'P';
    const isMinimized = Boolean(activeTarget.isMinimized);

    const [inputMessage, setInputMessage] = useState('');
    const [conversationsMenuAnchor, setConversationsMenuAnchor] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-scroll to bottom on messages update
    const scrollToBottom = useCallback(() => {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    useEffect(() => {
        if (!isMinimized) {
            scrollToBottom();
        }
    }, [messages, isMinimized, scrollToBottom]);

    // Focus input on expand
    useEffect(() => {
        if (!isMinimized && partnerId) {
            const timer = setTimeout(() => inputRef.current?.focus(), 150);
            return () => clearTimeout(timer);
        }
    }, [isMinimized, partnerId]);

    // Register visibility for read receipts and unread badge coordination
    useEffect(() => {
        if (!isMinimized && partnerId) {
            return markChatVisible(partnerId);
        }
    }, [partnerId, isMinimized]);

    const handleSend = (e) => {
        if (e) e.preventDefault();
        const trimmed = inputMessage.trim();
        if (!trimmed || !partnerId) return;

        onSendMessage?.(partnerId, trimmed);
        setInputMessage('');
        setTimeout(scrollToBottom, 50);
    };

    const handleSendQuickLike = () => {
        if (!partnerId) return;
        onSendMessage?.(partnerId, '👍');
        setTimeout(scrollToBottom, 50);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file || !partnerId) return;
        if (file.type.startsWith('image/')) {
            onSendMessage?.(partnerId, `[Image: ${file.name}]`);
        } else {
            onSendMessage?.(partnerId, `[File: ${file.name}]`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Paper
            component={motion.div}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            elevation={10}
            data-testid={isMinimized ? undefined : 'floating-chat-window'}
            sx={{
                position: 'fixed',
                bottom: 0,
                right: isMobile ? 16 : `${index * 340 + 72}px`,
                width: isMobile ? 'calc(100vw - 32px)' : 328,
                height: isMinimized ? 40 : (isMobile ? '75vh' : 420),
                maxHeight: isMobile ? '85vh' : 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px 16px 0 0',
                overflow: 'hidden',
                zIndex: 1250 + index,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(10, 30, 20, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
                transition: 'height 0.25s ease, right 0.25s ease'
            }}
        >
            <Box
                data-testid={`floating-chat-popup-${partnerId || 'new'}`}
                sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0 }}
            >
                {/* POPUP HEADER */}
                <Box
                    onClick={() => {
                        if (isMinimized) onMinimize?.(partnerId);
                    }}
                    sx={{
                        px: 1.5,
                        py: isMinimized ? 0.75 : 1,
                        minHeight: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: 'background.paper',
                        borderBottom: isMinimized ? 'none' : '1px solid',
                        borderColor: 'divider',
                        cursor: isMinimized ? 'pointer' : 'default',
                        userSelect: 'none'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', minWidth: 0 }}>
                        <Badge
                            color="success"
                            variant="dot"
                            invisible={!isOnline}
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        >
                            <Avatar
                                src={avatarUrl}
                                alt={partnerName}
                                onClick={(e) => {
                                    if (!isMinimized && partnerId) {
                                        e.stopPropagation();
                                        window.open(`/profile/${partnerId}`, '_blank');
                                    }
                                }}
                                sx={{
                                    width: 30,
                                    height: 30,
                                    fontSize: '0.8rem',
                                    bgcolor: 'primary.main',
                                    cursor: (!isMinimized && partnerId) ? 'pointer' : 'default',
                                    transition: 'opacity 0.15s ease',
                                    '&:hover': (!isMinimized && partnerId) ? { opacity: 0.85 } : {}
                                }}
                            >
                                {initial}
                            </Avatar>
                        </Badge>

                        <Box
                            sx={{ minWidth: 0, cursor: (!isMinimized && partnerId) ? 'pointer' : 'default' }}
                            onClick={(e) => {
                                if (!isMinimized && partnerId) {
                                    e.stopPropagation();
                                    window.open(`/profile/${partnerId}`, '_blank');
                                }
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                fontWeight="bold"
                                noWrap
                                sx={{
                                    lineHeight: 1.2,
                                    fontSize: '0.88rem',
                                    '&:hover': (!isMinimized && partnerId) ? { textDecoration: 'underline' } : {}
                                }}
                            >
                                {partnerName}
                            </Typography>
                            {!isMinimized && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: !partnerId ? 'text.secondary' : (isOnline ? 'success.main' : 'text.secondary'),
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        display: 'block',
                                        lineHeight: 1.1
                                    }}
                                >
                                    {!partnerId ? 'Choose a player' : (isOnline ? 'Active now' : 'Offline')}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {/* Header Controls */}
                    <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {!isMinimized && partnerId && (
                            <>
                                <Tooltip title="Start voice call (Coming soon)">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled
                                            aria-label="Start voice call"
                                            sx={{ color: 'text.secondary', p: 0.5 }}
                                        >
                                            <PhoneIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title="Start video call (Coming soon)">
                                    <span>
                                        <IconButton
                                            size="small"
                                            disabled
                                            aria-label="Start video call"
                                            sx={{ color: 'text.secondary', p: 0.5 }}
                                        >
                                            <VideocamIcon sx={{ fontSize: 19 }} />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </>
                        )}

                        {!isMinimized && recentConversations.length > 1 && onSwitchConversation && (
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

                        <Tooltip title={isMinimized ? "Restore" : "Minimize"}>
                            <IconButton
                                size="small"
                                aria-label="Minimize chat window"
                                onClick={() => onMinimize?.(partnerId)}
                                sx={{ color: 'text.secondary', p: 0.5 }}
                            >
                                {isMinimized ? <AddIcon fontSize="small" /> : <RemoveIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Close">
                            <IconButton
                                size="small"
                                aria-label="Close chat window"
                                onClick={() => onClose?.(partnerId)}
                                sx={{ color: 'text.secondary', p: 0.5 }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* SWITCH CONVERSATION MENU */}
                {recentConversations.length > 1 && (
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
                            const p = getPartnerFromConv(c);
                            const pId = p._id || p.id;
                            const isSelected = partnerId === String(pId);
                            return (
                                <MenuItem
                                    key={pId || i}
                                    selected={isSelected}
                                    onClick={() => {
                                        onSwitchConversation?.({
                                            _id: pId,
                                            name: p.name || p.username || 'Player',
                                            avatarUrl: p.avatarUrl || p.profilePic || ''
                                        });
                                        setConversationsMenuAnchor(null);
                                    }}
                                >
                                    <ListItemAvatar sx={{ minWidth: 40 }}>
                                        <Avatar src={p.avatarUrl || p.profilePic} sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                            {p.name ? p.name.charAt(0) : 'U'}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={p.name || 'Player'}
                                        slotProps={{ primary: { sx: { fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500 } } }}
                                    />
                                </MenuItem>
                            );
                        })}
                    </Menu>
                )}

                {/* EXPANDED BODY & FOOTER */}
                {!isMinimized && (
                    <>
                        {/* MESSAGE STREAM */}
                        <Box
                            sx={{
                                flex: 1,
                                p: 1.5,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                bgcolor: 'background.default',
                                minHeight: 0
                            }}
                        >
                            {loadingMessages ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : !partnerId ? (
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
                                            onClick={() => onSelectCommunityMember?.(m)}
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
                                        Say hi to {partnerName}! 👋
                                    </Typography>
                                </Box>
                            ) : (
                                messages.map((m, idx) => {
                                    const senderId = idOf(m.sender);
                                    const isSelf = String(senderId) === String(currentUserId);
                                    const isThumbsUp = m.content === '👍' || m.content === '👍🏻' || m.content === '👍🏼';

                                    return (
                                        <Box
                                            key={m._id || m.id || idx}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                gap: 0.75,
                                                maxWidth: '85%',
                                                alignSelf: isSelf ? 'flex-end' : 'flex-start'
                                            }}
                                        >
                                            {!isSelf && (
                                                <Avatar
                                                    src={avatarUrl}
                                                    alt={partnerName}
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        fontSize: '0.65rem',
                                                        bgcolor: 'primary.main',
                                                        mb: 0.25,
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    {initial}
                                                </Avatar>
                                            )}
                                            <Tooltip
                                                title={m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                placement={isSelf ? 'left' : 'right'}
                                                arrow
                                            >
                                                {isThumbsUp ? (
                                                    <Box
                                                        sx={{
                                                            p: 0.5,
                                                            fontSize: '2rem',
                                                            lineHeight: 1,
                                                            userSelect: 'none',
                                                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
                                                        }}
                                                    >
                                                        👍
                                                    </Box>
                                                ) : (
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            px: 1.75,
                                                            py: 1,
                                                            borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                            bgcolor: isSelf
                                                                ? 'primary.main'
                                                                : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5',
                                                            color: isSelf ? '#ffffff' : 'text.primary',
                                                            fontSize: '0.88rem',
                                                            lineHeight: 1.4,
                                                            wordBreak: 'break-word',
                                                            boxShadow: isSelf ? '0 1px 4px rgba(0, 80, 40, 0.25)' : 'none'
                                                        }}
                                                    >
                                                        {m.content}
                                                    </Paper>
                                                )}
                                            </Tooltip>
                                        </Box>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* MESSAGE INPUT COMPOSER (Facebook Messenger style) */}
                        <Box
                            component="form"
                            onSubmit={handleSend}
                            sx={{
                                p: 1,
                                bgcolor: 'background.paper',
                                borderTop: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.75
                            }}
                        >
                            <Tooltip title="Attach photo or file">
                                <IconButton
                                    size="small"
                                    aria-label="Attach file"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!partnerId}
                                    sx={{
                                        color: 'primary.main',
                                        p: 0.5,
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <AddCircleOutlineRoundedIcon sx={{ fontSize: 22 }} />
                                </IconButton>
                            </Tooltip>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />

                            <TextField
                                inputRef={inputRef}
                                placeholder="Aa"
                                size="small"
                                fullWidth
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={!partnerId}
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'Type a message',
                                        style: { padding: '8px 14px' }
                                    }
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 6,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                                        fontSize: '0.9rem',
                                        '& fieldset': { border: 'none' },
                                        '&:hover fieldset': { border: 'none' },
                                        '&.Mui-focused fieldset': { border: 'none' },
                                        '& input': { outline: 'none !important', border: 'none !important' }
                                    }
                                }}
                            />

                            {inputMessage.trim() ? (
                                <IconButton
                                    type="submit"
                                    color="primary"
                                    aria-label="Send message"
                                    size="small"
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        bgcolor: 'primary.main',
                                        color: '#ffffff',
                                        flexShrink: 0,
                                        '&:hover': {
                                            bgcolor: 'primary.dark'
                                        }
                                    }}
                                >
                                    <SendIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            ) : (
                                <Tooltip title="Send a thumbs-up">
                                    <IconButton
                                        type="button"
                                        aria-label="Send a thumbs-up"
                                        onClick={handleSendQuickLike}
                                        disabled={!partnerId}
                                        size="small"
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            color: 'primary.main',
                                            flexShrink: 0,
                                            transition: 'transform 0.15s ease',
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                                transform: 'scale(1.2)'
                                            },
                                            '&:active': {
                                                transform: 'scale(0.95)'
                                            }
                                        }}
                                    >
                                        <ThumbUpIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    </>
                )}
            </Box>
        </Paper>
    );
}

FloatingChatPopup.propTypes = {
    chat: PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        username: PropTypes.string,
        avatarUrl: PropTypes.string,
        profilePic: PropTypes.string,
        isMinimized: PropTypes.bool
    }),
    partner: PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        username: PropTypes.string,
        avatarUrl: PropTypes.string,
        profilePic: PropTypes.string,
        isMinimized: PropTypes.bool
    }),
    index: PropTypes.number,
    isMobile: PropTypes.bool,
    isOnline: PropTypes.bool,
    messages: PropTypes.arrayOf(PropTypes.object),
    loadingMessages: PropTypes.bool,
    currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onSendMessage: PropTypes.func,
    onMinimize: PropTypes.func,
    onClose: PropTypes.func,
    communityMembers: PropTypes.arrayOf(PropTypes.object),
    onSelectCommunityMember: PropTypes.func,
    recentConversations: PropTypes.arrayOf(PropTypes.object),
    onSwitchConversation: PropTypes.func
};
