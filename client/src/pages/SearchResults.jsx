import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const useQuery = () => {
    return new URLSearchParams(useLocation().search);
};

export default function SearchResults() {
    const queryParams = useQuery();
    const navigate = useNavigate();
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

    // Fetch data whenever query, type, or filters change
    useEffect(() => {
        setResults([]);
        setPage(1);
        setHasMore(true);
        if (searchQuery) {
            posthog.capture("search_executed", { query: searchQuery, type: searchType });
        }
    }, [searchQuery, searchType, skillLevel, homeUniversity]);

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
                
                if (searchType === 'players') {
                    const res = await apiFetch(`/api/matchmaking/discover?search=${encodeURIComponent(searchQuery)}&page=${page}`);
                    if (res.ok) {
                        const data = await res.json();
                        newResults = data.matches || [];
                        
                        // Apply filters client-side since API might not support all these filters yet
                        const selectedSkills = Object.keys(skillLevel).filter(k => skillLevel[k]);
                        if (selectedSkills.length > 0) {
                            newResults = newResults.filter(r => selectedSkills.includes(r.skillLevel));
                        }
                    }
                } else {
                    // Mock Posts fetching
                    await new Promise(r => setTimeout(r, 800)); // fake delay
                    newResults = Array.from({ length: 5 }).map((_, i) => ({
                        _id: `post-${page}-${i}`,
                        type: 'post',
                        content: `Mock post result ${i + 1} for "${searchQuery}" on page ${page}.`,
                        author: 'User',
                        createdAt: new Date().toISOString()
                    }));
                }

                if (active) {
                    setResults(prev => {
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
    }, [searchQuery, searchType, skillLevel, homeUniversity, page]);

    const handleSkillChange = (event) => {
        setSkillLevel({
            ...skillLevel,
            [event.target.name]: event.target.checked,
        });
    };

    const handleUniChange = (event) => {
        setHomeUniversity({
            ...homeUniversity,
            [event.target.name]: event.target.checked,
        });
    };

    return (
        <Box sx={{ flexGrow: 1, pt: 2 }}>
            <Typography variant="h4" fontWeight="bold" mb={3}>
                Search Results for "{searchQuery}"
            </Typography>

            <Grid container spacing={4}>
                {/* Left Sidebar - Faceted Filtering */}
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 3, borderRadius: 2, position: 'sticky', top: '100px' }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>Filters</Typography>

                        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                            <FormLabel component="legend" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>Type</FormLabel>
                            <RadioGroup
                                value={searchType}
                                onChange={(e) => setSearchType(e.target.value)}
                            >
                                <FormControlLabel value="players" control={<Radio />} label="Players" />
                                <FormControlLabel value="posts" control={<Radio />} label="Posts" />
                            </RadioGroup>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                            <FormLabel component="legend" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>Skill Level</FormLabel>
                            <FormGroup>
                                {Object.keys(skillLevel).map(level => (
                                    <FormControlLabel
                                        key={level}
                                        control={<Checkbox checked={skillLevel[level]} onChange={handleSkillChange} name={level} />}
                                        label={level}
                                    />
                                ))}
                            </FormGroup>
                        </FormControl>

                        <Divider sx={{ my: 2 }} />

                        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
                            <FormLabel component="legend" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>Home University</FormLabel>
                            <FormGroup>
                                {Object.keys(homeUniversity).map(uni => (
                                    <FormControlLabel
                                        key={uni}
                                        control={<Checkbox checked={homeUniversity[uni]} onChange={handleUniChange} name={uni} />}
                                        label={uni}
                                    />
                                ))}
                            </FormGroup>
                        </FormControl>
                    </Paper>
                </Grid>

                {/* Main Central Column - Results */}
                <Grid item xs={12} md={9}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {results.length === 0 && !loading && (
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                                <Typography variant="h6" color="text.secondary">
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
                                        sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}
                                        onClick={() => navigate(`/profile/${result._id}`)}
                                    >
                                        <Avatar src={result.profilePic ? getOptimizedAvatar(result.profilePic, 64) : undefined} sx={{ width: 64, height: 64 }}>
                                            {!result.profilePic && result.name?.charAt(0)}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" fontWeight="bold">{result.name}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {result.skillLevel || 'Unrated'} • {result.university || 'GMU'}
                                            </Typography>
                                            {result.bio && (
                                                <Typography variant="body2" sx={{ mt: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {result.bio}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Button variant="outlined" size="small" sx={{ borderRadius: 8 }}>View Profile</Button>
                                    </Paper>
                                );
                            } else {
                                return (
                                    <Paper 
                                        key={result._id} 
                                        ref={isLast ? lastResultElementRef : null}
                                        sx={{ p: 3, borderRadius: 2 }}
                                    >
                                        <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={1}>{result.author}</Typography>
                                        <Typography variant="body1">{result.content}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                                            {new Date(result.createdAt).toLocaleDateString()}
                                        </Typography>
                                    </Paper>
                                );
                            }
                        })}

                        {loading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        )}
                        
                        {!hasMore && results.length > 0 && (
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                End of results
                            </Typography>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
