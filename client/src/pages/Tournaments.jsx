import { useState, useEffect, useCallback, useMemo, forwardRef, useRef } from 'react';
import { 
    Box, Typography, Card, CardContent, CardActions, Button, 
    Alert, Grid, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
    ToggleButton, ToggleButtonGroup,
    Drawer, Avatar, AvatarGroup, IconButton, FormGroup, FormControlLabel, Checkbox, 
    Divider, Chip, Tooltip, TextField, InputAdornment, Skeleton, Stack, Badge, Paper,
    Switch, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
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
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { VirtuosoGrid } from 'react-virtuoso';

import EmptyTournaments from '../components/EmptyTournaments';
import MapPinIcon from '../components/MapPinIcon';
import LazyFlyerImage from '../components/LazyFlyerImage';
import apiFetch from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SKILL_LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Open'];

const BADMINTON_SYNONYMS = {
    GMU: "George Mason",
    UMD: "University of Maryland",
    NVBC: "Northern Virginia Badminton Club",
    CBA: "Capital Badminton",
    JHU: "Johns Hopkins",
    VT: "Virginia Tech",
    UVA: "University of Virginia"
};

const REVERSE_SYNONYMS = {
    "GEORGE MASON": "GMU",
    "UNIVERSITY OF MARYLAND": "UMD",
    "NORTHERN VIRGINIA BADMINTON CLUB": "NVBC",
    "CAPITAL BADMINTON": "CBA",
    "JOHNS HOPKINS": "JHU",
    "VIRGINIA TECH": "VT",
    "UNIVERSITY OF VIRGINIA": "UVA"
};

function getSearchVariants(term) {
    if (!term) return [];
    const lower = term.toLowerCase();
    const upper = term.toUpperCase();
    const variants = [lower];

    if (BADMINTON_SYNONYMS[upper]) {
        variants.push(BADMINTON_SYNONYMS[upper].toLowerCase());
    }
    if (REVERSE_SYNONYMS[upper]) {
        variants.push(REVERSE_SYNONYMS[upper].toLowerCase());
    }
    return variants;
}

function getTournamentStatus(tournament) {
    if (tournament.status === 'sold_out') {
        return { label: 'Sold Out', bgcolor: '#d32f2f', color: '#ffffff' };
    }
    const now = new Date();
    if (tournament.registrationDeadline) {
        const deadline = new Date(tournament.registrationDeadline);
        if (deadline < now) {
            return { label: 'Registration Closed', bgcolor: '#616161', color: '#ffffff' };
        }
        const diffMs = deadline.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) {
            return { label: 'Closing Soon', bgcolor: '#ed6c02', color: '#ffffff' };
        }
    }
    if (tournament.startDate && new Date(tournament.startDate) < now) {
        return { label: 'Completed', bgcolor: '#757575', color: '#ffffff' };
    }
    if (tournament.registrationUrl) {
        return { label: 'Registration Open', bgcolor: '#008744', color: '#ffffff' };
    }
    return { label: 'Schedule TBD', bgcolor: '#455a64', color: '#ffffff' };
}

function getTournamentBadges(tournament) {
    const badges = [];
    const seen = new Set();

    // 1. Division badges (MS, WS, MD, WD, XD, Flights)
    if (Array.isArray(tournament.divisions)) {
        for (const div of tournament.divisions) {
            let raw = '';
            if (typeof div === 'string') {
                raw = div.trim();
            } else if (div && typeof div === 'object') {
                raw = div.code || div.name || '';
            }
            if (!raw) continue;
            const upper = raw.toUpperCase();

            let label = raw;
            if (upper.includes('MS_') || upper === 'MSO' || upper === 'MS' || upper === "MEN'S SINGLES") label = 'MS';
            else if (upper.includes('WS_') || upper === 'WSO' || upper === 'WS' || upper === "WOMEN'S SINGLES") label = 'WS';
            else if (upper.includes('MD_') || upper === 'MDO' || upper === 'MD' || upper === "MEN'S DOUBLES") label = 'MD';
            else if (upper.includes('WD_') || upper === 'WDO' || upper === 'WD' || upper === "WOMEN'S DOUBLES") label = 'WD';
            else if (upper.includes('XD_') || upper === 'XDO' || upper === 'XD' || upper === "MIXED DOUBLES") label = 'XD';
            else if (upper.includes('FLIGHT_A') || upper === 'FLIGHT A') label = 'Flight A';
            else if (upper.includes('FLIGHT_B') || upper === 'FLIGHT B') label = 'Flight B';
            else if (upper.includes('FLIGHT_C') || upper === 'FLIGHT C') label = 'Flight C';
            else if (upper.includes('TEAM')) label = 'Team';

            if (label && !seen.has(label.toUpperCase())) {
                seen.add(label.toUpperCase());
                badges.push({ label, type: label.startsWith('Flight') ? 'flight' : 'division' });
            }
        }
    }

    // 2. Flight or skill badges from skillLevels
    if (Array.isArray(tournament.skillLevels)) {
        for (const skill of tournament.skillLevels) {
            if (typeof skill === 'string' && skill.trim()) {
                const trimmed = skill.trim();
                const upper = trimmed.toUpperCase();
                if (!seen.has(upper)) {
                    seen.add(upper);
                    const isFlight = upper.startsWith('FLIGHT');
                    badges.push({ label: trimmed, type: isFlight ? 'flight' : 'skill' });
                }
            }
        }
    }

    return badges;
}

