import { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress, Fade } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * ServerWarmup Component
 * 
 * Detects Render free-tier cold starts by pinging /api/status.
 * Shows a friendly loading screen instead of broken CORS/fetch errors
 * while the server spins back up (~30-60 seconds typically).
 */
export default function ServerWarmup({ children }) {
    const [serverReady, setServerReady] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [message, setMessage] = useState('Connecting to server...');

    const messages = [
        'Connecting to server...',
        'Waking up the server...',
        'Almost there, warming up the courts...',
        'Server is stretching, hang tight...',
        'Just a few more seconds...',
    ];

    useEffect(() => {
        let cancelled = false;
        let timeoutId;

        const pingServer = async () => {
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const normalizedApiUrl = API_URL.replace(/\/+$/, '');
                const res = await fetch(`${normalizedApiUrl}/api/status`, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (res.ok && !cancelled) {
                    setServerReady(true);
                    return;
                }
            } catch {
                // Server not ready yet
            }

            if (!cancelled) {
                setAttempt(prev => {
                    const next = prev + 1;
                    setMessage(messages[Math.min(next, messages.length - 1)]);
                    return next;
                });
                // Retry every 3 seconds
                timeoutId = setTimeout(pingServer, 3000);
            }
        };

        pingServer();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (serverReady) {
        return children;
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                gap: 3,
                px: 3,
                bgcolor: 'background.default',
            }}
        >
            <Fade in timeout={600}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                        Mason Badminton Connect
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        {message}
                    </Typography>
                    <LinearProgress
                        sx={{
                            width: 280,
                            mx: 'auto',
                            borderRadius: 2,
                            height: 6,
                        }}
                    />
                    {attempt > 3 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                            Free-tier servers take up to 60 seconds to wake up after inactivity.
                        </Typography>
                    )}
                </Box>
            </Fade>
        </Box>
    );
}
