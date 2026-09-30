import { useState, useContext } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { toast } from 'react-hot-toast';
import apiFetch from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function FriendActionButton({
  targetUserId,
  targetUserName = 'player',
  initialStatus = 'none',
  currentUserId,
  onStatusChange,
  fullWidth = false,
  size = 'medium',
  variant,
  sx = {},
  disabled = false,
}) {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  const normalizeStatus = (s) => {
    if (!s) return 'none';
    if (s === 'request_sent') return 'pending';
    return s;
  };

  const [prevInitialStatus, setPrevInitialStatus] = useState(initialStatus);
  const [status, setStatus] = useState(() => normalizeStatus(initialStatus));
  const [isLoading, setIsLoading] = useState(false);

  if (initialStatus !== prevInitialStatus) {
    setPrevInitialStatus(initialStatus);
    setStatus(normalizeStatus(initialStatus));
  }

  const effectiveCurrentUserId = currentUserId || user?.id || user?._id;
  if (
    effectiveCurrentUserId &&
    targetUserId &&
    String(effectiveCurrentUserId) === String(targetUserId)
  ) {
    return null;
  }

  const handleAction = async (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (isLoading || disabled) return;

    const prevStatus = status;

    if (status === 'none') {
      // Optimistic transition to pending
      setStatus('pending');
      setIsLoading(true);
      if (onStatusChange) onStatusChange('pending', targetUserId);

      try {
        const res = await apiFetch('/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId: targetUserId,
            friendId: targetUserId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to send friend request');
        }

        toast.success(`Friend request sent to ${targetUserName}!`);
      } catch (err) {
        // Rollback on failure
        setStatus(prevStatus);
        if (onStatusChange) onStatusChange(prevStatus, targetUserId);
        toast.error(err.message || 'Failed to send friend request');
      } finally {
        setIsLoading(false);
      }
    } else if (status === 'request_received') {
      // Optimistic transition to friends
      setStatus('friends');
      setIsLoading(true);
      if (onStatusChange) onStatusChange('friends', targetUserId);

      try {
        const res = await apiFetch('/api/friends/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: targetUserId,
            friendId: targetUserId,
            userId: effectiveCurrentUserId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to accept friend request');
        }

        toast.success(`You and ${targetUserName} are now friends!`);
      } catch (err) {
        // Rollback on failure
        setStatus(prevStatus);
        if (onStatusChange) onStatusChange(prevStatus, targetUserId);
        toast.error(err.message || 'Failed to accept friend request');
      } finally {
        setIsLoading(false);
      }
    }
  };

  let label = 'Add Friend';
  let buttonVariant = variant || 'contained';
  let buttonColor = 'primary';
  let buttonIcon = <PersonAddIcon />;
  let isDisabled = disabled || isLoading;

  if (status === 'pending') {
    label = 'Request Sent';
    buttonVariant = variant || 'contained';
    buttonColor = 'inherit';
    buttonIcon = <CheckIcon />;
    isDisabled = true;
  } else if (status === 'friends') {
    label = 'Friends';
    buttonVariant = variant || 'outlined';
    buttonColor = 'success';
    buttonIcon = <HowToRegIcon />;
    isDisabled = true;
  } else if (status === 'request_received') {
    label = 'Accept Request';
    buttonVariant = variant || 'contained';
    buttonColor = 'primary';
    buttonIcon = <PersonAddIcon />;
    isDisabled = disabled || isLoading;
  }

  return (
    <Button
      variant={buttonVariant}
      color={buttonColor}
      disabled={isDisabled}
      fullWidth={fullWidth}
      size={size}
      onClick={handleAction}
      startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : buttonIcon}
      aria-label={`${label} for ${targetUserName}`}
      sx={{
        borderRadius: 2,
        fontWeight: 'bold',
        textTransform: 'none',
        transition: 'all 0.2s ease-in-out',
        ...(status === 'pending' && {
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.08)',
          color: 'text.secondary',
        }),
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}
