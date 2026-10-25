import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { Box, Skeleton, Typography, Chip } from '@mui/material';

/**
 * LazyFlyerImage Component
 * - Viewport-aware lazy loading via native IntersectionObserver
 * - Shimmer skeleton placeholder while loading to prevent layout shifts (CLS = 0)
 * - Graceful fallback to branded collegiate banner on network error or missing src
 * - Supports "Sold Out" overlay badge
 */
export default function LazyFlyerImage({
    src,
    alt,
    height = 180,
    fallbackHost = 'DMV Badminton',
    isSoldOut = false,
    sx = {},
    rootMargin = '200px 0px'
}) {
    // In test/jsdom environments where IntersectionObserver is missing, start inView
    const [inView, setInView] = useState(() => (
        typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined'
    ));
    const [loaded, setLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [prevSrc, setPrevSrc] = useState(src);
    const containerRef = useRef(null);

    // Synchronize render state when src prop changes
    if (prevSrc !== src) {
        setPrevSrc(src);
        setLoaded(false);
        setImgError(false);
    }

    const hasError = !src || imgError;

    // Viewport Intersection Detection
    useEffect(() => {
        if (!src || typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
            return;
        }

        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry && entry.isIntersecting) {
                setInView(true);
                observer.unobserve(el);
            }
        }, { rootMargin });

        observer.observe(el);
        return () => {
            if (el) observer.unobserve(el);
            observer.disconnect();
        };
    }, [src, rootMargin]);

    const soldOutBadge = isSoldOut && (
        <Chip 
            label="Sold Out" 
            color="error" 
            size="small" 
            sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 700, zIndex: 2 }}
        />
    );

    // Render fallback banner if error or no source
    if (hasError) {
        return (
            <Box 
                ref={containerRef}
                data-testid="flyer-fallback-banner"
                sx={{ 
                    width: '100%', 
                    height: height, 
                    bgcolor: 'primary.dark', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    p: 2,
                    textAlign: 'center',
                    color: '#ffffff',
                    position: 'relative',
                    overflow: 'hidden',
                    ...sx
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, opacity: 0.9 }}>
                    🏸 {fallbackHost}
                </Typography>
                {soldOutBadge}
            </Box>
        );
    }

    return (
        <Box 
            ref={containerRef}
            data-testid="lazy-flyer-container"
            sx={{ 
                width: '100%', 
                height: height, 
                position: 'relative', 
                overflow: 'hidden', 
                bgcolor: 'action.hover',
                ...sx 
            }}
        >
            {/* Shimmer skeleton placeholder while loading or out of view */}
            {(!inView || !loaded) && (
                <Skeleton 
                    variant="rectangular" 
                    animation="wave" 
                    width="100%" 
                    height="100%" 
                    data-testid="flyer-skeleton"
                    sx={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
                />
            )}

            {/* Actual image mounted only once inView */}
            {inView && (
                <Box
                    component="img"
                    key={src}
                    src={src}
                    alt={alt || `${fallbackHost} flyer`}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    onError={() => setImgError(true)}
                    data-testid="lazy-flyer-img"
                    sx={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        display: 'block',
                        opacity: loaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                    }} 
                />
            )}

            {soldOutBadge}
        </Box>
    );
}

LazyFlyerImage.propTypes = {
    src: PropTypes.string,
    alt: PropTypes.string,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    fallbackHost: PropTypes.string,
    isSoldOut: PropTypes.bool,
    sx: PropTypes.object,
    rootMargin: PropTypes.string
};
