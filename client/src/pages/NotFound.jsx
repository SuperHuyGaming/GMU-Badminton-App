import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const OutOfBoundsGraphic = () => (
    <svg viewBox="0 0 400 300" width="100%" height="300" style={{ maxWidth: 400 }}>
        <defs>
            <linearGradient id="courtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#006633" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#006633" stopOpacity="0.2" />
            </linearGradient>
            <filter id="shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
            </filter>
        </defs>
        
        {/* Abstract Badminton Court */}
        <rect x="40" y="180" width="260" height="100" fill="url(#courtGrad)" rx="10" />
        <line x1="170" y1="180" x2="170" y2="280" stroke="#006633" strokeWidth="4" opacity="0.3" strokeDasharray="6,6" />
        
        {/* Out of bounds line */}
        <line x1="320" y1="150" x2="320" y2="300" stroke="#FF4136" strokeWidth="8" opacity="0.6" strokeLinecap="round" />
        
        {/* Motion lines showing it flying out */}
        <path d="M80 80 Q 220 30 350 250" fill="none" stroke="#ccc" strokeWidth="3" strokeDasharray="12,12" opacity="0.6" />
        
        {/* Shuttlecock lying on the ground out of bounds */}
        <g transform="translate(350, 250) rotate(75)" filter="url(#shadow)">
            {/* Feathers */}
            <path d="M0,0 Q12,15 25,20 Q12,25 0,40 Q-8,25 0,0" fill="#ffffff" stroke="#e0e0e0" strokeWidth="2" />
            <path d="M22,18 L38,10 M22,22 L38,30 M25,20 L42,20" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" />
            {/* Cork */}
            <circle cx="0" cy="20" r="12" fill="#ffffff" stroke="#e0e0e0" strokeWidth="2" />
            {/* Red band */}
            <path d="M0,8 A12 12 0 0 1 0,32 A12 12 0 0 0 0,8" fill="#FF4136" opacity="0.9" />
        </g>
    </svg>
);

export default function NotFound() {
    const navigate = useNavigate();
    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '70vh', 
            textAlign: 'center', 
            px: 3 
        }}>
            <OutOfBoundsGraphic />
            <Typography variant="h1" fontWeight="900" sx={{ mt: 2, mb: 1, color: 'text.primary', fontSize: { xs: '4rem', md: '6rem' } }}>
                404
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>
                Shuttlecock out of bounds!
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', maxWidth: 450, lineHeight: 1.6 }}>
                It looks like the page you are looking for landed outside the court lines. 
                Don't worry, even the pros miss sometimes!
            </Typography>
            <Button 
                variant="contained" 
                size="large" 
                onClick={() => navigate('/')} 
                sx={{ 
                    borderRadius: 3, 
                    px: 5, 
                    py: 1.5, 
                    fontWeight: 'bold',
                    boxShadow: '0 8px 16px rgba(0, 102, 51, 0.2)'
                }}
            >
                Return to Court
            </Button>
        </Box>
    );
}
