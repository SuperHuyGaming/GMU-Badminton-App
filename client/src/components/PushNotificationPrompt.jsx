import { useState, useEffect } from 'react';
import { Snackbar, Button, Box, Typography, CircularProgress } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import apiFetch from '../utils/api';
import { urlB64ToUint8Array } from '../utils/pushUtils';

const PushNotificationPrompt = () => {
    const [open, setOpen] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    useEffect(() => {
        const isSupported =
            typeof window !== 'undefined' &&
            Boolean(navigator.serviceWorker) &&
            Boolean(window.PushManager) &&
            Boolean(window.Notification);

        if (isSupported) {
            if (Notification.permission === 'default' && !localStorage.getItem('hidePushPrompt')) {
                // Wait 3 seconds so new users aren't immediately bombarded upon page load
                const timer = setTimeout(() => {
                    setOpen(true);
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    // Check after hooks
    if (typeof window !== 'undefined' && localStorage.getItem('hidePushPrompt') === 'true') {
        return null;
    }

    const handleDismiss = () => {
        localStorage.setItem('hidePushPrompt', 'true');
        setOpen(false);
    };

    const handleEnable = async () => {
        setSubscribing(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                let vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                if (!vapidKey) {
                    try {
                        const keyData = await apiFetch('/api/push/vapid-public-key');
                        if (keyData?.publicKey) {
                            vapidKey = keyData.publicKey;
                        }
                    } catch (e) {
                        console.warn('[PushPrompt] Could not fetch public VAPID key:', e);
                    }
                }

                if (!vapidKey) {
                    console.warn('[PushPrompt] No VAPID public key available.');
                    setOpen(false);
                    setSubscribing(false);
                    return;
                }

                const registration = await navigator.serviceWorker.ready;
                const applicationServerKey = urlB64ToUint8Array(vapidKey);

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                await apiFetch('/api/push/subscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription)
                });

                localStorage.setItem('hidePushPrompt', 'true');
                setOpen(false);
            } else {
                localStorage.setItem('hidePushPrompt', 'true');
                setOpen(false);
            }
        } catch (error) {
            console.error('[PushPrompt] Failed to subscribe to push notifications:', error);
            setOpen(false);
        } finally {
            setSubscribing(false);
        }
    };

    return (
        <Snackbar
            data-testid="push-notification-prompt"
            open={open}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            onClose={handleDismiss}
            sx={{
                mb: { xs: 9, md: 3 },
                zIndex: 1200,
                maxWidth: { xs: 'calc(100vw - 32px)', sm: 460 },
                width: '100%'
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0))',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.32)',
                    backdropFilter: 'blur(16px)',
                    width: '100%',
                    boxSizing: 'border-box'
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        flexShrink: 0
                    }}
                >
                    <NotificationsActiveIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                        Stay in the match
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, lineHeight: 1.25 }}>
                        Get instant alerts for messages, court challenges, and tournament openings.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Button
                        data-testid="push-enable-btn"
                        variant="contained"
                        size="small"
                        color="primary"
                        disabled={subscribing}
                        onClick={handleEnable}
                        startIcon={subscribing ? <CircularProgress size={14} color="inherit" /> : null}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                            px: 1.75,
                            py: 0.5,
                            minWidth: 70
                        }}
                    >
                        {subscribing ? 'Saving' : 'Enable'}
                    </Button>
                    <Button
                        data-testid="push-dismiss-btn"
                        variant="text"
                        size="small"
                        color="inherit"
                        onClick={handleDismiss}
                        sx={{
                            textTransform: 'none',
                            color: 'text.secondary',
                            borderRadius: 2,
                            px: 1,
                            py: 0.5,
                            minWidth: 'auto'
                        }}
                    >
                        Not Now
                    </Button>
                </Box>
            </Box>
        </Snackbar>
    );
};

export default PushNotificationPrompt;
