import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Popover,
  Box,
  Typography,
  Avatar,
  Chip,
  Button,
  Divider,
  Badge,
  CircularProgress,
} from '@mui/material';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import apiFetch from '../utils/api';
import FriendActionButton from './FriendActionButton';

// Client-side cache to guarantee instant (0ms) re-render without memory bloat
const memberCardCache = new Map();

export default function MemberHoverCard({
  userId,
  user: initialUser = null,
  children,
  disabled = false,
  placement = 'bottom',
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [userData, setUserData] = useState(() => {
    if (userId && memberCardCache.has(String(userId))) {
      return memberCardCache.get(String(userId));
    }
    return initialUser;
  });
  const [isLoading, setIsLoading] = useState(false);

  const hoverTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialUser && !memberCardCache.has(String(userId))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserData((prev) => ({ ...initialUser, ...prev }));
    }
  }, [initialUser, userId]);

  const fetchMemberCard = useCallback(async () => {
    if (!userId || memberCardCache.has(String(userId))) {
      if (userId && memberCardCache.has(String(userId))) {
        setUserData(memberCardCache.get(String(userId)));
      }
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/forum/members/${userId}/card`);
      if (res && res.ok) {
        const data = await res.json();
        if (data?.user && isMountedRef.current) {
          memberCardCache.set(String(userId), data.user);
          setUserData(data.user);
        }
      }
    } catch {
      // Silently fall back to initial user data on fetch error
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  const handleOpen = (event) => {
    if (disabled || !userId) return;
    const currentTarget = event.currentTarget;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    hoverTimerRef.current = setTimeout(() => {
      setAnchorEl(currentTarget);
      fetchMemberCard();
    }, 280);
  };

  const handleClose = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    leaveTimerRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 200);
  };

  const handlePopoverMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 200);
  };

  const handleOpenChat = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
    if (userData || userId) {
      const chatTarget = userData || { _id: userId, name: 'Club Member' };
      window.dispatchEvent(
        new CustomEvent('openChatWithUser', { detail: chatTarget })
      );
    }
  };

  const handleChallenge = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
    const eventDetail = userData || { _id: userId, name: 'Club Member' };
    window.dispatchEvent(
      new CustomEvent('challengeUser', { detail: eventDetail })
    );
  };

  const isOpen = Boolean(anchorEl);
  const isOnline = Boolean(userData?.isOnline || userData?.online);
  const displayName = userData?.name || 'Club Member';
  const roleLabel = userData?.role === 'admin' ? 'Club Exec' : (userData?.role || 'Member');
  const skillLabel = userData?.skillLevel || 'Intermediate';
  const singlesElo = userData?.singlesElo || 1200;
  const doublesElo = userData?.doublesElo || 1200;
  const bio = userData?.bio || 'Ready to play!';
  const courtCheckIn = userData?.currentCourtCheckIn;

  return (
    <>
      <Box
        component="span"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        sx={{ display: 'inline-flex', verticalAlign: 'middle', cursor: 'pointer' }}
        data-testid="member-hover-card-trigger"
      >
        {children}
      </Box>

      <Popover
        id={isOpen ? `member-hover-popover-${userId}` : undefined}
        open={isOpen}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: placement === 'top' ? 'top' : 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: placement === 'top' ? 'bottom' : 'top',
          horizontal: 'center',
        }}
        onClose={() => setAnchorEl(null)}
        disableRestoreFocus
        disableAutoFocus
        disableEnforceFocus
        slotProps={{
          paper: {
            onMouseEnter: handlePopoverMouseEnter,
            onMouseLeave: handlePopoverMouseLeave,
            sx: {
              p: 2.25,
              width: 310,
              maxWidth: '90vw',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
              bgcolor: 'background.paper',
              mt: placement === 'top' ? 0 : 1,
              mb: placement === 'top' ? 1 : 0,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          },
        }}
      >
        <Box data-testid="member-hover-card-popover">
          {isLoading && !userData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box>
            {/* Header: Avatar, Name, Presence & Role */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                color={isOnline ? 'success' : 'default'}
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: isOnline ? '#44b700' : 'text.disabled',
                    boxShadow: '0 0 0 2px #fff',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                  },
                }}
              >
                <Avatar
                  src={userData?.profilePic}
                  alt={displayName}
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
              </Badge>

              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  noWrap
                  sx={{ lineHeight: 1.25, fontSize: '0.98rem' }}
                >
                  {displayName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                  <Chip
                    label={skillLabel}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                  />
                  <Chip
                    label={roleLabel}
                    size="small"
                    sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'action.hover' }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Bio */}
            {bio && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: '0.82rem',
                  mb: 1.5,
                  lineHeight: 1.4,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{bio}&rdquo;
              </Typography>
            )}

            {/* Active Physical Court Status if Checked In */}
            {courtCheckIn?.courtNumber && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mb: 1.5,
                  p: 0.75,
                  borderRadius: 2,
                  bgcolor: 'success.light',
                  color: 'success.contrastText',
                }}
              >
                <LocationOnIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight="bold">
                  Checked in at RAC Court {courtCheckIn.courtNumber}
                </Typography>
              </Box>
            )}

            {/* Quick Stats: Elo & Win Streak */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                p: 1.25,
                borderRadius: 2,
                bgcolor: 'action.hover',
                mb: 1.75,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  Singles Elo
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {singlesElo}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                  Doubles Elo
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {doublesElo}
                </Typography>
              </Box>
              {userData?.stats?.winStreak !== undefined && userData.stats.winStreak > 0 && (
                <Box sx={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <WhatshotIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="caption" fontWeight="bold" color="error.main">
                    {userData.stats.winStreak} Match Win Streak!
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 1.5 }} />

            {/* Actions: FriendActionButton + Message + Challenge */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {userData?.friendshipStatus !== 'self' && (
                <FriendActionButton
                  targetUserId={userId}
                  targetUserName={displayName}
                  initialStatus={userData?.friendshipStatus || 'none'}
                  fullWidth
                  size="small"
                />
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  startIcon={<ChatBubbleOutlinedIcon sx={{ fontSize: 16 }} />}
                  onClick={handleOpenChat}
                  aria-label={`Message ${displayName}`}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                  }}
                >
                  Message
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  fullWidth
                  startIcon={<SportsScoreIcon sx={{ fontSize: 16 }} />}
                  onClick={handleChallenge}
                  aria-label={`Challenge ${displayName}`}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                  }}
                >
                  Challenge
                </Button>
              </Box>
            </Box>
          </Box>
        )}
        </Box>
      </Popover>
    </>
  );
}

MemberHoverCard.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  user: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    profilePic: PropTypes.string,
    role: PropTypes.string,
    skillLevel: PropTypes.string,
    bio: PropTypes.string,
    isOnline: PropTypes.bool,
    online: PropTypes.bool,
    singlesElo: PropTypes.number,
    doublesElo: PropTypes.number,
    friendshipStatus: PropTypes.string,
    currentCourtCheckIn: PropTypes.shape({
      courtNumber: PropTypes.number,
    }),
    stats: PropTypes.shape({
      winStreak: PropTypes.number,
      winRate: PropTypes.number,
      totalMatches: PropTypes.number,
    }),
  }),
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  placement: PropTypes.oneOf(['top', 'bottom']),
};