// Custom Grid components for VirtuosoGrid
const VirtualGridList = forwardRef(({ style, children, className, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className={className}
        style={{
            ...style,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
            paddingBottom: '32px'
        }}
    >
        {children}
    </div>
));
VirtualGridList.displayName = 'VirtualGridList';

const VirtualGridItem = forwardRef(({ children, className, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className={className}
        style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}
    >
        {children}
    </div>
));
VirtualGridItem.displayName = 'VirtualGridItem';

export default function Tournaments() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rsvpLoading, setRsvpLoading] = useState({});

    // Admin delete state
    const [deleteConfirmTournament, setDeleteConfirmTournament] = useState(null); // tournament object awaiting deletion
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [submitDiscoveryOpen, setSubmitDiscoveryOpen] = useState(false);
    const [submittingDiscovery, setSubmittingDiscovery] = useState(false);
    const [discoveryForm, setDiscoveryForm] = useState({
        tournamentName: '',
        eventLocation: '',
        startDate: '',
        registrationUrl: '',
        flyerImageUrl: '',
        originalCaption: ''
    });

    // View state
    const [viewMode, setViewMode] = useState(searchParams.get('view') || 'list'); // 'list' | 'calendar'
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Filter states from URL params and instant search input
    const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = useRef(null);
    const searchQuery = searchParams.get('q') || '';
    const filterUpcoming = searchParams.get('upcoming') !== 'false'; // default true
    const filterWeekend = searchParams.get('weekend') === 'true';
    const selectedSkills = useMemo(() => {
        const skills = searchParams.get('skills');
        return skills ? skills.split(',').filter(Boolean) : [];
    }, [searchParams]);

    // Keyboard navigation: Press '/' or 'Cmd+K' / 'Ctrl+K' to quickly focus search
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (
                (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') ||
                ((e.metaKey || e.ctrlKey) && e.key === 'k')
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Calendar state
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

    // Update URL helper
    const updateFilters = useCallback((updates) => {
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
    }, [searchParams, setSearchParams]);

    // Debounce server query and URL updates by 250ms on searchInput change
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentQ = searchParams.get('q') || '';
            if (searchInput !== currentQ) {
                updateFilters({ q: searchInput });
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput, searchParams, updateFilters]);

    // Sync input if searchParams change externally (e.g. back/forward navigation or reset)
    const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
    if (searchQuery !== prevSearchQuery) {
        setPrevSearchQuery(searchQuery);
        setSearchInput(searchQuery);
    }

    // Fetch tournaments from Express API
    const fetchTournaments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParts = [];
            if (searchQuery) queryParts.push(`search=${encodeURIComponent(searchQuery)}`);
            if (filterUpcoming) queryParts.push('upcoming=true');
            if (filterWeekend) queryParts.push('weekend=true');
            if (selectedSkills.length > 0) queryParts.push(`skills=${encodeURIComponent(selectedSkills.join(','))}`);

            const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
            const res = await apiFetch(`/api/tournaments${queryString}`);
            if (res && res.tournaments && !res.json) {
                // Test mock fallback support
                setTournaments(res.tournaments);
                return;
            }
            if (!res.ok) {
                if (res.status === 0) {
                    throw new Error("Unable to reach tournaments service. The server may be waking up, please click Retry in a few seconds.");
                }
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

    const handleClearFilters = () => {
        setSearchInput('');
        setSearchParams(new URLSearchParams({ upcoming: 'true' }), { replace: true });
    };

    // Instant in-memory client-side filtering on keystrokes across tournamentName, hostUniversity, eventLocation, divisions, and skillLevels (< 5ms)
    const matchesSearch = useCallback((t, term) => {
        if (!term) return true;
        const variants = getSearchVariants(term);
        return variants.some((v) => {
            if (t.tournamentName && t.tournamentName.toLowerCase().includes(v)) return true;
            if (t.hostUniversity && t.hostUniversity.toLowerCase().includes(v)) return true;
            if (t.hostClubHandle && t.hostClubHandle.toLowerCase().includes(v)) return true;
            if (t.eventLocation && t.eventLocation.toLowerCase().includes(v)) return true;
            if (t.originalCaption && t.originalCaption.toLowerCase().includes(v)) return true;
            if (Array.isArray(t.divisions)) {
                for (const d of t.divisions) {
                    if (typeof d === 'string' && d.toLowerCase().includes(v)) return true;
                    if (d && typeof d === 'object') {
                        if (d.name && d.name.toLowerCase().includes(v)) return true;
                        if (d.code && d.code.toLowerCase().includes(v)) return true;
                        if (d.category && d.category.toLowerCase().includes(v)) return true;
                    }
                }
            }
            if (Array.isArray(t.skillLevels)) {
                for (const s of t.skillLevels) {
                    if (typeof s === 'string' && s.toLowerCase().includes(v)) return true;
                }
            }
            return false;
        });
    }, []);

    const filteredTournaments = useMemo(() => {
        const query = searchInput.trim();
        if (!query) return tournaments;
        const upperQuery = query.toUpperCase();
        const reverseAcronym = REVERSE_SYNONYMS[upperQuery];

        const tokens = query.split(/\s+/).filter(Boolean);
        return tournaments.filter(t => {
            if (reverseAcronym && matchesSearch(t, reverseAcronym)) {
                return true;
            }
            return tokens.every(token => matchesSearch(t, token));
        });
    }, [tournaments, searchInput, matchesSearch]);

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

    // Admin: permanently delete a tournament
    const handleAdminDelete = async () => {
        if (!deleteConfirmTournament) return;
        if (!user || user.role !== 'admin') {
            toast.error('Only administrators can delete tournaments.');
            setDeleteConfirmTournament(null);
            return;
        }
        const tId = deleteConfirmTournament._id || deleteConfirmTournament.id;
        setDeleteLoading(true);
        try {
            const res = await apiFetch(`/api/tournaments/${tId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Delete failed');
            toast.success(`"${deleteConfirmTournament.tournamentName}" deleted.`);
            setTournaments(prev => prev.filter(t => (t._id || t.id) !== tId));
            if (selectedTournament && (selectedTournament._id || selectedTournament.id) === tId) {
                setSelectedTournament(null);
            }
        } catch (err) {
            toast.error(err.message || 'Could not delete tournament.');
        } finally {
            setDeleteLoading(false);
            setDeleteConfirmTournament(null);
        }
    };

    // Refresh tournaments list
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchTournaments();
            toast.success("Tournaments refreshed!");
        } catch {
            toast.error("Failed to refresh tournaments");
        } finally {
            setRefreshing(false);
        }
    };

    // Clear invalid tournaments and reset to verified schedule
    const handleClearAndReset = async () => {
        setClearing(true);
        try {
            const res = await apiFetch("/api/tournaments/reset-seed", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || "Failed to reset tournaments");
            toast.success(data.message || "Published tournaments cleared and reset to verified schedule!");
            setClearDialogOpen(false);
            await fetchTournaments();
        } catch (err) {
            toast.error(err.message || "Error resetting tournaments");
        } finally {
            setClearing(false);
        }
    };

    // Open discovery submission dialog
    const handleOpenSubmitDiscovery = () => {
        if (!user) {
            toast.error("Please sign in to submit a tournament discovery!");
            return;
        }
        setDiscoveryForm({
            tournamentName: '',
            eventLocation: '',
            startDate: '',
            registrationUrl: '',
            flyerImageUrl: '',
            originalCaption: ''
        });
        setSubmitDiscoveryOpen(true);
    };

    // Submit crowdsourced tournament discovery
    const handleSubmitDiscovery = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!discoveryForm.tournamentName.trim()) {
            toast.error("Tournament name is required.");
            return;
        }
        setSubmittingDiscovery(true);
        try {
            const res = await apiFetch("/api/scrape/submit-pending", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(discoveryForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to submit discovery");
            toast.success(data.message || "Tournament submitted for admin approval!");
            setSubmitDiscoveryOpen(false);
        } catch (err) {
            toast.error(err.message || "Could not submit tournament discovery.");
        } finally {
            setSubmittingDiscovery(false);
        }
    };

    // Active filters count

    const activeFilterCount = (searchInput ? 1 : 0) + 
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
        filteredTournaments.forEach(t => {
            if (!t.startDate) return;
            const d = new Date(t.startDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!map[key]) map[key] = [];
            map[key].push(t);
        });
        return map;
    }, [filteredTournaments]);

    // Tournaments for the selected calendar date
    const calendarSelectedTournaments = useMemo(() => {
        if (!calendarSelectedDate) return [];
        return tournamentsByDate[calendarSelectedDate] || [];
    }, [calendarSelectedDate, tournamentsByDate]);

    return (
        <Box sx={{ maxWidth: 1240, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
            {/* Clean, Modern Header Modeled after Community Directory & Premier Event Hubs */}
            <Box sx={{ mb: 3.5, mt: { xs: 1, sm: 2 } }}>
                <Typography variant="h3" sx={{ mb: 1, fontWeight: 900, letterSpacing: '-0.5px' }}>
                    Discover DMV Tournaments
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, maxWidth: 840, lineHeight: 1.6 }}>
                    Find upcoming badminton tournaments, open invitationals, and local competitions. Open to all players, clubs, and skill levels.
                </Typography>
            </Box>

            {/* Controls Bar: Search, View Switcher & Filter Toggle */}
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 2, 
                    mb: 3, 
                    borderRadius: 3, 
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 2, 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    bgcolor: 'background.paper',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                }}
            >
                {/* Search Field with Instant Keyboard Shortcut ('/' or Cmd+K) */}
                <TextField 
                    inputRef={searchInputRef}
                    placeholder="Search tournaments, clubs, venues..."
                    size="small"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    sx={{ 
                        flex: { xs: '1 1 100%', sm: '1 1 340px' },
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2.5,
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                            },
                            '&.Mui-focused': {
                                boxShadow: '0 4px 12px rgba(0, 80, 40, 0.12)'
                            }
                        }
                    }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color={isSearchFocused ? "primary" : "action"} />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end" sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                                    {!isSearchFocused && !searchInput && (
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                bgcolor: 'action.hover', 
                                                px: 0.9, 
                                                py: 0.4, 
                                                borderRadius: 1, 
                                                color: 'text.secondary', 
                                                fontWeight: 'bold', 
                                                fontSize: '0.75rem',
                                                display: { xs: 'none', sm: 'block' }, 
                                                pointerEvents: 'none' 
                                            }}
                                        >
                                            /
                                        </Typography>
                                    )}
                                    {searchInput && (
                                        <IconButton size="small" onClick={() => { setSearchInput(''); updateFilters({ q: '' }); searchInputRef.current?.focus(); }} aria-label="Clear search">
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </InputAdornment>
                            )
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
                        sx={{
                            borderRadius: 2.5,
                            '& .MuiToggleButton-root': {
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 1.75,
                                transition: 'all 0.2s ease-in-out'
                            }
                        }}
                    >
                        <ToggleButton value="list" aria-label="List View">
                            <ViewListIcon sx={{ mr: 0.5, fontSize: 19 }} /> List
                        </ToggleButton>
                        <ToggleButton value="calendar" aria-label="Calendar View">
                            <CalendarMonthIcon sx={{ mr: 0.5, fontSize: 19 }} /> Calendar
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Badge badgeContent={activeFilterCount} color="secondary">
                        <Button 
                            variant="outlined" 
                            size="medium"
                            startIcon={<FilterListIcon />} 
                            onClick={() => setFiltersOpen(true)}
                            sx={{ 
                                borderRadius: 2.5, 
                                fontWeight: 600, 
                                textTransform: 'none',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.06)'
                                }
                            }}
                        >
                            Filters
                        </Button>
                    </Badge>

                    {/* Refresh Button */}
                    <Tooltip title="Refresh published tournaments">
                        <Button
                            variant="outlined"
                            size="medium"
                            aria-label="Refresh Tournaments"
                            startIcon={refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            sx={{ 
                                borderRadius: 2.5, 
                                fontWeight: 600, 
                                textTransform: 'none',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.06)'
                                }
                            }}
                        >
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </Button>
                    </Tooltip>

                    {/* Clear & Reset Button */}
                    <Tooltip title="Clear invalid tournaments and reset verified schedule">
                        <Button
                            variant="outlined"
                            color="error"
                            size="medium"
                            aria-label="Clear & Reset"
                            startIcon={clearing ? <CircularProgress size={18} color="inherit" /> : <RestartAltIcon />}
                            onClick={() => setClearDialogOpen(true)}
                            disabled={clearing || loading}
                            sx={{ 
                                borderRadius: 2.5, 
                                fontWeight: 600, 
                                textTransform: 'none',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 3px 10px rgba(211, 47, 47, 0.12)'
                                }
                            }}
                        >
                            {clearing ? "Resetting..." : "Clear & Reset"}
                        </Button>
                    </Tooltip>

                    {/* Submit Discovery Button */}
                    <Button
                        variant="contained"
                        size="medium"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenSubmitDiscovery}
                        sx={{ 
                            borderRadius: 2.5, 
                            fontWeight: 700, 
                            textTransform: 'none',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 14px rgba(0, 80, 40, 0.25)'
                            }
                        }}
                    >
                        Submit Discovery
                    </Button>
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
            {loading && tournaments.length === 0 && (
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
            {!error && !(loading && tournaments.length === 0) && filteredTournaments.length === 0 && (
                <EmptyTournaments onResetFilters={handleClearFilters} onSubmitDiscovery={handleOpenSubmitDiscovery} />
            )}

            {/* VIEW MODE 1: LIST / VIRTUALIZED CARD GRID */}
            {!error && !(loading && tournaments.length === 0) && viewMode === 'list' && filteredTournaments.length > 0 && (
                <VirtuosoGrid
                    useWindowScroll
                    data={filteredTournaments}
                    totalCount={filteredTournaments.length}
                    initialItemCount={Math.min(filteredTournaments.length, 12)}
                    overscan={300}
                    components={{
                        List: VirtualGridList,
                        Item: VirtualGridItem
                    }}
                    itemContent={(index, tournament) => {
                        if (!tournament) return null;
                        const tId = tournament._id || tournament.id;
                        const attending = isUserAttending(tournament);
                        const attendeesList = tournament.attendees || [];
                        const isSoldOut = tournament.status === 'sold_out';
                        const statusInfo = getTournamentStatus(tournament);
                        const badges = getTournamentBadges(tournament);
                        const visibleBadges = badges.slice(0, 4);
                        const extraBadgeCount = badges.length - visibleBadges.length;

                        return (
                            <Card 
                                data-testid={`tournament-card-${tId}`}
                                sx={{ 
                                    height: '100%', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    borderRadius: 3.5, 
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    overflow: 'hidden',
                                    transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.22s',
                                    '&:hover': {
                                        transform: 'translateY(-5px)',
                                        boxShadow: '0 16px 32px rgba(0, 102, 51, 0.12)',
                                        borderColor: 'primary.light',
                                        '& .tournament-title': {
                                            color: 'primary.main',
                                        }
                                    }
                                }}
                                onClick={() => setSelectedTournament(tournament)}
                            >
                                {/* Flyer Container with Status Chips & Elevation */}
                                <Box sx={{ position: 'relative' }}>
                                    <LazyFlyerImage
                                        src={tournament.flyerImageUrl || tournament.bannerUrl}
                                        alt={`${tournament.tournamentName} flyer`}
                                        fallbackHost={tournament.hostUniversity || tournament.hostClubHandle || 'DMV Badminton'}
                                        isSoldOut={isSoldOut}
                                        height={185}
                                    />
                                    {/* Prominent Status Chip on Flyer */}
                                    <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1, display: 'flex', gap: 1 }}>
                                        <Chip 
                                            label={statusInfo.label} 
                                            size="small" 
                                            sx={{ 
                                                fontWeight: 800, 
                                                fontSize: '0.72rem', 
                                                letterSpacing: 0.4,
                                                bgcolor: statusInfo.bgcolor,
                                                color: statusInfo.color,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                                textTransform: 'uppercase'
                                            }} 
                                        />
                                    </Box>
                                </Box>

                                <CardContent sx={{ flexGrow: 1, p: 2.5, pb: 1 }}>
                                    {/* Host Club / University Tag + Admin Delete */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: 'primary.main', fontSize: '0.75rem' }}>
                                            {tournament.hostUniversity || tournament.hostClubHandle || 'Open Tournament'}
                                        </Typography>
                                        {user?.role === 'admin' && (
                                            <Tooltip title="Admin: Delete this tournament">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmTournament(tournament); }}
                                                    aria-label={`Delete tournament ${tournament.tournamentName}`}
                                                    sx={{ 
                                                        ml: 1, 
                                                        opacity: 0.85, 
                                                        '&:hover': { opacity: 1, bgcolor: 'error.main', color: '#fff' } 
                                                    }}
                                                >
                                                    <DeleteForeverIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>

                                    {/* Tournament Title */}
                                    <Typography 
                                        className="tournament-title"
                                        variant="h6" 
                                        fontWeight="bold" 
                                        gutterBottom 
                                        sx={{ 
                                            lineHeight: 1.3, 
                                            mt: 0.5, 
                                            fontSize: '1.15rem',
                                            transition: 'color 0.2s ease-in-out'
                                        }}
                                    >
                                        {tournament.tournamentName}
                                    </Typography>

                                    {/* Prominent Date and Venue Badges */}
                                    <Stack spacing={0.9} sx={{ my: 1.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', px: 1.25, py: 0.6, borderRadius: 1.5 }}>
                                            <EventIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                            <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                                {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('en-US', {
                                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                                }) : 'Date TBD'}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', px: 1.25, py: 0.6, borderRadius: 1.5 }}>
                                            <MapPinIcon width={16} height={16} />
                                            <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                {tournament.eventLocation || 'Location TBD'}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    {/* Clean Division/Flight Chips and Fee */}
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1, alignItems: 'center' }}>
                                        {tournament.entryFee && (
                                            <Chip label={`Fee: ${tournament.entryFee}`} size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(0, 102, 51, 0.08)', color: 'primary.dark' }} />
                                        )}
                                        {visibleBadges.map((badge, idx) => {
                                            if (badge.type === 'flight') {
                                                return (
                                                    <Chip 
                                                        key={idx} 
                                                        label={badge.label} 
                                                        size="small" 
                                                        sx={{ 
                                                            fontWeight: 700, 
                                                            fontSize: '0.72rem',
                                                            bgcolor: 'rgba(255, 204, 51, 0.18)', 
                                                            color: '#7a5a00',
                                                            border: '1px solid rgba(255, 204, 51, 0.45)' 
                                                        }} 
                                                    />
                                                );
                                            }
                                            if (badge.type === 'division') {
                                                return (
                                                    <Chip 
                                                        key={idx} 
                                                        label={badge.label} 
                                                        size="small" 
                                                        variant="outlined" 
                                                        color="primary" 
                                                        sx={{ fontWeight: 700, fontSize: '0.72rem' }} 
                                                    />
                                                );
                                            }
                                            return (
                                                <Chip 
                                                    key={idx} 
                                                    label={badge.label} 
                                                    size="small" 
                                                    variant="outlined" 
                                                    sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary', borderColor: 'divider' }} 
                                                />
                                            );
                                        })}
                                        {extraBadgeCount > 0 && (
                                            <Tooltip title={badges.slice(4).map(b => b.label).join(', ')}>
                                                <Chip 
                                                    label={`+${extraBadgeCount} more`} 
                                                    size="small" 
                                                    variant="outlined" 
                                                    sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary' }} 
                                                />
                                            </Tooltip>
                                        )}
                                    </Box>
                                </CardContent>

                                {/* Action Bar: RSVP, View Details & Outbound Register Call-To-Action */}
                                <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                                    {tournament.linkStatus === 'expired' && (
                                        <Box sx={{ width: '100%', mb: 0.5 }}>
                                            <Chip 
                                                icon={<WarningAmberIcon sx={{ fontSize: '1rem !important' }} />} 
                                                label="Link Expired / Host Fallback" 
                                                color="warning" 
                                                size="small" 
                                                sx={{ fontWeight: 700, fontSize: '0.72rem', height: 22 }} 
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                                        <Button
                                            variant="outlined"
                                            color="inherit"
                                            size="medium"
                                            onClick={(e) => { e.stopPropagation(); setSelectedTournament(tournament); }}
                                            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', borderColor: 'divider', px: 1.5, whiteSpace: 'nowrap' }}
                                        >
                                            View Details
                                        </Button>

                                        {tournament.linkStatus === 'expired' ? (
                                            <Tooltip title="Original registration link is expired. Redirecting to verified host club homepage.">
                                                <Button 
                                                    variant="contained" 
                                                    color="warning"
                                                    fullWidth
                                                    size="medium"
                                                    onClick={(e) => e.stopPropagation()}
                                                    href={tournament.fallbackRegistrationUrl || tournament.sourceUrl || tournament.registrationUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<LaunchIcon sx={{ fontSize: 16 }} />}
                                                    sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                                                >
                                                    Visit Host Club
                                                </Button>
                                            </Tooltip>
                                        ) : tournament.registrationUrl ? (
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
                                                Register
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
                        );
                    }}
                />
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
                disableRestoreFocus
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {user?.role === 'admin' && (
                                    <Tooltip title="Admin: Delete this tournament">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirmTournament(selectedTournament);
                                            }}
                                            aria-label={`Delete tournament ${selectedTournament.tournamentName}`}
                                            sx={{
                                                opacity: 0.85,
                                                '&:hover': { opacity: 1, bgcolor: 'error.main', color: '#fff' }
                                            }}
                                        >
                                            <DeleteForeverIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                <IconButton onClick={() => setSelectedTournament(null)} aria-label="Close dialog">
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                        </DialogTitle>

                        <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
                            <Grid container spacing={3}>
                                {/* Flyer preview image */}
                                <Grid size={{ xs: 12, md: 5 }}>
                                    <LazyFlyerImage
                                        src={selectedTournament.flyerImageUrl || selectedTournament.bannerUrl}
                                        alt={`${selectedTournament.tournamentName} flyer`}
                                        fallbackHost={selectedTournament.hostUniversity || selectedTournament.hostClubHandle || 'DMV Badminton'}
                                        height={240}
                                        sx={{ borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                                    />
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

                                        {/* Offered Divisions & Flights */}
                                        {Array.isArray(selectedTournament.divisions) && selectedTournament.divisions.length > 0 && (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Offered Divisions & Flights:</Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                                    {selectedTournament.divisions.map((div, idx) => {
                                                        const name = typeof div === 'string' ? div : (div.name || div.code || 'Division');
                                                        const fee = typeof div === 'object' && div.fee ? ` • ${div.fee}` : '';
                                                        return (
                                                            <Chip 
                                                                key={idx} 
                                                                label={`${name}${fee}`} 
                                                                size="small" 
                                                                variant="outlined" 
                                                                color="primary" 
                                                                sx={{ fontWeight: 600 }} 
                                                            />
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Skill Levels */}
                                        {Array.isArray(selectedTournament.skillLevels) && selectedTournament.skillLevels.length > 0 && (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Skill Levels:</Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {selectedTournament.skillLevels.map((skill, idx) => (
                                                        <Chip key={idx} label={skill} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

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
                                        {selectedTournament.linkStatus === 'expired' && (
                                            <Box sx={{ pt: 1 }}>
                                                <Chip 
                                                    icon={<WarningAmberIcon />} 
                                                    label="Link Expired / Host Fallback" 
                                                    color="warning" 
                                                    size="small" 
                                                    sx={{ fontWeight: 700 }} 
                                                />
                                            </Box>
                                        )}
                                        <Stack direction="row" spacing={1.5} sx={{ pt: 1.5 }}>
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
                                                    color={selectedTournament.linkStatus === 'expired' ? "warning" : "primary"}
                                                    href={selectedTournament.linkStatus === 'expired' ? (selectedTournament.fallbackRegistrationUrl || selectedTournament.sourceUrl || selectedTournament.registrationUrl) : selectedTournament.registrationUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    endIcon={<LaunchIcon />}
                                                    startIcon={selectedTournament.linkStatus === 'expired' ? <WarningAmberIcon /> : null}
                                                    sx={{ flex: 1.5, fontWeight: 700, borderRadius: 2 }}
                                                >
                                                    {selectedTournament.linkStatus === 'expired' ? "Visit Host Club" : "Register"}
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
            <Drawer anchor="right" open={filtersOpen} onClose={() => setFiltersOpen(false)} ModalProps={{ disableRestoreFocus: true }}>
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
            {/* Admin Delete Confirmation Dialog */}

            <Dialog
                open={Boolean(deleteConfirmTournament) && user?.role === 'admin'}
                onClose={() => !deleteLoading && setDeleteConfirmTournament(null)}
                maxWidth="xs"
                fullWidth
                disableRestoreFocus
            >
                <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteForeverIcon /> Delete Tournament?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to permanently delete{' '}
                        <strong>"{deleteConfirmTournament?.tournamentName}"</strong>?
                        {' '}This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button
                        onClick={() => setDeleteConfirmTournament(null)}
                        disabled={deleteLoading}
                        variant="outlined"
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdminDelete}
                        disabled={deleteLoading}
                        variant="contained"
                        color="error"
                        startIcon={<DeleteForeverIcon />}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                        {deleteLoading ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Clear & Reset Confirmation Dialog */}
            <Dialog
                open={clearDialogOpen}
                onClose={() => !clearing && setClearDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                disableRestoreFocus
            >
                <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RestartAltIcon /> Reset Tournament Schedule?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will purge invalid or stale tournament entries and reload the verified 2026–2027 collegiate tournament schedule.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button
                        onClick={() => setClearDialogOpen(false)}
                        disabled={clearing}
                        variant="outlined"
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleClearAndReset}
                        disabled={clearing}
                        variant="contained"
                        color="error"
                        startIcon={clearing ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                        {clearing ? 'Resetting…' : 'Reset Now'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* User Submit Tournament Discovery Dialog */}
            <Dialog
                open={submitDiscoveryOpen}
                onClose={() => !submittingDiscovery && setSubmitDiscoveryOpen(false)}
                maxWidth="sm"
                fullWidth
                disableRestoreFocus
            >
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmojiEventsIcon color="primary" />
                        <span>Submit Tournament Discovery</span>
                    </Box>
                    <IconButton size="small" onClick={() => setSubmitDiscoveryOpen(false)} disabled={submittingDiscovery}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={handleSubmitDiscovery}>
                    <DialogContent dividers sx={{ p: 3 }}>
                        <DialogContentText sx={{ mb: 2 }}>
                            Discovered an upcoming collegiate or DMV badminton tournament? Submit it below! Our team and automated verification engine will review and publish it to the directory.
                        </DialogContentText>
                        <Stack spacing={2}>
                            <TextField
                                label="Tournament Name"
                                required
                                fullWidth
                                size="small"
                                value={discoveryForm.tournamentName}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, tournamentName: e.target.value }))}
                                placeholder="e.g. 2026 GMU Spring Invitational"
                            />
                            <TextField
                                label="Event Location / Venue"
                                fullWidth
                                size="small"
                                value={discoveryForm.eventLocation}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, eventLocation: e.target.value }))}
                                placeholder="e.g. RAC Gym, Fairfax, VA"
                            />
                            <TextField
                                label="Start Date"
                                type="date"
                                fullWidth
                                size="small"
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={discoveryForm.startDate}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                            <TextField
                                label="Registration Link / TournamentSoftware URL"
                                fullWidth
                                size="small"
                                value={discoveryForm.registrationUrl}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, registrationUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                            <TextField
                                label="Flyer Image URL"
                                fullWidth
                                size="small"
                                value={discoveryForm.flyerImageUrl}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, flyerImageUrl: e.target.value }))}
                                placeholder="https://..."
                            />
                            <TextField
                                label="Notes / Divisions / Caption"
                                fullWidth
                                multiline
                                rows={3}
                                size="small"
                                value={discoveryForm.originalCaption}
                                onChange={(e) => setDiscoveryForm(prev => ({ ...prev, originalCaption: e.target.value }))}
                                placeholder="Details about divisions (MS, MD, XD), flight levels, fees, eligibility..."
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button 
                            onClick={() => setSubmitDiscoveryOpen(false)} 
                            disabled={submittingDiscovery}
                            variant="outlined"
                            sx={{ borderRadius: 2 }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            color="primary"
                            disabled={submittingDiscovery || !discoveryForm.tournamentName.trim()}
                            startIcon={submittingDiscovery ? <CircularProgress size={16} color="inherit" /> : null}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            {submittingDiscovery ? 'Submitting…' : 'Submit Discovery'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
}
