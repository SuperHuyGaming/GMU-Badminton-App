import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CardActions, Button, CircularProgress, Alert, Grid } from '@mui/material';

export default function Tournaments() {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const handleExportICS = (tournament) => {
        const formatDateForICS = (dateString) => {
            if (!dateString) return '';
            const d = new Date(dateString);
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mason Badminton Connect//EN
BEGIN:VEVENT
UID:${tournament.id}@masonbadminton.com
DTSTAMP:${formatDateForICS(new Date().toISOString())}
DTSTART:${formatDateForICS(tournament.startDate)}
DTEND:${formatDateForICS(tournament.endDate)}
SUMMARY:${tournament.name || "Badminton Tournament"}
LOCATION:${tournament.location || ""}
DESCRIPTION:${(tournament.description || "").replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${(tournament.name || "Tournament").replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                let apiUrl = import.meta.env.VITE_TOURNAMENT_API_URL;
                const isLocalNetwork = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');
                
                if (!apiUrl) {
                    if (isLocalNetwork) {
                        apiUrl = `http://${window.location.hostname}:8081`;
                    } else {
                        // On production, if VITE_TOURNAMENT_API_URL is missing, it means Java isn't deployed (Free Tier constraints).
                        // Fail gracefully instead of causing a Network Error on port 8081.
                        setTournaments([]);
                        setLoading(false);
                        return;
                    }
                } else if (apiUrl && !apiUrl.startsWith("http")) {
                    apiUrl = "https://" + apiUrl;
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
                                    📍 {tournament.location}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    📅 {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                </Typography>
                                <Typography variant="body1">
                                    {tournament.description}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2 }}>
                                <Button 
                                    variant="outlined" 
                                    size="small" 
                                    color="primary"
                                    onClick={() => handleExportICS(tournament)}
                                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                >
                                    🗓️ Add to Calendar
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
