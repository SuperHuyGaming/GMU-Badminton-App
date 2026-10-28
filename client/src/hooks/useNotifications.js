// client/src/hooks/useNotifications.js
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

export const useNotifications = () => {
	const { user } = useAuth();
	const userId = useMemo(() => user?._id || user?.id, [user?._id, user?.id]);
	const [notifications, setNotifications] = useState([]);
	const [unreadMessages, setUnreadMessages] = useState(0);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!userId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setNotifications([]);
			setUnreadMessages(0);
			setLoading(false);
			return;
		}

		const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
		if (!token) {
			setNotifications([]);
			setUnreadMessages(0);
			setLoading(false);
			return;
		}

		let isCancelled = false;

		socket.emit("joinUserRoom", userId);
		setLoading(true);

		const fetchUnread = () => {
			if (!userId || isCancelled) return;
			apiFetch(`/api/messages/recent/${userId}`).then(res => res ? res.json() : null)
			.then(chatsData => {
				if (isCancelled || !Array.isArray(chatsData)) return;
				const unread = chatsData.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
				setUnreadMessages(unread);
			}).catch(console.error);
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
			if (Array.isArray(chatsData)) {
				const unread = chatsData.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
				setUnreadMessages(unread);
			}
		})
		.catch(console.error)
		.finally(() => {
			if (!isCancelled) {
				setLoading(false);
			}
		});

		window.addEventListener("chatRead", fetchUnread);

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

		const handlePrivateMessage = (msg) => {
			const receiverId = msg?.receiver?._id || msg?.receiver;
			if (String(receiverId) === String(userId)) {
				setUnreadMessages(prev => prev + 1);
				toast(`New message from ${msg?.sender?.name || 'someone'}`, { icon: '💬' });
			}
		};

		socket.on("newNotification", handleNewNotification);
		socket.on("notificationsMarkedRead", handleNotificationsMarkedRead);
		socket.on("notificationsCleared", handleNotificationsCleared);
		socket.on("notificationRead", handleNotificationRead);
		socket.on("privateMessage", handlePrivateMessage);
		
		return () => {
			isCancelled = true;
			socket.off("newNotification", handleNewNotification);
			socket.off("notificationsMarkedRead", handleNotificationsMarkedRead);
			socket.off("notificationsCleared", handleNotificationsCleared);
			socket.off("notificationRead", handleNotificationRead);
			socket.off("privateMessage", handlePrivateMessage);
			window.removeEventListener("chatRead", fetchUnread);
		};
	}, [userId]);

	const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

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
		setUnreadMessages,
		loading,
		markAsRead,
		markSingleAsRead,
		clearNotifications,
	};
};
