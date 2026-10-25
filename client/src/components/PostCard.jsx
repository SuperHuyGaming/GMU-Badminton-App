// client/src/components/PostCard.jsx
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import socket from "../utils/socket";
import apiFetch from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
	Typography,
	Button,
	Box,
	Paper,
	Divider,
	CardActions,
	Avatar,
	AvatarGroup,
	IconButton,
	Menu,
	MenuItem,
	TextField,
	Collapse,
	Chip,
	Tooltip,
} from "@mui/material";

// Badminton Reaction Trio
const BADMINTON_REACTIONS = [
	{ emoji: "💥", type: "smash", label: "Smash", tooltip: "Smash (Like/Hype)" },
	{ emoji: "🧊", type: "ice_drop", label: "Ice Drop", tooltip: "Ice Drop (IDK/Cold)" },
	{ emoji: "⚡", type: "clutch", label: "Clutch", tooltip: "Clutch (Game-Winner)" },
];

const CATEGORY_CONFIG = {
	general: { label: "General", bg: "rgba(0, 0, 0, 0.05)", color: "text.secondary", border: "rgba(0, 0, 0, 0.12)" },
	match_result: { label: "Match Result", bg: "rgba(33, 150, 243, 0.12)", color: "#1976d2", border: "rgba(33, 150, 243, 0.3)" },
	gear_review: { label: "Gear Review", bg: "rgba(156, 39, 176, 0.12)", color: "#7b1fa2", border: "rgba(156, 39, 176, 0.3)" },
	meetup_rally: { label: "Meetup Rally", bg: "rgba(76, 175, 80, 0.12)", color: "#2e7d32", border: "rgba(76, 175, 80, 0.3)" },
	training: { label: "Training", bg: "rgba(255, 152, 0, 0.12)", color: "#e65100", border: "rgba(255, 152, 0, 0.3)" },
	find_partner: { label: "Find Partner", bg: "rgba(0, 150, 136, 0.12)", color: "#00796b", border: "rgba(0, 150, 136, 0.3)" },
	challenge_match: { label: "Match Challenge", bg: "rgba(233, 30, 99, 0.12)", color: "#c2185b", border: "rgba(233, 30, 99, 0.3)" },
	qa_forum: { label: "Badminton Q&A", bg: "rgba(103, 58, 183, 0.12)", color: "#512da8", border: "rgba(103, 58, 183, 0.3)" },
	gear_exchange: { label: "Gear Exchange", bg: "rgba(255, 87, 34, 0.12)", color: "#d84315", border: "rgba(255, 87, 34, 0.3)" },
};

// Separated Sub-Components
import LikesModal from "./LikesModal";
import PostCommentsInline from "./PostCommentsInline";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import MediaLightbox from "./MediaLightbox";
import {
	ThumbUpFilled,
	MessageCircleIcon,
	ShareIcon,
	MoreVertIcon,
} from "./Icons";

