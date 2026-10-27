// client/src/components/PostCard.jsx
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useMemo } from "react";
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
	Badge,
	IconButton,
	Menu,
	MenuItem,
	TextField,
	Collapse,
	Chip,
	Tooltip,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	FormControl,
	Select,
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
	find_partner: { label: "Find Players", bg: "rgba(0, 150, 136, 0.12)", color: "#00796b", border: "rgba(0, 150, 136, 0.3)" },
	challenge_match: { label: "Match Challenge", bg: "rgba(233, 30, 99, 0.12)", color: "#c2185b", border: "rgba(233, 30, 99, 0.3)" },
	qa_forum: { label: "Badminton Q&A", bg: "rgba(103, 58, 183, 0.12)", color: "#512da8", border: "rgba(103, 58, 183, 0.3)" },
	gear_exchange: { label: "Gear & Equipment", bg: "rgba(255, 87, 34, 0.12)", color: "#d84315", border: "rgba(255, 87, 34, 0.3)" },
};

// Separated Sub-Components
import LikesModal from "./LikesModal";
import PostCommentsInline from "./PostCommentsInline";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import MediaLightbox from "./MediaLightbox";

// In-memory cache for fetched comments to ensure instant re-rendering and prevent vanishing on re-renders
const postCommentsMemoryCache = new Map();
const hasPopulatedComments = (arr) =>
	Array.isArray(arr) && arr.length > 0 && arr.some((c) => c && (c._id || c.text || c.content));
import {
	ThumbUpFilled,
	MessageCircleIcon,
	ShareIcon,
	MoreVertIcon,
} from "./Icons";

// Facebook-style vibrant circular reaction icon badges
const renderFacebookReactionIcon = (emoji) => {
	switch (emoji) {
		case "💥":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #FF4B72 0%, #FA383E 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M10 2L11.8 6.5L16.5 5.5L13.5 9.5L17.5 13L12.5 13L12 17.5L9.5 13.5L4.5 15L7.5 11L3 8L8.2 8L10 2Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>💥</span>
				</Box>
			);
		case "🧊":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #1877F2 0%, #0084FF 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M10 3.5L15 6.4V11.6L10 14.5L5 11.6V6.4L10 3.5ZM10 5L6.5 7.1L10 9.1L13.5 7.1L10 5ZM6 8.1V11L9.5 13V10.1L6 8.1ZM14 8.1L10.5 10.1V13L14 11V8.1Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>🧊</span>
				</Box>
			);
		case "⚡":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #FFD93B 0%, #F7B125 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M11 2.5L5.5 10.5H10.5L9.5 16.5L15 8.5H10L11 2.5Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>⚡</span>
				</Box>
			);
		case "🏸":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #00C853 0%, #00A854 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M13.5 3.5C12 2 9.8 2 8.3 3.5C7.2 4.6 6.9 6.2 7.4 7.5L3.5 11.4C3.2 11.7 3.2 12.3 3.5 12.6L4.4 13.5C4.7 13.8 5.3 13.8 5.6 13.5L9.5 9.6C10.8 10.1 12.4 9.8 13.5 8.7C15 7.2 15 5 13.5 3.5ZM12.4 7.6C11.5 8.5 10.1 8.5 9.2 7.6C8.3 6.7 8.3 5.3 9.2 4.4C10.1 3.5 11.5 3.5 12.4 4.4C13.3 5.3 13.3 6.7 12.4 7.6Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>🏸</span>
				</Box>
			);
		case "🔥":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #FF6F00 0%, #FF3D00 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M10 2.5C9.8 4 8.5 5.5 7.5 6.8C6.3 8.3 5.5 9.8 5.5 11.5C5.5 14 7.5 16 10 16C12.5 16 14.5 14 14.5 11.5C14.5 9 13 7 11.8 5.5C11 4.5 10.3 3.3 10 2.5ZM10 14C8.9 14 8 13.1 8 12C8 10.8 8.8 10.8 9.5 9.8C9.8 8.4 10.2 8 10.5 7.5C10.8 8.5 11.5 9.5 11.8 10.2C12 10.8 12 11.4 12 12C12 13.1 11.1 14 10 14Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>🔥</span>
				</Box>
			);
		case "👍":
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #2D88FF 0%, #0E56D8 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					<svg viewBox="0 0 20 20" width="13" height="13" fill="none">
						<path
							d="M6.5 13.5H4.5V8.5H6.5V13.5ZM14.5 8.8C14.5 8.1 13.9 7.5 13.2 7.5H10.2L10.7 5.2C10.8 4.6 10.2 3.9 9.5 3.9C9.1 3.9 8.8 4.1 8.6 4.3L6.5 7.5V13.5H12.4C13 13.5 13.5 13.1 13.6 12.5L14.5 8.8Z"
							fill="#FFFFFF"
						/>
					</svg>
					<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>👍</span>
				</Box>
			);
		default:
			return (
				<Box
					sx={{
						width: 20,
						height: 20,
						borderRadius: "50%",
						background: "linear-gradient(135deg, #00A3FF 0%, #0066FF 100%)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "0.75rem",
						boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
					}}
				>
					{emoji}
				</Box>
			);
	}
};

