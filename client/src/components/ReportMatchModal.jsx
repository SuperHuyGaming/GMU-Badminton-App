import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Typography, Box } from '@mui/material';
import apiFetch from '../utils/api';

export default function ReportMatchModal({ open, onClose, opponentId }) {
    const [type, setType] = useState('singles');
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
        }
    }, [open, opponentId]);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = {
                type,
                team1: [], // backend expects auth'd user to be in here or it infers it? Wait, let's look at the payload it expects.
                team2: [opponentId],
                team1Score: Number(team1Score),
                team2Score: Number(team2Score)
            };
            
            // Wait, the backend expects `team1` to be array of IDs.
            // I'll grab my own ID from localStorage
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                payload.team1 = [user.id || user._id];
            }

            const idempotencyKey = `${user.id || user._id}-${opponentId}-${Date.now()}`;

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

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 'bold' }}>Report Match Score</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
                <Typography color="text.secondary">
                    Reporting a match against <strong>{opponent?.name || "Player"}</strong>.
                    They will need to confirm this score before it affects ELO.
                </Typography>
                
                <FormControl fullWidth>
                    <InputLabel>Match Type</InputLabel>
                    <Select value={type} label="Match Type" onChange={(e) => setType(e.target.value)}>
                        <MenuItem value="singles">Singles</MenuItem>
                        {/* Doubles disabled for now since we'd need a multi-select for partners */}
                        {/* <MenuItem value="doubles">Doubles</MenuItem> */}
                    </Select>
                </FormControl>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField 
                        label="Your Score" 
                        type="number" 
                        value={team1Score} 
                        onChange={(e) => setTeam1Score(e.target.value)} 
                        fullWidth 
                    />
                    <Typography variant="h5" fontWeight="bold">-</Typography>
                    <TextField 
                        label="Opponent Score" 
                        type="number" 
                        value={team2Score} 
                        onChange={(e) => setTeam2Score(e.target.value)} 
                        fullWidth 
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSubmit} 
                    disabled={loading || team1Score === team2Score}
                >
                    {loading ? <CircularProgress size={24} /> : "Submit Score"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
