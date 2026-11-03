import { Box, Typography, Button, Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import ForumIcon from '@mui/icons-material/Forum';

const OutOfBoundsGraphic = () => (
    <Box
        sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            mx: 'auto',
            filter: 'drop-shadow(0 16px 32px rgba(0, 230, 118, 0.18))',
        }}
    >
        <svg viewBox="0 0 460 300" width="100%" style={{ overflow: 'visible', height: 'auto', display: 'block' }} role="img" aria-label="Shuttlecock landing out of bounds on a badminton court">
            <defs>
                {/* Luminous court surface gradient */}
                <linearGradient id="premiumCourtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#004d26" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#006633" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#023018" stopOpacity="0.95" />
                </linearGradient>

                {/* Cyber emerald glow for boundary lines */}
                <filter id="neonGlowEmerald" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00E676" floodOpacity="0.7" />
                    <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor="#00E676" floodOpacity="0.4" />
                </filter>

                {/* Vibrant Gold Glow */}
                <filter id="neonGlowGold" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFCC33" floodOpacity="0.8" />
                    <feDropShadow dx="0" dy="2" stdDeviation="10" floodColor="#FFA000" floodOpacity="0.5" />
                </filter>

                {/* Net Mesh Pattern */}
                <pattern id="netMesh" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 0 10 L 10 0 M 0 0 L 10 10" fill="none" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.45" />
                </pattern>

                {/* Radial ambient spotlight */}
                <radialGradient id="courtSpotlight" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00E676" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#004d26" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </radialGradient>

                {/* Shuttlecock trajectory gradient */}
                <linearGradient id="trailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFCC33" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#00E676" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#FF3B30" stopOpacity="0.9" />
                </linearGradient>
            </defs>

            {/* Ambient Spotlight */}
            <ellipse cx="230" cy="180" rx="210" ry="100" fill="url(#courtSpotlight)" />

            {/* Court Floor Perspective */}
            <polygon 
                points="60,240 180,140 380,140 340,240" 
                fill="url(#premiumCourtGrad)" 
                stroke="#00E676" 
                strokeWidth="2.5" 
                filter="url(#neonGlowEmerald)" 
                strokeLinejoin="round"
            />

            {/* Inner Court Singles/Doubles Guidelines */}
            <line x1="120" y1="190" x2="360" y2="190" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.75" />
            <line x1="230" y1="140" x2="200" y2="240" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.75" />
            <line x1="100" y1="205" x2="190" y2="140" stroke="#00E676" strokeWidth="1.5" strokeDasharray="5,4" strokeOpacity="0.8" />

            {/* Out-of-Bounds Tramline */}
            <line 
                x1="330" y1="130" 
                x2="410" y2="250" 
                stroke="#FF3B30" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeDasharray="8,6"
            />
            <text x="400" y="270" fill="#FF453A" fontSize="11" fontWeight="800" letterSpacing="1" fontFamily="sans-serif">
                OUT OF BOUNDS
            </text>

            {/* Badminton Net Center */}
            {/* Net Posts */}
            <line x1="270" y1="90" x2="270" y2="175" stroke="#E2E8F0" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="270" y1="90" x2="270" y2="94" stroke="#FFCC33" strokeWidth="6" strokeLinecap="round" />
            
            {/* Net Mesh Body */}
            <polygon 
                points="175,115 270,95 270,165 175,185" 
                fill="url(#netMesh)" 
                stroke="#FFFFFF" 
                strokeWidth="1.5" 
                strokeOpacity="0.8" 
            />
            {/* Top Net Tape (White High Contrast) */}
            <line x1="175" y1="115" x2="270" y2="95" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />

            {/* Dynamic Shuttlecock Trajectory Arc */}
            <path 
                d="M 120 70 Q 230 20 380 215" 
                fill="none" 
                stroke="url(#trailGrad)" 
                strokeWidth="3.5" 
                strokeDasharray="8,6" 
                strokeLinecap="round"
            />

            {/* Glowing Motion Sparks */}
            <circle cx="170" cy="46" r="3" fill="#FFCC33" filter="url(#neonGlowGold)" />
            <circle cx="230" cy="42" r="4" fill="#00E676" filter="url(#neonGlowEmerald)" />
            <circle cx="295" cy="72" r="3.5" fill="#FFCC33" filter="url(#neonGlowGold)" />
            <circle cx="345" cy="135" r="4.5" fill="#FF453A" />

            {/* Landed Shuttlecock (High Contrast, Out of Bounds) */}
            <g transform="translate(382, 218) rotate(42)" filter="url(#neonGlowGold)">
                {/* Feathers Fan */}
                <path 
                    d="M-14,-32 L14,-32 L9,0 L-9,0 Z" 
                    fill="#FFFFFF" 
                    stroke="#CBD5E1" 
                    strokeWidth="1.5" 
                />
                {/* Feather Ribs Detail */}
                <line x1="-10" y1="-30" x2="-6" y2="-4" stroke="#94A3B8" strokeWidth="1" />
                <line x1="0" y1="-31" x2="0" y2="-4" stroke="#94A3B8" strokeWidth="1" />
                <line x1="10" y1="-30" x2="6" y2="-4" stroke="#94A3B8" strokeWidth="1" />
                <path d="M-12,-20 Q0,-16 12,-20" fill="none" stroke="#64748B" strokeWidth="1" />
                <path d="M-10,-10 Q0,-7 10,-10" fill="none" stroke="#64748B" strokeWidth="1" />
                
                {/* Red Cork Tape */}
                <rect x="-8" y="0" width="16" height="4.5" fill="#DC2626" rx="1.5" />
                
                {/* Cork Head */}
                <ellipse cx="0" cy="10" rx="8" ry="7.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1.5" />
            </g>

            {/* Impact Ripple Rings */}
            <ellipse cx="388" cy="235" rx="22" ry="9" fill="none" stroke="#FF453A" strokeWidth="2.5" strokeOpacity="0.8" />
            <ellipse cx="388" cy="235" rx="34" ry="14" fill="none" stroke="#FFCC33" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="5,3" />
        </svg>
    </Box>
);

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <Box 
            sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '75vh', 
                textAlign: 'center', 
                px: { xs: 2.5, sm: 4 },
                py: { xs: 4, sm: 6 }
            }}
        >
            <Chip 
                label="FAULT • 404 NOT FOUND" 
                color="error" 
                variant="outlined"
                size="small"
                sx={{ 
                    mb: 2, 
                    fontWeight: 800, 
                    letterSpacing: 1.2,
                    fontSize: '0.75rem',
                    borderColor: 'error.main',
                    bgcolor: 'rgba(239, 83, 80, 0.1)'
                }} 
            />

            <OutOfBoundsGraphic />

            <Typography 
                variant="h1" 
                fontWeight="900" 
                sx={{ 
                    mt: 2, 
                    mb: 1, 
                    fontSize: { xs: '3.75rem', sm: '5rem', md: '6rem' },
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    background: 'linear-gradient(135deg, #FFFFFF 20%, #80e27e 70%, #FFCC33 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 4px 20px rgba(0, 230, 118, 0.2)'
                }}
            >
                404
            </Typography>

            <Typography 
                variant="h4" 
                component="h2"
                fontWeight="800" 
                sx={{ 
                    mb: 1.5, 
                    color: 'text.primary',
                    fontSize: { xs: '1.4rem', sm: '1.85rem' }
                }}
            >
                Shuttlecock Out of Bounds!
            </Typography>

            <Typography 
                variant="body1" 
                sx={{ 
                    mb: 4, 
                    color: 'text.secondary', 
                    maxWidth: 480, 
                    fontSize: { xs: '0.95rem', sm: '1.05rem' },
                    lineHeight: 1.6 
                }}
            >
                It looks like the shot landed outside the court lines. The page you are looking for has been moved, removed, or never existed on our courts.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <Button 
                    variant="contained" 
                    size="large" 
                    onClick={() => navigate('/')} 
                    startIcon={<SportsTennisIcon />}
                    sx={{ 
                        borderRadius: 3, 
                        px: 4, 
                        py: 1.5, 
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        boxShadow: '0 8px 24px rgba(0, 102, 51, 0.35)',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 12px 28px rgba(0, 102, 51, 0.45)'
                        }
                    }}
                >
                    Return to Court
                </Button>

                <Button 
                    variant="outlined" 
                    size="large" 
                    onClick={() => navigate('/community')} 
                    startIcon={<ForumIcon />}
                    sx={{ 
                        borderRadius: 3, 
                        px: 3.5, 
                        py: 1.5, 
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        borderColor: 'divider',
                        color: 'text.primary',
                        bgcolor: 'action.hover',
                        '&:hover': {
                            bgcolor: 'action.selected',
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)'
                        }
                    }}
                >
                    Community Feed
                </Button>
            </Stack>
        </Box>
    );
}
