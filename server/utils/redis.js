const Redis = require('ioredis');

let redis;

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    
    redis.on('connect', () => {
        console.log('Connected to Redis for caching');
    });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });
} else {
    console.log('ℹ️ No REDIS_URL found. Using in-memory mock for caching bypass.');
    const memCache = new Map();
    redis = {
        get: async (key) => memCache.get(key) || null,
        setex: async (key, seconds, val) => { memCache.set(key, val); },
        keys: async (pattern) => {
            const prefix = pattern.replace('*', '');
            return Array.from(memCache.keys()).filter(k => k.startsWith(prefix));
        },
        del: async (keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach(k => memCache.delete(k));
        },
        on: (event, handler) => {}
    };
}

module.exports = redis;
