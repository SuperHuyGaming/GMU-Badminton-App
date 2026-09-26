import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, Typography, Box } from '@mui/material';
import apiFetch from '../utils/api';

export default function TournamentSubmissionModal({ open, onClose, onSubmitSuccess }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [scrapedData, setScrapedData] = useState(null);
    const [error, setError] = useState(null);

    const handleAutoFill = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/scrape/instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Scraping failed');
            }

            const data = await res.json();
            setScrapedData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!scrapedData) return;
        setLoading(true);
        try {
            const res = await apiFetch('/api/scrape/submit-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scrapedData)
            });

            if (!res.ok) throw new Error('Submission failed');
            onSubmitSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Submit a Tournament</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Found an Instagram post for an upcoming college tournament? Paste the link below and our AI will automatically read the flyer and extract the dates!
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <TextField 
                        fullWidth 
                        label="Instagram Post URL" 
                        variant="outlined" 
                        size="small"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/..."
                    />
                    <Button 
                        variant="contained" 
                        onClick={handleAutoFill} 
                        disabled={loading || !url.includes('instagram.com')}
                    >
                        {loading && !scrapedData ? <CircularProgress size={24} color="inherit" /> : 'Auto-Fill'}
                    </Button>
                </Box>

                {error && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>}

                {scrapedData && (
                    <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>dY"& AI Successfully Extracted Data:</Typography>
                        <Typography variant="body2"><strong>Name:</strong> {scrapedData.tournamentName}</Typography>
                        <Typography variant="body2"><strong>Start Date:</strong> {new Date(scrapedData.startDate).toLocaleDateString()}</Typography>
                        {scrapedData.registrationDeadline && (
                            <Typography variant="body2"><strong>Deadline:</strong> {new Date(scrapedData.registrationDeadline).toLocaleDateString()}</Typography>
                        )}
                        <Typography variant="body2"><strong>Skill Levels:</strong> {scrapedData.skillLevels.join(', ')}</Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSubmit} 
                    disabled={loading || !scrapedData}
                >
                    Submit for Review
                </Button>
            </DialogActions>
        </Dialog>
    );
}
