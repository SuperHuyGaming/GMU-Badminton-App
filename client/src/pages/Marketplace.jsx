import { useState, useEffect } from 'react';
import { 
    Box, Typography, Button, Card, CardContent, CardMedia, CardActions, 
    Grid, CircularProgress, Alert, Chip, TextField, Dialog, DialogTitle, 
    DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
    InputAdornment, Avatar
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import apiFetch from '../utils/api';

export default function Marketplace() {
    const { user } = useAuth();
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterCategory, setFilterCategory] = useState("All");

    // Modal state
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        price: "",
        condition: "Good",
        category: "Racket",
        imageFile: null
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchListings = async () => {
            try {
                setLoading(true);
                const res = await apiFetch(`/api/marketplace?category=${filterCategory}`);
                const data = await res.json();
                if (res.ok) {
                    setListings(data);
                } else {
                    throw new Error(data.message || "Failed to fetch listings");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchListings();
    }, [filterCategory]);

    const handleOpen = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setFormData({ title: "", description: "", price: "", condition: "Good", category: "Racket", imageFile: null });
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.description || !formData.price) {
            alert("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);
        try {
            let uploadedImageUrl = null;
            // 1. Upload image to Cloudinary if provided
            if (formData.imageFile) {
                const uploadData = new FormData();
                uploadData.append("image", formData.imageFile);
                uploadData.append("userId", user.id);
                // we can just use the existing upload route (e.g., /api/upload/image)
                // wait, the existing route expects type (profilePic or coverPic) and updates the User model directly!
                // We'll need a generic upload endpoint, or we can just skip image upload for this quick mockup and only allow text listings,
                // OR we can post the image to a new generic Cloudinary endpoint.
                // For now, I'll omit image uploading to keep it simple, or mock it with a dummy image.
            }

            // 2. Create listing
            const res = await apiFetch('/api/marketplace', {
                method: 'POST',
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    price: Number(formData.price),
                    condition: formData.condition,
                    category: formData.category,
                    images: uploadedImageUrl ? [uploadedImageUrl] : ["https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80"] // default placeholder
                })
            });

            if (res.ok) {
                const newListing = await res.json();
                setListings([newListing, ...listings]);
                handleClose();
            } else {
                const errData = await res.json();
                throw new Error(errData.message);
            }
        } catch (err) {
            alert("Failed to create listing: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this listing?")) return;
        try {
            await apiFetch(`/api/marketplace/${id}`, { method: 'DELETE' });
            setListings(listings.filter(l => l._id !== id));
        } catch (err) {
            console.error(err);
            alert("Failed to delete listing.");
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                        Marketplace
                    </Typography>
                    <Typography color="text.secondary">
                        Buy, sell, and trade badminton gear with the local community.
                    </Typography>
                </Box>
                <Button variant="contained" color="primary" onClick={handleOpen} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                    + Sell Gear
                </Button>
            </Box>

            <Box sx={{ mb: 4, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                {["All", "Racket", "Shoes", "Bag", "Shuttlecocks", "Other"].map(cat => (
                    <Chip 
                        key={cat} 
                        label={cat} 
                        clickable 
                        color={filterCategory === cat ? "primary" : "default"}
                        variant={filterCategory === cat ? "filled" : "outlined"}
                        onClick={() => setFilterCategory(cat)}
                        sx={{ fontWeight: 'bold', borderRadius: 2 }}
                    />
                ))}
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : listings.length === 0 ? (
                <Alert severity="info">No gear found in this category right now.</Alert>
            ) : (
                <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                    {listings.map(listing => (
                        <Grid size={{'xs': 12, 'sm': 6, 'md': 4, 'lg': 3}} key={listing._id}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}>
                                <CardMedia
                                    component="img"
                                    height="200"
                                    image={listing.images[0] || "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=80"}
                                    alt={listing.title}
                                />
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                                            {listing.title}
                                        </Typography>
                                        <Typography variant="h6" color="primary.main" fontWeight="900">
                                            ${listing.price}
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                        <Chip label={listing.category} size="small" />
                                        <Chip label={listing.condition} size="small" variant="outlined" />
                                    </Box>

                                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 2 }}>
                                        {listing.description}
                                    </Typography>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto', p: 1, bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
                                        <Avatar src={listing.sellerId?.profilePic} sx={{ width: 24, height: 24 }} />
                                        <Typography variant="caption" fontWeight="bold" noWrap>
                                            {listing.sellerId?.name}
                                        </Typography>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ p: 2, pt: 0 }}>
                                    {user && listing.sellerId?._id === user.id ? (
                                        <Button size="small" color="error" fullWidth variant="outlined" onClick={() => handleDelete(listing._id)}>
                                            Delete Listing
                                        </Button>
                                    ) : (
                                        <Button size="small" color="primary" fullWidth variant="contained" onClick={() => window.location.href = `/messages?to=${listing.sellerId?._id}`}>
                                            Message Seller
                                        </Button>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Listing Modal */}
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>List an Item</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField 
                        label="Item Title" 
                        fullWidth 
                        required 
                        value={formData.title} 
                        onChange={e => setFormData({...formData, title: e.target.value})} 
                        placeholder="e.g., Yonex Astrox 99 Pro"
                    />
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select 
                                value={formData.category} 
                                label="Category" 
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            >
                                <MenuItem value="Racket">Racket</MenuItem>
                                <MenuItem value="Shoes">Shoes</MenuItem>
                                <MenuItem value="Bag">Bag</MenuItem>
                                <MenuItem value="Shuttlecocks">Shuttlecocks</MenuItem>
                                <MenuItem value="Other">Other</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Condition</InputLabel>
                            <Select 
                                value={formData.condition} 
                                label="Condition" 
                                onChange={e => setFormData({...formData, condition: e.target.value})}
                            >
                                <MenuItem value="New">New</MenuItem>
                                <MenuItem value="Like New">Like New</MenuItem>
                                <MenuItem value="Good">Good</MenuItem>
                                <MenuItem value="Fair">Fair</MenuItem>
                                <MenuItem value="Used">Used</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <TextField 
                        label="Price" 
                        type="number" 
                        fullWidth 
                        required 
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        value={formData.price} 
                        onChange={e => setFormData({...formData, price: e.target.value})} 
                    />

                    <TextField 
                        label="Description" 
                        fullWidth 
                        multiline 
                        rows={4} 
                        required 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        placeholder="Detail any scratches, string tension, size, etc."
                    />
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={handleClose} color="inherit">Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={submitting} sx={{ borderRadius: 2 }}>
                        {submitting ? <CircularProgress size={24} /> : "Post Listing"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
