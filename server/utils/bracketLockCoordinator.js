/**
 * server/utils/bracketLockCoordinator.js
 * Redis-backed distributed lock with in-memory fallback.
 * Manages 60-second active leases with 20-second heartbeat refresh for umpires scoring court matches.
 */

class BracketLockCoordinator {
    constructor(redisClient = null) {
        this.redis = redisClient;
        this.memoryLocks = new Map(); // matchId -> { umpireName, socketId, expiresAt }
    }

    async acquireLock(matchId, umpireName, socketId, ttlSeconds = 60) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        const lockPayload = JSON.stringify({ umpireName, socketId, expiresAt });

        if (this.redis && typeof this.redis.set === 'function') {
            try {
                // Redis atomic SET key value EX ttl NX
                const acquired = await this.redis.set(`bracket:lock:${matchId}`, lockPayload, 'EX', ttlSeconds, 'NX');
                if (!acquired) {
                    const currentRaw = await this.redis.get(`bracket:lock:${matchId}`);
                    const current = currentRaw ? JSON.parse(currentRaw) : {};
                    // If the current lock belongs to the same socket, allow re-acquisition/refresh
                    if (current.socketId === socketId) {
                        await this.redis.set(`bracket:lock:${matchId}`, lockPayload, 'EX', ttlSeconds);
                        return { success: true, expiresAt };
                    }
                    return { success: false, lockedBy: current.umpireName, expiresAt: current.expiresAt };
                }
                return { success: true, expiresAt };
            } catch (err) {
                console.error("Redis acquireLock error, falling back to memory:", err.message);
            }
        }

        // In-memory fallback
        const existing = this.memoryLocks.get(matchId);
        if (existing && existing.expiresAt > Date.now() && existing.socketId !== socketId) {
            return { success: false, lockedBy: existing.umpireName, expiresAt: existing.expiresAt };
        }

        this.memoryLocks.set(matchId, { umpireName, socketId, expiresAt });
        return { success: true, expiresAt };
    }

    async refreshLock(matchId, socketId, ttlSeconds = 60) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        if (this.redis && typeof this.redis.get === 'function') {
            try {
                const currentRaw = await this.redis.get(`bracket:lock:${matchId}`);
                if (currentRaw) {
                    const current = JSON.parse(currentRaw);
                    if (current.socketId === socketId) {
                        await this.redis.set(`bracket:lock:${matchId}`, JSON.stringify({ ...current, expiresAt }), 'EX', ttlSeconds);
                        return true;
                    }
                }
                return false;
            } catch (err) {
                console.error("Redis refreshLock error, falling back to memory:", err.message);
            }
        }

        const existing = this.memoryLocks.get(matchId);
        if (existing && existing.socketId === socketId) {
            existing.expiresAt = expiresAt;
            return true;
        }
        return false;
    }

    async releaseLock(matchId, socketId) {
        if (this.redis && typeof this.redis.get === 'function') {
            try {
                const currentRaw = await this.redis.get(`bracket:lock:${matchId}`);
                if (currentRaw) {
                    const current = JSON.parse(currentRaw);
                    if (current.socketId === socketId) {
                        await this.redis.del(`bracket:lock:${matchId}`);
                        return true;
                    }
                }
                return false;
            } catch (err) {
                console.error("Redis releaseLock error, falling back to memory:", err.message);
            }
        }

        const existing = this.memoryLocks.get(matchId);
        if (existing && existing.socketId === socketId) {
            this.memoryLocks.delete(matchId);
            return true;
        }
        return false;
    }

    async getLock(matchId) {
        if (this.redis && typeof this.redis.get === 'function') {
            try {
                const currentRaw = await this.redis.get(`bracket:lock:${matchId}`);
                if (currentRaw) {
                    const current = JSON.parse(currentRaw);
                    if (current.expiresAt > Date.now()) {
                        return { isLocked: true, ...current };
                    }
                }
                return { isLocked: false };
            } catch (err) {
                console.error("Redis getLock error, falling back to memory:", err.message);
            }
        }

        const existing = this.memoryLocks.get(matchId);
        if (existing && existing.expiresAt > Date.now()) {
            return { isLocked: true, ...existing };
        }
        return { isLocked: false };
    }

    releaseSocketLocks(socketId) {
        const releasedMatchIds = [];
        for (const [matchId, lock] of this.memoryLocks.entries()) {
            if (lock.socketId === socketId) {
                this.memoryLocks.delete(matchId);
                releasedMatchIds.push(matchId);
            }
        }
        return releasedMatchIds;
    }
}

module.exports = BracketLockCoordinator;
