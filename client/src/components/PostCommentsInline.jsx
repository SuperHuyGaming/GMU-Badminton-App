// client/src/components/PostCommentsInline.jsx
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
	// eslint-disable-next-line no-unused-vars
	Dialog,
	// eslint-disable-next-line no-unused-vars
	DialogTitle,
	// eslint-disable-next-line no-unused-vars
	DialogContent,
	Box,
	Typography,
	Button,
	TextField,
	Avatar,
	useTheme,
	useMediaQuery,
	Select,
	MenuItem,
	Paper,
	List,
	ListItemButton,
	Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CommentThread from "./CommentThread";

import socket from "../utils/socket";
import apiFetch from "../utils/api";

export default function PostCommentsInline({
	localPost,
	setLocalPost,
	currentUser,
	highlightId,
	openLikes,
}) {
	const navigate = useNavigate();
	const theme = useTheme();
	// eslint-disable-next-line no-unused-vars
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

	const [newReplyText, setNewReplyText] = useState("");
	const [loadingItems, setLoadingItems] = useState({});
	const [typingUsers, setTypingUsers] = useState(new Set());
	const [sortBy, setSortBy] = useState("top");
	const [mentionQuery, setMentionQuery] = useState(null);
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

	// Autocomplete suggestion calculation
	const mentionSuggestions = useMemo(() => {
		if (!mentionQuery) {
			return [];
		}

		const q = mentionQuery.query.toLowerCase();
		const candidates = [];
		const seen = new Set();

		if (localPost.authorName && !seen.has(localPost.authorName)) {
			seen.add(localPost.authorName);
			candidates.push({
				id: localPost.authorId,
				name: localPost.authorName,
				profilePic: localPost.authorPic,
				role: localPost.authorRole || "Author",
			});
		}

		localPost.comments?.forEach((c) => {
			if (c.authorName && !seen.has(c.authorName)) {
				seen.add(c.authorName);
				candidates.push({
					id: c.authorId,
					name: c.authorName,
					profilePic: c.authorPic,
					role: c.authorRole || "Member",
				});
			}
		});

		const matched = candidates.filter((c) =>
			c.name.toLowerCase().includes(q),
		);
		return matched.slice(0, 5);
	}, [mentionQuery, localPost]);

	// Sorted comments
	const sortedComments = useMemo(() => {
		const list = [...(localPost.comments || [])].filter((c) => c && (c._id || c.text || c.content));
		if (sortBy === "top") {
			list.sort((a, b) => {
				const scoreA = (a.likedBy?.length || 0) + (a.replies?.length || 0);
				const scoreB = (b.likedBy?.length || 0) + (b.replies?.length || 0);
				return scoreB - scoreA;
			});
		} else if (sortBy === "newest") {
			list.sort(
				(a, b) =>
					new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
			);
		} else if (sortBy === "oldest") {
			list.sort(
				(a, b) =>
					new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
			);
		}
		return list;
	}, [localPost.comments, sortBy]);

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
									role="link"
									tabIndex={0}
									aria-label={`View ${name}'s profile`}
									onClick={(e) => {
										e.stopPropagation();
										navigate(`/profile/${id}`);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											e.stopPropagation();
											navigate(`/profile/${id}`);
										}
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
			const res = await apiFetch(endpoint, {
				method,
				body: JSON.stringify(bodyData),
			});
			if (res.ok && !skipStateUpdate) {
				const data = await res.json();
				setLocalPost(data);
			}
			return res;
		} catch (err) {
			console.error("API error in comments:", err);
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
		setMentionQuery(null);
		socket.emit("commentStopTyping", { postId: localPost._id, userName: currentUser.name });
	};

	const handleTyping = (e) => {
		const val = e.target.value;
		setNewReplyText(val);

		// Cursor mention detection
		const cursor = e.target.selectionStart ?? val.length;
		const textBeforeCursor = val.slice(0, cursor);
		const lastAt = textBeforeCursor.lastIndexOf("@");
		if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBeforeCursor[lastAt - 1]))) {
			const query = textBeforeCursor.slice(lastAt + 1);
			if (!query.includes(" ")) {
				setMentionQuery({ query, startIdx: lastAt });
			} else {
				setMentionQuery(null);
			}
		} else {
			setMentionQuery(null);
		}

		if (currentUser) {
			socket.emit("commentTyping", { postId: localPost._id, userName: currentUser.name });
			clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = setTimeout(() => {
				socket.emit("commentStopTyping", { postId: localPost._id, userName: currentUser.name });
			}, 2000);
		}
	};

	const handleSelectMention = (suggestedUser) => {
		if (!mentionQuery) return;
		const before = newReplyText.slice(0, mentionQuery.startIdx);
		const after = newReplyText.slice(mentionQuery.startIdx + 1 + mentionQuery.query.length);
		setNewReplyText(`${before}@${suggestedUser.name} ${after}`);
		setMentionQuery(null);
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
			{/* COMMENT SORT & HEADER STRIP */}
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 1,
					px: { xs: 1, sm: 2 },
				}}
			>
				<Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
					{sortedComments.length}{" "}
					{sortedComments.length === 1 ? "Comment" : "Comments"}
				</Typography>
				{sortedComments.length > 1 && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<Typography variant="caption" color="text.secondary">
							Sort by:
						</Typography>
						<Select
							size="small"
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							data-testid="comment-sort-select"
							sx={{
								fontSize: "0.8rem",
								height: 28,
								"& .MuiSelect-select": { py: 0.5, px: 1 },
							}}
						>
							<MenuItem value="top">Top</MenuItem>
							<MenuItem value="newest">Newest</MenuItem>
							<MenuItem value="oldest">Oldest</MenuItem>
						</Select>
					</Box>
				)}
			</Box>

			<Box sx={{ p: { xs: 1, sm: 2 } }}>
				{!sortedComments.length ? (
					<Box sx={{ textAlign: "center", py: 3, px: 2 }}>
						<Box sx={{ 
							width: 44, 
							height: 44, 
							borderRadius: "50%", 
							bgcolor: "action.hover", 
							display: "inline-flex", 
							alignItems: "center", 
							justifyContent: "center", 
							mb: 1,
							color: "text.secondary" 
						}}>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
						</Box>
						<Typography variant="body2" fontWeight="600" color="text.secondary">
							No comments yet
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Be the first to share your thoughts or rally!
						</Typography>
					</Box>
				) : (
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: 2,
						}}
					>
						{sortedComments.map((comment) => (
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
								renderContentWithTags={renderContentWithTags}
								clickableStyle={clickableStyle}
							/>
						))}
					</Box>
				)}
			</Box>

			{/* TYPING INDICATOR */}
			{typingUsers.size > 0 && (
				<Typography
					variant="caption"
					color="text.primary"
					data-testid="live-typing-indicator"
					sx={{ ml: 6, fontStyle: "italic", mb: 0.5, display: "block" }}
				>
					{Array.from(typingUsers).join(", ")}{" "}
					{typingUsers.size === 1 ? "is" : "are"} typing...
				</Typography>
			)}

			{/* MAIN POST COMMENT INPUT WITH AUTOCOMPLETE */}
			<Box
				sx={{
					position: "relative",
					p: 1.5,
					backgroundColor: "background.paper",
					borderTop: "1px solid",
					borderColor: "divider",
					display: "flex",
					gap: 1,
					alignItems: "flex-end",
				}}
			>
				{/* MENTION AUTOCOMPLETE POPOVER */}
				{mentionSuggestions.length > 0 && (
					<Paper
						elevation={6}
						data-testid="mention-autocomplete-menu"
						sx={{
							position: "absolute",
							bottom: "100%",
							left: 48,
							right: 16,
							mb: 1,
							maxHeight: 180,
							overflowY: "auto",
							borderRadius: 2,
							zIndex: 10,
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<List disablePadding>
							{mentionSuggestions.map((user) => (
								<ListItemButton
									key={user.id || user.name}
									onClick={() => handleSelectMention(user)}
									sx={{
										py: 1,
										px: 2,
										display: "flex",
										justifyContent: "space-between",
									}}
								>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Avatar
											src={user.profilePic}
											sx={{ width: 24, height: 24, fontSize: 12 }}
										>
											{user.name.charAt(0)}
										</Avatar>
										<Typography variant="body2" fontWeight="bold">
											@{user.name}
										</Typography>
									</Box>
									{user.role && (
										<Chip
											label={user.role}
											size="small"
											sx={{ height: 18, fontSize: "0.65rem" }}
										/>
									)}
								</ListItemButton>
							))}
						</List>
					</Paper>
				)}

				<Avatar
					src={currentUser?.profilePic}
					sx={{
						width: 32,
						height: 32,
						bgcolor: "primary.main",
						mb: 0.5,
					}}
					alt="User Avatar"
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
					aria-label="Write a comment"
					slotProps={{ htmlInput: { "aria-label": "Write a comment" } }}
					placeholder={
						currentUser ? "Write a comment... (type @ to mention)" : "Login to comment"
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
							borderRadius: 5,
							backgroundColor: "action.hover",
							py: 0.8,
							px: 1.5,
							"& fieldset": { borderColor: "divider" },
							"&:hover fieldset": { borderColor: "primary.main" },
							"&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 1.5 }
						},
						"& textarea": {
							border: "none !important",
							outline: "none !important",
							boxShadow: "none !important",
							resize: "none"
						}
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
						height: 36,
						minWidth: "64px",
						mb: 0.5,
						boxShadow: "none",
						transition: "all 0.15s ease",
						"&:active": { transform: "scale(0.95)" },
					}}
				>
					Post
				</Button>
			</Box>
		</Box>
	);
}