// eslint-disable-next-line no-unused-vars
export default function PostCard({ post, isBookmarked, onBookmarkToggle, currentUser: propUser }) {
	const navigate = useNavigate();
	const currentUser = propUser || (typeof window !== "undefined" && localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null);
	const currentUserId = currentUser?.id || currentUser?._id;
    const controls = useAnimation();
	const touchTimer = useRef(null);

	const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);
	const [localPost, setLocalPost] = useState(post);

	const [likesModal, setLikesModal] = useState({
		open: false,
		title: "",
		list: [],
	});
	const [isLiking, setIsLiking] = useState(false);
	const [isRsvping, setIsRsvping] = useState(false);
	const [isAcceptingChallenge, setIsAcceptingChallenge] = useState(false);

	const handleToggleRsvp = async (e) => {
		e?.stopPropagation();
		if (!currentUser) {
			toast.error("Please log in to RSVP for this rally.");
			return;
		}
		if (isRsvping) return;
		setIsRsvping(true);

		const prevMatchmaking = localPost.playerMatchmaking;
		const rsvpList = Array.isArray(prevMatchmaking?.rsvpList) ? [...prevMatchmaking.rsvpList] : [];
		const idx = rsvpList.findIndex(r => String(r.userId) === String(currentUserId));
		
		if (idx > -1) {
			rsvpList.splice(idx, 1);
		} else {
			rsvpList.push({
				userId: String(currentUserId),
				userName: currentUser.name || "Player",
				avatarUrl: currentUser.avatarUrl || currentUser.profilePic || "",
				status: "confirmed"
			});
		}

		const slots = prevMatchmaking?.slotsNeeded || 1;
		const isFilled = rsvpList.filter(r => r.status === "confirmed").length >= slots;
		const optimisticMatchmaking = {
			...prevMatchmaking,
			rsvpList,
			isFilled
		};

		setLocalPost(prev => ({ ...prev, playerMatchmaking: optimisticMatchmaking }));

		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/rsvp`, { method: "POST" });
			if (res && res.ok) {
				const data = await res.json();
				setLocalPost(prev => ({ ...prev, playerMatchmaking: data.playerMatchmaking }));
				toast.success(idx > -1 ? "Left the rally." : "You're in! RSVP confirmed.");
			} else {
				setLocalPost(prev => ({ ...prev, playerMatchmaking: prevMatchmaking }));
				toast.error("Failed to update RSVP.");
			}
		} catch {
			setLocalPost(prev => ({ ...prev, playerMatchmaking: prevMatchmaking }));
			toast.error("Network error updating RSVP.");
		} finally {
			setIsRsvping(false);
		}
	};

	const handleAcceptChallenge = async (e) => {
		e?.stopPropagation();
		if (!currentUser) {
			toast.error("Please log in to accept this challenge.");
			return;
		}
		if (isAcceptingChallenge) return;
		setIsAcceptingChallenge(true);

		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/accept-challenge`, { method: "PUT" });
			if (res && res.ok) {
				const data = await res.json();
				setLocalPost(prev => ({ ...prev, challengeMatch: data.challengeMatch }));
				toast.success("Match challenge accepted! Prepare for the court.");
			} else {
				const errData = await res?.json().catch(() => ({}));
				toast.error(errData?.message || "Failed to accept challenge.");
			}
		} catch {
			toast.error("Error accepting challenge.");
		} finally {
			setIsAcceptingChallenge(false);
		}
	};

	const [anchorEl, setAnchorEl] = useState(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(post.title);
	const [editContent, setEditContent] = useState(post.content);

	// Toggles the imported dialog component
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const urlParams = new URLSearchParams(window.location.search);
	const highlightId = urlParams.get("highlight");
	const { postId: routePostId } = useParams();
	const urlPostId = urlParams.get("postId") || routePostId;

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLocalPost(post);
		setEditTitle(post.title);
		setEditContent(post.content);
	}, [post]);

	// INSTANT COMMENT INJECTION & REAL-TIME SYNC
	useEffect(() => {
		const handlePostUpdated = (updatedPost) => {
			if (updatedPost._id === localPost._id) {
				setLocalPost(prev => ({
					...prev,
					comments: updatedPost.comments,
					likedBy: updatedPost.likedBy,
					likedByDetails: updatedPost.likedByDetails,
					recentLikerAvatars: updatedPost.recentLikerAvatars,
					title: updatedPost.title,
					content: updatedPost.content,
					isEdited: updatedPost.isEdited,
					reactions: updatedPost.reactions || prev.reactions,
					category: updatedPost.category || prev.category,
					matchDetails: updatedPost.matchDetails || prev.matchDetails,
					playerMatchmaking: updatedPost.playerMatchmaking || prev.playerMatchmaking,
					challengeMatch: updatedPost.challengeMatch || prev.challengeMatch,
					qaDetails: updatedPost.qaDetails || prev.qaDetails,
					gearDetails: updatedPost.gearDetails || prev.gearDetails,
				}));
			}
		};

		socket.on("postUpdated", handlePostUpdated);
		return () => {
			socket.off("postUpdated", handlePostUpdated);
		};
	}, [localPost._id]);

	useEffect(() => {
		if (urlPostId === localPost._id) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			if (highlightId) setIsCommentModalOpen(true);
			setTimeout(() => {
				document
					.getElementById(`post-${localPost._id}`)
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 300);
		}
	}, [urlPostId, highlightId, localPost._id]);

	useEffect(() => {
		if (isCommentModalOpen && import.meta.env.MODE !== 'test') {
			apiFetch("/api/forum/" + localPost._id + "/comments")
			.then(res => res.json())
			.then(data => {
				if (data.comments) {
					setLocalPost(prev => ({ ...prev, comments: data.comments }));
				}
			})
			.catch(err => console.error("Error fetching comments:", err));
		}
	}, [isCommentModalOpen, localPost._id]);
	const totalCommentsCount =
		localPost.comments?.reduce(
			(acc, c) => acc + 1 + (c.replies?.length || 0),
			0,
		) || 0;
	const hasLiked = localPost.likedBy?.includes(currentUserId);
	const currentUserReaction = (localPost.reactions || []).find(
		(r) => r && String(r.userId) === String(currentUserId)
	)?.emoji;

	const [showHeart, setShowHeart] = useState(false);
	const [showReactions, setShowReactions] = useState(false);

	const handleDoubleTap = (e) => {
		e.preventDefault();
		if (!currentUserReaction) {
			handleReaction('💥');
		}
		setShowHeart(true);
		setTimeout(() => setShowHeart(false), 1000);
	};

	const openLikes = (e, title, list) => {
		e.stopPropagation();
		if (list?.length > 0) setLikesModal({ open: true, title, list });
	};

	const handleLike = async () => {
		if (!currentUser) return alert("You must be logged in to like posts!");
		if (isLiking) return;

		setIsLiking(true);
		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/like`, {
				method: "PUT",
				body: JSON.stringify({
					userId: currentUserId,
					userName: currentUser.name,
				}),
			});
			if (res && res.ok) setLocalPost(await res.json());
		} catch (err) {
			console.error(err);
		} finally {
			setIsLiking(false);
		}
	};

	const handleReaction = async (emoji) => {
		if (!currentUser) return alert("You must be logged in to react to posts!");
		setShowReactions(false);

		// Optimistic reaction update
		const prevReactions = localPost.reactions || [];
		const existingIndex = prevReactions.findIndex(
			(r) => r && String(r.userId) === String(currentUserId)
		);
		let updatedReactions = [...prevReactions];
		if (existingIndex > -1) {
			if (prevReactions[existingIndex].emoji === emoji) {
				// Same emoji -> toggle off
				updatedReactions.splice(existingIndex, 1);
			} else {
				// Different emoji -> switch reaction
				updatedReactions[existingIndex] = {
					...updatedReactions[existingIndex],
					emoji,
					reactionType: BADMINTON_REACTIONS.find((b) => b.emoji === emoji)?.type || "custom",
				};
			}
		} else {
			// New reaction
			updatedReactions.push({
				userId: currentUserId,
				userName: currentUser?.name || "Player",
				emoji,
				reactionType: BADMINTON_REACTIONS.find((b) => b.emoji === emoji)?.type || "custom",
				createdAt: new Date(),
			});
		}
		setLocalPost((prev) => ({ ...prev, reactions: updatedReactions }));

		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/react`, {
				method: "PUT",
				body: JSON.stringify({ emoji }),
			});
			if (res && res.ok) {
				const updated = await res.json();
				if (updated && updated._id) {
					setLocalPost(updated);
				}
			} else {
				setLocalPost((prev) => ({ ...prev, reactions: prevReactions }));
			}
		} catch (err) {
			console.error("Error submitting reaction:", err);
			setLocalPost((prev) => ({ ...prev, reactions: prevReactions }));
		}
	};

	const handleTogglePin = async () => {
		if (!currentUser || currentUser.role !== "admin") return;
		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/pin`, {
				method: "PUT",
			});
			if (res && res.ok) {
				const data = await res.json();
				setLocalPost((prev) => ({ ...prev, isPinned: data.isPinned }));
				toast.success(data.message || "Post pin status updated!");
			}
		} catch (err) {
			console.error("Error toggling pin status:", err);
		}
	};

	const handleShare = async (e) => {
		e.stopPropagation();
		const shareUrl = `${window.location.origin}/forum?postId=${localPost._id}`;
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(shareUrl);
			toast.success("Post link copied to clipboard! 📋");
		} else {
			toast(shareUrl);
		}
	};

	const handleSaveEdit = async () => {
		if (!editTitle.trim() || !editContent.trim()) return;
		try {
			const res = await apiFetch(`/api/forum/${localPost._id}`, {
				method: "PUT",
				body: JSON.stringify({
					userId: currentUserId,
					title: editTitle,
					content: editContent,
				}),
			});
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
			await apiFetch(`/api/forum/${localPost._id}`, {
				method: "DELETE",
				body: JSON.stringify({ userId: currentUserId }),
			});
			setIsCommentModalOpen(false);
		} catch (err) {
			console.error(err);
		}
	};

	// eslint-disable-next-line no-unused-vars
	const toggleBookmark = async () => {
		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/bookmark`, {
				method: "PUT",
				body: JSON.stringify({ userId: currentUserId }),
			});
			if (res && res.ok) {
				const data = await res.json();
				if (onBookmarkToggle) onBookmarkToggle(data.isBookmarked);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const formatTime = (dateString) => {
		if (!dateString) return "Just now";
		// eslint-disable-next-line react-hooks/purity
		const diff = Date.now() - new Date(dateString).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 7) return `${days}d ago`;
		return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

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
	const images = localPost.imageUrls?.length > 0 ? localPost.imageUrls : (localPost.imageUrl ? [localPost.imageUrl] : []);
	const [activeLightboxIndex, setActiveLightboxIndex] = useState(0);

	const handleDragEnd = (event, info) => {
		const threshold = 100;
		if (info.offset.x > threshold) {
			if (!localPost.likedBy?.includes(currentUser.id)) {
				handleLike();
			}
		} else if (info.offset.x < -threshold) {
			if (onBookmarkToggle) onBookmarkToggle();
		}
		controls.start({ x: 0 });
	};

	return (
		<>
			<style>
				{`
					@keyframes highlightFlash { 0% { background-color: rgba(0, 204, 102, 0.4); transform: scale(1.02); } 100% { background-color: transparent; transform: scale(1); } }
					.highlight-active { animation: highlightFlash 3s ease-out; border-radius: 8px; }
					@keyframes highlightPostFlash { 0% { border-color: #006633; box-shadow: 0 0 20px rgba(0, 102, 51, 0.4); transform: scale(1.02); } 100% { border-color: #e0e0e0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transform: scale(1); } }
					.highlight-post-active { animation: highlightPostFlash 3s ease-out; }
					@keyframes popAndFade { 
						0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 
						30% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 
						50% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 
						100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } 
					}
				`}
			</style>

			<Paper
				component={motion.div}
				drag="x"
				dragConstraints={{ left: 0, right: 0 }}
				dragElastic={0.2}
				onDragEnd={handleDragEnd}
				animate={controls}
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
					border: localPost.isPinned ? "2px solid" : "1px solid",
					borderColor: localPost.isPinned ? "warning.main" : "divider",
					borderRadius: 4,
					userSelect: "none",
					bgcolor: 'background.paper',
					backgroundImage: localPost.isPinned 
						? 'linear-gradient(to bottom right, rgba(255, 179, 0, 0.08), rgba(0, 102, 51, 0.04))' 
						: 'linear-gradient(to bottom right, rgba(255,255,255,0.05), rgba(0,0,0,0.01))',
					backdropFilter: 'blur(10px)',
					boxShadow: localPost.isPinned ? '0 8px 24px rgba(255, 165, 0, 0.12)' : 'none',
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					"&:hover": {
						borderColor: localPost.isPinned ? "warning.dark" : "primary.light",
						boxShadow: localPost.isPinned ? "0 14px 32px rgba(255, 165, 0, 0.22)" : "0 12px 30px rgba(0, 102, 51, 0.12)",
						transform: "translateY(-4px)",
					},
				}}
			>
				{/* PINNED MEGATHREAD BADGE */}
				{localPost.isPinned && (
					<Box sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
						<Chip
							label="📌 Pinned Megathread"
							size="small"
							sx={{
								fontWeight: "900",
								background: "linear-gradient(45deg, #FFB300 0%, #FFA000 100%)",
								color: "#000",
								fontSize: "0.75rem",
								boxShadow: "0 2px 8px rgba(255, 179, 0, 0.3)",
							}}
						/>
					</Box>
				)}

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
						alt={localPost.authorName || "Post author"}
						role="link"
						tabIndex={0}
						aria-label={`View ${localPost.authorName || "author"}'s profile`}
						onClick={() =>
							localPost.authorId && navigate(`/profile/${localPost.authorId}`)
						}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								localPost.authorId && navigate(`/profile/${localPost.authorId}`);
							}
						}}
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
								? localPost.authorName?.charAt(0).toUpperCase()
								: "?")}
					</Avatar>
					<Box sx={{ flexGrow: 1 }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
							{localPost.category && (
								<Chip
									label={CATEGORY_CONFIG[localPost.category]?.label || localPost.category}
									size="small"
									sx={{
										fontWeight: "bold",
										fontSize: "0.68rem",
										height: 20,
										borderRadius: 1,
										bgcolor: CATEGORY_CONFIG[localPost.category]?.bg || "rgba(0, 0, 0, 0.05)",
										color: CATEGORY_CONFIG[localPost.category]?.color || "text.secondary",
										border: "1px solid",
										borderColor: CATEGORY_CONFIG[localPost.category]?.border || "divider",
									}}
								/>
							)}
							<Typography
								variant="h6"
								fontWeight="bold"
								color="text.primary"
								sx={{ lineHeight: 1.2 }}
							>
								{localPost.title}
							</Typography>
						</Box>
						<Typography variant="caption" color="text.primary">
							<span
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										if (localPost.authorId) navigate(`/profile/${localPost.authorId}`);
									}
								}}
								onClick={() =>
									localPost.authorId && navigate(`/profile/${localPost.authorId}`)
								}
								style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
							>
								{localPost.authorName || "Unknown"}
								{localPost.authorBadges?.includes("top_contributor") && (
									<Chip 
										label="Top Contributor" 
										size="small" 
										icon={<span style={{ marginLeft: 4 }}>🏅</span>}
										sx={{ 
											height: 20, fontSize: '0.65rem', fontWeight: 'bold', 
											background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 100%)', 
											color: '#000', ml: 0.5 
										}} 
									/>
								)}
							</span>{" "}
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
					{(String(currentUserId) === String(localPost.authorId) ||
						currentUser?.role === "admin") && (
						<Box>
							<IconButton
								aria-label="More options"
								onClick={(e) => setAnchorEl(e.currentTarget)}
								size="small"
								sx={{ color: "text.primary" }}
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
								{String(currentUserId) === String(localPost.authorId) && (
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
								{currentUser?.role === "admin" && (
									<MenuItem
										onClick={() => {
											handleTogglePin();
											setAnchorEl(null);
										}}
										sx={{
											fontWeight: "bold",
											fontSize: "0.9rem",
											color: localPost.isPinned ? "warning.main" : "primary.main",
										}}
									>
										{localPost.isPinned ? "📍 Unpin Megathread" : "📌 Pin Megathread"}
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
							bgcolor: "action.hover",
							borderRadius: 3,
							border: "1px dashed",
							borderColor: "divider",
						}}
					>
						<TextField
							fullWidth
							size="small"
							label="Edit Title"
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							sx={{ mb: 2, bgcolor: "background.paper" }}
						/>
						<TextField
							fullWidth
							multiline
							minRows={3}
							label="Edit Details"
							value={editContent}
							onChange={(e) => setEditContent(e.target.value)}
							sx={{ mb: 2, bgcolor: "background.paper" }}
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
					<Box 
						onDoubleClick={handleDoubleTap}
						sx={{ 
							position: 'relative', 
							mb: 3, 
							cursor: 'pointer',
							userSelect: 'none' // Prevent text selection on rapid double clicking
						}}
					>
						
						{/* PLAYER MATCHMAKING BANNER */}
						{Boolean(localPost.playerMatchmaking || localPost.category === 'find_partner') && (
							<Paper
								variant="outlined"
								sx={{
									mb: 2,
									p: 2,
									borderRadius: 2.5,
									background: "linear-gradient(135deg, rgba(0, 150, 136, 0.05) 0%, rgba(76, 175, 80, 0.08) 100%)",
									border: "1px solid",
									borderColor: "rgba(0, 150, 136, 0.3)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
									pointerEvents: "auto",
								}}
							>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#00796b", display: "flex", alignItems: "center", gap: 0.5 }}>
											🤝 Player Matchmaking
										</Typography>
										{localPost.playerMatchmaking?.format && (
											<Chip label={localPost.playerMatchmaking.format} size="small" sx={{ fontSize: "0.7rem", height: 20, fontWeight: "bold" }} />
										)}
										{localPost.playerMatchmaking?.skillLevelRequired && (
											<Chip label={`Level: ${localPost.playerMatchmaking.skillLevelRequired}`} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
										)}
									</Box>
									<Chip
										label={localPost.playerMatchmaking?.isFilled ? "🔴 Rally Full" : `🟢 Need ${Math.max(0, (localPost.playerMatchmaking?.slotsNeeded || 1) - (localPost.playerMatchmaking?.rsvpList?.filter(r => r.status === 'confirmed').length || 0))} more`}
										size="small"
										color={localPost.playerMatchmaking?.isFilled ? "default" : "success"}
										sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22 }}
									/>
								</Box>

								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, my: 1, fontSize: "0.85rem", color: "text.secondary" }}>
									{localPost.playerMatchmaking?.preferredCourt && (
										<Typography variant="body2">
											<strong>Court:</strong> {localPost.playerMatchmaking.preferredCourt}
										</Typography>
									)}
									{localPost.playerMatchmaking?.timeWindow && (
										<Typography variant="body2">
											<strong>Time:</strong> {localPost.playerMatchmaking.timeWindow}
										</Typography>
									)}
								</Box>

								{/* RSVPs & 1-Tap Join Action */}
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5, pt: 1, borderTop: "1px dashed", borderColor: "divider", flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary" }}>
											Attendees ({localPost.playerMatchmaking?.rsvpList?.length || 0}):
										</Typography>
										{localPost.playerMatchmaking?.rsvpList?.length > 0 ? (
											<AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem' } }}>
												{localPost.playerMatchmaking.rsvpList.map((r, i) => (
													<Tooltip key={i} title={`${r.userName} (${r.status})`}>
														<Avatar src={r.avatarUrl} alt={r.userName}>{r.userName?.charAt(0)}</Avatar>
													</Tooltip>
												))}
											</AvatarGroup>
										) : (
											<Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
												Be the first to join!
											</Typography>
										)}
									</Box>

									{currentUser && (
										<Button
											size="small"
											variant={localPost.playerMatchmaking?.rsvpList?.some(r => String(r.userId) === String(currentUserId)) ? "outlined" : "contained"}
											color={localPost.playerMatchmaking?.rsvpList?.some(r => String(r.userId) === String(currentUserId)) ? "inherit" : "primary"}
											onClick={handleToggleRsvp}
											disabled={isRsvping}
											sx={{ borderRadius: 2, fontWeight: "bold", textTransform: "none", fontSize: "0.8rem", px: 2 }}
										>
											{localPost.playerMatchmaking?.rsvpList?.some(r => String(r.userId) === String(currentUserId))
												? "✓ You're In (Leave)"
												: "+ Join Rally (RSVP)"}
										</Button>
									)}
								</Box>
							</Paper>
						)}

						{/* MATCH CHALLENGE BANNER */}
						{Boolean(localPost.challengeMatch || localPost.category === 'challenge_match') && (
							<Paper
								variant="outlined"
								sx={{
									mb: 2,
									p: 2,
									borderRadius: 2.5,
									background: "linear-gradient(135deg, rgba(233, 30, 99, 0.05) 0%, rgba(156, 39, 176, 0.07) 100%)",
									border: "1px solid",
									borderColor: "rgba(233, 30, 99, 0.25)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
									pointerEvents: "auto",
								}}
							>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#c2185b", display: "flex", alignItems: "center", gap: 0.5 }}>
											⚔️ Match Challenge
										</Typography>
										{localPost.challengeMatch?.matchType && (
											<Chip label={localPost.challengeMatch.matchType} size="small" sx={{ fontSize: "0.7rem", height: 20, fontWeight: "bold" }} />
										)}
										{localPost.challengeMatch?.gameFormat && (
											<Chip label={localPost.challengeMatch.gameFormat} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
										)}
									</Box>
									<Chip
										label={localPost.challengeMatch?.matchStatus === 'accepted' ? 'Accepted' : 'Open Challenge'}
										size="small"
										color={localPost.challengeMatch?.matchStatus === 'accepted' ? 'success' : 'warning'}
										sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22 }}
									/>
								</Box>

								{localPost.challengeMatch?.stipulations && (
									<Typography variant="body2" sx={{ my: 0.5, fontStyle: "italic", color: "text.secondary" }}>
										<strong>Stipulations:</strong> "{localPost.challengeMatch.stipulations}"
									</Typography>
								)}

								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5, pt: 1, borderTop: "1px dashed", borderColor: "divider", flexWrap: "wrap", gap: 1 }}>
									<Typography variant="caption" color="text.secondary">
										{localPost.challengeMatch?.matchStatus === 'accepted'
											? `Accepted by ${localPost.challengeMatch?.acceptedBy?.map(a => a.userName).join(', ') || 'an opponent'}`
											: "Awaiting challenger response"}
									</Typography>

									{currentUser && String(localPost.authorId) !== String(currentUserId) && localPost.challengeMatch?.matchStatus === 'open' && (
										<Button
											size="small"
											variant="contained"
											color="secondary"
											onClick={handleAcceptChallenge}
											disabled={isAcceptingChallenge}
											sx={{ borderRadius: 2, fontWeight: "bold", textTransform: "none", fontSize: "0.8rem", px: 2 }}
										>
											⚔️ Accept Challenge
										</Button>
									)}
								</Box>
							</Paper>
						)}

						{/* Q&A FORUM BANNER */}
						{Boolean(localPost.qaDetails || localPost.category === 'qa_forum') && (
							<Paper
								variant="outlined"
								sx={{
									mb: 2,
									p: 2,
									borderRadius: 2.5,
									background: "linear-gradient(135deg, rgba(103, 58, 183, 0.05) 0%, rgba(33, 150, 243, 0.06) 100%)",
									border: "1px solid",
									borderColor: localPost.qaDetails?.isResolved ? "success.main" : "rgba(103, 58, 183, 0.25)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
									pointerEvents: "auto",
								}}
							>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#512da8", display: "flex", alignItems: "center", gap: 0.5 }}>
											💡 Badminton Q&A
										</Typography>
										{localPost.qaDetails?.subtopic && (
											<Chip label={localPost.qaDetails.subtopic} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
										)}
									</Box>
									{localPost.qaDetails?.isResolved ? (
										<Chip
											label="✅ Solution Accepted"
											size="small"
											color="success"
											sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22 }}
										/>
									) : (
										<Chip
											label="❓ Needs Answer"
											size="small"
											sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22, bgcolor: "action.hover" }}
										/>
									)}
								</Box>
							</Paper>
						)}

						{/* GEAR EXCHANGE BANNER */}
						{Boolean(localPost.gearDetails || localPost.category === 'gear_exchange' || localPost.category === 'gear_review') && localPost.gearDetails?.gearType && (
							<Paper
								variant="outlined"
								sx={{
									mb: 2,
									p: 2,
									borderRadius: 2.5,
									background: "linear-gradient(135deg, rgba(255, 87, 34, 0.05) 0%, rgba(255, 193, 7, 0.08) 100%)",
									border: "1px solid",
									borderColor: "rgba(255, 87, 34, 0.25)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
									pointerEvents: "auto",
								}}
							>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#d84315", display: "flex", alignItems: "center", gap: 0.5 }}>
											🏸 {localPost.gearDetails.gearType}{localPost.gearDetails.brand ? ` • ${localPost.gearDetails.brand}` : ""}
										</Typography>
										{localPost.gearDetails.condition && (
											<Chip label={`Condition: ${localPost.gearDetails.condition}`} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
										)}
									</Box>
									<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
										{localPost.gearDetails.tradeType && (
											<Chip label={localPost.gearDetails.tradeType} size="small" sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22 }} />
										)}
										{localPost.gearDetails.price > 0 && (
											<Chip label={"$" + localPost.gearDetails.price} size="small" color="primary" sx={{ fontWeight: "bold", fontSize: "0.72rem", height: 22 }} />
										)}
									</Box>
								</Box>

								{localPost.gearDetails.specs && (localPost.gearDetails.specs.weightCode || localPost.gearDetails.specs.gripSize || localPost.gearDetails.specs.balancePoint || localPost.gearDetails.specs.currentString) && (
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 1 }}>
										{localPost.gearDetails.specs.weightCode && <Chip label={localPost.gearDetails.specs.weightCode} size="small" sx={{ height: 20, fontSize: "0.7rem" }} />}
										{localPost.gearDetails.specs.gripSize && <Chip label={localPost.gearDetails.specs.gripSize} size="small" sx={{ height: 20, fontSize: "0.7rem" }} />}
										{localPost.gearDetails.specs.balancePoint && <Chip label={localPost.gearDetails.specs.balancePoint} size="small" sx={{ height: 20, fontSize: "0.7rem" }} />}
										{localPost.gearDetails.specs.currentString && <Chip label={`String: ${localPost.gearDetails.specs.currentString}`} size="small" sx={{ height: 20, fontSize: "0.7rem" }} />}
									</Box>
								)}
							</Paper>
						)}

						{/* MATCH SCORECARD BANNER */}
						{localPost.matchDetails && (localPost.matchDetails.score || localPost.matchDetails.partner || (localPost.matchDetails.opponents && (Array.isArray(localPost.matchDetails.opponents) ? localPost.matchDetails.opponents.length > 0 : Boolean(localPost.matchDetails.opponents))) || localPost.matchDetails.court || localPost.matchDetails.winner) && (
							<Paper
								variant="outlined"
								sx={{
									mb: 2,
									p: 2,
									borderRadius: 2.5,
									background: "linear-gradient(135deg, rgba(0, 102, 51, 0.04) 0%, rgba(255, 204, 51, 0.08) 100%)",
									border: "1px solid",
									borderColor: "rgba(0, 102, 51, 0.2)",
									boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
									pointerEvents: "auto",
								}}
							>
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
										<Typography variant="subtitle2" sx={{ fontWeight: "900", color: "primary.main", display: "flex", alignItems: "center", gap: 0.5 }}>
											🏸 Match Scorecard
										</Typography>
										{localPost.matchDetails.court && (
											<Chip label={`Court: ${localPost.matchDetails.court}`} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
										)}
									</Box>
									{localPost.matchDetails.winner && (
										<Chip
											label={`Winner: ${localPost.matchDetails.winner}`}
											size="small"
											color="success"
											sx={{ fontWeight: "bold", fontSize: "0.7rem", height: 20 }}
										/>
									)}
								</Box>

								{localPost.matchDetails.score && (
									<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, py: 0.5, px: 1, bgcolor: "background.paper", borderRadius: 1.5, border: "1px dashed", borderColor: "divider" }}>
										<Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
											Final Score:
										</Typography>
										<Typography variant="body1" sx={{ fontWeight: "900", letterSpacing: "1px", color: "text.primary" }}>
											{localPost.matchDetails.score}
										</Typography>
									</Box>
								)}

								<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, fontSize: "0.85rem" }}>
									<Typography variant="body2" color="text.secondary">
										<strong>Team / Partner:</strong> {localPost.matchDetails.partner ? `${localPost.authorName || "Player"} & ${localPost.matchDetails.partner}` : (localPost.authorName || "Player")}
									</Typography>
									{localPost.matchDetails.opponents && (Array.isArray(localPost.matchDetails.opponents) ? localPost.matchDetails.opponents.length > 0 : Boolean(localPost.matchDetails.opponents)) && (
										<Typography variant="body2" color="text.secondary">
											<strong>Opponents:</strong> {Array.isArray(localPost.matchDetails.opponents) ? localPost.matchDetails.opponents.join(", ") : localPost.matchDetails.opponents}
										</Typography>
									)}
								</Box>
							</Paper>
						)}

						<Typography
							variant="body1"
							color="text.primary"
							sx={{ whiteSpace: "pre-wrap", pointerEvents: 'none', mb: localPost.tags?.length ? 2 : 0 }}
						>
							{localPost.content}
						</Typography>

                        {localPost.tags && localPost.tags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1, pointerEvents: 'none' }}>
                                {localPost.tags.map(tag => (
                                    <Chip 
                                        key={tag} 
                                        label={tag} 
                                        size="small" 
                                        sx={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 'bold', 
                                            color: 'primary.main', 
                                            bgcolor: 'rgba(0, 102, 51, 0.1)' 
                                        }} 
                                    />
                                ))}
                            </Box>
                        )}

						{images.length === 1 && (
							<>
								<Box 
									role="button"
									tabIndex={0}
									aria-label="View post image in fullscreen preview"
									onClick={() => { setActiveLightboxIndex(0); setIsLightboxOpen(true); }}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setActiveLightboxIndex(0);
											setIsLightboxOpen(true);
										}
									}}
									sx={{ 
										mt: 2, borderRadius: 3, overflow: "hidden", maxHeight: 400, 
										cursor: "pointer", position: "relative",
										'&::after': {
											content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
											background: 'rgba(0,0,0,0)', transition: 'background 0.2s',
										},
										'&:hover::after': { background: 'rgba(0,0,0,0.1)' }
									}}
								>
									<img 
										src={images[0]} 
										alt="Post attachment" 
										style={{ width: "100%", height: "100%", objectFit: "cover" }} 
									/>
								</Box>
							</>
						)}

						{images.length > 1 && (
							<Box sx={{
								mt: 2, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 1, pb: 1,
								'&::-webkit-scrollbar': { height: 6 },
								'&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 3 }
							}}>
								{images.map((url, i) => (
									<Box 
										key={i}
										role="button"
										tabIndex={0}
										aria-label={`View post image ${i + 1} in fullscreen preview`}
										onClick={() => { setActiveLightboxIndex(i); setIsLightboxOpen(true); }}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setActiveLightboxIndex(i);
												setIsLightboxOpen(true);
											}
										}}
										sx={{ 
											scrollSnapAlign: 'center', width: '85%', flexShrink: 0,
											borderRadius: 3, overflow: "hidden", maxHeight: 400, cursor: "pointer", position: "relative",
											'&::after': {
												content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
												background: 'rgba(0,0,0,0)', transition: 'background 0.2s',
											},
											'&:hover::after': { background: 'rgba(0,0,0,0.1)' }
										}}
									>
										<img 
											src={url} 
											alt={`Post attachment ${i+1}`} 
											style={{ width: "100%", height: "100%", objectFit: "cover" }} 
										/>
									</Box>
								))}
							</Box>
						)}

						{images.length > 0 && (
							<MediaLightbox
								open={isLightboxOpen}
								onClose={() => setIsLightboxOpen(false)}
								images={images}
								initialIndex={activeLightboxIndex}
								title={localPost.title}
								authorName={localPost.authorName}
								authorPic={localPost.authorPic}
							/>
						)}

						{/* Animated Heart Overlay */}
						{showHeart && (
							<Box
								sx={{
									position: 'absolute',
									top: '50%',
									left: '50%',
									transform: 'translate(-50%, -50%)',
									color: 'secondary.main',
									animation: 'popAndFade 1s ease-out forwards',
									pointerEvents: 'none',
									zIndex: 10,
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center'
								}}
							>
								<ThumbUpFilled style={{ fontSize: '100px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }} />
							</Box>
						)}
					</Box>
				)}

				{/* STATS (Reactions, Likes & Comments counts) */}
				{(localPost.likedBy?.length > 0 || (localPost.reactions && localPost.reactions.length > 0) || totalCommentsCount > 0) && (
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							px: 1,
							mb: 1,
						}}
					>
						{/* REACTION CHIPS */}
						<Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
							{Object.entries(
								(localPost.reactions || []).reduce((acc, r) => {
									const emoji = typeof r === 'string' ? r : (r?.emoji || '');
									if (emoji) acc[emoji] = (acc[emoji] || 0) + 1;
									return acc;
								}, {})
							).map(([emoji, count]) => {
								const hasReactedWithThis = (localPost.reactions || []).some(
									(r) => r && String(r.userId) === String(currentUserId) && ((typeof r === 'string' ? r : r.emoji) === emoji)
								);
								const reactionMeta = BADMINTON_REACTIONS.find((b) => b.emoji === emoji);
								return (
									<Tooltip key={emoji} title={reactionMeta ? reactionMeta.tooltip : emoji} arrow>
										<Chip
											label={`${emoji} ${count}`}
											size="small"
											variant={hasReactedWithThis ? "filled" : "outlined"}
											color={hasReactedWithThis ? "primary" : "default"}
											onClick={() => handleReaction(emoji)}
											sx={{
												cursor: "pointer",
												fontWeight: "bold",
												fontSize: "0.75rem",
												height: 24,
												transition: "transform 0.15s ease",
												"&:hover": { transform: "scale(1.1)" },
											}}
										/>
									</Tooltip>
								);
							})}
						</Box>

						{/* LIKES & COMMENTS COUNTERS */}
						<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
							{totalCommentsCount > 0 && (
								<Typography
									role="button"
									tabIndex={0}
									variant="body2"
									color="text.primary"
									sx={{
										cursor: "pointer",
										"&:hover": { textDecoration: "underline" },
									}}
									onClick={() => setIsCommentModalOpen((prev) => !prev)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setIsCommentModalOpen((prev) => !prev);
										}
									}}
								>
									{totalCommentsCount}{" "}
									{totalCommentsCount === 1 ? "comment" : "comments"}
								</Typography>
							)}
							{localPost.likedBy?.length > 0 && (
								<Box
									role="button"
									tabIndex={0}
									aria-label="View users who liked this post"
									onClick={(e) =>
										openLikes(
											e,
											"Post Likes",
											localPost.likedByDetails,
										)
									}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											openLikes(
												e,
												"Post Likes",
												localPost.likedByDetails,
											);
										}
									}}
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 0.5,
										cursor: "pointer",
										"&:hover": { textDecoration: "underline" },
									}}
								>
									{(localPost.recentLikerAvatars?.length > 0 || localPost.likedByDetails?.length > 0) && (
										<AvatarGroup max={3} sx={{ mr: 0.5, '& .MuiAvatar-root': { width: 22, height: 22, fontSize: 10, border: '1px solid', borderColor: 'background.paper' } }}>
											{(localPost.likedByDetails || localPost.recentLikerAvatars || []).slice(0, 3).map((liker, i) => {
												const url = typeof liker === 'string' ? liker : liker.profilePic;
												if (!url) return null;
												return <Avatar key={i} src={url} alt="User Avatar" />;
											})}
										</AvatarGroup>
									)}
									<Typography
										variant="body2"
										color="text.primary"
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
					</Box>
				)}

				<Divider sx={{ mb: 1 }} />

				{/* ACTION BAR */}
				<CardActions
					sx={{
						p: 0,
						justifyContent: "space-between",
						color: "text.primary",
					}}
				>
					<Box 
						onMouseEnter={() => setShowReactions(true)} 
						onMouseLeave={() => setShowReactions(false)}
						onTouchStart={() => {
							touchTimer.current = setTimeout(() => setShowReactions(true), 400);
						}}
						onTouchEnd={() => {
							if (touchTimer.current) clearTimeout(touchTimer.current);
						}}
						sx={{ position: 'relative', flex: 1, display: 'flex' }}
					>
						{/* Floating Reaction Bar with Badminton Reaction Trio */}
						<Collapse in={showReactions} timeout="auto" unmountOnExit sx={{ position: 'absolute', bottom: '100%', left: 0, mb: 1, zIndex: 10 }}>
							<Paper elevation={6} sx={{ display: 'flex', gap: 0.5, p: 0.8, borderRadius: 10, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
								{BADMINTON_REACTIONS.map((item) => (
									<Tooltip key={item.type} title={item.tooltip} arrow>
										<IconButton 
											aria-label={`React with ${item.label}`}
											onClick={(e) => { 
												e.stopPropagation(); 
												handleReaction(item.emoji); 
											}}
											sx={{ 
												p: 0.8,
												transition: 'transform 0.15s ease', 
												'&:hover': { transform: 'scale(1.35)' } 
											}}
										>
											<Typography fontSize="1.3rem">{item.emoji}</Typography>
										</IconButton>
									</Tooltip>
								))}
							</Paper>
						</Collapse>

						<Button
							aria-label="React to post"
							onClick={() => {
								if (currentUserReaction) handleReaction(currentUserReaction);
								else handleReaction('💥');
							}}
							color={currentUserReaction || hasLiked ? "primary" : "inherit"}
							sx={actionBtnStyle}
						>
							<Box sx={{ mr: { xs: 0.5, sm: 1 }, display: "flex", alignItems: "center" }}>
								<Typography component="span" sx={{ fontSize: "1.1rem" }}>
									{currentUserReaction || '💥'}
								</Typography>
							</Box>
							<Box sx={{ display: { xs: "none", sm: "inline-block" } }}>
								{(() => {
									if (currentUserReaction) {
										const match = BADMINTON_REACTIONS.find((b) => b.emoji === currentUserReaction);
										return match ? match.label : "Reacted";
									}
									return "Smash";
								})()}
							</Box>
						</Button>
					</Box>

					{/* INLINE COMMENT ACCORDION TRIGGER */}
					<Button
						onClick={() => setIsCommentModalOpen((prev) => !prev)}
						color={isCommentModalOpen ? "primary" : "inherit"}
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
							Comment{totalCommentsCount > 0 ? ` (${totalCommentsCount})` : ""}
						</Box>
					</Button>

					{/* SHARE BUTTON */}
					<Button
						onClick={handleShare}
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

			{/* IMPORTED POST COMMENTS INLINE */}
			<Collapse in={isCommentModalOpen}>
				<PostCommentsInline
					localPost={localPost}
					setLocalPost={setLocalPost}
					currentUser={currentUser}
					highlightId={highlightId}
					openLikes={openLikes}
				/>
			</Collapse>

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
