const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
    try {
        // Proxy to search-service, passing along all query params
        const response = await axios.get('http://localhost:5001/search', {
            params: req.query
        });
        res.json(response.data);
    } catch (err) {
        console.error('Search proxy error:', err.message);
        // Fallback if search service is down
        res.json({ results: [] });
    }
});

module.exports = router;
