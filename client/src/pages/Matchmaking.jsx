import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Alert, Grid, Avatar, Button, Chip, Stack, TextField, InputAdornment, Skeleton, Badge, Divider, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChatIcon from '@mui/icons-material/Chat';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { motion, AnimatePresence } from 'framer-motion';
import apiFetch from '../utils/api';



const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
    }),
};

export default function Matchmaking() {
    const [matches, setMatches] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [skillFilter, setSkillFilter] = useState('All');

    const skillLevels = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            try {
                let url = '/api/matchmaking/discover?';
                if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
                if (skillFilter !== 'All') url += `skill=${encodeURIComponent(skillFilter)}&`;
                
                const response = await apiFetch(url);
                const data = await response.json();
                setMatches(data.matches || []);
                setRecommended(data.recommended || []);
            } catch (err) {
                setError(err.message || 'Failed to fetch players');
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchMatches();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, skillFilter]);

    const isRecentlyActive = (lastActiveDate) => {
        if (!lastActiveDate) return false;
        const diff = new Date() - new Date(lastActiveDate);
        return diff < 24 * 60 * 60 * 1000; // active in last 24 hours
    };

    const renderSkeletons = (count = 6) => (
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
            {Array.from({ length: count }).map((_, idx) => (
                <Grid size={{'xs': 12, 'sm': 6, 'md': 4}} key={idx}>
                    <Card sx={{ height: '100%', p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, width: '100%' }}>
                            <Skeleton variant="circular" width={72} height={72} animation="wave" />
                            <Stack direction="column" spacing={1} alignItems="flex-end">
                                <Skeleton variant="rounded" width={80} height={24} animation="wave" sx={{ borderRadius: 1.5 }} />
                                <Skeleton variant="rounded" width={60} height={24} animation="wave" sx={{ borderRadius: 1.5 }} />
                            </Stack>
                        </Box>
                        <Skeleton variant="text" width="70%" height={28} animation="wave" sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="85%" height={20} animation="wave" sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="55%" height={20} animation="wave" sx={{ mb: 1.5 }} />
                        <Skeleton variant="text" width="95%" height={18} animation="wave" sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="80%" height={18} animation="wave" sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto', pt: 2 }}>
                            <Skeleton variant="rounded" width="48%" height={36} animation="wave" sx={{ borderRadius: 2 }} />
                            <Skeleton variant="rounded" width="48%" height={36} animation="wave" sx={{ borderRadius: 2 }} />
                        </Box>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );

    const renderCarouselSkeletons = (count = 4) => (
        <Box sx={{ display: 'flex', gap: 2.5 }}>
            {Array.from({ length: count }).map((_, idx) => (
                <Card key={idx} sx={{ minWidth: 260, maxWidth: 280, p: 2.5, borderRadius: 3, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                        <Skeleton variant="circular" width={72} height={72} animation="wave" />
                        <Skeleton variant="rounded" width={70} height={24} animation="wave" sx={{ borderRadius: 1.5 }} />
                    </Box>
                    <Skeleton variant="text" width="70%" height={28} animation="wave" sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width="85%" height={20} animation="wave" sx={{ mb: 1.5 }} />
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto', pt: 1 }}>
                        <Skeleton variant="rounded" width="48%" height={36} animation="wave" sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rounded" width="48%" height={36} animation="wave" sx={{ borderRadius: 2 }} />
                    </Box>
                </Card>
            ))}
        </Box>
    );

    const renderPlayerCard = (player) => (
        <Card 
            sx={{ 
                height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, p: 2.5, transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)' }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, width: '100%' }}>
                <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    color="success"
                    invisible={!isRecentlyActive(player.lastActive)}
                    sx={{ '& .MuiBadge-badge': { width: 14, height: 14, borderRadius: '50%', border: '2px solid white' } }}
                >
                    <Avatar 
                        src={player.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`} 
                        sx={{ width: 72, height: 72, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
                     alt={player.name} />
                </Badge>
                <Stack direction="column" spacing={1} alignItems="flex-end">
                    {player.skillLevel && <Chip label={player.skillLevel} size="small" color="primary" sx={{ fontWeight: 600, borderRadius: 1.5 }} />}
                    {player.preferredPlay && <Chip label={player.preferredPlay} size="small" variant="outlined" sx={{ fontWeight: 500, borderRadius: 1.5 }} />}
                </Stack>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: 0, width: '100%' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.2, mb: 1, color: 'text.primary', wordBreak: 'break-word' }}>
                    {player.name}
                </Typography>
                {player.homeUniversity && (
                    <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span aria-hidden="true">🏫</span> {player.homeUniversity}
                    </Typography>
                )}
                {player.racket && (
                    <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span aria-hidden="true">🏸</span> {player.racket}
                    </Typography>
                )}
                {player.bio && (
                    <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'text.secondary', wordBreak: 'break-word' }}>
                        "{player.bio}"
                    </Typography>
                )}
            </CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1.5, width: '100%', mt: 'auto', pt: 2 }}>
                <Button variant="outlined" sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold', minWidth: '100px', textTransform: 'none' }} onClick={() => window.location.href = `/profile/${player._id}`}>
                    Profile
                </Button>
                <Button variant="contained" color="primary" sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold', minWidth: '100px', textTransform: 'none' }} onClick={() => alert(`Starting conversation with ${player.name}...`)} startIcon={<ChatIcon />}>
                    Message
                </Button>
            </Box>
        </Card>
    );

    if (error) {
        return (
            <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3, mt: 4 }}>
            <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
                Community Directory
            </Typography>
            <Typography color="text.primary" sx={{ mb: 4 }}>
                Find players, connect, and hit the courts.
            </Typography>

            <TextField
                fullWidth
                variant="outlined"
                placeholder="Search by name or university..."
                aria-label="Search by name or university"
                inputProps={{ 'aria-label': 'Search by name or university' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 2 }}
                InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                }}
            />

            <Stack direction="row" spacing={1} sx={{ mb: 4, overflowX: 'auto', pb: 1 }}>
                <Typography variant="body2" color="text.primary" sx={{ alignSelf: 'center', mr: 1, fontWeight: 'bold' }}>
                    Filter Skill:
                </Typography>
                {skillLevels.map(level => (
                    <Chip 
                        key={level} 
                        label={level} 
                        onClick={() => setSkillFilter(level)}
                        color={skillFilter === level ? 'primary' : 'default'}
                        variant={skillFilter === level ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 'bold' }}
                        clickable
                    />
                ))}
            </Stack>

            {!searchQuery && skillFilter === 'All' && (
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            People You May Know
                        </Typography>
                        {!loading && recommended.length > 3 && (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton
                                    size="small"
                                    aria-label="Scroll left"
                                    onClick={() => {
                                        const el = document.getElementById('carousel-scroll');
                                        if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
                                    }}
                                    sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                                >
                                    <ChevronLeftIcon />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    aria-label="Scroll right"
                                    onClick={() => {
                                        const el = document.getElementById('carousel-scroll');
                                        if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
                                    }}
                                    sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                                >
                                    <ChevronRightIcon />
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                    {loading ? renderCarouselSkeletons() : recommended.length > 0 ? (
                        <Box
                            id="carousel-scroll"
                            sx={{
                                display: 'flex',
                                gap: 2.5,
                                overflowX: 'auto',
                                scrollSnapType: 'x mandatory',
                                pb: 2,
                                px: 0.5,
                                '&::-webkit-scrollbar': { height: 6 },
                                '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                            }}
                        >
                            {recommended.map((player, i) => (
                                <Box
                                    key={`rec-${player._id}`}
                                    sx={{ minWidth: 260, maxWidth: 280, flexShrink: 0, scrollSnapAlign: 'start' }}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.06, duration: 0.35 }}
                                    >
                                        {renderPlayerCard(player)}
                                    </motion.div>
                                </Box>
                            ))}
                        </Box>
                    ) : null}
                    <Divider sx={{ mt: 3 }} />
                </Box>
            )}

            {(searchQuery || skillFilter !== 'All') && (
                <>
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Search Results
                    </Typography>
                    {loading ? (
                        renderSkeletons()
                    ) : matches.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            No players found matching your criteria.
                        </Alert>
                    ) : (
                        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                            <AnimatePresence>
                                {matches.map((player, i) => (
                                    <Grid size={{'xs': 12, 'sm': 6, 'md': 4}} key={`match-${player._id}`}>
                                        <motion.div
                                            custom={i}
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="hidden"
                                            layout
                                        >
                                            {renderPlayerCard(player)}
                                        </motion.div>
                                    </Grid>
                                ))}
                            </AnimatePresence>
                        </Grid>
                    )}
                </>
            )}
        </Box>
    );
}

