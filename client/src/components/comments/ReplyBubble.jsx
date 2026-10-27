// client/src/components/comments/ReplyBubble.jsx
// eslint-disable-next-line no-unused-vars
import React from "react";
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
	Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { MoreVertIcon } from "../Icons";
import apiFetch from "../../utils/api";
import { toast } from "react-hot-toast";

export default function ReplyBubble({
	reply,
	commentId,
	localPostId,
	postAuthorId,
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
	const [editContent, setEditContent] = useState(reply.content);

	const closeMenu = () => setMenuAnchor(null);

	const handleSaveEdit = async () => {
		if (!editContent.trim()) return;
		try {
			const res = await apiFetch(
				`/api/forum/${localPostId}/comments/${commentId}/replies/${reply._id}`,
				{
					method: "PUT",
					body: JSON.stringify({
						userId: currentUser.id,
						content: editContent,
					}),
				},
			);

			if (res.ok) {
				const data = await res.json();
				if (!data.title && !data._id)
					toast("Your edit has been sent for review.", { icon: "ℹ️" });
			}
		} catch (err) {
			console.error("Error saving reply edit:", err);
		}
		setIsEditing(false);
	};

	return (
		<Box
			id={`comment-${reply._id}`}
			className={highlightId === reply._id ? "highlight-active" : ""}
			sx={{
				display: "flex",
				mt: 1,
				ml: { xs: 4, sm: 6 },
				borderLeft: "2px solid",
				borderColor: "divider",
				pl: 1.5,
				p: 0.5,
			}}
		>
			<Avatar
				src={reply.authorPic}
				alt={reply.authorName || "Reply author"}
				role="link"
				tabIndex={0}
				aria-label={`View ${reply.authorName || "author"}'s profile`}
				onClick={() => navigate(`/profile/${reply.authorId}`)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						navigate(`/profile/${reply.authorId}`);
					}
				}}
				sx={{
					width: 24,
					height: 24,
					fontSize: "0.7rem",
					mr: 1,
					...clickableStyle,
				}}
			>
				{!reply.authorPic && reply.authorName?.charAt(0)}
			</Avatar>

			<Box sx={{ flexGrow: 1, minWidth: 0 }}>
				<Box
					sx={{
						position: "relative",
						backgroundColor: "action.hover",
						py: 0.8,
						px: 1.5,
						borderRadius: "16px",
						display: "inline-block",
						maxWidth: "100%",
						boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
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
							role="link"
							tabIndex={0}
							onClick={() =>
								navigate(`/profile/${reply.authorId}`)
							}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									navigate(`/profile/${reply.authorId}`);
								}
							}}
							variant="subtitle2"
							fontWeight="bold"
							sx={{ fontSize: "0.8rem", ...clickableStyle }}
						>
							{reply.authorName}
							{String(reply.authorId) === String(postAuthorId) && (
								<Chip
									label="OP"
									size="small"
									sx={{
										height: 16,
										fontSize: "0.6rem",
										fontWeight: "900",
										bgcolor: "primary.main",
										color: "primary.contrastText",
										borderRadius: "4px",
										px: 0.2,
										ml: 0.5,
									}}
								/>
							)}
							{(reply.authorRole === "admin" || reply.authorBadges?.includes("club_executive")) && (
								<Chip
									label="Club Exec"
									size="small"
									sx={{
										height: 16,
										fontSize: "0.6rem",
										fontWeight: "bold",
										bgcolor: "secondary.main",
										color: "secondary.contrastText",
										borderRadius: "4px",
										px: 0.2,
										ml: 0.5,
									}}
								/>
							)}
							{reply.authorBadges?.includes("tournament_director") && (
								<Chip
									label="TD"
									size="small"
									sx={{
										height: 16,
										fontSize: "0.6rem",
										fontWeight: "bold",
										bgcolor: "info.main",
										color: "info.contrastText",
										borderRadius: "4px",
										px: 0.2,
										ml: 0.5,
									}}
								/>
							)}
							{reply.isEdited && (
								<Typography
									component="span"
									sx={{
										fontWeight: "normal",
										fontStyle: "italic",
										fontSize: "0.7rem",
										color: "text.secondary",
										ml: 0.75,
									}}
								>
									(edited)
								</Typography>
							)}
						</Typography>

						{Boolean(currentUser) && (
							<IconButton
								aria-label="Reply options"
								size="small"
								onClick={(e) => setMenuAnchor(e.currentTarget)}
								sx={{ p: 0.2, ml: 1, color: "text.primary" }}
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
								aria-label="Edit reply"
								inputProps={{ 'aria-label': 'Edit reply' }}
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								sx={{
									mb: 1,
									bgcolor: "background.paper",
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
						renderContentWithTags(reply.content)
					)}

					{reply.likedBy?.length > 0 && (
						<Box
							role="button"
							tabIndex={0}
							aria-label="View users who liked this reply"
							onClick={(e) =>
								openLikes(
									e,
									"Reply Likes",
									reply.likedByDetails,
								)
							}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									openLikes(
										e,
										"Reply Likes",
										reply.likedByDetails,
									);
								}
							}}
							sx={{
								position: "absolute",
								bottom: -8,
								right: -8,
								bgcolor: "background.paper",
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
									color: "text.primary",
									fontWeight: "bold",
								}}
							>
								{reply.likedBy.length}
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
					{currentUser?.id === reply.authorId && (
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
					{(currentUser?.id === reply.authorId || currentUser?.role === "admin") && (
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
					)}
					<MenuItem
						onClick={() => {
							const link = `${window.location.origin}/community?postId=${localPostId}&highlight=${reply._id}#comment-${reply._id}`;
							if (navigator.clipboard) {
								navigator.clipboard.writeText(link);
								toast.success("Reply link copied! 📋");
							}
							closeMenu();
						}}
						sx={{ fontSize: "0.875rem", fontWeight: "bold" }}
					>
						📋 Copy Link
					</MenuItem>
					{currentUser && currentUser.id !== reply.authorId && (
						<MenuItem
							onClick={async () => {
								closeMenu();
								try {
									const res = await apiFetch(`/api/forum/${localPostId}/comments/${commentId}/replies/${reply._id}/report`, {
										method: "POST",
										body: JSON.stringify({ reason: "Inappropriate or Offensive" }),
									});
									const data = await res?.json().catch(() => ({}));
									if (res && res.ok) {
										toast.success("Reply reported. Thank you for keeping our community safe.");
									} else {
										toast.error(data?.message || "Failed to report reply.");
									}
								} catch {
									toast.error("Network error reporting reply.");
								}
							}}
							sx={{
								fontSize: "0.875rem",
								color: "error.main",
								fontWeight: "bold",
							}}
						>
							🚩 Report Reply
						</MenuItem>
					)}
				</Menu>

				<Box sx={{ display: "flex", gap: 2, ml: 1, mt: 0.5 }}>
					<Typography
						role="button"
						tabIndex={0}
						variant="caption"
						onClick={() =>
							handleToggleLike(
								`/api/forum/${localPostId}/comments/${commentId}/replies/${reply._id}/like`,
								reply._id,
							)
						}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleToggleLike(
									`/api/forum/${localPostId}/comments/${commentId}/replies/${reply._id}/like`,
									reply._id,
								);
							}
						}}
						sx={{
							cursor: "pointer",
							fontWeight: "bold",
							color: reply.likedBy?.includes(currentUser?.id)
								? "primary.main"
								: "text.primary",
							"&:active": { transform: "scale(0.9)" },
						}}
					>
						Like
					</Typography>
					<Typography
						role="button"
						tabIndex={0}
						variant="caption"
						onClick={onReply}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onReply();
							}
						}}
						sx={{
							cursor: "pointer",
							fontWeight: "bold",
							color: "text.primary",
							"&:active": { transform: "scale(0.9)" },
						}}
					>
						Reply
					</Typography>
					{/* Fixed: Adding timestamp back in for replies */}
					<Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
						{formatTime(reply.timestamp)}
					</Typography>
				</Box>
			</Box>
		</Box>
	);
}
