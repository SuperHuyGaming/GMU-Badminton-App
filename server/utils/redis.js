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
    const setCache = new Map();

    redis = {
        get: async (key) => memCache.get(key) || null,
        setex: async (key, seconds, val) => { memCache.set(key, val); },
        keys: async (pattern) => {
            const prefix = pattern.replace('*', '');
            return Array.from(memCache.keys()).filter(k => k.startsWith(prefix));
        },
        del: async (keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            let count = 0;
            keysArray.forEach(k => {
                if (memCache.delete(k)) count++;
                if (setCache.delete(k)) count++;
            });
            return count;
        },
        unlink: async (keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            let count = 0;
            keysArray.forEach(k => {
                if (memCache.delete(k)) count++;
                if (setCache.delete(k)) count++;
            });
            return count;
        },
        sadd: async (tag, ...keys) => {
            if (!setCache.has(tag)) setCache.set(tag, new Set());
            const set = setCache.get(tag);
            let count = 0;
            keys.flat().forEach(k => {
                if (!set.has(k)) {
                    set.add(k);
                    count++;
                }
            });
            return count;
        },
        smembers: async (tag) => {
            if (!setCache.has(tag)) return [];
            return Array.from(setCache.get(tag));
        },
        srem: async (tag, ...keys) => {
            if (!setCache.has(tag)) return 0;
            const set = setCache.get(tag);
            let count = 0;
            keys.flat().forEach(k => {
                if (set.delete(k)) count++;
            });
            return count;
        },
        pipeline: () => {
            const tasks = [];
            const pipe = {
                unlink: (...keys) => {
                    tasks.push(() => redis.unlink(keys.flat()));
                    return pipe;
                },
                del: (...keys) => {
                    tasks.push(() => redis.del(keys.flat()));
                    return pipe;
                },
                sadd: (tag, ...keys) => {
                    tasks.push(() => redis.sadd(tag, ...keys.flat()));
                    return pipe;
                },
                exec: async () => {
                    for (const t of tasks) await t();
                    return tasks.map(() => [null, 1]);
                }
            };
            return pipe;
        },
        on: (event, handler) => {}
    };
}

/**
 * Registers a cache key into a tagged Redis Set.
 */
async function tagCacheKey(tag = "tournaments:active_keys", key) {
    if (!tag || !key) return;
    try {
        if (typeof redis.sadd === 'function') {
            await redis.sadd(tag, key);
        }
    } catch (err) {
        console.warn(`[Redis Tag] Failed to tag key "${key}" under "${tag}":`, err.message);
    }
}

/**
 * Atomically invalidates all cache keys registered under a tag Set.
 * Uses a Redis pipeline with UNLINK (and DEL fallback), and cleans up the tag Set.
 */
async function invalidateCacheTag(tag = "tournaments:active_keys") {
    if (!tag) return;
    try {
        let keys = [];
        if (typeof redis.smembers === 'function') {
            keys = await redis.smembers(tag);
        }

        if (keys && keys.length > 0) {
            if (typeof redis.pipeline === 'function') {
                const pipe = redis.pipeline();
                const unlinkFn = typeof pipe.unlink === 'function' ? 'unlink' : 'del';
                pipe[unlinkFn](...keys);
                pipe.del(tag);
                await pipe.exec();
            } else {
                if (typeof redis.unlink === 'function') {
                    await redis.unlink(keys);
                } else if (typeof redis.del === 'function') {
                    await redis.del(keys);
                }
                if (typeof redis.del === 'function') {
                    await redis.del(tag);
                }
            }
        } else {
            if (typeof redis.del === 'function') {
                await redis.del(tag);
            }
        }

        // Backward compatibility fallback for legacy keys or test runners
        if (tag === "tournaments:active_keys" && typeof redis.keys === 'function') {
            const legacyKeys = await redis.keys("tournaments:*");
            const filtered = legacyKeys.filter(k => k !== "tournaments:active_keys");
            if (filtered.length > 0) {
                if (typeof redis.unlink === 'function') {
                    await redis.unlink(filtered);
                } else if (typeof redis.del === 'function') {
                    await redis.del(filtered);
                }
            }
        }
    } catch (err) {
        console.warn(`[Redis Tag] Invalidation error for tag "${tag}":`, err.message);
    }
}

redis.tagCacheKey = tagCacheKey;
redis.invalidateCacheTag = invalidateCacheTag;

module.exports = redis;
module.exports.tagCacheKey = tagCacheKey;
module.exports.invalidateCacheTag = invalidateCacheTag;
