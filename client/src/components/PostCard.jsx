// client/src/components/PostCard.jsx
// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import socket from "../utils/socket";
import apiFetch from "../utils/api";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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

// Facebook Reactions & Legacy Compatibility
import {
	FACEBOOK_REACTIONS,
	getReactionMeta,
	normalizeReactionEmoji,
} from "../constants/reactions";

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
import ShareModal from "./ShareModal";

// In-memory cache for fetched comments to ensure instant re-rendering and prevent vanishing on re-renders
const postCommentsMemoryCache = new Map();
const hasPopulatedComments = (arr) =>
	Array.isArray(arr) && arr.length > 0 && arr.some((c) => c && (c._id || c.text || c.content));
import {
	ThumbUpOutline,
	ThumbUpFilled,
	MessageCircleIcon,
	ShareIcon,
	MoreVertIcon,
} from "./Icons";
import {
	FacebookReactionIcon,
} from "./FacebookReactionTokens";

// J6 Audience Privacy Indicator Icon
const renderPrivacyIcon = (visibility) => {
	switch (visibility) {
		case "ONLY_ME":
			return (
				<Tooltip title="Only Me" arrow placement="top">
					<Box
						component="span"
						data-testid="post-privacy-icon"
						aria-label="Privacy: Only Me"
						sx={{ display: "inline-flex", alignItems: "center", ml: 0.75, color: "text.secondary", verticalAlign: "middle" }}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</Box>
				</Tooltip>
			);
		case "FRIENDS_ONLY":
			return (
				<Tooltip title="Friends Only" arrow placement="top">
					<Box
						component="span"
						data-testid="post-privacy-icon"
						aria-label="Privacy: Friends Only"
						sx={{ display: "inline-flex", alignItems: "center", ml: 0.75, color: "text.secondary", verticalAlign: "middle" }}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
							<path d="M16 3.13a4 4 0 0 1 0 7.75" />
						</svg>
					</Box>
				</Tooltip>
			);
		case "PUBLIC":
		default:
			return (
				<Tooltip title="Public" arrow placement="top">
					<Box
						component="span"
						data-testid="post-privacy-icon"
						aria-label="Privacy: Public"
						sx={{ display: "inline-flex", alignItems: "center", ml: 0.75, color: "text.secondary", verticalAlign: "middle" }}
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<circle cx="12" cy="12" r="10" />
							<line x1="2" y1="12" x2="22" y2="12" />
							<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
						</svg>
					</Box>
				</Tooltip>
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
	const hoverTimer = useRef(null);
	const leaveTimer = useRef(null);

	const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);
	const [isShareModalOpen, setIsShareModalOpen] = useState(false);
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

	const location = useLocation();
	const urlParams = useMemo(() => {
		const searchStr = location?.search || (typeof window !== "undefined" ? window.location.search : "");
		return new URLSearchParams(searchStr);
	}, [location?.search]);
	const hash = location?.hash || (typeof window !== "undefined" ? window.location.hash : "") || "";
	const hashCommentId = hash.startsWith("#comment-") ? hash.replace("#comment-", "") : null;
	const highlightId = urlParams.get("highlight") || urlParams.get("commentId") || hashCommentId;
	const { postId: routePostId } = useParams();
	const urlPostId = urlParams.get("postId") || routePostId;
	const highlightHandledRef = useRef(null);

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

		const handleReactionUpdated = (payload) => {
			const targetId = String(localPost._id || localPost.referenceId || "");
			if (payload && targetId && String(payload.postId) === targetId) {
				setLocalPost(prev => ({
					...prev,
					reactions: payload.reactions || prev.reactions,
				}));
			}
		};

		socket.on("postUpdated", handlePostUpdated);
		socket.on("reactionUpdated", handleReactionUpdated);
		return () => {
			socket.off("postUpdated", handlePostUpdated);
			socket.off("reactionUpdated", handleReactionUpdated);
		};
	}, [localPost._id, localPost.referenceId]);

	useEffect(() => {
		const isTargetPost = urlPostId === localPost._id;
		const containsComment = highlightId && localPost?.comments?.some((c) => String(c?._id || c?.id) === String(highlightId));
		if (isTargetPost || containsComment) {
			const actionKey = `${localPost._id}_${urlPostId || ''}_${highlightId || ''}`;
			if (highlightHandledRef.current === actionKey) {
				return;
			}
			highlightHandledRef.current = actionKey;

			// eslint-disable-next-line react-hooks/set-state-in-effect
			if (highlightId) setIsCommentModalOpen(true);
			setTimeout(() => {
				document
					.getElementById(`post-${localPost._id}`)
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 300);
		}
	}, [urlPostId, highlightId, localPost._id, localPost.comments]);

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
	const currentUserReaction = (localPost.reactions || []).find(
		(r) => r && String(r.userId) === String(currentUserId)
	)?.emoji;

	const totalReactionsCount = localPost.reactions?.length || 0;
	const distinctReactionEmojis = useMemo(() => {
		const emojis = [];
		const seen = new Set();
		(localPost.reactions || []).forEach((r) => {
			const rawEmoji = typeof r === 'string' ? r : r?.emoji;
			const emoji = normalizeReactionEmoji(rawEmoji);
			if (emoji && !seen.has(emoji)) {
				seen.add(emoji);
				emojis.push(emoji);
			}
		});
		return emojis;
	}, [localPost.reactions]);

	const [showHeart, setShowHeart] = useState(false);
	const [showReactions, setShowReactions] = useState(false);

	const handleReactionBoxMouseEnter = () => {
		if (leaveTimer.current) {
			clearTimeout(leaveTimer.current);
			leaveTimer.current = null;
		}
		hoverTimer.current = setTimeout(() => {
			setShowReactions(true);
		}, 320);
	};

	const handleReactionBoxMouseLeave = () => {
		if (hoverTimer.current) {
			clearTimeout(hoverTimer.current);
			hoverTimer.current = null;
		}
		leaveTimer.current = setTimeout(() => {
			setShowReactions(false);
		}, 250);
	};

	useEffect(() => {
		return () => {
			if (hoverTimer.current) clearTimeout(hoverTimer.current);
			if (leaveTimer.current) clearTimeout(leaveTimer.current);
			if (touchTimer.current) clearTimeout(touchTimer.current);
		};
	}, []);

	const handleDoubleTap = (e) => {
		e.preventDefault();
		if (!currentUserReaction) {
			handleReaction('❤️');
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
			(r) => r && String(r.userId || r._id || r.id) === String(currentUserId)
		);
		let updatedReactions = [...prevReactions];
		const reactionMeta = getReactionMeta(emoji);
		if (existingIndex > -1) {
			if (prevReactions[existingIndex].emoji === emoji) {
				// Same emoji -> toggle off
				updatedReactions.splice(existingIndex, 1);
			} else {
				// Different emoji -> switch reaction
				updatedReactions[existingIndex] = {
					...updatedReactions[existingIndex],
					emoji,
					reactionType: reactionMeta?.type || "custom",
				};
			}
		} else {
			// New reaction
			updatedReactions.push({
				userId: currentUserId,
				userName: currentUser?.name || "Player",
				emoji,
				reactionType: reactionMeta?.type || "custom",
				createdAt: new Date(),
			});
		}
		setLocalPost((prev) => ({ ...prev, reactions: updatedReactions }));

		try {
			const res = await apiFetch(`/api/forum/${targetPostId}/react`, {
				method: "POST",
				body: JSON.stringify({ emoji }),
			});
			if (res && res.ok) {
				const updated = await res.json();
				if (updated) {
					const reactionsList = updated.reactions || updated.post?.reactions;
					setLocalPost(prev => ({
						...prev,
						...(updated.post || (updated._id ? updated : {})),
						_id: prev._id,
						reactions: reactionsList || prev.reactions
					}));
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
		if (!currentUser || (currentUser.role !== "admin" && String(currentUserId) !== String(localPost.authorId))) return;
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

	const handleShare = (e) => {
		e?.stopPropagation();
		const shareUrl = `${window.location.origin}/community#post-${localPost._id}`;
		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(shareUrl).then(() => {
				toast.success("Post link copied to clipboard! 📋");
			}).catch(() => {});
		}
		setIsShareModalOpen(true);
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
							{renderPrivacyIcon(localPost.visibility)}
							{localPost.isEdited && (
								<Tooltip
									title={`Edited on ${formatTime(localPost.editedAt || localPost.updatedAt || localPost.timestamp)}`}
									arrow
									placement="top"
								>
									<span
										data-testid="post-edited-badge"
										style={{
											fontStyle: "italic",
											marginLeft: "6px",
											opacity: 0.7,
											cursor: "pointer",
										}}
									>
										(Edited)
									</span>
								</Tooltip>
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
								{(currentUser?.role === "admin" || String(currentUserId) === String(localPost.authorId)) && (
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

						{/* QUOTE PREVIEW CARD ON REPOSTS */}
						{Boolean(localPost.originalPost || localPost.originalPostId) && (
							<Paper
								variant="outlined"
								data-testid="post-quote-card"
								role="button"
								tabIndex={0}
								onClick={(e) => {
									e.stopPropagation();
									const origId = localPost.originalPost?._id || localPost.originalPostId;
									if (origId) {
										const targetEl = document.getElementById(`post-${origId}`);
										if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
										else navigate(`/community#post-${origId}`);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										const origId = localPost.originalPost?._id || localPost.originalPostId;
										if (origId) {
											const targetEl = document.getElementById(`post-${origId}`);
											if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
											else navigate(`/community#post-${origId}`);
										}
									}
								}}
								sx={{
									mt: 1.5,
									mb: 1.5,
									p: 1.5,
									borderRadius: 2.5,
									bgcolor: "action.hover",
									borderColor: "divider",
									cursor: "pointer",
									transition: "all 0.2s ease",
									"&:hover": {
										borderColor: "primary.main",
										bgcolor: "action.selected",
									},
								}}
							>
								<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
									<Avatar
										src={localPost.originalPost?.authorPic}
										alt={localPost.originalPost?.authorName || "Original author"}
										sx={{ width: 26, height: 26, bgcolor: "secondary.main", fontSize: "0.75rem" }}
									>
										{!localPost.originalPost?.authorPic && (localPost.originalPost?.authorName?.charAt(0).toUpperCase() || "A")}
									</Avatar>
									<Box>
										<Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: "0.82rem", lineHeight: 1.2 }}>
											{localPost.originalPost?.authorName || "Club Member"}
										</Typography>
										{localPost.originalPost?.category && (
											<Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
												• {CATEGORY_CONFIG[localPost.originalPost.category]?.label || localPost.originalPost.category}
											</Typography>
										)}
									</Box>
								</Box>

								{localPost.originalPost?.title && (
									<Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5, fontSize: "0.9rem" }}>
										{localPost.originalPost.title}
									</Typography>
								)}

								<Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{
											flex: 1,
											display: "-webkit-box",
											WebkitLineClamp: 3,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
											fontSize: "0.82rem",
											lineHeight: 1.5,
										}}
									>
										{localPost.originalPost?.content || "Click to view original discussion"}
									</Typography>
									{(localPost.originalPost?.imageUrls?.[0] || localPost.originalPost?.imageUrl || localPost.originalPost?.mediaUrls?.[0]) && (
										<Box
											component="img"
											src={localPost.originalPost?.imageUrls?.[0] || localPost.originalPost?.imageUrl || localPost.originalPost?.mediaUrls?.[0]}
											alt="Original post thumbnail"
											sx={{
												width: 56,
												height: 56,
												borderRadius: 1.5,
												objectFit: "cover",
												flexShrink: 0,
											}}
										/>
									)}
								</Box>
							</Paper>
						)}

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
									{distinctReactionEmojis.slice(0, 3).map((rawEmoji, index) => {
										const emoji = normalizeReactionEmoji(rawEmoji);
										return (
											<Box
												key={`${emoji}-${index}`}
												component="span"
												onClick={(e) => {
													e.stopPropagation();
													const tab =
														emoji === "❤️"
															? "love"
															: emoji === "😂"
															? "haha"
															: emoji === "😮"
															? "wow"
															: emoji === "😢"
															? "sad"
															: emoji === "😡"
															? "angry"
															: "like";
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
												<FacebookReactionIcon emoji={emoji} size={18} />
											</Box>
										);
									})}
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
						onMouseEnter={handleReactionBoxMouseEnter} 
						onMouseLeave={handleReactionBoxMouseLeave}
						onTouchStart={() => {
							touchTimer.current = setTimeout(() => setShowReactions(true), 380);
						}}
						onTouchEnd={() => {
							if (touchTimer.current) clearTimeout(touchTimer.current);
						}}
						sx={{ position: 'relative', flex: 1, display: 'flex' }}
					>
						{/* Floating Reaction Bar with Framer Motion Spring Pop-up & Hover Scaling */}
						<AnimatePresence>
							{showReactions && (
								<motion.div
									initial={{ opacity: 0, scale: 0.85, y: 6 }}
									animate={{ opacity: 1, scale: 1, y: -6 }}
									exit={{ opacity: 0, scale: 0.85, y: 6 }}
									transition={{ type: "spring", stiffness: 450, damping: 28 }}
									style={{ position: "absolute", bottom: "100%", left: 0, zIndex: 120, marginBottom: 6 }}
								>
									<Paper
										elevation={6}
										data-testid="reactions-dock"
										onMouseEnter={() => {
											if (leaveTimer.current) {
												clearTimeout(leaveTimer.current);
												leaveTimer.current = null;
											}
										}}
										onMouseLeave={handleReactionBoxMouseLeave}
										sx={{
											display: "flex",
											gap: "3px",
											px: "6px",
											py: "3px",
											borderRadius: "24px",
											bgcolor: (theme) =>
												theme.palette.mode === "dark"
													? "rgba(36, 37, 38, 0.98)"
													: "rgba(255, 255, 255, 0.98)",
											backdropFilter: "blur(6px)",
											border: "1px solid",
											borderColor: "divider",
											boxShadow: "0 4px 16px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)",
											alignItems: "center",
										}}
									>
										{FACEBOOK_REACTIONS.map((item) => (
											<Tooltip key={item.type} title={item.tooltip} arrow placement="top">
												<motion.div
													whileHover={{ scale: 1.35, y: -6, transition: { type: "spring", stiffness: 500 } }}
													whileTap={{ scale: 0.9 }}
												>
													<IconButton
														aria-label={`React with ${item.label}`}
														onClick={(e) => {
															e.stopPropagation();
															if (hoverTimer.current) clearTimeout(hoverTimer.current);
															if (leaveTimer.current) clearTimeout(leaveTimer.current);
															setShowReactions(false);
															handleReaction(item.emoji);
														}}
														sx={{
															width: 34,
															height: 34,
															p: 0,
															fontSize: "1.35rem",
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
															transition: "transform 0.15s ease",
														}}
													>
														<span>{item.emoji}</span>
													</IconButton>
												</motion.div>
											</Tooltip>
										))}
									</Paper>
								</motion.div>
							)}
						</AnimatePresence>

						<Button
							aria-label="React to post"
							onClick={() => {
								if (hoverTimer.current) clearTimeout(hoverTimer.current);
								if (leaveTimer.current) clearTimeout(leaveTimer.current);
								setShowReactions(false);
								if (currentUserReaction) handleReaction(currentUserReaction);
								else handleReaction('👍');
							}}
							color={currentUserReaction ? "primary" : "inherit"}
							sx={{
								...actionBtnStyle,
								...(currentUserReaction
									? { color: getReactionMeta(currentUserReaction)?.color || "#1877F2" }
									: { color: "text.secondary" }),
							}}
						>
							<Box sx={{ mr: { xs: 0.5, sm: 1 }, display: "flex", alignItems: "center" }}>
								{currentUserReaction ? (
									currentUserReaction === "👍" ? (
										<>
											<ThumbUpFilled style={{ width: 19, height: 19, color: "#1877F2" }} />
											<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>👍</span>
										</>
									) : (
										<Typography component="span" sx={{ fontSize: "1.15rem", lineHeight: 1 }}>
											{currentUserReaction}
										</Typography>
									)
								) : (
									<ThumbUpOutline style={{ width: 19, height: 19 }} />
								)}
							</Box>
							<Box sx={{ display: "inline-block", fontSize: { xs: "0.8rem", sm: "0.875rem" }, fontWeight: currentUserReaction ? 600 : 500 }}>
								{(() => {
									if (currentUserReaction) {
										const meta = getReactionMeta(currentUserReaction);
										return meta ? meta.label : "Like";
									}
									return "Like";
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

			{/* SHARE / REPOST MODAL */}
			<ShareModal
				open={isShareModalOpen}
				onClose={() => setIsShareModalOpen(false)}
				post={localPost}
				currentUser={currentUser}
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
