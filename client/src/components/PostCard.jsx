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
	IconButton,
	Menu,
	MenuItem,
	TextField,
} from "@mui/material";

// Separated Sub-Components
import LikesModal from "./LikesModal";
import PostCommentsModal from "./PostCommentsModal";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import {
	ThumbUpOutline,
	ThumbUpFilled,
	MessageCircleIcon,
	ShareIcon,
	MoreVertIcon,
} from "./Icons";

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

	const [anchorEl, setAnchorEl] = useState(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(post.title);
	const [editContent, setEditContent] = useState(post.content);

	// Toggles the imported dialog component
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const urlParams = new URLSearchParams(window.location.search);
	const highlightId = urlParams.get("highlight");
	const urlPostId = urlParams.get("postId");

	useEffect(() => {
		setLocalPost(post);
		setEditTitle(post.title);
		setEditContent(post.content);
	}, [post]);

	useEffect(() => {
		if (urlPostId === localPost._id) {
			if (highlightId) setIsCommentModalOpen(true);
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

	const handleSaveEdit = async () => {
		if (!editTitle.trim() || !editContent.trim()) return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify({
						userId: currentUser.id,
						title: editTitle,
						content: editContent,
					}),
				},
			);
			const data = await res.json();

			if (!res.ok) return alert(data.message || "Failed to update.");
			if (data.message === "Post submitted for review.")
				alert(
					"Your edit has been sent for admin review due to our spam filters.",
				);
			else setLocalPost(data);

			setIsEditing(false);
		} catch (err) {
			console.error(err);
		}
	};

	const confirmDeletePost = async () => {
		try {
			await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum/${localPost._id}`,
				{
					method: "DELETE",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify({ userId: currentUser.id }),
				},
			);
			setIsCommentModalOpen(false);
		} catch (err) {
			console.error(err);
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
					@keyframes highlightFlash { 0% { background-color: rgba(0, 204, 102, 0.4); transform: scale(1.02); } 100% { background-color: transparent; transform: scale(1); } }
					.highlight-active { animation: highlightFlash 3s ease-out; border-radius: 8px; }
					@keyframes highlightPostFlash { 0% { border-color: #006633; box-shadow: 0 0 20px rgba(0, 102, 51, 0.4); transform: scale(1.02); } 100% { border-color: #e0e0e0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transform: scale(1); } }
					.highlight-post-active { animation: highlightPostFlash 3s ease-out; }
				`}
			</style>

			<Paper
				id={`post-${localPost._id}`}
				elevation={0}
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
				{/* POST HEADER */}
				<Box
					sx={{
						display: "flex",
						alignItems: "flex-start",
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
					<Box sx={{ flexGrow: 1 }}>
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
							{localPost.isEdited && (
								<span
									style={{
										fontStyle: "italic",
										marginLeft: "6px",
										opacity: 0.7,
									}}
								>
									(edited)
								</span>
							)}
						</Typography>
					</Box>

					{/* 3 DOTS MENU */}
					{(currentUser?.id === localPost.authorId ||
						currentUser?.role === "admin") && (
						<Box>
							<IconButton
								onClick={(e) => setAnchorEl(e.currentTarget)}
								size="small"
								sx={{ color: "text.secondary" }}
							>
								<MoreVertIcon />
							</IconButton>
							<Menu
								anchorEl={anchorEl}
								open={Boolean(anchorEl)}
								onClose={() => setAnchorEl(null)}
								slotProps={{
									paper: {
										elevation: 2,
										sx: { borderRadius: 2 },
									},
								}}
							>
								{currentUser?.id === localPost.authorId && (
									<MenuItem
										onClick={() => {
											setIsEditing(true);
											setAnchorEl(null);
										}}
										sx={{
											fontWeight: "bold",
											fontSize: "0.9rem",
										}}
									>
										✎ Edit Post
									</MenuItem>
								)}
								<MenuItem
									onClick={() => {
										setDeleteConfirmOpen(true);
										setAnchorEl(null);
									}}
									sx={{
										color: "error.main",
										fontWeight: "bold",
										fontSize: "0.9rem",
									}}
								>
									🗑 Delete Post
								</MenuItem>
							</Menu>
						</Box>
					)}
				</Box>

				{/* POST CONTENT / EDIT MODE */}
				{isEditing ? (
					<Box
						sx={{
							mb: 3,
							p: 2,
							bgcolor: "#f9fafb",
							borderRadius: 3,
							border: "1px dashed #ccc",
						}}
					>
						<TextField
							fullWidth
							size="small"
							label="Edit Title"
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							sx={{ mb: 2, bgcolor: "white" }}
						/>
						<TextField
							fullWidth
							multiline
							minRows={3}
							label="Edit Details"
							value={editContent}
							onChange={(e) => setEditContent(e.target.value)}
							sx={{ mb: 2, bgcolor: "white" }}
						/>
						<Box sx={{ display: "flex", gap: 1 }}>
							<Button
								variant="contained"
								color="primary"
								onClick={handleSaveEdit}
								sx={{
									fontWeight: "bold",
									borderRadius: 2,
									textTransform: "none",
								}}
							>
								Save Changes
							</Button>
							<Button
								variant="outlined"
								color="inherit"
								onClick={() => {
									setIsEditing(false);
									setEditTitle(localPost.title);
									setEditContent(localPost.content);
								}}
								sx={{
									fontWeight: "bold",
									borderRadius: 2,
									textTransform: "none",
								}}
							>
								Cancel
							</Button>
						</Box>
					</Box>
				) : (
					<Typography
						variant="body1"
						color="text.primary"
						sx={{ mb: 3, whiteSpace: "pre-wrap" }}
					>
						{localPost.content}
					</Typography>
				)}

				{/* STATS (Likes & Comments counts) */}
				{(localPost.likedBy?.length > 0 || totalCommentsCount > 0) && (
					<Box
						sx={{
							display: "flex",
							justifyContent: "flex-end",
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
									"&:hover": { textDecoration: "underline" },
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
									"&:hover": { textDecoration: "underline" },
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

				{/* ACTION BAR */}
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

			{/* MODALS */}
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

			{/* IMPORTED DELETE CONFIRMATION */}
			<ConfirmDeleteDialog
				open={deleteConfirmOpen}
				onClose={() => setDeleteConfirmOpen(false)}
				onConfirm={confirmDeletePost}
				itemName="post"
			/>
		</>
	);
}
