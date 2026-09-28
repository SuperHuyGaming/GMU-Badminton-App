const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Placeholder for Elasticsearch and Redis clients
// const Redis = require('ioredis');
// const { Client } = require('@elastic/elasticsearch');
// const redis = new Redis(process.env.REDIS_URL);
// const elasticClient = new Client({ node: process.env.ELASTICSEARCH_NODE });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'search-service' });
});

const searchHandler = (req, res) => {
  const { q, type = 'all', page = 1, limit = 20 } = req.query;

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Query parameter "q" is required and cannot be empty.',
    });
  }

  const trimmedQuery = q.trim();
  if (trimmedQuery.length > 100) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Query parameter "q" must not exceed 100 characters.',
    });
  }

  const validTypes = ['all', 'players', 'posts'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid type "${type}". Allowed values are: ${validTypes.join(', ')}.`,
    });
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  return res.json({
    query: trimmedQuery,
    type,
    page: parsedPage,
    limit: parsedLimit,
    total: 0,
    results: [],
  });
};

app.get('/search', searchHandler);
app.get('/api/search', searchHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.url} does not exist.` });
});

// Central Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.message === 'Not allowed by CORS' ? 403 : (err.status || 500);
  res.status(statusCode).json({
    error: statusCode === 403 ? 'CORS Error' : 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

const PORT = process.env.PORT || 3001;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Search service running on port ${PORT}`);
  });
}

module.exports = { app, server };
