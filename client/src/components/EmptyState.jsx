// client/src/components/EmptyState.jsx
import PropTypes from 'prop-types';
import { Box, Typography, Button, Stack } from '@mui/material';
import { motion } from 'framer-motion';

// --- Bespoke Vector Graphics Suite ---

const NoPlayersGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Peaceful empty badminton court with resting racket and shuttlecock"
    >
        <defs>
            <linearGradient id="emptyCourtFloor" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#004d26" stopOpacity={0.9} />
                <stop offset="60%" stopColor="#006633" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#003319" stopOpacity={0.95} />
            </linearGradient>
            <radialGradient id="courtAmbientGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00E676" stopOpacity={0.22} />
                <stop offset="70%" stopColor="#004d26" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </radialGradient>
            <filter id="racketShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity={0.35} />
            </filter>
            <pattern id="netMeshEmpty" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 0 8 L 8 0 M 0 0 L 8 8" fill="none" stroke="#FFFFFF" strokeWidth="0.65" strokeOpacity="0.35" />
            </pattern>
        </defs>

        <ellipse cx="200" cy="140" rx="160" ry="70" fill="url(#courtAmbientGlow)" />
        <polygon points="60,190 140,90 260,90 340,190" fill="url(#emptyCourtFloor)" stroke="#00E676" strokeWidth="2" strokeOpacity="0.85" strokeLinejoin="round" />

        <line x1="95" y1="190" x2="160" y2="90" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1="305" y1="190" x2="240" y2="90" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1="118" y1="140" x2="282" y2="140" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.7" />
        <line x1="200" y1="140" x2="200" y2="190" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity="0.7" />

        <line x1="138" y1="62" x2="138" y2="105" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
        <line x1="262" y1="62" x2="262" y2="105" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
        <polygon points="138,68 262,68 262,94 138,94" fill="url(#netMeshEmpty)" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="138" y1="68" x2="262" y2="68" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />

        <g transform="translate(260, 150) rotate(28)" filter="url(#racketShadow)">
            <ellipse cx="0" cy="0" rx="26" ry="36" fill="none" stroke="#64748B" strokeWidth="3.5" />
            <ellipse cx="0" cy="0" rx="24" ry="34" fill="none" stroke="#00E676" strokeWidth="1" strokeOpacity="0.5" />
            <path d="M -13,-24 L -13,24 M 0,-32 L 0,32 M 13,-24 L 13,24" stroke="#CBD5E1" strokeWidth="0.85" strokeOpacity="0.75" />
            <path d="M -20,-16 L 20,-16 M -24,0 L 24,0 M -20,16 L 20,16" stroke="#CBD5E1" strokeWidth="0.85" strokeOpacity="0.75" />
            <line x1="0" y1="36" x2="0" y2="82" stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="0" y1="36" x2="0" y2="44" stroke="#FFCC33" strokeWidth="4" />
            <rect x="-4.5" y="60" width="9" height="30" rx="2.5" fill="#004d26" stroke="#FFCC33" strokeWidth="1" />
        </g>

        <g transform="translate(145, 168) rotate(-18)" filter="url(#racketShadow)">
            <polygon points="-12,-28 12,-28 8,0 -8,0" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            <line x1="-8" y1="-26" x2="-5" y2="-2" stroke="#94A3B8" strokeWidth="0.8" />
            <line x1="0" y1="-27" x2="0" y2="-2" stroke="#94A3B8" strokeWidth="0.8" />
            <line x1="8" y1="-26" x2="5" y2="-2" stroke="#94A3B8" strokeWidth="0.8" />
            <rect x="-7.5" y="0" width="15" height="3.5" fill="#EF4444" rx="1" />
            <ellipse cx="0" cy="7" rx="7.5" ry="6" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
        </g>
    </svg>
);

NoPlayersGraphic.propTypes = {
    compact: PropTypes.bool,
};

const NoTournamentsGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Tournament championship trophy with event clipboard and shuttlecock"
    >
        <defs>
            <linearGradient id="goldTrophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF275" />
                <stop offset="35%" stopColor="#FFCC33" />
                <stop offset="80%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
            <linearGradient id="tabletPlateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" stopOpacity={0.75} />
                <stop offset="100%" stopColor="#0F172A" stopOpacity={0.95} />
            </linearGradient>
            <filter id="trophyGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#FFCC33" floodOpacity={0.25} />
            </filter>
        </defs>

        <ellipse cx="200" cy="140" rx="140" ry="60" fill="url(#courtAmbientGlow)" opacity={0.6} />

        <g transform="translate(100, 35)">
            <rect x="0" y="0" width="200" height="150" rx="16" fill="url(#tabletPlateGrad)" stroke="#334155" strokeWidth="1.5" />
            <rect x="0" y="0" width="200" height="34" rx="16" fill="#004d26" />
            <rect x="0" y="18" width="200" height="16" fill="#004d26" />
            <circle cx="35" cy="17" r="4" fill="#FFFFFF" opacity={0.7} />
            <circle cx="165" cy="17" r="4" fill="#FFFFFF" opacity={0.7} />
            <path d="M 25,60 H 55 V 85 H 85 M 25,110 H 55 V 85" fill="none" stroke="#64748B" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3,3" />
            <path d="M 175,60 H 145 V 85 H 115 M 175,110 H 145 V 85" fill="none" stroke="#64748B" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3,3" />
        </g>

        <g transform="translate(200, 130)" filter="url(#trophyGlow)">
            <rect x="-35" y="42" width="70" height="18" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
            <rect x="-24" y="46" width="48" height="10" rx="2" fill="url(#goldTrophyGrad)" />
            <path d="M -8,26 L -6,42 L 6,42 L 8,26 Z" fill="url(#goldTrophyGrad)" />
            <path d="M -34,-25 Q -34,26 0,26 Q 34,26 34,-25 Z" fill="url(#goldTrophyGrad)" />
            <path d="M -34,-14 Q -52,-14 -46,8 Q -40,24 -20,20" fill="none" stroke="url(#goldTrophyGrad)" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 34,-14 Q 52,-14 46,8 Q 40,24 20,20" fill="none" stroke="url(#goldTrophyGrad)" strokeWidth="4.5" strokeLinecap="round" />
            <polygon points="-5,-4 5,-4 3,6 -3,6" fill="#FFFFFF" opacity={0.9} />
            <circle cx="0" cy="9" r="3.5" fill="#FEF08A" />
            <ellipse cx="0" cy="-25" rx="34" ry="7" fill="#FFF275" stroke="#D97706" strokeWidth="1" />
        </g>

        <g transform="translate(130, 182) rotate(22)">
            <polygon points="-8,-20 8,-20 5,0 -5,0" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
            <rect x="-5" y="0" width="10" height="2.5" fill="#EF4444" rx="0.5" />
            <circle cx="0" cy="5" r="4.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="0.8" />
        </g>

        <path d="M 245,95 Q 248,95 248,92 Q 248,95 251,95 Q 248,95 248,98 Q 248,95 245,95 Z" fill="#FFF275" />
        <path d="M 152,118 Q 155,118 155,115 Q 155,118 158,118 Q 155,118 155,121 Q 155,118 152,118 Z" fill="#FFF275" />
    </svg>
);

NoTournamentsGraphic.propTypes = {
    compact: PropTypes.bool,
};

const NoBuddiesGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Two crossed badminton rackets with partner connection radar"
    >
        <defs>
            <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00E676" stopOpacity={0.25} />
                <stop offset="60%" stopColor="#004d26" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </radialGradient>
            <filter id="buddyRacketGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity={0.3} />
            </filter>
        </defs>

        <ellipse cx="200" cy="120" rx="140" ry="85" fill="url(#radarPulse)" />
        <ellipse cx="200" cy="120" rx="120" ry="70" fill="none" stroke="#00E676" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="6,6" />
        <ellipse cx="200" cy="120" rx="80" ry="48" fill="none" stroke="#FFCC33" strokeWidth="1.2" strokeOpacity="0.45" strokeDasharray="4,4" />

        <circle cx="95" cy="100" r="4" fill="#00E676" opacity={0.8} />
        <circle cx="305" cy="105" r="4" fill="#FFCC33" opacity={0.8} />
        <circle cx="200" cy="45" r="3.5" fill="#FFFFFF" opacity={0.8} />

        <g filter="url(#buddyRacketGlow)">
            <g transform="translate(200, 120) rotate(34)">
                <ellipse cx="0" cy="-60" rx="24" ry="32" fill="none" stroke="#00E676" strokeWidth="3.5" />
                <path d="M -12,-80 L -12,-40 M 0,-90 L 0,-30 M 12,-80 L 12,-40" stroke="#E2E8F0" strokeWidth="0.8" strokeOpacity="0.7" />
                <path d="M -18,-70 L 18,-70 M -22,-60 L 22,-60 M -18,-50 L 18,-50" stroke="#CBD5E1" strokeWidth="0.8" strokeOpacity="0.7" />
                <line x1="0" y1="-28" x2="0" y2="40" stroke="#64748B" strokeWidth="3" />
                <rect x="-4" y="20" width="8" height="38" rx="2" fill="#FFCC33" />
            </g>

            <g transform="translate(200, 120) rotate(-34)">
                <ellipse cx="0" cy="-60" rx="24" ry="32" fill="none" stroke="#FFCC33" strokeWidth="3.5" />
                <path d="M -12,-80 L -12,-40 M 0,-90 L 0,-30 M 12,-80 L 12,-40" stroke="#E2E8F0" strokeWidth="0.8" strokeOpacity="0.7" />
                <path d="M -18,-70 L 18,-70 M -22,-60 L 22,-60 M -18,-50 L 18,-50" stroke="#CBD5E1" strokeWidth="0.8" strokeOpacity="0.7" />
                <line x1="0" y1="-28" x2="0" y2="40" stroke="#64748B" strokeWidth="3" />
                <rect x="-4" y="20" width="8" height="38" rx="2" fill="#004d26" stroke="#00E676" strokeWidth="0.8" />
            </g>
        </g>

        <g transform="translate(200, 115)">
            <polygon points="-12,-25 12,-25 7,2 -7,2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            <line x1="-8" y1="-23" x2="-4" y2="0" stroke="#94A3B8" strokeWidth="0.8" />
            <line x1="0" y1="-24" x2="0" y2="0" stroke="#94A3B8" strokeWidth="0.8" />
            <line x1="8" y1="-23" x2="4" y2="0" stroke="#94A3B8" strokeWidth="0.8" />
            <rect x="-7" y="2" width="14" height="3" fill="#EF4444" rx="1" />
            <ellipse cx="0" cy="9" rx="7" ry="5.5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
        </g>
    </svg>
);

