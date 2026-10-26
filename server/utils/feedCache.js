const crypto = require("crypto");

class FeedCache {
	constructor(maxItems = 500, defaultTtlMs = 30000) {
		this.cache = new Map();
		this.maxItems = maxItems;
		this.defaultTtlMs = defaultTtlMs;
		this.stats = {
			hits: 0,
			misses: 0,
			invalidations: 0,
		};
	}

	generateETag(data) {
		const str = typeof data === "string" ? data : JSON.stringify(data);
		return `W/"${crypto.createHash("md5").update(str).digest("hex")}"`;
	}

	get(key) {
		const entry = this.cache.get(key);
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.stats.misses++;
			return null;
		}

		// Refresh LRU position
		this.cache.delete(key);
		this.cache.set(key, entry);

		this.stats.hits++;
		return {
			data: entry.data,
			etag: entry.etag,
			createdAt: entry.createdAt,
			expiresAt: entry.expiresAt,
		};
	}

	set(key, data, ttlSeconds = null) {
		const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
		const now = Date.now();
		const etag = this.generateETag(data);

		if (this.cache.size >= this.maxItems) {
			// Evict oldest item (first key in map)
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) this.cache.delete(oldestKey);
		}

		this.cache.set(key, {
			data,
			etag,
			createdAt: now,
			expiresAt: now + ttlMs,
		});

		return etag;
	}

	invalidateFeed() {
		let count = 0;
		for (const key of this.cache.keys()) {
			if (key.startsWith("feed:") || key.startsWith("trending_tags")) {
				this.cache.delete(key);
				count++;
			}
		}
		this.stats.invalidations += count;
		return count;
	}

	invalidatePrefix(prefix) {
		let count = 0;
		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
				count++;
			}
		}
		this.stats.invalidations += count;
		return count;
	}

	clear() {
		this.cache.clear();
		this.stats.invalidations++;
	}

	getStats() {
		return {
			...this.stats,
			size: this.cache.size,
			maxItems: this.maxItems,
			defaultTtlMs: this.defaultTtlMs,
		};
	}

	resetStats() {
		this.stats = {
			hits: 0,
			misses: 0,
			invalidations: 0,
		};
	}
}

const feedCache = new FeedCache();

module.exports = feedCache;
