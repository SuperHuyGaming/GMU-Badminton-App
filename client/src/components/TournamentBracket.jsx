import React from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';

// Recursive Bracket Node component
const BracketNode = ({ match }) => {
    const theme = useTheme();
    const isLeaf = !match.nextMatches || match.nextMatches.length === 0;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
            {!isLeaf && (
                <Box sx={{ display: 'flex', flexDirection: 'column', mr: 2 }}>
                    {match.nextMatches.map((childMatch, idx) => (
                        <BracketNode key={childMatch.id || idx} match={childMatch} />
                    ))}
                </Box>
            )}
            
            {/* The line connecting children to this node */}
            {!isLeaf && (
                <Box sx={{
                    width: 20,
                    borderTop: `2px solid ${theme.palette.divider}`,
                    borderRight: `2px solid ${theme.palette.divider}`,
                    borderBottom: `2px solid ${theme.palette.divider}`,
                    borderLeft: 'none',
                    height: '50%',
                    mr: 2
                }} />
            )}

            <Paper 
                elevation={2} 
                sx={{ 
                    minWidth: 160, 
                    p: 1, 
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.primary.main}`,
                    bgcolor: 'background.paper'
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', pb: 0.5, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={match.winner === match.player1 ? 'bold' : 'normal'}>
                        {match.player1 || "TBD"}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                        {match.score1 !== null ? match.score1 : '-'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={match.winner === match.player2 ? 'bold' : 'normal'}>
                        {match.player2 || "TBD"}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                        {match.score2 !== null ? match.score2 : '-'}
                    </Typography>
                </Box>
            </Paper>

            {/* The line connecting this node to its parent */}
            <Box sx={{ width: 20, borderBottom: `2px solid ${theme.palette.divider}`, ml: 2 }} />
        </Box>
    );
};

export default function TournamentBracket({ rootMatch }) {
    if (!rootMatch) return <Typography>No bracket data.</Typography>;

    return (
        <Box sx={{ overflowX: 'auto', p: 4, display: 'flex', alignItems: 'center' }}>
            <BracketNode match={rootMatch} />
        </Box>
    );
}
