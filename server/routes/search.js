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

const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many search requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/', searchLimiter, async (req, res) => {
    mongoSanitize.sanitize(req.query, { replaceWith: '_' });
    try {
        const searchServiceUrl = process.env.SEARCH_SERVICE_URL || 'http://localhost:5001/search';
        // Proxy to search-service with 5s timeout to prevent thread starvation
        const response = await axios.get(searchServiceUrl, {
            params: req.query,
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
