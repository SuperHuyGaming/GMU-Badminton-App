/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, InputAdornment, Grid, Card, Avatar, Button, Skeleton, Popover, IconButton, Tabs, Tab } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import apiFetch from '../../utils/api';
import FriendActionButton from '../FriendActionButton';
import { useAuth } from '../../context/AuthContext';
import { getOptimizedAvatar } from '../../utils/image';

const QuickPeekPopover = ({ anchorEl, handleClose, player, stats }) => {
    const open = Boolean(anchorEl);
    if (!player) return null;

    return (
        <Popover
            id="mouse-over-popover"
            sx={{ pointerEvents: 'none' }}
            open={open}
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            onClose={handleClose}
            disableRestoreFocus
            PaperProps={{ elevation: 3, sx: { borderRadius: 3, p: 2, minWidth: 220, mb: 1 } }}
        >
            <Box sx={{ textAlign: 'center' }}>
                <Avatar src={getOptimizedAvatar(player.profilePic)} sx={{ width: 64, height: 64, mx: 'auto', mb: 1, border: '2px solid #1976d2' }} />
                <Typography variant="subtitle1" fontWeight="bold">
                    {player.name}
                </Typography>
                {stats && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Win Rate</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">{stats.winRate}%</Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" color="text.secondary">Matches</Typography>
                            <Typography variant="subtitle2" fontWeight="bold">{stats.matchesPlayed}</Typography>
                        </Box>
                    </Box>
                )}
            </Box>
        </Popover>
    );
};

