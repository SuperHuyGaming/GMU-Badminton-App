import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, Paper, Grid, Button, Stack, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Select, MenuItem, FormControl, InputLabel, Alert, useTheme
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import TimerIcon from '@mui/icons-material/Timer';
import socket from '../utils/socket';
import offlineScoreLedger from '../utils/offlineScoreLedger';
import {
    calculateServiceCourt,
    isDeuce,
    checkGameWinner,
    getGamePoint,
    getMatchPoint,
    isInterval
} from '../utils/badmintonRules';

export default function UmpireDigitalPad({
    initialCourtNumber = 1,
    initialPlayer1 = 'Alan Yang (GMU)',
    initialPlayer2 = 'Kevin Lin (UMD)',
    onMatchComplete = null
}) {
    const theme = useTheme();

    // Match configuration
    const [courtNumber, setCourtNumber] = useState(initialCourtNumber);
    const [player1Name] = useState(initialPlayer1);
    const [player2Name] = useState(initialPlayer2);

    // Scoring state
    const [score1, setScore1] = useState(0);
    const [score2, setScore2] = useState(0);
    const [gamesWon1, setGamesWon1] = useState(0);
    const [gamesWon2, setGamesWon2] = useState(0);
    const [currentGame, setCurrentGame] = useState(1);
    const [completedGameScores, setCompletedGameScores] = useState([]); // [[21, 18], ...]

    // Server state: 1 (team 1) or 2 (team 2)
    const [currentServer, setCurrentServer] = useState(1);

    // Match lifecycle state: 'NOT_STARTED' | 'IN_PROGRESS' | 'INTERVAL' | 'GAME_OVER' | 'MATCH_OVER'
    const [matchStatus, setMatchStatus] = useState('IN_PROGRESS');
    const [matchWinner, setMatchWinner] = useState(null);

    // Undo history stack
    const [history, setHistory] = useState([]);
    // Redo history stack
    const [redoStack, setRedoStack] = useState([]);

    // Penalty / warning dialog
    const [penaltyNotice, setPenaltyNotice] = useState(null);

    // Problem 11: Offline Ledger and Connectivity Sync state
    const [syncStatus, setSyncStatus] = useState(
        typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE'
    );
    const [pendingCount, setPendingCount] = useState(0);

    // Problem 12: BWF Intervals (60s technical at 11, 120s between games)
    const [intervalCountdown, setIntervalCountdown] = useState(0);
    const [intervalType, setIntervalType] = useState(null); // 'TECHNICAL_11' | 'GAME_BREAK_120'

    // Side swap for Game 3 at 11 points (BWF Law 8.1.3)
    const isSideSwapped = useMemo(() => {
        return currentGame === 3 && (score1 >= 11 || score2 >= 11);
    }, [currentGame, score1, score2]);

    const flushOfflineQueue = useCallback(async () => {
        try {
            const pending = await offlineScoreLedger.getPendingMutations(courtNumber);
            if (!pending || pending.length === 0) {
                setSyncStatus('ONLINE');
                setPendingCount(0);
                return;
            }

            setSyncStatus('SYNCING');
            setPendingCount(pending.length);

            for (const mutation of pending) {
                try {
                    if (typeof fetch !== 'undefined') {
                        await fetch(`/api/courts/${courtNumber}/score/point`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                scoringTeam: mutation.payload?.team === 1 ? 'team1' : 'team2',
                                idempotencyKey: mutation.idempotencyKey
                            })
                        }).catch(() => {});
                    }
                    socket.emit('liveScoreUpdate', {
                        courtNumber,
                        idempotencyKey: mutation.idempotencyKey,
                        ...mutation.payload
                    });
                    await offlineScoreLedger.markMutationSynced(mutation.mutationId);
                } catch (mutErr) {
                    console.warn('[OfflineLedger] Replay mutation error:', mutErr);
                }
            }

            const remaining = await offlineScoreLedger.getPendingMutations(courtNumber);
            setPendingCount(remaining.length);
            setSyncStatus(remaining.length === 0 ? 'ONLINE' : 'OFFLINE');
        } catch (err) {
            console.warn('[OfflineLedger] Flush error:', err);
            setSyncStatus('OFFLINE');
        }
    }, [courtNumber]);

    // Network & Sync status listeners
    useEffect(() => {
        const handleOnline = async () => {
            setSyncStatus('SYNCING');
            await flushOfflineQueue();
        };

        const handleOffline = () => {
            setSyncStatus('OFFLINE');
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
        }

        offlineScoreLedger.getPendingMutations(courtNumber).then(pending => {
            if (pending && pending.length > 0) {
                setPendingCount(pending.length);
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    setSyncStatus('OFFLINE');
                }
            }
        }).catch(() => {});

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            }
        };
    }, [courtNumber, flushOfflineQueue]);

    // Interval countdown timer tick
    useEffect(() => {
        if (intervalCountdown <= 0) return;
        const timer = setInterval(() => {
            setIntervalCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [intervalCountdown]);

    // Calculated BWF rule helpers
    const serverScore = currentServer === 1 ? score1 : score2;
    const serverCourt = useMemo(() => calculateServiceCourt(serverScore), [serverScore]);
    // Receiver court is diagonal to server court
    const receiverCourt = serverCourt; // In badminton geometry, right serves to right (diagonal), left serves to left (diagonal)

    const isCurrentDeuce = useMemo(() => isDeuce(score1, score2), [score1, score2]);
    const gamePointSide = useMemo(() => getGamePoint(score1, score2), [score1, score2]);
    const matchPointSide = useMemo(
        () => getMatchPoint(score1, score2, gamesWon1, gamesWon2, 2),
        [score1, score2, gamesWon1, gamesWon2]
    );
    const isIntervalActive = useMemo(() => isInterval(score1, score2), [score1, score2]);

    // Emit live score updates over Socket.io
    const emitScoreUpdate = useCallback((s1, s2, gWon1, gWon2, cGame, server, gScores, status) => {
        const payload = {
            courtNumber,
            matchId: `m-rac-court-${courtNumber}`,
            gameNumber: cGame,
            currentScore: { team1: s1, team2: s2 },
            gamesWon: { team1: gWon1, team2: gWon2 },
            gameScores: gScores,
            server: server === 1 ? 'team1' : 'team2',
            serverCourt: calculateServiceCourt(server === 1 ? s1 : s2),
            receiver: server === 1 ? 'team2' : 'team1',
            status,
            timestamp: new Date().toISOString()
        };

        socket.emit('liveScoreUpdate', payload);
        socket.emit('umpire:scoreUpdate', payload);
    }, [courtNumber]);

    // Snapshot state for undo
    const pushHistory = useCallback(() => {
        setHistory(prev => [
            ...prev,
            {
                score1,
                score2,
                gamesWon1,
                gamesWon2,
                currentGame,
                completedGameScores,
                currentServer,
                matchStatus,
                matchWinner
            }
        ]);
    }, [score1, score2, gamesWon1, gamesWon2, currentGame, completedGameScores, currentServer, matchStatus, matchWinner]);

    // Point scoring action
    const handleScorePoint = useCallback((team) => {
        if (matchStatus === 'MATCH_OVER' || matchStatus === 'GAME_OVER') return;
        if (score1 >= 30 || score2 >= 30) return;

        pushHistory();
        setRedoStack([]);

        let nextScore1 = score1;
        let nextScore2 = score2;
        const nextServer = team === 1 ? 1 : 2;

        if (team === 1) {
            nextScore1 = score1 + 1;
        } else {
            nextScore2 = score2 + 1;
        }

        setScore1(nextScore1);
        setScore2(nextScore2);
        setCurrentServer(nextServer);

        // Problem 11: Local ledger persistence and offline queuing
        const idempotencyKey = `court-${courtNumber}-pt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        offlineScoreLedger.saveMatchState({
            courtNumber,
            score1: nextScore1,
            score2: nextScore2,
            gamesWon1,
            gamesWon2,
            currentGame,
            currentServer: nextServer,
            matchStatus
        }).catch(() => {});

        if (typeof navigator !== 'undefined' && (!navigator.onLine || syncStatus === 'OFFLINE')) {
            offlineScoreLedger.enqueueMutation({
                courtNumber,
                matchId: `m-rac-court-${courtNumber}`,
                idempotencyKey,
                actionType: 'SCORE_POINT',
                payload: { team, score1: nextScore1, score2: nextScore2, currentGame }
            }).then(() => {
                offlineScoreLedger.getPendingMutations(courtNumber).then(muts => {
                    setPendingCount(muts.length);
                    setSyncStatus('OFFLINE');
                });
            }).catch(() => {});
        }

        // Problem 12: 60s Technical interval at 11 points (Law 16.2.1)
        if (Math.max(nextScore1, nextScore2) === 11 && Math.min(nextScore1, nextScore2) < 11) {
            setIntervalType('TECHNICAL_11');
            setIntervalCountdown(60);
        }

        // Check if game has ended
        const winner = checkGameWinner(nextScore1, nextScore2);
        if (winner) {
            const nextGW1 = winner === 1 ? gamesWon1 + 1 : gamesWon1;
            const nextGW2 = winner === 2 ? gamesWon2 + 1 : gamesWon2;
            const nextGameScores = [...completedGameScores, [nextScore1, nextScore2]];

            setCompletedGameScores(nextGameScores);

            if (nextGW1 === 2 || nextGW2 === 2) {
                // Match Won!
                const mWinner = nextGW1 === 2 ? player1Name : player2Name;
                setGamesWon1(nextGW1);
                setGamesWon2(nextGW2);
                setMatchStatus('MATCH_OVER');
                setMatchWinner(mWinner);
                setIntervalCountdown(0);

                emitScoreUpdate(nextScore1, nextScore2, nextGW1, nextGW2, currentGame, nextServer, nextGameScores, 'MATCH_OVER');
                if (onMatchComplete) onMatchComplete({ winner: mWinner, scores: nextGameScores });
            } else {
                // Game Won, waiting for next game: 120s Game Break Interval (Law 16.2.2)
                setGamesWon1(nextGW1);
                setGamesWon2(nextGW2);
                setMatchStatus('GAME_OVER');
                setIntervalType('GAME_BREAK_120');
                setIntervalCountdown(120);

                emitScoreUpdate(nextScore1, nextScore2, nextGW1, nextGW2, currentGame, nextServer, nextGameScores, 'GAME_OVER');
            }
        } else {
            emitScoreUpdate(nextScore1, nextScore2, gamesWon1, gamesWon2, currentGame, nextServer, completedGameScores, 'IN_PROGRESS');
        }
    }, [score1, score2, gamesWon1, gamesWon2, completedGameScores, currentGame, matchStatus, player1Name, player2Name, pushHistory, emitScoreUpdate, onMatchComplete, courtNumber, syncStatus]);

    // Undo last action
    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));

        setRedoStack(prev => [
            ...prev,
            {
                score1,
                score2,
                gamesWon1,
                gamesWon2,
                currentGame,
                completedGameScores,
                currentServer,
                matchStatus,
                matchWinner
            }
        ]);

        setScore1(last.score1);
        setScore2(last.score2);
        setGamesWon1(last.gamesWon1);
        setGamesWon2(last.gamesWon2);
        setCurrentGame(last.currentGame);
        setCompletedGameScores(last.completedGameScores);
        setCurrentServer(last.currentServer);
        setMatchStatus(last.matchStatus);
        setMatchWinner(last.matchWinner);

        emitScoreUpdate(
            last.score1,
            last.score2,
            last.gamesWon1,
            last.gamesWon2,
            last.currentGame,
            last.currentServer,
            last.completedGameScores,
            last.matchStatus
        );
    }, [history, score1, score2, gamesWon1, gamesWon2, currentGame, completedGameScores, currentServer, matchStatus, matchWinner, emitScoreUpdate]);

    // Redo last undone action
    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));

        setHistory(prev => [
            ...prev,
            {
                score1,
                score2,
                gamesWon1,
                gamesWon2,
                currentGame,
                completedGameScores,
                currentServer,
                matchStatus,
                matchWinner
            }
        ]);

        setScore1(next.score1);
        setScore2(next.score2);
        setGamesWon1(next.gamesWon1);
        setGamesWon2(next.gamesWon2);
        setCurrentGame(next.currentGame);
        setCompletedGameScores(next.completedGameScores);
        setCurrentServer(next.currentServer);
        setMatchStatus(next.matchStatus);
        setMatchWinner(next.matchWinner);

        emitScoreUpdate(
            next.score1,
            next.score2,
            next.gamesWon1,
            next.gamesWon2,
            next.currentGame,
            next.currentServer,
            next.completedGameScores,
            next.matchStatus
        );
    }, [redoStack, score1, score2, gamesWon1, gamesWon2, currentGame, completedGameScores, currentServer, matchStatus, matchWinner, emitScoreUpdate]);

    // Start Next Game
    const handleStartNextGame = useCallback(() => {
        if (matchStatus !== 'GAME_OVER') return;
        pushHistory();
        setRedoStack([]);
        setScore1(0);
        setScore2(0);
        setCurrentGame(prev => prev + 1);
        setMatchStatus('IN_PROGRESS');
        // Winner of previous game serves first in next game
        emitScoreUpdate(0, 0, gamesWon1, gamesWon2, currentGame + 1, currentServer, completedGameScores, 'IN_PROGRESS');
    }, [matchStatus, pushHistory, gamesWon1, gamesWon2, currentGame, currentServer, completedGameScores, emitScoreUpdate]);

    // Manual Service Over toggle
    const handleServiceOver = useCallback(() => {
        pushHistory();
        setRedoStack([]);
        const nextServer = currentServer === 1 ? 2 : 1;
        setCurrentServer(nextServer);
        emitScoreUpdate(score1, score2, gamesWon1, gamesWon2, currentGame, nextServer, completedGameScores, matchStatus);
    }, [currentServer, pushHistory, score1, score2, gamesWon1, gamesWon2, currentGame, completedGameScores, matchStatus, emitScoreUpdate]);

    // Reset Match
    const handleResetMatch = useCallback(() => {
        setScore1(0);
        setScore2(0);
        setGamesWon1(0);
        setGamesWon2(0);
        setCurrentGame(1);
        setCompletedGameScores([]);
        setCurrentServer(1);
        setMatchStatus('IN_PROGRESS');
        setMatchWinner(null);
        setHistory([]);
        setRedoStack([]);
        emitScoreUpdate(0, 0, 0, 0, 1, 1, [], 'IN_PROGRESS');
    }, [emitScoreUpdate]);

    return (
        <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto' }} data-testid="umpire-digital-pad">
            {/* Top Config & Court Selector */}
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2.5,
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
                        <SportsScoreIcon color="primary" /> Official Touch Umpire Pad
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        BWF Standard 3x21 Rally Point System with 2-Point Clear Margin (Sudden Death at 30)
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1.5} alignItems="center">
                    {syncStatus === 'ONLINE' && (
                        <Chip
                            icon={<WifiIcon />}
                            label="Online (RAC Wi-Fi)"
                            color="success"
                            size="small"
                            data-testid="sync-status-online"
                        />
                    )}
                    {syncStatus === 'SYNCING' && (
                        <Chip
                            icon={<SyncIcon />}
                            label={`Syncing ${pendingCount} points...`}
                            color="warning"
                            size="small"
                            data-testid="sync-status-syncing"
                        />
                    )}
                    {syncStatus === 'OFFLINE' && (
                        <Chip
                            icon={<WifiOffIcon />}
                            label={`Offline (${pendingCount} queued in Ledger)`}
                            color="error"
                            size="small"
                            data-testid="sync-status-offline"
                        />
                    )}

                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel id="court-select-label">RAC Court</InputLabel>
                        <Select
                            labelId="court-select-label"
                            value={courtNumber}
                            label="RAC Court"
                            onChange={(e) => setCourtNumber(Number(e.target.value))}
                            data-testid="court-select"
                        >
                            {[1, 2, 3, 4, 5, 6].map(num => (
                                <MenuItem key={num} value={num}>RAC Court {num}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={handleResetMatch}
                    >
                        Reset
                    </Button>
                </Stack>
            </Paper>

            {/* Critical Alert Banners: Match Point, Game Point, Deuce, Interval */}
            {intervalCountdown > 0 && (
                <Alert
                    severity="info"
                    icon={<TimerIcon />}
                    action={
                        <Button color="inherit" size="small" onClick={() => setIntervalCountdown(0)}>
                            Resume Early
                        </Button>
                    }
                    sx={{ mb: 2, fontWeight: 'bold', py: 0.5 }}
                    data-testid="interval-countdown-timer"
                >
                    ⏱️ {intervalType === 'GAME_BREAK_120' ? '120s Game Break Interval' : '60s Technical Interval (11 Points)'}: {intervalCountdown}s remaining
                </Alert>
            )}

            {isSideSwapped && (
                <Alert severity="warning" sx={{ mb: 2, fontWeight: 'bold', py: 0.5 }} data-testid="game3-side-change-banner">
                    🔄 DECIDING GAME: CHANGE OF ENDS (11 Points)! Sides have been switched.
                </Alert>
            )}

            {score1 === 29 && score2 === 29 && (
                <Alert severity="error" sx={{ mb: 2, fontWeight: 'bold', py: 0.5 }} data-testid="golden-point-banner">
                    🔥 GOLDEN POINT (29-29) — Sudden death! Next point wins!
                </Alert>
            )}

            {matchStatus === 'MATCH_OVER' ? (
                <Alert
                    severity="success"
                    icon={<EmojiEventsIcon sx={{ fontSize: '1.5rem' }} />}
                    sx={{ mb: 2, fontSize: '1.1rem', fontWeight: 'bold' }}
                    data-testid="match-winner-alert"
                >
                    MATCH COMPLETE! Winner: {matchWinner} ({completedGameScores.map(s => `${s[0]}-${s[1]}`).join(', ')})
                </Alert>
            ) : matchStatus === 'GAME_OVER' ? (
                <Alert
                    severity="info"
                    action={
                        <Button color="inherit" size="small" variant="contained" onClick={handleStartNextGame} data-testid="btn-start-next-game">
                            Start Game {currentGame + 1}
                        </Button>
                    }
                    sx={{ mb: 2, fontSize: '1rem', fontWeight: 'bold' }}
                    data-testid="game-over-alert"
                >
                    Game {currentGame} Concluded! Leading sets: {player1Name} [{gamesWon1}] — [{gamesWon2}] {player2Name}
                </Alert>
            ) : (
                <Stack spacing={1} sx={{ mb: 2 }}>
                    {matchPointSide === 3 ? (
                        <Alert severity="error" sx={{ fontWeight: 'bold', py: 0.5 }} data-testid="alert-match-point">
                            🔥 GOLDEN MATCH POINT (29-29) — Sudden death! Next point wins the entire match!
                        </Alert>
                    ) : matchPointSide ? (
                        <Alert severity="error" sx={{ fontWeight: 'bold', py: 0.5 }} data-testid="alert-match-point">
                            🔥 MATCH POINT — {matchPointSide === 1 ? player1Name : player2Name} is 1 point away from Victory!
                        </Alert>
                    ) : null}
                    {!matchPointSide && gamePointSide === 3 ? (
                        <Alert severity="warning" sx={{ fontWeight: 'bold', py: 0.5 }} data-testid="alert-game-point">
                            ⚡ GOLDEN GAME POINT (29-29) — Sudden death! Next point wins Game {currentGame}!
                        </Alert>
                    ) : !matchPointSide && gamePointSide ? (
                        <Alert severity="warning" sx={{ fontWeight: 'bold', py: 0.5 }} data-testid="alert-game-point">
                            ⚡ GAME POINT — {gamePointSide === 1 ? player1Name : player2Name} is 1 point away from winning Game {currentGame}!
                        </Alert>
                    ) : null}
                    {isCurrentDeuce && (
                        <Alert severity="info" sx={{ fontWeight: 'bold', py: 0.5 }} data-testid="alert-deuce">
                            🤝 DEUCE ({score1}-{score2}) — Win by 2 points required (Capped at 30)!
                        </Alert>
                    )}
                    {isIntervalActive && (
                        <Alert severity="success" sx={{ fontWeight: 'bold', py: 0.5 }}>
                            ⏱️ 11-POINT INTERVAL — Official 60-second break for coaching and water.
                        </Alert>
                    )}
                </Stack>
            )}

            {/* Main Scoreboard Display */}
            <Paper
                elevation={4}
                sx={{
                    p: 2.5,
                    mb: 2.5,
                    borderRadius: 3,
                    bgcolor: theme.palette.mode === 'dark' ? '#0a1017' : '#1e293b',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                {/* Header sets tracker */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        RAC COURT {courtNumber} • BEST OF 3 GAMES
                    </Typography>
                    <Chip
                        label={`GAME ${currentGame} OF 3`}
                        color="primary"
                        sx={{ fontWeight: 'bold', letterSpacing: 0.5 }}
                    />
                </Box>

                {/* Big Score Numbers */}
                <Grid container spacing={2} alignItems="center">
                    {/* Team 1 Score Card */}
                    <Grid item xs={5} textAlign="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight="bold" noWrap sx={{ maxWidth: 200 }}>
                                {player1Name}
                            </Typography>
                            {currentServer === 1 && (
                                <Chip
                                    size="small"
                                    label="SERVING"
                                    color="success"
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }}
                                    data-testid="serving-badge-team1"
                                />
                            )}
                        </Box>
                        <Typography
                            variant="h1"
                            data-testid="score-team1"
                            sx={{
                                fontWeight: 900,
                                fontSize: { xs: '4rem', sm: '5.5rem' },
                                color: currentServer === 1 ? '#4ade80' : '#ffffff',
                                lineHeight: 1
                            }}
                        >
                            {score1}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                            Games Won: <strong>{gamesWon1}</strong>
                        </Typography>
                    </Grid>

                    {/* Middle VS and Sets Divider */}
                    <Grid item xs={2} textAlign="center">
                        <Typography variant="h5" sx={{ opacity: 0.4, fontWeight: 900 }}>
                            VS
                        </Typography>
                        {completedGameScores.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                {completedGameScores.map((s, idx) => (
                                    <Typography key={idx} variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                                        G{idx + 1}: {s[0]}-{s[1]}
                                    </Typography>
                                ))}
                            </Box>
                        )}
                    </Grid>

                    {/* Team 2 Score Card */}
                    <Grid item xs={5} textAlign="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            {currentServer === 2 && (
                                <Chip
                                    size="small"
                                    label="SERVING"
                                    color="success"
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }}
                                    data-testid="serving-badge-team2"
                                />
                            )}
                            <Typography variant="h6" fontWeight="bold" noWrap sx={{ maxWidth: 200 }}>
                                {player2Name}
                            </Typography>
                        </Box>
                        <Typography
                            variant="h1"
                            data-testid="score-team2"
                            sx={{
                                fontWeight: 900,
                                fontSize: { xs: '4rem', sm: '5.5rem' },
                                color: currentServer === 2 ? '#4ade80' : '#ffffff',
                                lineHeight: 1
                            }}
                        >
                            {score2}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                            Games Won: <strong>{gamesWon2}</strong>
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* 2D SVG Service Court Visualizer */}
            <Paper
                elevation={2}
                sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: 2.5,
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        🏸 BWF 2D Service Court Visualizer
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Server: <strong>{currentServer === 1 ? player1Name : player2Name}</strong> ({serverCourt.toUpperCase()} Court • Score {serverScore} is {serverScore % 2 === 0 ? 'EVEN' : 'ODD'})
                    </Typography>
                </Box>

                {/* SVG Badminton Court */}
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 620,
                        mx: 'auto',
                        aspectRatio: '2 / 1',
                        borderRadius: 2,
                        overflow: 'hidden',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)',
                        bgcolor: '#1b4d3e' // Forest court green
                    }}
                    data-testid="service-court-svg"
                >
                    <svg viewBox="0 0 600 300" style={{ width: '100%', height: '100%' }}>
                        {/* Court Outer Boundary (Doubles Line) */}
                        <rect x="20" y="20" width="560" height="260" fill="none" stroke="#ffffff" strokeWidth="3" />

                        {/* Singles Sidelines (top and bottom 20px in) */}
                        <line x1="20" y1="40" x2="580" y2="40" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 2" />
                        <line x1="20" y1="260" x2="580" y2="260" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 2" />

                        {/* Doubles Long Service Line (20px from baseline) */}
                        <line x1="45" y1="20" x2="45" y2="280" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 2" />
                        <line x1="555" y1="20" x2="555" y2="280" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 2" />

                        {/* Net Line (Center X = 300) */}
                        <line x1="300" y1="10" x2="300" y2="290" stroke="#fbbf24" strokeWidth="5" />
                        {/* Net posts */}
                        <circle cx="300" cy="15" r="4" fill="#fbbf24" />
                        <circle cx="300" cy="285" r="4" fill="#fbbf24" />

                        {/* Short Service Lines (45px on each side of the net: 255 and 345) */}
                        <line x1="245" y1="20" x2="245" y2="280" stroke="#ffffff" strokeWidth="2" />
                        <line x1="355" y1="20" x2="355" y2="280" stroke="#ffffff" strokeWidth="2" />

                        {/* Center Service Line (Y = 150) */}
                        {/* Team 1 Side Center Line (from baseline 20 to short service line 245) */}
                        <line x1="20" y1="150" x2="245" y2="150" stroke="#ffffff" strokeWidth="2" />
                        {/* Team 2 Side Center Line (from short service line 355 to baseline 580) */}
                        <line x1="355" y1="150" x2="580" y2="150" stroke="#ffffff" strokeWidth="2" />

                        {/* QUADRANT HIGHLIGHTS & LABELS */}
                        {/* In badminton perspective (facing net from baseline):
                            Team 1 (Left Side of SVG, facing right towards net):
                              Top quadrant (Y: 20 to 150): LEFT Service Court
                              Bottom quadrant (Y: 150 to 280): RIGHT Service Court
                            Team 2 (Right Side of SVG, facing left towards net):
                              Top quadrant (Y: 20 to 150): RIGHT Service Court
                              Bottom quadrant (Y: 150 to 280): LEFT Service Court
                        */}

                        {/* TEAM 1 & TEAM 2 QUADRANTS (ROTATES ON GAME 3 11-POINT SIDE CHANGE) */}
                        <g transform={isSideSwapped ? "rotate(180 300 150)" : undefined}>
                            {/* TEAM 1 SIDE QUADRANTS */}
                            {/* Left Service Court (Top) */}
                            <rect
                                x="20"
                                y="20"
                                width="225"
                                height="130"
                                fill={
                                    (currentServer === 1 && serverCourt === 'left')
                                        ? 'rgba(74, 222, 128, 0.4)'
                                        : (currentServer === 2 && receiverCourt === 'left')
                                            ? 'rgba(56, 189, 248, 0.35)'
                                            : 'transparent'
                                }
                            />
                            {/* Right Service Court (Bottom) */}
                            <rect
                                x="20"
                                y="150"
                                width="225"
                                height="130"
                                fill={
                                    (currentServer === 1 && serverCourt === 'right')
                                        ? 'rgba(74, 222, 128, 0.4)'
                                        : (currentServer === 2 && receiverCourt === 'right')
                                            ? 'rgba(56, 189, 248, 0.35)'
                                            : 'transparent'
                                }
                            />

                            {/* TEAM 2 SIDE QUADRANTS (DIAGONAL RECEIVING TARGETS) */}
                            {/* Right Service Court (Top - diagonal to Team 1 Right) */}
                            <rect
                                x="355"
                                y="20"
                                width="225"
                                height="130"
                                fill={
                                    (currentServer === 2 && serverCourt === 'right')
                                        ? 'rgba(74, 222, 128, 0.4)'
                                        : (currentServer === 1 && receiverCourt === 'right')
                                            ? 'rgba(56, 189, 248, 0.35)'
                                            : 'transparent'
                                }
                            />
                            {/* Left Service Court (Bottom - diagonal to Team 1 Left) */}
                            <rect
                                x="355"
                                y="150"
                                width="225"
                                height="130"
                                fill={
                                    (currentServer === 2 && serverCourt === 'left')
                                        ? 'rgba(74, 222, 128, 0.4)'
                                        : (currentServer === 1 && receiverCourt === 'left')
                                            ? 'rgba(56, 189, 248, 0.35)'
                                            : 'transparent'
                                }
                            />

                            {/* Active Serving Shuttlecock Graphic */}
                            {currentServer === 1 && (
                                <g transform={`translate(${serverCourt === 'right' ? 120 : 120}, ${serverCourt === 'right' ? 205 : 75})`}>
                                    <circle cx="0" cy="0" r="14" fill="#fbbf24" opacity="0.9" />
                                    <text x="0" y="5" textAnchor="middle" fontSize="13" fill="#000">🏸</text>
                                </g>
                            )}
                            {currentServer === 2 && (
                                <g transform={`translate(${serverCourt === 'right' ? 470 : 470}, ${serverCourt === 'right' ? 75 : 205})`}>
                                    <circle cx="0" cy="0" r="14" fill="#fbbf24" opacity="0.9" />
                                    <text x="0" y="5" textAnchor="middle" fontSize="13" fill="#000">🏸</text>
                                </g>
                            )}

                            {/* Player Labels in quadrants */}
                            <text x="120" y="90" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" opacity={currentServer === 1 && serverCourt === 'left' ? 1 : 0.6}>
                                {currentServer === 1 ? 'Left Court (Odd)' : 'Receiver (Odd)'}
                            </text>
                            <text x="120" y="220" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" opacity={currentServer === 1 && serverCourt === 'right' ? 1 : 0.6}>
                                {currentServer === 1 ? 'Right Court (Even)' : 'Receiver (Even)'}
                            </text>

                            <text x="470" y="90" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" opacity={currentServer === 2 && serverCourt === 'right' ? 1 : 0.6}>
                                {currentServer === 2 ? 'Right Court (Even)' : 'Receiver (Even)'}
                            </text>
                            <text x="470" y="220" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" opacity={currentServer === 2 && serverCourt === 'left' ? 1 : 0.6}>
                                {currentServer === 2 ? 'Left Court (Odd)' : 'Receiver (Odd)'}
                            </text>
                        </g>
                    </svg>
                </Box>
            </Paper>

            {/* LARGE THUMB TOUCH TARGETS (> 64px) */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                {/* Team 1 (+1 Point) Big Button */}
                <Grid item xs={6}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={() => handleScorePoint(1)}
                        disabled={matchStatus === 'MATCH_OVER' || matchStatus === 'GAME_OVER'}
                        data-testid="btn-score-team1"
                        sx={{
                            minHeight: { xs: 80, sm: 96 },
                            borderRadius: 3,
                            fontSize: { xs: '1.1rem', sm: '1.3rem' },
                            fontWeight: 900,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            boxShadow: theme.shadows[4]
                        }}
                    >
                        <span>+1 POINT</span>
                        <Typography variant="caption" sx={{ opacity: 0.9, textTransform: 'none', fontWeight: 'normal' }}>
                            {player1Name}
                        </Typography>
                    </Button>
                </Grid>

                {/* Team 2 (+1 Point) Big Button */}
                <Grid item xs={6}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={() => handleScorePoint(2)}
                        disabled={matchStatus === 'MATCH_OVER' || matchStatus === 'GAME_OVER'}
                        data-testid="btn-score-team2"
                        sx={{
                            minHeight: { xs: 80, sm: 96 },
                            borderRadius: 3,
                            fontSize: { xs: '1.1rem', sm: '1.3rem' },
                            fontWeight: 900,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            boxShadow: theme.shadows[4]
                        }}
                    >
                        <span>+1 POINT</span>
                        <Typography variant="caption" sx={{ opacity: 0.9, textTransform: 'none', fontWeight: 'normal' }}>
                            {player2Name}
                        </Typography>
                    </Button>
                </Grid>
            </Grid>

            {/* SECONDARY ACTION ROW: Undo, Service Over, Fault / Let */}
            <Stack direction="row" spacing={1.5} justifyContent="space-between" flexWrap="wrap" sx={{ mb: 2 }}>
                <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<UndoIcon />}
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    data-testid="btn-undo-point"
                    sx={{ minHeight: 48, fontWeight: 'bold', textTransform: 'none', flex: 1 }}
                >
                    Undo Point ({history.length})
                </Button>

                <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<RedoIcon />}
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    data-testid="btn-redo-point"
                    sx={{ minHeight: 48, fontWeight: 'bold', textTransform: 'none', flex: 1 }}
                >
                    Redo Point ({redoStack.length})
                </Button>

                <Button
                    variant="outlined"
                    color="info"
                    startIcon={<SwapHorizIcon />}
                    onClick={handleServiceOver}
                    disabled={matchStatus === 'MATCH_OVER' || matchStatus === 'GAME_OVER'}
                    data-testid="btn-service-over"
                    sx={{ minHeight: 48, fontWeight: 'bold', textTransform: 'none', flex: 1 }}
                >
                    Service Over
                </Button>

                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<WarningAmberIcon />}
                    onClick={() => setPenaltyNotice({ type: 'Warning', reason: 'Unsportsmanlike Delay' })}
                    sx={{ minHeight: 48, fontWeight: 'bold', textTransform: 'none' }}
                >
                    Fault / Card
                </Button>
            </Stack>

            {/* Penalty Notice Dialog */}
            <Dialog open={Boolean(penaltyNotice)} onClose={() => setPenaltyNotice(null)} disableRestoreFocus>
                <DialogTitle>Umpire Disciplinary Action</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" gutterBottom>
                        Issue an official card warning or fault to active player.
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 2 }}>
                        <Button variant="outlined" color="warning" onClick={() => setPenaltyNotice(null)}>
                            Yellow Card (Conduct Warning)
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => setPenaltyNotice(null)}>
                            Red Card (+1 Fault Point to Opponent)
                        </Button>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPenaltyNotice(null)}>Dismiss</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
