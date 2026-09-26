import { useState, useEffect, useRef } from "react";
import {
	Box,
	Typography,
	Button,
	TextField,
	Avatar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CommentThread from "./CommentThread"; // FIX: Import the new separated component!

import socket from "../utils/socket";

export default function PostCommentsInline({
	localPost,
	setLocalPost,
	currentUser,
	highlightId,
	openLikes,
}) {
	const navigate = useNavigate();

	const [newReplyText, setNewReplyText] = useState("");
	const [loadingItems, setLoadingItems] = useState({});
	const [typingUsers, setTypingUsers] = useState(new Set());
	const typingTimeoutRef = useRef(null);

	const clickableStyle = {
		cursor: "pointer",
		"&:hover": { textDecoration: "underline", opacity: 0.8 },
		"&:active": { transform: "scale(0.95)" },
	};

	useEffect(() => {
		const onTyping = (data) => {
			if (data.postId === localPost._id && data.userName !== currentUser?.name) {
				setTypingUsers((prev) => {
					const next = new Set(prev);
					next.add(data.userName);
					return next;
				});
			}
		};
		const onStopTyping = (data) => {
			if (data.postId === localPost._id) {
				setTypingUsers((prev) => {
					const next = new Set(prev);
					next.delete(data.userName);
					return next;
				});
			}
		};

		socket.on("commentTyping", onTyping);
		socket.on("commentStopTyping", onStopTyping);
		return () => {
			socket.off("commentTyping", onTyping);
			socket.off("commentStopTyping", onStopTyping);
		};
	}, [localPost._id, currentUser]);

	useEffect(() => {
		if (highlightId) {
			setTimeout(() => {
				const targetElement = document.getElementById(
					`comment-${highlightId}`,
				);
				if (targetElement)
					targetElement.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
			}, 300);
		}
	}, [highlightId]);

	// Shared utility to handle @mentions and breaking long strings
	const renderContentWithTags = (content) => {
		if (!content) return null;
		const userMap = new Map();
		if (localPost.authorName)
			userMap.set(localPost.authorName, localPost.authorId);
		localPost.comments?.forEach((c) => {
			userMap.set(c.authorName, c.authorId);
			c.replies?.forEach((r) => userMap.set(r.authorName, r.authorId));
		});

		if (userMap.size === 0)
			return (
				<Typography
					variant="body2"
					sx={{
						fontSize: "0.875rem",
						mt: 0.5,
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						overflowWrap: "anywhere",
					}}
				>
					{content}
				</Typography>
			);

		const names = Array.from(userMap.keys())
			.sort((a, b) => b.length - a.length)
			.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
		const regex = new RegExp(`(@(?:${names.join("|")}))`, "g");
		const parts = content.split(regex);

		return (
			<Typography
				variant="body2"
				sx={{
					fontSize: "0.875rem",
					mt: 0.5,
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					overflowWrap: "anywhere",
				}}
			>
				{parts.map((part, i) => {
					if (part.startsWith("@")) {
						const name = part.substring(1);
						const id = userMap.get(name);
						if (id)
							return (
								<Box
									key={i}
									component="span"
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/profile/${id}`);
									}}
									sx={{
										color: "primary.main",
										fontWeight: "bold",
										backgroundColor:
											"rgba(0, 102, 51, 0.12)",
										px: 0.6,
										py: 0.2,
										borderRadius: 1.5,
										cursor: "pointer",
										display: "inline-block",
										"&:hover": {
											textDecoration: "underline",
											backgroundColor:
												"rgba(0, 102, 51, 0.25)",
										},
									}}
								>
									{part}
								</Box>
							);
					}
					return <span key={i}>{part}</span>;
				})}
			</Typography>
		);
	};

	const apiCall = async (
		endpoint,
		method,
		bodyData,
		skipStateUpdate = false,
	) => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}${endpoint}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify(bodyData),
				},
			);
			if (res.ok && !skipStateUpdate) setLocalPost(await res.json());
		} catch (err) {
			console.error(err);
		}
	};

	const handleToggleLike = async (endpoint, itemId) => {
		if (!currentUser) return alert("You must be logged in!");
		if (loadingItems[itemId]) return;

		setLoadingItems((prev) => ({ ...prev, [itemId]: true }));
		await apiCall(endpoint, "PUT", {
			userId: currentUser.id,
			userName: currentUser.name,
		});
		setLoadingItems((prev) => ({ ...prev, [itemId]: false }));
	};

	const handlePostMainComment = () => {
		if (!newReplyText.trim() || !currentUser) return;
		apiCall(`/api/forum/${localPost._id}/comments`, "POST", {
			authorId: currentUser.id,
			authorName: currentUser.name,
			content: newReplyText.trim(),
		});
		setNewReplyText("");
		socket.emit("commentStopTyping", { postId: localPost._id, userName: currentUser.name });
	};

	const handleTyping = (e) => {
		setNewReplyText(e.target.value);
		if (currentUser) {
			socket.emit("commentTyping", { postId: localPost._id, userName: currentUser.name });
			clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = setTimeout(() => {
				socket.emit("commentStopTyping", { postId: localPost._id, userName: currentUser.name });
			}, 2000);
		}
	};

	const formatTime = (dateString) =>
		dateString
			? new Date(dateString).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					hour: "numeric",
					minute: "2-digit",
				})
			: "Just now";

	return (
		<Box sx={{ borderTop: "1px solid", borderColor: "divider", mt: 2, pt: 2 }}>
			

			<Box>
				

				<Box sx={{ p: { xs: 1, sm: 2 } }}>
					{!localPost.comments?.length ? (
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ textAlign: "center", mt: 2 }}
						>
							No comments yet. Be the first to reply!
						</Typography>
					) : (
						<Box
							sx={{
								display: "flex",
								flexDirection: "column",
								gap: 2,
							}}
						>
							{/* FIX: Delegate the complex mapping to the new CommentThread component! */}
							{localPost.comments.map((comment) => (
								<CommentThread
									key={comment._id}
									comment={comment}
									localPost={localPost}
									currentUser={currentUser}
									highlightId={highlightId}
									openLikes={openLikes}
									handleToggleLike={handleToggleLike}
									apiCall={apiCall}
									formatTime={formatTime}
									renderContentWithTags={
										renderContentWithTags
									}
									clickableStyle={clickableStyle}
								/>
							))}
						</Box>
					)}
				</Box>
			</Box>

			{/* TYPING INDICATOR */}
			{typingUsers.size > 0 && (
				<Typography variant="caption" color="text.secondary" sx={{ ml: 6, fontStyle: "italic", mb: 0.5, display: "block" }}>
					{Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
				</Typography>
			)}

			{/* MAIN POST COMMENT INPUT */}
			<Box
				sx={{
					p: 1.5,
					backgroundColor: "background.paper",
					borderTop: "1px solid",
					borderColor: "divider",
					display: "flex",
					gap: 1,
					alignItems: "flex-end",
				}}
			>
				<Avatar
					src={currentUser?.profilePic}
					sx={{
						width: 32,
						height: 32,
						bgcolor: "primary.main",
						mb: 0.5,
					}}
				>
					{!currentUser?.profilePic && currentUser?.name
						? currentUser.name?.charAt(0).toUpperCase()
						: "?"}
				</Avatar>
				<TextField
					fullWidth
					size="small"
					multiline
					maxRows={4}
					placeholder={
						currentUser ? "Write a comment..." : "Login to comment"
					}
					value={newReplyText}
					onChange={handleTyping}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							handlePostMainComment();
						}
					}}
					disabled={!currentUser}
					sx={{
						"& .MuiOutlinedInput-root": {
							borderRadius: "20px",
							backgroundColor: "action.hover",
							py: 1,
							px: 2,
						},
					}}
				/>
				<Button
					variant="contained"
					onClick={handlePostMainComment}
					disabled={!newReplyText.trim() || !currentUser}
					sx={{
						borderRadius: 5,
						fontWeight: "bold",
						textTransform: "none",
						mb: 0.5,
						transition: "all 0.1s",
						"&:active": { transform: "scale(0.95)" },
					}}
				>
					Post
				</Button>
			</Box>
		</Box>
	);
}
