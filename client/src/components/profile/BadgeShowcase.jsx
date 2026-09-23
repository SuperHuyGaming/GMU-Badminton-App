
import { Box, Typography, Tooltip } from '@mui/material';

const GoldBadge = ({ label }) => (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
        <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF200" />
                <stop offset="30%" stopColor="#FFD700" />
                <stop offset="70%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#996515" />
            </linearGradient>
            <linearGradient id="goldGradLight" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFF8DC" />
                <stop offset="50%" stopColor="#FFD700" />
                <stop offset="100%" stopColor="#B8860B" />
            </linearGradient>
            <filter id="gold-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="4" floodOpacity="0.4" floodColor="#000" />
            </filter>
        </defs>
        <g filter="url(#gold-shadow)">
            {/* Hexagon Shield */}
            <path d="M50 5 L90 28 L90 75 L50 115 L10 75 L10 28 Z" fill="url(#goldGrad)" />
            {/* Inner border */}
            <path d="M50 13 L82 32 L82 71 L50 105 L18 71 L18 32 Z" fill="none" stroke="url(#goldGradLight)" strokeWidth="3" opacity="0.9" />
            {/* Center Star */}
            <path d="M50 35 L54 48 L68 48 L56 56 L60 70 L50 60 L40 70 L44 56 L32 48 L46 48 Z" fill="#FFF8DC" opacity="0.9" />
            {/* Label Background */}
            <rect x="15" y="80" width="70" height="22" rx="4" fill="#111" opacity="0.7" />
            {/* Label */}
            <text x="50" y="95" fontSize="11" fontWeight="900" fill="#FFF200" textAnchor="middle" letterSpacing="0.5">
                {label.toUpperCase()}
            </text>
            <text x="50" y="28" fontSize="10" fontWeight="bold" fill="#FFF" textAnchor="middle" opacity="0.8">
                GOLD
            </text>
        </g>
    </svg>
);

const SilverBadge = ({ label }) => (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
        <defs>
            <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#C0C0C0" />
                <stop offset="100%" stopColor="#707070" />
            </linearGradient>
            <linearGradient id="silverGradLight" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F5F5F5" />
                <stop offset="50%" stopColor="#E0E0E0" />
                <stop offset="100%" stopColor="#A9A9A9" />
            </linearGradient>
            <filter id="silver-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.3" floodColor="#000" />
            </filter>
        </defs>
        <g filter="url(#silver-shadow)">
            {/* Ribbons */}
            <path d="M20 60 L10 110 L30 100 L50 110 L50 60 Z" fill="#4285F4" />
            <path d="M80 60 L90 110 L70 100 L50 110 L50 60 Z" fill="#0F9D58" />
            
            {/* Main Medal */}
            <circle cx="50" cy="45" r="40" fill="url(#silverGrad)" />
            <circle cx="50" cy="45" r="33" fill="none" stroke="url(#silverGradLight)" strokeWidth="3" />
            <circle cx="50" cy="45" r="28" fill="rgba(0,0,0,0.05)" />
            
            <text x="50" y="40" fontSize="10" fontWeight="bold" fill="#444" textAnchor="middle">
                SILVER
            </text>
            <rect x="18" y="52" width="64" height="20" rx="3" fill="#111" opacity="0.8" />
            <text x="50" y="66" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle" letterSpacing="0.5">
                {label.toUpperCase()}
            </text>
        </g>
    </svg>
);

const BronzeBadge = ({ label }) => (
    <svg viewBox="0 0 100 120" width="100%" height="100%">
        <defs>
            <linearGradient id="bronzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFA07A" />
                <stop offset="50%" stopColor="#CD7F32" />
                <stop offset="100%" stopColor="#8B4513" />
            </linearGradient>
            <linearGradient id="bronzeGradLight" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFDAB9" />
                <stop offset="50%" stopColor="#CD853F" />
                <stop offset="100%" stopColor="#A0522D" />
            </linearGradient>
            <filter id="bronze-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" floodColor="#000" />
            </filter>
        </defs>
        <g filter="url(#bronze-shadow)">
            <rect x="15" y="15" width="70" height="75" rx="15" fill="url(#bronzeGrad)" />
            <rect x="22" y="22" width="56" height="61" rx="10" fill="none" stroke="url(#bronzeGradLight)" strokeWidth="2" opacity="0.8" />
            
            <path d="M35 35 L65 35 L50 55 Z" fill="url(#bronzeGradLight)" opacity="0.6" />

            <text x="50" y="30" fontSize="9" fontWeight="bold" fill="#fff" textAnchor="middle" opacity="0.9">
                BRONZE
            </text>
            
            <rect x="10" y="75" width="80" height="24" rx="4" fill="#333" />
            <text x="50" y="91" fontSize="10" fontWeight="bold" fill="#FFA07A" textAnchor="middle" letterSpacing="0.5">
                {label.toUpperCase()}
            </text>
        </g>
    </svg>
);

const BADGE_MAP = {
    first_win: { tier: "bronze", label: "First Blood" },
    streak_3: { tier: "silver", label: "On Fire" },
    matches_10: { tier: "silver", label: "Regular" },
    streak_5: { tier: "gold", label: "Unstoppable" },
    matches_50: { tier: "gold", label: "Veteran" },
};

export default function BadgeShowcase({ badges = [] }) {
    if (!badges || badges.length === 0) {
        return null;
    }

    const renderBadge = (badgeId) => {
        const badgeInfo = BADGE_MAP[badgeId];
        if (!badgeInfo) return null;

        const { tier, label } = badgeInfo;

        let BadgeComponent;
        if (tier === 'gold') BadgeComponent = GoldBadge;
        else if (tier === 'silver') BadgeComponent = SilverBadge;
        else BadgeComponent = BronzeBadge;

        return (
            <Tooltip title={`${label} Achievement`} key={badgeId} arrow placement="top">
                <Box 
                    sx={{ 
                        width: { xs: 80, sm: 100 }, 
                        height: { xs: 100, sm: 120 }, 
                        transition: 'transform 0.2s, filter 0.2s',
                        filter: 'grayscale(0.1)',
                        cursor: 'pointer',
                        '&:hover': {
                            transform: 'translateY(-5px) scale(1.05)',
                            filter: 'grayscale(0) brightness(1.1)'
                        }
                    }}
                >
                    <BadgeComponent label={label} />
                </Box>
            </Tooltip>
        );
    };

    return (
        <Box sx={{ 
            width: '100%', 
            bgcolor: 'background.paper', 
            borderRadius: 4, 
            p: 3, 
            my: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            border: '1px solid',
            borderColor: 'divider'
        }}>
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: '900', mb: 2 }}>
                🏆 Achievements Showcase
            </Typography>
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 3, 
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    mt: 2
                }}
            >
                {badges.map((badgeId) => renderBadge(badgeId))}
            </Box>
        </Box>
    );
}
