// client/src/hooks/useNotifications.js
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { toast } from "react-hot-toast";

export const useNotifications = () => {
	const { user, setToastMessage } = useAuth();
	const [notifications, setNotifications] = useState([]);
	const [unreadMessages, setUnreadMessages] = useState(0);

	useEffect(() => {
		if (!user) {
			setNotifications([]);
			return;
		}

		socket.emit("joinUserRoom", user.id);

		const fetchUnread = () => {
			apiFetch(`/api/messages/recent/${user.id}`).then(res => res.json())
			.then(chatsData => {
				const unread = chatsData.reduce((acc, chat) => acc + chat.unreadCount, 0);
				setUnreadMessages(unread);
			}).catch(console.error);
		};

		// Fetch initial notifications and unread messages
		Promise.all([
			apiFetch(`/api/forum/notifications/${user.id}`).then(res => res.json()),
			apiFetch(`/api/messages/recent/${user.id}`).then(res => res.json())
		])
		.then(([notifData, chatsData]) => {
			setNotifications(notifData);
			const unread = chatsData.reduce((acc, chat) => acc + chat.unreadCount, 0);
			setUnreadMessages(unread);
		})
		.catch(console.error);

		window.addEventListener("chatRead", fetchUnread);

		// Handle live notifications
		const handleNewNotification = (notification) => {
			if (notification.targetUserId === user.id) {
				setNotifications((prev) => [notification, ...prev]);
				toast(notification.message, { icon: '🔔' });
			}
		};

		const handlePrivateMessage = (msg) => {
			if (msg.receiver._id === user.id || msg.receiver === user.id) {
				setUnreadMessages(prev => prev + 1);
				toast(`New message from ${msg.sender.name || 'someone'}`, { icon: '💬' });
			}
		};

		socket.on("newNotification", handleNewNotification);
		socket.on("privateMessage", handlePrivateMessage);
		
		return () => {
			socket.off("newNotification", handleNewNotification);
			socket.off("privateMessage", handlePrivateMessage);
			window.removeEventListener("chatRead", fetchUnread);
		};
	}, [user, setToastMessage]);

	const unreadCount = notifications.filter((n) => !n.read).length;

	const markAsRead = async () => {
		if (!user) return;
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

		await apiFetch(`/api/forum/notifications/${user.id}/read`, {
			method: "PUT",
		}).catch(console.error);
	};

	const markSingleAsRead = async (notifId) => {
		if (!user) return;
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
