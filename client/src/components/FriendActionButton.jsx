import { useState, useContext } from 'react';
import { Button } from '@mui/material';
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
    if (disabled || status === 'pending' || status === 'friends') return;

    const prevStatus = status;

    if (status === 'none') {
      // Optimistic transition to pending
      setStatus('pending');
      if (onStatusChange) onStatusChange('pending', targetUserId);

      try {
        await apiFetch('/api/friends/request', {
          keepalive: true,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId: targetUserId,
            friendId: targetUserId,
          }),
        });

        toast.success(`Friend request sent to ${targetUserName}!`);
      } catch (err) {
        // Rollback on failure
        setStatus(prevStatus);
        if (onStatusChange) onStatusChange(prevStatus, targetUserId);
        
        // Don't show toast if it's already sent, just keep the status as pending
        if (err.message === 'Request already sent') {
           setStatus('pending');
           if (onStatusChange) onStatusChange('pending', targetUserId);
        } else {
           toast.error(err.message || 'Failed to send friend request');
        }
      }
    } else if (status === 'request_received') {
      // Optimistic transition to friends
      setStatus('friends');
      if (onStatusChange) onStatusChange('friends', targetUserId);

      try {
        await apiFetch('/api/friends/accept', {
          keepalive: true,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterId: targetUserId,
            friendId: targetUserId,
            userId: effectiveCurrentUserId,
          }),
        });

        toast.success(`You and ${targetUserName} are now friends!`);
      } catch (err) {
        // Rollback on failure
        setStatus(prevStatus);
        if (onStatusChange) onStatusChange(prevStatus, targetUserId);
        toast.error(err.message || 'Failed to accept friend request');
      }
    } else if (status === 'pending') {
      // Optimistic transition to none (Undo)
      setStatus('none');
      if (onStatusChange) onStatusChange('none', targetUserId);

      try {
        await apiFetch('/api/friends/cancel', {
          keepalive: true,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId: targetUserId,
          }),
        });

        toast.success(`Friend request to ${targetUserName} cancelled.`);
      } catch (err) {
        // Rollback on failure
        setStatus(prevStatus);
        if (onStatusChange) onStatusChange(prevStatus, targetUserId);
        toast.error(err.message || 'Failed to cancel friend request');
      }
    }
  };

  let label = 'Add Friend';
  let buttonVariant = variant || 'contained';
  let buttonColor = 'primary';
  let buttonIcon = <PersonAddIcon />;
  let isDisabled = disabled;
    if (status === 'pending') isDisabled = true;

  if (status === 'pending') {
    label = 'Request Sent';
    buttonVariant = variant || 'outlined';
    buttonColor = 'inherit';
    buttonIcon = <CheckIcon />;
    isDisabled = disabled;
    if (status === 'pending') isDisabled = true;
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
    isDisabled = disabled;
    if (status === 'pending') isDisabled = true;
  }

  return (
    <Button
      variant={buttonVariant}
      color={buttonColor}
      disabled={isDisabled}
      fullWidth={fullWidth}
      size={size}
      onClick={handleAction}
      startIcon={buttonIcon}
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
