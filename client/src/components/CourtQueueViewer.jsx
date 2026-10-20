import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, Chip, Button, Stack,
    Divider, IconButton, Tooltip, Alert, useTheme
} from '@mui/material';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import QueueIcon from '@mui/icons-material/Queue';
import RefreshIcon from '@mui/icons-material/Refresh';
import socket from '../utils/socket';

const INITIAL_COURTS = [
    {
        courtNumber: 1,
        courtName: 'RAC Court 1 (Championship Mat)',
        status: 'MATCH_IN_PROGRESS',
        division: "Men's Singles Open - Semifinals",
        elapsedSeconds: 1695, // ~28 mins
        warmupRemaining: 0,
        estimatedDurationMinutes: 18,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: {
            id: 'm-rac-01',
            player1: { name: 'Alan Yang (GMU)', seed: 1, score: 18, isServing: true },
            player2: { name: 'Kevin Lin (UMD)', seed: 4, score: 19, isServing: false },
            gameScores: [[21, 17], [18, 19]],
            gameNumber: 2
        },
        queue: [
            { id: 'q-01', match: 'Marcus Chen (GMU) vs Alex Tran (JHU)', division: "Men's Singles Open - Finals", estTime: '15 mins' },
            { id: 'q-02', match: 'David Nguyen (VT) vs Brian Zhao (UVA)', division: "Consolation 3rd Place", estTime: '45 mins' }
        ]
    },
    {
        courtNumber: 2,
        courtName: 'RAC Court 2',
        status: 'WARMUP',
        division: "Women's Singles - Championship Final",
        elapsedSeconds: 0,
        warmupRemaining: 142, // 2m 22s
        estimatedDurationMinutes: 35,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: {
            id: 'm-rac-02',
            player1: { name: 'Rachel Adams (GMU)', seed: 1, score: 0, isServing: true },
            player2: { name: 'Chloe Zhang (UVA)', seed: 2, score: 0, isServing: false },
            gameScores: [],
            gameNumber: 1
        },
        queue: [
            { id: 'q-03', match: 'Emily Watson (UMD) vs Serena Patel (VT)', division: "Women's Singles 3rd Place", estTime: '20 mins' }
        ]
    },
    {
        courtNumber: 3,
        courtName: 'RAC Court 3',
        status: 'AVAILABLE',
        division: "Mixed Doubles - Quarterfinals",
        elapsedSeconds: 0,
        warmupRemaining: 0,
        estimatedDurationMinutes: 30,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: null,
        queue: [
            { id: 'q-04', match: 'Yang / Adams (GMU) vs Lin / Patel (UMD)', division: "Mixed Doubles QF", estTime: 'Immediate' },
            { id: 'q-05', match: 'Chen / Zhang (GMU/UVA) vs Wu / Song (GWU)', division: "Mixed Doubles QF", estTime: '30 mins' }
        ]
    },
    {
        courtNumber: 4,
        courtName: 'RAC Court 4',
        status: 'MATCH_IN_PROGRESS',
        division: "Men's Singles Consolation",
        elapsedSeconds: 760, // ~12m 40s
        warmupRemaining: 0,
        estimatedDurationMinutes: 25,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: {
            id: 'm-rac-04',
            player1: { name: 'David Nguyen (VT)', seed: 8, score: 14, isServing: false },
            player2: { name: 'Eric Song (Hopkins)', seed: 6, score: 11, isServing: true },
            gameScores: [[14, 11]],
            gameNumber: 1
        },
        queue: [
            { id: 'q-06', match: 'Jason Wu (GWU) vs Brian Zhao (UVA)', division: "Men's Singles Consolation", estTime: '25 mins' }
        ]
    },
    {
        courtNumber: 5,
        courtName: 'RAC Court 5',
        status: 'AVAILABLE',
        division: "Men's Doubles Open",
        elapsedSeconds: 0,
        warmupRemaining: 0,
        estimatedDurationMinutes: 35,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: null,
        queue: [
            { id: 'q-07', match: 'Tran / Wu vs Song / Zhao', division: "Men's Doubles Round 1", estTime: 'Immediate' }
        ]
    },
    {
        courtNumber: 6,
        courtName: 'RAC Court 6',
        status: 'MAINTENANCE',
        division: 'Net Inspection & Floor Calibration',
        elapsedSeconds: 0,
        warmupRemaining: 0,
        estimatedDurationMinutes: 0,
        pacingSecondsPerPoint: 28,
        walkoverTimer: { active: false },
        isStalled: false,
        stallReason: null,
        currentMatch: null,
        queue: []
    }
];