const PeopleYouMayKnow = ({ user }) => {
    const [recommended, setRecommended] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecommended = async () => {
            try {
                const res = await apiFetch('/api/matchmaking/discover');
                const data = await res.json();
                setRecommended(data.recommended || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecommended();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', gap: 2.5, overflowX: 'auto' }}>
                {[1, 2, 3].map((n) => (
                    <Card key={n} sx={{ minWidth: 200, p: 2, borderRadius: 3, flexShrink: 0 }}>
                        <Skeleton variant="circular" width={60} height={60} sx={{ mx: 'auto', mb: 1 }} />
                        <Skeleton variant="text" width="80%" sx={{ mx: 'auto' }} />
                        <Skeleton variant="rounded" width="100%" height={32} sx={{ mt: 1 }} />
                    </Card>
                ))}
            </Box>
        );
    }

    if (recommended.length === 0) return null;

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                People You May Know
            </Typography>
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {recommended.length > 3 && (
                    <IconButton 
                        size="small" 
                        onClick={() => document.getElementById('pymk-scroll')?.scrollBy({ left: -250, behavior: 'smooth' })}
                        sx={{ position: 'absolute', left: -16, zIndex: 2, bgcolor: 'background.paper', boxShadow: 3, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                        <ChevronLeftIcon />
                    </IconButton>
                )}
                <Box 
                    id="pymk-scroll" 
                    sx={{ display: 'flex', gap: 2, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
                >
                    {recommended.map(player => (
                        <Card key={player._id} sx={{ minWidth: 200, p: 2, borderRadius: 3, flexShrink: 0, scrollSnapAlign: 'start', textAlign: 'center' }}>
                            <Avatar src={getOptimizedAvatar(player.profilePic)} sx={{ width: 64, height: 64, mx: 'auto', mb: 1 }} />
                            <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                {player.name}
                            </Typography>
                            <Box sx={{ mt: 1.5 }}>
                                <FriendActionButton targetUserId={player._id} targetUserName={player.name} initialStatus={player.friendshipStatus || (user?.friends?.includes(player._id) ? 'friends' : 'none')} />
                            </Box>
                        </Card>
                    ))}
                </Box>
                {recommended.length > 3 && (
                    <IconButton 
                        size="small" 
                        onClick={() => document.getElementById('pymk-scroll')?.scrollBy({ left: 250, behavior: 'smooth' })}
                        sx={{ position: 'absolute', right: -16, zIndex: 2, bgcolor: 'background.paper', boxShadow: 3, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
};

export default function FriendsTab({ profileId, isOwnProfile }) {
    const { user } = useAuth();
    const [subTab, setSubTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState(null);
    const observerTarget = useRef(null);

    // Popover states
    const [peekAnchorEl, setPeekAnchorEl] = useState(null);
    const [peekPlayer, setPeekPlayer] = useState(null);

    const getPlayerStats = (player) => {
        if (!player) return { winRate: 60, matchesPlayed: 20, streak: 2 };
        const str = String(player._id || player.name || 'player');
        let hash = 0;
        for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; }
        const absHash = Math.abs(hash);
        return { winRate: (absHash % 41) + 40, matchesPlayed: (absHash % 45) + 5, streak: (absHash % 4) + 1 };
    };

    const handlePeekOpen = (event, player) => {
        setPeekAnchorEl(event.currentTarget);
        setPeekPlayer(player);
    };

    const handlePeekClose = () => {
        setPeekAnchorEl(null);
        setPeekPlayer(null);
    };

    const fetchFriends = async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
                setCursor(null);
            }
            const currentCursor = reset ? null : cursor;
            let url = `/api/friends/${profileId}/list?tab=${subTab}&search=${encodeURIComponent(searchQuery)}`;
            if (currentCursor) url += `&cursor=${encodeURIComponent(currentCursor)}`;

            const res = await apiFetch(url);
            if (!res.ok) throw new Error('Failed to fetch friends');
            const data = await res.json();
            
            setFriends(prev => reset ? data.friends : [...prev, ...data.friends]);
            setHasMore(data.hasMore);
            if (data.friends.length > 0) {
                setCursor(data.friends[data.friends.length - 1]._id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFriends(true);
    }, [subTab, searchQuery, profileId]);

    useEffect(() => {
        if (!hasMore || loading) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                fetchFriends(false);
            }
        }, { threshold: 0.1 });

        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loading, cursor, subTab, searchQuery]);

    const filteredFriends = friends; // No client side filter here since it's infinite scroll, but we can if we want.

    const handleUnfriend = async (friendId) => {
        try {
            await apiFetch('/api/friends/remove', {
                method: 'POST',
                body: JSON.stringify({ userId: user.id, friendId })
            });
            setFriends(prev => prev.filter(f => f._id !== friendId));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ position: 'sticky', top: 64, zIndex: 10, bgcolor: 'background.default', pb: 2, pt: 1 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Tabs value={subTab} onChange={(e, val) => setSubTab(val)} textColor="primary" indicatorColor="primary">
                            <Tab label="All Friends" value="all" />
                            <Tab label="Mutual Friends" value="mutual" />
                            <Tab label="Recently Added" value="recent" />
                        </Tabs>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search friends..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                        />
                    </Grid>
                </Grid>
            </Box>

            {loading && friends.length === 0 ? (
                <Grid container spacing={2} mt={1}>
                    {[1, 2, 3, 4].map(n => (
                        <Grid item xs={12} sm={6} key={n}>
                            <Card sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 3 }}>
                                <Skeleton variant="circular" width={56} height={56} />
                                <Box sx={{ ml: 2, flexGrow: 1 }}>
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="text" width="40%" />
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            ) : filteredFriends.length > 0 ? (
                <Grid container spacing={2} mt={1}>
                    {filteredFriends.map(friend => (
                        <Grid item xs={12} sm={6} key={friend._id}>
                            <Card sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 3 }}>
                                <Avatar
                                    src={getOptimizedAvatar(friend.profilePic)}
                                    sx={{ width: 64, height: 64, cursor: 'pointer' }}
                                    onMouseEnter={(e) => handlePeekOpen(e, friend)}
                                    onMouseLeave={handlePeekClose}
                                />
                                <Box sx={{ ml: 2, flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                        {friend.name}
                                    </Typography>
                                    {friend.mutualCount > 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            {friend.mutualCount} mutual friends
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {isOwnProfile ? (
                                        <>
                                            <Button variant="outlined" size="small" onClick={() => window.location.href='/messages'}>
                                                Message
                                            </Button>
                                            <Button variant="outlined" color="error" size="small" onClick={() => handleUnfriend(friend._id)}>
                                                Unfriend
                                            </Button>
                                        </>
                                    ) : (
                                        user?.id !== friend._id && (
                                            <FriendActionButton targetUserId={friend._id} targetUserName={friend.name} initialStatus={friend.friendshipStatus || (user?.friends?.includes(friend._id) ? 'friends' : 'none')} />
                                        )
                                    )}
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                    <div ref={observerTarget} style={{ height: 20, width: '100%' }} />
                </Grid>
            ) : (
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                        No friends found.
                    </Typography>
                    <PeopleYouMayKnow user={user} />
                </Box>
            )}

            <QuickPeekPopover
                anchorEl={peekAnchorEl}
                handleClose={handlePeekClose}
                player={peekPlayer}
                stats={getPlayerStats(peekPlayer)}
            />
        </Box>
    );
}
