// client/src/hooks/useNotifications.js
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";
import { CHAT_READ_EVENT, idOf, isChatVisible } from "../utils/chatState";

const UNKNOWN_PARTNER = "__unknown__";

// /api/messages/recent -> { partnerId: unreadCount }
const unreadMapFromChats = (chats) => {
	const map = {};
	chats.forEach((chat) => {
		const count = chat?.unreadCount || 0;
		if (!count) return;
		const key = idOf(chat.friend) || UNKNOWN_PARTNER;
		map[key] = (map[key] || 0) + count;
	});
	return map;
};

export const useNotifications = () => {
	const { user } = useAuth();
	const userId = useMemo(() => user?._id || user?.id, [user?._id, user?.id]);
	const [notifications, setNotifications] = useState([]);
	// Unread message counts per conversation partner, so reading one conversation can clear
	// exactly its share of the badge immediately (before the server round-trip).
	const [unreadByPartner, setUnreadByPartner] = useState({});
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!userId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setNotifications([]);
			setUnreadByPartner({});
			setLoading(false);
			return;
		}

		const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
		if (!token) {
			setNotifications([]);
			setUnreadByPartner({});
			setLoading(false);
			return;
		}

		let isCancelled = false;

		// Join the private room with the current access token; rejoin after reconnects (rooms are
		// dropped server-side) and retry once if the token was rejected (apiFetch may have refreshed it).
		const joinRoom = () => {
			const freshToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
			if (freshToken) socket.emit("joinUserRoom", { userId, token: freshToken });
		};
		let joinRetryTimer = null;
		let joinRetried = false;
		const handleJoinError = () => {
			if (joinRetried || isCancelled) return;
			joinRetried = true;
			joinRetryTimer = setTimeout(joinRoom, 3000);
		};
		joinRoom();
		socket.on("connect", joinRoom);
		socket.on("joinUserRoomError", handleJoinError);
		setLoading(true);

		// Only the most recent unread fetch may write state (an older, slower response could
		// otherwise resurrect a count that has since been cleared).
		let unreadSeq = 0;
		const fetchUnread = () => {
			if (!userId || isCancelled) return;
			const seq = ++unreadSeq;
			apiFetch(`/api/messages/recent/${userId}`).then(res => res ? res.json() : null)
			.then(chatsData => {
				if (isCancelled || seq !== unreadSeq || !Array.isArray(chatsData)) return;
				setUnreadByPartner(unreadMapFromChats(chatsData));
			}).catch(console.error);
		};

		const handleChatRead = (e) => {
			const partnerId = e?.detail?.partnerId;
			if (partnerId) {
				setUnreadByPartner((prev) => {
					if (!prev[partnerId]) return prev;
					const next = { ...prev };
					delete next[partnerId];
					return next;
				});
			}
			if (!e?.detail?.optimistic) fetchUnread();
		};

		// Fetch initial notifications and unread messages
		Promise.all([
			apiFetch(`/api/forum/notifications/${userId}`).then(res => res ? res.json() : []),
			apiFetch(`/api/messages/recent/${userId}`).then(res => res ? res.json() : [])
		])
		.then(([notifData, chatsData]) => {
			if (isCancelled) return;
			if (Array.isArray(notifData)) {
				setNotifications(notifData);
			}
			// Skip if a newer unread fetch has already been issued (e.g. a chat was read meanwhile).
			if (Array.isArray(chatsData) && unreadSeq === 0) {
				setUnreadByPartner(unreadMapFromChats(chatsData));
			}
		})
		.catch(console.error)
		.finally(() => {
			if (!isCancelled) {
				setLoading(false);
			}
		});

		window.addEventListener(CHAT_READ_EVENT, handleChatRead);

		// Handle live notifications with deduplication by _id
		const handleNewNotification = (notification) => {
			if (!notification || String(notification?.targetUserId) !== String(userId)) return;

			setNotifications((prev) => {
				const notifId = notification._id || notification.id;
				const exists = prev.some((n) => (n._id || n.id) === notifId);
				if (exists) {
					return prev.map((n) => ((n._id || n.id) === notifId ? { ...n, ...notification } : n));
				}
				return [notification, ...prev];
			});

			if (notification.message) {
				toast(notification.message, { icon: '🔔' });
			}
		};

		// Multi-tab sync: mark all as read
		const handleNotificationsMarkedRead = (payload) => {
			const payloadUserId = payload?.userId || payload?.targetUserId;
			if (String(payloadUserId) === String(userId)) {
				setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
			}
		};

		// Multi-tab sync: clear all notifications
		const handleNotificationsCleared = (payload) => {
			const payloadUserId = payload?.userId || payload?.targetUserId;
			if (String(payloadUserId) === String(userId)) {
				setNotifications([]);
			}
		};

		// Multi-tab sync: single notification read
		const handleNotificationRead = (payload) => {
			const notifId = payload?.notifId || payload?.id || payload?._id;
			if (notifId) {
				setNotifications((prev) =>
					prev.map((n) => ((n._id || n.id) === notifId ? { ...n, read: true } : n))
				);
			}
		};

		const seenMessageIds = new Set();
		const handlePrivateMessage = (msg) => {
			const receiverId = idOf(msg?.receiver);
			if (String(receiverId) !== String(userId)) return;
			// The same message can reach us more than once (e.g. reconnect replay); count it once.
			const msgId = idOf(msg);
			if (msgId) {
				if (seenMessageIds.has(msgId)) return;
				seenMessageIds.add(msgId);
			}
			const partnerId = idOf(msg?.sender) || UNKNOWN_PARTNER;
			// The user is looking at this conversation right now: it's read on arrival.
			if (isChatVisible(partnerId)) return;
			setUnreadByPartner(prev => ({ ...prev, [partnerId]: (prev[partnerId] || 0) + 1 }));
			toast(`New message from ${msg?.sender?.name || 'someone'}`, { icon: '💬' });
		};

		socket.on("newNotification", handleNewNotification);
		socket.on("notificationsMarkedRead", handleNotificationsMarkedRead);
		socket.on("notificationsCleared", handleNotificationsCleared);
		socket.on("notificationRead", handleNotificationRead);
		socket.on("privateMessage", handlePrivateMessage);
		
		return () => {
			isCancelled = true;
			clearTimeout(joinRetryTimer);
			socket.off("connect", joinRoom);
			socket.off("joinUserRoomError", handleJoinError);
			socket.off("newNotification", handleNewNotification);
			socket.off("notificationsMarkedRead", handleNotificationsMarkedRead);
			socket.off("notificationsCleared", handleNotificationsCleared);
			socket.off("notificationRead", handleNotificationRead);
			socket.off("privateMessage", handlePrivateMessage);
			window.removeEventListener(CHAT_READ_EVENT, handleChatRead);
		};
	}, [userId]);

	const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
	const unreadMessages = useMemo(
		() => Object.values(unreadByPartner).reduce((acc, n) => acc + n, 0),
		[unreadByPartner]
	);

	const markAsRead = async () => {
		const currentId = user?._id || user?.id || userId;
		if (!currentId) return;
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

		try {
			await apiFetch(`/api/forum/notifications/${currentId}/read`, {
				method: "PUT",
			});
		} catch (error) {
			console.error("Error marking notifications read:", error);
		}
	};

	const markSingleAsRead = async (notifId) => {
		const currentId = user?._id || user?.id || userId;
		if (!currentId || !notifId) return;
		setNotifications((prev) => 
			prev.map((n) => ((n._id || n.id) === notifId ? { ...n, read: true } : n))
		);

		try {
			await apiFetch(`/api/forum/notifications/single/${notifId}/read`, {
				method: "PUT",
			});
		} catch (error) {
			console.error("Error marking single notification read:", error);
		}
	};

	const clearNotifications = async () => {
		const currentId = user?._id || user?.id || userId;
		if (!currentId) return;
		setNotifications([]);

		try {
			await apiFetch(`/api/forum/notifications/${currentId}`, {
				method: "DELETE",
			});
		} catch (error) {
			console.error("Error clearing notifications:", error);
		}
	};

	return {
		notifications,
		unreadCount,
		unreadMessages,
		loading,
		markAsRead,
		markSingleAsRead,
		clearNotifications,
	};
};
