const Redis = require('ioredis');

// Create a Redis client. If REDIS_URL is not provided, it will fallback to a memory mock or localhost
let redisClient;
let redisEnabled = false;

if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
    redisEnabled = true;

    redisClient.on('connect', () => {
        console.log('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
        console.warn('Redis connection error:', err);
        redisEnabled = false;
    });
} else {
    console.warn('REDIS_URL not set in .env. Caching and rate limiting will be bypassed or use memory.');
    // Simple mock client so app doesn't crash
    redisClient = {
        get: async () => null,
        setex: async () => null,
        del: async () => null
    };
}

module.exports = { redisClient, redisEnabled };
