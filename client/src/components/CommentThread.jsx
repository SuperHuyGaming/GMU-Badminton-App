// client/src/components/CommentThread.jsx
import { useState, useEffect } from "react";
import { Box, Typography, Button, TextField } from "@mui/material";

// Sub-components
import CommentBubble from "./comments/CommentBubble";
import ReplyBubble from "./comments/ReplyBubble";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

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
	const [isReplying, setIsReplying] = useState(false);
	const [nestedReplyText, setNestedReplyText] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);

	// Single dialog state handles both comments and replies
	const [deleteTarget, setDeleteTarget] = useState(null); // { isReply: boolean, replyId: string|null }

	useEffect(() => {
		if (highlightId && comment.replies?.some((r) => r._id === highlightId))
			setIsExpanded(true);
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
		setIsExpanded(true);
	};

	const confirmDelete = async () => {
		if (!deleteTarget) return;
		let endpoint = `/api/forum/${localPost._id}/comments/${comment._id}`;
		if (deleteTarget.isReply)
			endpoint += `/replies/${deleteTarget.replyId}`;
		await apiCall(endpoint, "DELETE", { userId: currentUser.id });
		setDeleteTarget(null);
	};

	return (
		<Box
			id={`comment-${comment._id}`}
			className={highlightId === comment._id ? "highlight-active" : ""}
			sx={{ display: "flex", flexDirection: "column", p: 0.5 }}
		>
			{/* MAIN COMMENT */}
			<CommentBubble
				comment={comment}
				localPostId={localPost._id}
				currentUser={currentUser}
				highlightId={highlightId}
				openLikes={openLikes}
				handleToggleLike={handleToggleLike}
				formatTime={formatTime}
				renderContentWithTags={renderContentWithTags}
				clickableStyle={clickableStyle}
				promptDelete={() =>
					setDeleteTarget({ isReply: false, replyId: null })
				}
				onReply={() => {
					setIsReplying(true);
					setNestedReplyText(`@${comment.authorName} `);
				}}
			/>

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

			{/* NESTED REPLIES LOOP */}
			{isExpanded &&
				comment.replies?.map((reply) => (
					<ReplyBubble
						key={reply._id}
						reply={reply}
						commentId={comment._id}
						localPostId={localPost._id}
						currentUser={currentUser}
						highlightId={highlightId}
						openLikes={openLikes}
						handleToggleLike={handleToggleLike}
						formatTime={formatTime}
						renderContentWithTags={renderContentWithTags}
						clickableStyle={clickableStyle}
						promptDelete={() =>
							setDeleteTarget({
								isReply: true,
								replyId: reply._id,
							})
						}
						onReply={() => {
							setIsReplying(true);
							setNestedReplyText(`@${reply.authorName} `);
						}}
					/>
				))}

			{/* NESTED REPLY INPUT */}
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

			{/* SHARED DELETE DIALOG */}
			<ConfirmDeleteDialog
				open={!!deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onConfirm={confirmDelete}
				itemName={deleteTarget?.isReply ? "reply" : "comment"}
			/>
		</Box>
	);
}
