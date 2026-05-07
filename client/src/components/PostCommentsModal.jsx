// client/src/components/PostCommentsModal.jsx
import { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	Box,
	Typography,
	Button,
	TextField,
	Avatar,
	useTheme,
	useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CommentThread from "./CommentThread"; // FIX: Import the new separated component!

export default function PostCommentsModal({
	open,
	onClose,
	localPost,
	setLocalPost,
	currentUser,
	highlightId,
	openLikes,
}) {
	const navigate = useNavigate();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

	const [newReplyText, setNewReplyText] = useState("");
	const [loadingItems, setLoadingItems] = useState({});

	const clickableStyle = {
		cursor: "pointer",
		"&:hover": { textDecoration: "underline", opacity: 0.8 },
		"&:active": { transform: "scale(0.95)" },
	};

	useEffect(() => {
		if (open && highlightId) {
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
	}, [open, highlightId]);

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
			content: newReplyText,
		});
		setNewReplyText("");
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
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="sm"
			fullScreen={fullScreen}
			PaperProps={{
				sx: {
					borderRadius: fullScreen ? 0 : 3,
					maxHeight: fullScreen ? "100vh" : "80vh",
				},
			}}
		>
			<DialogTitle
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1.5,
					pb: 1,
					borderBottom: "1px solid #eee",
				}}
			>
				<Typography
					component="div"
					variant="h6"
					fontWeight="bold"
					sx={{ flexGrow: 1 }}
				>
					{localPost.authorName}'s Post
				</Typography>
				<Button
					onClick={onClose}
					color="inherit"
					sx={{
						minWidth: 0,
						p: 1,
						borderRadius: 5,
						transition: "all 0.2s",
						"&:active": { transform: "scale(0.9)" },
					}}
				>
					✕
				</Button>
			</DialogTitle>

			<DialogContent sx={{ p: 0, backgroundColor: "#f4f6f8" }}>
				<Box
					sx={{
						p: { xs: 2, sm: 3 },
						backgroundColor: "white",
						mb: 1,
					}}
				>
					<Typography variant="body1">{localPost.content}</Typography>
				</Box>

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
			</DialogContent>

			{/* MAIN POST COMMENT INPUT */}
			<Box
				sx={{
					p: 1.5,
					backgroundColor: "white",
					borderTop: "1px solid #e0e0e0",
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
					{!currentUser?.profilePic && currentUser
						? currentUser.name.charAt(0).toUpperCase()
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
					onChange={(e) => setNewReplyText(e.target.value)}
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
							backgroundColor: "#f0f2f5",
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
		</Dialog>
	);
}
