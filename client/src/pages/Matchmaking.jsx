import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Grid, Avatar, Button, Chip, Stack } from '@mui/material';
import apiFetch from '../utils/api';

export default function Matchmaking() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const data = await apiFetch('/api/matchmaking/discover');
                setMatches(data.matches || []);
            } catch (err) {
                setError(err.message || 'Failed to fetch potential matches');
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

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
                Player Discovery
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Find local players based on your University and preferred play style.
            </Typography>

            {matches.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    We couldn't find any exact matches right now. Try expanding your search preferences!
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {matches.map((player) => (
                        <Grid item xs={12} sm={6} md={4} key={player._id}>
                            <Card 
                                sx={{ 
                                    height: '100%', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    borderRadius: 3,
                                    alignItems: 'center',
                                    p: 2,
                                    textAlign: 'center',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4
                                    }
                                }}
                            >
                                <Avatar 
                                    src={player.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`} 
                                    sx={{ width: 80, height: 80, mb: 2 }}
                                />
                                <CardContent sx={{ flexGrow: 1, p: 0, width: '100%' }}>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        {player.name}
                                    </Typography>
                                    
                                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                                        {player.skillLevel && (
                                            <Chip label={player.skillLevel} size="small" color="primary" variant="outlined" />
                                        )}
                                        {player.preferredPlay && (
                                            <Chip label={player.preferredPlay} size="small" color="secondary" variant="outlined" />
                                        )}
                                    </Stack>

                                    {player.homeUniversity && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            🏫 {player.homeUniversity}
                                        </Typography>
                                    )}

                                    {player.racket && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            🏸 {player.racket}
                                        </Typography>
                                    )}

                                    {player.bio && (
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            "{player.bio}"
                                        </Typography>
                                    )}
                                </CardContent>
                                
                                <Box sx={{ display: 'flex', gap: 1, width: '100%', mt: 'auto' }}>
                                    <Button 
                                        variant="outlined" 
                                        fullWidth 
                                        sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                        onClick={() => window.location.href = `/profile/${player._id}`}
                                    >
                                        Profile
                                    </Button>
                                    <Button 
                                        variant="contained" 
                                        color="primary"
                                        fullWidth 
                                        sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                        onClick={() => window.location.href = `/?reportMatch=${player._id}`}
                                    >
                                        Report Match
                                    </Button>
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
