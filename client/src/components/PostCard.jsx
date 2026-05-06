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
			setIsCommentModalOpen(true);
			setTimeout(() => {
				document
					.getElementById(`post-${localPost._id}`)
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 300);
		}
	}, [urlPostId, localPost._id]);

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
		if (!currentUser) return alert("You must be logged in!");
		if (isLiking) return; // Anti-spam lock

		setIsLiking(true);
		const originallyLiked = localPost.likedBy?.includes(currentUser.id);

		// OPTIMISTIC UI: Instant visual feedback! No delay!
		setLocalPost((prev) => {
			const updated = { ...prev };
			if (originallyLiked) {
				updated.likedBy = updated.likedBy.filter(
					(id) => id !== currentUser.id,
				);
				updated.likedByDetails =
					updated.likedByDetails?.filter(
						(u) => u.id !== currentUser.id,
					) || [];
			} else {
				updated.likedBy = [...(updated.likedBy || []), currentUser.id];
				updated.likedByDetails = [
					...(updated.likedByDetails || []),
					{
						id: currentUser.id,
						name: currentUser.name,
						profilePic: currentUser.profilePic,
					},
				];
			}
			return updated;
		});

		try {
			// Sync with the backend silently
			await fetch(
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
		} catch (err) {
			console.error(err);
			setLocalPost(post); // Revert back if the server fails
		} finally {
			setIsLiking(false); // Unlock
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
					@keyframes highlightFlash {
						0% { background-color: rgba(0, 204, 102, 0.4); transform: scale(1.02); }
						100% { background-color: transparent; transform: scale(1); }
					}
					.highlight-active { animation: highlightFlash 3s ease-out; border-radius: 8px; }
				`}
			</style>

			<Paper
				id={`post-${localPost._id}`}
				elevation={0}
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
							justifyContent: "space-between",
							alignItems: "center",
							px: 1,
							mb: 1,
						}}
					>
						<Box>
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
						</Box>
						<Box>
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
											fontSize: "0.7rem",
										}}
									>
										👍
									</Avatar>
								</Box>
							)}
						</Box>
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
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							👍
						</Typography>
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
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							💬
						</Typography>
						<Box
							sx={{ display: { xs: "none", sm: "inline-block" } }}
						>
							Comment
						</Box>
						{totalCommentsCount > 0 && (
							<Typography
								component="span"
								sx={{ ml: 0.5, fontWeight: "bold" }}
							>
								({totalCommentsCount})
							</Typography>
						)}
					</Button>
					<Button
						onClick={() => {
							navigator.clipboard.writeText(
								`${window.location.origin}/forum?postId=${localPost._id}`,
							);
							alert("Link Copied!");
						}}
						color="inherit"
						sx={actionBtnStyle}
					>
						<Typography
							sx={{ mr: { xs: 0.5, sm: 1 }, fontSize: "1.2rem" }}
						>
							➦
						</Typography>
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
