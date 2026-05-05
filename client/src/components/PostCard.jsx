// client/src/components/PostCard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	Typography,
	Button,
	Box,
	Paper,
	Divider,
	Dialog,
	DialogTitle,
	DialogContent,
	TextField,
	CardActions,
	Avatar,
	useTheme,
	useMediaQuery,
} from "@mui/material";

export default function PostCard({ post }) {
	const navigate = useNavigate();

	// NEW: Mobile Sensors
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
	const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // Extra check for very small screens

	const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
	const [newReplyText, setNewReplyText] = useState("");
	const [localPost, setLocalPost] = useState(post);

	const [replyingToId, setReplyingToId] = useState(null);
	const [nestedReplyText, setNestedReplyText] = useState("");
	const [expandedReplies, setExpandedReplies] = useState({});

	const currentUser = JSON.parse(localStorage.getItem("user"));

	const totalCommentsCount =
		localPost.comments?.reduce((acc, comment) => {
			return acc + 1 + (comment.replies?.length || 0);
		}, 0) || 0;

	useEffect(() => {
		setLocalPost(post);
	}, [post]);

	const renderContentWithTags = (content, fontSize = "0.875rem") => {
		if (!content) return null;

		const userMap = new Map();
		if (localPost.authorName)
			userMap.set(localPost.authorName, localPost.authorId);
		localPost.comments?.forEach((c) => {
			userMap.set(c.authorName, c.authorId);
			c.replies?.forEach((r) => {
				userMap.set(r.authorName, r.authorId);
			});
		});

		if (userMap.size === 0)
			return (
				<Typography variant="body2" sx={{ fontSize, mt: 0.5 }}>
					{content}
				</Typography>
			);

		const names = Array.from(userMap.keys())
			.sort((a, b) => b.length - a.length)
			.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

		const regex = new RegExp(`(@(?:${names.join("|")}))`, "g");
		const parts = content.split(regex);

		return (
			<Typography
				variant="body2"
				sx={{ fontSize, mt: 0.5, whiteSpace: "pre-wrap" }}
			>
				{parts.map((part, i) => {
					if (part.startsWith("@")) {
						const name = part.substring(1);
						const id = userMap.get(name);
						if (id) {
							return (
								<Box
									component="span"
									key={i}
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
					}
					return <span key={i}>{part}</span>;
				})}
			</Typography>
		);
	};

	const handlePostMainComment = async () => {
		if (!newReplyText.trim() || !currentUser) return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/comments`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify({
						authorId: currentUser.id,
						authorName: currentUser.name,
						content: newReplyText,
					}),
				},
			);
			const updatedPost = await res.json();

			if (res.ok) {
				setLocalPost(updatedPost);
				setNewReplyText("");
			} else {
				alert("Error: " + updatedPost.message);
			}
		} catch (err) {
			console.error("Failed to post comment", err);
		}
	};

	const handleLikeComment = async (commentId) => {
		if (!currentUser) return alert("You must be logged in!");
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/comments/${commentId}/like`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: currentUser.id }),
				},
			);
			const updatedPost = await res.json();
			if (res.ok) setLocalPost(updatedPost);
			else alert("Error: " + updatedPost.message);
		} catch (err) {
			console.error("Failed to toggle comment like", err);
		}
	};

	const handleLikeReply = async (commentId, replyId) => {
		if (!currentUser) return alert("You must be logged in!");
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/comments/${commentId}/replies/${replyId}/like`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: currentUser.id }),
				},
			);
			const updatedPost = await res.json();
			if (res.ok) setLocalPost(updatedPost);
			else alert("Error: " + updatedPost.message);
		} catch (err) {
			console.error("Failed to toggle reply like", err);
		}
	};

	const handleSubmitNestedReply = async (commentId) => {
		if (!nestedReplyText.trim() || !currentUser) return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/comments/${commentId}/replies`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						authorId: currentUser.id,
						authorName: currentUser.name,
						content: nestedReplyText,
					}),
				},
			);
			const updatedPost = await res.json();

			if (res.ok) {
				setLocalPost(updatedPost);
				setNestedReplyText("");
				setReplyingToId(null);
				setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
			} else {
				alert("Error: " + updatedPost.message);
			}
		} catch (err) {
			console.error("Failed to post reply", err);
		}
	};

	const handleLike = async () => {
		if (!currentUser) return alert("You must be logged in to like posts!");
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/like`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: currentUser.id }),
				},
			);
			const updatedPost = await res.json();
			if (res.ok) setLocalPost(updatedPost);
		} catch (err) {
			console.error(err);
		}
	};

	const formatTime = (dateString) => {
		if (!dateString) return "Just now";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	const hasLiked = localPost.likedBy?.includes(currentUser?.id);
	const clickableStyle = {
		cursor: "pointer",
		"&:hover": { textDecoration: "underline", opacity: 0.8 },
	};

	return (
		<>
			<Paper
				elevation={0}
				sx={{
					p: { xs: 2, sm: 3 }, // Smaller padding on mobile main card
					border: "1px solid #e0e0e0",
					borderRadius: 3,
					transition: "all 0.2s",
					"&:hover": {
						borderColor: "primary.main",
						boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
					},
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						mb: 2,
					}}
				>
					<Avatar
						onClick={() =>
							navigate(`/profile/${localPost.authorId}`)
						}
						sx={{
							bgcolor: "secondary.main",
							color: "primary.main",
							fontWeight: "bold",
							...clickableStyle,
						}}
					>
						{localPost.authorName
							? localPost.authorName.charAt(0).toUpperCase()
							: "?"}
					</Avatar>
					<Box>
						<Typography
							variant="h6"
							fontWeight="bold"
							color="primary"
							sx={{ lineHeight: 1.2 }}
						>
							{localPost.title}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							<strong
								onClick={() =>
									navigate(`/profile/${localPost.authorId}`)
								}
								style={{ cursor: "pointer" }}
							>
								{localPost.authorName || "Unknown"}
							</strong>{" "}
							• {formatTime(localPost.timestamp)}
						</Typography>
					</Box>
				</Box>

				<Typography variant="body1" color="text.primary" sx={{ mb: 3 }}>
					{localPost.content}
				</Typography>
				<Divider sx={{ mb: 1 }} />

				{/* NEW: Hide the text labels on very small screens, show icons only to save space */}
				<CardActions
					sx={{
						p: 0,
						justifyContent: "space-between",
						color: "text.secondary",
					}}
				>
					<Button
						onClick={handleLike}
						color={hasLiked ? "primary" : "inherit"}
						sx={{
							textTransform: "none",
							fontWeight: 600,
							flex: 1,
							minWidth: 0,
						}}
					>
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							👍
						</Typography>
						{!isMobile && "Like "}{" "}
						{localPost.likedBy?.length > 0 &&
							`(${localPost.likedBy.length})`}
					</Button>
					<Button
						onClick={() => setIsCommentModalOpen(true)}
						color="inherit"
						sx={{
							textTransform: "none",
							fontWeight: 600,
							flex: 1,
							minWidth: 0,
						}}
					>
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							💬
						</Typography>
						{!isMobile && "Comment "}{" "}
						{totalCommentsCount > 0 && `(${totalCommentsCount})`}
					</Button>
					<Button
						onClick={() => {
							navigator.clipboard.writeText(
								`${window.location.origin}/forum`,
							);
							alert("Copied!");
						}}
						color="inherit"
						sx={{
							textTransform: "none",
							fontWeight: 600,
							flex: 1,
							minWidth: 0,
						}}
					>
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							➦
						</Typography>
						{!isMobile && "Share"}
					</Button>
				</CardActions>
			</Paper>

			<Dialog
				open={isCommentModalOpen}
				onClose={() => setIsCommentModalOpen(false)}
				fullWidth
				maxWidth="sm"
				fullScreen={fullScreen} // NEW: Makes it full screen on mobile!
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
						onClick={() => setIsCommentModalOpen(false)}
						color="inherit"
						sx={{ minWidth: 0, p: 1, borderRadius: 5 }}
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
						<Typography variant="body1">
							{localPost.content}
						</Typography>
					</Box>
					<Box sx={{ p: { xs: 1, sm: 2 } }}>
						{!localPost.comments ||
						localPost.comments.length === 0 ? (
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
								{localPost.comments.map((comment) => (
									<Box
										key={comment._id}
										sx={{
											display: "flex",
											flexDirection: "column",
										}}
									>
										<Box sx={{ display: "flex", gap: 1 }}>
											<Avatar
												onClick={() =>
													navigate(
														`/profile/${comment.authorId}`,
													)
												}
												sx={{
													width: 32,
													height: 32,
													fontSize: "0.9rem",
													...clickableStyle,
												}}
											>
												{comment.authorName.charAt(0)}
											</Avatar>
											<Box sx={{ flexGrow: 1 }}>
												<Box
													sx={{
														backgroundColor:
															"#e4e6eb",
														p: 1.5,
														borderRadius: 3,
														maxWidth: "100%",
														display: "inline-block",
													}}
												>
													<Typography
														onClick={() =>
															navigate(
																`/profile/${comment.authorId}`,
															)
														}
														variant="subtitle2"
														fontWeight="bold"
														sx={{
															lineHeight: 1,
															...clickableStyle,
														}}
													>
														{comment.authorName}
													</Typography>
													{renderContentWithTags(
														comment.content,
														"0.875rem",
													)}
												</Box>
												<Box
													sx={{
														display: "flex",
														gap: 2,
														ml: 1,
														mt: 0.5,
													}}
												>
													<Typography
														variant="caption"
														onClick={() =>
															handleLikeComment(
																comment._id,
															)
														}
														sx={{
															cursor: "pointer",
															fontWeight: "bold",
															color: comment.likedBy?.includes(
																currentUser?.id,
															)
																? "primary.main"
																: "text.secondary",
															"&:hover": {
																textDecoration:
																	"underline",
															},
														}}
													>
														Like{" "}
														{comment.likedBy
															?.length > 0 &&
															`(${comment.likedBy.length})`}
													</Typography>
													<Typography
														variant="caption"
														onClick={() => {
															setReplyingToId(
																comment._id,
															);
															setNestedReplyText(
																`@${comment.authorName} `,
															);
														}}
														sx={{
															cursor: "pointer",
															fontWeight: "bold",
															color: "text.secondary",
															"&:hover": {
																textDecoration:
																	"underline",
															},
														}}
													>
														Reply
													</Typography>
													<Typography
														variant="caption"
														color="text.disabled"
													>
														{formatTime(
															comment.timestamp,
														)}
													</Typography>
												</Box>
											</Box>
										</Box>

										{comment.replies &&
											comment.replies.length > 0 && (
												<Box sx={{ ml: 5, mt: 0.5 }}>
													<Typography
														variant="caption"
														onClick={() =>
															setExpandedReplies(
																(prev) => ({
																	...prev,
																	[comment._id]:
																		!prev[
																			comment
																				._id
																		],
																}),
															)
														}
														sx={{
															cursor: "pointer",
															fontWeight: "bold",
															color: "text.secondary",
															"&:hover": {
																textDecoration:
																	"underline",
															},
														}}
													>
														{expandedReplies[
															comment._id
														]
															? "Hide replies"
															: `↪ View ${comment.replies.length} repl${comment.replies.length === 1 ? "y" : "ies"}`}
													</Typography>
												</Box>
											)}

										{expandedReplies[comment._id] &&
											comment.replies &&
											comment.replies.map((reply) => (
												<Box
													key={reply._id}
													sx={{
														display: "flex",
														flexDirection: "column",
														mt: 1,
														ml: { xs: 4, sm: 6 },
														borderLeft:
															"2px solid #ccc",
														pl: 1.5,
													}}
												>
													<Box
														sx={{
															display: "flex",
															gap: 1,
														}}
													>
														<Avatar
															onClick={() =>
																navigate(
																	`/profile/${reply.authorId}`,
																)
															}
															sx={{
																width: 24,
																height: 24,
																fontSize:
																	"0.7rem",
																...clickableStyle,
															}}
														>
															{reply.authorName.charAt(
																0,
															)}
														</Avatar>
														<Box>
															<Box
																sx={{
																	backgroundColor:
																		"#e4e6eb",
																	p: 1,
																	borderRadius: 3,
																	display:
																		"inline-block",
																}}
															>
																<Typography
																	onClick={() =>
																		navigate(
																			`/profile/${reply.authorId}`,
																		)
																	}
																	variant="subtitle2"
																	fontWeight="bold"
																	sx={{
																		lineHeight: 1,
																		fontSize:
																			"0.8rem",
																		...clickableStyle,
																	}}
																>
																	{
																		reply.authorName
																	}
																</Typography>
																{renderContentWithTags(
																	reply.content,
																	"0.85rem",
																)}
															</Box>
															<Box
																sx={{
																	display:
																		"flex",
																	gap: 2,
																	ml: 1,
																	mt: 0.5,
																}}
															>
																<Typography
																	variant="caption"
																	onClick={() =>
																		handleLikeReply(
																			comment._id,
																			reply._id,
																		)
																	}
																	sx={{
																		cursor: "pointer",
																		fontWeight:
																			"bold",
																		color: reply.likedBy?.includes(
																			currentUser?.id,
																		)
																			? "primary.main"
																			: "text.secondary",
																		"&:hover":
																			{
																				textDecoration:
																					"underline",
																			},
																	}}
																>
																	Like{" "}
																	{reply
																		.likedBy
																		?.length >
																		0 &&
																		`(${reply.likedBy.length})`}
																</Typography>
																<Typography
																	variant="caption"
																	onClick={() => {
																		setReplyingToId(
																			comment._id,
																		);
																		setNestedReplyText(
																			`@${reply.authorName} `,
																		);
																	}}
																	sx={{
																		cursor: "pointer",
																		fontWeight:
																			"bold",
																		color: "text.secondary",
																		"&:hover":
																			{
																				textDecoration:
																					"underline",
																			},
																	}}
																>
																	Reply
																</Typography>
															</Box>
														</Box>
													</Box>
												</Box>
											))}

										{replyingToId === comment._id && (
											<Box
												sx={{
													display: "flex",
													gap: 1,
													alignItems: "center",
													mt: 1,
													ml: { xs: 4, sm: 6 },
												}}
											>
												<TextField
													fullWidth
													size="small"
													placeholder={`Reply to ${comment.authorName}...`}
													variant="outlined"
													value={nestedReplyText}
													onChange={(e) =>
														setNestedReplyText(
															e.target.value,
														)
													}
													onKeyDown={(e) =>
														e.key === "Enter" &&
														handleSubmitNestedReply(
															comment._id,
														)
													}
													sx={{
														"& .MuiOutlinedInput-root":
															{
																borderRadius: 5,
																backgroundColor:
																	"white",
																height: "32px",
															},
													}}
												/>
												<Button
													size="small"
													variant="contained"
													onClick={() =>
														handleSubmitNestedReply(
															comment._id,
														)
													}
													disabled={
														!nestedReplyText.trim()
													}
													sx={{
														borderRadius: 5,
														minWidth: "50px",
													}}
												>
													Post
												</Button>
											</Box>
										)}
									</Box>
								))}
							</Box>
						)}
					</Box>
				</DialogContent>
				<Box
					sx={{
						p: 1.5,
						backgroundColor: "white",
						borderTop: "1px solid #e0e0e0",
						display: "flex",
						gap: 1,
						alignItems: "center",
					}}
				>
					<TextField
						fullWidth
						size="small"
						placeholder={
							currentUser
								? "Write a comment..."
								: "Login to comment"
						}
						variant="outlined"
						value={newReplyText}
						onChange={(e) => setNewReplyText(e.target.value)}
						onKeyDown={(e) =>
							e.key === "Enter" && handlePostMainComment()
						}
						disabled={!currentUser}
						sx={{
							"& .MuiOutlinedInput-root": {
								borderRadius: 5,
								backgroundColor: "#f0f2f5",
							},
						}}
					/>
					<Button
						variant="contained"
						color="primary"
						onClick={handlePostMainComment}
						disabled={!newReplyText.trim() || !currentUser}
						sx={{
							borderRadius: 5,
							fontWeight: "bold",
							textTransform: "none",
						}}
					>
						Post
					</Button>
				</Box>
			</Dialog>
		</>
	);
}
