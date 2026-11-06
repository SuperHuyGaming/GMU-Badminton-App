import PropTypes from 'prop-types';
import { useState } from 'react';
import { Box, Avatar, Badge, Tooltip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { motion } from 'framer-motion';

export default function FloatingChatBubble({
    bubble,
    isOnline = false,
    onClick,
    onOpen,
    onDismiss
}) {
    const [isHovered, setIsHovered] = useState(false);

    if (!bubble) return null;

    const bubbleId = String(bubble._id || bubble.id || '');
    const bubbleName = bubble.name || bubble.username || 'Badminton Player';
    const avatarUrl = bubble.avatarUrl || bubble.profilePic || '';
    const initial = bubbleName ? bubbleName.charAt(0).toUpperCase() : 'P';
    const unreadCount = Number(bubble.unreadCount) || 0;
    const handleOpen = onClick || onOpen;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            style={{ position: 'relative' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Tooltip title={bubbleName} placement="left">
                <Box
                    data-testid={`floating-chat-bubble-${bubbleId}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Chat with ${bubbleName}`}
                    onClick={() => handleOpen?.(bubbleId)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpen?.(bubbleId);
                        }
                    }}
                    sx={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '50%',
                        outline: 'none',
                        '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: 2
                        }
                    }}
                >
                    <Badge
                        badgeContent={unreadCount}
                        max={9}
                        color="error"
                        overlap="circular"
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        sx={{
                            '& .MuiBadge-badge': {
                                pointerEvents: 'none',
                                fontWeight: 'bold',
                                fontSize: '0.72rem'
                            }
                        }}
                    >
                        <Badge
                            color="success"
                            variant="dot"
                            invisible={!isOnline}
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        >
                            <Avatar
                                src={avatarUrl}
                                alt={bubbleName}
                                sx={{
                                    width: 48,
                                    height: 48,
                                    bgcolor: 'primary.main',
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    border: '2px solid',
                                    borderColor: isOnline ? '#80e27e' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'divider',
                                    boxShadow: 4,
                                    transition: 'border-color 0.2s ease, transform 0.2s ease'
                                }}
                            >
                                {initial}
                            </Avatar>
                        </Badge>
                    </Badge>
                </Box>
            </Tooltip>

            {/* Dismiss 'x' button */}
            <Tooltip title="Dismiss">
                <IconButton
                    data-testid={`dismiss-chat-bubble-${bubbleId}`}
                    aria-label={`Dismiss chat head with ${bubbleName}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss?.(bubbleId);
                    }}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        width: 20,
                        height: 20,
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: 2,
                        opacity: isHovered ? 1 : 0.85,
                        transition: 'opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease',
                        zIndex: 2,
                        '&:hover': {
                            bgcolor: 'error.main',
                            color: '#ffffff',
                            borderColor: 'error.main'
                        }
                    }}
                >
                    <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
            </Tooltip>
        </motion.div>
    );
}

FloatingChatBubble.propTypes = {
    bubble: PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        username: PropTypes.string,
        avatarUrl: PropTypes.string,
        profilePic: PropTypes.string,
        unreadCount: PropTypes.number
    }).isRequired,
    isOnline: PropTypes.bool,
    onClick: PropTypes.func,
    onOpen: PropTypes.func,
    onDismiss: PropTypes.func.isRequired
};
