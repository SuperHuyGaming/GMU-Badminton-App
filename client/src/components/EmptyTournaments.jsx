import PropTypes from 'prop-types';
import { Box, Typography, Button } from '@mui/material';

const EmptyStateGraphic = () => (
    <svg viewBox="0 0 400 260" width="100%" height="220" style={{ maxWidth: 360 }}>
        <defs>
            <filter id="empty-shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.08" />
            </filter>
        </defs>
        
        {/* Clean Calendar / Schedule Card */}
        <g filter="url(#empty-shadow)">
            <rect x="100" y="50" width="200" height="150" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
            <rect x="100" y="50" width="200" height="42" rx="16" fill="#006633" />
            <rect x="100" y="74" width="200" height="18" fill="#006633" />
            <circle cx="150" cy="71" r="5" fill="#fff" opacity="0.8" />
            <circle cx="250" cy="71" r="5" fill="#fff" opacity="0.8" />
            
            {/* Calendar grid lines */}
            <line x1="150" y1="110" x2="150" y2="180" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="200" y1="110" x2="200" y2="180" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="250" y1="110" x2="250" y2="180" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,4" />
            <line x1="120" y1="145" x2="280" y2="145" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,4" />
        </g>
        
        {/* Badminton Racket leaning on schedule */}
        <g transform="translate(255, 120) rotate(32)" filter="url(#empty-shadow)">
            <ellipse cx="0" cy="0" rx="28" ry="38" fill="none" stroke="#64748b" strokeWidth="4" />
            {/* Racket strings */}
            <path d="M-14,-22 L-14,22 M0,-32 L0,32 M14,-22 L14,22" stroke="#94a3b8" strokeWidth="1" />
            <path d="M-22,-14 L22,-14 M-26,0 L26,0 M-22,14 L22,14" stroke="#94a3b8" strokeWidth="1" />
            {/* Racket shaft & handle */}
            <line x1="0" y1="38" x2="0" y2="85" stroke="#64748b" strokeWidth="4" />
            <rect x="-5" y="62" width="10" height="32" rx="3" fill="#006633" />
        </g>
    </svg>
);

export default function EmptyTournaments({ onResetFilters, onSubmitDiscovery }) {
    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            textAlign: 'center', 
            py: { xs: 5, md: 7 },
            px: { xs: 2, sm: 4 },
            bgcolor: 'background.paper',
            borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            border: '1px solid',
            borderColor: 'divider',
            mt: 2
        }}>
            <EmptyStateGraphic />

            <Typography 
                variant="h5" 
                fontWeight={800} 
                sx={{ 
                    mt: 2.5,
                    mb: 1.5, 
                    color: 'text.primary', 
                    maxWidth: 560, 
                    fontSize: { xs: '1.25rem', md: '1.45rem' },
                    letterSpacing: '-0.3px',
                    lineHeight: 1.35
                }}
            >
                No approved tournaments currently scheduled. Check back soon or submit a tournament discovery!
            </Typography>

            <Typography 
                variant="body2" 
                sx={{ 
                    color: 'text.secondary', 
                    maxWidth: 500, 
                    lineHeight: 1.6, 
                    mb: 3.5 
                }}
            >
                Tournaments across collegiate clubs, regional academies, and open circuits in DC, Maryland, and Virginia will appear here as schedules are verified.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {onResetFilters && (
                    <Button 
                        variant="outlined" 
                        color="primary" 
                        size="medium"
                        onClick={onResetFilters}
                        sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 2.5 }}
                    >
                        Reset Search Filters
                    </Button>
                )}
                {onSubmitDiscovery && (
                    <Button 
                        variant="contained" 
                        color="primary" 
                        size="medium"
                        onClick={onSubmitDiscovery}
                        sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 2.5 }}
                    >
                        Submit Tournament Discovery
                    </Button>
                )}
            </Box>
        </Box>
    );
}

EmptyTournaments.propTypes = {
    onResetFilters: PropTypes.func,
    onSubmitDiscovery: PropTypes.func
};