// eslint-disable-next-line no-unused-vars
export default function PostCard({ post, isBookmarked, onBookmarkToggle, currentUser: propUser, compact = false, isAuthorOnline = false }) {
	const navigate = useNavigate();
	const currentUser = propUser || (typeof window !== "undefined" && localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null);
	const currentUserId = currentUser?.id || currentUser?._id;
    const controls = useAnimation();
	const touchTimer = useRef(null);

	const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);
	const [localPost, setLocalPost] = useState(post);
	const isAuthor = Boolean(localPost?.authorId && currentUserId && String(localPost.authorId) === String(currentUserId));

	const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
	const [reportReason, setReportReason] = useState("spam_advertising");
	const [reportDetails, setReportDetails] = useState("");
	const [isSubmittingReport, setIsSubmittingReport] = useState(false);
	const [hasReportedPost, setHasReportedPost] = useState(false);

	const handleSubmitReport = async () => {
		if (!currentUser) return;
		setIsSubmittingReport(true);
		try {
			const res = await apiFetch(`/api/forum/${localPost._id}/report`, {
				method: "POST",
				body: JSON.stringify({
					reason: reportReason,
					details: reportDetails,
				}),
			});
			const data = await res?.json().catch(() => ({}));
			if (res && res.ok) {
				toast.success("Report submitted. Thank you for keeping the community safe.");
				setHasReportedPost(true);
				setIsReportDialogOpen(false);
				setReportDetails("");
			} else {
				toast.error(data?.message || "Failed to submit report.");
			}
		} catch {
			toast.error("Network error submitting report.");
		} finally {
			setIsSubmittingReport(false);
		}
	};

	const [likesModal, setLikesModal] = useState({
		open: false,
		title: "",
		list: [],
		reactions: [],
		initialTab: "all",
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
		setLocalPost((prev) => {
			const prevReal = hasPopulatedComments(prev?.comments);
			const incomingReal = hasPopulatedComments(post?.comments);
			const cached = postCommentsMemoryCache.get(post?._id);
			const cachedReal = hasPopulatedComments(cached);

			let comments = post.comments;
			if (incomingReal) {
				comments = post.comments;
				postCommentsMemoryCache.set(post._id, post.comments);
			} else if (prevReal && prev?._id === post?._id) {
				comments = prev.comments;
			} else if (cachedReal) {
				comments = cached;
			}

			return {
				...post,
				comments,
			};
		});
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
			// Instant 0ms cache seed for rapid rendering without disappearance
			const cached = postCommentsMemoryCache.get(localPost._id);
			if (hasPopulatedComments(cached)) {
				// eslint-disable-next-line react-hooks/set-state-in-effect
				setLocalPost(prev => (hasPopulatedComments(prev?.comments) ? prev : { ...prev, comments: cached }));
			}

			apiFetch("/api/forum/" + localPost._id + "/comments")
			.then(res => res.json())
			.then(data => {
				if (data.comments) {
					postCommentsMemoryCache.set(localPost._id, data.comments);
					setLocalPost(prev => ({ ...prev, comments: data.comments }));
				}
			})
			.catch(err => console.error("Error fetching comments:", err));
		}
	}, [isCommentModalOpen, localPost._id]);
	const totalCommentsCount =
		hasPopulatedComments(localPost.comments)
			? localPost.comments.reduce(
					(acc, c) => acc + (c && (c._id || c.text || c.content) ? 1 + (c.replies?.length || 0) : 0),
					0,
				)
			: (typeof localPost.commentCount === 'number'
				? localPost.commentCount
				: (Array.isArray(localPost.comments) ? localPost.comments.length : 0));
	const hasLiked = localPost.likedBy?.includes(currentUserId);
	const currentUserReaction = (localPost.reactions || []).find(
		(r) => r && String(r.userId) === String(currentUserId)
	)?.emoji;

	const totalReactionsCount = localPost.reactions?.length || 0;
	const distinctReactionEmojis = useMemo(() => {
		const emojis = [];
		const seen = new Set();
		(localPost.reactions || []).forEach((r) => {
			const emoji = typeof r === 'string' ? r : r?.emoji;
			if (emoji && !seen.has(emoji)) {
				seen.add(emoji);
				emojis.push(emoji);
			}
		});
		return emojis;
	}, [localPost.reactions]);

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

	const openLikes = (e, title, list = [], reactions = [], initialTab = "all") => {
		e?.stopPropagation();
		if ((list && list.length > 0) || (reactions && reactions.length > 0)) {
			setLikesModal({ open: true, title, list: list || [], reactions: reactions || [], initialTab });
		}
	};

	const handleLike = async () => {
		const targetPostId = localPost._id || localPost.referenceId;
		if (!currentUser) return alert("You must be logged in to like posts!");
		if (isLiking) return;

		setIsLiking(true);
		try {
			const res = await apiFetch(`/api/forum/${targetPostId}/like`, {
				method: "PUT",
				body: JSON.stringify({
					userId: currentUserId,
					userName: currentUser.name,
				}),
			});
			if (res && res.ok) {
				const updated = await res.json();
				setLocalPost(prev => ({ ...prev, ...updated, _id: prev._id }));
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsLiking(false);
		}
	};

	const handleReaction = async (emoji) => {
		const targetPostId = localPost._id || localPost.referenceId;
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
			const res = await apiFetch(`/api/forum/${targetPostId}/react`, {
				method: "PUT",
				body: JSON.stringify({ emoji }),
			});
			if (res && res.ok) {
				const updated = await res.json();
				if (updated && (updated._id || updated.referenceId)) {
					setLocalPost(prev => ({ ...prev, ...updated, _id: prev._id, reactions: updated.reactions || prev.reactions }));
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
		e?.stopPropagation();
		const shareUrl = `${window.location.origin}/community#post-${localPost._id}`;
		if (navigator.share && (typeof navigator.canShare !== "function" || navigator.canShare({ url: shareUrl }))) {
			try {
				await navigator.share({
					title: localPost.title || "Mason Badminton Connect",
					text: `Check out "${localPost.title}" by ${localPost.authorName || 'a club member'} on GMU Badminton Connect!`,
					url: shareUrl,
				});
				toast.success("Shared successfully! 🏸");
				return;
			} catch (err) {
				if (err.name === "AbortError") return;
			}
		}
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
		fontSize: { xs: "0.8rem", sm: "0.875rem" },
		py: { xs: 0.8, sm: 1 },
		minHeight: 44,
		flex: 1,
		minWidth: 0,
		borderRadius: 2,
		transition: "all 0.1s ease",
		"&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
		"&:active": { transform: "scale(0.95)" },
	};
	const images = localPost.imageUrls?.length > 0
		? localPost.imageUrls
		: (localPost.mediaUrls?.length > 0
			? localPost.mediaUrls
			: (localPost.imageUrl ? [localPost.imageUrl] : []));
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
				data-testid={compact ? "post-card-compact" : "post-card-comfortable"}
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
					p: compact ? { xs: 1.5, sm: 2 } : { xs: 2, sm: 2.75 },
					border: localPost.isPinned ? "2px solid" : "1px solid",
					borderColor: localPost.isPinned ? "warning.main" : "divider",
					borderRadius: compact ? { xs: 2, sm: 3 } : { xs: 2.5, sm: 3.5 },
					userSelect: "none",
					bgcolor: 'background.paper',
					backgroundImage: localPost.isPinned 
						? 'linear-gradient(to bottom right, rgba(255, 179, 0, 0.08), rgba(0, 102, 51, 0.04))' 
						: 'linear-gradient(to bottom right, rgba(255,255,255,0.05), rgba(0,0,0,0.01))',
					backdropFilter: 'blur(10px)',
					boxShadow: localPost.isPinned ? '0 8px 24px rgba(255, 165, 0, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					"&:hover": {
						borderColor: localPost.isPinned ? "warning.dark" : "primary.light",
						boxShadow: localPost.isPinned ? "0 14px 32px rgba(255, 165, 0, 0.22)" : "0 10px 24px rgba(0, 102, 51, 0.1)",
						transform: "translateY(-3px)",
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
					<Badge
						overlap="circular"
						anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
						variant="dot"
						invisible={!isAuthorOnline}
						data-testid={isAuthorOnline ? "author-online-indicator" : undefined}
						sx={{
							'& .MuiBadge-badge': {
								backgroundColor: '#44b700',
								color: '#44b700',
								boxShadow: '0 0 0 2px #fff',
								'&::after': {
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									borderRadius: '50%',
									animation: 'onlineRipple 1.4s infinite ease-in-out',
									border: '1px solid currentColor',
									content: '""',
								},
							},
							'@keyframes onlineRipple': {
								'0%': { transform: 'scale(.8)', opacity: 1 },
								'100%': { transform: 'scale(2.4)', opacity: 0 },
							},
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
								width: compact ? 34 : 42,
								height: compact ? 34 : 42,
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
					</Badge>
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
								variant={compact ? "subtitle1" : "h6"}
								fontWeight="bold"
								color="text.primary"
								sx={{ 
									lineHeight: 1.25,
									display: (localPost.title && localPost.content && localPost.title.trim().toLowerCase() === localPost.content.trim().toLowerCase()) ? 'none' : 'block'
								}}
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
								{localPost.authorRole === "admin" && (
									<Chip
										label="Club Exec"
										size="small"
										sx={{
											height: 20,
											fontSize: "0.65rem",
											fontWeight: "bold",
											bgcolor: "secondary.main",
											color: "secondary.contrastText",
											borderRadius: 1,
											ml: 0.5,
										}}
									/>
								)}
								{localPost.authorStreak > 0 && (
									<Chip
										label={`⚡ ${localPost.authorStreak} Streak`}
										size="small"
										sx={{
											height: 20,
											fontSize: "0.65rem",
											fontWeight: "bold",
											bgcolor: "warning.main",
											color: "#000",
											borderRadius: 1,
											ml: 0.5,
										}}
									/>
								)}
								{(hasReportedPost || localPost.reports?.some(r => String(r.reportedBy?._id || r.reportedBy) === String(currentUserId))) && (
									<Chip
										label="Reported"
										size="small"
										variant="outlined"
										color="warning"
										sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1, ml: 0.5 }}
									/>
								)}
								{localPost.authorBadges?.includes("smash_master") && (
									<Chip 
										data-testid="badge-smash-master"
										label="Smash Master" 
										size="small" 
										icon={<span style={{ marginLeft: 4 }}>🏸</span>}
										sx={{ 
											height: 20, fontSize: '0.65rem', fontWeight: 'bold', 
											bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', 
											border: '1px solid rgba(239, 68, 68, 0.3)', ml: 0.5 
										}} 
									/>
								)}
								{localPost.authorBadges?.includes("clutch_performer") && (
									<Chip 
										data-testid="badge-clutch-performer"
										label="Clutch Performer" 
										size="small" 
										icon={<span style={{ marginLeft: 4 }}>⚡</span>}
										sx={{ 
											height: 20, fontSize: '0.65rem', fontWeight: 'bold', 
											bgcolor: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', 
											border: '1px solid rgba(234, 179, 8, 0.3)', ml: 0.5 
										}} 
									/>
								)}
								{localPost.authorBadges?.includes("community_guide") && (
									<Chip 
										data-testid="badge-community-guide"
										label="Community Guide" 
										size="small" 
										icon={<span style={{ marginLeft: 4 }}>🌟</span>}
										sx={{ 
											height: 20, fontSize: '0.65rem', fontWeight: 'bold', 
											bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#059669', 
											border: '1px solid rgba(16, 185, 129, 0.3)', ml: 0.5 
										}} 
									/>
								)}
								{/* Top Contributor Badge - disabled/commented out per UI content standards
								localPost.authorBadges?.includes("top_contributor") && (
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
								)
								*/}
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
					{Boolean(currentUser) && (
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
								{(String(currentUserId) === String(localPost.authorId) || currentUser?.role === "admin") && (
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
								)}
								<MenuItem
									onClick={(e) => {
										handleShare(e);
										setAnchorEl(null);
									}}
									sx={{ fontWeight: "bold", fontSize: "0.9rem" }}
								>
									🔗 Share Post
								</MenuItem>
								{String(currentUserId) !== String(localPost.authorId) && (
									<MenuItem
										onClick={() => {
											setIsReportDialogOpen(true);
											setAnchorEl(null);
										}}
										sx={{
											fontWeight: "bold",
											fontSize: "0.9rem",
											color: "error.main",
										}}
									>
										🚩 Report Post
									</MenuItem>
								)}
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
						
						{/* PLAYER MATCHMAKING BANNER - ONLY on Find Partner / Rally posts */}
						{Boolean((localPost.category === 'find_partner' || localPost.category === 'meetup_rally') && localPost.playerMatchmaking && (localPost.playerMatchmaking.isEnabled || localPost.playerMatchmaking.timeWindow || (localPost.playerMatchmaking.rsvpList && localPost.playerMatchmaking.rsvpList.length > 0) || localPost.playerMatchmaking.isFilled || localPost.playerMatchmaking.preferredCourt)) && (
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

									{currentUser && !isAuthor && (
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
									{isAuthor && localPost.playerMatchmaking?.rsvpList?.some(r => String(r.userId) === String(currentUserId)) && (
										<Button
											size="small"
											variant="outlined"
											color="warning"
											onClick={handleToggleRsvp}
											disabled={isRsvping}
											sx={{ borderRadius: 2, fontWeight: "bold", textTransform: "none", fontSize: "0.8rem", px: 2 }}
										>
											Leave Rally (Host)
										</Button>
									)}
									{isAuthor && !localPost.playerMatchmaking?.rsvpList?.some(r => String(r.userId) === String(currentUserId)) && (
										<Chip
											label="👑 Host"
											size="small"
											color="primary"
											variant="outlined"
											sx={{ fontWeight: "bold", fontSize: "0.75rem", height: 24 }}
										/>
									)}
								</Box>
							</Paper>
						)}

						{/* MATCH CHALLENGE BANNER - ONLY on Challenge Match posts */}
						{Boolean(localPost.category === 'challenge_match' && localPost.challengeMatch) && (
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

						{/* Q&A FORUM BANNER - ONLY on Q&A posts */}
						{Boolean(localPost.category === 'qa_forum' && localPost.qaDetails) && (
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

						{/* GEAR EXCHANGE BANNER - ONLY on Gear posts */}
						{Boolean((localPost.category === 'gear_exchange' || localPost.category === 'gear_review') && localPost.gearDetails && (localPost.gearDetails.isEnabled || localPost.gearDetails.brand || localPost.gearDetails.price > 0 || localPost.gearDetails.specs?.currentString || localPost.gearDetails.specs?.weightCode)) && (
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

						{/* MATCH SCORECARD BANNER - ONLY on Match Result posts */}
						{Boolean(localPost.category === 'match_result' && localPost.matchDetails && (localPost.matchDetails.score || localPost.matchDetails.partner || (localPost.matchDetails.opponents && (Array.isArray(localPost.matchDetails.opponents) ? localPost.matchDetails.opponents.length > 0 : Boolean(localPost.matchDetails.opponents))) || localPost.matchDetails.court || localPost.matchDetails.winner)) && (
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
							sx={{ 
								whiteSpace: "pre-wrap", 
								pointerEvents: 'none', 
								lineHeight: 1.6,
								fontSize: { xs: '0.92rem', sm: '1rem' },
								mb: localPost.tags?.length ? 2 : 0, 
								...(compact ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) 
							}}
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
							<Box 
								data-testid="collage-grid-1"
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
									mt: 2, borderRadius: 3, overflow: "hidden", maxHeight: 420, 
									cursor: "pointer", position: "relative",
									'&:hover img': { transform: 'scale(1.02)' }
								}}
							>
								<img 
									src={images[0]} 
									alt="Post attachment" 
									style={{ width: "100%", height: "100%", maxHeight: 420, objectFit: "cover", transition: "transform 0.3s ease" }} 
								/>
							</Box>
						)}

						{images.length === 2 && (
							<Box 
								data-testid="collage-grid-2"
								sx={{ 
									mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, 
									borderRadius: 3, overflow: "hidden", height: { xs: 200, sm: 260 } 
								}}
							>
								{images.slice(0, 2).map((url, i) => (
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
										sx={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer', position: 'relative', '&:hover img': { transform: 'scale(1.03)' } }}
									>
										<img src={url} alt={`Post attachment ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
									</Box>
								))}
							</Box>
						)}

						{images.length === 3 && (
							<Box 
								data-testid="collage-grid-3"
								sx={{ 
									mt: 2, display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, 
									borderRadius: 3, overflow: "hidden", height: { xs: 220, sm: 300 } 
								}}
							>
								<Box 
									role="button"
									tabIndex={0}
									aria-label="View post image 1 in fullscreen preview"
									onClick={() => { setActiveLightboxIndex(0); setIsLightboxOpen(true); }}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setActiveLightboxIndex(0);
											setIsLightboxOpen(true);
										}
									}}
									sx={{ gridRow: 'span 2', width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer', '&:hover img': { transform: 'scale(1.03)' } }}
								>
									<img src={images[0]} alt="Post attachment 1" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
								</Box>
								{images.slice(1, 3).map((url, i) => (
									<Box 
										key={i + 1}
										role="button"
										tabIndex={0}
										aria-label={`View post image ${i + 2} in fullscreen preview`}
										onClick={() => { setActiveLightboxIndex(i + 1); setIsLightboxOpen(true); }}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setActiveLightboxIndex(i + 1);
												setIsLightboxOpen(true);
											}
										}}
										sx={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer', '&:hover img': { transform: 'scale(1.03)' } }}
									>
										<img src={url} alt={`Post attachment ${i + 2}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
									</Box>
								))}
							</Box>
						)}

						{images.length >= 4 && (
							<Box 
								data-testid="collage-grid-4"
								sx={{ 
									mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, 
									borderRadius: 3, overflow: "hidden", height: { xs: 240, sm: 320 } 
								}}
							>
								{images.slice(0, 4).map((url, i) => {
									const isFourth = i === 3;
									const extraCount = images.length - 4;
									return (
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
											sx={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'pointer', position: 'relative', '&:hover img': { transform: 'scale(1.03)' } }}
										>
											<img src={url} alt={`Post attachment ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
											{isFourth && extraCount > 0 && (
												<Box 
													sx={{ 
														position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
														bgcolor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(3px)',
														display: 'flex', alignItems: 'center', justifyContent: 'center',
														color: 'white', fontWeight: 900, fontSize: '1.4rem' 
													}}
												>
													+{extraCount} more
												</Box>
											)}
										</Box>
									);
								})}
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

				{/* STATS (Facebook-style Reactions & Comments Summary) */}
				{(totalReactionsCount > 0 || totalCommentsCount > 0) && (
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							px: 1,
							mb: 1,
						}}
					>
						{/* Facebook-style Reactions Cluster & Single Total Number */}
						{totalReactionsCount > 0 ? (
							<Box
								role="button"
								tabIndex={0}
								data-testid="view-reactions-btn"
								aria-label={`View ${totalReactionsCount} reactions`}
								onClick={(e) =>
									openLikes(
										e,
										"Post Reactions",
										[],
										localPost.reactions,
										"all"
									)
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										openLikes(
											e,
											"Post Reactions",
											[],
											localPost.reactions,
											"all"
										);
									}
								}}
								sx={{
									display: "inline-flex",
									alignItems: "center",
									gap: 0.75,
									cursor: "pointer",
									py: 0.3,
									px: 0.5,
									borderRadius: 4,
									userSelect: "none",
									"&:hover": {
										"& .reaction-count-total": {
											textDecoration: "underline",
										},
									},
								}}
							>
								{/* Overlapping distinct Facebook-style reaction badges */}
								<Box sx={{ display: "inline-flex", alignItems: "center" }}>
									{distinctReactionEmojis.slice(0, 3).map((emoji, index) => (
										<Box
											key={emoji}
											component="span"
											onClick={(e) => {
												e.stopPropagation();
												let tab = "all";
												if (emoji === "💥") tab = "smash";
												else if (emoji === "🧊") tab = "ice_drop";
												else if (emoji === "⚡") tab = "clutch";
												openLikes(
													e,
													"Post Reactions",
													[],
													localPost.reactions,
													tab
												);
											}}
											sx={{
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												position: "relative",
												borderRadius: "50%",
												border: (theme) => `2px solid ${theme.palette.mode === "dark" ? "#061a14" : "#ffffff"}`,
												ml: index > 0 ? "-6px" : 0,
												zIndex: 3 - index,
												boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
												transition: "transform 0.15s ease",
												"&:hover": {
													transform: "scale(1.25)",
													zIndex: 10,
												},
											}}
										>
											{renderFacebookReactionIcon(emoji)}
										</Box>
									))}
								</Box>

								{/* Only a single number total for those reactions */}
								<Typography
									className="reaction-count-total"
									variant="body2"
									color="text.secondary"
									sx={{
										fontSize: "0.85rem",
										fontWeight: 600,
										lineHeight: 1,
									}}
								>
									{totalReactionsCount}
								</Typography>
							</Box>
						) : (
							<Box />
						)}

						{/* COMMENTS COUNT */}
						{totalCommentsCount > 0 && (
							<Typography
								role="button"
								tabIndex={0}
								variant="body2"
								color="text.secondary"
								sx={{
									cursor: "pointer",
									fontSize: "0.85rem",
									fontWeight: 500,
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
							<Box sx={{ display: "inline-block", fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
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
							sx={{ display: "inline-block", fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
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
							sx={{ display: "inline-block", fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
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
				reactions={likesModal.reactions}
				initialTab={likesModal.initialTab}
				onClose={() =>
					setLikesModal({ open: false, title: "", list: [], reactions: [], initialTab: "all" })
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

			{/* REPORT POST DIALOG */}
			<Dialog
				open={isReportDialogOpen}
				onClose={() => setIsReportDialogOpen(false)}
				maxWidth="xs"
				fullWidth
				slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
			>
				<DialogTitle sx={{ fontWeight: "bold", pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
					<span style={{ fontSize: "1.2rem" }}>🚩</span> Report Community Post
				</DialogTitle>
				<DialogContent>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Help keep our badminton community safe, fair, and welcoming. Please select the primary reason for reporting this post.
					</Typography>
					<FormControl fullWidth size="small" sx={{ mb: 2 }}>
						<Select
							value={reportReason}
							onChange={(e) => setReportReason(e.target.value)}
							sx={{ borderRadius: 2 }}
							inputProps={{ "aria-label": "Select report reason" }}
						>
							<MenuItem value="spam_advertising">Spam, advertising, or unsolicited promotion</MenuItem>
							<MenuItem value="harassment_toxicity">Harassment, hate speech, or toxic conduct</MenuItem>
							<MenuItem value="misinformation">False match score or deceptive tournament info</MenuItem>
							<MenuItem value="inappropriate_content">Inappropriate, vulgar, or offensive media</MenuItem>
							<MenuItem value="other">Other community guideline violation</MenuItem>
						</Select>
					</FormControl>
					<TextField
						fullWidth
						size="small"
						multiline
						rows={3}
						placeholder="Additional context or details (optional)..."
						value={reportDetails}
						onChange={(e) => setReportDetails(e.target.value)}
						slotProps={{ htmlInput: { "aria-label": "Additional report details" } }}
						sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
					/>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button
						onClick={() => setIsReportDialogOpen(false)}
						sx={{ borderRadius: 2, textTransform: "none", color: "text.secondary" }}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						color="error"
						onClick={handleSubmitReport}
						disabled={isSubmittingReport}
						sx={{ borderRadius: 2, textTransform: "none", fontWeight: "bold" }}
					>
						{isSubmittingReport ? "Submitting..." : "Submit Report"}
					</Button>
				</DialogActions>
			</Dialog>

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
