import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton, Alert } from '@mui/material';
import apiFetch from '../utils/api';

const AddIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const RemoveIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const TrophyIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFCC33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
        <path d="M4 22h16"></path>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
);

const ScoreAdjuster = ({ label, score, setScore, isWinner, handleIncrement, handleDecrement }) => (
    <Box sx={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, 
        bgcolor: isWinner ? 'rgba(0, 102, 51, 0.05)' : 'background.paper', 
        borderRadius: 4, 
        border: isWinner ? '2px solid #006633' : '2px solid', 
        borderColor: isWinner ? '#006633' : 'divider',
        transition: 'all 0.3s',
        flex: 1
    }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}>
            {label} {isWinner && <TrophyIcon />}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => handleDecrement(setScore, score)} sx={{ bgcolor: 'rgba(0,0,0,0.05)', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }} aria-label="Decrease score">
                <RemoveIcon />
            </IconButton>
            <Typography variant="h3" fontWeight="900" sx={{ minWidth: '70px', textAlign: 'center', color: isWinner ? 'primary.main' : 'text.primary' }}>
                {score}
            </Typography>
            <IconButton onClick={() => handleIncrement(setScore, score)} sx={{ bgcolor: 'rgba(0,0,0,0.05)', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }} aria-label="Increase score">
                <AddIcon />
            </IconButton>
        </Box>
    </Box>
);

export default function ReportMatchModal({ open, onClose, opponentId }) {
    const [team1Score, setTeam1Score] = useState(21);
    const [team2Score, setTeam2Score] = useState(19);
    const [loading, setLoading] = useState(false);
    const [opponent, setOpponent] = useState(null);

    useEffect(() => {
        if (open && opponentId) {
            // Fetch opponent details to display their name
            apiFetch(`/api/profile/${opponentId}`)
                .then(res => res.json())
                .then(data => setOpponent(data))
                .catch(err => console.error("Error fetching opponent", err));
            
            // Reset scores on open
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTeam1Score(21);
             
            setTeam2Score(19);
        }
    }, [open, opponentId]);

    // Badminton Scoring Validation Rule
    const validateScore = (score1, score2) => {
        const winner = Math.max(score1, score2);
        const loser = Math.min(score1, score2);
        
        if (winner < 21) return "The winner must reach at least 21 points.";
        if (winner === 21 && loser >= 20) return "A game ending at 21 points must be won by at least 2 points (e.g. 21-19, not 21-20).";
        if (winner > 21 && winner < 30 && winner - loser !== 2) return `A game extending past 21 points must be won by exactly 2 points (e.g. ${winner}-${winner-2}).`;
        if (winner > 30) return "A badminton game cannot exceed 30 points.";
        if (winner === 30 && loser < 28) return "A game ending at 30 points must have a closer score (e.g., 30-28 or 30-29).";
        if (score1 === score2) return "A match cannot end in a tie.";
        return null;
    };

    const validationError = validateScore(team1Score, team2Score);

    const handleSubmit = async () => {
        if (validationError) return;
        setLoading(true);
        try {
            const payload = {
                type: 'singles',
                team1: [],
                team2: [opponentId],
                team1Score,
                team2Score
            };
            
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                payload.team1 = [user.id || user._id];
            }

            const idempotencyKey = `${payload.team1[0]}-${opponentId}-${Date.now()}`;

            await apiFetch('/api/matches', {
                method: 'POST',
                headers: {
                    'Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify(payload)
            });
            onClose();
            alert("Match score reported successfully! Waiting for opponent to confirm.");
        } catch (error) {
            console.error("Failed to report match", error);
            alert("Failed to report match: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleIncrement = (setter, current) => {
        if (current < 30) setter(current + 1);
    };

    const handleDecrement = (setter, current) => {
        if (current > 0) setter(current - 1);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
            <DialogTitle sx={{ fontWeight: '900', textAlign: 'center', pt: 4, fontSize: '1.5rem' }}>Report Match Score</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, sm: 4 } }}>
                <Typography color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
                    Did you play a match against <strong>{opponent?.name || "Player"}</strong>? 
                    Enter the final score below. They will need to confirm it.
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, py: 2 }}>
                    <ScoreAdjuster 
                        label="Your Score" 
                        score={team1Score} 
                        setScore={setTeam1Score} 
                        isWinner={team1Score > team2Score && !validationError}
                        handleIncrement={handleIncrement}
                        handleDecrement={handleDecrement}
                    />
                    <Typography variant="h5" fontWeight="bold" color="text.secondary">VS</Typography>
                    <ScoreAdjuster 
                        label="Opponent" 
                        score={team2Score} 
                        setScore={setTeam2Score} 
                        isWinner={team2Score > team1Score && !validationError} 
                        handleIncrement={handleIncrement}
                        handleDecrement={handleDecrement}
                    />
                </Box>

                <Box sx={{ minHeight: '60px' }}>
                    {validationError && (
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            {validationError}
                        </Alert>
                    )}
                </Box>

            </DialogContent>
            <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center', gap: 2 }}>
                <Button onClick={onClose} color="inherit" sx={{ fontWeight: 'bold', borderRadius: 2, px: 3, py: 1 }}>
                    Cancel
                </Button>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSubmit} 
                    disabled={loading || !!validationError}
                    sx={{ fontWeight: 'bold', borderRadius: 2, px: 4, py: 1, boxShadow: 2 }}
                >
                    {loading ? "Submitting..." : "Submit Score"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
