import { useState, useEffect, useRef } from "react";
import { 
	Container, Box, Typography, Paper, List, ListItemButton, 
	ListItemAvatar, ListItemText, Avatar, TextField, IconButton,
	Divider, Badge, CircularProgress
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import apiFetch from "../utils/api";
import socket from "../utils/socket";

const Messages = () => {
	const { user } = useAuth();
	const [recentChats, setRecentChats] = useState([]);
	const [activeChat, setActiveChat] = useState(null);
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const [friends, setFriends] = useState([]);
	const [onlineUsers, setOnlineUsers] = useState([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [isLoadingChat, setIsLoadingChat] = useState(false);
	const messagesEndRef = useRef(null);
	const activeChatRef = useRef(null);

	useEffect(() => {
		activeChatRef.current = activeChat;
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
					setMessages(prev => [...prev, msg]);
					
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

		socket.on("privateMessage", handlePrivateMessage);
		socket.on("onlineUsersUpdate", handleOnlineUsers);
		return () => {
			socket.off("privateMessage", handlePrivateMessage);
			socket.off("onlineUsersUpdate", handleOnlineUsers);
		};
	}, [user]);

	useEffect(() => {
		if (activeChat && user) {
			setIsLoadingChat(true);
			apiFetch(`/api/messages/${user.id}/${activeChat._id}`)
				.then(res => res.json())
				.then(data => {
					setMessages(data);
					// Clear unread count in sidebar
					setRecentChats(prev => prev.map(c => 
						c.friend._id === activeChat._id ? { ...c, unreadCount: 0 } : c
					));
				})
				.catch(console.error)
				.finally(() => setIsLoadingChat(false));
		}
	}, [activeChat, user]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSendMessage = async (e) => {
		e.preventDefault();
		if (!newMessage.trim() || !activeChat) return;

		try {
			await apiFetch("/api/messages", {
				method: "POST",
				body: JSON.stringify({
					senderId: user.id,
					receiverId: activeChat._id,
					content: newMessage.trim()
				})
			});
			setNewMessage("");
		} catch (error) {
			console.error(error);
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

	return (
		<Container maxWidth="lg" sx={{ mt: 4, height: "80vh", display: "flex", gap: 2 }}>
			{/* Sidebar */}
			<Paper elevation={0} sx={{ width: 300, display: "flex", flexDirection: "column", border: "1px solid #eaeaea", borderRadius: 3 }}>
				<Box sx={{ p: 2, bgcolor: "primary.main", color: "white", borderRadius: "12px 12px 0 0" }}>
					<Typography variant="h6" fontWeight="bold">Messages</Typography>
				</Box>
				<Box sx={{ p: 1.5, borderBottom: "1px solid #eaeaea" }}>
					<TextField
						fullWidth
						size="small"
						placeholder="Search users..."
						value={searchQuery}
						onChange={handleSearch}
						sx={{ "& .MuiOutlinedInput-root": { borderRadius: 5, bgcolor: '#f5f5f5' } }}
					/>
				</Box>
				<List sx={{ flex: 1, overflowY: "auto", p: 0 }}>
					{searchQuery && searchResults.length > 0 && (
						<>
							<Box sx={{ p: 2, pb: 0 }}>
								<Typography variant="caption" color="text.secondary" fontWeight="bold">SEARCH RESULTS</Typography>
							</Box>
							{searchResults.map(resultUser => (
								<ListItemButton key={resultUser._id} onClick={() => startNewChat(resultUser)}>
									<ListItemAvatar>
										<Avatar src={resultUser.profilePic || ""} />
									</ListItemAvatar>
									<ListItemText primary={resultUser.name} secondary={resultUser.skillLevel} />
								</ListItemButton>
							))}
							<Divider sx={{ my: 1 }} />
						</>
					)}
					{!searchQuery && recentChats.map((chat) => (
						<ListItemButton 
							key={chat.friend._id} 
							selected={activeChat?._id === chat.friend._id}
							onClick={() => startNewChat(chat.friend)}
							sx={{ borderBottom: "1px solid #f0f0f0" }}
						>
							<ListItemAvatar>
								<Badge 
									color="success" 
									variant="dot" 
									invisible={!onlineUsers.includes(chat.friend._id)}
									anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
								>
									<Avatar src={chat.friend.profilePic || ""} />
								</Badge>
							</ListItemAvatar>
							<ListItemText 
								primary={chat.friend.name}
								secondary={chat.lastMessage?.content}
								primaryTypographyProps={{ fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal' }}
								secondaryTypographyProps={{ 
									noWrap: true, 
									color: chat.unreadCount > 0 ? 'text.primary' : 'text.secondary',
									fontWeight: chat.unreadCount > 0 ? 'bold' : 'normal'
								}}
							/>
							{chat.unreadCount > 0 && (
								<Badge badgeContent={chat.unreadCount} color="error" sx={{ ml: 2 }} />
							)}
						</ListItemButton>
					))}

					{!searchQuery && (
						<>
							<Divider />
							<Box sx={{ p: 2 }}>
								<Typography variant="caption" color="text.secondary" fontWeight="bold">ALL FRIENDS</Typography>
							</Box>
							
							{friends.filter(f => !recentChats.some(c => c.friend._id === f._id)).map(friend => (
								<ListItemButton key={friend._id} onClick={() => startNewChat(friend)}>
									<ListItemAvatar>
										<Badge 
											color="success" 
											variant="dot" 
											invisible={!onlineUsers.includes(friend._id)}
											anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
										>
											<Avatar src={friend.profilePic || ""} />
										</Badge>
									</ListItemAvatar>
									<ListItemText primary={friend.name} />
								</ListItemButton>
							))}
						</>
					)}
				</List>
			</Paper>

			{/* Chat Window */}
			<Paper elevation={0} sx={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #eaeaea", borderRadius: 3 }}>
				{activeChat ? (
					<>
						<Box sx={{ p: 2, borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: 2 }}>
							<Avatar src={activeChat.profilePic || ""} />
							<Typography variant="h6" fontWeight="bold">{activeChat.name}</Typography>
						</Box>
						
						<Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", flexDirection: "column", gap: 2, bgcolor: "#f9f9f9" }}>
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
									{messages.map((msg, idx) => {
										const isMe = msg.sender === user.id || msg.sender._id === user.id;
										return (
											<Box key={idx} sx={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", mb: 2, alignItems: 'center', '&:hover .report-btn': { opacity: 1 } }}>
												{!isMe && !msg.isDeletedByAdmin && (
													<IconButton className="report-btn" size="small" onClick={() => handleReport(msg._id)} sx={{ opacity: 0, transition: 'opacity 0.2s', color: 'error.main', mr: 1 }} title="Report message">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
													</IconButton>
												)}
												<Box sx={{
													maxWidth: "70%",
													p: 2,
													borderRadius: 3,
													bgcolor: isMe ? "primary.main" : "white",
													color: isMe ? "white" : "text.primary",
													boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
													border: isMe ? "none" : (msg.isDeletedByAdmin ? "1px dashed #ffcccc" : "1px solid #eaeaea"),
													borderBottomRightRadius: isMe ? 4 : 24,
													borderBottomLeftRadius: isMe ? 24 : 4
												}}>
													{msg.isDeletedByAdmin ? (
														<Typography variant="body2" sx={{ fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.7)' : 'error.main' }}>
															[This message was removed by an Admin]
														</Typography>
													) : (
														<Typography variant="body1">{msg.content}</Typography>
													)}
													<Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.7, textAlign: isMe ? "right" : "left" }}>
														{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
													</Typography>
												</Box>
											</Box>
										);
									})}
									<div ref={messagesEndRef} />
								</>
							)}
						</Box>

						<Box component="form" onSubmit={handleSendMessage} sx={{ p: 2, borderTop: "1px solid #eaeaea", display: "flex", gap: 1, bgcolor: "white", borderRadius: "0 0 12px 12px" }}>
							<TextField 
								fullWidth 
								size="small"
								placeholder="Type a message..." 
								variant="outlined" 
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								sx={{ "& .MuiOutlinedInput-root": { borderRadius: 5 } }}
							/>
							<IconButton type="submit" color="primary" sx={{ bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } }}>
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
			</Paper>
		</Container>
	);
};

export default Messages;
