import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Box, Typography, IconButton, Skeleton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useInView } from 'react-intersection-observer';

// Lazy load the 3D portion to save initial bundle space
const RacketScene3D = lazy(() => import('./RacketScene3D'));

function isWebGLAvailable() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

export default function RacketViewer({ primaryColor = '#006633', secondaryColor = '#FFCC33' }) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [resetTrigger, setResetTrigger] = useState(0);
    const [webGLSupported, setWebGLSupported] = useState(true);
    const [isTabVisible, setIsTabVisible] = useState(true);
    
    // Throttling via viewport visibility
    const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: false });

    useEffect(() => {
        setWebGLSupported(isWebGLAvailable());
        
        const handleVisibilityChange = () => {
            setIsTabVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const togglePlay = () => setIsPlaying(!isPlaying);
    const handleReset = () => setResetTrigger(prev => prev + 1);

    const activePlay = isPlaying && inView && isTabVisible;

    if (!webGLSupported) {
        return (
            <Box sx={{ width: '100%', height: 260, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill={primaryColor} xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.69 2 6 5.58 6 10C6 13.9 8.13 17.11 11 17.89V20H10V22H14V20H13V17.89C15.87 17.11 18 13.9 18 10C18 5.58 15.31 2 12 2ZM12 16C9.24 16 7 12.87 7 10C7 7.13 9.24 4 12 4C14.76 4 17 7.13 17 10C17 12.87 14.76 16 12 16Z" />
                </svg>
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>3D Viewer Unavailable</Typography>
            </Box>
        );
    }

    return (
        <Box ref={ref} sx={{ width: '100%', height: 260, borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: 12, left: 16, zIndex: 10, fontWeight: 'bold', color: 'text.secondary' }}>
                INTERACTIVE 3D VIEWER
            </Typography>
            
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 1 }}>
                <IconButton size="small" onClick={togglePlay} sx={{ bgcolor: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                    {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={handleReset} sx={{ bgcolor: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                    <RestartAltIcon fontSize="small" />
                </IconButton>
            </Box>

            {inView ? (
                <Suspense fallback={<Skeleton variant="rectangular" width="100%" height={260} sx={{ borderRadius: 3 }} />}>
                    <RacketScene3D 
                        isPlaying={activePlay} 
                        resetTrigger={resetTrigger} 
                        primaryColor={primaryColor} 
                        secondaryColor={secondaryColor} 
                    />
                </Suspense>
            ) : (
                <Skeleton variant="rectangular" width="100%" height={260} sx={{ borderRadius: 3 }} />
            )}
        </Box>
    );
}
