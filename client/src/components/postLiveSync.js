// client/src/components/postLiveSync.js
// Helpers that keep a post card in step with live (socket) updates.

export const hasPopulatedComments = (arr) =>
	Array.isArray(arr) && arr.length > 0 && arr.some((c) => c && (c._id || c.text || c.content));

// Feed items carry their own ActivityFeed `_id` plus the underlying Post id in
// `referenceId` (or `postId`, or a nested `post`). Socket payloads use the Post id,
// so a card matches an event when any of these ids line up.
const idString = (value) => {
	const raw = value && typeof value === "object" ? (value._id || value.id) : value;
	return raw ? String(raw) : "";
};

const postIdsOf = (p) =>
	p ? [p._id, p.referenceId, p.postId, p.post?._id].map(idString).filter(Boolean) : [];

export const isSamePost = (payload, local) => {
	const localIds = new Set(postIdsOf(local));
	return postIdsOf(payload).some((id) => localIds.has(id));
};

// Visibility can sit on the feed item itself or on the Post it points to.
const VISIBILITY_VALUES = new Set(["PUBLIC", "FRIENDS_ONLY", "ONLY_ME"]);

export const resolveVisibility = (p) => {
	const candidates = [
		p?.visibility,
		p?.post?.visibility,
		p?.reference?.visibility,
		p?.referenceId && typeof p.referenceId === "object" ? p.referenceId.visibility : undefined,
	];
	return candidates.find((v) => VISIBILITY_VALUES.has(v)) || "PUBLIC";
};

// Posts created without a title get one copied from the body's first line (see Forum.jsx).
export const autoTitleFrom = (content) =>
	(content || "").trim().split("\n")[0].slice(0, 80).trim();

// Merges a post payload into the card's state without letting missing or partial
// fields wipe what the card already shows: null/undefined never overwrite, a list
// is only replaced by a real list, and an id-only comment list never replaces
// loaded comments. Ids are kept so the card stays matched to its feed item.
export const mergePostData = (prev, incoming) => {
	if (!incoming || typeof incoming !== "object") return prev;
	const next = { ...prev };
	Object.entries(incoming).forEach(([key, value]) => {
		if (value === undefined || value === null) return;
		if (key === "_id" || key === "referenceId") return;
		if (Array.isArray(prev?.[key]) && !Array.isArray(value)) return;
		next[key] = value;
	});
	if (
		Array.isArray(incoming.comments) &&
		incoming.comments.length > 0 &&
		!hasPopulatedComments(incoming.comments) &&
		hasPopulatedComments(prev?.comments)
	) {
		next.comments = prev.comments;
	}
	return next;
};
