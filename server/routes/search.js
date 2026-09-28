const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
    try {
        const { q, type } = req.query;
        // Proxy to search-service
        const response = await axios.get('http://localhost:5001/search', {
            params: { q, type }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Search proxy error:', err.message);
        // Fallback if search service is down
        res.json({ results: [] });
    }
});

module.exports = router;
