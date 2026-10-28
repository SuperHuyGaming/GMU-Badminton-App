// client/src/components/ShareModal.jsx
import { useState } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Box,
	Typography,
	Button,
	TextField,
	Avatar,
	IconButton,
	Paper,
	Divider,
	CircularProgress,
} from "@mui/material";
import { toast } from "react-hot-toast";
import apiFetch from "../utils/api";
import { CloseIcon, ShareIcon } from "./Icons";

export default function ShareModal({
	open,
	onClose,
	post,
	currentUser,
	onShareSuccess,
}) {
	const [thoughts, setThoughts] = useState("");
	const [isSharing, setIsSharing] = useState(false);

	if (!post) return null;

	const postImages = post.imageUrls?.length > 0
		? post.imageUrls
		: (post.mediaUrls?.length > 0
			? post.mediaUrls
			: (post.imageUrl ? [post.imageUrl] : []));
	const thumbnail = postImages[0] || null;

	const shareUrl = typeof window !== "undefined"
		? `${window.location.origin}/community#post-${post._id}`
		: `/community#post-${post._id}`;

	const handleShareToFeed = async () => {
		if (!currentUser) {
			toast.error("Please log in to share posts.");
			return;
		}
		setIsSharing(true);
		try {
			const res = await apiFetch("/api/forum", {
				method: "POST",
				body: JSON.stringify({
					title: post.title ? `Repost: ${post.title}` : `Repost by ${currentUser.name || "Member"}`,
					content: thoughts.trim() || `Shared a post by ${post.authorName || "a club member"}`,
					originalPostId: post._id,
					isRepost: true,
					visibility: "PUBLIC",
				}),
			});

			if (res && res.ok) {
				const data = await res.json().catch(() => ({}));
				toast.success("Post shared to your feed! 🏸");
				setThoughts("");
				if (onShareSuccess) onShareSuccess(data);
				onClose();
			} else {
				const errData = await res?.json().catch(() => ({}));
				toast.error(errData?.message || "Failed to share post.");
			}
		} catch (err) {
			console.error("Error sharing post:", err);
			toast.error("Network error sharing post.");
		} finally {
			setIsSharing(false);
		}
	};

	const handleCopyLink = async () => {
		try {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
			toast.success("Post link copied to clipboard! 📋");
			onClose();
		} catch (err) {
			console.error("Clipboard copy error:", err);
			toast(shareUrl);
			onClose();
		}
	};

	const handleSendViaDm = async () => {
		try {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(shareUrl);
			}
			toast.success("Post link copied! Ready to paste into Direct Message 💬");
			onClose();
		} catch (err) {
			console.error("DM share error:", err);
			toast(shareUrl);
			onClose();
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						borderRadius: 3,
						p: 1,
						boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
					},
				},
			}}
			data-testid="share-modal"
		>
			<DialogTitle
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					pb: 1,
					fontWeight: "bold",
					fontSize: "1.2rem",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<ShareIcon />
					<span>Share Post</span>
				</Box>
				<IconButton
					aria-label="Close share dialog"
					data-testid="share-modal-close-btn"
					onClick={onClose}
					size="small"
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent sx={{ pt: 1, pb: 2 }}>
				{/* USER THOUGHTS INPUT */}
				<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
					<Avatar
						src={currentUser?.profilePic}
						alt={currentUser?.name || "User Avatar"}
						sx={{ width: 40, height: 40, bgcolor: "primary.main" }}
					>
						{!currentUser?.profilePic && (currentUser?.name?.charAt(0).toUpperCase() || "U")}
					</Avatar>
					<TextField
						fullWidth
						multiline
						rows={2}
						placeholder="Say something about this post..."
						value={thoughts}
						onChange={(e) => setThoughts(e.target.value)}
						variant="outlined"
						aria-label="Write your thoughts on this post"
						slotProps={{
							htmlInput: {
								"data-testid": "share-thoughts-input",
								"aria-label": "Write your thoughts on this post",
							},
						}}
						sx={{
							"& .MuiOutlinedInput-root": {
								borderRadius: 2,
								fontSize: "0.95rem",
							},
						}}
					/>
				</Box>

				{/* QUOTE PREVIEW CARD */}
				<Paper
					variant="outlined"
					data-testid="quote-preview-card"
					sx={{
						p: 2,
						borderRadius: 2.5,
						bgcolor: "action.hover",
						borderColor: "divider",
						position: "relative",
						overflow: "hidden",
					}}
				>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1 }}>
						<Avatar
							src={post.authorPic}
							alt={post.authorName || "Author"}
							sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}
						>
							{!post.authorPic && (post.authorName?.charAt(0).toUpperCase() || "A")}
						</Avatar>
						<Box>
							<Typography variant="subtitle2" fontWeight="bold">
								{post.authorName || "Club Member"}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{post.category ? `• ${post.category}` : "• Discussion"}
							</Typography>
						</Box>
					</Box>

					{post.title && (
						<Typography variant="body1" fontWeight="bold" sx={{ mb: 0.5 }}>
							{post.title}
						</Typography>
					)}

					<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{
								flex: 1,
								display: "-webkit-box",
								WebkitLineClamp: 3,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
								whiteSpace: "pre-wrap",
								fontSize: "0.85rem",
								lineHeight: 1.5,
							}}
						>
							{post.content}
						</Typography>

						{thumbnail && (
							<Box
								component="img"
								src={thumbnail}
								alt="Post attachment preview"
								sx={{
									width: 72,
									height: 72,
									borderRadius: 1.5,
									objectFit: "cover",
									flexShrink: 0,
								}}
							/>
						)}
					</Box>
				</Paper>

				<Divider sx={{ my: 2 }} />

				{/* 1-CLICK SHARING ACTIONS */}
				<Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
					<Button
						variant="outlined"
						data-testid="copy-link-btn"
						onClick={handleCopyLink}
						sx={{
							borderRadius: 2,
							textTransform: "none",
							fontWeight: 600,
							flex: 1,
							py: 1,
						}}
					>
						📋 Copy Direct Link
					</Button>
					<Button
						variant="outlined"
						data-testid="send-dm-btn"
						onClick={handleSendViaDm}
						sx={{
							borderRadius: 2,
							textTransform: "none",
							fontWeight: 600,
							flex: 1,
							py: 1,
						}}
					>
						💬 Send via Direct Message
					</Button>
				</Box>
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
				<Button
					onClick={onClose}
					color="inherit"
					sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
				>
					Cancel
				</Button>
				<Button
					variant="contained"
					color="primary"
					data-testid="share-to-feed-btn"
					disabled={isSharing}
					onClick={handleShareToFeed}
					sx={{
						borderRadius: 2,
						textTransform: "none",
						fontWeight: "bold",
						px: 3,
					}}
				>
					{isSharing ? <CircularProgress size={20} color="inherit" /> : "Share to Feed"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
