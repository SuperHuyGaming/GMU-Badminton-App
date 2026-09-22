import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Grid } from '@mui/material';

export default function Tournaments() {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                // If the ENV variable isn't set, default to standard port
                let apiUrl = import.meta.env.VITE_TOURNAMENT_API_URL || 'http://localhost:8081';
                // Automatically fix localhost when testing on mobile devices over LAN
                if (apiUrl.includes('localhost') && window.location.hostname !== 'localhost') {
                    apiUrl = apiUrl.replace('localhost', window.location.hostname);
                }
                
                // The Java core returns paginated data: { content: [...] }
                const response = await fetch(`${apiUrl}/api/v1/tournaments`);
                if (!response.ok) throw new Error('Failed to fetch tournaments');
                const data = await response.json();
                setTournaments(data.content || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
    }, []);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, mt: 4 }}>
            <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
                Upcoming Tournaments
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Find local badminton tournaments scraped from across the web.
            </Typography>

            {loading && <CircularProgress />}
            
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {!loading && !error && tournaments.length === 0 && (
                <Alert severity="info">No tournaments found right now. Check back later!</Alert>
            )}

            <Grid container spacing={3}>
                {tournaments.map((tournament) => (
                    <Grid item xs={12} md={6} key={tournament.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    {tournament.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    ðŸ“ {tournament.location}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    ðŸ“… {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                </Typography>
                                <Typography variant="body1">
                                    {tournament.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
