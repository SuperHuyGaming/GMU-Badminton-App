// client/src/pages/Forum.jsx
import { useState, useEffect, useRef } from "react";
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
} from "@mui/material";
import PostCard from "../components/PostCard";
import { io } from "socket.io-client";

const socket = io(`${import.meta.env.VITE_API_URL}`);

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

export default function Forum({ setToastMessage }) {
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

	// NEW: State for the big Spam Warning popup
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

	useEffect(() => {
		setPage(1);
	}, [viewDate]);

	useEffect(() => {
		const fetchPosts = async () => {
			if (page > 1 && !hasMore) return;

			if (page === 1) setIsLoading(true);
			else setIsFetchingMore(true);

			try {
				const res = await fetch(
					`${import.meta.env.VITE_API_URL}/api/forum?date=${encodeURIComponent(viewDate)}&page=${page}&limit=10`,
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
				) {
					setPage((prev) => prev + 1);
				}
			},
			{ threshold: 1.0 },
		);

		if (observerTarget.current) observer.observe(observerTarget.current);
		return () => observer.disconnect();
	}, [hasMore, isLoading, isFetchingMore]);

	// WebSockets
	useEffect(() => {
		const handleNewPost = (newPost) => {
			const postDate = newPost.targetDate
				.replace(/[\u00A0\u202F\s]+/g, " ")
				.trim();
			const currentView = viewDate
				.replace(/[\u00A0\u202F\s]+/g, " ")
				.trim();

			if (postDate === currentView) {
				setPosts((prevPosts) => {
					if (prevPosts.some((p) => p._id === newPost._id))
						return prevPosts;
					return [newPost, ...prevPosts];
				});
			}
		};

		const handlePostUpdated = (updatedPost) => {
			setPosts((prevPosts) =>
				prevPosts.map((p) =>
					p._id === updatedPost._id ? updatedPost : p,
				),
			);
		};

		const handleDeletedPost = (deletedPostId) => {
			setPosts((prevPosts) =>
				prevPosts.filter((p) => p._id !== deletedPostId),
			);
		};

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
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/forum`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
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

			// UPDATED: Check for the exact spam message and open the big modal
			if (data.message === "Post submitted for review.") {
				setSpamModalOpen(true);
			} else if (setToastMessage) {
				setToastMessage("Post created successfully!");
			}

			if (document.activeElement) document.activeElement.blur();
			setTimeout(() => setIsModalOpen(false), 10);
			setNewPost({ title: "", content: "" });
		} catch (error) {
			console.error("Failed to post", error);
		}
	};

	return (
		<Box sx={{ mt: { xs: 2, md: 4 }, pb: 10 }}>
			<Box sx={{ mb: 4, textAlign: "center" }}>
				<Typography
					variant="h3"
					color="primary"
					gutterBottom
					sx={{
						fontWeight: "900",
						fontSize: { xs: "2rem", md: "3rem" },
					}}
				>
					GMU Badminton Forum
				</Typography>
				<Typography variant="h6" color="text.secondary">
					Organizing matches for:{" "}
					<strong style={{ color: "#006633" }}>
						{viewDay}, {viewDate}
					</strong>
				</Typography>
			</Box>

			<Container maxWidth="md">
				<Typography
					variant="subtitle2"
					color="text.secondary"
					sx={{ mb: 1, ml: 1, fontWeight: "bold" }}
				>
					📅 Select a Day:
				</Typography>
				<Paper
					elevation={0}
					sx={{
						mb: 4,
						p: 2,
						borderRadius: 3,
						border: "1px solid #eaeaea",
						overflowX: "auto",
						whiteSpace: "nowrap",
						boxShadow: "inset 0 0 10px rgba(0,0,0,0.02)",
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
						[1, 2].map((n) => (
							<Paper
								key={n}
								elevation={0}
								sx={{
									p: 3,
									borderRadius: 3,
									border: "1px solid #e0e0e0",
								}}
							>
								<Box sx={{ display: "flex", gap: 2, mb: 2 }}>
									<Skeleton
										variant="circular"
										width={40}
										height={40}
									/>
									<Box sx={{ width: "100%" }}>
										<Skeleton
											variant="text"
											width="60%"
											height={30}
										/>
										<Skeleton variant="text" width="40%" />
									</Box>
								</Box>
								<Skeleton
									variant="rectangular"
									width="100%"
									height={100}
									sx={{ borderRadius: 2 }}
								/>
							</Paper>
						))
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
			{/* NEW POST MODAL */}
			{/* ========================================== */}
			<Dialog
				open={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				fullWidth
				maxWidth="sm"
				fullScreen={fullScreen}
			>
				<DialogTitle
					sx={{
						fontWeight: "bold",
						color: "primary.main",
						pb: 1,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					Organizing for {viewDate}
					{fullScreen && (
						<Button
							onClick={() => setIsModalOpen(false)}
							color="inherit"
							sx={{ minWidth: 0 }}
						>
							✕
						</Button>
					)}
				</DialogTitle>
				<DialogContent sx={{ pt: 2 }}>
					<TextField
						fullWidth
						label="Thread Title"
						variant="outlined"
						margin="normal"
						value={newPost.title}
						onChange={(e) =>
							setNewPost({ ...newPost, title: e.target.value })
						}
					/>
					<TextField
						fullWidth
						label="Details"
						variant="outlined"
						margin="normal"
						multiline
						rows={8}
						value={newPost.content}
						onChange={(e) =>
							setNewPost({ ...newPost, content: e.target.value })
						}
					/>
				</DialogContent>
				<DialogActions sx={{ p: 3, justifyContent: "space-between" }}>
					{!fullScreen && (
						<Button
							onClick={() => setIsModalOpen(false)}
							color="inherit"
							sx={{ fontWeight: "bold" }}
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
							py: fullScreen ? 1.5 : undefined,
						}}
					>
						Post to Forum
					</Button>
				</DialogActions>
			</Dialog>

			{/* ========================================== */}
			{/* NEW: BIG SPAM WARNING MODAL */}
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
					}}
				>
					<Typography sx={{ fontSize: "1.5rem" }}>🚨</Typography> Post
					Under Review
				</DialogTitle>
				<DialogContent sx={{ pt: 3 }}>
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
				<DialogActions sx={{ p: 3 }}>
					<Button
						onClick={() => setSpamModalOpen(false)}
						variant="contained"
						color="error"
						fullWidth
						sx={{ fontWeight: "bold", py: 1.2, borderRadius: 2 }}
					>
						I Understand
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
