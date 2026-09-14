/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import { 
	Container, Box, Typography, Paper, List, ListItemButton, 
	ListItemAvatar, ListItemText, Avatar, TextField, IconButton,
	Divider, Badge, CircularProgress, Dialog, DialogTitle, DialogContent,
	DialogActions, Button, Chip
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";
import { getOptimizedAvatar } from "../utils/image";
import { Link as RouterLink } from "react-router-dom";

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

const formatShortTime = (dateString) => {
	if (!dateString) return "";
	const date = new Date(dateString);
	const now = new Date();
	if (now.toDateString() === date.toDateString()) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Messages = () => {
	const { user } = useAuth();
	const [recentChats, setRecentChats] = useState([]);
	const [activeChat, setActiveChat] = useState(() => {
		const saved = localStorage.getItem("activeChat");
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
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const typingTimeoutRef = useRef(null);
	const messagesEndRef = useRef(null);
	const activeChatRef = useRef(null);

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
		
		// Fetch friends list and recent chats
		Promise.all([
			apiFetch(`/api/friends/${user.id}`).then(res => res.json()),
			apiFetch(`/api/messages/recent/${user.id}`).then(res => res.json())
		]).then(([friendsData, chatsData]) => {
			setFriends(friendsData.friends || []);
			setRecentChats(chatsData || []);
		}).catch(console.error);

		const handlePrivateMessage = (msg) => {
			// Update messages if we're actively chatting with this person
			const otherUser = msg.sender._id === user.id ? msg.receiver : msg.sender;
			
			setActiveChat(currentActive => {
				if (currentActive && currentActive._id === otherUser._id) {
					setMessages(prev => {
						// Filter out optimistic UI temp messages if this is the real one
						if (msg.sender._id === user.id && prev.length > 0) {
							const lastMsg = prev[prev.length - 1];
							if (lastMsg._id.startsWith("temp-") && lastMsg.content === msg.content) {
								return [...prev.slice(0, -1), msg];
							}
						}
						return [...prev, msg];
					});
					
					// Mark as read immediately if it's from them
					if (msg.sender._id !== user.id) {
						apiFetch(`/api/messages/read/${user.id}/${msg.sender._id}`, { method: "PUT" });
					}
				}
				return currentActive;
			});

			// Update recent chats list
			setRecentChats(prev => {
				const existingIndex = prev.findIndex(c => c.friend._id === otherUser._id);
				let newChats = [...prev];
				
				const newChatObj = {
					friend: otherUser,
					lastMessage: msg,
					unreadCount: (msg.receiver._id === user.id && (!activeChatRef.current || activeChatRef.current._id !== msg.sender._id)) ? 1 : 0
				};

				if (existingIndex >= 0) {
					newChatObj.unreadCount += prev[existingIndex].unreadCount;
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
			setIsLoadingChat(true);
			setPage(1);
			setHasMore(false);
			
			apiFetch(`/api/messages/${user.id}/${activeChat._id}?page=1&limit=50`)
				.then(res => res.json())
				.then(data => {
					setMessages(data.messages || []);
					setHasMore(data.hasMore || false);
					
					// Clear unread count in sidebar
					setRecentChats(prev => prev.map(c => 
						c.friend._id === activeChat._id ? { ...c, unreadCount: 0 } : c
					));
					
					// Notify global unread count
					window.dispatchEvent(new Event("chatRead"));
				})
				.catch(console.error)
				.finally(() => setIsLoadingChat(false));
		}
	}, [activeChat, user]);

	const loadMoreMessages = async () => {
		if (!hasMore || isLoadingMore || !activeChat || !user) return;
		
		setIsLoadingMore(true);
		const nextPage = page + 1;
		
		try {
			const res = await apiFetch(`/api/messages/${user.id}/${activeChat._id}?page=${nextPage}&limit=50`);
			const data = await res.json();
			
			// We prepend the older messages to the top
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
		// Only auto-scroll if we are NOT loading older messages,
		// or if this is an initial load/new message at the bottom
		if (!isLoadingMore) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, typingUserIds, isLoadingMore]);

	// Dynamic viewport height for iOS Safari keyboard
	const [vpHeight, setVpHeight] = useState(window.innerHeight);

	useEffect(() => {
		const handleResize = () => {
			if (window.visualViewport) {
				setVpHeight(window.visualViewport.height);
			} else {
				setVpHeight(window.innerHeight);
			}
			window.scrollTo(0, 0); // Force scroll back to top if Safari pushes
		};

		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", handleResize);
			window.visualViewport.addEventListener("scroll", handleResize);
		} else {
			window.addEventListener("resize", handleResize);
		}
		
		handleResize(); // Initial set
		
		// Prevent body scroll only through CSS, let layout adjust naturally
		document.body.style.overflow = "hidden";
		
		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener("resize", handleResize);
				window.visualViewport.removeEventListener("scroll", handleResize);
			} else {
				window.removeEventListener("resize", handleResize);
			}
			document.body.style.overflow = "auto";
		};
	}, []);

	const handleSendMessage = async (e) => {
		e.preventDefault();
		if (!newMessage.trim() || !activeChat) return;

		const msgText = newMessage.trim();
		setNewMessage(""); // Clear immediately
		socket.emit("stopTyping", activeChat._id); // Stop typing when sent
		
		// Optimistic UI update
		const tempMsg = {
			sender: { ...user, _id: user.id },
			receiver: activeChat,
			content: msgText,
			timestamp: new Date().toISOString(),
			_id: "temp-" + Date.now(),
			read: false,
		};
		setMessages(prev => [...prev, tempMsg]);

		try {
			await apiFetch("/api/messages", {
				method: "POST",
				body: JSON.stringify({
					senderId: user.id,
					receiverId: activeChat._id,
					content: msgText
				})
			});
			// We do not setMessages again here because the socket will emit the real message back to us, 
			// and handlePrivateMessage will swap it or append it. Wait, handlePrivateMessage currently 
			// appends it, so we'll get a duplicate! 
			// So handlePrivateMessage should filter out duplicates.
		} catch (error) {
			console.error(error);
			setMessages(prev => prev.filter(m => m._id !== tempMsg._id)); // Revert on failure
		}
	};

	const handleTypingChange = (e) => {
		setNewMessage(e.target.value);
		if (activeChat) {
			socket.emit("typing", activeChat._id);
			if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = setTimeout(() => {
				socket.emit("stopTyping", activeChat._id);
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

	const startNewChat = (friend) => {
		setActiveChat(friend);
		setSearchQuery("");
		setSearchResults([]);
		// If friend is not in recentChats, they will be added once a message is sent
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
			// Filter out self
			setSearchResults(data.filter(u => u._id !== user.id));
		} catch (error) {
			console.error(error);
		}
	};

	const [profileFriendStatus, setProfileFriendStatus] = useState("none");

	const handleProfileClick = async () => {
		if (!activeChat) return;
		try {
			const res = await apiFetch(`/api/profile/${activeChat._id}`);
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
				overflow: 'hidden'
			}}>
				{/* Sidebar */}
				<Box sx={{ 
					width: { xs: "100%", md: 300 }, 
					display: { xs: activeChat ? "none" : "flex", md: "flex" }, 
					flexDirection: "column", 
					borderRight: { xs: "none", md: "1px solid" }, 
					borderColor: "divider", 
					height: "100%",
					bgcolor: "background.paper"
				}}>
				<Box sx={{ p: 2, bgcolor: "primary.main", color: "white", borderRadius: "12px 12px 0 0" }}>
					<Typography variant="h6" fontWeight="bold">Messages</Typography>
				</Box>
				<Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
					<TextField
						fullWidth
						size="small"
						placeholder="Search users..."
						value={searchQuery}
						onChange={handleSearch}
						sx={{ "& .MuiOutlinedInput-root": { borderRadius: 5, bgcolor: 'background.default' } }}
					/>
				</Box>
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
								<Typography variant="caption" color="text.secondary" fontWeight="bold">SEARCH RESULTS</Typography>
							</Box>
							{searchResults.length === 0 ? (
								<Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
									<Typography variant="body2">No users found.</Typography>
								</Box>
							) : (
								searchResults.map(resultUser => (
									<ListItemButton 
										key={resultUser._id} 
										onClick={() => startNewChat(resultUser)}
										sx={{ 
											mx: 1, 
											mb: 0.5, 
											borderRadius: 3, 
											transition: "all 0.2s ease-in-out",
											"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.05)', transform: 'translateX(4px)' }
										}}
									>
										<ListItemAvatar>
											<Avatar src={getOptimizedAvatar(resultUser.profilePic || "", 50)} />
										</ListItemAvatar>
										<ListItemText primary={resultUser.name} secondary={resultUser.skillLevel} />
									</ListItemButton>
								))
							)}
							<Divider sx={{ my: 1 }} />
						</>
					)}
					{!searchQuery && recentChats.length === 0 && (
						<Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
							<Typography variant="body2">No recent chats.</Typography>
						</Box>
					)}
					{!searchQuery && recentChats.map((chat) => (
						<ListItemButton 
							key={chat.friend._id} 
							selected={activeChat?._id === chat.friend._id}
							onClick={() => startNewChat(chat.friend)}
							sx={{ 
								mx: 1, 
								mb: 0.5, 
								borderRadius: 3, 
								transition: "all 0.2s ease-in-out",
								bgcolor: activeChat?._id === chat.friend._id ? 'rgba(0, 102, 51, 0.08)' : 'transparent',
								"&.Mui-selected": {
									bgcolor: 'rgba(0, 102, 51, 0.12)',
									"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.15)' }
								},
								"&:hover": { bgcolor: 'rgba(0, 102, 51, 0.05)', transform: 'translateX(4px)' }
							}}
						>
							<ListItemAvatar>
								<Badge 
									color="success" 
									variant="dot" 
									invisible={!onlineUsers.includes(chat.friend._id)}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
								>
									<Avatar src={getOptimizedAvatar(chat.friend.profilePic || "", 50)} />
								</Badge>
							</ListItemAvatar>
							<ListItemText 
								primary={
									<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
										<Typography variant="body1" sx={{ fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal' }}>
											{chat.friend.name}
										</Typography>
										{chat.lastMessage?.timestamp && (
											<Typography variant="caption" color="text.secondary">
												{formatShortTime(chat.lastMessage.timestamp)}
											</Typography>
										)}
									</Box>
								}
								secondary={
									typingUserIds.has(chat.friend._id) 
										? <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>typing...</Typography> 
										: chat.lastMessage?.content
								}
								secondaryTypographyProps={{ 
									noWrap: true, 
									color: chat.unreadCount > 0 ? 'text.primary' : 'text.secondary',
									fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal',
									sx: { pr: 2 } // padding right to avoid unread badge overlap
								}}
							/>
							{chat.unreadCount > 0 && (
								<Badge badgeContent={chat.unreadCount} color="error" sx={{ position: 'absolute', right: 24, top: '50%' }} />
							)}
						</ListItemButton>
					))}

					{!searchQuery && (
						<>
							<Divider />
							<Box sx={{ p: 2 }}>
								<Typography variant="caption" color="text.secondary" fontWeight="bold">ALL FRIENDS</Typography>
							</Box>
							
							{friends.length === 0 && (
								<Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
									<Typography variant="body2">You have no friends yet.</Typography>
								</Box>
							)}
							{friends.filter(f => !recentChats.some(c => c.friend._id === f._id)).map(friend => (
								<ListItemButton 
									key={friend._id} 
									onClick={() => startNewChat(friend)}
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
											invisible={!onlineUsers.includes(friend._id)}
											anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
										>
											<Avatar src={getOptimizedAvatar(friend.profilePic || "", 50)} />
										</Badge>
									</ListItemAvatar>
									<ListItemText primary={friend.name} />
								</ListItemButton>
							))}
						</>
					)}
				</List>
			</Box>
			<Box sx={{ 
				flex: 1, 
				display: { xs: activeChat ? "flex" : "none", md: "flex" }, 
				flexDirection: "column", 
				height: "100%",
				bgcolor: "background.paper"
			}}>
				{activeChat ? (
					<>
						<Box 
							onClick={handleProfileClick}
							sx={{ 
								p: 2, 
								borderBottom: "1px solid",
								borderColor: "divider", 
								display: "flex", 
								alignItems: "center", 
								gap: 2,
								cursor: "pointer",
								transition: "background-color 0.2s",
								"&:hover": { bgcolor: "rgba(0, 0, 0, 0.02)" },
								flexShrink: 0
							}}
						>
							<IconButton 
								sx={{ display: { md: "none" } }} 
								onClick={(e) => { e.stopPropagation(); setActiveChat(null); }}
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
							</IconButton>
							<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 50)} />
							<Box>
								<Typography variant="h6" fontWeight="bold">{activeChat.name}</Typography>
								<Typography variant="caption" color="text.secondary">
									{onlineUsers.includes(activeChat._id) ? "Online" : "Offline"}
								</Typography>
							</Box>
						</Box>
						
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
								<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 2 }}>
									<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
									<Typography>Say hi to {activeChat.name}!</Typography>
								</Box>
							) : (
								<>
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
											const senderId = messages[i]?.sender?._id || messages[i]?.sender;
											if (senderId === user.id && messages[i].read) {
												lastReadMsgIndex = i;
												break;
											}
										}
										
										return messages.map((msg, idx) => {
											const getSenderId = (m) => m?.sender?._id || m?.sender;
											const isMe = getSenderId(msg) === user.id;
											const nextMsg = messages[idx + 1];
											const prevMsg = messages[idx - 1];
											
											const isNextSame = nextMsg && getSenderId(nextMsg) === getSenderId(msg) && (new Date(nextMsg.timestamp) - new Date(msg.timestamp) < 5 * 60 * 1000);
											const isPrevSame = prevMsg && getSenderId(prevMsg) === getSenderId(msg) && (new Date(msg.timestamp) - new Date(prevMsg.timestamp) < 5 * 60 * 1000);

											return (
												<Box key={idx} sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", mb: isNextSame ? 0.5 : 2, alignItems: 'center', '&:hover .report-btn': { opacity: 1 } }}>
													{!isMe && !msg.isDeletedByAdmin && (
														<IconButton className="report-btn" size="small" onClick={() => handleReport(msg._id)} sx={{ opacity: 0, transition: 'opacity 0.2s', color: 'error.main', mr: 1 }} title="Report message">
															<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
														</IconButton>
													)}
													<Box sx={{
														maxWidth: "70%",
														p: 1.5,
														px: 2,
														borderRadius: 3,
														bgcolor: isMe ? "primary.main" : "background.paper",
														color: isMe ? "white" : "text.primary",
														boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
														border: isMe ? "none" : (msg.isDeletedByAdmin ? "1px dashed #ffcccc" : "1px solid"),
														borderColor: isMe ? undefined : "divider",
														borderTopRightRadius: isMe && isPrevSame ? 4 : 24,
														borderBottomRightRadius: isMe && isNextSame ? 4 : (isMe ? 4 : 24),
														borderTopLeftRadius: !isMe && isPrevSame ? 4 : 24,
														borderBottomLeftRadius: !isMe && isNextSame ? 4 : (!isMe ? 4 : 24)
													}}>
														{msg.isDeletedByAdmin ? (
															<Typography variant="body2" sx={{ fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.7)' : 'error.main' }}>
																[This message was removed by an Admin]
															</Typography>
														) : (
															<Typography variant="body1">{msg.content}</Typography>
														)}
														{!isNextSame && (
															<Box sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center", mt: 0.5, gap: 1 }}>
																<Typography variant="caption" sx={{ opacity: 0.7, fontSize: "0.65rem" }}>
																	{formatTime(msg.timestamp)}
																</Typography>
																{isMe && !msg.read && (
																	<Typography variant="caption" sx={{ opacity: 0.7, fontSize: "0.65rem", fontStyle: "italic" }}>
																		• Sent
																	</Typography>
																)}
																{isMe && idx === lastReadMsgIndex && (
																	<Avatar src={getOptimizedAvatar(activeChat.profilePic || "", 20)} sx={{ width: 14, height: 14 }} />
																)}
															</Box>
														)}
													</Box>
												</Box>
											);
										});
									})()}
									{typingUserIds.has(activeChat._id) && (
										<Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2, alignItems: 'center' }}>
											<Box sx={{
												p: 2,
												borderRadius: 3,
												bgcolor: "background.paper",
												color: "text.primary",
												boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
												border: "1px solid", borderColor: "divider",
												borderBottomLeftRadius: 4,
												display: "flex",
												gap: 0.5,
												alignItems: "center",
												height: 40
											}}>
												<Box sx={{ width: 6, height: 6, bgcolor: 'text.secondary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
												<Box sx={{ width: 6, height: 6, bgcolor: 'text.secondary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
												<Box sx={{ width: 6, height: 6, bgcolor: 'text.secondary', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
												<style>
													{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }`}
												</style>
											</Box>
										</Box>
									)}
									<div ref={messagesEndRef} />
								</>
							)}
						</Box>

						<Box 
							component="form" 
							onSubmit={handleSendMessage} 
							sx={{ 
								p: 2, 
								borderTop: "1px solid",
								borderColor: "divider",
								display: "flex", 
								gap: 1, 
								bgcolor: "background.paper", 
								borderRadius: "0 0 12px 12px",
								alignItems: "flex-end",
								flexShrink: 0
							}}
						>
							<TextField 
								fullWidth 
								size="small"
								placeholder="Type a message..." 
								variant="outlined" 
								multiline
								maxRows={4}
								value={newMessage}
								onChange={handleTypingChange}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSendMessage(e);
									}
								}}
								sx={{ 
									"& .MuiOutlinedInput-root": { 
										borderRadius: 5,
										bgcolor: "background.default",
									} 
								}}
							/>
							<IconButton 
								type="submit" 
								color="primary" 
								sx={{ 
									bgcolor: "primary.main", 
									color: "white", 
									"&:hover": { bgcolor: "primary.dark" },
									mb: 0.5 
								}}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
							</IconButton>
						</Box>
					</>
				) : (
					<Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "text.secondary" }}>
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
						<Typography variant="h6" sx={{ mt: 2 }}>Select a friend to start chatting</Typography>
					</Box>
				)}
			</Box>
			</Paper>
		</Container>	
			{/* Profile Dialog */}
			<Dialog 
				open={profileDialogOpen} 
				onClose={() => setProfileDialogOpen(false)} 
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
				{/* Cover Header */}
				<Box sx={{ 
					height: 120, 
					bgcolor: 'primary.main', 
					backgroundImage: profileData?.coverPic ? `url(${profileData.coverPic})` : 'linear-gradient(135deg, #006633 0%, #00b359 100%)',
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					position: 'relative' 
				}}>
					<IconButton 
						onClick={() => setProfileDialogOpen(false)} 
						sx={{ 
							position: 'absolute', 
							top: 8, 
							right: 8, 
							color: 'white', 
							bgcolor: 'rgba(0,0,0,0.4)', 
							'&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
							backdropFilter: 'blur(4px)'
						}}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
					</IconButton>
				</Box>

				<DialogContent sx={{ px: 3, pb: 4, pt: 0, position: 'relative', overflowY: 'auto' }}>
					{profileData ? (
						<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: -6 }}>
							<Avatar 
								src={getOptimizedAvatar(profileData.profilePic || "", 150)} 
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
								<Typography variant="h5" fontWeight="900" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
									{profileData.name}
								</Typography>
								<Chip 
									size="small" 
									label={profileData.skillLevel || "N/A"} 
									sx={{ 
										mt: 0.5, 
										bgcolor: 'rgba(0, 102, 51, 0.1)', 
										color: '#006633', 
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
									bgcolor: "rgba(0, 102, 51, 0.06)", 
									borderRadius: 3, 
									border: '1px solid', 
									borderColor: 'rgba(0, 102, 51, 0.1)' 
								}}>
									<Typography variant="h5" color="#006633" fontWeight="900">{profileData.singlesElo || 1200}</Typography>
									<Typography variant="caption" sx={{ color: '#006633', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>Singles</Typography>
								</Box>
								<Box sx={{ 
									flex: 1, 
									textAlign: "center", 
									p: 1.5, 
									bgcolor: "rgba(170, 59, 255, 0.06)", 
									borderRadius: 3, 
									border: '1px solid', 
									borderColor: 'rgba(170, 59, 255, 0.1)' 
								}}>
									<Typography variant="h5" color="#aa3bff" fontWeight="900">{profileData.doublesElo || 1200}</Typography>
									<Typography variant="caption" sx={{ color: '#aa3bff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>Doubles</Typography>
								</Box>
							</Box>

							{/* Details */}
							<Box sx={{ width: "100%", mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
								{profileData.bio && (
									<Box>
										<Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: 1 }}>About</Typography>
										<Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6, mt: 0.5 }}>{profileData.bio}</Typography>
									</Box>
								)}
								
								<Box sx={{ display: 'flex', gap: 2 }}>
									<Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#006633' }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
											<Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ textTransform: 'uppercase' }}>Play Style</Typography>
										</Box>
										<Typography variant="body2" fontWeight="600" color="text.primary">{profileData.preferredPlay || "Any"}</Typography>
									</Box>
									
									<Box sx={{ flex: 1, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#006633' }}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
											<Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ textTransform: 'uppercase' }}>Racket</Typography>
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
