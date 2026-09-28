const express = require('express');
const router = express.Router();
const axios = require('axios');

const sanitizeResults = (data) => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data.results)) {
        data.results = data.results.map((item) => {
            if (!item || typeof item !== 'object') return item;
            const sanitized = { ...item };
            delete sanitized.password;
            delete sanitized.email;
            delete sanitized.pushSubscriptions;
            delete sanitized.token;
            delete sanitized.secret;
            delete sanitized.jwt;
            return sanitized;
        });
    }
    return data;
};

router.get('/', async (req, res) => {
    try {
        const { q, type, page, limit } = req.query;
        const searchServiceUrl = process.env.SEARCH_SERVICE_URL || 'http://localhost:5001/search';

        const params = { q, type };
        if (page !== undefined) params.page = page;
        if (limit !== undefined) params.limit = limit;

        // Proxy to search-service with 5s timeout to prevent thread starvation
        const response = await axios.get(searchServiceUrl, {
            params,
            timeout: 5000,
        });
        res.json(sanitizeResults(response.data));
    } catch (err) {
        console.error('Search proxy error:', err.message);
        // Fallback if search service is down
        res.json({ results: [] });
    }
});

module.exports = router;
