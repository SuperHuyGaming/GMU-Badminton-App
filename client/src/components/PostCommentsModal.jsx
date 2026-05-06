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
	const [replyingToId, setReplyingToId] = useState(null);
	const [nestedReplyText, setNestedReplyText] = useState("");
	const [expandedReplies, setExpandedReplies] = useState({});
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
					sx={{ fontSize: "0.875rem", mt: 0.5 }}
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
				sx={{ fontSize: "0.875rem", mt: 0.5, whiteSpace: "pre-wrap" }}
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

	// OPTIMISTIC UI: Instant Comment Likes!
	const handleToggleLike = async (
		endpoint,
		itemId,
		type,
		parentCommentId = null,
	) => {
		if (!currentUser) return alert("You must be logged in!");
		if (loadingItems[itemId]) return;

		setLoadingItems((prev) => ({ ...prev, [itemId]: true }));

		// Instantly update the UI before the server even knows
		setLocalPost((prev) => {
			const updated = JSON.parse(JSON.stringify(prev));
			let target =
				type === "comment"
					? updated.comments.find((c) => c._id === itemId)
					: updated.comments
							.find((c) => c._id === parentCommentId)
							?.replies.find((r) => r._id === itemId);

			if (target) {
				const hasLiked = target.likedBy?.includes(currentUser.id);
				if (hasLiked) {
					target.likedBy = target.likedBy.filter(
						(id) => id !== currentUser.id,
					);
					target.likedByDetails =
						target.likedByDetails?.filter(
							(u) => u.id !== currentUser.id,
						) || [];
				} else {
					target.likedBy = [
						...(target.likedBy || []),
						currentUser.id,
					];
					target.likedByDetails = [
						...(target.likedByDetails || []),
						{
							id: currentUser.id,
							name: currentUser.name,
							profilePic: currentUser.profilePic,
						},
					];
				}
			}
			return updated;
		});

		try {
			// Sync with server in background, skip overriding the state
			await apiCall(
				endpoint,
				"PUT",
				{ userId: currentUser.id, userName: currentUser.name },
				true,
			);
		} finally {
			setLoadingItems((prev) => ({ ...prev, [itemId]: false }));
		}
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

	const handleSubmitNestedReply = (commentId) => {
		if (!nestedReplyText.trim() || !currentUser) return;
		apiCall(
			`/api/forum/${localPost._id}/comments/${commentId}/replies`,
			"POST",
			{
				authorId: currentUser.id,
				authorName: currentUser.name,
				content: nestedReplyText,
			},
		);
		setNestedReplyText("");
		setReplyingToId(null);
		setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
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
							{localPost.comments.map((comment) => (
								<Box
									key={comment._id}
									id={`comment-${comment._id}`}
									className={
										highlightId === comment._id
											? "highlight-active"
											: ""
									}
									sx={{
										display: "flex",
										flexDirection: "column",
										p: 0.5,
									}}
								>
									<Box sx={{ display: "flex", gap: 1 }}>
										<Avatar
											src={comment.authorPic}
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
											{!comment.authorPic &&
												comment.authorName.charAt(0)}
										</Avatar>
										<Box sx={{ flexGrow: 1 }}>
											<Box
												sx={{
													position: "relative",
													backgroundColor: "#e4e6eb",
													p: 1.5,
													borderRadius: 3,
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
												)}

												{comment.likedBy?.length >
													0 && (
													<Box
														onClick={(e) =>
															openLikes(
																e,
																"Comment Likes",
																comment.likedByDetails,
															)
														}
														sx={{
															position:
																"absolute",
															bottom: -8,
															right: -8,
															bgcolor: "white",
															borderRadius: 10,
															px: 0.6,
															py: 0.2,
															display: "flex",
															alignItems:
																"center",
															gap: 0.5,
															boxShadow:
																"0 1px 4px rgba(0,0,0,0.15)",
															cursor: "pointer",
															"&:active": {
																transform:
																	"scale(0.95)",
															},
														}}
													>
														<Avatar
															sx={{
																width: 14,
																height: 14,
																bgcolor:
																	"primary.main",
																fontSize:
																	"0.5rem",
															}}
														>
															👍
														</Avatar>
														<Typography
															variant="caption"
															sx={{
																fontSize:
																	"0.7rem",
																color: "text.secondary",
																fontWeight:
																	"bold",
															}}
														>
															{
																comment.likedBy
																	.length
															}
														</Typography>
													</Box>
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
														handleToggleLike(
															`/api/forum/${localPost._id}/comments/${comment._id}/like`,
															comment._id,
															"comment",
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
														"&:active": {
															transform:
																"scale(0.9)",
														},
													}}
												>
													Like
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
														"&:active": {
															transform:
																"scale(0.9)",
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

									{comment.replies?.length > 0 && (
										<Typography
											variant="caption"
											onClick={() =>
												setExpandedReplies((prev) => ({
													...prev,
													[comment._id]:
														!prev[comment._id],
												}))
											}
											sx={{
												ml: 5,
												mt: 0.5,
												cursor: "pointer",
												fontWeight: "bold",
												color: "text.secondary",
											}}
										>
											{expandedReplies[comment._id] ||
											highlightId
												? "Hide replies"
												: `↪ View ${comment.replies.length} replies`}
										</Typography>
									)}

									{(expandedReplies[comment._id] ||
										highlightId) &&
										comment.replies?.map((reply) => (
											<Box
												key={reply._id}
												id={`comment-${reply._id}`}
												className={
													highlightId === reply._id
														? "highlight-active"
														: ""
												}
												sx={{
													display: "flex",
													mt: 1,
													ml: { xs: 4, sm: 6 },
													borderLeft:
														"2px solid #ccc",
													pl: 1.5,
													p: 0.5,
												}}
											>
												<Avatar
													src={reply.authorPic}
													onClick={() =>
														navigate(
															`/profile/${reply.authorId}`,
														)
													}
													sx={{
														width: 24,
														height: 24,
														fontSize: "0.7rem",
														mr: 1,
														...clickableStyle,
													}}
												>
													{!reply.authorPic &&
														reply.authorName.charAt(
															0,
														)}
												</Avatar>
												<Box>
													<Box
														sx={{
															position:
																"relative",
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
																fontSize:
																	"0.8rem",
																...clickableStyle,
															}}
														>
															{reply.authorName}
														</Typography>
														{renderContentWithTags(
															reply.content,
														)}

														{reply.likedBy?.length >
															0 && (
															<Box
																onClick={(e) =>
																	openLikes(
																		e,
																		"Reply Likes",
																		reply.likedByDetails,
																	)
																}
																sx={{
																	position:
																		"absolute",
																	bottom: -8,
																	right: -8,
																	bgcolor:
																		"white",
																	borderRadius: 10,
																	px: 0.6,
																	py: 0.2,
																	display:
																		"flex",
																	alignItems:
																		"center",
																	gap: 0.5,
																	boxShadow:
																		"0 1px 4px rgba(0,0,0,0.15)",
																	cursor: "pointer",
																	"&:active":
																		{
																			transform:
																				"scale(0.95)",
																		},
																}}
															>
																<Avatar
																	sx={{
																		width: 14,
																		height: 14,
																		bgcolor:
																			"primary.main",
																		fontSize:
																			"0.5rem",
																	}}
																>
																	👍
																</Avatar>
																<Typography
																	variant="caption"
																	sx={{
																		fontSize:
																			"0.7rem",
																		color: "text.secondary",
																		fontWeight:
																			"bold",
																	}}
																>
																	{
																		reply
																			.likedBy
																			.length
																	}
																</Typography>
															</Box>
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
																handleToggleLike(
																	`/api/forum/${localPost._id}/comments/${comment._id}/replies/${reply._id}/like`,
																	reply._id,
																	"reply",
																	comment._id,
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
																"&:active": {
																	transform:
																		"scale(0.9)",
																},
															}}
														>
															Like
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
																"&:active": {
																	transform:
																		"scale(0.9)",
																},
															}}
														>
															Reply
														</Typography>
													</Box>
												</Box>
											</Box>
										))}

									{replyingToId === comment._id && (
										<Box
											sx={{
												display: "flex",
												gap: 1,
												mt: 1,
												ml: { xs: 4, sm: 6 },
											}}
										>
											<TextField
												fullWidth
												size="small"
												placeholder={`Reply to ${comment.authorName}...`}
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
															bgcolor: "white",
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
													"&:active": {
														transform:
															"scale(0.95)",
													},
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
				<Avatar
					src={currentUser?.profilePic}
					sx={{ width: 32, height: 32, bgcolor: "primary.main" }}
				>
					{!currentUser?.profilePic && currentUser
						? currentUser.name.charAt(0).toUpperCase()
						: "?"}
				</Avatar>
				<TextField
					fullWidth
					size="small"
					placeholder={
						currentUser ? "Write a comment..." : "Login to comment"
					}
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
					onClick={handlePostMainComment}
					disabled={!newReplyText.trim() || !currentUser}
					sx={{
						borderRadius: 5,
						fontWeight: "bold",
						textTransform: "none",
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
