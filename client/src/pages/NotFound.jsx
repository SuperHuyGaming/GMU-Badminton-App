import { Box, Typography, Button, Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import ForumIcon from '@mui/icons-material/Forum';

const OutOfBoundsGraphic = () => (
    <Box
        sx={{
            position: 'relative',
            width: '100%',
            maxWidth: { xs: 360, sm: 520, md: 640 },
            mx: 'auto',
            mb: { xs: 1, sm: 2 },
            filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.45)) drop-shadow(0 8px 24px rgba(0, 230, 118, 0.15))',
        }}
    >
        <svg 
            viewBox="0 0 800 500" 
            width="100%" 
            style={{ overflow: 'visible', height: 'auto', display: 'block' }} 
            role="img" 
            aria-label="Isometric badminton court showing a shuttlecock landing out of bounds"
        >
            <defs>
                {/* Court Mat Surface Gradient */}
                <linearGradient id="courtSurfaceGrad" x1="25%" y1="10%" x2="75%" y2="90%">
                    <stop offset="0%" stopColor="#004724" />
                    <stop offset="45%" stopColor="#006a37" />
                    <stop offset="70%" stopColor="#00572d" />
                    <stop offset="100%" stopColor="#00331a" />
                </linearGradient>

                {/* 3D Slab Front-Right (Near Baseline) */}
                <linearGradient id="slabRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#002b15" />
                    <stop offset="100%" stopColor="#001a0c" />
                </linearGradient>

                {/* 3D Slab Front-Left (Near Sideline) */}
                <linearGradient id="slabLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00180a" />
                    <stop offset="100%" stopColor="#000c05" />
                </linearGradient>

                {/* Overhead Stadium Spotlight (Warm Golden & Emerald Sheen) */}
                <radialGradient id="stadiumSpotlight" cx="50%" cy="42%" r="52%">
                    <stop offset="0%" stopColor="#5eead4" stopOpacity="0.22" />
                    <stop offset="25%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="65%" stopColor="#047857" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#02120a" stopOpacity="0" />
                </radialGradient>

                {/* Warm Golden Keylight */}
                <linearGradient id="warmOverheadGlow" x1="40%" y1="0%" x2="60%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="0.10" />
                    <stop offset="40%" stopColor="#10b981" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#02120a" stopOpacity="0" />
                </linearGradient>

                {/* 3D Drop Shadow for the Court Slab */}
                <filter id="courtDropShadow" x="-15%" y="-15%" width="130%" height="140%">
                    <feDropShadow dx="0" dy="18" stdDeviation="24" floodColor="#000000" floodOpacity="0.65" />
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#00381b" floodOpacity="0.35" />
                </filter>

                {/* Net Mesh Pattern */}
                <pattern id="badmintonNetMesh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
                    <path d="M 0 3 L 6 3 M 3 0 L 3 6" fill="none" stroke="#e2e8f0" strokeWidth="0.65" strokeOpacity="0.40" />
                </pattern>

                {/* Net Post Metallic Gradient (Post 1 - Far) */}
                <linearGradient id="postGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="50%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                {/* Net Post Metallic Gradient (Post 2 - Near Foreground) */}
                <linearGradient id="postGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="40%" stopColor="#94a3b8" />
                    <stop offset="75%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>

                {/* Net Headband Tape Gradient */}
                <linearGradient id="netTapeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#f1f5f9" />
                    <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>

                {/* Trajectory Flight Arc Gradient */}
                <linearGradient id="trajectoryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#facc15" stopOpacity="0.2" />
                    <stop offset="40%" stopColor="#facc15" stopOpacity="0.85" />
                    <stop offset="75%" stopColor="#fb923c" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                </linearGradient>

                {/* Shuttlecock Drop Shadow Blur */}
                <filter id="shuttleContactShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" />
                </filter>

                {/* Hawk-Eye Out Glow */}
                <filter id="hawkEyeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.75" />
                </filter>

                {/* Cork Leather Gradient */}
                <radialGradient id="corkGrad" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#fef08a" />
                    <stop offset="70%" stopColor="#facc15" />
                    <stop offset="90%" stopColor="#ca8a04" />
                    <stop offset="100%" stopColor="#854d0e" />
                </radialGradient>

                {/* Cork Collar Tape Gradient */}
                <linearGradient id="corkTapeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#b91c1c" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                </linearGradient>

                {/* Feather Surface Gradient */}
                <linearGradient id="featherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="70%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>

                {/* Feather Shadow Gradient */}
                <linearGradient id="featherDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
            </defs>

            {/* AMBIENT STADIUM ILLUMINATION */}
            <ellipse cx="400" cy="245" rx="350" ry="190" fill="url(#stadiumSpotlight)" />
            <ellipse cx="400" cy="225" rx="280" ry="150" fill="url(#warmOverheadGlow)" />

            {/* 3D COURT SLAB BASE (Mat Foundation) */}
            <g filter="url(#courtDropShadow)">
                {/* 3D Slab Front-Right (Near Baseline Edge) */}
                <polygon points="688.8,287 490,401.7 490,417.7 688.8,303" fill="url(#slabRightGrad)" />

                {/* 3D Slab Front-Left (Near Sideline Edge) */}
                <polygon points="490,401.7 111.2,183 111.2,199 490,417.7" fill="url(#slabLeftGrad)" />

                {/* Subtle Edge Bevel Highlight on Slab Rim */}
                <polyline points="111.2,183 490,401.7 688.8,287" fill="none" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.4" />

                {/* COURT MAT TOP SURFACE (Green PVC Tournament Mat) */}
                <polygon points="310,68.3 688.8,287 490,401.7 111.2,183" fill="url(#courtSurfaceGrad)" />
            </g>

            {/* COURT MAT SUBTLE INNER BORDER RUN-OFF SHEEN */}
            <polygon points="325,83 661,277 485,380 148,187" fill="none" stroke="#059669" strokeWidth="0.8" strokeOpacity="0.2" />

            {/* OFFICIAL BWF COURT WHITE LINES */}
            <g stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.95">
                {/* Doubles Outer Boundary Rectangle */}
                <polygon points="314.7,103.4 628,284.3 485.3,366.6 172,185.7" fill="none" stroke="#ffffff" strokeWidth="2.4" />

                {/* Singles Sidelines (Tramlines) */}
                <line x1="303.9" y1="109.6" x2="617.2" y2="290.5" strokeWidth="1.8" />
                <line x1="182.8" y1="179.5" x2="496.1" y2="360.4" strokeWidth="1.8" />

                {/* Doubles Long Service Lines (Back Tramlines) */}
                <line x1="332.4" y1="113.6" x2="189.8" y2="196" strokeWidth="1.8" />
                <line x1="610.2" y1="274" x2="467.6" y2="356.4" strokeWidth="1.8" />

                {/* Short Service Lines */}
                <line x1="425" y1="167.1" x2="282.4" y2="249.4" strokeWidth="2.0" />
                <line x1="517.6" y1="220.6" x2="375" y2="302.9" strokeWidth="2.0" />

                {/* Center Service Lines */}
                <line x1="243.3" y1="144.6" x2="353.7" y2="208.3" strokeWidth="1.8" />
                <line x1="446.3" y1="261.7" x2="556.7" y2="325.5" strokeWidth="1.8" />

                {/* Net Center Line on Floor */}
                <line x1="471.3" y1="193.8" x2="328.7" y2="276.2" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.6" />
            </g>

            {/* COURT MAT AMBIENT FLOOR SHINE */}
            <polygon points="370,180 500,250 430,290 300,220" fill="#ffffff" fillOpacity="0.035" />

            {/* BADMINTON NET AND POSTS */}
            {/* Post 1 (Far Side, x = 0, y = -3.05) */}
            <g>
                <ellipse cx="471.3" cy="193.8" rx="4.5" ry="2.5" fill="#0f172a" stroke="#64748b" strokeWidth="0.8" />
                <line x1="471.3" y1="193.8" x2="471.3" y2="131.1" stroke="url(#postGrad1)" strokeWidth="4.5" strokeLinecap="round" />
                <ellipse cx="471.3" cy="131.1" rx="2.5" ry="1.5" fill="#f59e0b" />
            </g>

            {/* Net Mesh Suspended Body */}
            <g>
                {/* Woven Mesh Body with Diamond Pattern */}
                <path d="M 471.3 131.1 Q 400 173.8 328.7 213.4 L 328.7 244.2 Q 400 204.4 471.3 161.8 Z" fill="url(#badmintonNetMesh)" />
                <path d="M 471.3 131.1 Q 400 173.8 328.7 213.4 L 328.7 244.2 Q 400 204.4 471.3 161.8 Z" fill="#092416" fillOpacity="0.55" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="0.5" />

                {/* Bottom Net Hem Line (Dark Boundary Cord) */}
                <path d="M 471.3 161.8 Q 400 204.4 328.7 244.2" fill="none" stroke="#1e293b" strokeWidth="1.8" strokeOpacity="0.8" />

                {/* Top Net Tape (White Tournament Headband 75mm) */}
                <path d="M 471.3 131.1 Q 400 173.8 328.7 213.4" fill="none" stroke="url(#netTapeGrad)" strokeWidth="4.2" strokeLinecap="round" />
                <path d="M 471.3 131.1 Q 400 173.8 328.7 213.4" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.9" />
            </g>

            {/* Post 2 (Near Foreground, x = 0, y = 3.05) */}
            <g>
                <ellipse cx="328.7" cy="276.2" rx="5.5" ry="3.0" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.0" />
                <ellipse cx="328.7" cy="275.5" rx="3.5" ry="2.0" fill="#334155" />
                <line x1="328.7" y1="276.2" x2="328.7" y2="213.4" stroke="url(#postGrad2)" strokeWidth="5.0" strokeLinecap="round" />
                <circle cx="326" cy="222" r="2.2" fill="#f59e0b" stroke="#78350f" strokeWidth="0.6" />
                <ellipse cx="328.7" cy="213.4" rx="3.0" ry="1.8" fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.8" />
            </g>

            {/* DYNAMIC FLIGHT TRAJECTORY ARC */}
            <g>
                <path d="M 294.8 117.4 Q 355 95 440.9 357.2" fill="none" stroke="url(#trajectoryGrad)" strokeWidth="3.0" strokeDasharray="7,5" strokeLinecap="round" />
                <circle cx="318" cy="108" r="2.5" fill="#fef08a" opacity="0.6" />
                <circle cx="362" cy="138" r="3.0" fill="#facc15" opacity="0.8" />
                <circle cx="395" cy="215" r="3.5" fill="#fb923c" opacity="0.9" />
                <circle cx="422" cy="295" r="4.0" fill="#ef4444" opacity="0.95" />
            </g>

            {/* IMPACT SPOT & CALLOUT (HAWK-EYE STYLE OUT-OF-BOUNDS) */}
            <g>
                <ellipse cx="440.9" cy="357.2" rx="26" ry="13" fill="none" stroke="#ef4444" strokeWidth="2.0" strokeOpacity="0.75" />
                <ellipse cx="440.9" cy="357.2" rx="40" ry="20" fill="none" stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="6,4" strokeOpacity="0.45" />
                <ellipse cx="440.9" cy="357.2" rx="5.0" ry="2.5" fill="#ffffff" fillOpacity="0.85" />
                <line x1="447.8" y1="345.0" x2="440.9" y2="357.2" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="2,2" />
                
                {/* Hawk-Eye Out Badge */}
                <g transform="translate(460, 368)" filter="url(#hawkEyeGlow)">
                    <rect x="0" y="0" width="62" height="22" rx="4" fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
                    <text x="31" y="15" fill="#ffffff" fontSize="11" fontWeight="900" fontFamily="sans-serif" letterSpacing="1.2" textAnchor="middle">OUT</text>
                </g>
                <text x="491" y="402" fill="#ef4444" fontSize="10" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.8" textAnchor="middle">+ 16 mm</text>
            </g>

            {/* AUTHENTIC SHUTTLECOCK (BIRDIE) */}
            <g transform="translate(440.9, 357.2)">
                {/* Ground Contact Shadow */}
                <ellipse cx="-3" cy="2" rx="22" ry="8" fill="#000c05" fillOpacity="0.7" filter="url(#shuttleContactShadow)" />

                {/* Rotating Shuttlecock to authentic resting orientation */}
                <g transform="rotate(-34)">
                    {/* 1. FEATHER SKIRT (Back Shaded Flutes) */}
                    <g fill="url(#featherDarkGrad)" stroke="#94a3b8" strokeWidth="0.6">
                        <path d="M -14 -42 C -18 -38, -12 -14, -6 -6 L 6 -6 C 12 -14, 18 -38, 14 -42 Z" />
                        <path d="M -20 -38 C -22 -30, -14 -12, -7 -5 L -2 -5 C -8 -16, -14 -32, -16 -40 Z" />
                        <path d="M 20 -38 C 22 -30, 14 -12, 7 -5 L 2 -5 C 8 -16, 14 -32, 16 -40 Z" />
                    </g>

                    {/* 2. FEATHER SKIRT (Foreground Goose Feathers) */}
                    <g fill="url(#featherGrad)" stroke="#cbd5e1" strokeWidth="0.8">
                        <path d="M -22 -36 C -25 -26, -16 -12, -7 -5 L -4 -5 C -11 -14, -18 -26, -17 -38 C -19 -38, -21 -37, -22 -36 Z" />
                        <path d="M -16 -41 C -18 -30, -12 -14, -5 -5 L -2 -5 C -7 -14, -12 -28, -11 -42 C -13 -42, -15 -42, -16 -41 Z" />
                        <path d="M -9 -44 C -11 -32, -7 -14, -3 -5 L 0 -5 C -3 -15, -6 -30, -4 -45 C -6 -45, -8 -45, -9 -44 Z" />
                        <path d="M -2 -46 C -4 -34, -2 -14, 0 -5 L 3 -5 C 2 -14, 2 -34, 4 -46 C 2 -46, 0 -46, -2 -46 Z" />
                        <path d="M 5 -45 C 4 -32, 2 -14, 1 -5 L 4 -5 C 6 -14, 9 -32, 10 -44 C 8 -45, 6 -45, 5 -45 Z" />
                        <path d="M 12 -42 C 10 -30, 6 -14, 3 -5 L 6 -5 C 10 -14, 15 -30, 17 -40 C 15 -41, 13 -42, 12 -42 Z" />
                        <path d="M 18 -37 C 16 -26, 9 -12, 5 -5 L 8 -5 C 13 -13, 21 -26, 23 -35 C 21 -36, 19 -37, 18 -37 Z" />
                    </g>

                    {/* 3. CENTRAL FEATHER SHAFTS (Quills / Rachis) */}
                    <g stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round">
                        <line x1="-19" y1="-37" x2="-5.5" y2="-5" />
                        <line x1="-13" y1="-41" x2="-3.5" y2="-5" />
                        <line x1="-6.5" y1="-44" x2="-1.5" y2="-5" />
                        <line x1="1" y1="-46" x2="1.5" y2="-5" />
                        <line x1="7.5" y1="-44" x2="3.5" y2="-5" />
                        <line x1="14.5" y1="-41" x2="5.5" y2="-5" />
                        <line x1="20.5" y1="-36" x2="7" y2="-5" />
                    </g>

                    {/* 4. TWIN CONCENTRIC BINDING THREADS */}
                    <path d="M -20 -28 Q 0 -22 20 -28" fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M -20 -28 Q 0 -22 20 -28" fill="none" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="3,1.5" />

                    <path d="M -12 -16 Q 0 -12 12 -16" fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M -12 -16 Q 0 -12 12 -16" fill="none" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="3,1.5" />

                    {/* 5. CORK COLLAR TAPE */}
                    <rect x="-7.5" y="-5" width="15" height="4.5" rx="1.2" fill="url(#corkTapeGrad)" stroke="#991b1b" strokeWidth="0.6" />
                    <line x1="-6.5" y1="-3" x2="6.5" y2="-3" stroke="#fca5a5" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.7" />

                    {/* 6. CORK DOME HEAD */}
                    <path d="M -7.5 -0.5 C -7.5 7, -5 13, 0 13 C 5 13, 7.5 7, 7.5 -0.5 Z" fill="url(#corkGrad)" stroke="#b45309" strokeWidth="1.0" />
                    <ellipse cx="-1.5" cy="5.5" rx="3.5" ry="4.5" fill="#ffffff" fillOpacity="0.55" transform="rotate(-15 -1.5 5.5)" />
                </g>
            </g>
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
