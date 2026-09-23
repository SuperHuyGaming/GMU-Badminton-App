import React, { useState } from 'react';
import { 
    Container, Typography, Box, Paper, Tabs, Tab, 
    Avatar, Table, TableBody, TableCell, TableContainer, TableHead, 
    TableRow, Chip, CircularProgress, TextField, Select, MenuItem, InputLabel, FormControl, Grid, InputAdornment
} from '@mui/material';
import { motion } from 'framer-motion';
import { LeaderboardRowSkeleton } from '../components/Skeletons';
import { useQuery } from '@tanstack/react-query';
import apiFetch from '../utils/api';
import { getOptimizedAvatar } from '../utils/image';

const Leaderboard = () => {
    const [tab, setTab] = useState('singles');
    const [search, setSearch] = useState('');
    const [university, setUniversity] = useState('');
    const [skillLevel, setSkillLevel] = useState('');
    const [minMatches, setMinMatches] = useState('');

    const { data: users = [], isLoading: loading } = useQuery({
        queryKey: ['leaderboard', tab, search, university, skillLevel, minMatches],
        queryFn: async () => {
            const params = new URLSearchParams({ type: tab });
            if (search) params.append('search', search);
            if (university) params.append('university', university);
            if (skillLevel) params.append('skillLevel', skillLevel);
            if (minMatches) params.append('minMatches', minMatches);
            
            const res = await apiFetch(`/api/matches/leaderboard?${params.toString()}`);
            return res.json();
        }
    });

    const getRankColor = (index) => {
        if (index === 0) return '#FFD700'; // Gold
        if (index === 1) return '#C0C0C0'; // Silver
        if (index === 2) return '#CD7F32'; // Bronze
        return 'transparent';
    };

    return (
        <Box sx={{ pb: 10 }}>
			{/* HERO BANNER */}
			<Box 
				sx={{ 
					width: '100%', 
					mb: 6, 
					py: { xs: 6, md: 10 },
					background: "linear-gradient(135deg, rgba(0, 102, 51, 0.9) 0%, rgba(255, 204, 51, 0.8) 100%)",
					position: 'relative',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
				}}
			>
				{/* Decorative Background Elements */}
				<Box sx={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(30px)' }} />
				<Box sx={{ position: 'absolute', bottom: -50, right: -50, width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', filter: 'blur(40px)' }} />
				
				<Typography
					variant="h2"
					fontWeight="900"
					sx={{ color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.2)', mb: 2, textAlign: 'center' }}
				>
					Leaderboard
				</Typography>
				<Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', maxWidth: 600 }}>
					The most competitive players in the area. Climb the ranks and claim your spot at the top.
				</Typography>
			</Box>

            <Container maxWidth="md">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

                <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', mb: 4, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1, color: 'primary.main' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                        <Typography variant="h6" fontWeight="bold">Advanced Filters</Typography>
                    </Box>
                    <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                        <Grid size={{'xs': 12, 'sm': 6, 'md': 3}}>
                            <TextField 
                                fullWidth 
                                label="Search Player" 
                                variant="outlined" 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{'xs': 12, 'sm': 6, 'md': 3}}>
                            <FormControl fullWidth>
                                <InputLabel>University</InputLabel>
                                <Select value={university} label="University" onChange={(e) => setUniversity(e.target.value)}>
                                    <MenuItem value=""><em>Any University</em></MenuItem>
                                    <MenuItem value="George Mason University">George Mason University</MenuItem>
                                    <MenuItem value="Virginia Tech">Virginia Tech</MenuItem>
                                    <MenuItem value="UVA">UVA</MenuItem>
                                    <MenuItem value="VCU">VCU</MenuItem>
                                    <MenuItem value="Other">Other</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{'xs': 12, 'sm': 6, 'md': 3}}>
                            <FormControl fullWidth>
                                <InputLabel>Skill Level</InputLabel>
                                <Select value={skillLevel} label="Skill Level" onChange={(e) => setSkillLevel(e.target.value)}>
                                    <MenuItem value=""><em>Any Skill</em></MenuItem>
                                    <MenuItem value="A Level">A Level (Advanced)</MenuItem>
                                    <MenuItem value="B Level">B Level (High Intermediate)</MenuItem>
                                    <MenuItem value="C Level">C Level (Intermediate)</MenuItem>
                                    <MenuItem value="D Level">D Level (Beginner)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{'xs': 12, 'sm': 6, 'md': 3}}>
                            <FormControl fullWidth>
                                <InputLabel>Min Matches</InputLabel>
                                <Select value={minMatches} label="Min Matches" onChange={(e) => setMinMatches(e.target.value)}>
                                    <MenuItem value=""><em>Any</em></MenuItem>
                                    <MenuItem value="5">5+ Matches</MenuItem>
                                    <MenuItem value="10">10+ Matches</MenuItem>
                                    <MenuItem value="25">25+ Matches</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Tabs 
                        value={tab} 
                        onChange={(e, v) => setTab(v)} 
                        centered 
                        sx={{ bgcolor: 'rgba(0, 102, 51, 0.4)', color: 'white' }}
                        TabIndicatorProps={{ style: { backgroundColor: '#FFCC33', height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 } }}
                        textColor="inherit"
                    >
                        <Tab label="Singles (1v1)" value="singles" sx={{ fontWeight: '900', py: 2.5, textTransform: 'none', fontSize: '1rem' }} />
                        <Tab label="Doubles (2v2)" value="doubles" sx={{ fontWeight: '900', py: 2.5, textTransform: 'none', fontSize: '1rem' }} />
                    </Tabs>

                    <TableContainer>
                        <Table aria-label="leaderboard table">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Rank</TableCell>
                                    <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Player</TableCell>
                                    <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Skill Level</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Elo</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    [1, 2, 3, 4, 5].map((n) => (
                                        <TableRow key={n}>
                                            <TableCell colSpan={4} sx={{ p: 0 }}>
                                                <LeaderboardRowSkeleton />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 8, color: 'text.secondary', fontWeight: 'bold' }}>
                                            No players found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user, index) => (
                                        <TableRow 
                                            key={user._id} 
                                            hover
                                            component={motion.tr}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            sx={{ 
                                                '&:last-child td, &:last-child th': { border: 0 },
                                                transition: 'background-color 0.2s',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => window.location.href = `/profile/${user._id}`}
                                        >
                                            <TableCell align="center" sx={{ py: 2.5 }}>
                                                <Typography variant="h6" fontWeight="900" color={index < 3 ? 'text.primary' : 'text.secondary'}>
                                                    #{index + 1}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ py: 2.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Avatar 
                                                        src={getOptimizedAvatar(user.profilePic, 40)}
                                                        sx={{ 
                                                            width: 44,
                                                            height: 44,
                                                            border: index < 3 ? `3px solid ${getRankColor(index)}` : 'none',
                                                            boxShadow: index < 3 ? `0 0 10px ${getRankColor(index)}` : 'none'
                                                        }}
                                                    />
                                                    <Typography fontWeight="bold">{user.name}</Typography>
                                                </Box>
                                            </TableCell>
											<TableCell sx={{ py: 2.5 }}>
												<Chip 
													label={user.skillLevel || 'N/A'} 
													size="small" 
													sx={{ 
														fontWeight: 800, 
														bgcolor: 'rgba(0, 102, 51, 0.1)', 
														color: 'primary.main',
														borderRadius: 2
													}} 
												/>
											</TableCell>
											<TableCell align="right" sx={{ py: 2.5 }}>
												<Typography variant="h5" fontWeight="900" color="primary.main">
													{tab === 'singles' ? user.singlesElo : user.doublesElo}
												</Typography>
											</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </motion.div>
        </Container>
		</Box>
    );
};

export default Leaderboard;
