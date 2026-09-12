import { useState, useEffect } from 'react';
import { 
    Container, Typography, Box, Paper, Tabs, Tab, 
    Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import apiFetch from '../utils/api';

const Leaderboard = () => {
    const [tab, setTab] = useState('singles');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const res = await apiFetch(`/api/matches/leaderboard?type=${tab}`);
                const data = await res.json();
                setUsers(data);
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [tab]);

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

                <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
                    <Tabs 
                        value={tab} 
                        onChange={(e, v) => setTab(v)} 
                        centered 
                        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'primary.main', color: 'white' }}
                        TabIndicatorProps={{ style: { backgroundColor: 'white', height: 4 } }}
                        textColor="inherit"
                    >
                        <Tab label="Singles (1v1)" value="singles" sx={{ fontWeight: 'bold' }} />
                        <Tab label="Doubles (2v2)" value="doubles" sx={{ fontWeight: 'bold' }} />
                    </Tabs>

                    <TableContainer>
                        <Table>
                            <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '10%' }}>Rank</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Player</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Skill Level</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Elo Rating</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>Loading...</TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>No players found.</TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user, index) => (
                                        <TableRow 
                                            key={user._id} 
                                            hover
                                            component={motion.tr}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <TableCell align="center">
                                                <Typography variant="h6" fontWeight="bold" color={index < 3 ? 'text.primary' : 'text.secondary'}>
                                                    #{index + 1}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Avatar 
                                                        src={user.profilePic} 
                                                        sx={{ 
                                                            border: index < 3 ? `3px solid ${getRankColor(index)}` : 'none',
                                                            boxShadow: index < 3 ? `0 0 10px ${getRankColor(index)}` : 'none'
                                                        }}
                                                    />
                                                    <Typography fontWeight="bold">{user.name}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={user.skillLevel} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="h6" fontWeight="bold" color="primary.main">
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
