import { Box, Typography } from '@mui/material';

const EmptyStateGraphic = () => (
    <svg viewBox="0 0 400 300" width="100%" height="250" style={{ maxWidth: 400 }}>
        <defs>
            <filter id="empty-shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.1" />
            </filter>
        </defs>
        
        {/* Empty Trophy case / Calendar */}
        <g filter="url(#empty-shadow)">
            <rect x="100" y="80" width="200" height="150" rx="15" fill="#f4f6f8" stroke="#e0e0e0" strokeWidth="4" />
            <rect x="100" y="80" width="200" height="45" rx="15" fill="#FFCC33" />
            <rect x="100" y="105" width="200" height="20" fill="#FFCC33" />
            <circle cx="150" cy="102" r="6" fill="#fff" opacity="0.6" />
            <circle cx="250" cy="102" r="6" fill="#fff" opacity="0.6" />
            
            {/* Calendar grid lines */}
            <line x1="150" y1="140" x2="150" y2="210" stroke="#e0e0e0" strokeWidth="2" strokeDasharray="4,4" />
            <line x1="200" y1="140" x2="200" y2="210" stroke="#e0e0e0" strokeWidth="2" strokeDasharray="4,4" />
            <line x1="250" y1="140" x2="250" y2="210" stroke="#e0e0e0" strokeWidth="2" strokeDasharray="4,4" />
            <line x1="120" y1="175" x2="280" y2="175" stroke="#e0e0e0" strokeWidth="2" strokeDasharray="4,4" />
        </g>
        
        {/* Broken / Resting racket leaning on it */}
        <g transform="translate(260, 150) rotate(35)" filter="url(#empty-shadow)">
            <ellipse cx="0" cy="0" rx="30" ry="40" fill="none" stroke="#b0b0b0" strokeWidth="5" />
            {/* Racket strings */}
            <path d="M-15,-25 L-15,25 M0,-35 L0,35 M15,-25 L15,25" stroke="#e0e0e0" strokeWidth="1" />
            <path d="M-25,-15 L25,-15 M-30,0 L30,0 M-25,15 L25,15" stroke="#e0e0e0" strokeWidth="1" />
            {/* Racket shaft & handle */}
            <line x1="0" y1="40" x2="0" y2="90" stroke="#b0b0b0" strokeWidth="5" />
            <rect x="-6" y="65" width="12" height="35" rx="3" fill="#006633" opacity="0.8" />
        </g>
        
        {/* Cobwebs */}
        <path d="M100 80 Q130 90 140 120 M100 100 Q120 110 120 130" stroke="#ccc" strokeWidth="1" fill="none" opacity="0.6" />
        <path d="M100 80 L140 120 M100 100 L120 130 M120 85 L135 105" stroke="#ccc" strokeWidth="0.5" fill="none" opacity="0.4" />
    </svg>
);

export default function EmptyTournaments() {
    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            textAlign: 'center', 
            py: { xs: 4, md: 8 },
            px: 2,
            bgcolor: 'background.paper',
            borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            border: '1px solid',
            borderColor: 'divider',
            mt: 2
        }}>
            <EmptyStateGraphic />
            <Typography variant="h5" fontWeight="900" sx={{ mt: 3, mb: 1, color: 'text.primary' }}>
                Our AI is Hunting...
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 450, lineHeight: 1.6 }}>
                Our autonomous AI engine is currently scouring the web for upcoming DMV tournaments. Check back soon!
            </Typography>
        </Box>
    );
}
