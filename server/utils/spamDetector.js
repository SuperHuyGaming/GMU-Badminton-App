const crypto = require('crypto');
const { analyzeContent } = require('./aiModeration');

// In-memory sliding window for per-user rate limiting (max 3 posts per 60 seconds)
const userPostTimestamps = new Map();

// In-memory or recent post hash cache (authorId + contentHash -> timestamp)
const recentPostHashes = new Map();

function cleanUpOldEntries() {
	const now = Date.now();
	for (const [userId, timestamps] of userPostTimestamps.entries()) {
		const valid = timestamps.filter(t => now - t < 60000);
		if (valid.length === 0) userPostTimestamps.delete(userId);
		else userPostTimestamps.set(userId, valid);
	}
	for (const [key, ts] of recentPostHashes.entries()) {
		if (now - ts > 600000) recentPostHashes.delete(key); // 10 min window
	}
}

function resetSpamDetectorState() {
	userPostTimestamps.clear();
	recentPostHashes.clear();
}

async function evaluateSpamHeuristics({ userId, title, content }) {
	cleanUpOldEntries();
	const now = Date.now();
	const fullText = `${title || ''} ${content || ''}`.trim();

	// 1. Rate Limiting per User (Max 3 posts / 60 seconds)
	if (userId) {
		const timestamps = userPostTimestamps.get(userId.toString()) || [];
		const recent = timestamps.filter(t => now - t < 60000);
		if (recent.length >= 3) {
			return {
				isSpam: true,
				reason: "Rate limit exceeded: Maximum 3 posts per minute.",
				heuristic: "rate_limit"
			};
		}
	}

	// 2. Duplicate Content Hash Matching
	if (userId && fullText.length > 5) {
		const hash = crypto.createHash('sha256').update(fullText.toLowerCase().replace(/\s+/g, '')).digest('hex');
		const hashKey = `${userId}:${hash}`;
		if (recentPostHashes.has(hashKey)) {
			return {
				isSpam: true,
				reason: "Duplicate content detected: You recently posted this exact content.",
				heuristic: "duplicate_content"
			};
		}
	}

	// 3. Excessive URL / Link Count Regex (> 2 external links)
	const urlMatches = fullText.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi) || [];
	if (urlMatches.length > 2) {
		return {
			isSpam: true,
			reason: `Excessive links detected: Found ${urlMatches.length} URLs (limit is 2).`,
			heuristic: "excessive_urls"
		};
	}

	// 4. Commercial Spam Keywords Scoring
	const spamKeywords = [
		"free money", "buy cheap crypto", "cashapp", "venmo me", "sugar daddy", 
		"earn cash fast", "whatsapp", "telegram", "casino", "investment returns",
		"click here now", "giftcard"
	];
	const lower = fullText.toLowerCase();
	const keywordMatches = spamKeywords.filter(k => lower.includes(k));
	if (keywordMatches.length >= 2 || (keywordMatches.length >= 1 && urlMatches.length >= 1)) {
		return {
			isSpam: true,
			reason: `Spam keywords detected: [${keywordMatches.join(', ')}]`,
			heuristic: "spam_keywords"
		};
	}

	// 5. AI Moderation / Perspective API Sentiment & Toxicity
	try {
		if (typeof analyzeContent === 'function') {
			const aiResult = await analyzeContent(fullText);
			if (aiResult && aiResult.isFlagged) {
				return {
					isSpam: true,
					reason: aiResult.reason || "AI Moderation flagged content.",
					heuristic: "ai_moderation",
					score: aiResult.score
				};
			}
		}
	} catch (aiErr) {
		console.warn("AI Moderation check error in spamDetector:", aiErr);
	}

	// If clean, record timestamp and content hash
	if (userId) {
		const timestamps = userPostTimestamps.get(userId.toString()) || [];
		timestamps.push(now);
		userPostTimestamps.set(userId.toString(), timestamps);

		const hash = crypto.createHash('sha256').update(fullText.toLowerCase().replace(/\s+/g, '')).digest('hex');
		recentPostHashes.set(`${userId}:${hash}`, now);
	}

	return { isSpam: false, reason: "", heuristic: "none" };
}

module.exports = {
	evaluateSpamHeuristics,
	userPostTimestamps,
	recentPostHashes,
	resetSpamDetectorState
};
