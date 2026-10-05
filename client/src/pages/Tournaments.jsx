import { useState, useEffect, useCallback } from 'react';
import { 
    Box, Typography, Card, CardContent, CardActions, Button, CircularProgress, 
    Alert, Grid, Dialog, DialogTitle, DialogContent, ToggleButton, ToggleButtonGroup,
    Drawer, Avatar, AvatarGroup, IconButton, FormGroup, FormControlLabel, Checkbox, Slider, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import EventIcon from '@mui/icons-material/Event';
import ViewListIcon from '@mui/icons-material/ViewList';
import MapIcon from '@mui/icons-material/Map';
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

    // Detail Modal & RSVP
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [rsvpStatus, setRsvpStatus] = useState({});

    // Advanced Filters
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filterWeekend, setFilterWeekend] = useState(false);
    const [filterDistance, setFilterDistance] = useState(50);

    const [viewMode, setViewMode] = useState('list'); // list, calendar, map

    // Bracket State
    const [bracketOpen, setBracketOpen] = useState(false);
    const [bracketData, setBracketData] = useState(null);
    const [bracketLoading, setBracketLoading] = useState(false);

    // eslint-disable-next-line no-unused-vars
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
SUMMARY:${tournament.tournamentName || "Badminton Tournament"}
LOCATION:${tournament.eventLocation || ""}
DESCRIPTION:${(tournament.originalCaption || "").replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${(tournament.tournamentName || "Tournament").replace(/\s+/g, '_')}.ics`);
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
                    apiUrl = "";
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
            
            let endpointUrl = apiUrl ? `${apiUrl}/api/v1/tournaments` : '/api/v1/tournaments';
            if (cursor) {
                endpointUrl += `?cursor=${cursor}`;
            }
            
            // The Java core returns paginated data: { content: [...] }
            const response = await fetch(endpointUrl);
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchTournaments();
    }, [fetchTournaments]);

    const handleLoadMore = () => {
        if (hasNext && nextCursor) {
            fetchTournaments(nextCursor);
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, mt: 4 }}>
            <Box sx={{ mb: 4, p: 4, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', textAlign: 'center' }}>
                <Typography variant="h3" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Discover DMV Tournaments
                </Typography>
                <Typography variant="subtitle1">
                    Find local badminton tournaments scraped from across the web.
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, newMode) => { if (newMode) setViewMode(newMode); }}
                    aria-label="view mode"
                >
                    <ToggleButton value="list" aria-label="list view"><ViewListIcon sx={{ mr: 1 }}/> List</ToggleButton>
                    <ToggleButton value="calendar" aria-label="calendar view"><EventIcon sx={{ mr: 1 }}/> Calendar</ToggleButton>
                    <ToggleButton value="map" aria-label="map view"><MapIcon sx={{ mr: 1 }}/> Map</ToggleButton>
                </ToggleButtonGroup>
                <Button startIcon={<FilterListIcon />} variant="outlined" onClick={() => setFiltersOpen(true)}>
                    Filters
                </Button>
            </Box>

            {loading && !tournaments.length && <CircularProgress />}
            
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {!loading && !error && tournaments.length === 0 && (
                <EmptyTournaments />
            )}

            {viewMode === 'list' && (
                <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                    {tournaments.map((tournament) => (
                        <Grid size={{'xs': 12, 'md': 6}} key={tournament.id}>
                            <Card 
                                sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, cursor: 'pointer' }}
                                onClick={() => setSelectedTournament(tournament)}
                            >
                                {tournament.flyerImageUrl && (
                                    <Box sx={{ width: '100%', height: 200, overflow: 'hidden' }}>
                                        <img src={tournament.flyerImageUrl} alt="Tournament Flyer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </Box>
                                )}
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                                        {tournament.tournamentName}
                                    </Typography>
                                    <Typography variant="body2" color="text.primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <MapPinIcon width={16} height={16} /> {tournament.eventLocation}
                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            (12 miles away)
                                        </Typography>
                                    </Typography>
                                    <Typography variant="body2" color="text.primary" sx={{ mb: 2 }}>
                                        📅 {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBD'}
                                    </Typography>
                                    <Typography variant="body1">
                                        {tournament.originalCaption ? tournament.originalCaption.substring(0, 150) + "..." : ""}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                                        <Button 
                                            variant={rsvpStatus[tournament.id] ? "contained" : "outlined"} 
                                            color="secondary" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRsvpStatus(prev => ({...prev, [tournament.id]: !prev[tournament.id]}));
                                            }}
                                            sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold' }}
                                        >
                                            {rsvpStatus[tournament.id] ? "Going!" : "I'm Going!"}
                                        </Button>
                                        <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32 }, alignSelf: 'center' }}>
                                            <Avatar alt="Friend 1" src="https://i.pravatar.cc/150?img=1" />
                                            <Avatar alt="Friend 2" src="https://i.pravatar.cc/150?img=2" />
                                            <Avatar alt="Friend 3" src="https://i.pravatar.cc/150?img=3" />
                                        </AvatarGroup>
                                    </Box>
                                    {tournament.registrationUrl ? (
                                        <Button 
                                            variant="contained" 
                                            size="large" 
                                            color="secondary"
                                            onClick={(e) => e.stopPropagation()}
                                            href={tournament.registrationUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Sign up for ${tournament.title || "tournament"} (opens in a new window)`}
                                            fullWidth
                                            sx={{ borderRadius: 2, fontWeight: 'bold', py: 1.5, fontSize: '1.1rem', color: '#002f17' }}
                                        >
                                            SIGN UP HERE
                                        </Button>
                                    ) : (
                                        <Button 
                                            variant="contained" 
                                            size="large" 
                                            disabled
                                            fullWidth
                                            sx={{ borderRadius: 2, fontWeight: 'bold', py: 1.5, fontSize: '1.1rem' }}
                                        >
                                            Registration Missing
                                        </Button>
                                    )}
                                    <Button 
                                        variant="outlined" 
                                        size="medium" 
                                        color="primary"
                                        onClick={(e) => { e.stopPropagation(); handleExportICS(tournament); }}
                                        fullWidth
                                        sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                    >
                                        📅 Add to Calendar
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {viewMode === 'map' && (
                <Box sx={{ width: '100%', height: 400, bgcolor: 'grey.300', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                        Mock Map View (Leaflet not installed)
                    </Typography>
                </Box>
            )}

            {viewMode === 'calendar' && (
                <Box sx={{ width: '100%', height: 400, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" color="text.secondary">
                        Mock Calendar Grid View
                    </Typography>
                </Box>
            )}

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

            <Dialog 
                open={bracketOpen} 
                onClose={() => setBracketOpen(false)} 
                aria-labelledby="bracket-dialog-title" 
                maxWidth="lg" 
                fullWidth 
                PaperProps={{ sx: { borderRadius: 4, height: '80vh' } }}
            >
                <DialogTitle id="bracket-dialog-title" sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    16-Player Knockout Bracket
                    <Button onClick={() => setBracketOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Close</Button>
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: 'background.default' }}>
                    {bracketLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TournamentBracket rootMatch={bracketData} />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedTournament} onClose={() => setSelectedTournament(null)} maxWidth="md" fullWidth>
                {selectedTournament && (
                    <>
                        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h5" fontWeight="bold">
                                {selectedTournament.tournamentName}
                            </Typography>
                            <IconButton onClick={() => setSelectedTournament(null)}>
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                            <Box sx={{ flex: 1 }}>
                                {selectedTournament.flyerImageUrl ? (
                                    <img src={selectedTournament.flyerImageUrl} alt="Flyer" style={{ width: '100%', borderRadius: 8 }} />
                                ) : (
                                    <Box sx={{ width: '100%', height: 200, bgcolor: 'grey.300', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                                        <Typography color="text.secondary">No Flyer Image</Typography>
                                    </Box>
                                )}
                            </Box>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    📅 {selectedTournament.startDate ? new Date(selectedTournament.startDate).toLocaleDateString() : 'TBD'}
                                </Typography>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <MapPinIcon width={16} height={16} /> {selectedTournament.eventLocation}
                                </Typography>
                                <Typography variant="body1">
                                    {selectedTournament.originalCaption}
                                </Typography>
                                
                                <Box sx={{ mt: 'auto', pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {selectedTournament.registrationUrl ? (
                                        <Button variant="contained" color="secondary" href={selectedTournament.registrationUrl} target="_blank" fullWidth sx={{ fontWeight: 'bold' }}>
                                            Register Here
                                        </Button>
                                    ) : (
                                        <Button variant="contained" disabled fullWidth sx={{ fontWeight: 'bold' }}>
                                            Registration Missing
                                        </Button>
                                    )}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Button 
                                            variant={rsvpStatus[selectedTournament.id] ? "contained" : "outlined"} 
                                            color="secondary" 
                                            onClick={() => setRsvpStatus(prev => ({...prev, [selectedTournament.id]: !prev[selectedTournament.id]}))}
                                            sx={{ flex: 1, fontWeight: 'bold' }}
                                        >
                                            {rsvpStatus[selectedTournament.id] ? "Going!" : "I'm Going!"}
                                        </Button>
                                        <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}>
                                            <Avatar alt="Friend 1" src="https://i.pravatar.cc/150?img=1" />
                                            <Avatar alt="Friend 2" src="https://i.pravatar.cc/150?img=2" />
                                            <Avatar alt="Friend 3" src="https://i.pravatar.cc/150?img=3" />
                                        </AvatarGroup>
                                    </Box>
                                </Box>
                            </Box>
                        </DialogContent>
                    </>
                )}
            </Dialog>

            <Drawer anchor="right" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
                <Box sx={{ width: 300, p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Advanced Filters</Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <FormGroup>
                        <FormControlLabel 
                            control={<Checkbox checked={filterWeekend} onChange={(e) => setFilterWeekend(e.target.checked)} />} 
                            label="This Weekend" 
                        />
                        <FormControlLabel control={<Checkbox />} label="Singles" />
                        <FormControlLabel control={<Checkbox />} label="Doubles" />
                    </FormGroup>

                    <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>Distance</Typography>
                    <Slider 
                        value={filterDistance} 
                        onChange={(e, val) => setFilterDistance(val)} 
                        valueLabelDisplay="auto" 
                        step={10} 
                        marks 
                        min={0} 
                        max={100} 
                    />
                    <Typography variant="body2" color="text.secondary">Within {filterDistance} miles</Typography>

                    <Button variant="contained" color="primary" fullWidth sx={{ mt: 4, fontWeight: 'bold' }} onClick={() => setFiltersOpen(false)}>
                        Apply Filters
                    </Button>
                </Box>
            </Drawer>
        </Box>
    );
}
