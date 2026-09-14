import { useState } from 'react';
import { 
    Container, Typography, Box, Paper, Tabs, Tab, 
    Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress
} from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import apiFetch from '../utils/api';
import { getOptimizedAvatar } from '../utils/image';

const Leaderboard = () => {
    const [tab, setTab] = useState('singles');

    const { data: users = [], isLoading: loading } = useQuery({
        queryKey: ['leaderboard', tab],
        queryFn: async () => {
            const res = await apiFetch(`/api/matches/leaderboard?type=${tab}`);
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
        <Container maxWidth="md" sx={{ py: 6 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Typography variant="h3" fontWeight="bold" textAlign="center" gutterBottom>
                    🏆 Global Leaderboard
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" textAlign="center" mb={4}>
                    Compete, log your matches, and climb the ranks.
                </Typography>

                <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Tabs 
                        value={tab} 
                        onChange={(e, v) => setTab(v)} 
                        centered 
                        sx={{ bgcolor: 'primary.main', color: 'white' }}
                        TabIndicatorProps={{ style: { backgroundColor: 'white', height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 } }}
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
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                                            <CircularProgress />
                                        </TableCell>
                                    </TableRow>
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
    );
};

export default Leaderboard;
