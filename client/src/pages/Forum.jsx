// client/src/pages/Forum.jsx
import { useState, useEffect } from "react";
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

export default function Forum() {
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

	const [viewDate, setViewDate] = useState(todayDateStr);
	const [viewDay, setViewDay] = useState(todayDayStr);

	const currentUser = JSON.parse(localStorage.getItem("user"));
	const [posts, setPosts] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newPost, setNewPost] = useState({ title: "", content: "" });

	// PHASE 2: Search State
	const [searchQuery, setSearchQuery] = useState("");

	const isFormValid = newPost.title.length > 0 && newPost.content.length > 0;
	const dateWindow = generateDateWindow();

	// FIX: Smart Tab Routing!
	useEffect(() => {
		const urlDate = queryParams.get("date");
		const urlDay = queryParams.get("day");
		const urlPostId = queryParams.get("postId");

		if (urlDate) {
			setViewDate(urlDate);
			if (urlDay) setViewDay(urlDay);
		} else if (!urlPostId) {
			// Only force the tab to "Today" if we AREN'T trying to view a specific post!
			setViewDate(todayDateStr);
			setViewDay(todayDayStr);
		}
	}, [location.search]);

	// Auto-scroll the date tabs so the selected day is visible
	useEffect(() => {
		const safeId = `date-tab-${viewDate.replace(/[\u00A0\u202F\s]+/g, "-")}`;
		const activeTab = document.getElementById(safeId);
		if (activeTab)
			activeTab.scrollIntoView({
				behavior: "smooth",
				inline: "center",
				block: "nearest",
			});
	}, [viewDate]);

	// Fetch posts and setup WebSockets
	useEffect(() => {
		fetch(`${import.meta.env.VITE_API_URL}/api/forum`)
			.then((res) => res.json())
			.then(setPosts)
			.catch(console.error)
			.finally(() => setIsLoading(false));

		socket.on("postCreated", (newPost) => {
			setPosts((prevPosts) => [newPost, ...prevPosts]);
		});

		socket.on("postUpdated", (updatedPost) => {
			setPosts((prevPosts) =>
				prevPosts.map((p) =>
					p._id === updatedPost._id ? updatedPost : p,
				),
			);
		});

		return () => {
			socket.off("postCreated");
			socket.off("postUpdated");
		};
	}, []);

	// FIX: Auto-Switch Tabs based on Notification Post ID
	const urlPostId = queryParams.get("postId");
	useEffect(() => {
		if (urlPostId && posts.length > 0) {
			const targetPost = posts.find((p) => p._id === urlPostId);
			if (targetPost && targetPost.targetDate) {
				const postDate = targetPost.targetDate
					.replace(/[\u00A0\u202F\s]+/g, " ")
					.trim();
				// Automatically flip the view to the correct date tab!
				setViewDate(postDate);

				// Match the exact day name (e.g. "Wednesday") for the UI
				const matchedDay = dateWindow.find(
					(d) => d.date === postDate,
				)?.day;
				if (matchedDay) setViewDay(matchedDay);
			}
		}
	}, [urlPostId, posts]);

	const handleSubmit = async () => {
		if (!currentUser) return alert("You must be logged in to post!");
		try {
			await fetch(`${import.meta.env.VITE_API_URL}/api/forum`, {
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
			});
			if (document.activeElement) {
				document.activeElement.blur();
			}
			setTimeout(() => setIsModalOpen(false), 10);
			setNewPost({ title: "", content: "" });
		} catch (error) {
			console.error("Failed to post", error);
		}
	};

	// PHASE 2: Integrated Real-Time Search Filtering
	const postsForThisDate = posts.filter((post) => {
		if (!post.targetDate) return false;

		const matchesDate =
			post.targetDate.replace(/[\u00A0\u202F\s]+/g, " ").trim() ===
			viewDate.replace(/[\u00A0\u202F\s]+/g, " ").trim();

		const searchLower = searchQuery.toLowerCase();
		const matchesSearch =
			post.title.toLowerCase().includes(searchLower) ||
			post.content.toLowerCase().includes(searchLower) ||
			post.authorName.toLowerCase().includes(searchLower);

		return matchesDate && matchesSearch;
	});

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
				{/* PHASE 2: SEARCH BAR COMPONENT */}
				<TextField
					fullWidth
					variant="outlined"
					placeholder="Search posts by title, content, or player name..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					sx={{
						mb: 3,
						"& .MuiOutlinedInput-root": {
							borderRadius: 3,
							backgroundColor: "white",
							boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
						},
					}}
					InputProps={{
						startAdornment: (
							<span
								style={{ marginRight: 12, fontSize: "1.2rem" }}
							>
								🔍
							</span>
						),
					}}
				/>

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
									setSearchQuery(""); // Clear search when changing days
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
					) : postsForThisDate.length === 0 ? (
						<Box sx={{ textAlign: "center", my: 4 }}>
							<Typography color="text.secondary">
								{searchQuery
									? `No results found for "${searchQuery}".`
									: `No posts found for ${viewDate}.`}
							</Typography>
							<Typography color="text.secondary">
								Be the first to start a thread!
							</Typography>
						</Box>
					) : (
						postsForThisDate.map((post) => (
							<PostCard key={post._id} post={post} />
						))
					)}
				</Box>
			</Container>

			<Fab
				color="secondary"
				variant="extended"
				onClick={(e) => {
					// THE FIX: Force the yellow button to un-focus itself the millisecond you click it!
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
		</Box>
	);
}