export default function CourtQueueViewer({ onSelectMatchForUmpire = null }) {
    const theme = useTheme();
    const [courts, setCourts] = useState(INITIAL_COURTS);
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'IN_PROGRESS' | 'AVAILABLE' | 'WARMUP'
    const [lastUpdated, setLastUpdated] = useState(() => new Date());

    // Timer interval: advances match elapsed seconds, decrements warmup timers, and updates walkover timers
    useEffect(() => {
        const timer = setInterval(() => {
            setCourts(prevCourts =>
                prevCourts.map(court => {
                    let updated = { ...court };
                    if (court.status === 'MATCH_IN_PROGRESS') {
                        updated.elapsedSeconds = court.elapsedSeconds + 1;
                    }
                    if (court.status === 'WARMUP' && court.warmupRemaining > 0) {
                        const nextWarmup = court.warmupRemaining - 1;
                        if (nextWarmup === 0) {
                            updated.status = 'MATCH_IN_PROGRESS';
                            updated.warmupRemaining = 0;
                            updated.elapsedSeconds = 1;
                        } else {
                            updated.warmupRemaining = nextWarmup;
                        }
                    }
                    if (court.walkoverTimer?.active) {
                        const remaining = court.walkoverTimer.expiresAt
                            ? Math.max(0, Math.floor((new Date(court.walkoverTimer.expiresAt) - Date.now()) / 1000))
                            : Math.max(0, (court.walkoverTimer.remainingSeconds !== undefined ? court.walkoverTimer.remainingSeconds : (court.walkoverTimer.durationSeconds || 600)) - 1);
                        updated.walkoverTimer = { ...court.walkoverTimer, remainingSeconds: remaining };
                    }
                    return updated;
                })
            );
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Socket.io Real-Time Synchronization
    useEffect(() => {
        const handleCourtStatusUpdate = (update) => {
            if (!update || !update.courtNumber) return;
            setCourts(prev =>
                prev.map(c => {
                    if (c.courtNumber === update.courtNumber) {
                        return {
                            ...c,
                            status: update.status || c.status,
                            currentMatch: update.currentMatch !== undefined ? update.currentMatch : c.currentMatch,
                            warmupRemaining: update.warmupRemaining !== undefined ? update.warmupRemaining : c.warmupRemaining,
                            elapsedSeconds: update.elapsedSeconds !== undefined ? update.elapsedSeconds : c.elapsedSeconds,
                            estimatedDurationMinutes: update.estimatedDurationMinutes !== undefined ? update.estimatedDurationMinutes : c.estimatedDurationMinutes,
                            pacingSecondsPerPoint: update.pacingSecondsPerPoint !== undefined ? update.pacingSecondsPerPoint : c.pacingSecondsPerPoint,
                            walkoverTimer: update.walkoverTimer !== undefined ? update.walkoverTimer : c.walkoverTimer,
                            isStalled: update.isStalled !== undefined ? update.isStalled : c.isStalled,
                            stallReason: update.stallReason !== undefined ? update.stallReason : c.stallReason
                        };
                    }
                    return c;
                })
            );
            setLastUpdated(new Date());
        };

        const handleLiveScoreUpdate = (scoreUpdate) => {
            if (!scoreUpdate || !scoreUpdate.courtNumber) return;
            setCourts(prev =>
                prev.map(c => {
                    if (c.courtNumber === scoreUpdate.courtNumber && c.currentMatch) {
                        return {
                            ...c,
                            currentMatch: {
                                ...c.currentMatch,
                                player1: {
                                    ...c.currentMatch.player1,
                                    score: scoreUpdate.currentScore?.team1 ?? c.currentMatch.player1.score,
                                    isServing: scoreUpdate.server === 'team1'
                                },
                                player2: {
                                    ...c.currentMatch.player2,
                                    score: scoreUpdate.currentScore?.team2 ?? c.currentMatch.player2.score,
                                    isServing: scoreUpdate.server === 'team2'
                                },
                                gameScores: scoreUpdate.gameScores || c.currentMatch.gameScores,
                                gameNumber: scoreUpdate.gameNumber || c.currentMatch.gameNumber
                            }
                        };
                    }
                    return c;
                })
            );
            setLastUpdated(new Date());
        };

        const handleWalkoverStarted = (data) => {
            if (!data || !data.courtNumber) return;
            setCourts(prev =>
                prev.map(c => {
                    if (c.courtNumber === data.courtNumber) {
                        return {
                            ...c,
                            walkoverTimer: {
                                active: true,
                                targetTeam: data.targetTeam,
                                targetPlayerName: data.targetPlayerName || data.playerName,
                                startedAt: data.startedAt,
                                expiresAt: data.expiresAt,
                                durationSeconds: data.durationSeconds || 600,
                                remainingSeconds: data.durationSeconds || 600
                            }
                        };
                    }
                    return c;
                })
            );
            setLastUpdated(new Date());
        };

        const handleWalkoverEnded = (data) => {
            if (!data || !data.courtNumber) return;
            setCourts(prev =>
                prev.map(c => {
                    if (c.courtNumber === data.courtNumber) {
                        return {
                            ...c,
                            walkoverTimer: { active: false }
                        };
                    }
                    return c;
                })
            );
            setLastUpdated(new Date());
        };

        socket.on('courtStatusUpdate', handleCourtStatusUpdate);
        socket.on('liveScoreUpdate', handleLiveScoreUpdate);
        socket.on('walkoverTimerStarted', handleWalkoverStarted);
        socket.on('walkoverTimerCancelled', handleWalkoverEnded);
        socket.on('walkoverDeclared', handleWalkoverEnded);

        return () => {
            socket.off('courtStatusUpdate', handleCourtStatusUpdate);
            socket.off('liveScoreUpdate', handleLiveScoreUpdate);
            socket.off('walkoverTimerStarted', handleWalkoverStarted);
            socket.off('walkoverTimerCancelled', handleWalkoverEnded);
            socket.off('walkoverDeclared', handleWalkoverEnded);
        };
    }, []);

    // Format MM:SS helper
    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // "Call Next Match" action
    const handleCallNextMatch = useCallback((courtNumber) => {
        setCourts(prev =>
            prev.map(c => {
                if (c.courtNumber === courtNumber) {
                    const nextInQueue = c.queue[0];
                    if (!nextInQueue) {
                        return { ...c, status: 'AVAILABLE', currentMatch: null, warmupRemaining: 0 };
                    }
                    const remainingQueue = c.queue.slice(1);
                    const players = nextInQueue.match.split(' vs ');
                    const newMatch = {
                        id: `match-${Date.now()}`,
                        player1: { name: players[0] || 'Player 1', score: 0, isServing: true },
                        player2: { name: players[1] || 'Player 2', score: 0, isServing: false },
                        gameScores: [],
                        gameNumber: 1
                    };

                    const updatedCourt = {
                        ...c,
                        status: 'WARMUP',
                        division: nextInQueue.division,
                        currentMatch: newMatch,
                        warmupRemaining: 180, // 3:00 official BWF warmup
                        elapsedSeconds: 0,
                        queue: remainingQueue
                    };

                    // Broadcast via Socket.io
                    socket.emit('courtStatusUpdate', {
                        courtNumber,
                        status: 'WARMUP',
                        currentMatch: newMatch,
                        warmupRemaining: 180,
                        division: nextInQueue.division
                    });

                    return updatedCourt;
                }
                return c;
            })
        );
    }, []);

    // Change status manually (e.g. Set Maintenance / Set Available)
    const handleSetCourtStatus = useCallback((courtNumber, newStatus) => {
        setCourts(prev =>
            prev.map(c => {
                if (c.courtNumber === courtNumber) {
                    const updated = {
                        ...c,
                        status: newStatus,
                        currentMatch: newStatus === 'MAINTENANCE' || newStatus === 'AVAILABLE' ? null : c.currentMatch
                    };
                    socket.emit('courtStatusUpdate', {
                        courtNumber,
                        status: newStatus,
                        currentMatch: updated.currentMatch
                    });
                    return updated;
                }
                return c;
            })
        );
    }, []);

    // Filter courts
    const filteredCourts = courts.filter(c => {
        if (filterStatus === 'ALL') return true;
        return c.status === filterStatus;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'AVAILABLE': return 'success';
            case 'WARMUP': return 'warning';
            case 'MATCH_IN_PROGRESS': return 'info';
            case 'MAINTENANCE': return 'default';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ width: '100%' }} data-testid="court-queue-viewer">
            {/* Top Bar Header */}
            <Paper
                elevation={1}
                sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`
                }}
            >
                <Box>
                    <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SportsTennisIcon color="primary" /> RAC Gymnasium Courts 1–6 Scheduling Hub
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        George Mason University Linn Gym • Live Court Status & Real-Time On-Deck Queue
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip
                        label="All (6)"
                        clickable
                        color={filterStatus === 'ALL' ? 'primary' : 'default'}
                        onClick={() => setFilterStatus('ALL')}
                        size="small"
                    />
                    <Chip
                        label="Live Matches"
                        clickable
                        color={filterStatus === 'MATCH_IN_PROGRESS' ? 'info' : 'default'}
                        onClick={() => setFilterStatus('MATCH_IN_PROGRESS')}
                        size="small"
                    />
                    <Chip
                        label="Warmup"
                        clickable
                        color={filterStatus === 'WARMUP' ? 'warning' : 'default'}
                        onClick={() => setFilterStatus('WARMUP')}
                        size="small"
                    />
                    <Chip
                        label="Available"
                        clickable
                        color={filterStatus === 'AVAILABLE' ? 'success' : 'default'}
                        onClick={() => setFilterStatus('AVAILABLE')}
                        size="small"
                    />
                    <Tooltip title="Reset or Refresh Courts">
                        <IconButton size="small" onClick={() => setCourts(INITIAL_COURTS)} aria-label="Refresh courts">
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Paper>

            {/* Courts Grid */}
            <Grid container spacing={2.5}>
                {filteredCourts.map(court => (
                    <Grid item xs={12} sm={6} md={4} key={court.courtNumber}>
                        <Paper
                            elevation={3}
                            data-testid={`court-card-${court.courtNumber}`}
                            sx={{
                                p: 2,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                borderRadius: 2.5,
                                border: court.status === 'MATCH_IN_PROGRESS'
                                    ? `2px solid ${theme.palette.info.main}`
                                    : court.status === 'WARMUP'
                                        ? `2px solid ${theme.palette.warning.main}`
                                        : `1px solid ${theme.palette.divider}`,
                                bgcolor: 'background.paper',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: theme.shadows[6]
                                }
                            }}
                        >
                            {/* Card Top: Court Title & Status Badge */}
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            {court.courtName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {court.division}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        size="small"
                                        label={court.status.replace(/_/g, ' ')}
                                        color={getStatusColor(court.status)}
                                        data-testid={`status-badge-court-${court.courtNumber}`}
                                        sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                                    />
                                </Box>

                                {/* Walkover Countdown Badge */}
                                {court.walkoverTimer?.active && (
                                    <Box sx={{ mb: 1.5 }}>
                                        <Chip
                                            color="error"
                                            size="small"
                                            icon={<AccessTimeIcon />}
                                            label={`WALKOVER: ${court.walkoverTimer.targetPlayerName || court.walkoverTimer.targetTeam || 'Player'} (${formatTime(court.walkoverTimer.remainingSeconds !== undefined ? court.walkoverTimer.remainingSeconds : (court.walkoverTimer.durationSeconds || 600))})`}
                                            data-testid={`walkover-chip-court-${court.courtNumber}`}
                                            sx={{ fontWeight: 'bold' }}
                                        />
                                    </Box>
                                )}

                                {/* Deadlock Stalled Alert */}
                                {court.isStalled && (
                                    <Alert
                                        severity="error"
                                        sx={{ mb: 1.5, py: 0.5, fontWeight: 'bold' }}
                                        data-testid={`deadlock-alert-court-${court.courtNumber}`}
                                    >
                                        ⚠️ Stalled: {court.stallReason || '>30m no score'}
                                    </Alert>
                                )}

                                {/* Active Timer & Dynamic Pacing Badge */}
                                {court.status === 'MATCH_IN_PROGRESS' && (
                                    <Box sx={{ mb: 1.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <AccessTimeIcon fontSize="small" color="info" />
                                            <Typography variant="body2" fontWeight="bold" color="info.main">
                                                Match Elapsed: {formatTime(court.elapsedSeconds)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} data-testid={`pacing-estimate-court-${court.courtNumber}`}>
                                            Est. ~{court.estimatedDurationMinutes || 18} mins remaining ({court.pacingSecondsPerPoint || 28}s/pt pacing)
                                        </Typography>
                                    </Box>
                                )}
                                {court.status === 'WARMUP' && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                                        <NotificationsActiveIcon fontSize="small" color="warning" />
                                        <Typography variant="body2" fontWeight="bold" color="warning.main">
                                            Warmup Timer: {formatTime(court.warmupRemaining)} remaining
                                        </Typography>
                                    </Box>
                                )}

                                <Divider sx={{ my: 1 }} />

                                {/* Assigned Match Snapshot */}
                                {court.currentMatch ? (
                                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: theme.palette.action.hover, mb: 1.5 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" gutterBottom>
                                            ACTIVE MATCH • GAME {court.currentMatch.gameNumber}
                                        </Typography>

                                        {/* Player 1 Row */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="body2" fontWeight={court.currentMatch.player1.isServing ? 'bold' : 'normal'}>
                                                {court.currentMatch.player1.isServing && '🏸 '}
                                                {court.currentMatch.player1.seed && `#${court.currentMatch.player1.seed} `}
                                                {court.currentMatch.player1.name}
                                            </Typography>
                                            <Typography variant="h6" fontWeight="bold" color="primary">
                                                {court.currentMatch.player1.score}
                                            </Typography>
                                        </Box>

                                        {/* Player 2 Row */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" fontWeight={court.currentMatch.player2.isServing ? 'bold' : 'normal'}>
                                                {court.currentMatch.player2.isServing && '🏸 '}
                                                {court.currentMatch.player2.seed && `#${court.currentMatch.player2.seed} `}
                                                {court.currentMatch.player2.name}
                                            </Typography>
                                            <Typography variant="h6" fontWeight="bold" color="primary">
                                                {court.currentMatch.player2.score}
                                            </Typography>
                                        </Box>

                                        {court.currentMatch.gameScores?.length > 0 && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                Sets: {court.currentMatch.gameScores.map(s => `${s[0]}-${s[1]}`).join(', ')}
                                            </Typography>
                                        )}
                                    </Paper>
                                ) : (
                                    <Alert severity={court.status === 'MAINTENANCE' ? 'info' : 'success'} sx={{ mb: 1.5, py: 0.5 }}>
                                        {court.status === 'MAINTENANCE' ? 'Court temporarily closed for maintenance' : 'Court is open and ready for match assignment'}
                                    </Alert>
                                )}

                                {/* Waiting Queue: On Deck & In The Hole */}
                                <Box sx={{ mb: 1.5 }}>
                                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                        <QueueIcon sx={{ fontSize: '0.85rem' }} /> Queued Matches ({court.queue.length})
                                    </Typography>
                                    {court.queue.length > 0 ? (
                                        <Stack spacing={0.5}>
                                            {court.queue.map((q, idx) => (
                                                <Paper
                                                    key={q.id}
                                                    variant="outlined"
                                                    sx={{
                                                        p: 0.75,
                                                        borderRadius: 1,
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        fontSize: '0.75rem',
                                                        bgcolor: 'background.default'
                                                    }}
                                                >
                                                    <Box sx={{ maxWidth: '75%' }}>
                                                        <Typography variant="caption" fontWeight="bold" noWrap display="block">
                                                            {idx === 0 ? 'On Deck: ' : 'In Hole: '}
                                                            {q.match}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                            {q.division}
                                                        </Typography>
                                                    </Box>
                                                    <Chip size="small" label={q.estTime} sx={{ height: 18, fontSize: '0.65rem' }} />
                                                </Paper>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                            No matches currently in queue
                                        </Typography>
                                    )}
                                </Box>
                            </Box>

                            {/* Card Bottom: Actions */}
                            <Box sx={{ pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                                <Stack direction="row" spacing={1} justifyContent="space-between">
                                    <Button
                                        variant="contained"
                                        size="small"
                                        color="primary"
                                        fullWidth
                                        startIcon={<PlayArrowIcon />}
                                        onClick={() => handleCallNextMatch(court.courtNumber)}
                                        disabled={court.queue.length === 0}
                                        data-testid={`btn-call-next-${court.courtNumber}`}
                                        sx={{ textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Call Next Match
                                    </Button>

                                    {court.currentMatch && onSelectMatchForUmpire && (
                                        <Tooltip title="Score this match in Umpire Pad">
                                            <IconButton
                                                size="small"
                                                color="secondary"
                                                onClick={() => onSelectMatchForUmpire(court)}
                                                data-testid={`btn-umpire-court-${court.courtNumber}`}
                                            >
                                                <SportsTennisIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )}

                                    {court.status === 'MAINTENANCE' ? (
                                        <Tooltip title="Mark Court Available">
                                            <IconButton
                                                size="small"
                                                color="success"
                                                onClick={() => handleSetCourtStatus(court.courtNumber, 'AVAILABLE')}
                                                aria-label="Mark available"
                                            >
                                                <CheckCircleIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Set Maintenance Mode">
                                            <IconButton
                                                size="small"
                                                color="default"
                                                onClick={() => handleSetCourtStatus(court.courtNumber, 'MAINTENANCE')}
                                                aria-label="Set maintenance"
                                            >
                                                <BuildIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Stack>
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Sync Timestamp Footer */}
            <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                    Real-time WebSocket connection active • Last synchronized: {lastUpdated.toLocaleTimeString()}
                </Typography>
            </Box>
        </Box>
    );
}
