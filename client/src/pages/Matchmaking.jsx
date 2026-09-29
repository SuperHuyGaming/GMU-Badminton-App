import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Alert, Grid, Avatar, Button, Chip, Stack, TextField, InputAdornment, Skeleton, Badge, Divider } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChatIcon from '@mui/icons-material/Chat';
import apiFetch from '../utils/api';

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
                    <Card sx={{ height: '100%', p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Skeleton variant="circular" width={80} height={80} sx={{ mb: 2 }} />
                        <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
                        <Skeleton variant="rectangular" width="80%" height={24} sx={{ mb: 2, borderRadius: 1 }} />
                        <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
                        <Skeleton variant="text" width="90%" height={40} sx={{ mt: 'auto' }} />
                        <Skeleton variant="rectangular" width="100%" height={36} sx={{ mt: 2, borderRadius: 2 }} />
                    </Card>
                </Grid>
            ))}
        </Grid>
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

            {!loading && recommended.length > 0 && !searchQuery && skillFilter === 'All' && (
                <Box sx={{ mb: 5 }}>
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                        People You May Know
                    </Typography>
                    <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                        {recommended.map(player => (
                            <Grid size={{'xs': 12, 'sm': 6, 'md': 3}} key={`rec-${player._id}`}>
                                {renderPlayerCard(player)}
                            </Grid>
                        ))}
                    </Grid>
                    <Divider sx={{ mt: 4 }} />
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
                            {matches.map((player) => (
                                <Grid size={{'xs': 12, 'sm': 6, 'md': 4}} key={`match-${player._id}`}>
                                    {renderPlayerCard(player)}
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </>
            )}
        </Box>
    );
}

