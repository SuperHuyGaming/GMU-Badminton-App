// client/src/hooks/useNotifications.js
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import socket from "../utils/socket";
import apiFetch from "../utils/api";

export const useNotifications = () => {
	const { user, setToastMessage } = useAuth();
	const [notifications, setNotifications] = useState([]);

	useEffect(() => {
		if (!user) {
			setNotifications([]);
			return;
		}

		// Fetch initial notifications
		apiFetch(`/api/forum/notifications/${user.id}`)
			.then((res) => res.json())
			.then((data) => setNotifications(data))
			.catch(console.error);

		// Handle live notifications
		const handleNewNotification = (notification) => {
			if (notification.targetUserId === user.id) {
				setNotifications((prev) => [notification, ...prev]);
				setToastMessage(notification.message);
			}
		};

		socket.on("newNotification", handleNewNotification);
		return () => {
			socket.off("newNotification", handleNewNotification);
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

	const clearNotifications = () => {
		setNotifications([]);
	};

	return {
		notifications,
		unreadCount,
		markAsRead,
		clearNotifications,
	};
};
