import React, { useState, useEffect } from 'react';
import { Box, Alert, AlertTitle, Button, CircularProgress } from '@mui/material';
import apiFetch from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function PendingMatchesPrompt() {
    const { user } = useAuth();
    const [pendingMatches, setPendingMatches] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPendingMatches = async () => {
        if (!user) return;
        try {
            const res = await apiFetch('/api/matches/pending');
            const matches = await res.json();
            // Only show matches where the current user is NOT the submitter
            // i.e. the current user needs to confirm it
            const requiresConfirmation = matches.filter(
                (m) => m.submittedBy._id !== user.id && m.submittedBy._id !== user._id
            );
            setPendingMatches(requiresConfirmation);
        } catch (error) {
            console.error("Failed to fetch pending matches", error);
        }
    };

    useEffect(() => {
        fetchPendingMatches();
        // optionally poll every 30 seconds
        const interval = setInterval(fetchPendingMatches, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const handleConfirm = async (matchId) => {
        setLoading(true);
        try {
            await apiFetch(`/api/matches/${matchId}/confirm`, { method: 'PUT' });
            setPendingMatches((prev) => prev.filter((m) => m._id !== matchId));
        } catch (error) {
            console.error(error);
            alert(error.message || "Failed to confirm match");
        } finally {
            setLoading(false);
        }
    };

    const handleDispute = async (matchId) => {
        setLoading(true);
        try {
            await apiFetch(`/api/matches/${matchId}/dispute`, { method: 'PUT' });
            setPendingMatches((prev) => prev.filter((m) => m._id !== matchId));
        } catch (error) {
            console.error(error);
            alert(error.message || "Failed to dispute match");
        } finally {
            setLoading(false);
        }
    };

    if (!pendingMatches || pendingMatches.length === 0) return null;

    return (
        <Box sx={{ width: '100%', maxWidth: 'lg', mx: 'auto', mt: 2, mb: 2 }}>
            {pendingMatches.map((match) => {
                const submitter = match.submittedBy?.name || "A player";
                return (
                    <Alert 
                        key={match._id} 
                        severity="info" 
                        sx={{ mb: 1, alignItems: 'center' }}
                        action={
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button 
                                    color="success" 
                                    size="small" 
                                    variant="contained" 
                                    onClick={() => handleConfirm(match._id)}
                                    disabled={loading}
                                >
                                    {loading ? <CircularProgress size={20} /> : "Accept"}
                                </Button>
                                <Button 
                                    color="error" 
                                    size="small" 
                                    variant="outlined" 
                                    onClick={() => handleDispute(match._id)}
                                    disabled={loading}
                                >
                                    Dispute
                                </Button>
                            </Box>
                        }
                    >
                        <AlertTitle>Match Score Verification</AlertTitle>
                        <strong>{submitter}</strong> reported a {match.type} match score against you ({match.team1Score} - {match.team2Score}). Please verify this result.
                    </Alert>
                );
            })}
        </Box>
    );
}