NoBuddiesGraphic.propTypes = {
    compact: PropTypes.bool,
};

const NoResultsGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Magnifying glass inspecting empty court lines with zero results"
    >
        <defs>
            <radialGradient id="lensRefract" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.25} />
                <stop offset="60%" stopColor="#00E676" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#0F172A" stopOpacity={0.4} />
            </radialGradient>
            <linearGradient id="handleMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <filter id="glassShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#000000" floodOpacity={0.3} />
            </filter>
        </defs>

        <line x1="60" y1="180" x2="340" y2="180" stroke="#334155" strokeWidth="2" strokeDasharray="8,6" />
        <line x1="120" y1="210" x2="280" y2="60" stroke="#004d26" strokeWidth="3" strokeOpacity="0.6" />
        <line x1="150" y1="210" x2="310" y2="60" stroke="#00E676" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="5,5" />

        <g transform="translate(185, 105)" filter="url(#glassShadow)">
            <g transform="rotate(45)">
                <rect x="-6" y="52" width="12" height="60" rx="4" fill="url(#handleMetalGrad)" stroke="#64748B" strokeWidth="1.5" />
                <rect x="-5" y="48" width="10" height="7" rx="2" fill="#FFCC33" />
                <rect x="-5" y="104" width="10" height="6" rx="2" fill="#FFCC33" />
            </g>

            <circle cx="0" cy="0" r="50" fill="url(#lensRefract)" stroke="#64748B" strokeWidth="4.5" />
            <circle cx="0" cy="0" r="47.5" fill="none" stroke="#00E676" strokeWidth="1.2" strokeOpacity="0.7" />

            <line x1="-30" y1="15" x2="30" y2="15" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.75" />
            <line x1="0" y1="-25" x2="0" y2="25" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.75" />
            <circle cx="0" cy="15" r="4" fill="#FFCC33" opacity="0.8" />

            <path d="M -34,-24 A 42 42 0 0 1 20,-38" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65" />
        </g>
    </svg>
);

NoResultsGraphic.propTypes = {
    compact: PropTypes.bool,
};

const NoPostsGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Discussion board card with feather quill"
    >
        <defs>
            <linearGradient id="postCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#0F172A" stopOpacity={0.95} />
            </linearGradient>
        </defs>
        <ellipse cx="200" cy="140" rx="140" ry="60" fill="url(#courtAmbientGlow)" opacity={0.5} />
        <g transform="translate(100, 40)">
            <rect x="0" y="0" width="200" height="150" rx="14" fill="url(#postCardGrad)" stroke="#334155" strokeWidth="1.5" />
            <circle cx="32" cy="30" r="12" fill="#004d26" stroke="#00E676" strokeWidth="1" />
            <rect x="52" y="22" width="70" height="8" rx="4" fill="#E2E8F0" opacity="0.8" />
            <rect x="52" y="34" width="45" height="6" rx="3" fill="#64748B" opacity="0.7" />
            <line x1="20" y1="58" x2="180" y2="58" stroke="#334155" strokeWidth="1" />
            <rect x="20" y="75" width="160" height="7" rx="3.5" fill="#64748B" opacity="0.6" />
            <rect x="20" y="92" width="130" height="7" rx="3.5" fill="#64748B" opacity="0.6" />
            <rect x="20" y="109" width="90" height="7" rx="3.5" fill="#64748B" opacity="0.4" />
        </g>
        <g transform="translate(255, 120) rotate(-28)">
            <polygon points="-8,-40 8,-40 5,0 -5,0" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            <line x1="0" y1="-38" x2="0" y2="45" stroke="#FFCC33" strokeWidth="2.5" />
            <circle cx="0" cy="46" r="3" fill="#D97706" />
        </g>
    </svg>
);

NoPostsGraphic.propTypes = {
    compact: PropTypes.bool,
};

const NoMessagesGraphic = ({ compact }) => (
    <svg 
        viewBox="0 0 400 240" 
        width="100%" 
        height="100%" 
        style={{ maxHeight: compact ? 120 : 200, display: 'block', margin: '0 auto' }} 
        role="img" 
        aria-label="Speech bubbles indicating no chat messages"
    >
        <ellipse cx="200" cy="140" rx="130" ry="55" fill="url(#courtAmbientGlow)" opacity={0.5} />
        <g transform="translate(130, 60)">
            <path d="M 10,0 H 110 A 20 20 0 0 1 130,20 V 60 A 20 20 0 0 1 110,80 H 40 L 15,100 V 80 H 10 A 20 20 0 0 1 -10,60 V 20 A 20 20 0 0 1 10,0 Z" fill="#004d26" stroke="#00E676" strokeWidth="1.5" />
            <circle cx="35" cy="40" r="5" fill="#FFFFFF" opacity={0.75} />
            <circle cx="60" cy="40" r="5" fill="#FFFFFF" opacity={0.75} />
            <circle cx="85" cy="40" r="5" fill="#FFFFFF" opacity={0.75} />
        </g>
        <g transform="translate(195, 105)">
            <path d="M 10,0 H 90 A 18 18 0 0 1 108,18 V 50 A 18 18 0 0 1 90,68 H 70 L 50,84 V 68 H 10 A 18 18 0 0 1 -8,50 V 18 A 18 18 0 0 1 10,0 Z" fill="#1E293B" stroke="#64748B" strokeWidth="1.2" opacity="0.9" />
            <polygon points="45,26 55,26 53,34 47,34" fill="#FFFFFF" opacity={0.8} />
            <circle cx="50" cy="37" r="2.5" fill="#FEF08A" />
        </g>
    </svg>
);

NoMessagesGraphic.propTypes = {
    compact: PropTypes.bool,
};

// --- Presets Map ---

const presets = {
    'no-players': {
        Graphic: NoPlayersGraphic,
        title: 'No Players on Court',
        description: 'Looks like everyone is currently off court or in a match. Try adjusting your skill level or search terms.',
    },
    'no-tournaments': {
        Graphic: NoTournamentsGraphic,
        title: 'No Events Scheduled',
        description: 'There are currently no tournaments matching your filters. Check back soon for regional opens or submit a discovery!',
    },
    'no-buddies': {
        Graphic: NoBuddiesGraphic,
        title: 'Find Hitting Partners',
        description: 'Connect with badminton players at your skill level, coordinate match times, and build your hitting squad.',
    },
    'no-results': {
        Graphic: NoResultsGraphic,
        title: 'No Matches Found',
        description: "We couldn't find anything matching your search. Check your spelling or try broader keywords.",
    },
    'no-posts': {
        Graphic: NoPostsGraphic,
        title: 'No Discussions Yet',
        description: 'Be the first to share tournament news, racket reviews, or smash session clips with the community.',
    },
    'no-messages': {
        Graphic: NoMessagesGraphic,
        title: 'No Messages Yet',
        description: 'Select a conversation or start chatting with a fellow player from the member directory.',
    },
};

// Aliases for comprehensive backwards-compatibility
const typeAliasMap = {
    'court-empty': 'no-players',
    'players': 'no-players',
    'matches': 'no-players',
    'no-events': 'no-tournaments',
    'tournaments': 'no-tournaments',
    'events': 'no-tournaments',
    'find-partners': 'no-buddies',
    'friends': 'no-buddies',
    'buddies': 'no-buddies',
    'generic': 'no-results',
    'search': 'no-results',
    'marketplace': 'no-results',
    'default': 'no-results',
    'posts': 'no-posts',
    'messages': 'no-messages',
};

