const redisClient = require("./redis");

const memoryCache = new Map();
const TTL_SECONDS = 300;

// Cleanup memory cache every 60 seconds
const cleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const [key, value] of memoryCache.entries()) {
		if (value.expiresAt <= now) {
			memoryCache.delete(key);
		}
	}
}, 60000);
if (cleanupInterval.unref) cleanupInterval.unref();

async function getIdempotentResult(key) {
	if (!key) return null;
	
	// Check in-memory first
	const mem = memoryCache.get(key);
	if (mem && mem.expiresAt > Date.now()) {
		return mem;
	}

	// Check Redis if available
	try {
		if (redisClient && typeof redisClient.get === "function") {
			const raw = await redisClient.get(`idempotency:friends:${key}`);
			if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
		}
	} catch (e) {
		// Fall back to memory silently
	}
	return null;
}

async function markIdempotentInFlight(key) {
	if (!key) return;
	const record = { status: "in-flight", expiresAt: Date.now() + 60000 };
	memoryCache.set(key, record);

	try {
		if (redisClient && typeof redisClient.setex === "function") {
			await redisClient.setex(`idempotency:friends:${key}`, 60, JSON.stringify(record));
		}
	} catch (e) {}
}

async function setIdempotentCompleted(key, responseData) {
	if (!key) return;
	const record = { status: "completed", response: responseData, expiresAt: Date.now() + TTL_SECONDS * 1000 };
	memoryCache.set(key, record);

	try {
		if (redisClient && typeof redisClient.setex === "function") {
			await redisClient.setex(`idempotency:friends:${key}`, TTL_SECONDS, JSON.stringify(record));
		}
	} catch (e) {}
}

async function clearIdempotentKey(key) {
	if (!key) return;
	memoryCache.delete(key);
	try {
		if (redisClient && typeof redisClient.del === "function") {
			await redisClient.del(`idempotency:friends:${key}`);
		}
	} catch (e) {}
}

function clearMemoryCache() {
	memoryCache.clear();
}

module.exports = {
	getIdempotentResult,
	markIdempotentInFlight,
	setIdempotentCompleted,
	clearIdempotentKey,
	clearMemoryCache
};
