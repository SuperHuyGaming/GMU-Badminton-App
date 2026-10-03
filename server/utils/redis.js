const Redis = require('ioredis');

// Connect to Redis (assuming standard localhost or REDIS_URL from env)
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redis.on('connect', () => {
    console.log('Connected to Redis for caching');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

module.exports = redis;
