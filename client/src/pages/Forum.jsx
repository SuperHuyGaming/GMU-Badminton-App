// client/src/pages/Forum.jsx
import { useState, useEffect, useRef } from "react";
import apiFetch from "../utils/api";
import { useLocation } from "react-router-dom";
import {
	Typography,
	Button,
	Container,
	Box,
	Paper,
	Chip,
	Fab,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	useTheme,
	useMediaQuery,
	Skeleton,
	CircularProgress,
	IconButton,
	Avatar,
} from "@mui/material";
import PostCard from "../components/PostCard";
import PostCommentsModal from "../components/PostCommentsModal";
import { PostSkeleton } from "../components/Skeletons";
import { io } from "socket.io-client";

const socket = io(`${import.meta.env.VITE_API_URL}`);

// Sleek Icons for the Modal
const EditPenIcon = () => (
	<svg
		width="22"
		height="22"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 20h9"></path>
		<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
	</svg>
);
const CloseIcon = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<line x1="18" y1="6" x2="6" y2="18"></line>
		<line x1="6" y1="6" x2="18" y2="18"></line>
	</svg>
);

const generateDateWindow = () => {
	const dates = [];
	const now = new Date();
	for (let i = -2; i <= 7; i++) {
		const d = new Date();
		d.setDate(now.getDate() + i);
		let safeDate = d
			.toLocaleDateString("en-US", { month: "short", day: "numeric" })
			.replace(/[\u00A0\u202F\s]+/g, " ")
			.trim();
		dates.push({
			date: safeDate,
			day: d.toLocaleDateString("en-US", { weekday: "long" }),
		});
	}
	return dates;
};
import { useAuth } from "../context/AuthContext";

