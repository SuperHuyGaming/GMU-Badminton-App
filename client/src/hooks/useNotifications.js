// client/src/hooks/useNotifications.js
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

export const useNotifications = () => {
	const { user, setToastMessage } = useAuth();
	const userId = useMemo(() => user?._id || user?.id, [user?._id, user?.id]);
	const [notifications, setNotifications] = useState([]);
	const [unreadMessages, setUnreadMessages] = useState(0);

	useEffect(() => {
		if (!userId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setNotifications([]);
			return;
		}

		const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
		if (!token) {
			return;
		}

		socket.emit("joinUserRoom", userId);

		const fetchUnread = () => {
			if (!userId) return;
			apiFetch(`/api/messages/recent/${userId}`).then(res => res ? res.json() : null)
			.then(chatsData => {
				if (!Array.isArray(chatsData)) return;
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
			if (Array.isArray(notifData)) {
				setNotifications(notifData);
			}
			if (Array.isArray(chatsData)) {
				const unread = chatsData.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
				setUnreadMessages(unread);
			}
		})
		.catch(console.error);

		window.addEventListener("chatRead", fetchUnread);

		// Handle live notifications
		const handleNewNotification = (notification) => {
			if (String(notification?.targetUserId) === String(userId)) {
				setNotifications((prev) => [notification, ...prev]);
				toast(notification.message, { icon: '🔔' });
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
		socket.on("privateMessage", handlePrivateMessage);
		
		return () => {
			socket.off("newNotification", handleNewNotification);
			socket.off("privateMessage", handlePrivateMessage);
			window.removeEventListener("chatRead", fetchUnread);
		};
	}, [userId, setToastMessage]);

	const unreadCount = notifications.filter((n) => !n.read).length;

	const markAsRead = async () => {
		if (!userId) return;
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

		await apiFetch(`/api/forum/notifications/${userId}/read`, {
			method: "PUT",
		}).catch(console.error);
	};

	const markSingleAsRead = async (notifId) => {
		if (!userId || !notifId) return;
		setNotifications((prev) => 
			prev.map((n) => n._id === notifId ? { ...n, read: true } : n)
		);
		await apiFetch(`/api/forum/notifications/single/${notifId}/read`, {
			method: "PUT",
		}).catch(console.error);
	};

	const clearNotifications = () => {
		setNotifications([]);
	};

	return {
		notifications,
		unreadCount,
		unreadMessages,
		setUnreadMessages,
		markAsRead,
		markSingleAsRead,
		clearNotifications,
	};
};
