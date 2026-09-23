import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Card, CardContent, CardActions, Button, CircularProgress, Alert, Grid, Dialog, DialogTitle, DialogContent, DialogActions as MuiDialogActions, IconButton } from '@mui/material';
import TournamentBracket from '../components/TournamentBracket';
import EmptyTournaments from '../components/EmptyTournaments';
import apiFetch from '../utils/api';
import MapPinIcon from '../components/MapPinIcon';

export default function Tournaments() {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasNext, setHasNext] = useState(false);

    // Bracket State
    const [bracketOpen, setBracketOpen] = useState(false);
    const [bracketData, setBracketData] = useState(null);
    const [bracketLoading, setBracketLoading] = useState(false);

    const handleViewBracket = async () => {
        setBracketOpen(true);
        if (bracketData) return; // already loaded
        setBracketLoading(true);
        try {
            const res = await apiFetch('/api/matchmaking/generate-bracket');
            const data = await res.json();
            setBracketData(data);
        } catch (err) {
            console.error("Failed to fetch bracket", err);
        } finally {
            setBracketLoading(false);
        }
    };

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

    const fetchTournaments = useCallback(async (cursor = null) => {
        try {
            if (cursor) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            setError(null);

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
                    setLoadingMore(false);
                    return;
                }
            } else if (apiUrl && !apiUrl.startsWith("http")) {
                apiUrl = "https://" + apiUrl;
            }
            
            const endpoint = new URL(`${apiUrl}/api/v1/tournaments`);
            if (cursor) {
                endpoint.searchParams.append('cursor', cursor);
            }
            
            // The Java core returns paginated data: { content: [...] }
            const response = await fetch(endpoint.toString());
            if (!response.ok) throw new Error('Failed to fetch tournaments');
            const data = await response.json();
            
            if (cursor) {
                setTournaments(prev => [...prev, ...(data.content || [])]);
            } else {
                setTournaments(data.content || []);
            }
            
            setNextCursor(data.nextCursor || null);
            setHasNext(data.hasNext || false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    const handleLoadMore = () => {
        if (hasNext && nextCursor) {
            fetchTournaments(nextCursor);
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, mt: 4 }}>
            <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
                Upcoming Tournaments
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Find local badminton tournaments scraped from across the web.
            </Typography>

            {loading && !tournaments.length && <CircularProgress />}
            
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {!loading && !error && tournaments.length === 0 && (
                <EmptyTournaments />
            )}

            <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                {tournaments.map((tournament) => (
                    <Grid size={{'xs': 12, 'md': 6}} key={tournament.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    {tournament.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <MapPinIcon width={16} height={16} /> {tournament.location}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    📅 {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                                </Typography>
                                <Typography variant="body1">
                                    {tournament.description}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
                                <Button 
                                    variant="outlined" 
                                    size="small" 
                                    color="primary"
                                    onClick={() => handleExportICS(tournament)}
                                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                >
                                    🗓️ Add to Calendar
                                </Button>
                                <Button 
                                    variant="contained" 
                                    size="small" 
                                    color="primary"
                                    onClick={handleViewBracket}
                                    sx={{ borderRadius: 2, fontWeight: 'bold', ml: 'auto' }}
                                >
                                    View Bracket
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {hasNext && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Button 
                        variant="contained" 
                        size="large"
                        onClick={handleLoadMore} 
                        disabled={loadingMore}
                        sx={{ borderRadius: 2, fontWeight: 'bold', px: 4 }}
                    >
                        {loadingMore ? 'Loading...' : 'Load More Tournaments'}
                    </Button>
                </Box>
            )}

            <Dialog open={bracketOpen} onClose={() => setBracketOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 4, height: '80vh' } }}>
                <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    16-Player Knockout Bracket
                    <Button onClick={() => setBracketOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Close</Button>
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: '#f9f9f9' }}>
                    {bracketLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TournamentBracket rootMatch={bracketData} />
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
