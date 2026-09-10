import { useState, useEffect, useRef } from "react";
import { 
	Container, Box, Typography, Paper, List, ListItemButton, 
	ListItemAvatar, ListItemText, Avatar, TextField, IconButton,
	Divider, Badge
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
	const messagesEndRef = useRef(null);

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
					unreadCount: (msg.receiver._id === user.id && (!activeChat || activeChat._id !== msg.sender._id)) ? 1 : 0
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
			apiFetch(`/api/messages/${user.id}/${activeChat._id}`)
				.then(res => res.json())
				.then(data => {
					setMessages(data);
					// Clear unread count in sidebar
					setRecentChats(prev => prev.map(c => 
						c.friend._id === activeChat._id ? { ...c, unreadCount: 0 } : c
					));
				})
				.catch(console.error);
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
							{messages.map((msg, index) => {
								const isMe = msg.sender === user.id || msg.sender?._id === user.id;
								return (
									<Box key={index} sx={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "70%" }}>
										<Paper 
											elevation={0}
											sx={{ 
												p: 2, 
												bgcolor: isMe ? "primary.main" : "white", 
												color: isMe ? "white" : "text.primary",
												borderRadius: isMe ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
												border: isMe ? "none" : "1px solid #eaeaea"
											}}
										>
											<Typography variant="body1">{msg.content}</Typography>
										</Paper>
										<Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: isMe ? "right" : "left" }}>
											{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</Typography>
									</Box>
								);
							})}
							<div ref={messagesEndRef} />
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
