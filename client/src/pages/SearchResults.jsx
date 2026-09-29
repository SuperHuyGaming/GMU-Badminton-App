import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
    Box, 
    Typography, 
    Grid, 
    Paper, 
    CircularProgress, 
    FormControl, 
    FormLabel, 
    FormGroup, 
    FormControlLabel, 
    Checkbox, 
    Radio, 
    RadioGroup, 
    Divider,
    Avatar,
    Button
} from '@mui/material';
import posthog from 'posthog-js';
import apiFetch from '../utils/api';
import { getOptimizedAvatar } from '../utils/image';
import { useAuth } from '../context/AuthContext';

const useQuery = () => {
    return new URLSearchParams(useLocation().search);
};

export default function SearchResults() {
    const queryParams = useQuery();
    const navigate = useNavigate();
    const { user } = useAuth();
    const searchQuery = queryParams.get('q') || '';

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [searchType, setSearchType] = useState('players');
    const [skillLevel, setSkillLevel] = useState({
        Beginner: false,
        Intermediate: false,
        Advanced: false,
    });
    const [homeUniversity, setHomeUniversity] = useState({
        GMU: false,
        VT: false,
        VCU: false,
        UVA: false
    });

    const [prevQuery, setPrevQuery] = useState(searchQuery);
    if (searchQuery !== prevQuery) {
        setPrevQuery(searchQuery);
        setResults([]);
        setPage(1);
        setHasMore(true);
    }

    const observer = useRef();
    const lastResultElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Track search execution when query or type changes
    useEffect(() => {
        if (searchQuery) {
            posthog.capture("search_executed", { query: searchQuery, type: searchType });
        }
    }, [searchQuery, searchType]);

    useEffect(() => {
        if (!searchQuery) return;

        let active = true;
        const fetchResults = async () => {
            setLoading(true);
            try {
                // Determine mock vs real based on searchType
                // We'll hit the real matchmaking endpoint for players as suggested.
                // For Posts, we just mock.
                let newResults = [];
                
                const typeParam = searchType === 'players' ? 'user' : 'post';
                let url = `/api/search?q=${encodeURIComponent(searchQuery)}&type=${typeParam}`;
                if (user?.university || user?.homeUniversity) {
                    url += `&searcherHomeUniversity=${encodeURIComponent(user.homeUniversity || user.university)}`;
                }
                const res = await apiFetch(url);
                
                if (res.ok) {
                    const data = await res.json();
                    newResults = data.results || [];
                    
                    if (searchType === 'players') {
                        // Apply filters client-side since API might not support all these filters yet
                        const selectedSkills = Object.keys(skillLevel).filter(k => skillLevel[k]);
                        if (selectedSkills.length > 0) {
                            newResults = newResults.filter(r => selectedSkills.includes(r.skillLevel));
                        }
                        const selectedUnis = Object.keys(homeUniversity).filter(k => homeUniversity[k]);
                        if (selectedUnis.length > 0) {
                            newResults = newResults.filter(r => selectedUnis.includes(r.university));
                        }
                    }
                }

                if (active) {
                    setResults(prev => {
                        if (page === 1) {
                            return newResults;
                        }
                        // Avoid duplicates if using simple mock
                        const uniqueResults = [...prev, ...newResults].reduce((acc, curr) => {
                            if (!acc.find(item => item._id === curr._id)) {
                                acc.push(curr);
                            }
                            return acc;
                        }, []);
                        return uniqueResults;
                    });
                    
                    // Mocking end of pagination if we get less than a standard page size or after 3 pages
                    if (newResults.length === 0 || page >= 3) {
                        setHasMore(false);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch search results", err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchResults();

        return () => {
            active = false;
        };
    }, [searchQuery, searchType, skillLevel, homeUniversity, page, user]);

    const handleTypeChange = (newType) => {
        setSearchType(newType);
        setResults([]);
        setPage(1);
        setHasMore(true);
    };

    const handleSkillChange = (event) => {
        setSkillLevel(prev => ({
            ...prev,
            [event.target.name]: event.target.checked,
        }));
        setResults([]);
        setPage(1);
        setHasMore(true);
    };

    const handleUniChange = (event) => {
        setHomeUniversity(prev => ({
            ...prev,
            [event.target.name]: event.target.checked,
        }));
        setResults([]);
        setPage(1);
        setHasMore(true);
    };

    return (
        <Box sx={{ flexGrow: 1, pt: { xs: 1, sm: 2 }, pb: 4 }}>
            <Typography variant="h4" component="h1" fontWeight="bold" mb={3} sx={{ color: 'text.primary' }}>
                Search Results for "{searchQuery}"
            </Typography>

            <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                {/* Left Sidebar - Faceted Filtering */}
                <Grid size={{ xs: 12, md: 3 }} component="aside" aria-label="Search filters">
                    <Paper 
                        sx={{ 
                            p: { xs: 2, sm: 2.5, md: 3 }, 
                            borderRadius: 2, 
                            position: { xs: 'static', md: 'sticky' }, 
                            top: { md: '100px' },
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Typography variant="h6" component="h2" fontWeight="bold" mb={2} sx={{ color: 'text.primary' }}>
                            Filters
                        </Typography>

                        <FormControl component="fieldset" sx={{ mb: { xs: 2, md: 3 }, width: '100%' }}>
                            <FormLabel 
                                component="legend" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    color: 'text.primary', 
                                    '&.Mui-focused': { color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e' },
                                    mb: 1 
                                }}
                            >
                                Type
                            </FormLabel>
                            <RadioGroup
                                value={searchType}
                                onChange={(e) => handleTypeChange(e.target.value)}
                                row
                                aria-label="Filter by content type"
                                sx={{ gap: { xs: 1, sm: 2, md: 0 } }}
                            >
                                <FormControlLabel 
                                    value="players" 
                                    control={
                                        <Radio 
                                            sx={{
                                                color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                                '&.Mui-checked': {
                                                    color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                },
                                                '&:focus-visible': {
                                                    outline: '2px solid #FFCC33',
                                                    outlineOffset: '2px',
                                                }
                                            }}
                                        />
                                    } 
                                    label="Players" 
                                    sx={{ '& .MuiFormControlLabel-label': { color: 'text.primary', fontWeight: 500 } }}
                                />
                                <FormControlLabel 
                                    value="posts" 
                                    control={
                                        <Radio 
                                            sx={{
                                                color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                                '&.Mui-checked': {
                                                    color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                },
                                                '&:focus-visible': {
                                                    outline: '2px solid #FFCC33',
                                                    outlineOffset: '2px',
                                                }
                                            }}
                                        />
                                    } 
                                    label="Posts" 
                                    sx={{ '& .MuiFormControlLabel-label': { color: 'text.primary', fontWeight: 500 } }}
                                />
                            </RadioGroup>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        <FormControl component="fieldset" sx={{ mb: { xs: 2, md: 3 }, width: '100%' }}>
                            <FormLabel 
                                component="legend" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    color: 'text.primary', 
                                    '&.Mui-focused': { color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e' },
                                    mb: 1 
                                }}
                            >
                                Skill Level
                            </FormLabel>
                            <FormGroup 
                                aria-label="Filter by skill level"
                                sx={{ 
                                    flexDirection: { xs: 'row', md: 'column' },
                                    flexWrap: 'wrap',
                                    gap: { xs: 0.5, md: 0 }
                                }}
                            >
                                {Object.keys(skillLevel).map(level => (
                                    <FormControlLabel
                                        key={level}
                                        control={
                                            <Checkbox 
                                                checked={skillLevel[level]} 
                                                onChange={handleSkillChange} 
                                                name={level} 
                                                sx={{
                                                    color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                                    '&.Mui-checked': {
                                                        color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                    },
                                                    '&:focus-visible': {
                                                        outline: '2px solid #FFCC33',
                                                        outlineOffset: '2px',
                                                    }
                                                }}
                                            />
                                        }
                                        label={level}
                                        sx={{ '& .MuiFormControlLabel-label': { color: 'text.primary', fontWeight: 500 } }}
                                    />
                                ))}
                            </FormGroup>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        <FormControl component="fieldset" sx={{ mb: { xs: 1, md: 3 }, width: '100%' }}>
                            <FormLabel 
                                component="legend" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    color: 'text.primary', 
                                    '&.Mui-focused': { color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e' },
                                    mb: 1 
                                }}
                            >
                                Home University
                            </FormLabel>
                            <FormGroup 
                                aria-label="Filter by home university"
                                sx={{ 
                                    flexDirection: { xs: 'row', md: 'column' },
                                    flexWrap: 'wrap',
                                    gap: { xs: 0.5, md: 0 }
                                }}
                            >
                                {Object.keys(homeUniversity).map(uni => (
                                    <FormControlLabel
                                        key={uni}
                                        control={
                                            <Checkbox 
                                                checked={homeUniversity[uni]} 
                                                onChange={handleUniChange} 
                                                name={uni} 
                                                sx={{
                                                    color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                                                    '&.Mui-checked': {
                                                        color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                    },
                                                    '&:focus-visible': {
                                                        outline: '2px solid #FFCC33',
                                                        outlineOffset: '2px',
                                                    }
                                                }}
                                            />
                                        }
                                        label={uni}
                                        sx={{ '& .MuiFormControlLabel-label': { color: 'text.primary', fontWeight: 500 } }}
                                    />
                                ))}
                            </FormGroup>
                        </FormControl>
                    </Paper>
                </Grid>

                {/* Main Central Column - Results */}
                <Grid size={{ xs: 12, md: 9 }} component="main" aria-label="Search results list">
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} aria-live="polite" aria-atomic="false">
                        {results.length === 0 && !loading && (
                            <Paper 
                                role="status"
                                aria-live="polite"
                                sx={{ 
                                    p: { xs: 3, sm: 4 }, 
                                    textAlign: 'center', 
                                    borderRadius: 2,
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                }}
                            >
                                <Typography 
                                    variant="h6" 
                                    sx={{ 
                                        color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : '#404040',
                                        fontWeight: 600,
                                    }}
                                >
                                    No results found for "{searchQuery}".
                                </Typography>
                            </Paper>
                        )}

                        {results.map((result, index) => {
                            const isLast = results.length === index + 1;
                            
                            if (searchType === 'players') {
                                return (
                                    <Paper 
                                        key={result._id} 
                                        ref={isLast ? lastResultElementRef : null}
                                        component="article"
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Player: ${result.name}, ${result.skillLevel || 'Unrated'}, ${result.university || 'GMU'}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate(`/profile/${result._id}`);
                                            }
                                        }}
                                        onClick={() => navigate(`/profile/${result._id}`)}
                                        sx={{ 
                                            p: { xs: 2, sm: 2.5 }, 
                                            borderRadius: 2, 
                                            display: 'flex', 
                                            flexDirection: 'row',
                                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                                            alignItems: 'center', 
                                            gap: 2, 
                                            cursor: 'pointer', 
                                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', 
                                            border: (theme) => `1px solid ${theme.palette.divider}`,
                                            outline: 'none',
                                            '&:hover': { 
                                                transform: 'translateY(-2px)', 
                                                boxShadow: (theme) => theme.palette.mode === 'dark' 
                                                    ? '0 8px 24px rgba(0,0,0,0.5)' 
                                                    : '0 8px 24px rgba(0, 92, 46, 0.12)',
                                            },
                                            '&:focus-visible': {
                                                outline: '2px solid #FFCC33',
                                                outlineOffset: '2px',
                                            }
                                        }}
                                    >
                                        <Avatar 
                                            src={result.profilePic ? getOptimizedAvatar(result.profilePic, 64) : undefined} 
                                            alt={result.name}
                                            sx={{ 
                                                width: { xs: 48, sm: 64 }, 
                                                height: { xs: 48, sm: 64 },
                                                bgcolor: 'secondary.main',
                                                color: 'primary.dark',
                                                fontWeight: 'bold',
                                                fontSize: { xs: '1.2rem', sm: '1.5rem' },
                                                border: '2px solid #FFCC33',
                                                flexShrink: 0
                                            }}
                                        >
                                            {!result.profilePic && result.name?.charAt(0)}
                                        </Avatar>
                                        <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                                            <Typography variant="h6" component="h3" fontWeight="bold" sx={{ color: 'text.primary', lineHeight: 1.25 }}>
                                                {result.name}
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : '#404040',
                                                    fontWeight: 500,
                                                    mt: 0.5
                                                }}
                                            >
                                                {result.skillLevel || 'Unrated'} • {result.university || 'GMU'}
                                            </Typography>
                                            {result.bio && (
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        mt: 1, 
                                                        display: '-webkit-box', 
                                                        WebkitLineClamp: 2, 
                                                        WebkitBoxOrient: 'vertical', 
                                                        overflow: 'hidden',
                                                        color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : '#2d3748',
                                                        lineHeight: 1.5
                                                    }}
                                                >
                                                    {result.bio}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Button 
                                            variant="outlined" 
                                            size="small" 
                                            component={RouterLink}
                                            to={`/profile/${result._id}`}
                                            aria-label={`View profile for ${result.name}`}
                                            onClick={(e) => e.stopPropagation()}
                                            sx={{ 
                                                borderRadius: 8,
                                                whiteSpace: 'nowrap',
                                                fontWeight: 'bold',
                                                minHeight: '36px',
                                                minWidth: { xs: '100%', sm: 'auto' },
                                                borderWidth: '1.5px',
                                                color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                borderColor: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                                '&:hover': {
                                                    borderWidth: '1.5px',
                                                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#a5d6a7' : '#004d26',
                                                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(128, 226, 126, 0.08)' : 'rgba(0, 92, 46, 0.08)',
                                                },
                                                '&:focus-visible': {
                                                    outline: '2px solid #FFCC33',
                                                    outlineOffset: '2px',
                                                }
                                            }}
                                        >
                                            View Profile
                                        </Button>
                                    </Paper>
                                );
                            } else {
                                return (
                                    <Paper 
                                        key={result._id} 
                                        ref={isLast ? lastResultElementRef : null}
                                        component="article"
                                        tabIndex={0}
                                        aria-label={`Post by ${result.author}`}
                                        sx={{ 
                                            p: { xs: 2, sm: 3 }, 
                                            borderRadius: 2,
                                            border: (theme) => `1px solid ${theme.palette.divider}`,
                                            transition: 'box-shadow 0.2s ease',
                                            outline: 'none',
                                            '&:hover': {
                                                boxShadow: (theme) => theme.palette.mode === 'dark' 
                                                    ? '0 8px 24px rgba(0,0,0,0.5)' 
                                                    : '0 8px 24px rgba(0, 102, 51, 0.08)',
                                            },
                                            '&:focus-visible': {
                                                outline: '2px solid #FFCC33',
                                                outlineOffset: '2px',
                                            }
                                        }}
                                    >
                                        <Typography 
                                            variant="h6" 
                                            component="h3" 
                                            fontWeight="bold" 
                                            mb={1}
                                            sx={{
                                                color: (theme) => theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
                                            }}
                                        >
                                            {result.title}
                                        </Typography>
                                        <Typography 
                                            variant="subtitle2" 
                                            fontWeight="bold" 
                                            mb={1}
                                            sx={{
                                                color: (theme) => theme.palette.mode === 'dark' ? '#80e27e' : '#005c2e',
                                            }}
                                        >
                                            {result.authorName}
                                        </Typography>
                                        <Typography 
                                            variant="body1"
                                            sx={{
                                                color: 'text.primary',
                                                wordBreak: 'break-word',
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            {result.content}
                                        </Typography>
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                display: 'block', 
                                                mt: 2,
                                                color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.75)' : '#495057',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {new Date(result.timestamp || result.createdAt).toLocaleDateString()}
                                        </Typography>
                                    </Paper>
                                );
                            }
                        })}

                        {loading && (
                            <Box 
                                sx={{ display: 'flex', justifyContent: 'center', p: 4 }}
                                role="status"
                                aria-live="polite"
                                aria-label="Loading search results"
                            >
                                <CircularProgress aria-label="Loading search results" />
                            </Box>
                        )}
                        
                        {!hasMore && results.length > 0 && (
                            <Typography 
                                variant="body2" 
                                textAlign="center" 
                                sx={{ 
                                    py: 3,
                                    color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.8)' : '#495057',
                                    fontWeight: 500,
                                }}
                            >
                                End of results
                            </Typography>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
