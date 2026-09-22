import { useState } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    Typography, 
    RadioGroup, 
    FormControlLabel, 
    Radio, 
    TextField, 
    Box 
} from '@mui/material';
import apiFetch from '../../utils/api';

export default function CarpoolModal({ open, onClose, tournament }) {
    const [transportType, setTransportType] = useState('driving');
    const [seats, setSeats] = useState(3);
    const [pickupLocation, setPickupLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Note: Optimistic UI assumption for Fullstack Task #3
            // In a real scenario, this connects to the Java/Node RSVP API.
            // await apiFetch(`/api/v1/tournaments/${tournament.id}/rsvp`, {
            //     method: 'POST',
            //     body: JSON.stringify({ transportType, seats, pickupLocation })
            // });
            
            // Simulating network delay
            await new Promise(resolve => setTimeout(resolve, 800));
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to submit RSVP:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!tournament) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold' }}>
                RSVP & Carpool: {tournament.name}
            </DialogTitle>
            <DialogContent dividers>
                {success ? (
                    <Box textAlign="center" py={4}>
                        <Typography variant="h5" color="success.main" fontWeight="bold" gutterBottom>
                            🎉 RSVP Confirmed!
                        </Typography>
                        <Typography color="text.secondary">
                            Your carpool preferences have been saved. We'll notify you if there's a match!
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                        <Typography variant="body1">
                            How are you getting to the tournament at <strong>{tournament.location}</strong>?
                        </Typography>

                        <RadioGroup 
                            value={transportType} 
                            onChange={(e) => setTransportType(e.target.value)}
                        >
                            <FormControlLabel 
                                value="driving" 
                                control={<Radio />} 
                                label={
                                    <Typography><strong>🚗 I can drive</strong> and take passengers</Typography>
                                } 
                            />
                            <FormControlLabel 
                                value="need_ride" 
                                control={<Radio />} 
                                label={
                                    <Typography><strong>🙋‍♂️ I need a ride</strong> from campus</Typography>
                                } 
                            />
                            <FormControlLabel 
                                value="independent" 
                                control={<Radio />} 
                                label={
                                    <Typography><strong>🚶 I'll get there myself</strong></Typography>
                                } 
                            />
                        </RadioGroup>

                        {transportType === 'driving' && (
                            <TextField 
                                type="number" 
                                label="Available Seats" 
                                variant="outlined" 
                                value={seats} 
                                onChange={(e) => setSeats(e.target.value)} 
                                inputProps={{ min: 1, max: 8 }}
                                fullWidth
                            />
                        )}

                        {transportType === 'need_ride' && (
                            <TextField 
                                label="Pickup Location" 
                                placeholder="e.g. Rappahannock River Parking Deck" 
                                variant="outlined" 
                                value={pickupLocation} 
                                onChange={(e) => setPickupLocation(e.target.value)} 
                                fullWidth
                            />
                        )}
                    </Box>
                )}
            </DialogContent>
            {!success && (
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || (transportType === 'need_ride' && !pickupLocation)}
                        sx={{ fontWeight: 'bold', borderRadius: 2 }}
                    >
                        {isSubmitting ? 'Confirming...' : 'Confirm RSVP'}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}