export default function EmptyState({
    type = 'no-results',
    title,
    description,
    subtitle, // alias for description
    actionLabel,
    onAction,
    actionIcon,
    secondaryActionLabel,
    onSecondaryAction,
    secondaryActionIcon,
    compact = false,
    maxWidth = 520,
    sx = {},
    children,
}) {
    const resolvedKey = typeAliasMap[type] || type;
    const config = presets[resolvedKey] || presets['no-results'];
    const GraphicComponent = config.Graphic;

    const displayTitle = title ?? config.title;
    const displayDescription = description ?? subtitle ?? config.description;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%' }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: compact ? 3 : { xs: 5, md: 7 },
                    px: compact ? 1.5 : { xs: 2.5, sm: 4 },
                    textAlign: 'center',
                    borderRadius: compact ? 3 : 4,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: compact ? 'none' : '0 4px 20px rgba(0,0,0,0.03)',
                    maxWidth: '100%',
                    mx: 'auto',
                    ...sx,
                }}
            >
                {/* Floating Micro-Motion Graphic */}
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                    style={{ width: '100%', maxWidth: compact ? 220 : 380, marginBottom: compact ? 8 : 16 }}
                >
                    <GraphicComponent compact={compact} />
                </motion.div>

                {/* Typography Hierarchy */}
                {displayTitle && (
                    <Typography
                        variant={compact ? 'subtitle1' : 'h5'}
                        fontWeight={800}
                        sx={{
                            color: 'text.primary',
                            letterSpacing: '-0.3px',
                            lineHeight: 1.3,
                            mb: compact ? 0.75 : 1.25,
                            maxWidth: compact ? 280 : maxWidth,
                        }}
                    >
                        {displayTitle}
                    </Typography>
                )}

                {displayDescription && (
                    <Typography
                        variant={compact ? 'caption' : 'body2'}
                        sx={{
                            color: 'text.secondary',
                            lineHeight: 1.6,
                            maxWidth: compact ? 260 : maxWidth,
                            mb: (actionLabel || secondaryActionLabel || children) ? (compact ? 2 : 3) : 0,
                        }}
                    >
                        {displayDescription}
                    </Typography>
                )}

                {/* Action Buttons Stack */}
                {(actionLabel || secondaryActionLabel) && (
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{ width: '100%', maxWidth: 420, justifyContent: 'center', alignItems: 'center' }}
                    >
                        {actionLabel && onAction && (
                            <Button
                                variant="contained"
                                color="primary"
                                size={compact ? 'small' : 'medium'}
                                onClick={onAction}
                                startIcon={actionIcon}
                                sx={{
                                    borderRadius: 3,
                                    px: compact ? 2.5 : 3.5,
                                    py: compact ? 0.75 : 1,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    boxShadow: '0 4px 14px rgba(0, 102, 51, 0.25)',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 6px 18px rgba(0, 102, 51, 0.35)',
                                    },
                                }}
                            >
                                {actionLabel}
                            </Button>
                        )}

                        {secondaryActionLabel && onSecondaryAction && (
                            <Button
                                variant="outlined"
                                color="primary"
                                size={compact ? 'small' : 'medium'}
                                onClick={onSecondaryAction}
                                startIcon={secondaryActionIcon}
                                sx={{
                                    borderRadius: 3,
                                    px: compact ? 2.5 : 3,
                                    py: compact ? 0.75 : 1,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    bgcolor: 'action.hover',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: 'action.selected',
                                        transform: 'translateY(-1px)',
                                    },
                                }}
                            >
                                {secondaryActionLabel}
                            </Button>
                        )}
                    </Stack>
                )}

                {/* Optional Custom Slot */}
                {children && (
                    <Box sx={{ mt: (actionLabel || secondaryActionLabel) ? 2 : 1, width: '100%' }}>
                        {children}
                    </Box>
                )}
            </Box>
        </motion.div>
    );
}

EmptyState.propTypes = {
    type: PropTypes.string,
    title: PropTypes.node,
    description: PropTypes.node,
    subtitle: PropTypes.node,
    actionLabel: PropTypes.string,
    onAction: PropTypes.func,
    actionIcon: PropTypes.node,
    secondaryActionLabel: PropTypes.string,
    onSecondaryAction: PropTypes.func,
    secondaryActionIcon: PropTypes.node,
    compact: PropTypes.bool,
    maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.object]),
    sx: PropTypes.object,
    children: PropTypes.node,
};
