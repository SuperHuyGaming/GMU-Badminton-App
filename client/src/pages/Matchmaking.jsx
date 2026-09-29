import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Card, CardContent, Alert, Grid, Avatar, Button, Chip, Stack, TextField, InputAdornment, Skeleton, Badge, Divider, IconButton, Paper, List, ListItem, ListItemAvatar, ListItemText, ListItemButton, ClickAwayListener } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dropdownLoading, setDropdownLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [skillFilter, setSkillFilter] = useState('All');
    const [recentSearches, setRecentSearches] = useState(() => {
        const saved = localStorage.getItem('matchmaking_recent_searches');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                console.error("Failed to parse recent searches");
            }
        }
        return [];
    });
    
    // Dropdown state
    const [isFocused, setIsFocused] = useState(false);
    const [dropdownResults, setDropdownResults] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const searchContainerRef = useRef(null);

    const skillLevels = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    const saveRecentSearch = (query) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const updated = [trimmed, ...prev.filter(q => q !== trimmed)].slice(0, 5);
            localStorage.setItem('matchmaking_recent_searches', JSON.stringify(updated));
            return updated;
        });
    };

    const removeRecentSearch = (e, queryToRemove) => {
        e.stopPropagation();
        setRecentSearches(prev => {
            const updated = prev.filter(q => q !== queryToRemove);
            localStorage.setItem('matchmaking_recent_searches', JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        const fetchMainData = async () => {
            setLoading(true);
            try {
                let url = '/api/matchmaking/discover?';
                if (searchQuery && !isFocused) url += `search=${encodeURIComponent(searchQuery)}&`;
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
        fetchMainData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skillFilter]); // Only run on skillFilter change or manual submit

    useEffect(() => {
        if (!searchQuery.trim()) {
            return;
        }

        const fetchDropdown = async () => {
            setDropdownLoading(true);
            try {
                const response = await apiFetch(`/api/matchmaking/discover?search=${encodeURIComponent(searchQuery)}`);
                const data = await response.json();
                setDropdownResults(data.matches || []);
                setSelectedIndex(-1);
            } catch (err) {
                console.error('Failed to fetch dropdown results', err);
            } finally {
                setDropdownLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchDropdown, 250);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleSearchSubmit = (query) => {
        const q = typeof query === 'string' ? query : searchQuery;
        saveRecentSearch(q);
        setIsFocused(false);
        setSearchQuery(q);
        
        // Trigger main fetch
        const fetchMain = async () => {
            setLoading(true);
            try {
                let url = `/api/matchmaking/discover?search=${encodeURIComponent(q)}&`;
                if (skillFilter !== 'All') url += `skill=${encodeURIComponent(skillFilter)}&`;
                const response = await apiFetch(url);
                const data = await response.json();
                setMatches(data.matches || []);
            } catch (err) {
                setError(err.message || 'Failed to search');
            } finally {
                setLoading(false);
            }
        };
        fetchMain();
    };

    const handleKeyDown = (e) => {
        if (!isFocused) return;

        const maxIndex = searchQuery.trim() 
            ? dropdownResults.length - 1 
            : recentSearches.length + Math.min(3, recommended.length) - 1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                if (searchQuery.trim()) {
                    const selectedPlayer = dropdownResults[selectedIndex];
                    if (selectedPlayer) navigate(`/profile/${selectedPlayer._id}`);
                } else {
                    if (selectedIndex < recentSearches.length) {
                        handleSearchSubmit(recentSearches[selectedIndex]);
                    } else {
                        const recPlayer = recommended[selectedIndex - recentSearches.length];
                        if (recPlayer) navigate(`/profile/${recPlayer._id}`);
                    }
                }
            } else {
                handleSearchSubmit(searchQuery);
            }
        } else if (e.key === 'Escape') {
            setIsFocused(false);
        }
    };

    const isRecentlyActive = (lastActiveDate) => {
        if (!lastActiveDate) return false;
        const diff = new Date() - new Date(lastActiveDate);
        return diff < 24 * 60 * 60 * 1000;
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
                            </Stack>
                        </Box>
                        <Skeleton variant="text" width="70%" height={28} animation="wave" sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="85%" height={20} animation="wave" sx={{ mb: 1.5 }} />
                        <Skeleton variant="rounded" width="100%" height={36} animation="wave" sx={{ mt: 'auto', borderRadius: 2 }} />
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
                    <Link to={`/profile/${player._id}`} style={{ textDecoration: 'none' }}>
                        <Avatar 
                            src={player.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${player.name}`} 
                            sx={{ width: 72, height: 72, bgcolor: 'secondary.main', color: 'secondary.contrastText', '&:hover': { opacity: 0.8 } }}
                         alt={player.name} />
                    </Link>
                </Badge>
                <Stack direction="column" spacing={1} alignItems="flex-end">
                    {player.skillLevel && <Chip label={player.skillLevel} size="small" color="primary" sx={{ fontWeight: 600, borderRadius: 1.5 }} />}
                    {player.preferredPlay && <Chip label={player.preferredPlay} size="small" variant="outlined" sx={{ fontWeight: 500, borderRadius: 1.5 }} />}
                </Stack>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: 0, width: '100%' }}>
                <Link to={`/profile/${player._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.2, mb: 1, color: 'text.primary', wordBreak: 'break-word', '&:hover': { textDecoration: 'underline' } }}>
                        {player.name}
                    </Typography>
                </Link>
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
            <Box sx={{ display: 'flex', width: '100%', mt: 'auto', pt: 2 }}>
                <Button variant="contained" color="primary" fullWidth sx={{ borderRadius: 2, fontWeight: 'bold', textTransform: 'none' }} onClick={() => alert(`Adding ${player.name} as friend...`)} startIcon={<PersonAddIcon />}>
                    Add Friend
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

            <ClickAwayListener onClickAway={() => setIsFocused(false)}>
                <Box ref={searchContainerRef} sx={{ position: 'relative', mb: 3, zIndex: 10 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Search by name or university..."
                        autoComplete="off"
                        name="dummy-search-prevent-autofill"
                        aria-label="Search players"
                        inputProps={{ 
                            'aria-label': 'Search players',
                            autoComplete: 'off',
                            form: { autoComplete: 'off' }
                        }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onKeyDown={handleKeyDown}
                        sx={{ 
                            bgcolor: 'background.paper', 
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 50,
                                transition: 'box-shadow 0.2s',
                                boxShadow: isFocused ? (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.1)' : 'none',
                                '& fieldset': {
                                    borderColor: isFocused ? 'primary.main' : 'divider',
                                }
                            }
                        }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon color={isFocused ? "primary" : "inherit"} /></InputAdornment>,
                        }}
                    />

                    <AnimatePresence>
                        {isFocused && (
                            <Paper 
                                component={motion.div}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                elevation={8}
                                sx={{ 
                                    position: 'absolute', 
                                    top: '100%', left: 0, right: 0, 
                                    mt: 1, 
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                    maxHeight: 400,
                                    overflowY: 'auto'
                                }}
                            >
                                <List disablePadding>
                                    {searchQuery.trim() ? (
                                        dropdownLoading ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <ListItem key={`skel-${i}`}>
                                                    <ListItemAvatar>
                                                        <Skeleton variant="circular" width={40} height={40} />
                                                    </ListItemAvatar>
                                                    <ListItemText 
                                                        primary={<Skeleton variant="text" width="60%" />} 
                                                        secondary={<Skeleton variant="text" width="40%" />} 
                                                    />
                                                </ListItem>
                                            ))
                                        ) : dropdownResults.length > 0 ? (
                                            dropdownResults.map((p, idx) => (
                                                <ListItem disablePadding key={p._id}>
                                                    <ListItemButton 
                                                        selected={selectedIndex === idx}
                                                        onClick={() => navigate(`/profile/${p._id}`)}
                                                    >
                                                        <ListItemAvatar>
                                                            <Avatar src={p.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`} alt={p.name} />
                                                        </ListItemAvatar>
                                                        <ListItemText primary={p.name} secondary={p.homeUniversity || 'Player'} />
                                                    </ListItemButton>
                                                </ListItem>
                                            ))
                                        ) : (
                                            <ListItem>
                                                <ListItemText primary="No results found." sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }} />
                                            </ListItem>
                                        )
                                    ) : (
                                        <>
                                            {recentSearches.length > 0 && (
                                                <>
                                                    <Typography variant="overline" sx={{ px: 2, pt: 2, pb: 1, display: 'block', color: 'text.secondary', fontWeight: 'bold' }}>
                                                        Recent Searches
                                                    </Typography>
                                                    {recentSearches.map((q, idx) => (
                                                        <ListItem disablePadding key={`recent-${idx}`}>
                                                            <ListItemButton 
                                                                selected={selectedIndex === idx}
                                                                onClick={() => handleSearchSubmit(q)}
                                                            >
                                                                <ListItemAvatar>
                                                                    <Avatar sx={{ bgcolor: 'transparent', color: 'text.secondary' }}>
                                                                        <HistoryIcon />
                                                                    </Avatar>
                                                                </ListItemAvatar>
                                                                <ListItemText primary={q} />
                                                                <IconButton size="small" onClick={(e) => removeRecentSearch(e, q)} aria-label={`Remove ${q} from recent searches`}>
                                                                    <CloseIcon fontSize="small" />
                                                                </IconButton>
                                                            </ListItemButton>
                                                        </ListItem>
                                                    ))}
                                                    <Divider sx={{ my: 1 }} />
                                                </>
                                            )}
                                            
                                            {recommended.length > 0 && (
                                                <>
                                                    <Typography variant="overline" sx={{ px: 2, pt: 1, pb: 1, display: 'block', color: 'text.secondary', fontWeight: 'bold' }}>
                                                        Trending Players
                                                    </Typography>
                                                    {recommended.slice(0, 3).map((p, idx) => (
                                                        <ListItem disablePadding key={`rec-${p._id}`}>
                                                            <ListItemButton 
                                                                selected={selectedIndex === recentSearches.length + idx}
                                                                onClick={() => navigate(`/profile/${p._id}`)}
                                                            >
                                                                <ListItemAvatar>
                                                                    <Avatar src={p.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`} alt={p.name} />
                                                                </ListItemAvatar>
                                                                <ListItemText primary={p.name} secondary={p.skillLevel || 'Active Recently'} />
                                                            </ListItemButton>
                                                        </ListItem>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </List>
                            </Paper>
                        )}
                    </AnimatePresence>
                </Box>
            </ClickAwayListener>

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
                    </Box>
                    {loading ? (
                        <Box sx={{ display: 'flex', gap: 2.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <Card key={idx} sx={{ minWidth: 260, maxWidth: 280, p: 2.5, borderRadius: 3, flexShrink: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                        <Skeleton variant="circular" width={72} height={72} />
                                        <Skeleton variant="rounded" width={70} height={24} />
                                    </Box>
                                    <Skeleton variant="text" width="70%" height={28} />
                                    <Skeleton variant="text" width="85%" height={20} />
                                    <Skeleton variant="rounded" width="100%" height={36} sx={{ mt: 2 }} />
                                </Card>
                            ))}
                        </Box>
                    ) : recommended.length > 0 ? (
                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            {recommended.length > 3 && (
                                <IconButton 
                                    size="small" 
                                    aria-label="Scroll left" 
                                    onClick={() => document.getElementById('carousel-scroll')?.scrollBy({ left: -300, behavior: 'smooth' })}
                                    sx={{ 
                                        position: 'absolute', 
                                        left: -16, 
                                        zIndex: 2, 
                                        bgcolor: 'background.paper', 
                                        boxShadow: 3,
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <ChevronLeftIcon />
                                </IconButton>
                            )}
                            
                            <Box 
                                id="carousel-scroll" 
                                sx={{ 
                                    display: 'flex', 
                                    gap: 2.5, 
                                    overflowX: 'auto', 
                                    scrollSnapType: 'x mandatory', 
                                    pb: 2, 
                                    px: 0.5,
                                    scrollbarWidth: 'none', // Firefox
                                    msOverflowStyle: 'none', // IE/Edge
                                    '&::-webkit-scrollbar': { display: 'none' } // Chrome/Safari
                                }}
                            >
                                {recommended.map((player, i) => (
                                    <Box key={`rec-${player._id}`} sx={{ minWidth: 260, maxWidth: 280, flexShrink: 0, scrollSnapAlign: 'start' }}>
                                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06, duration: 0.35 }}>
                                            {renderPlayerCard(player)}
                                        </motion.div>
                                    </Box>
                                ))}
                            </Box>

                            {recommended.length > 3 && (
                                <IconButton 
                                    size="small" 
                                    aria-label="Scroll right" 
                                    onClick={() => document.getElementById('carousel-scroll')?.scrollBy({ left: 300, behavior: 'smooth' })}
                                    sx={{ 
                                        position: 'absolute', 
                                        right: -16, 
                                        zIndex: 2, 
                                        bgcolor: 'background.paper', 
                                        boxShadow: 3,
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <ChevronRightIcon />
                                </IconButton>
                            )}
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
                                        <motion.div custom={i} variants={cardVariants} initial="hidden" animate="visible" exit="hidden" layout>
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
