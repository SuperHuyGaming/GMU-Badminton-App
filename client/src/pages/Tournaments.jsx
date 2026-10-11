import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Box, Typography, Card, CardContent, CardActions, Button, 
    Alert, Grid, Dialog, DialogTitle, DialogContent, ToggleButton, ToggleButtonGroup,
    Drawer, Avatar, AvatarGroup, IconButton, FormGroup, FormControlLabel, Checkbox, 
    Divider, Chip, Tooltip, TextField, InputAdornment, Skeleton, Stack, Badge, Paper,
    Switch
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import EventIcon from '@mui/icons-material/Event';
import ViewListIcon from '@mui/icons-material/ViewList';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LaunchIcon from '@mui/icons-material/Launch';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import EmptyTournaments from '../components/EmptyTournaments';
import MapPinIcon from '../components/MapPinIcon';
import apiFetch from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SKILL_LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Open'];

export default function Tournaments() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rsvpLoading, setRsvpLoading] = useState({});

    // View state
    const [viewMode, setViewMode] = useState(searchParams.get('view') || 'list'); // 'list' | 'calendar'
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Filter states from URL params
    const searchQuery = searchParams.get('q') || '';
    const filterUpcoming = searchParams.get('upcoming') !== 'false'; // default true
    const filterWeekend = searchParams.get('weekend') === 'true';
    const selectedSkills = useMemo(() => {
        const skills = searchParams.get('skills');
        return skills ? skills.split(',').filter(Boolean) : [];
    }, [searchParams]);

    // Calendar state
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

    // Fetch tournaments from Express API
    const fetchTournaments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParts = [];
            if (searchQuery) queryParts.push(`search=${encodeURIComponent(searchQuery)}`);
            if (filterUpcoming) queryParts.push('upcoming=true');
            if (filterWeekend) queryParts.push('weekend=true');
            if (selectedSkills.length > 0) queryParts.push(`skillLevel=${encodeURIComponent(selectedSkills[0])}`);

            const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
            const res = await apiFetch(`/api/tournaments${queryString}`);
            if (!res.ok) {
                throw new Error(`Failed to load tournaments (HTTP ${res.status})`);
            }
            const data = await res.json();
            const list = Array.isArray(data.tournaments) ? data.tournaments : (Array.isArray(data) ? data : []);
            setTournaments(list);
        } catch (err) {
            console.error('Error fetching tournaments:', err);
            setError(err.message || 'Unable to connect to tournaments service.');
            setTournaments([]);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filterUpcoming, filterWeekend, selectedSkills]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchTournaments();
    }, [fetchTournaments]);

    // Update URL helper
    const updateFilters = (updates) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, val]) => {
            if (val === null || val === undefined || val === '' || val === false) {
                newParams.delete(key);
            } else if (Array.isArray(val)) {
                if (val.length === 0) newParams.delete(key);
                else newParams.set(key, val.join(','));
            } else {
                newParams.set(key, String(val));
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    const handleClearFilters = () => {
        setSearchParams(new URLSearchParams({ upcoming: 'true' }), { replace: true });
    };

    // RSVP Toggle handler
    const handleToggleRsvp = async (e, tournament) => {
        e.stopPropagation();
        const tournamentId = tournament._id || tournament.id;

        if (!user) {
            toast.error('Please sign in to RSVP for tournaments!');
            return;
        }

        const currentUserId = user._id || user.id;
        const attendees = tournament.attendees || [];
        const isCurrentlyGoing = attendees.some(a => (typeof a === 'string' ? a : a._id || a.id) === currentUserId);

        // Optimistic UI update
        const updatedAttendees = isCurrentlyGoing
            ? attendees.filter(a => (typeof a === 'string' ? a : a._id || a.id) !== currentUserId)
            : [...attendees, { _id: currentUserId, name: user.name || 'You', avatarUrl: user.avatarUrl || '' }];

        const updatedRsvpCount = Math.max(0, (tournament.rsvpCount || 0) + (isCurrentlyGoing ? -1 : 1));

        setTournaments(prev => prev.map(t => {
            if ((t._id || t.id) === tournamentId) {
                return { ...t, attendees: updatedAttendees, rsvpCount: updatedRsvpCount };
            }
            return t;
        }));

        if (selectedTournament && (selectedTournament._id || selectedTournament.id) === tournamentId) {
            setSelectedTournament(prev => ({
                ...prev,
                attendees: updatedAttendees,
                rsvpCount: updatedRsvpCount
            }));
        }

        setRsvpLoading(prev => ({ ...prev, [tournamentId]: true }));

        try {
            const res = await apiFetch(`/api/tournaments/${tournamentId}/rsvp`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update RSVP');
            }
            toast.success(data.message || (isCurrentlyGoing ? 'RSVP removed' : "You're going!"));

            // Synchronize with server state
            setTournaments(prev => prev.map(t => {
                if ((t._id || t.id) === tournamentId) {
                    return {
                        ...t,
                        attendees: data.attendees || updatedAttendees,
                        rsvpCount: data.rsvpCount !== undefined ? data.rsvpCount : updatedRsvpCount
                    };
                }
                return t;
            }));
        } catch (err) {
            console.error('RSVP error:', err);
            toast.error(err.message || 'Could not update RSVP status.');
            // Rollback optimistic state
            fetchTournaments();
        } finally {
            setRsvpLoading(prev => ({ ...prev, [tournamentId]: false }));
        }
    };

    // Calendar Export (.ics)
    const handleExportICS = (e, tournament) => {
        e.stopPropagation();
        const formatDateForICS = (dateString) => {
            if (!dateString) return '';
            const d = new Date(dateString);
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const tId = tournament._id || tournament.id || 'tourney';
        const tStart = formatDateForICS(tournament.startDate || new Date().toISOString());
        const tEnd = formatDateForICS(tournament.endDate || tournament.startDate || new Date().toISOString());

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mason Badminton Connect//EN
BEGIN:VEVENT
UID:${tId}@masonbadminton.com
DTSTAMP:${formatDateForICS(new Date().toISOString())}
DTSTART:${tStart}
DTEND:${tEnd}
SUMMARY:${tournament.tournamentName || "Badminton Tournament"}
LOCATION:${tournament.eventLocation || "TBD"}
DESCRIPTION:${(tournament.originalCaption || "Collegiate Badminton Tournament").replace(/\n/g, '\\n')}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${(tournament.tournamentName || "Tournament").replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Calendar event downloaded (.ics)');
    };

    // Check if user is attending a tournament
    const isUserAttending = useCallback((tournament) => {
        if (!user) return false;
        const currentUserId = user._id || user.id;
        const attendees = tournament.attendees || [];
        return attendees.some(a => (typeof a === 'string' ? a : a._id || a.id) === currentUserId);
    }, [user]);

    // Active filters count
    const activeFilterCount = (searchQuery ? 1 : 0) + 
                             (filterWeekend ? 1 : 0) + 
                             (!filterUpcoming ? 1 : 0) + 
                             selectedSkills.length;

    // Calendar Grid Data
    const calendarMonthData = useMemo(() => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        // Previous month padding
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ dayNumber: null, isCurrentMonth: false, dateKey: null });
        }
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            days.push({
                dayNumber: day,
                isCurrentMonth: true,
                dateObj,
                dateKey
            });
        }
        return days;
    }, [calendarDate]);

    // Group tournaments by date string (YYYY-MM-DD)
    const tournamentsByDate = useMemo(() => {
        const map = {};
        tournaments.forEach(t => {
            if (!t.startDate) return;
            const d = new Date(t.startDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            map[key].push(t);
        });
        return map;
    }, [tournaments]);

    // Tournaments for the selected calendar date
    const calendarSelectedTournaments = useMemo(() => {
        if (!calendarSelectedDate) return [];
        return tournamentsByDate[calendarSelectedDate] || [];
    }, [calendarSelectedDate, tournamentsByDate]);

    return (
        <Box sx={{ maxWidth: 1240, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
            {/* Hero Header Banner */}
            <Box 
                sx={{ 
                    mb: 4, 
                    p: { xs: 3, md: 5 }, 
                    borderRadius: 4, 
                    background: 'linear-gradient(135deg, #006633 0%, #004d26 100%)', 
                    color: '#ffffff', 
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0, 102, 51, 0.25)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <Typography variant="h3" sx={{ fontWeight: 800, mb: 1.5, fontSize: { xs: '1.9rem', sm: '2.5rem', md: '3rem' } }}>
                    Discover DMV Tournaments
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 720, mx: 'auto', fontWeight: 400, fontSize: { xs: '0.95rem', md: '1.15rem' } }}>
                    Real-time badminton tournaments and open invitational events aggregated from collegiate clubs across DC, Maryland, and Virginia.
                </Typography>
            </Box>

            {/* Controls Bar: Search, View Switcher & Filter Toggle */}
            <Paper 
                elevation={1} 
                sx={{ 
                    p: 2, 
                    mb: 3, 
                    borderRadius: 3, 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 2, 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    bgcolor: 'background.paper'
                }}
            >
                {/* Search Field */}
                <TextField 
                    placeholder="Search tournaments, clubs, universities..."
                    size="small"
                    value={searchQuery}
                    onChange={(e) => updateFilters({ q: e.target.value })}
                    sx={{ flex: { xs: '1 1 100%', sm: '1 1 280px' } }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => updateFilters({ q: '' })} aria-label="Clear search">
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null
                        }
                    }}
                />

                {/* View Mode Toggle & Filter Trigger */}
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        size="small"
                        onChange={(_, newMode) => {
                            if (newMode) {
                                setViewMode(newMode);
                                updateFilters({ view: newMode === 'list' ? null : newMode });
                            }
                        }}
                        aria-label="tournament view mode"
                    >
                        <ToggleButton value="list" aria-label="List View">
                            <ViewListIcon sx={{ mr: 0.5, fontSize: 20 }} /> List
                        </ToggleButton>
                        <ToggleButton value="calendar" aria-label="Calendar View">
                            <CalendarMonthIcon sx={{ mr: 0.5, fontSize: 20 }} /> Calendar
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Badge badgeContent={activeFilterCount} color="secondary">
                        <Button 
                            variant="outlined" 
                            size="medium"
                            startIcon={<FilterListIcon />} 
                            onClick={() => setFiltersOpen(true)}
                            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                        >
                            Filters
                        </Button>
                    </Badge>
                </Box>
            </Paper>

            {/* Quick Filter Chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                <Chip 
                    label="Upcoming Only" 
                    color={filterUpcoming ? "primary" : "default"}
                    variant={filterUpcoming ? "filled" : "outlined"}
                    onClick={() => updateFilters({ upcoming: !filterUpcoming })}
                />
                <Chip 
                    label="This Weekend" 
                    color={filterWeekend ? "primary" : "default"}
                    variant={filterWeekend ? "filled" : "outlined"}
                    onClick={() => updateFilters({ weekend: !filterWeekend })}
                />
                {SKILL_LEVEL_OPTIONS.map(skill => (
                    <Chip 
                        key={skill}
                        label={skill}
                        color={selectedSkills.includes(skill) ? "primary" : "default"}
                        variant={selectedSkills.includes(skill) ? "filled" : "outlined"}
                        onClick={() => {
                            const newSkills = selectedSkills.includes(skill)
                                ? selectedSkills.filter(s => s !== skill)
                                : [...selectedSkills, skill];
                            updateFilters({ skills: newSkills });
                        }}
                    />
                ))}
                {activeFilterCount > 0 && (
                    <Button 
                        size="small" 
                        color="secondary" 
                        onClick={handleClearFilters}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Reset All Filters
                    </Button>
                )}
            </Box>

            {/* Loading State Skeletons */}
            {loading && (
                <Grid container spacing={3}>
                    {[1, 2, 3, 4, 5, 6].map((k) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={k}>
                            <Card sx={{ borderRadius: 3, p: 2 }}>
                                <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2, mb: 2 }} />
                                <Skeleton variant="text" height={32} sx={{ mb: 1 }} />
                                <Skeleton variant="text" width="60%" sx={{ mb: 1 }} />
                                <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
                                <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 2 }} />
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Error Message */}
            {!loading && error && (
                <Alert 
                    severity="error" 
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={
                        <Button color="inherit" size="small" onClick={fetchTournaments}>
                            Retry
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* Empty State */}
            {!loading && !error && tournaments.length === 0 && (
                <EmptyTournaments />
            )}

            {/* VIEW MODE 1: LIST / CARD GRID */}
            {!loading && !error && viewMode === 'list' && tournaments.length > 0 && (
                <Grid container spacing={3}>
                    {tournaments.map((tournament) => {
                        const tId = tournament._id || tournament.id;
                        const attending = isUserAttending(tournament);
                        const attendeesList = tournament.attendees || [];
                        const isSoldOut = tournament.status === 'sold_out';

                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tId}>
                                <Card 
                                    data-testid={`tournament-card-${tId}`}
                                    sx={{ 
                                        height: '100%', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        borderRadius: 3, 
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 28px rgba(0,0,0,0.12)'
                                        }
                                    }}
                                    onClick={() => setSelectedTournament(tournament)}
                                >
                                    {/* Tournament Flyer Image or Fallback Banner */}
                                    {tournament.flyerImageUrl ? (
                                        <Box sx={{ width: '100%', height: 180, overflow: 'hidden', position: 'relative' }}>
                                            <img 
                                                src={tournament.flyerImageUrl} 
                                                alt={`${tournament.tournamentName} flyer`} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                            />
                                            {isSoldOut && (
                                                <Chip 
                                                    label="Sold Out" 
                                                    color="error" 
                                                    size="small" 
                                                    sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 700 }}
                                                />
                                            )}
                                        </Box>
                                    ) : (
                                        <Box 
                                            sx={{ 
                                                width: '100%', 
                                                height: 140, 
                                                bgcolor: 'primary.dark', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                p: 2,
                                                textAlign: 'center',
                                                color: '#ffffff',
                                                position: 'relative'
                                            }}
                                        >
                                            <Typography variant="h6" sx={{ fontWeight: 700, opacity: 0.9 }}>
                                                🏸 {tournament.hostUniversity || tournament.hostClubHandle || 'DMV Badminton'}
                                            </Typography>
                                            {isSoldOut && (
                                                <Chip 
                                                    label="Sold Out" 
                                                    color="error" 
                                                    size="small" 
                                                    sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 700 }}
                                                />
                                            )}
                                        </Box>
                                    )}

                                    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                        {/* Host Club / University Tag */}
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {tournament.hostUniversity || tournament.hostClubHandle || 'Collegiate Tournament'}
                                        </Typography>

                                        {/* Tournament Title */}
                                        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.3, mt: 0.5 }}>
                                            {tournament.tournamentName}
                                        </Typography>

                                        {/* Date and Location */}
                                        <Stack spacing={0.7} sx={{ my: 1.5 }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <EventIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                                {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('en-US', {
                                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                                }) : 'Date TBD'}
                                            </Typography>

                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <MapPinIcon width={16} height={16} />
                                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {tournament.eventLocation || 'Location TBD'}
                                                </Box>
                                            </Typography>
                                        </Stack>

                                        {/* Skill Levels and Fee Chips */}
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                            {tournament.entryFee && (
                                                <Chip label={`Fee: ${tournament.entryFee}`} size="small" color="default" sx={{ fontWeight: 600 }} />
                                            )}
                                            {(tournament.skillLevels || []).slice(0, 3).map((skill, idx) => (
                                                <Chip key={idx} label={skill} size="small" variant="outlined" color="primary" />
                                            ))}
                                        </Box>
                                    </CardContent>

                                    {/* Action Bar: RSVP Button + Avatars + Register Button */}
                                    <CardActions sx={{ px: 2, pb: 2, pt: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        <Divider sx={{ width: '100%', mb: 0.5 }} />

                                        {/* RSVP Section */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <Button 
                                                variant={attending ? "contained" : "outlined"} 
                                                color={attending ? "success" : "primary"}
                                                size="small"
                                                disabled={rsvpLoading[tId]}
                                                startIcon={attending ? <CheckCircleIcon /> : null}
                                                onClick={(e) => handleToggleRsvp(e, tournament)}
                                                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', px: 2 }}
                                                aria-label={attending ? "Remove RSVP" : "RSVP I'm Going"}
                                            >
                                                {attending ? "Going ✓" : "I'm Going!"}
                                            </Button>

                                            {/* Attendees Count & Avatars */}
                                            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                    {tournament.rsvpCount || 0} attending
                                                </Typography>
                                                {attendeesList.length > 0 && (
                                                    <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.75rem' } }}>
                                                        {attendeesList.map((att, idx) => (
                                                            <Tooltip key={idx} title={typeof att === 'object' ? att.name || 'Player' : 'Player'}>
                                                                <Avatar 
                                                                    alt={typeof att === 'object' ? att.name : 'Player'} 
                                                                    src={typeof att === 'object' ? att.avatarUrl : ''} 
                                                                />
                                                            </Tooltip>
                                                        ))}
                                                    </AvatarGroup>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Outbound Link & Calendar Buttons */}
                                        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                                            {tournament.registrationUrl ? (
                                                <Button 
                                                    variant="contained" 
                                                    color="primary"
                                                    fullWidth
                                                    size="medium"
                                                    onClick={(e) => e.stopPropagation()}
                                                    href={tournament.registrationUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
                                                    sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                                                >
                                                    Sign Up Here
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outlined" 
                                                    fullWidth
                                                    disabled
                                                    size="medium"
                                                    sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                                                >
                                                    Registration TBD
                                                </Button>
                                            )}

                                            <Tooltip title="Download .ics Calendar Event">
                                                <IconButton 
                                                    color="primary" 
                                                    onClick={(e) => handleExportICS(e, tournament)}
                                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                                                    aria-label="Add tournament to calendar"
                                                >
                                                    <TodayIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </CardActions>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* VIEW MODE 2: INTERACTIVE MONTHLY CALENDAR */}
            {!loading && !error && viewMode === 'calendar' && (
                <Paper elevation={2} sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, bgcolor: 'background.paper' }}>
                    {/* Month Navigation Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <IconButton 
                                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                                aria-label="Previous month"
                            >
                                <ChevronLeftIcon />
                            </IconButton>
                            <Button 
                                size="small" 
                                variant="outlined" 
                                onClick={() => {
                                    setCalendarDate(new Date());
                                    setCalendarSelectedDate(null);
                                }}
                            >
                                Today
                            </Button>
                            <IconButton 
                                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                                aria-label="Next month"
                            >
                                <ChevronRightIcon />
                            </IconButton>
                        </Stack>
                    </Box>

                    {/* Weekday Labels */}
                    <Grid container spacing={1} sx={{ mb: 1, textAlign: 'center' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                            <Grid size={{ xs: 12 / 7 }} key={d}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                    {d}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Days Matrix */}
                    <Grid container spacing={1}>
                        {calendarMonthData.map((cell, idx) => {
                            if (!cell.isCurrentMonth) {
                                return (
                                    <Grid size={{ xs: 12 / 7 }} key={`empty-${idx}`}>
                                        <Box sx={{ height: { xs: 60, md: 90 }, bgcolor: 'action.hover', borderRadius: 2, opacity: 0.3 }} />
                                    </Grid>
                                );
                            }

                            const dayTournaments = tournamentsByDate[cell.dateKey] || [];
                            const isSelected = calendarSelectedDate === cell.dateKey;
                            const isToday = new Date().toISOString().slice(0, 10) === cell.dateKey;

                            return (
                                <Grid size={{ xs: 12 / 7 }} key={cell.dateKey}>
                                    <Box 
                                        onClick={() => {
                                            if (dayTournaments.length === 1) {
                                                setSelectedTournament(dayTournaments[0]);
                                            } else {
                                                setCalendarSelectedDate(isSelected ? null : cell.dateKey);
                                            }
                                        }}
                                        sx={{ 
                                            height: { xs: 65, md: 95 }, 
                                            p: 0.75,
                                            border: '1px solid', 
                                            borderColor: isSelected ? 'primary.main' : (isToday ? 'secondary.main' : 'divider'),
                                            borderRadius: 2, 
                                            bgcolor: isSelected ? 'action.selected' : 'background.paper',
                                            cursor: dayTournaments.length > 0 ? 'pointer' : 'default',
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            transition: 'background-color 0.15s, border-color 0.15s',
                                            '&:hover': {
                                                bgcolor: dayTournaments.length > 0 ? 'action.hover' : 'inherit'
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography 
                                                variant="caption" 
                                                sx={{ 
                                                    fontWeight: isToday ? 800 : 600, 
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: isToday ? 'primary.main' : 'transparent',
                                                    color: isToday ? '#ffffff' : 'text.primary'
                                                }}
                                            >
                                                {cell.dayNumber}
                                            </Typography>
                                            {dayTournaments.length > 0 && (
                                                <Badge badgeContent={dayTournaments.length} color="primary" />
                                            )}
                                        </Box>

                                        {/* Tournament Chips inside Calendar Cell */}
                                        <Box sx={{ mt: 0.5, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                            {dayTournaments.slice(0, 2).map(t => (
                                                <Typography 
                                                    key={t._id || t.id}
                                                    variant="caption" 
                                                    sx={{ 
                                                        bgcolor: 'primary.light', 
                                                        color: 'primary.contrastText', 
                                                        px: 0.5, 
                                                        py: 0.1, 
                                                        borderRadius: 1, 
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                >
                                                    {t.tournamentName}
                                                </Typography>
                                            ))}
                                            {dayTournaments.length > 2 && (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                                    +{dayTournaments.length - 2} more
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Filtered list for selected calendar date */}
                    {calendarSelectedDate && calendarSelectedTournaments.length > 0 && (
                        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                                Tournaments on {new Date(calendarSelectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </Typography>
                            <Grid container spacing={2}>
                                {calendarSelectedTournaments.map(t => (
                                    <Grid size={{ xs: 12, md: 6 }} key={t._id || t.id}>
                                        <Paper 
                                            elevation={1} 
                                            sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                            onClick={() => setSelectedTournament(t)}
                                        >
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={700}>{t.tournamentName}</Typography>
                                                <Typography variant="body2" color="text.secondary">{t.eventLocation || 'TBD'}</Typography>
                                            </Box>
                                            <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); setSelectedTournament(t); }}>
                                                View
                                            </Button>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </Paper>
            )}

            {/* TOURNAMENT DETAIL MODAL */}
            <Dialog 
                open={!!selectedTournament} 
                onClose={() => setSelectedTournament(null)} 
                maxWidth="md" 
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 4, overflow: 'hidden' } } }}
            >
                {selectedTournament && (
                    <>
                        <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                    {selectedTournament.hostUniversity || selectedTournament.hostClubHandle || 'DMV Badminton Tournament'}
                                </Typography>
                                <Typography variant="h5" fontWeight="bold">
                                    {selectedTournament.tournamentName}
                                </Typography>
                            </Box>
                            <IconButton onClick={() => setSelectedTournament(null)} aria-label="Close dialog">
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>

                        <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
                            <Grid container spacing={3}>
                                {/* Flyer preview image */}
                                <Grid size={{ xs: 12, md: 5 }}>
                                    {selectedTournament.flyerImageUrl ? (
                                        <Box sx={{ width: '100%', borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                                            <img 
                                                src={selectedTournament.flyerImageUrl} 
                                                alt="Tournament Flyer" 
                                                style={{ width: '100%', height: 'auto', display: 'block' }} 
                                            />
                                        </Box>
                                    ) : (
                                        <Box sx={{ width: '100%', height: 240, bgcolor: 'primary.dark', color: '#fff', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
                                            <Typography variant="h6" fontWeight={700}>
                                                🏸 {selectedTournament.hostUniversity || 'DMV Badminton'}
                                            </Typography>
                                        </Box>
                                    )}
                                </Grid>

                                {/* Tournament Details */}
                                <Grid size={{ xs: 12, md: 7 }}>
                                    <Stack spacing={2}>
                                        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <EventIcon color="primary" />
                                            <strong>Dates:</strong> {selectedTournament.startDate ? new Date(selectedTournament.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}
                                        </Typography>

                                        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <MapPinIcon width={20} height={20} />
                                            <strong>Location:</strong> {selectedTournament.eventLocation || 'TBD'}
                                        </Typography>

                                        {selectedTournament.entryFee && (
                                            <Typography variant="body1">
                                                <strong>Entry Fee:</strong> {selectedTournament.entryFee}
                                            </Typography>
                                        )}

                                        {selectedTournament.registrationDeadline && (
                                            <Typography variant="body1" color="error.main" fontWeight={600}>
                                                ⏰ Registration Deadline: {new Date(selectedTournament.registrationDeadline).toLocaleDateString()}
                                            </Typography>
                                        )}

                                        {/* Skill Levels */}
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Skill Divisions:</Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {(selectedTournament.skillLevels || []).map((skill, idx) => (
                                                    <Chip key={idx} label={skill} size="small" color="primary" variant="outlined" />
                                                ))}
                                            </Box>
                                        </Box>

                                        {/* Original Caption / Details */}
                                        {selectedTournament.originalCaption && (
                                            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, maxHeight: 160, overflowY: 'auto' }}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" gutterBottom>
                                                    POST DETAILS
                                                </Typography>
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {selectedTournament.originalCaption}
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Attendees summary */}
                                        <Box sx={{ pt: 1 }}>
                                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                                Attending Players ({selectedTournament.rsvpCount || 0}):
                                            </Typography>
                                            {(selectedTournament.attendees || []).length > 0 ? (
                                                <AvatarGroup max={6} sx={{ justifyContent: 'flex-start' }}>
                                                    {selectedTournament.attendees.map((att, idx) => (
                                                        <Tooltip key={idx} title={typeof att === 'object' ? att.name || 'Player' : 'Player'}>
                                                            <Avatar 
                                                                alt={typeof att === 'object' ? att.name : 'Player'} 
                                                                src={typeof att === 'object' ? att.avatarUrl : ''} 
                                                            />
                                                        </Tooltip>
                                                    ))}
                                                </AvatarGroup>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    Be the first to RSVP!
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Action buttons */}
                                        <Stack direction="row" spacing={1.5} sx={{ pt: 2 }}>
                                            <Button 
                                                variant={isUserAttending(selectedTournament) ? "contained" : "outlined"}
                                                color={isUserAttending(selectedTournament) ? "success" : "primary"}
                                                onClick={(e) => handleToggleRsvp(e, selectedTournament)}
                                                startIcon={isUserAttending(selectedTournament) ? <CheckCircleIcon /> : null}
                                                sx={{ flex: 1, fontWeight: 700, borderRadius: 2 }}
                                            >
                                                {isUserAttending(selectedTournament) ? "Going ✓" : "I'm Going!"}
                                            </Button>

                                            {selectedTournament.registrationUrl && (
                                                <Button 
                                                    variant="contained" 
                                                    color="primary"
                                                    href={selectedTournament.registrationUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<LaunchIcon />}
                                                    sx={{ flex: 1.5, fontWeight: 700, borderRadius: 2 }}
                                                >
                                                    Register Online
                                                </Button>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </DialogContent>
                    </>
                )}
            </Dialog>

            {/* ADVANCED FILTERS DRAWER */}
            <Drawer anchor="right" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
                <Box sx={{ width: 320, p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">Tournament Filters</Typography>
                        <IconButton size="small" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Divider sx={{ mb: 2.5 }} />

                    {/* Quick Toggles */}
                    <FormGroup sx={{ mb: 3 }}>
                        <FormControlLabel 
                            control={
                                <Switch 
                                    checked={filterUpcoming} 
                                    onChange={(e) => updateFilters({ upcoming: e.target.checked })} 
                                />
                            } 
                            label="Upcoming Events Only" 
                        />
                        <FormControlLabel 
                            control={
                                <Checkbox 
                                    checked={filterWeekend} 
                                    onChange={(e) => updateFilters({ weekend: e.target.checked })} 
                                />
                            } 
                            label="This Weekend Only" 
                        />
                    </FormGroup>

                    {/* Skill Divisions */}
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        Skill Levels
                    </Typography>
                    <FormGroup sx={{ mb: 3 }}>
                        {SKILL_LEVEL_OPTIONS.map(skill => (
                            <FormControlLabel 
                                key={skill}
                                control={
                                    <Checkbox 
                                        checked={selectedSkills.includes(skill)} 
                                        onChange={(e) => {
                                            const newSkills = e.target.checked
                                                ? [...selectedSkills, skill]
                                                : selectedSkills.filter(s => s !== skill);
                                            updateFilters({ skills: newSkills });
                                        }} 
                                    />
                                } 
                                label={skill} 
                            />
                        ))}
                    </FormGroup>

                    {/* Action buttons */}
                    <Stack spacing={1.5} sx={{ mt: 4 }}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            fullWidth 
                            onClick={() => setFiltersOpen(false)}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                        >
                            Apply Filters
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="secondary" 
                            fullWidth 
                            onClick={() => {
                                handleClearFilters();
                                setFiltersOpen(false);
                            }}
                            sx={{ fontWeight: 600, borderRadius: 2 }}
                        >
                            Reset All Filters
                        </Button>
                    </Stack>
                </Box>
            </Drawer>
        </Box>
    );
}
