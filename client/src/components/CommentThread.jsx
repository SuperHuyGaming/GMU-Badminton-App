// client/src/components/CommentThread.jsx
import { useState, useEffect } from "react";
import { Box, Typography, Button, TextField, Avatar } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function CommentThread({
	comment,
	localPost,
	currentUser,
	highlightId,
	openLikes,
	handleToggleLike,
	apiCall,
	formatTime,
	renderContentWithTags,
	clickableStyle,
}) {
	const navigate = useNavigate();

	// FIX: Each comment thread manages its own localized state now!
	const [isReplying, setIsReplying] = useState(false);
	const [nestedReplyText, setNestedReplyText] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);

	// Auto-expand this specific thread if a reply is highlighted
	useEffect(() => {
		if (
			highlightId &&
			comment.replies?.some((r) => r._id === highlightId)
		) {
			setIsExpanded(true);
		}
	}, [highlightId, comment.replies]);

	const handleSubmitNestedReply = () => {
		if (!nestedReplyText.trim() || !currentUser) return;
		apiCall(
			`/api/forum/${localPost._id}/comments/${comment._id}/replies`,
			"POST",
			{
				authorId: currentUser.id,
				authorName: currentUser.name,
				content: nestedReplyText,
			},
		);
		setNestedReplyText("");
		setIsReplying(false);
		setIsExpanded(true); // Auto-open replies after posting
	};

	return (
		<Box
			id={`comment-${comment._id}`}
			className={highlightId === comment._id ? "highlight-active" : ""}
			sx={{ display: "flex", flexDirection: "column", p: 0.5 }}
		>
			{/* THE MAIN COMMENT BUBBLE */}
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
						<Typography
							onClick={() =>
								navigate(`/profile/${comment.authorId}`)
							}
							variant="subtitle2"
							fontWeight="bold"
							sx={{ lineHeight: 1, ...clickableStyle }}
						>
							{comment.authorName}
						</Typography>

						{renderContentWithTags(comment.content)}

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

					<Box sx={{ display: "flex", gap: 2, ml: 1, mt: 0.5 }}>
						<Typography
							variant="caption"
							onClick={() =>
								handleToggleLike(
									`/api/forum/${localPost._id}/comments/${comment._id}/like`,
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
								"&:active": { transform: "scale(0.9)" },
							}}
						>
							Like
						</Typography>
						<Typography
							variant="caption"
							onClick={() => {
								setIsReplying(true);
								setNestedReplyText(`@${comment.authorName} `);
							}}
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

			{/* REPLIES TOGGLE */}
			{comment.replies?.length > 0 && (
				<Typography
					variant="caption"
					onClick={() => setIsExpanded(!isExpanded)}
					sx={{
						ml: 5,
						mt: 0.5,
						cursor: "pointer",
						fontWeight: "bold",
						color: "text.secondary",
					}}
				>
					{isExpanded
						? "Hide replies"
						: `↪ View ${comment.replies.length} replies`}
				</Typography>
			)}

			{/* NESTED REPLIES BUBBLES */}
			{isExpanded &&
				comment.replies?.map((reply) => (
					<Box
						key={reply._id}
						id={`comment-${reply._id}`}
						className={
							highlightId === reply._id ? "highlight-active" : ""
						}
						sx={{
							display: "flex",
							mt: 1,
							ml: { xs: 4, sm: 6 },
							borderLeft: "2px solid #ccc",
							pl: 1.5,
							p: 0.5,
						}}
					>
						<Avatar
							src={reply.authorPic}
							onClick={() =>
								navigate(`/profile/${reply.authorId}`)
							}
							sx={{
								width: 24,
								height: 24,
								fontSize: "0.7rem",
								mr: 1,
								...clickableStyle,
							}}
						>
							{!reply.authorPic && reply.authorName.charAt(0)}
						</Avatar>
						<Box sx={{ flexGrow: 1, minWidth: 0 }}>
							<Box
								sx={{
									position: "relative",
									backgroundColor: "#e4e6eb",
									p: 1,
									borderRadius: 3,
									display: "inline-block",
									maxWidth: "100%",
								}}
							>
								<Typography
									onClick={() =>
										navigate(`/profile/${reply.authorId}`)
									}
									variant="subtitle2"
									fontWeight="bold"
									sx={{
										fontSize: "0.8rem",
										...clickableStyle,
									}}
								>
									{reply.authorName}
								</Typography>

								{renderContentWithTags(reply.content)}

								{reply.likedBy?.length > 0 && (
									<Box
										onClick={(e) =>
											openLikes(
												e,
												"Reply Likes",
												reply.likedByDetails,
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
											boxShadow:
												"0 1px 4px rgba(0,0,0,0.15)",
											cursor: "pointer",
											"&:active": {
												transform: "scale(0.95)",
											},
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
											{reply.likedBy.length}
										</Typography>
									</Box>
								)}
							</Box>

							<Box
								sx={{ display: "flex", gap: 2, ml: 1, mt: 0.5 }}
							>
								<Typography
									variant="caption"
									onClick={() =>
										handleToggleLike(
											`/api/forum/${localPost._id}/comments/${comment._id}/replies/${reply._id}/like`,
											reply._id,
										)
									}
									sx={{
										cursor: "pointer",
										fontWeight: "bold",
										color: reply.likedBy?.includes(
											currentUser?.id,
										)
											? "primary.main"
											: "text.secondary",
										"&:active": { transform: "scale(0.9)" },
									}}
								>
									Like
								</Typography>
								<Typography
									variant="caption"
									onClick={() => {
										setIsReplying(true);
										setNestedReplyText(
											`@${reply.authorName} `,
										);
									}}
									sx={{
										cursor: "pointer",
										fontWeight: "bold",
										color: "text.secondary",
										"&:active": { transform: "scale(0.9)" },
									}}
								>
									Reply
								</Typography>
							</Box>
						</Box>
					</Box>
				))}

			{/* NESTED REPLY INPUT (Specific to this thread!) */}
			{isReplying && (
				<Box
					sx={{
						display: "flex",
						gap: 1,
						mt: 1,
						alignItems: "flex-end",
						ml: { xs: 4, sm: 6 },
					}}
				>
					<TextField
						fullWidth
						size="small"
						multiline
						maxRows={4}
						placeholder={`Reply to ${comment.authorName}...`}
						value={nestedReplyText}
						onChange={(e) => setNestedReplyText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmitNestedReply();
							}
						}}
						sx={{
							"& .MuiOutlinedInput-root": {
								borderRadius: "20px",
								bgcolor: "white",
								py: 1,
								px: 2,
							},
						}}
					/>
					<Button
						size="small"
						variant="contained"
						onClick={handleSubmitNestedReply}
						disabled={!nestedReplyText.trim()}
						sx={{
							borderRadius: 5,
							minWidth: "50px",
							mb: 0.5,
							"&:active": { transform: "scale(0.95)" },
						}}
					>
						Post
					</Button>
				</Box>
			)}
		</Box>
	);
}
