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

	// NEW: Mobile Screen Sensors
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

	const [viewDate, setViewDate] = useState(
		queryParams.get("date") || todayDateStr,
	);
	const [viewDay, setViewDay] = useState(
		queryParams.get("day") || todayDayStr,
	);

	const currentUser = JSON.parse(localStorage.getItem("user"));
	const [posts, setPosts] = useState([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newPost, setNewPost] = useState({ title: "", content: "" });
	const isFormValid = newPost.title.length > 0 && newPost.content.length > 0;
	const dateWindow = generateDateWindow();

	useEffect(() => {
		setViewDate(queryParams.get("date") || todayDateStr);
		setViewDay(queryParams.get("day") || todayDayStr);
	}, [queryParams.get("date"), queryParams.get("day")]);

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

	useEffect(() => {
		fetch(`${import.meta.env.VITE_API_URL}/api/forum`)
			.then((res) => res.json())
			.then(setPosts)
			.catch(console.error);

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
			setIsModalOpen(false);
			setNewPost({ title: "", content: "" });
		} catch (error) {
			console.error("Failed to post", error);
		}
	};

	const postsForThisDate = posts.filter((post) => {
		if (!post.targetDate) return false;
		return (
			post.targetDate.replace(/[\u00A0\u202F\s]+/g, " ").trim() ===
			viewDate.replace(/[\u00A0\u202F\s]+/g, " ").trim()
		);
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
					{postsForThisDate.length === 0 ? (
						<Box textAlign="center" sx={{ my: 4 }}>
							<Typography color="text.secondary">
								No posts found for {viewDate}.
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
				onClick={() => setIsModalOpen(true)}
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
				fullScreen={fullScreen} // NEW: Makes it full screen on mobile!
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
						rows={8} // Made rows slightly bigger for full screen
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
						fullWidth={fullScreen} // Spreads the post button on mobile
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
