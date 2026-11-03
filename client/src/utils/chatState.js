// client/src/utils/chatState.js
// Shared helpers for the two chat surfaces (Messages page + FloatingChatDock) and the
// global unread-messages badge (useNotifications).

// --- Which conversations are currently on screen ---------------------------------
// A message that arrives in a conversation the user is looking at is read immediately,
// so it must not bump the unread badge. Each visible chat surface registers the partner id
// it is showing; useNotifications checks this before incrementing.
const visibleChats = new Map(); // partnerId -> number of surfaces showing it

export const markChatVisible = (partnerId) => {
	if (!partnerId) return () => {};
	const id = String(partnerId);
	visibleChats.set(id, (visibleChats.get(id) || 0) + 1);
	return () => {
		const n = (visibleChats.get(id) || 0) - 1;
		if (n <= 0) visibleChats.delete(id);
		else visibleChats.set(id, n);
	};
};

export const isChatVisible = (partnerId) => Boolean(partnerId) && visibleChats.has(String(partnerId));

// --- "A conversation was read" broadcast -------------------------------------------
// useNotifications (navbar badge) and FloatingChatDock (launcher badge) listen for this.
export const CHAT_READ_EVENT = "chatRead";
// Pass { optimistic: true } before the server has marked the conversation read: listeners then
// only clear their local count for that partner and skip re-fetching (which would still see it unread).
export const notifyChatRead = (partnerId, { optimistic = false } = {}) => {
	window.dispatchEvent(new CustomEvent(CHAT_READ_EVENT, {
		detail: { partnerId: partnerId ? String(partnerId) : null, optimistic },
	}));
};

// --- Message list merging ------------------------------------------------------------
export const idOf = (ref) => {
	if (ref == null) return undefined;
	if (typeof ref === "object") return ref._id != null ? String(ref._id) : (ref.id != null ? String(ref.id) : undefined);
	return String(ref);
};

export const isTempMessage = (m) => typeof m?._id === "string" && m._id.startsWith("temp-");

/**
 * Merge a server message (from the socket echo or the POST response) into a message list.
 * - already present (same _id): the list is returned unchanged
 * - sent by me and an optimistic copy exists: that copy is replaced (by tempId when known,
 *   otherwise the oldest optimistic copy with the same content)
 * - otherwise it is appended
 */
export const mergeMessage = (list, msg, { selfId, tempId } = {}) => {
	if (!msg) return list;
	const msgId = idOf(msg);
	if (msgId && list.some((m) => idOf(m) === msgId)) {
		// Real copy already in the list; drop the now-redundant optimistic copy if any.
		return tempId ? list.filter((m) => m._id !== tempId) : list;
	}
	let idx = -1;
	if (tempId) idx = list.findIndex((m) => m._id === tempId);
	if (idx < 0 && selfId && idOf(msg.sender) === String(selfId)) {
		idx = list.findIndex((m) => isTempMessage(m) && m.content === msg.content);
	}
	if (idx >= 0) {
		const next = list.slice();
		next[idx] = msg;
		return next;
	}
	return [...list, msg];
};
