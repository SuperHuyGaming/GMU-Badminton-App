const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Client } = require('@elastic/elasticsearch');
const Redis = require('ioredis');

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

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const elasticClient = new Client({ node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200' });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'search-service' });
});

const searchHandler = async (req, res) => {
  const { q, type = 'all', page = 1, limit = 20, searcherHomeUniversity } = req.query;

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

  const validTypes = ['all', 'users', 'posts', 'user', 'post', 'players'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid type "${type}". Allowed values are: ${validTypes.join(', ')}.`,
    });
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const cacheKey = `search:query:${trimmedQuery}:type:${type}:page:${parsedPage}:limit:${parsedLimit}:uni:${searcherHomeUniversity || 'none'}`;

  try {
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cachedResult));
    }
  } catch (err) {
    console.error('Redis cache error:', err);
    // Gracefully degrade, continue to Elasticsearch
  }

  try {
      let indices = ['users', 'posts'];
      if (type === 'user' || type === 'users' || type === 'players') indices = ['users'];
      if (type === 'post' || type === 'posts') indices = ['posts'];

      let baseQuery = {
          multi_match: {
              query: trimmedQuery,
              fields: ['name', 'bio', 'title', 'content', 'authorName', 'tags'],
              fuzziness: 'AUTO'
          }
      };

      let queryBody = { query: baseQuery };

      if (searcherHomeUniversity && (type === 'user' || type === 'users' || type === 'players' || type === 'all')) {
          queryBody = {
              query: {
                  bool: {
                      must: baseQuery,
                      should: [
                          {
                              match: {
                                  homeUniversity: {
                                      query: searcherHomeUniversity,
                                      boost: 2.0
                                  }
                              }
                          },
                          {
                              match: {
                                  university: {
                                      query: searcherHomeUniversity,
                                      boost: 2.0
                                  }
                              }
                          }
                      ]
                  }
              }
          };
      }

      const result = await elasticClient.search({
          index: indices.join(','),
          from: (parsedPage - 1) * parsedLimit,
          size: parsedLimit,
          body: queryBody
      });

      const hits = result.hits.hits.map(hit => ({
          _id: hit._id,
          _index: hit._index,
          ...hit._source
      }));

      const responseData = { 
        query: trimmedQuery,
        type,
        page: parsedPage,
        limit: parsedLimit,
        total: result.hits.total?.value || 0,
        results: hits 
      };

      res.setHeader('X-Cache', 'MISS');
      res.json(responseData);

      try {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 60);
      } catch (redisErr) {
        console.error('Redis set error:', redisErr);
      }
  } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed' });
  }
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

const PORT = process.env.PORT || 5001;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Search service running on port ${PORT}`);
  });
}

module.exports = { app, server };
