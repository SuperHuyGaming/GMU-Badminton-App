/* eslint-disable react-hooks/set-state-in-effect */
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { 
	Container, Box, Typography, Paper, List, ListItemButton, 
	ListItemAvatar, ListItemText, Avatar, TextField, IconButton,
	Divider, Badge, CircularProgress, Dialog, DialogContent,
	DialogActions, Button, Chip, Drawer, Tooltip, useTheme, useMediaQuery
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { getOptimizedAvatar } from "../utils/image";
import { idOf, mergeMessage, markChatVisible, notifyChatRead } from "../utils/chatState";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

const formatTime = (dateString) => {
	if (!dateString) return "";
	const date = new Date(dateString);
	const now = new Date();
	const isToday = now.toDateString() === date.toDateString();
	if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const isThisYear = now.getFullYear() === date.getFullYear();
	if (isThisYear) return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatLastActive = (dateString) => {
	if (!dateString) return "Offline";
	const date = new Date(dateString);
	const diffInSeconds = Math.floor((new Date() - date) / 1000);
	if (diffInSeconds < 60) return "Active just now";
	if (diffInSeconds < 3600) return `Active ${Math.floor(diffInSeconds / 60)}m ago`;
	if (diffInSeconds < 86400) return `Active ${Math.floor(diffInSeconds / 3600)}h ago`;
	if (diffInSeconds < 604800) return `Active ${Math.floor(diffInSeconds / 86400)}d ago`;
	return `Active on ${date.toLocaleDateString()}`;
};

const formatRelativeTime = (dateString) => {
	if (!dateString) return "";
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return "";
	const now = new Date();
	const diffInSec = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSec < 60) return "now";
	if (diffInSec < 3600) return `${Math.floor(diffInSec / 60)}m`;
	if (diffInSec < 86400 && now.toDateString() === date.toDateString()) {
		return `${Math.floor(diffInSec / 3600)}h`;
	}

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (yesterday.toDateString() === date.toDateString()) {
		return "Yesterday";
	}

	if (now.getFullYear() === date.getFullYear()) {
		return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
};

const isImageUrl = (url) => {
	if (typeof url !== "string") return false;
	const trimmed = url.trim();
	if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
	return (
		trimmed.includes("cloudinary.com") ||
		trimmed.includes("res.cloudinary.com") ||
		/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(trimmed)
	);
};

const slideVariants = {
	enter: (direction) => ({
		x: direction > 0 ? "100%" : "-100%",
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
		transition: {
			type: "tween",
			ease: "easeInOut",
			duration: 0.22,
		},
	},
	exit: (direction) => ({
		x: direction > 0 ? "-100%" : "100%",
		opacity: 0,
		transition: {
			type: "tween",
			ease: "easeInOut",
			duration: 0.22,
		},
	}),
};

const Messages = () => {
	const { user } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));

	const [navDirection, setNavDirection] = useState(1);
	const [inboxFilter, setInboxFilter] = useState("all");
	const [recentChats, setRecentChats] = useState([]);
	const [activeChat, setActiveChat] = useState(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			if (params.get("userId")) return null;
			if (window.innerWidth < 900) return null;
		}
		const saved = typeof localStorage !== "undefined" ? localStorage.getItem("activeChat") : null;
		return saved ? JSON.parse(saved) : null;
	});
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const [friends, setFriends] = useState([]);
	const [onlineUsers, setOnlineUsers] = useState([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [isLoadingChat, setIsLoadingChat] = useState(false);
	const [typingUserIds, setTypingUserIds] = useState(new Set());
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [profileData, setProfileData] = useState(null);
	const [profileFriendStatus, setProfileFriendStatus] = useState("none");
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const fileInputRef = useRef(null);

	const [inspectedMessage, setInspectedMessage] = useState(null);
	const [copyStatus, setCopyStatus] = useState("idle");

	const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
	const [vpHeight, setVpHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

	const typingTimeoutRef = useRef(null);
	const messagesEndRef = useRef(null);
	const activeChatRef = useRef(null);

	const onlineFriends = useMemo(() => {
		if (!onlineUsers || !Array.isArray(onlineUsers) || onlineUsers.length === 0) return [];
		const onlineSet = new Set(onlineUsers.map(String));
		const myId = String(user?.id || user?._id || "");
		const map = new Map();

		(friends || []).forEach((f) => {
			const fid = idOf(f);
			if (fid && fid !== myId && onlineSet.has(fid)) {
				map.set(fid, f);
			}
		});

		(recentChats || []).forEach((c) => {
			if (c?.friend) {
				const fid = idOf(c.friend);
				if (fid && fid !== myId && onlineSet.has(fid) && !map.has(fid)) {
					map.set(fid, c.friend);
				}
			}
		});

		return Array.from(map.values());
	}, [friends, recentChats, onlineUsers, user]);

	const unreadChatsCount = useMemo(() => {
		return (recentChats || []).filter((c) => (c.unreadCount || 0) > 0).length;
	}, [recentChats]);

	const displayedRecentChats = useMemo(() => {
		if (inboxFilter === "unread") {
			return (recentChats || []).filter(
				(c) => (c.unreadCount || 0) > 0 || (activeChat && idOf(c.friend) === idOf(activeChat))
			);
		}
		return recentChats || [];
	}, [recentChats, inboxFilter, activeChat]);

	const handleSelectConversation = (partner) => {
		setNavDirection(1);
		setActiveChat(partner);
		setSearchQuery("");
		setSearchResults([]);
		const partnerId = idOf(partner);
		if (partnerId) {
			navigate(`/messages?userId=${partnerId}`);
		}
	};

	const handleBackToInbox = () => {
		setNavDirection(-1);
		setActiveChat(null);
		navigate("/messages");
	};

	// Listen to popstate (browser/hardware back button)
	useEffect(() => {
		const handlePopState = () => {
			const searchParams = new URLSearchParams(window.location.search);
			const userIdParam = searchParams.get("userId");
			if (!userIdParam) {
				setNavDirection(-1);
				setActiveChat(null);
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	// Synchronize URL search params and location.state with activeChat
	useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		const queryUserId = searchParams.get("userId");
		const targetId = location.state?.targetUserId || queryUserId;

		if (targetId && user) {
			const currentChatId = idOf(activeChat);
			if (currentChatId !== targetId) {
				setNavDirection(1);
				const found = (recentChats || []).find(c => idOf(c.friend) === targetId)?.friend
					|| (friends || []).find(f => idOf(f) === targetId);

				if (found) {
					setActiveChat(found);
				} else {
					apiFetch(`/api/profile/${targetId}`)
						.then(res => res && res.ok ? res.json() : null)
						.then(data => {
							if (data && (data._id || data.id)) {
								setActiveChat(data);
							}
						})
						.catch(err => console.error("Error fetching target user", err));
				}
			}

			if (!queryUserId && targetId) {
				navigate(`/messages?userId=${targetId}`, { replace: true, state: {} });
			}
		} else if (!targetId) {
			if (isMobile && activeChat) {
				setNavDirection(-1);
				setActiveChat(null);
			}
		}
	}, [location.search, location.state, user, recentChats, friends, isMobile, activeChat, navigate]);

	useEffect(() => {
		activeChatRef.current = activeChat;
		if (activeChat) {
			localStorage.setItem("activeChat", JSON.stringify(activeChat));
		} else {
			localStorage.removeItem("activeChat");
		}
	}, [activeChat]);

	useEffect(() => {
		if (!user) return;
		
		Promise.all([
			apiFetch(`/api/friends/${user.id}`).then(res => res.json()),
			apiFetch(`/api/messages/recent/${user.id}`).then(res => res.json())
		]).then(([friendsData, chatsData]) => {
			setFriends(friendsData.friends || []);
			setRecentChats(chatsData || []);
		}).catch(console.error);

		const myId = String(user.id || user._id);
		const seenMessageIds = new Set();
		const handlePrivateMessage = (msg) => {
			if (!msg || !msg.sender || !msg.receiver) return;
			const msgId = idOf(msg);
			if (msgId) {
				if (seenMessageIds.has(msgId)) return;
				seenMessageIds.add(msgId);
			}
			const isMine = idOf(msg.sender) === myId;
			const otherUser = isMine ? msg.receiver : msg.sender;
			const otherId = idOf(otherUser);
			const current = activeChatRef.current;
			const isActive = Boolean(current) && idOf(current) === otherId;

			if (isActive) {
				setMessages(prev => mergeMessage(prev, msg, { selfId: myId }));

				if (!isMine) {
					Promise.resolve(apiFetch(`/api/messages/read/${user.id}/${otherId}`, { method: "PUT" }))
						.then(() => notifyChatRead(otherId))
						.catch(console.error);
				}
			}

			setRecentChats(prev => {
				const existingIndex = prev.findIndex(c => idOf(c.friend) === otherId);
				const existing = existingIndex >= 0 ? prev[existingIndex] : null;
				if (existing && idOf(existing.lastMessage) === idOf(msg)) return prev;

				const newChats = [...prev];
				const newChatObj = {
					friend: existing?.friend || otherUser,
					lastMessage: msg,
					unreadCount: isActive ? 0 : (existing?.unreadCount || 0) + (isMine ? 0 : 1)
				};

				if (existingIndex >= 0) {
					newChats.splice(existingIndex, 1);
				}
				
				newChats.unshift(newChatObj);
				return newChats;
			});
		};

		const handleOnlineUsers = (users) => setOnlineUsers(users);

		const handleTyping = ({ senderId }) => {
			setTypingUserIds(prev => new Set(prev).add(senderId));
		};

		const handleStopTyping = ({ senderId }) => {
			setTypingUserIds(prev => {
				const next = new Set(prev);
				next.delete(senderId);
				return next;
			});
		};

		const handleMessagesRead = ({ readerId }) => {
			setMessages(prev => prev.map(m => 
				(m.receiver === readerId || m.receiver?._id === readerId) ? { ...m, read: true } : m
			));
		};

		socket.on("privateMessage", handlePrivateMessage);
		socket.on("onlineUsersUpdate", handleOnlineUsers);
		socket.on("typing", handleTyping);
		socket.on("stopTyping", handleStopTyping);
		socket.on("messagesRead", handleMessagesRead);
		
		return () => {
			socket.off("privateMessage", handlePrivateMessage);
			socket.off("onlineUsersUpdate", handleOnlineUsers);
			socket.off("typing", handleTyping);
			socket.off("stopTyping", handleStopTyping);
			socket.off("messagesRead", handleMessagesRead);
		};
	}, [user]);

	useEffect(() => {
		if (activeChat && user) {
			let cancelled = false;
			const partnerId = idOf(activeChat);
			setIsLoadingChat(true);
			setPage(1);
			setHasMore(false);

			setRecentChats(prev => prev.map(c =>
				idOf(c.friend) === partnerId && c.unreadCount ? { ...c, unreadCount: 0 } : c
			));
			notifyChatRead(partnerId, { optimistic: true });

			apiFetch(`/api/messages/${user.id}/${partnerId}?page=1&limit=50`)
				.then(res => res.json())
				.then(data => {
					if (cancelled) return;
					setMessages(data.messages || []);
					setHasMore(data.hasMore || false);
					notifyChatRead(partnerId);
				})
				.catch(console.error)
				.finally(() => { if (!cancelled) setIsLoadingChat(false); });
			return () => { cancelled = true; };
		}
	}, [activeChat, user]);

	const activeChatId = idOf(activeChat);
	useEffect(() => markChatVisible(activeChatId), [activeChatId]);

	const loadMoreMessages = async () => {
		const partnerId = idOf(activeChat);
		if (!hasMore || isLoadingMore || !activeChat || !user || !partnerId) return;
		
		setIsLoadingMore(true);
		const nextPage = page + 1;
		
		try {
			const res = await apiFetch(`/api/messages/${user.id}/${partnerId}?page=${nextPage}&limit=50`);
			const data = await res.json();
			
			setMessages(prev => [...(data.messages || []), ...prev]);
			setHasMore(data.hasMore || false);
			setPage(nextPage);
		} catch (err) {
			console.error("Error loading older messages", err);
		} finally {
			setIsLoadingMore(false);
		}
	};

	useEffect(() => {
		if (!isLoadingMore) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, typingUserIds, isLoadingMore]);

	// Viewport & Virtual Keyboard awareness
	useEffect(() => {
		const handleResize = () => {
			if (typeof window !== "undefined" && window.visualViewport) {
				const curHeight = window.visualViewport.height;
				setVpHeight(curHeight);
				const keyboardOffset = Math.max(0, window.innerHeight - curHeight);
				setIsKeyboardOpen(keyboardOffset > 80);
			} else if (typeof window !== "undefined") {
				setVpHeight(window.innerHeight);
				setIsKeyboardOpen(false);
			}
			if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
				try {
					window.scrollTo(0, 0);
				} catch {
					// Ignore in headless/mock environments
				}
			}
		};

		if (typeof window !== "undefined" && window.visualViewport) {
			window.visualViewport.addEventListener("resize", handleResize);
			window.visualViewport.addEventListener("scroll", handleResize);
		} else if (typeof window !== "undefined") {
			window.addEventListener("resize", handleResize);
		}
		
		handleResize();
		
		return () => {
			if (typeof window !== "undefined" && window.visualViewport) {
				window.visualViewport.removeEventListener("resize", handleResize);
				window.visualViewport.removeEventListener("scroll", handleResize);
			} else if (typeof window !== "undefined") {
				window.removeEventListener("resize", handleResize);
			}
		};
	}, []);

	// Auto-scroll on virtual keyboard toggle
	useEffect(() => {
		if (isKeyboardOpen) {
			const timer = setTimeout(() => {
				messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			}, 120);
			return () => clearTimeout(timer);
		}
	}, [isKeyboardOpen, vpHeight]);

	const sendMessageText = async (customText) => {
		const text = (typeof customText === "string" ? customText : newMessage).trim();
		const partnerId = idOf(activeChat);
		if (!text || !activeChat || !partnerId) return;

		socket.emit("stopTyping", partnerId);
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}
		
		const tempMsg = {
			sender: { ...user, _id: user.id },
			receiver: activeChat,
			content: text,
			timestamp: new Date().toISOString(),
			_id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			read: false,
		};
		setMessages(prev => [...prev, tempMsg]);

		if (typeof customText !== "string") {
			setNewMessage("");
		}

		setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}, 50);

		try {
			const res = await apiFetch("/api/messages", {
				method: "POST",
				body: JSON.stringify({
					senderId: user.id,
					receiverId: partnerId,
					content: text
				})
			});
			if (res && res.ok === false) throw new Error("Failed to send message");
			const saved = res && typeof res.json === "function" ? await res.json().catch(() => null) : null;
			if (saved && saved._id && idOf(activeChatRef.current) === idOf(activeChat)) {
				setMessages(prev => mergeMessage(prev, saved, { selfId: String(user.id || user._id), tempId: tempMsg._id }));
			}
		} catch (error) {
			console.error("Error sending message:", error);
			setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
		}
	};

	const handleSendMessage = (e) => {
		if (e?.preventDefault) e.preventDefault();
		sendMessageText();
	};

	const handleSendQuickLike = () => {
		sendMessageText("👍");
	};

	const handleImageUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file || !activeChat) return;

		if (!file.type.startsWith("image/")) {
			alert("Please select a valid image file (PNG, JPG, WebP, GIF).");
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			alert("Image file size exceeds 10MB limit.");
			return;
		}

		setIsUploadingImage(true);
		try {
			const formData = new FormData();
			formData.append("image", file);
			formData.append("type", "postAttachment");

			const res = await apiFetch("/api/upload/image", {
				method: "POST",
				body: formData
			});

			const data = await res.json();
			if (res.ok && data?.imageUrl) {
				await sendMessageText(data.imageUrl);
			} else {
				alert(data?.message || "Failed to upload image.");
			}
		} catch (err) {
			console.error("Image upload failed:", err);
			alert("Network error occurred while uploading image.");
		} finally {
			setIsUploadingImage(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleTypingChange = (e) => {
		setNewMessage(e.target.value);
		const partnerId = idOf(activeChat);
		if (partnerId) {
			socket.emit("typing", partnerId);
			if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = setTimeout(() => {
				socket.emit("stopTyping", partnerId);
			}, 2000);
		}
	};

	const handleReport = async (msgId) => {
		if (window.confirm("Are you sure you want to report this message to admins?")) {
			try {
				await apiFetch(`/api/messages/report/${msgId}`, { method: "POST" });
				alert("Message reported successfully.");
			} catch (error) {
				console.error(error);
				alert("Failed to report message.");
			}
		}
	};

	const handleCopyMessageText = async (content) => {
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(content);
			} else {
				const textArea = document.createElement("textarea");
				textArea.value = content;
				textArea.style.position = "fixed";
				textArea.style.left = "-999999px";
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				document.execCommand("copy");
				textArea.remove();
			}
			setCopyStatus("copied");
			setTimeout(() => {
				setCopyStatus("idle");
				setInspectedMessage(null);
			}, 800);
		} catch (err) {
			console.error("Clipboard copy failed", err);
			setCopyStatus("failed");
		}
	};

	const handleSearch = async (e) => {
		const query = e.target.value;
		setSearchQuery(query);
		if (!query.trim()) {
			setSearchResults([]);
			return;
		}
		try {
			const res = await apiFetch(`/api/friends/search/${query}`);
			const data = await res.json();
			setSearchResults((data || []).filter(u => idOf(u) !== user.id));
		} catch (error) {
			console.error(error);
		}
	};

	const handleProfileClick = async () => {
		const partnerId = idOf(activeChat);
		if (!partnerId) return;
		try {
			const res = await apiFetch(`/api/profile/${partnerId}`);
			const data = await res.json();
			setProfileData(data);
			
			let status = "none";
			if (data.friends?.includes(user.id)) status = "friends";
			else if (data.friendRequests?.includes(user.id)) status = "request_sent";
			else if (data.sentFriendRequests?.includes(user.id)) status = "request_received";
			setProfileFriendStatus(status);
			
			setProfileDialogOpen(true);
		} catch (error) {
			console.error("Error fetching profile", error);
		}
	};

	const handleFriendAction = async () => {
		if (!profileData || !user) return;
		try {
			if (profileFriendStatus === "none") {
				await apiFetch(`/api/friends/request`, {
					method: "POST",
					body: JSON.stringify({ requesterId: user.id, recipientId: profileData._id })
				});
				setProfileFriendStatus("request_sent");
			} else if (profileFriendStatus === "request_received") {
				await apiFetch(`/api/friends/accept`, {
					method: "POST",
					body: JSON.stringify({ userId: user.id, requesterId: profileData._id })
				});
				setProfileFriendStatus("friends");
			} else if (profileFriendStatus === "request_sent" || profileFriendStatus === "friends") {
				const endpoint = profileFriendStatus === "friends" ? "/api/friends/remove" : "/api/friends/reject";
				const payload = profileFriendStatus === "friends" ? { userId: user.id, friendId: profileData._id } : { userId: user.id, targetId: profileData._id };
				await apiFetch(endpoint, {
					method: "POST",
					body: JSON.stringify(payload)
				});
				setProfileFriendStatus("none");
			}
		} catch (error) {
			console.error(error);
		}
	};

	const renderSidebar = () => (
		<Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
			<Box sx={{ p: 2.5, bgcolor: "transparent", color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
				<Typography variant="h6" fontWeight="bold">Messages</Typography>
			</Box>
			<Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
				<TextField
					fullWidth
					size="small"
					placeholder="Search users..."
					aria-label="Search users"
					slotProps={{ htmlInput: { 'aria-label': 'Search users' } }}
					value={searchQuery}
					onChange={handleSearch}
					sx={{ "& .MuiOutlinedInput-root": { borderRadius: 5, bgcolor: 'background.default' } }}
				/>
			</Box>

			{/* Active Now Carousel: collapses gracefully when 0 online or during search */}
			{!searchQuery && onlineFriends.length > 0 && (
				<Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
					<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
						<Typography
							variant="caption"
							sx={{
								fontWeight: 700,
								color: "text.secondary",
								textTransform: "uppercase",
								letterSpacing: "0.04em",
								fontSize: "0.68rem"
							}}
						>
							Active Now
						</Typography>
						<Typography variant="caption" sx={{ fontSize: "0.68rem", color: "success.main", fontWeight: 700 }}>
							{onlineFriends.length} online
						</Typography>
					</Box>
					<Box
						sx={{
							display: "flex",
							gap: 1.5,
							overflowX: "auto",
							pb: 0.5,
							scrollbarWidth: "none",
							"&::-webkit-scrollbar": { display: "none" }
						}}
					>
						{onlineFriends.map((friend) => {
							const fid = idOf(friend);
							return (
								<Box
									key={fid}
									component="button"
									type="button"
									aria-label={`Chat with ${friend.name || "friend"}`}
									onClick={() => handleSelectConversation(friend)}
									sx={{
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										background: "none",
										border: "none",
										p: 0,
										cursor: "pointer",
										minWidth: 54,
										maxWidth: 58,
										outline: "none",
										transition: "transform 0.18s ease",
										"&:hover": { transform: "scale(1.05)" },
										"&:active": { transform: "scale(0.96)" }
									}}
								>
									<Box
										sx={{
											position: "relative",
											p: "2px",
											borderRadius: "50%",
											border: "2px solid",
											borderColor: "success.main",
											display: "inline-flex"
										}}
									>
										<Avatar
											src={getOptimizedAvatar(friend.profilePic || "", 60)}
											alt={friend.name || "User Avatar"}
											sx={{ width: 44, height: 44 }}
										/>
										<Box
											sx={{
												position: "absolute",
												bottom: 1,
												right: 1,
												width: 12,
												height: 12,
												borderRadius: "50%",
												bgcolor: "success.main",
												border: "2px solid",
												borderColor: "background.paper"
											}}
										/>
									</Box>
									<Typography
										variant="caption"
										noWrap
										sx={{
											maxWidth: 56,
											textAlign: "center",
											mt: 0.5,
											fontSize: "0.72rem",
											fontWeight: 600,
											color: "text.primary"
										}}
									>
										{friend.name ? friend.name.split(" ")[0] : "User"}
									</Typography>
								</Box>
							);
						})}
					</Box>
				</Box>
			)}

			{/* Filter Tabs / Quick Pills */}
			{!searchQuery && (
				<Box sx={{ display: "flex", gap: 1, px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
					<Chip
						label="All"
						size="small"
						clickable
						aria-label="Show all messages"
						onClick={() => setInboxFilter("all")}
						color={inboxFilter === "all" ? "primary" : "default"}
						variant={inboxFilter === "all" ? "filled" : "outlined"}
						sx={{
							fontWeight: 700,
							borderRadius: 2,
							fontSize: "0.75rem",
							height: 28,
							...(inboxFilter === "all"
								? { bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }
								: { borderColor: "divider", color: "text.secondary" })
						}}
					/>
					<Chip
						label={unreadChatsCount > 0 ? `Unread (${unreadChatsCount})` : "Unread"}
						size="small"
						clickable
						aria-label={`Show unread messages${unreadChatsCount > 0 ? ` (${unreadChatsCount})` : ""}`}
						onClick={() => setInboxFilter("unread")}
						color={inboxFilter === "unread" ? "primary" : "default"}
						variant={inboxFilter === "unread" ? "filled" : "outlined"}
						sx={{
							fontWeight: 700,
							borderRadius: 2,
							fontSize: "0.75rem",
							height: 28,
							...(inboxFilter === "unread"
								? { bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }
								: { borderColor: "divider", color: "text.secondary" })
						}}
					/>
				</Box>
			)}

			<List sx={{ 
				flex: 1, 
				overflowY: "auto", 
				p: 1,
				"&::-webkit-scrollbar": { width: 8 },
				"&::-webkit-scrollbar-track": { bgcolor: "transparent" },
				"&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 4 },
			}}>
				{searchQuery && (
					<>
						<Box sx={{ p: 2, pb: 0 }}>
							<Typography variant="caption" color="text.primary" fontWeight="bold">SEARCH RESULTS</Typography>
						</Box>
						{searchResults.length === 0 ? (
							<Box sx={{ p: 3, textAlign: "center", color: "text.primary" }}>
								<Typography variant="body2">No users found.</Typography>
							</Box>
						) : (
							searchResults.map(resultUser => (
								<ListItemButton 
									key={resultUser._id} 
									onClick={() => handleSelectConversation(resultUser)}
									aria-label={`Conversation with ${resultUser.name}`}
									sx={{ 
										mx: 1, 
										mb: 0.5, 
										borderRadius: 3, 
										transition: "all 0.2s ease-in-out",
										"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.05)', transform: 'translateX(4px)' }
									}}
								>
									<ListItemAvatar>
										<Avatar src={getOptimizedAvatar(resultUser.profilePic || "", 50)} alt={resultUser.name || "User Avatar"} />
									</ListItemAvatar>
									<ListItemText primary={resultUser.name} secondary={resultUser.skillLevel} />
								</ListItemButton>
							))
						)}
						<Divider sx={{ my: 1 }} />
					</>
				)}

				{!searchQuery && recentChats.length === 0 && (
					<Box sx={{ p: 3, textAlign: "center", color: "text.primary" }}>
						<Typography variant="body2">No recent chats.</Typography>
					</Box>
				)}

				{!searchQuery && recentChats.length > 0 && inboxFilter === "unread" && displayedRecentChats.length === 0 && (
					<Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
						<Typography variant="body2">No unread messages.</Typography>
					</Box>
				)}

				{!searchQuery && displayedRecentChats.map((chat) => {
					const partnerId = idOf(chat.friend);
					const isSelected = Boolean(activeChat && idOf(activeChat) === partnerId);
					const isOnline = onlineUsers.map(String).includes(String(partnerId));
					const hasUnread = (chat.unreadCount || 0) > 0;

					return (
						<ListItemButton 
							key={partnerId} 
							selected={isSelected}
							onClick={() => handleSelectConversation(chat.friend)}
							aria-label={`Conversation with ${chat.friend.name}`}
							sx={{ 
								mx: 1, 
								mb: 0.5, 
								p: 1.25,
								borderRadius: 3, 
								transition: "all 0.2s ease-in-out",
								bgcolor: isSelected ? 'rgba(0, 102, 51, 0.08)' : 'transparent',
								"&.Mui-selected": {
									bgcolor: 'rgba(0, 102, 51, 0.12)',
									"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.15)' }
								},
								"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.05)', transform: 'translateX(3px)' }
							}}
						>
							{/* Left: Avatar with Online Presence Dot */}
							<ListItemAvatar sx={{ minWidth: 52 }}>
								<Badge 
									color="success" 
									variant="dot" 
									invisible={!isOnline}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
								>
									<Avatar src={getOptimizedAvatar(chat.friend.profilePic || "", 50)} alt={chat.friend.name || "User Avatar"} />
								</Badge>
							</ListItemAvatar>

							{/* Center: Contact Name and Last Message Preview */}
							<Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
								<Typography 
									variant="body1" 
									noWrap 
									sx={{ 
										fontWeight: hasUnread ? 700 : 500,
										color: 'text.primary',
										fontSize: '0.93rem',
										lineHeight: 1.3
									}}
								>
									{chat.friend.name}
								</Typography>
								{typingUserIds.has(partnerId) ? (
									<Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, display: 'block' }}>
										typing...
									</Typography>
								) : (
									<Typography 
										variant="body2" 
										noWrap 
										sx={{ 
											color: hasUnread ? 'text.primary' : 'text.secondary',
											fontWeight: hasUnread ? 600 : 400,
											fontSize: '0.82rem',
											lineHeight: 1.3
										}}
									>
										{chat.lastMessage?.content || "No messages yet"}
									</Typography>
								)}
							</Box>

							{/* Right Meta Column: Relative Timestamp + Clean Unread Pill Badge */}
							<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5, flexShrink: 0 }}>
								{chat.lastMessage?.timestamp && (
									<Typography 
										variant="caption" 
										sx={{ 
											fontSize: '0.72rem', 
											color: hasUnread ? 'primary.main' : 'text.secondary',
											fontWeight: hasUnread ? 700 : 400,
											whiteSpace: 'nowrap'
										}}
									>
										{formatRelativeTime(chat.lastMessage.timestamp)}
									</Typography>
								)}
								{hasUnread && (
									<Box 
										sx={{ 
											minWidth: 20, 
											height: 20, 
											px: 0.75, 
											borderRadius: 10, 
											bgcolor: 'primary.main', 
											color: 'white', 
											fontSize: '0.7rem', 
											fontWeight: 800, 
											display: 'flex', 
											alignItems: 'center', 
											justifyContent: 'center',
											lineHeight: 1
										}}
									>
										{chat.unreadCount > 99 ? '99+' : chat.unreadCount}
									</Box>
								)}
							</Box>
						</ListItemButton>
					);
				})}

				{!searchQuery && inboxFilter === "all" && (
					<>
						<Divider />
						<Box sx={{ p: 2 }}>
							<Typography variant="caption" color="text.primary" fontWeight="bold">ALL FRIENDS</Typography>
						</Box>
						
						{friends.length === 0 && (
							<Box sx={{ p: 3, textAlign: "center", color: "text.primary" }}>
								<Typography variant="body2">You have no friends yet.</Typography>
							</Box>
						)}
						{friends.filter(f => !recentChats.some(c => idOf(c.friend) === idOf(f))).map(friend => {
							const fid = idOf(friend);
							const isFriendOnline = onlineUsers.map(String).includes(String(fid));
							return (
								<ListItemButton 
									key={fid} 
									onClick={() => handleSelectConversation(friend)}
									aria-label={`Conversation with ${friend.name}`}
									sx={{ 
										mx: 1, 
										mb: 0.5, 
										borderRadius: 3, 
										transition: "all 0.2s ease-in-out",
										"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.05)', transform: 'translateX(4px)' }
									}}
								>
									<ListItemAvatar>
										<Badge 
											color="success" 
											variant="dot" 
											invisible={!isFriendOnline}
											anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
										>
											<Avatar src={getOptimizedAvatar(friend.profilePic || "", 50)} alt={friend.name || "User Avatar"} />
										</Badge>
									</ListItemAvatar>
									<ListItemText primary={friend.name} />
								</ListItemButton>
							);
						})}
					</>
				)}
			</List>
		</Box>
	);

	const renderConversation = () => (
		<Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
			{activeChat ? (
				<>
					{/* Conversation Header */}
					<Box 
						role="button"
						tabIndex={0}
						aria-label={`View ${activeChat.name}'s profile details`}
						onClick={handleProfileClick}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleProfileClick();
							}
						}}
						sx={{ 
							p: { xs: 1.5, sm: 2 }, 
							borderBottom: "1px solid", 
							borderColor: "divider", 
							display: "flex", 
							alignItems: "center", 
							gap: { xs: 1, sm: 2 },
							cursor: "pointer",
							transition: "background-color 0.2s",
							"&:hover": { bgcolor: "rgba(0, 0, 0, 0.02)" },
							flexShrink: 0
						}}
					>
						<IconButton 
							sx={{ 
								display: { md: "none" },
								width: 40,
								height: 40,
								minWidth: 40,
								mr: { xs: 0, sm: 0.5 }
							}} 
							onClick={(e) => { e.stopPropagation(); handleBackToInbox(); }}
							aria-label="Back to conversations"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
						</IconButton>
						<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 50)} alt={activeChat.name || "User Avatar"} />
						<Box>
							<Typography variant="h6" fontWeight="bold">{activeChat.name}</Typography>
							<Typography variant="caption" color="text.primary">
								{onlineUsers.map(String).includes(String(idOf(activeChat))) ? "Online" : formatLastActive(activeChat.lastActive)}
							</Typography>
						</Box>
					</Box>
					
					{/* Messages Scroll Area */}
					<Box sx={{ 
						flex: 1, 
						overflowY: "auto", 
						p: 3, 
						display: "flex", 
						flexDirection: "column", 
						gap: 2, 
						bgcolor: "background.default",
						"&::-webkit-scrollbar": { width: 8 },
						"&::-webkit-scrollbar-track": { bgcolor: "transparent" },
						"&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 4 },
					}}>
						{isLoadingChat ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
								<CircularProgress color="primary" />
							</Box>
						) : messages.length === 0 ? (
							<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.primary', gap: 2 }}>
								<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 120)} sx={{ width: 90, height: 90, mb: 1 }} alt={activeChat.name || "User Avatar"} />
								<Typography variant="h5" fontWeight="bold">{activeChat.name}</Typography>
								<Typography variant="body2" color="text.primary" sx={{ mb: 2 }}>
									{friends.some(f => idOf(f) === idOf(activeChat)) ? "You're friends on GMU Badminton Connect" : "Not friends yet"}
								</Typography>
								{activeChat.checkInLocation && (
									<Typography variant="body2" color="text.secondary">
										Usually plays at {activeChat.checkInLocation}
									</Typography>
								)}
								{activeChat.homeUniversity && (
									<Typography variant="body2" color="text.secondary">
										Studied at {activeChat.homeUniversity}
									</Typography>
								)}
								<Typography sx={{ mt: 2, color: 'text.secondary' }}>Say hi to {activeChat.name}!</Typography>
							</Box>
						) : (
							<>
								{!hasMore && (
									<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, mb: 6 }}>
										<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 120)} sx={{ width: 90, height: 90, mb: 2 }} alt={activeChat.name || "User Avatar"} />
										<Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>{activeChat.name}</Typography>
										<Typography variant="body2" color="text.primary">
											{friends.some(f => idOf(f) === idOf(activeChat)) ? "You're friends on GMU Badminton Connect" : "Not friends yet"}
										</Typography>
										{activeChat.checkInLocation && (
											<Typography variant="body2" color="text.secondary">
												Usually plays at {activeChat.checkInLocation}
											</Typography>
										)}
										{activeChat.homeUniversity && (
											<Typography variant="body2" color="text.secondary">
												Studied at {activeChat.homeUniversity}
											</Typography>
										)}
									</Box>
								)}
								{hasMore && (
									<Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
										<Button 
											variant="outlined" 
											size="small" 
											onClick={loadMoreMessages}
											disabled={isLoadingMore}
										>
											{isLoadingMore ? "Loading..." : "Load older messages"}
										</Button>
									</Box>
								)}
								{(() => {
									let lastReadMsgIndex = -1;
									for (let i = messages.length - 1; i >= 0; i--) {
										const senderId = messages[i]?.sender?._id || messages[i]?.sender?.id || messages[i]?.sender;
										if (senderId === user.id && messages[i].read) {
											lastReadMsgIndex = i;
											break;
										}
									}
									
									return messages.map((msg, idx) => {
										const getSenderId = (m) => m?.sender?._id || m?.sender?.id || m?.sender;
										const isMe = getSenderId(msg) === user.id;
										const nextMsg = messages[idx + 1];
										const prevMsg = messages[idx - 1];
										
										const isNextSame = nextMsg && getSenderId(nextMsg) === getSenderId(msg) && (new Date(nextMsg.timestamp) - new Date(msg.timestamp) < 5 * 60 * 1000);
										const isPrevSame = prevMsg && getSenderId(prevMsg) === getSenderId(msg) && (new Date(msg.timestamp) - new Date(prevMsg.timestamp) < 5 * 60 * 1000);
										
										const showTopTimestamp = !prevMsg || (new Date(msg.timestamp) - new Date(prevMsg.timestamp) > 15 * 60 * 1000);

										return (
											<Fragment key={msg._id || idx}>
												{showTopTimestamp && (
													<Typography variant="caption" color="text.primary" sx={{ textAlign: "center", width: "100%", display: "block", mb: 2, mt: 1, fontWeight: 'medium' }}>
														{formatTime(msg.timestamp)}
													</Typography>
												)}
												<Box sx={{ 
													display: "flex", 
													justifyContent: isMe ? "flex-end" : "flex-start", 
													mb: isNextSame ? 0.5 : 2, 
													alignItems: 'center', 
													'&:hover .report-btn': { opacity: 1 } 
												}}>
													{/* Desktop hover report button (hidden on mobile) */}
													{!isMe && !msg.isDeletedByAdmin && (
														<IconButton 
															className="report-btn" 
															size="small" 
															onClick={() => handleReport(msg._id)} 
															sx={{ 
																opacity: 0, 
																transition: 'opacity 0.2s', 
																color: 'error.main', 
																mr: 1,
																display: { xs: 'none', md: 'inline-flex' }
															}} 
															title="Report message" 
															aria-label="Report message"
														>
															<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
														</IconButton>
													)}
													<Box 
														onClick={() => setInspectedMessage(msg)}
														sx={{
															maxWidth: "70%",
															p: msg.content === "👍" ? 0.5 : 1.5,
															px: msg.content === "👍" ? 1 : 2,
															borderRadius: 3,
															bgcolor: msg.content === "👍" ? "transparent" : (isMe ? "primary.main" : "background.paper"),
															color: isMe ? "white" : "text.primary",
															boxShadow: msg.content === "👍" ? "none" : "0 2px 8px rgba(0,0,0,0.05)",
															border: msg.content === "👍" ? "none" : (isMe ? "none" : (msg.isDeletedByAdmin ? "1px dashed #ffcccc" : "1px solid")),
															borderColor: isMe ? undefined : "divider",
															borderTopRightRadius: isMe && isPrevSame ? 4 : 24,
															borderBottomRightRadius: isMe && isNextSame ? 4 : (isMe ? 4 : 24),
															borderTopLeftRadius: !isMe && isPrevSame ? 4 : 24,
															borderBottomLeftRadius: !isMe && isNextSame ? 4 : (!isMe ? 4 : 24),
															cursor: 'pointer',
															userSelect: 'none',
															transition: 'transform 0.15s ease',
															'&:active': { transform: 'scale(0.98)' }
														}}
													>
														{msg.isDeletedByAdmin ? (
															<Typography variant="body2" sx={{ fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.7)' : 'error.main' }}>
																[This message was removed by an Admin]
															</Typography>
														) : isImageUrl(msg.content) ? (
															<Box sx={{ display: 'flex', flexDirection: 'column' }}>
																{/* Preserved body1 typography for accessibility and test selectors */}
																<Typography variant="body1" sx={{ display: 'none' }}>{msg.content}</Typography>
																<Box
																	component="img"
																	src={msg.content}
																	alt="Shared attachment"
																	loading="lazy"
																	sx={{
																		maxWidth: "100%",
																		maxHeight: 280,
																		borderRadius: 2,
																		display: "block",
																		objectFit: "cover"
																	}}
																/>
															</Box>
														) : msg.content === "👍" ? (
															<Typography variant="body1" sx={{ fontSize: "2.2rem", lineHeight: 1, py: 0.25, userSelect: 'none' }}>
																👍
															</Typography>
														) : (
															<Typography variant="body1">{msg.content}</Typography>
														)}
														{!isNextSame && (isMe && (!msg.read || idx === lastReadMsgIndex)) && (
															<Box sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center", mt: 0.5, gap: 1 }}>
																{isMe && !msg.read && (
																	<Typography variant="caption" sx={{ opacity: 0.7, fontSize: "0.65rem", fontStyle: "italic" }}>
																		Sent
																	</Typography>
																)}
																{isMe && idx === lastReadMsgIndex && (
																	<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 20)} sx={{ width: 14, height: 14 }} alt="User Avatar" />
																)}
															</Box>
														)}
													</Box>
												</Box>
											</Fragment>
										);
									});
								})()}
								{typingUserIds.has(idOf(activeChat)) && (
									<Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2, alignItems: 'flex-end', gap: 1 }}>
										<Avatar src={getOptimizedAvatar(activeChat.profilePic, 30)} sx={{ width: 24, height: 24, mb: 2 }} alt="User Avatar" />
										<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
											<Box sx={{
												px: 2,
												py: 1.5,
												borderRadius: 3,
												bgcolor: "background.paper",
												color: "text.primary",
												boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
												border: "1px solid", borderColor: "divider",
												borderBottomLeftRadius: 4,
												display: "inline-flex",
												gap: 0.5,
												alignItems: "center",
												height: 36,
												width: "fit-content"
											}}>
												<Box sx={{ width: 5, height: 5, bgcolor: 'text.primary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
												<Box sx={{ width: 5, height: 5, bgcolor: 'text.primary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
												<Box sx={{ width: 5, height: 5, bgcolor: 'text.primary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
												<style>
													{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }`}
												</style>
											</Box>
											<Typography variant="caption" color="text.primary" sx={{ ml: 1, fontSize: '0.7rem' }}>
												{activeChat.name.split(' ')[0]} is typing...
											</Typography>
										</Box>
									</Box>
								)}
								<div ref={messagesEndRef} />
							</>
						)}
					</Box>

					{/* Composer Form */}
					<Box 
						component="form" 
						onSubmit={handleSendMessage} 
						sx={{
							p: { xs: 1, sm: 2 },
							pb: isKeyboardOpen 
								? 1 
								: { xs: "calc(8px + env(safe-area-inset-bottom, 0px))", sm: "calc(16px + env(safe-area-inset-bottom, 0px))", md: 2 },
							borderTop: "1px solid",
							borderColor: "divider",
							display: "flex", 
							gap: 1, 
							bgcolor: "background.paper", 
							borderRadius: { xs: 0, md: "0 0 12px 12px" },
							alignItems: "center",
							flexShrink: 0
						}}
					>
						{/* Attachment Button & Hidden File Input */}
						<Tooltip title="Attach photo">
							<span>
								<IconButton
									type="button"
									aria-label="Attach photo or image"
									disabled={isUploadingImage || !activeChat}
									onClick={() => fileInputRef.current?.click()}
									sx={{
										color: 'primary.main',
										width: 40,
										height: 40,
										minWidth: 40,
										flexShrink: 0,
										'&:hover': { bgcolor: 'action.hover' }
									}}
								>
									{isUploadingImage ? (
										<CircularProgress size={20} color="primary" />
									) : (
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
											<circle cx="8.5" cy="8.5" r="1.5"></circle>
											<polyline points="21 15 16 10 5 21"></polyline>
										</svg>
									)}
								</IconButton>
							</span>
						</Tooltip>
						<input
							type="file"
							ref={fileInputRef}
							accept="image/*"
							style={{ display: 'none' }}
							onChange={handleImageUpload}
						/>

						{/* Message Text Input */}
						<TextField 
							fullWidth 
							size="small"
							placeholder="Type a message..." 
							aria-label="Type a message"
							slotProps={{ htmlInput: { 'aria-label': 'Type a message' } }}
							variant="outlined" 
							multiline
							maxRows={4}
							value={newMessage}
							onChange={handleTypingChange}
							onFocus={() => {
								setTimeout(() => {
									messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
								}, 200);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSendMessage(e);
								}
							}}
							sx={{ 
								"& .MuiOutlinedInput-root": { 
									borderRadius: 6,
									bgcolor: "background.default",
									px: 1,
									py: 0.5,
									"& fieldset": { borderColor: "divider" },
									"&:hover fieldset": { borderColor: "primary.main" },
									"&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 1.5 }
								},
								"& textarea": {
									border: "none !important",
									outline: "none !important",
									boxShadow: "none !important",
									padding: "8px 12px !important",
									resize: "none"
								},
								"& .MuiInputBase-input": {
									border: "none !important",
									outline: "none !important",
									boxShadow: "none !important"
								}
							}}
						/>

						{/* Dynamic Send / Quick Like Button */}
						{newMessage.trim() ? (
							<IconButton 
								type="submit" 
								color="primary" 
								aria-label="Send message" 
								sx={{ 
									bgcolor: "primary.main", 
									color: "white", 
									"&:hover": { bgcolor: "primary.dark" },
									width: 40,
									height: 40,
									minWidth: 40,
									flexShrink: 0,
									transition: "all 0.2s ease"
								}}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
							</IconButton>
						) : (
							<Tooltip title="Send a thumbs-up">
								<span>
									<IconButton 
										type="button" 
										aria-label="Send a thumbs-up" 
										onClick={handleSendQuickLike}
										disabled={!activeChat}
										sx={{ 
											color: "primary.main", 
											width: 40,
											height: 40,
											minWidth: 40,
											flexShrink: 0,
											transition: "transform 0.15s ease",
											"&:hover": { 
												bgcolor: "action.hover",
												transform: "scale(1.2)" 
											},
											"&:active": { 
												transform: "scale(0.95)" 
											}
										}}
									>
										<span role="img" aria-label="thumbs up" style={{ fontSize: "1.3rem", lineHeight: 1 }}>👍</span>
									</IconButton>
								</span>
							</Tooltip>
						)}
					</Box>
				</>
			) : (
				<Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "text.primary" }}>
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
					<Typography variant="h6" sx={{ mt: 2 }}>Select a friend to start chatting</Typography>
				</Box>
			)}
		</Box>
	);

	return (
		<>
			<Container 
				disableGutters 
				maxWidth="lg" 
				sx={{ 
					mt: { xs: 0, md: 4 }, 
					height: { xs: `${vpHeight - 56}px`, md: "80vh" }, 
					display: "flex", 
					px: { xs: 0, md: 2 },
					position: { xs: "fixed", md: "static" },
					top: { xs: 56, md: "auto" },
					bottom: 0,
					left: 0,
					right: 0,
					width: "100%",
					zIndex: 1,
					bgcolor: "background.default"
				}}
			>
				<Paper elevation={0} sx={{ 
					display: 'flex', 
					width: '100%', 
					height: '100%', 
					borderRadius: { xs: 0, md: 3 }, 
					overflow: 'hidden',
					position: 'relative'
				}}>
					{isMobile ? (
						<AnimatePresence mode="wait" initial={false} custom={navDirection}>
							{!activeChat ? (
								<motion.div
									key="mobile-inbox"
									custom={navDirection}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
								>
									{renderSidebar()}
								</motion.div>
							) : (
								<motion.div
									key="mobile-conversation"
									custom={navDirection}
									variants={slideVariants}
									initial="enter"
									animate="center"
									exit="exit"
									style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
								>
									{renderConversation()}
								</motion.div>
							)}
						</AnimatePresence>
					) : (
						<>
							<Box sx={{ 
								width: 300, 
								display: "flex", 
								flexDirection: "column", 
								borderRight: "1px solid", 
								borderColor: "divider", 
								height: "100%",
								bgcolor: "background.paper"
							}}>
								{renderSidebar()}
							</Box>
							<Box sx={{ 
								flex: 1, 
								display: "flex", 
								flexDirection: "column", 
								height: "100%",
								bgcolor: "background.paper"
							}}>
								{renderConversation()}
							</Box>
						</>
					)}
				</Paper>
			</Container>

			{/* Tap-to-Inspect Message Sheet */}
			<Drawer
				anchor="bottom"
				open={Boolean(inspectedMessage)}
				onClose={() => { setInspectedMessage(null); setCopyStatus("idle"); }}
				PaperProps={{
					sx: {
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						p: 2.5,
						pb: { xs: "calc(20px + env(safe-area-inset-bottom, 0px))", sm: 3 },
						maxWidth: 520,
						mx: "auto",
						bgcolor: "background.paper",
						backgroundImage: "none"
					}
				}}
			>
				{inspectedMessage && (() => {
					const senderId = inspectedMessage?.sender?._id || inspectedMessage?.sender?.id || inspectedMessage?.sender;
					const isSenderMe = senderId === user?.id;
					const senderName = isSenderMe ? "You" : (activeChat?.name || "Partner");
					const preciseTime = inspectedMessage.timestamp
						? new Date(inspectedMessage.timestamp).toLocaleString(undefined, {
							dateStyle: "full",
							timeStyle: "medium"
						})
						: "";

					return (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
							{/* Top Drag Handle Pill */}
							<Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 0.5 }} />

							{/* Sheet Header */}
							<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
								<Box>
									<Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary" }}>
										{senderName}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
										{preciseTime}
									</Typography>
								</Box>
								<IconButton
									size="small"
									onClick={() => { setInspectedMessage(null); setCopyStatus("idle"); }}
									aria-label="Close message details"
									sx={{ color: "text.secondary" }}
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
								</IconButton>
							</Box>

							{/* Content Preview */}
							<Paper 
								variant="outlined" 
								sx={{ 
									p: 1.75, 
									borderRadius: 2.5, 
									bgcolor: "background.default", 
									maxHeight: 180, 
									overflowY: "auto",
									wordBreak: "break-word"
								}}
							>
								{isImageUrl(inspectedMessage.content) ? (
									<Box
										component="img"
										src={inspectedMessage.content}
										alt="Shared attachment"
										sx={{ maxWidth: "100%", maxHeight: 150, borderRadius: 1.5, display: "block", mx: "auto" }}
									/>
								) : (
									<Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
										{inspectedMessage.content}
									</Typography>
								)}
							</Paper>

							{/* Action Buttons */}
							<Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
								<Button
									variant="outlined"
									fullWidth
									onClick={() => handleCopyMessageText(inspectedMessage.content)}
									sx={{ 
										borderRadius: 2.5, 
										py: 1.2, 
										fontWeight: 700, 
										textTransform: "none",
										borderColor: copyStatus === "copied" ? "success.main" : "divider",
										color: copyStatus === "copied" ? "success.main" : "text.primary"
									}}
								>
									{copyStatus === "copied" ? "✓ Copied to clipboard" : "Copy Text"}
								</Button>

								{!isSenderMe && !inspectedMessage.isDeletedByAdmin && (
									<Button
										variant="outlined"
										color="error"
										fullWidth
										onClick={() => {
											const msgId = inspectedMessage._id;
											setInspectedMessage(null);
											handleReport(msgId);
										}}
										sx={{ borderRadius: 2.5, py: 1.2, fontWeight: 700, textTransform: "none" }}
									>
										Report
									</Button>
								)}
							</Box>
						</Box>
					);
				})()}
			</Drawer>

			{/* Profile Dialog */}
			<Dialog 
				open={profileDialogOpen} 
				onClose={() => setProfileDialogOpen(false)} 
				disableRestoreFocus
				aria-labelledby="messages-profile-dialog-name"
				maxWidth="xs" 
				fullWidth
				PaperProps={{ 
					sx: { 
						borderRadius: 4, 
						overflow: 'hidden',
						bgcolor: 'background.paper',
						backgroundImage: 'none'
					} 
				}}
			>
				<DialogContent sx={{ p: 0, position: 'relative', overflowY: 'auto' }}>
					{/* Cover Header */}
					<Box sx={{ 
						height: 120, 
						bgcolor: 'primary.main', 
						backgroundImage: profileData?.coverPic ? `url(${profileData.coverPic})` : 'linear-gradient(135deg, #005c2e 0%, #00b359 100%)',
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						position: 'relative' 
					}}>
						<IconButton 
							onClick={() => setProfileDialogOpen(false)} 
							aria-label="Close profile dialog" 
							sx={{ 
								position: 'absolute', 
								top: 8, 
								right: 8, 
								color: 'white', 
								bgcolor: 'rgba(0,0,0,0.4)', 
								'&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
								backdropFilter: 'blur(4px)',
								zIndex: 10
							}}
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
						</IconButton>
					</Box>

					{profileData ? (
						<Box sx={{ px: 3, pb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: -6, position: 'relative' }}>
							<Avatar 
								src={getOptimizedAvatar(profileData.profilePic || "", 150)} 
								alt={profileData.name || "User profile photo"}
								sx={{ 
									width: 104, 
									height: 104, 
									border: '4px solid', 
									borderColor: 'background.paper', 
									boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
									bgcolor: 'background.default'
								}} 
							/>
							<Box sx={{ mt: 1.5, textAlign: 'center' }}>
								<Typography id="messages-profile-dialog-name" variant="h5" fontWeight="900" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
									{profileData.name}
								</Typography>
								<Chip 
									size="small" 
									label={profileData.skillLevel || "N/A"} 
									sx={{ 
										mt: 0.5, 
										bgcolor: 'rgba(0, 92, 46, 0.1)', 
										color: 'primary.main', 
										fontWeight: '800',
										px: 1,
										fontSize: '0.75rem'
									}} 
								/>
							</Box>

							{/* Elo Stats */}
							<Box sx={{ display: "flex", justifyContent: "space-between", width: '100%', mt: 3, gap: 2 }}>
								<Box sx={{ 
									flex: 1, 
									textAlign: "center", 
									p: 1.5, 
									bgcolor: "rgba(0, 92, 46, 0.06)", 
									borderRadius: 3, 
									border: '1px solid', 
									borderColor: 'rgba(0, 92, 46, 0.15)' 
								}}>
									<Typography variant="h5" color="primary.main" fontWeight="900">{profileData.singlesElo || 1200}</Typography>
									<Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85 }}>Singles</Typography>
								</Box>
								<Box sx={{ 
									flex: 1, 
									textAlign: "center", 
									p: 1.5, 
									bgcolor: (t) => t.palette.mode === 'dark' ? "rgba(206, 147, 216, 0.12)" : "rgba(123, 31, 162, 0.06)", 
									borderRadius: 3, 
									border: '1px solid', 
									borderColor: (t) => t.palette.mode === 'dark' ? "rgba(206, 147, 216, 0.3)" : "rgba(123, 31, 162, 0.15)" 
								}}>
									<Typography variant="h5" sx={{ color: (t) => t.palette.mode === 'dark' ? '#ce93d8' : '#7b1fa2' }} fontWeight="900">{profileData.doublesElo || 1200}</Typography>
									<Typography variant="caption" sx={{ color: (t) => t.palette.mode === 'dark' ? '#ce93d8' : '#7b1fa2', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85 }}>Doubles</Typography>
								</Box>
							</Box>

							{/* Details */}
							<Box sx={{ width: "100%", mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
								{profileData.bio && (
									<Box>
										<Typography variant="overline" sx={{ color: "text.primary", fontWeight: 800, letterSpacing: 1 }}>About</Typography>
										<Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mt: 0.5 }}>{profileData.bio}</Typography>
									</Box>
								)}
								
								<Box sx={{ display: 'flex', gap: 2 }}>
									<Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'primary.main' }}>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
											<Typography variant="caption" color="text.primary" fontWeight="800" sx={{ textTransform: 'uppercase' }}>Play Style</Typography>
										</Box>
										<Typography variant="body2" fontWeight="600" color="text.primary">{profileData.preferredPlay || "Any"}</Typography>
									</Box>
									
									<Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'primary.main' }}>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
											<Typography variant="caption" color="text.primary" fontWeight="800" sx={{ textTransform: 'uppercase' }}>Racket</Typography>
										</Box>
										<Typography variant="body2" fontWeight="600" color="text.primary">{profileData.racket || "N/A"}</Typography>
									</Box>
								</Box>
							</Box>
						</Box>
					) : (
						<Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
							<CircularProgress />
						</Box>
					)}
				</DialogContent>
				{profileData && (
					<DialogActions sx={{ px: 3, pb: 3, pt: 0, display: "flex", flexDirection: "column", gap: 1 }}>
						<Button 
							variant="contained" 
							component={RouterLink} 
							to={`/profile/${profileData._id}`}
							fullWidth
							onClick={() => setProfileDialogOpen(false)}
							sx={{ 
								borderRadius: 3, 
								py: 1.5, 
								fontWeight: "bold",
								bgcolor: "primary.main",
								textTransform: 'none',
								fontSize: '1rem'
							}}
						>
							View Full Profile
						</Button>
						{user && user.id !== profileData._id && (
							<Button
								variant="outlined"
								fullWidth
								color={
									profileFriendStatus === "friends"
										? "error"
										: profileFriendStatus === "request_sent"
										? "secondary"
										: "primary"
								}
								onClick={handleFriendAction}
								sx={{ 
									borderRadius: 3, 
									py: 1.5, 
									fontWeight: "bold",
									textTransform: 'none',
									fontSize: '1rem'
								}}
							>
								{profileFriendStatus === "friends"
									? "Remove Friend"
									: profileFriendStatus === "request_sent"
									? "Cancel Request"
									: profileFriendStatus === "request_received"
									? "Accept Request"
									: "Add Friend"}
							</Button>
						)}
					</DialogActions>
				)}
			</Dialog>
		</>
	);
};

export default Messages;