export default function Forum() {
	const { setToastMessage } = useAuth();
	const location = useLocation();
	const queryParams = new URLSearchParams(location.search);
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

	const rawToday = new Date().toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
	const todayDateStr = rawToday.replace(/[\u00A0\u202F\s]+/g, " ").trim();
	const todayDayStr = new Date().toLocaleDateString("en-US", {
		weekday: "long",
	});

	const currentUser = JSON.parse(localStorage.getItem("user"));
	const dateWindow = generateDateWindow();

	const [viewDate, setViewDate] = useState(todayDateStr);
	const [viewDay, setViewDay] = useState(todayDayStr);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [spamModalOpen, setSpamModalOpen] = useState(false);

	const [newPost, setNewPost] = useState({ title: "", content: "" });
	const isFormValid = newPost.title.length > 0 && newPost.content.length > 0;

	const [posts, setPosts] = useState([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetchingMore, setIsFetchingMore] = useState(false);
	const observerTarget = useRef(null);

	useEffect(() => {
		const urlDate = queryParams.get("date");
		const urlDay = queryParams.get("day");
		const urlPostId = queryParams.get("postId");

		if (urlDate) {
			setViewDate(urlDate);
			if (urlDay) setViewDay(urlDay);
		} else if (!urlPostId) {
			setViewDate(todayDateStr);
			setViewDay(todayDayStr);
		}
	}, [location.search]);

	const [showScrollTop, setShowScrollTop] = useState(false);

	useEffect(() => {
		setPage(1);
	}, [viewDate]);

	useEffect(() => {
		const handleScroll = () => {
			setShowScrollTop(window.scrollY > 300);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		const fetchPosts = async () => {
			if (page > 1 && !hasMore) return;
			if (page === 1) setIsLoading(true);
			else setIsFetchingMore(true);

			try {
				const res = await apiFetch(
					`/api/forum?date=${encodeURIComponent(viewDate)}&page=${page}&limit=10`,
				);
				const data = await res.json();
				setHasMore(data.length === 10);

				if (page === 1) {
					setPosts(data);
				} else {
					setPosts((prev) => {
						const existingIds = new Set(prev.map((p) => p._id));
						const newPosts = data.filter(
							(p) => !existingIds.has(p._id),
						);
						return [...prev, ...newPosts];
					});
				}
			} catch (err) {
				console.error(err);
			} finally {
				setIsLoading(false);
				setIsFetchingMore(false);
			}
		};

		fetchPosts();
	}, [viewDate, page]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0].isIntersecting &&
					hasMore &&
					!isLoading &&
					!isFetchingMore
				)
					setPage((prev) => prev + 1);
			},
			{ threshold: 1.0 },
		);
		if (observerTarget.current) observer.observe(observerTarget.current);
		return () => observer.disconnect();
	}, [hasMore, isLoading, isFetchingMore]);

	useEffect(() => {
		const handleNewPost = (newPost) => {
			const postDate = newPost.targetDate
				.replace(/[\u00A0\u202F\s]+/g, " ")
				.trim();
			const currentView = viewDate
				.replace(/[\u00A0\u202F\s]+/g, " ")
				.trim();
			if (postDate === currentView)
				setPosts((prev) =>
					prev.some((p) => p._id === newPost._id)
						? prev
						: [newPost, ...prev],
				);
		};
		const handlePostUpdated = (updatedPost) =>
			setPosts((prev) =>
				prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)),
			);
		const handleDeletedPost = (deletedPostId) =>
			setPosts((prev) => prev.filter((p) => p._id !== deletedPostId));

		socket.on("postCreated", handleNewPost);
		socket.on("postUpdated", handlePostUpdated);
		socket.on("postDeleted", handleDeletedPost);

		return () => {
			socket.off("postCreated", handleNewPost);
			socket.off("postUpdated", handlePostUpdated);
			socket.off("postDeleted", handleDeletedPost);
		};
	}, [viewDate]);

	const handleSubmit = async () => {
		if (!currentUser) return alert("You must be logged in to post!");
		try {
			const res = await apiFetch("/api/forum", {
					method: "POST",
					body: JSON.stringify({
						title: newPost.title,
						content: newPost.content,
						authorName: currentUser.name,
						authorId: currentUser.id,
						targetDate: viewDate,
					}),
				},
			);

			const data = await res.json();
			if (!res.ok)
				return alert(
					data.message || "Failed to post. Please try again.",
				);

			if (data.message === "Post submitted for review.")
				setSpamModalOpen(true);
			else if (setToastMessage)
				setToastMessage("Post created successfully!");

			if (document.activeElement) document.activeElement.blur();
			setTimeout(() => setIsModalOpen(false), 10);
			setNewPost({ title: "", content: "" });
		} catch (error) {
			console.error("Failed to post", error);
		}
	};

	return (
		<Box sx={{ pb: 10 }}>
			{/* HERO BANNER */}
			<Box 
				sx={{ 
					width: '100%', 
					mb: 4, 
					py: { xs: 6, md: 10 },
					background: "linear-gradient(135deg, rgba(0, 102, 51, 0.9) 0%, rgba(255, 204, 51, 0.8) 100%)",
					position: 'relative',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
				}}
			>
				{/* Decorative Background Elements */}
				<Box sx={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(30px)' }} />
				<Box sx={{ position: 'absolute', bottom: -50, right: -50, width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', filter: 'blur(40px)' }} />
				
				<Typography
					variant="h2"
					sx={{
						fontWeight: "900",
						fontSize: { xs: "2.5rem", md: "4rem" },
						color: 'white',
						textShadow: '0 2px 10px rgba(0,0,0,0.3)',
						letterSpacing: '-1px',
						zIndex: 1,
						textAlign: 'center'
					}}
				>
					VARSITY FORUM
				</Typography>
				<Typography 
					variant="h6" 
					sx={{ 
						color: "rgba(255,255,255,0.9)", 
						zIndex: 1, 
						fontWeight: 600,
						mt: 1,
						textAlign: 'center'
					}}
				>
					Organizing matches for:{" "}
					<strong style={{ color: "#FFCC33", textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
						{viewDay}, {viewDate}
					</strong>
				</Typography>
			</Box>

			<Container maxWidth="md">
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1 }}>
					<Typography
						variant="subtitle2"
						color="text.secondary"
						sx={{ fontWeight: "bold" }}
					>
						📅 Select a Day:
					</Typography>
					<Button 
						size="small" 
						variant="outlined" 
						startIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>}
						onClick={() => { setPage(1); setPosts([]); }}
						sx={{ borderRadius: 2, textTransform: 'none' }}
					>
						Refresh
					</Button>
				</Box>
				<Paper
					elevation={0}
					sx={{
						mb: 4,
						p: 2,
						borderRadius: 3,
						border: "1px solid", borderColor: "divider",
						overflowX: "auto",
						whiteSpace: "nowrap",
						"&::-webkit-scrollbar": { height: 8 },
						"&::-webkit-scrollbar-track": { bgcolor: "transparent" },
						"&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 4 },
					}}
				>
					<Box sx={{ display: "inline-flex", gap: 1.5 }}>
						{dateWindow.map((d, i) => (
							<Chip
								key={i}
								id={`date-tab-${d.date.replace(/[\u00A0\u202F\s]+/g, "-")}`}
								label={`${d.day}, ${d.date}`}
								clickable
								onClick={() => {
									setViewDate(d.date);
									setViewDay(d.day);
									setPage(1);
									setPosts([]);
								}}
								color={
									viewDate === d.date ? "primary" : "default"
								}
								variant={
									viewDate === d.date ? "filled" : "outlined"
								}
								sx={{
									fontWeight:
										viewDate === d.date ? "bold" : "normal",
								}}
							/>
						))}
					</Box>
				</Paper>

				<Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
					{isLoading ? (
						[1, 2, 3].map((n) => <PostSkeleton key={n} />)
					) : posts.length === 0 ? (
						<Box sx={{ textAlign: "center", my: 4 }}>
							<Typography color="text.secondary">
								No posts found for {viewDate}.
							</Typography>
							<Typography color="text.secondary">
								Be the first to start a thread!
							</Typography>
						</Box>
					) : (
						posts.map((post) => (
							<PostCard key={post._id} post={post} />
						))
					)}

					{isFetchingMore && (
						<Box
							sx={{
								display: "flex",
								justifyContent: "center",
								my: 4,
							}}
						>
							<CircularProgress size={30} />
						</Box>
					)}
					{!isLoading && posts.length > 0 && !hasMore && (
						<Typography
							textAlign="center"
							color="text.secondary"
							sx={{ my: 4, fontStyle: "italic" }}
						>
							You've reached the end of the line! 🏸
						</Typography>
					)}
					<div ref={observerTarget} style={{ height: "10px" }}></div>
				</Box>
			</Container>

			<Fab
				color="secondary"
				variant="extended"
				onClick={(e) => {
					if (e.currentTarget) e.currentTarget.blur();
					setIsModalOpen(true);
				}}
				sx={{
					position: "fixed",
					bottom: { xs: 16, md: 32 },
					right: { xs: 16, md: 32 },
					fontWeight: "bold",
				}}
			>
				+ New Post
			</Fab>

			{/* ========================================== */}
			{/* UPGRADED: LUXURY NEW POST MODAL */}
			{/* ========================================== */}
			<Dialog
				open={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				fullWidth
				maxWidth="sm"
				fullScreen={fullScreen}
				PaperProps={{
					sx: {
						borderRadius: fullScreen ? 0 : 4,
						overflow: "hidden",
						backgroundColor: "background.paper",
						backgroundImage: "none", // remove default MUI paper elevation overlay if we want solid color
					},
				}}
			>
				{/* Header */}
				<DialogTitle
					sx={{
						fontWeight: "900",
						p: 3,
						pb: 2,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						bgcolor: "background.paper",
					}}
				>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, fontSize: "1.3rem" }}>
						Create Post
					</Box>
					{fullScreen && (
						<IconButton onClick={() => setIsModalOpen(false)} size="small">
							<CloseIcon />
						</IconButton>
					)}
				</DialogTitle>

				{/* Content */}
				<DialogContent
					sx={{
						p: 3,
						pt: 0,
						display: "flex",
						flexDirection: "column",
						gap: 2,
						bgcolor: "background.paper",
					}}
				>
					{/* Information Banner */}
					<Box sx={{ 
						bgcolor: "rgba(0, 102, 51, 0.08)", 
						p: 1.5, 
						borderRadius: 2, 
						display: "flex", 
						alignItems: "center", 
						gap: 1.5,
						mt: 1,
						mb: 1
					}}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#006633" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
						<Typography variant="body2" color="text.secondary">
							Organizing for <strong style={{ color: "#006633" }}>{viewDay}, {viewDate}</strong>
						</Typography>
					</Box>

					{/* Inputs - Modern Style */}
					<Box sx={{ display: "flex", gap: 2 }}>
						<Avatar src={currentUser?.profilePic} sx={{ width: 44, height: 44 }} />
						<Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
							<TextField
								fullWidth
								variant="standard"
								placeholder="Thread Title..."
								value={newPost.title}
								onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
								InputProps={{ 
									disableUnderline: true,
									sx: { fontSize: "1.2rem", fontWeight: "bold" }
								}}
							/>
							<TextField
								fullWidth
								variant="standard"
								multiline
								minRows={4}
								placeholder="Who wants to play? What's your skill level? Are you bringing birdies?"
								value={newPost.content}
								onChange={(e) => setNewPost({ ...newPost, content: e.target.value.slice(0, 1000) })}
								InputProps={{ 
									disableUnderline: true,
									sx: { fontSize: "1.05rem", lineHeight: 1.5 }
								}}
							/>
							<Typography variant="caption" color="text.secondary" sx={{ textAlign: "right", mt: 1 }}>
								{newPost.content?.length || 0} / 1000
							</Typography>
						</Box>
					</Box>
				</DialogContent>

				{/* Actions */}
				<DialogActions
					sx={{
						px: 3,
						pb: 3,
						pt: 1,
						justifyContent: "flex-end",
						bgcolor: "background.paper",
					}}
				>
					{!fullScreen && (
						<Button
							onClick={() => setIsModalOpen(false)}
							color="inherit"
							sx={{
								fontWeight: "bold",
								textTransform: "none",
								px: 3,
							}}
						>
							Cancel
						</Button>
					)}
					<Button
						onClick={handleSubmit}
						variant="contained"
						color="primary"
						disabled={!isFormValid}
						fullWidth={fullScreen}
						sx={{
							fontWeight: "bold",
							py: 1.5,
							px: 4,
							borderRadius: 3,
							textTransform: "none",
							fontSize: "1rem",
							boxShadow: isFormValid
								? "0 4px 14px rgba(0, 102, 51, 0.3)"
								: "none",
						}}
					>
						Post to Forum
					</Button>
				</DialogActions>
			</Dialog>

			{/* ========================================== */}
			{/* SPAM WARNING MODAL */}
			{/* ========================================== */}
			<Dialog
				open={spamModalOpen}
				onClose={() => setSpamModalOpen(false)}
				maxWidth="sm"
				fullWidth
				PaperProps={{ sx: { borderRadius: 3 } }}
			>
				<DialogTitle
					sx={{
						fontWeight: "bold",
						color: "#d32f2f",
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						borderBottom: "1px solid #eee",
						pb: 2,
						pt: 3,
						px: 4,
					}}
				>
					<Typography sx={{ fontSize: "1.5rem" }}>🚨</Typography> Post
					Under Review
				</DialogTitle>
				<DialogContent sx={{ p: 4 }}>
					<Typography
						variant="body1"
						sx={{ mb: 2, fontWeight: "bold" }}
					>
						Our automated system has flagged your post for
						moderation.
					</Typography>
					<Typography
						variant="body2"
						color="text.secondary"
						sx={{ lineHeight: 1.6 }}
					>
						This usually happens if a post contains excessive links,
						repetitive characters, or triggers our automated spam
						filters. Your post has been successfully sent to the
						admin team for manual review. It will become visible on
						the forum once it is approved.
					</Typography>
				</DialogContent>
				<DialogActions sx={{ p: 4, pt: 1 }}>
					<Button
						onClick={() => setSpamModalOpen(false)}
						variant="contained"
						color="error"
						fullWidth
						sx={{
							fontWeight: "bold",
							py: 1.5,
							borderRadius: 3,
							textTransform: "none",
						}}
					>
						I Understand
					</Button>
				</DialogActions>
			</Dialog>

			{showScrollTop && (
				<Fab 
					color="primary" 
					size="small" 
					onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
				</Fab>
			)}
		</Box>
	);
}
