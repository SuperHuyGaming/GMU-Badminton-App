import { useState, useRef, useMemo, useCallback } from 'react';
import {
    Box, Typography, Paper, Chip, Button, ButtonGroup, Tooltip,
    Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Dialog, DialogTitle, DialogContent, DialogActions, Stack, useTheme, Alert
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GridOnIcon from '@mui/icons-material/GridOn';
import { motion } from 'framer-motion';

import {
    SAMPLE_TOURNAMENTS,
    SAMPLE_SINGLE_ELIMINATION,
    SAMPLE_DOUBLE_ELIMINATION,
    SAMPLE_ROUND_ROBIN,
    computeBracketLayout
} from '../utils/bracketData';
import { calculateRoundRobinStandings } from '../utils/badmintonRules';

export default function TournamentBracket({
    bracketData = null,
    rootMatch = null,
    onMatchSelect = null
}) {
    const theme = useTheme();

    // Tournament selection & format
    const [selectedTourneyId, setSelectedTourneyId] = useState('gmu-open-2026');
    const [drawFormat, setDrawFormat] = useState('SINGLE_ELIMINATION'); // 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN'
    const [doubleElimTab, setDoubleElimTab] = useState('winners'); // 'winners' | 'losers' | 'grand'
    const [mobileRoundTab, setMobileRoundTab] = useState(0);

    // Zoom & Pan state
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });

    // Selected match dialog state
    const [activeMatchDialog, setActiveMatchDialog] = useState(null);

    // Active draw data
    const activeData = useMemo(() => {
        if (bracketData) {
            return bracketData;
        }
        if (drawFormat === 'DOUBLE_ELIMINATION') {
            return SAMPLE_DOUBLE_ELIMINATION;
        }
        if (drawFormat === 'ROUND_ROBIN') {
            return SAMPLE_ROUND_ROBIN;
        }
        // Fallback or single elimination
        return SAMPLE_SINGLE_ELIMINATION;
    }, [bracketData, drawFormat]);

    // Handle rootMatch legacy prop if provided
    const legacySingleElimData = useMemo(() => {
        if (!rootMatch) return null;
        // Transform single rootMatch into rounds format
        const rounds = [];
        const traverse = (node, depth = 0) => {
            if (!rounds[depth]) rounds[depth] = { id: `r-${depth}`, name: depth === 0 ? 'Finals' : `Round ${depth}`, matches: [] };
            rounds[depth].matches.push({
                id: node.id || `node-${depth}-${rounds[depth].matches.length}`,
                team1: { name: node.player1 || 'TBD', score: node.score1 ?? 0, isWinner: node.winner === node.player1 },
                team2: { name: node.player2 || 'TBD', score: node.score2 ?? 0, isWinner: node.winner === node.player2 },
                status: node.winner ? 'COMPLETED' : 'SCHEDULED',
                winner: node.winner
            });
            if (node.nextMatches && node.nextMatches.length > 0) {
                node.nextMatches.forEach(child => traverse(child, depth + 1));
            }
        };
        traverse(rootMatch);
        rounds.reverse();
        return {
            tournamentName: 'Legacy Single Elimination Bracket',
            rounds
        };
    }, [rootMatch]);

    // Effective single elimination rounds
    const currentRounds = useMemo(() => {
        if (legacySingleElimData) return legacySingleElimData.rounds;
        if (drawFormat === 'DOUBLE_ELIMINATION') {
            if (doubleElimTab === 'winners') return activeData.winnersRounds || SAMPLE_DOUBLE_ELIMINATION.winnersRounds;
            if (doubleElimTab === 'losers') return activeData.losersRounds || SAMPLE_DOUBLE_ELIMINATION.losersRounds;
            const gf = activeData.grandFinals || SAMPLE_DOUBLE_ELIMINATION.grandFinals;
            return Array.isArray(gf) ? gf : [gf];
        }
        return activeData.rounds || SAMPLE_SINGLE_ELIMINATION.rounds;
    }, [legacySingleElimData, drawFormat, doubleElimTab, activeData]);

    // Geometric layout calculation
    const layout = useMemo(() => {
        return computeBracketLayout(currentRounds);
    }, [currentRounds]);

    // Pan & Zoom controls
    const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.15).toFixed(2)), 2.2));
    const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.4));
    const handleReset = () => {
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
    };
    const handleFitCenter = () => {
        setZoom(0.85);
        setPan({ x: 20, y: 10 });
    };

    // Pointer events for panning
    const onPointerDown = (e) => {
        // Only primary mouse button or touch
        if (e.button !== undefined && e.button !== 0) return;
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };
    };

    const onPointerMove = useCallback((e) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPan({
            x: panStartRef.current.x + dx,
            y: panStartRef.current.y + dy
        });
    }, []);

    const onPointerUp = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    // Wheel zoom
    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        setZoom(prev => {
            const next = Number((prev + delta).toFixed(2));
            return Math.min(Math.max(next, 0.4), 2.2);
        });
    };

    // Mobile round jump
    const handleMobileRoundSelect = (event, newIndex) => {
        setMobileRoundTab(newIndex);
        // Pan viewport horizontally to selected round column
        const targetX = -(newIndex * 310) + 20;
        setPan({ x: targetX, y: 0 });
    };

    // Match click handler
    const handleMatchClick = (match) => {
        setActiveMatchDialog(match);
        if (onMatchSelect) onMatchSelect(match);
    };

    // Compute Round Robin Standings dynamically
    const rrTeams = useMemo(() => activeData.teams || SAMPLE_ROUND_ROBIN.teams, [activeData]);
    const rrMatches = useMemo(() => activeData.matches || SAMPLE_ROUND_ROBIN.matches, [activeData]);

    const rrStandings = useMemo(() => {
        if (drawFormat !== 'ROUND_ROBIN') return [];
        return calculateRoundRobinStandings(rrTeams, rrMatches);
    }, [drawFormat, rrTeams, rrMatches]);

    return (
        <Box sx={{ width: '100%', userSelect: 'none' }} data-testid="tournament-bracket-engine">
            {/* Header Control Bar */}
            <Paper
                elevation={1}
                sx={{
                    p: 2,
                    mb: 2,
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
                        <AccountTreeIcon color="primary" />
                        {activeData.tournamentName || 'Interactive Tournament Bracket'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {SAMPLE_TOURNAMENTS.find(t => t.id === selectedTourneyId)?.division || "Men's Singles Open"} • BWF Rules Applied
                    </Typography>
                </Box>

                {/* Draw Format Switcher */}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <ButtonGroup size="small" variant="outlined" aria-label="Draw Format Selector">
                        <Button
                            variant={drawFormat === 'SINGLE_ELIMINATION' ? 'contained' : 'outlined'}
                            onClick={() => setDrawFormat('SINGLE_ELIMINATION')}
                            data-testid="btn-single-elim"
                        >
                            Single Elim
                        </Button>
                        <Button
                            variant={drawFormat === 'DOUBLE_ELIMINATION' ? 'contained' : 'outlined'}
                            onClick={() => setDrawFormat('DOUBLE_ELIMINATION')}
                            data-testid="btn-double-elim"
                        >
                            Double Elim
                        </Button>
                        <Button
                            variant={drawFormat === 'ROUND_ROBIN' ? 'contained' : 'outlined'}
                            onClick={() => setDrawFormat('ROUND_ROBIN')}
                            data-testid="btn-round-robin"
                        >
                            Round Robin
                        </Button>
                    </ButtonGroup>

                    {/* Tournament preset selector */}
                    <ButtonGroup size="small" variant="text" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                        {SAMPLE_TOURNAMENTS.map(t => (
                            <Button
                                key={t.id}
                                sx={{
                                    fontSize: '0.75rem',
                                    fontWeight: selectedTourneyId === t.id ? 'bold' : 'normal',
                                    textTransform: 'none'
                                }}
                                onClick={() => setSelectedTourneyId(t.id)}
                            >
                                {t.name.split(' (')[0]}
                            </Button>
                        ))}
                    </ButtonGroup>
                </Stack>
            </Paper>

            {/* Double Elimination Sub-Tabs */}
            {drawFormat === 'DOUBLE_ELIMINATION' && (
                <Box sx={{ mb: 2 }}>
                    <Tabs
                        value={doubleElimTab}
                        onChange={(e, val) => setDoubleElimTab(val)}
                        textColor="primary"
                        indicatorColor="primary"
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab label="Winners Bracket" value="winners" data-testid="tab-winners" />
                        <Tab label="Losers Bracket (Re-entry)" value="losers" data-testid="tab-losers" />
                        <Tab label="Grand Championship Finals" value="grand" data-testid="tab-grand" />
                    </Tabs>
                </Box>
            )}

            {/* Mobile Round Jump Tabs for Elimination Draws */}
            {drawFormat !== 'ROUND_ROBIN' && currentRounds && currentRounds.length > 1 && (
                <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1 }}>
                    <Tabs
                        value={mobileRoundTab}
                        onChange={handleMobileRoundSelect}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ minHeight: 36 }}
                    >
                        {currentRounds.map((r, idx) => (
                            <Tab key={r.id || idx} label={r.name} sx={{ minHeight: 36, py: 0.5, fontSize: '0.8rem' }} />
                        ))}
                    </Tabs>
                </Box>
            )}

            {/* MAIN CONTENT AREA */}
            {drawFormat === 'ROUND_ROBIN' ? (
                /* Round Robin Matrix & Standings Table View */
                <Stack spacing={3} data-testid="round-robin-view">
                    {/* Standings Table */}
                    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmojiEventsIcon color="primary" /> Official Pool Standings
                        </Typography>
                        <TableContainer>
                            <Table size="small" aria-label="Round Robin Standings Table">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: theme.palette.action.hover }}>
                                        <TableCell><strong>Rank</strong></TableCell>
                                        <TableCell><strong>Player / Team</strong></TableCell>
                                        <TableCell align="center"><strong>Played</strong></TableCell>
                                        <TableCell align="center"><strong>Won</strong></TableCell>
                                        <TableCell align="center"><strong>Lost</strong></TableCell>
                                        <TableCell align="center"><strong>Sets (W-L)</strong></TableCell>
                                        <TableCell align="center"><strong>Pts (+/-)</strong></TableCell>
                                        <TableCell align="center"><strong>Diff</strong></TableCell>
                                        <TableCell align="center"><strong>Status</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rrStandings.map(row => (
                                        <TableRow
                                            key={row.team}
                                            sx={{
                                                bgcolor: row.rank <= 2 ? `${theme.palette.success.main}12` : 'inherit',
                                                '&:hover': { bgcolor: theme.palette.action.selected }
                                            }}
                                        >
                                            <TableCell>
                                                {row.rank <= 2 ? (
                                                    <Chip
                                                        size="small"
                                                        color="success"
                                                        label={`#${row.rank}`}
                                                        sx={{ fontWeight: 'bold', height: 20 }}
                                                    />
                                                ) : (
                                                    `#${row.rank}`
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: row.rank <= 2 ? 'bold' : 'normal' }}>
                                                {row.team}
                                            </TableCell>
                                            <TableCell align="center">{row.played}</TableCell>
                                            <TableCell align="center" sx={{ color: 'success.main', fontWeight: 'bold' }}>{row.won}</TableCell>
                                            <TableCell align="center" sx={{ color: 'error.main' }}>{row.lost}</TableCell>
                                            <TableCell align="center">{`${row.setsWon}-${row.setsLost}`}</TableCell>
                                            <TableCell align="center">{`${row.pointsFor}-${row.pointsAgainst}`}</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', color: row.pointDiff >= 0 ? 'success.main' : 'error.main' }}>
                                                {row.pointDiff >= 0 ? `+${row.pointDiff}` : row.pointDiff}
                                            </TableCell>
                                            <TableCell align="center">
                                                {row.rank <= 2 ? (
                                                    <Chip size="small" variant="outlined" color="success" label="Knockout Q" />
                                                ) : (
                                                    <Chip size="small" variant="outlined" color="default" label="Eliminated" />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* Head-to-Head Cross Matrix */}
                    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <GridOnIcon color="secondary" /> Head-to-Head Matrix View
                        </Typography>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: theme.palette.action.hover }}>
                                        <TableCell><strong>Opponent</strong></TableCell>
                                        {rrTeams.map(t => (
                                            <TableCell key={t} align="center">
                                                <strong>{t.split(' ')[0]}</strong>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rrTeams.map(teamA => (
                                        <TableRow key={teamA}>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{teamA}</TableCell>
                                            {rrTeams.map(teamB => {
                                                if (teamA === teamB) {
                                                    return (
                                                        <TableCell key={teamB} align="center" sx={{ bgcolor: theme.palette.action.disabledBackground }}>
                                                            —
                                                        </TableCell>
                                                    );
                                                }
                                                // Find match between teamA and teamB
                                                const match = rrMatches.find(
                                                    m => (m.team1 === teamA && m.team2 === teamB) || (m.team1 === teamB && m.team2 === teamA)
                                                );
                                                if (!match) return <TableCell key={teamB} align="center">-</TableCell>;

                                                const isTeamAWinner = match.winner === teamA;
                                                return (
                                                    <TableCell
                                                        key={teamB}
                                                        align="center"
                                                        sx={{
                                                            bgcolor: isTeamAWinner ? `${theme.palette.success.main}18` : `${theme.palette.error.main}12`,
                                                            color: isTeamAWinner ? 'success.main' : 'error.main',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        {match.scoreSummary}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Stack>
            ) : (
                /* Interactive Canvas with Framer Motion Pan & Zoom */
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        height: { xs: 480, sm: 560, md: 620 },
                        borderRadius: 3,
                        overflow: 'hidden',
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: theme.palette.mode === 'dark' ? '#0d131a' : '#f8fafc',
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                        touchAction: 'none'
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onWheel={onWheel}
                    data-testid="bracket-canvas-viewport"
                >
                    {/* Floating HUD Controls */}
                    <Paper
                        elevation={3}
                        sx={{
                            position: 'absolute',
                            right: 16,
                            bottom: 16,
                            zIndex: 10,
                            borderRadius: 2,
                            p: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            bgcolor: 'background.paper',
                            opacity: 0.95
                        }}
                    >
                        <Tooltip title="Zoom In">
                            <Button size="small" onClick={handleZoomIn} aria-label="Zoom in" sx={{ minWidth: 36, px: 0.5 }}>
                                <ZoomInIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Tooltip title="Zoom Out">
                            <Button size="small" onClick={handleZoomOut} aria-label="Zoom out" sx={{ minWidth: 36, px: 0.5 }}>
                                <ZoomOutIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Tooltip title="Reset Scale (100%)">
                            <Button size="small" onClick={handleReset} aria-label="Reset zoom" sx={{ minWidth: 36, px: 0.5 }}>
                                <RestartAltIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Tooltip title="Fit View">
                            <Button size="small" onClick={handleFitCenter} aria-label="Fit to center" sx={{ minWidth: 36, px: 0.5 }}>
                                <CenterFocusStrongIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Typography variant="caption" sx={{ px: 1, fontWeight: 'bold' }}>
                            {Math.round(zoom * 100)}%
                        </Typography>
                    </Paper>

                    {/* Hardware-Accelerated Motion Layer with 3D transform */}
                    <motion.div
                        data-testid="bracket-motion-container"
                        style={{
                            width: layout.totalWidth,
                            height: layout.totalHeight,
                            transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
                            transformOrigin: '0 0',
                            position: 'relative'
                        }}
                    >
                        {/* SVG Connectors Layer */}
                        <svg
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: layout.totalWidth,
                                height: layout.totalHeight,
                                pointerEvents: 'none',
                                zIndex: 1
                            }}
                        >
                            {layout.connectors.map(conn => (
                                <path
                                    key={conn.id}
                                    d={conn.path}
                                    fill="none"
                                    stroke={
                                        conn.isWinnerPath
                                            ? theme.palette.primary.main
                                            : theme.palette.mode === 'dark' ? '#2d3748' : '#cbd5e1'
                                    }
                                    strokeWidth={conn.isWinnerPath ? 2.5 : 1.5}
                                    strokeLinecap="round"
                                />
                            ))}
                        </svg>

                        {/* Round Header Labels */}
                        {currentRounds.map((round, rIdx) => {
                            const x = 20 + rIdx * (240 + 70);
                            return (
                                <Box
                                    key={round.id || rIdx}
                                    sx={{
                                        position: 'absolute',
                                        left: x,
                                        top: 6,
                                        width: 240,
                                        textAlign: 'center',
                                        zIndex: 2
                                    }}
                                >
                                    <Chip
                                        size="small"
                                        label={round.name}
                                        color={rIdx === currentRounds.length - 1 ? 'warning' : 'default'}
                                        sx={{ fontWeight: 'bold', fontSize: '0.75rem', px: 1 }}
                                    />
                                </Box>
                            );
                        })}

                        {/* Interactive Match Paper Nodes */}
                        {currentRounds.map(round =>
                            (round.matches || []).map(match => {
                                const pos = layout.positions[match.id];
                                if (!pos) return null;

                                const isLive = match.status === 'IN_PROGRESS';
                                const isFinal = match.status === 'COMPLETED';

                                return (
                                    <Paper
                                        key={match.id}
                                        elevation={isLive ? 4 : 2}
                                        data-testid={`match-node-${match.id}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMatchClick(match);
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            left: pos.x,
                                            top: pos.y,
                                            width: pos.width,
                                            height: pos.height,
                                            zIndex: 3,
                                            p: 1,
                                            borderRadius: 2,
                                            boxSizing: 'border-box',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            bgcolor: 'background.paper',
                                            border: match.isChampion
                                                ? `2px solid ${theme.palette.warning.main}`
                                                : isLive
                                                    ? `2px solid ${theme.palette.info.main}`
                                                    : `1px solid ${theme.palette.divider}`,
                                            cursor: 'pointer',
                                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: theme.shadows[6]
                                            }
                                        }}
                                    >
                                        {/* Status Header */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                {match.court || 'Court Pending'}
                                            </Typography>
                                            {match.isChampion && (
                                                <Chip
                                                    size="small"
                                                    icon={<EmojiEventsIcon sx={{ fontSize: '0.9rem !important' }} />}
                                                    label="CHAMPION"
                                                    color="warning"
                                                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }}
                                                />
                                            )}
                                            {isLive && (
                                                <Chip
                                                    size="small"
                                                    label="LIVE"
                                                    color="error"
                                                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}
                                                />
                                            )}
                                            {isFinal && !match.isChampion && (
                                                <Chip
                                                    size="small"
                                                    label="FINAL"
                                                    color="default"
                                                    sx={{ height: 16, fontSize: '0.6rem' }}
                                                />
                                            )}
                                        </Box>

                                        {/* Team 1 Row */}
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                bgcolor: match.team1?.isWinner ? `${theme.palette.success.main}14` : 'transparent',
                                                borderRadius: 1,
                                                px: 0.5,
                                                py: 0.25
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                noWrap
                                                sx={{
                                                    fontSize: '0.8rem',
                                                    fontWeight: match.team1?.isWinner ? 'bold' : 'normal',
                                                    color: match.team1?.isWinner ? 'text.primary' : 'text.secondary',
                                                    maxWidth: 180
                                                }}
                                            >
                                                {match.team1?.seed && <span style={{ opacity: 0.6, marginRight: 4 }}>#{match.team1.seed}</span>}
                                                {match.team1?.name || 'TBD'}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem', ml: 1 }}>
                                                {match.team1?.score ?? '-'}
                                            </Typography>
                                        </Box>

                                        {/* Team 2 Row */}
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                bgcolor: match.team2?.isWinner ? `${theme.palette.success.main}14` : 'transparent',
                                                borderRadius: 1,
                                                px: 0.5,
                                                py: 0.25
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                noWrap
                                                sx={{
                                                    fontSize: '0.8rem',
                                                    fontWeight: match.team2?.isWinner ? 'bold' : 'normal',
                                                    color: match.team2?.isWinner ? 'text.primary' : 'text.secondary',
                                                    maxWidth: 180
                                                }}
                                            >
                                                {match.team2?.seed && <span style={{ opacity: 0.6, marginRight: 4 }}>#{match.team2.seed}</span>}
                                                {match.team2?.name || 'TBD'}
                                            </Typography>
                                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem', ml: 1 }}>
                                                {match.team2?.score ?? '-'}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                );
                            })
                        )}
                    </motion.div>
                </Box>
            )}

            {/* Match Snapshot Dialog */}
            <Dialog
                open={Boolean(activeMatchDialog)}
                onClose={() => setActiveMatchDialog(null)}
                maxWidth="xs"
                fullWidth
                data-testid="match-details-dialog"
            >
                {activeMatchDialog && (
                    <>
                        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SportsScoreIcon color="primary" /> Match Details
                        </DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                {activeMatchDialog.court || 'Court unassigned'} • Status: {activeMatchDialog.status}
                            </Typography>
                            <Paper variant="outlined" sx={{ p: 2, my: 1, borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={activeMatchDialog.team1?.isWinner ? 'bold' : 'normal'}>
                                        {activeMatchDialog.team1?.seed && `#${activeMatchDialog.team1.seed} `}
                                        {activeMatchDialog.team1?.name}
                                    </Typography>
                                    <Typography fontWeight="bold">{activeMatchDialog.team1?.score ?? '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography fontWeight={activeMatchDialog.team2?.isWinner ? 'bold' : 'normal'}>
                                        {activeMatchDialog.team2?.seed && `#${activeMatchDialog.team2.seed} `}
                                        {activeMatchDialog.team2?.name}
                                    </Typography>
                                    <Typography fontWeight="bold">{activeMatchDialog.team2?.score ?? '-'}</Typography>
                                </Box>
                            </Paper>
                            {activeMatchDialog.winner && (
                                <Alert severity="success" icon={<EmojiEventsIcon />} sx={{ mt: 1 }}>
                                    Winner: <strong>{activeMatchDialog.winner}</strong>
                                </Alert>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setActiveMatchDialog(null)}>Close</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
