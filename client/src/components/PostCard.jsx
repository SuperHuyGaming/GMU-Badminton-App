// client/src/components/PostCard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	Typography,
	Button,
	Box,
	Paper,
	Divider,
	CardActions,
	Avatar,
} from "@mui/material";
import LikesModal from "./LikesModal";
import PostCommentsModal from "./PostCommentsModal";

// --- NEW SLEEK SVG ICONS ---
const ThumbUpOutline = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
	</svg>
);

const ThumbUpFilled = ({ style }) => (
	<svg
		style={style}
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="currentColor"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
	</svg>
);

const MessageCircleIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
	</svg>
);

const ShareIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<circle cx="18" cy="5" r="3"></circle>
		<circle cx="6" cy="12" r="3"></circle>
		<circle cx="18" cy="19" r="3"></circle>
		<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
		<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
	</svg>
);
// -----------------------------

export default function PostCard({ post }) {
	const navigate = useNavigate();
	const currentUser = JSON.parse(localStorage.getItem("user"));

	const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
	const [localPost, setLocalPost] = useState(post);
	const [likesModal, setLikesModal] = useState({
		open: false,
		title: "",
		list: [],
	});

	const [isLiking, setIsLiking] = useState(false);

	const urlParams = new URLSearchParams(window.location.search);
	const highlightId = urlParams.get("highlight");
	const urlPostId = urlParams.get("postId");

	useEffect(() => {
		setLocalPost(post);
	}, [post]);

	useEffect(() => {
		if (urlPostId === localPost._id) {
			// Only auto-open the comments if a specific comment is targeted in the URL
			if (highlightId) {
				setIsCommentModalOpen(true);
			}

			// Always scroll the main post into view!
			setTimeout(() => {
				document
					.getElementById(`post-${localPost._id}`)
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 300);
		}
	}, [urlPostId, highlightId, localPost._id]);

	const totalCommentsCount =
		localPost.comments?.reduce(
			(acc, c) => acc + 1 + (c.replies?.length || 0),
			0,
		) || 0;
	const hasLiked = localPost.likedBy?.includes(currentUser?.id);

	const openLikes = (e, title, list) => {
		e.stopPropagation();
		if (list?.length > 0) setLikesModal({ open: true, title, list });
	};

	const handleLike = async () => {
		// AUTH GUARD: Explicitly stops non-logged in users from interacting!
		if (!currentUser) return alert("You must be logged in to like posts!");
		if (isLiking) return;

		setIsLiking(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}/like`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						userId: currentUser.id,
						userName: currentUser.name,
					}),
				},
			);
			if (res.ok) setLocalPost(await res.json());
		} catch (err) {
			console.error(err);
		} finally {
			setIsLiking(false);
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

	const actionBtnStyle = {
		textTransform: "none",
		fontWeight: 600,
		flex: 1,
		minWidth: 0,
		borderRadius: 2,
		transition: "all 0.1s ease",
		"&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
		"&:active": { transform: "scale(0.95)" },
	};

	return (
		<>
			<style>
				{`
					/* Blinks comments */
					@keyframes highlightFlash {
						0% { background-color: rgba(0, 204, 102, 0.4); transform: scale(1.02); }
						100% { background-color: transparent; transform: scale(1); }
					}
					.highlight-active { animation: highlightFlash 3s ease-out; border-radius: 8px; }

					/* Blinks the entire Post Card when shared */
					@keyframes highlightPostFlash {
						0% { border-color: #006633; box-shadow: 0 0 20px rgba(0, 102, 51, 0.4); transform: scale(1.02); }
						100% { border-color: #e0e0e0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transform: scale(1); }
					}
					.highlight-post-active { animation: highlightPostFlash 3s ease-out; }
				`}
			</style>

			<Paper
				id={`post-${localPost._id}`}
				elevation={0}
				// Adds the blink class if the URL points to this specific post!
				className={
					urlPostId === localPost._id && !highlightId
						? "highlight-post-active"
						: ""
				}
				sx={{
					width: "100%",
					display: "block",
					boxSizing: "border-box",
					p: { xs: 2, sm: 3 },
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
						src={localPost.authorPic}
						onClick={() =>
							navigate(`/profile/${localPost.authorId}`)
						}
						sx={{
							bgcolor: "secondary.main",
							color: "primary.main",
							fontWeight: "bold",
							cursor: "pointer",
							"&:active": { transform: "scale(0.95)" },
						}}
					>
						{!localPost.authorPic &&
							(localPost.authorName
								? localPost.authorName.charAt(0).toUpperCase()
								: "?")}
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

				{(localPost.likedBy?.length > 0 || totalCommentsCount > 0) && (
					<Box
						sx={{
							display: "flex",
							justifyContent: "flex-end", // Aligns to the right
							alignItems: "center",
							gap: 2,
							px: 1,
							mb: 1,
						}}
					>
						{totalCommentsCount > 0 && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{
									cursor: "pointer",
									"&:hover": {
										textDecoration: "underline",
									},
								}}
								onClick={() => setIsCommentModalOpen(true)}
							>
								{totalCommentsCount}{" "}
								{totalCommentsCount === 1
									? "comment"
									: "comments"}
							</Typography>
						)}
						{localPost.likedBy?.length > 0 && (
							<Box
								onClick={(e) =>
									openLikes(
										e,
										"Post Likes",
										localPost.likedByDetails,
									)
								}
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 0.5,
									cursor: "pointer",
									"&:hover": {
										textDecoration: "underline",
									},
								}}
							>
								<Typography
									variant="body2"
									color="text.secondary"
								>
									{localPost.likedBy.length}
								</Typography>
								<Avatar
									sx={{
										width: 20,
										height: 20,
										bgcolor: "primary.main",
										color: "white",
									}}
								>
									<ThumbUpFilled
										style={{ width: 12, height: 12 }}
									/>
								</Avatar>
							</Box>
						)}
					</Box>
				)}

				<Divider sx={{ mb: 1 }} />

				<CardActions
					sx={{
						p: 0,
						justifyContent: "space-between",
						color: "text.secondary",
					}}
				>
					<Button
						onClick={handleLike}
						disabled={isLiking}
						color={hasLiked ? "primary" : "inherit"}
						sx={actionBtnStyle}
					>
						<Box
							sx={{
								mr: { xs: 0.5, sm: 1 },
								display: "flex",
								alignItems: "center",
							}}
						>
							{hasLiked ? <ThumbUpFilled /> : <ThumbUpOutline />}
						</Box>
						<Box
							sx={{ display: { xs: "none", sm: "inline-block" } }}
						>
							Like
						</Box>
					</Button>

					<Button
						onClick={() => setIsCommentModalOpen(true)}
						color="inherit"
						sx={actionBtnStyle}
					>
						<Box
							sx={{
								mr: { xs: 0.5, sm: 1 },
								display: "flex",
								alignItems: "center",
							}}
						>
							<MessageCircleIcon />
						</Box>
						<Box
							sx={{ display: { xs: "none", sm: "inline-block" } }}
						>
							Comment
						</Box>
					</Button>

					<Button
						onClick={() => {
							// window.location.origin dynamically captures localhost or your Render URL correctly!
							navigator.clipboard.writeText(
								`${window.location.origin}/forum?postId=${localPost._id}`,
							);
							alert("Link Copied!");
						}}
						color="inherit"
						sx={actionBtnStyle}
					>
						<Box
							sx={{
								mr: { xs: 0.5, sm: 1 },
								display: "flex",
								alignItems: "center",
							}}
						>
							<ShareIcon />
						</Box>
						<Box
							sx={{ display: { xs: "none", sm: "inline-block" } }}
						>
							Share
						</Box>
					</Button>
				</CardActions>
			</Paper>

			<LikesModal
				open={likesModal.open}
				title={likesModal.title}
				list={likesModal.list}
				onClose={() =>
					setLikesModal({ open: false, title: "", list: [] })
				}
			/>

			<PostCommentsModal
				open={isCommentModalOpen}
				onClose={() => {
					if (highlightId)
						window.history.replaceState(
							null,
							"",
							window.location.pathname,
						);
					setIsCommentModalOpen(false);
				}}
				localPost={localPost}
				setLocalPost={setLocalPost}
				currentUser={currentUser}
				highlightId={highlightId}
				openLikes={openLikes}
			/>
		</>
	);
}
