// client/src/components/comments/CommentBubble.jsx
import { useState } from "react";
import {
	Box,
	Typography,
	Button,
	TextField,
	Avatar,
	IconButton,
	Menu,
	MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { MoreVertIcon } from "../Icons";

export default function CommentBubble({
	comment,
	localPostId,
	currentUser,
	highlightId,
	openLikes,
	handleToggleLike,
	formatTime,
	renderContentWithTags,
	clickableStyle,
	promptDelete,
	onReply,
}) {
	const navigate = useNavigate();
	const [menuAnchor, setMenuAnchor] = useState(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);

	const closeMenu = () => setMenuAnchor(null);

	const handleSaveEdit = async () => {
		if (!editContent.trim()) return;
		const res = await fetch(
			`${import.meta.env.VITE_API_URL}/api/forum/${localPostId}/comments/${comment._id}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({
					userId: currentUser.id,
					content: editContent,
				}),
			},
		);

		if (res.ok) {
			const data = await res.json();
			if (!data.title && !data._id)
				alert(
					"Your edit has been sent for admin review due to our spam filters.",
				);
		}
		setIsEditing(false);
	};

	return (
		<Box sx={{ display: "flex", gap: 1 }}>
			<Avatar
				src={comment.authorPic}
				onClick={() => navigate(`/profile/${comment.authorId}`)}
				sx={{
					width: 32,
					height: 32,
					fontSize: "0.9rem",
					...clickableStyle,
				}}
			>
				{!comment.authorPic && comment.authorName.charAt(0)}
			</Avatar>

			<Box sx={{ flexGrow: 1, minWidth: 0 }}>
				<Box
					sx={{
						position: "relative",
						backgroundColor: "#e4e6eb",
						p: 1.5,
						borderRadius: 3,
						display: "inline-block",
						maxWidth: "100%",
					}}
				>
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<Typography
							onClick={() =>
								navigate(`/profile/${comment.authorId}`)
							}
							variant="subtitle2"
							fontWeight="bold"
							sx={{ lineHeight: 1, ...clickableStyle }}
						>
							{comment.authorName}
							{comment.isEdited && (
								<span
									style={{
										fontWeight: "normal",
										fontStyle: "italic",
										fontSize: "0.75rem",
										opacity: 0.6,
										marginLeft: "6px",
									}}
								>
									(edited)
								</span>
							)}
						</Typography>

						{(currentUser?.id === comment.authorId ||
							currentUser?.role === "admin") && (
							<IconButton
								size="small"
								onClick={(e) => setMenuAnchor(e.currentTarget)}
								sx={{ p: 0.2, ml: 1, color: "text.secondary" }}
							>
								<MoreVertIcon />
							</IconButton>
						)}
					</Box>

					{isEditing ? (
						<Box sx={{ mt: 1, minWidth: "200px" }}>
							<TextField
								fullWidth
								size="small"
								multiline
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								sx={{
									mb: 1,
									bgcolor: "white",
									borderRadius: 1,
								}}
							/>
							<Box sx={{ display: "flex", gap: 1 }}>
								<Button
									size="small"
									variant="contained"
									onClick={handleSaveEdit}
									sx={{
										textTransform: "none",
										borderRadius: 2,
									}}
								>
									Save
								</Button>
								<Button
									size="small"
									variant="outlined"
									onClick={() => setIsEditing(false)}
									sx={{
										textTransform: "none",
										borderRadius: 2,
									}}
								>
									Cancel
								</Button>
							</Box>
						</Box>
					) : (
						renderContentWithTags(comment.content)
					)}

					{comment.likedBy?.length > 0 && (
						<Box
							onClick={(e) =>
								openLikes(
									e,
									"Comment Likes",
									comment.likedByDetails,
								)
							}
							sx={{
								position: "absolute",
								bottom: -8,
								right: -8,
								bgcolor: "white",
								borderRadius: 10,
								px: 0.6,
								py: 0.2,
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
								cursor: "pointer",
								"&:active": { transform: "scale(0.95)" },
							}}
						>
							<Avatar
								sx={{
									width: 14,
									height: 14,
									bgcolor: "primary.main",
									fontSize: "0.5rem",
								}}
							>
								👍
							</Avatar>
							<Typography
								variant="caption"
								sx={{
									fontSize: "0.7rem",
									color: "text.secondary",
									fontWeight: "bold",
								}}
							>
								{comment.likedBy.length}
							</Typography>
						</Box>
					)}
				</Box>

				<Menu
					anchorEl={menuAnchor}
					open={Boolean(menuAnchor)}
					onClose={closeMenu}
					slotProps={{
						paper: { elevation: 2, sx: { borderRadius: 2 } },
					}}
				>
					{currentUser?.id === comment.authorId && (
						<MenuItem
							onClick={() => {
								setIsEditing(true);
								closeMenu();
							}}
							sx={{ fontSize: "0.875rem", fontWeight: "bold" }}
						>
							✎ Edit
						</MenuItem>
					)}
					<MenuItem
						onClick={() => {
							promptDelete();
							closeMenu();
						}}
						sx={{
							fontSize: "0.875rem",
							color: "error.main",
							fontWeight: "bold",
						}}
					>
						🗑 Delete
					</MenuItem>
				</Menu>

				<Box sx={{ display: "flex", gap: 2, ml: 1, mt: 0.5 }}>
					<Typography
						variant="caption"
						onClick={() =>
							handleToggleLike(
								`/api/forum/${localPostId}/comments/${comment._id}/like`,
								comment._id,
							)
						}
						sx={{
							cursor: "pointer",
							fontWeight: "bold",
							color: comment.likedBy?.includes(currentUser?.id)
								? "primary.main"
								: "text.secondary",
							"&:active": { transform: "scale(0.9)" },
						}}
					>
						Like
					</Typography>
					<Typography
						variant="caption"
						onClick={onReply}
						sx={{
							cursor: "pointer",
							fontWeight: "bold",
							color: "text.secondary",
							"&:active": { transform: "scale(0.9)" },
						}}
					>
						Reply
					</Typography>
					<Typography variant="caption" color="text.disabled">
						{formatTime(comment.timestamp)}
					</Typography>
				</Box>
			</Box>
		</Box>
	);
}
