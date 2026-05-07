// client/src/pages/Admin.jsx
import { useState, useEffect } from "react";
import {
	Container,
	Typography,
	Box,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Button,
	Chip,
} from "@mui/material";

export default function Admin() {
	const [users, setUsers] = useState([]);
	const [posts, setPosts] = useState([]);

	// NEW: State for the Moderation Queue
	const [flaggedPosts, setFlaggedPosts] = useState([]);

	const fetchAdminData = async () => {
		try {
			const token = localStorage.getItem("token");
			const headers = { Authorization: `Bearer ${token}` };

			const userRes = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/users`,
				{ headers },
			);
			if (userRes.ok) setUsers(await userRes.json());

			const postRes = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/posts`,
				{ headers },
			);
			if (postRes.ok) setPosts(await postRes.json());

			// NEW: Fetch the flagged posts
			const flaggedRes = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/flagged`,
				{ headers },
			);
			if (flaggedRes.ok) setFlaggedPosts(await flaggedRes.json());
		} catch (err) {
			console.error("Failed to fetch admin data", err);
		}
	};

	useEffect(() => {
		fetchAdminData();
	}, []);

	// --- NEW: SPAM MODERATION ACTIONS ---
	const handleApprovePost = async (id) => {
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/flagged/${id}/approve`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				},
			);
			if (res.ok) {
				const { post } = await res.json();
				setFlaggedPosts(flaggedPosts.filter((p) => p._id !== id));
				setPosts([post, ...posts]); // Add it to the regular posts table
			}
		} catch (err) {
			console.error(err);
		}
	};

	const handleDeleteFlagged = async (id) => {
		if (!window.confirm("Permanently delete this spam post?")) return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/posts/${id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				},
			);
			if (res.ok)
				setFlaggedPosts(flaggedPosts.filter((p) => p._id !== id));
		} catch (err) {
			console.error(err);
		}
	};
	// ------------------------------------

	const handleDeleteUser = async (id) => {
		if (
			!window.confirm(
				"Are you sure you want to permanently delete this user?",
			)
		)
			return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/users/${id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				},
			);
			if (res.ok) setUsers(users.filter((u) => u._id !== id));
		} catch (err) {
			console.error(err);
		}
	};

	const handleDeletePost = async (id) => {
		if (
			!window.confirm(
				"Are you sure you want to permanently delete this post?",
			)
		)
			return;
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/admin/posts/${id}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
				},
			);
			if (res.ok) setPosts(posts.filter((p) => p._id !== id));
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<Container
			maxWidth="lg"
			sx={{ mt: { xs: 2, md: 5 }, pb: 10, px: { xs: 1, sm: 2, md: 3 } }}
		>
			<Box sx={{ mb: { xs: 3, md: 5 }, textAlign: "center" }}>
				<Typography
					variant="h3"
					color="error.main"
					fontWeight="900"
					gutterBottom
					sx={{ fontSize: { xs: "2.2rem", md: "3rem" } }}
				>
					Admin Tab
				</Typography>
				<Typography variant="h6" color="text.secondary">
					Platform Administration Hub
				</Typography>
			</Box>

			{/* ========================================== */}
			{/* NEW: MODERATION QUEUE */}
			{/* ========================================== */}
			<Typography
				variant="h5"
				color="error.main"
				fontWeight="900"
				sx={{ mb: 2, ml: 1 }}
			>
				🚨 Moderation Queue (Spam)
			</Typography>

			{flaggedPosts.length === 0 ? (
				<Paper
					elevation={0}
					sx={{
						p: 4,
						mb: 6,
						textAlign: "center",
						borderRadius: 3,
						border: "1px solid #e0e0e0",
					}}
				>
					<Typography variant="h6" color="text.secondary">
						No spam detected! The forum is clean.
					</Typography>
				</Paper>
			) : (
				<Box sx={{ mb: 6 }}>
					{flaggedPosts.map((post) => (
						<Paper
							key={post._id}
							elevation={0}
							sx={{
								p: 3,
								mb: 2,
								borderRadius: 3,
								border: "2px solid #ffcccc",
								backgroundColor: "#fff5f5",
							}}
						>
							<Box
								sx={{
									display: "flex",
									justifyContent: "space-between",
									mb: 1,
								}}
							>
								<Typography
									variant="subtitle1"
									fontWeight="bold"
								>
									{post.authorName}
								</Typography>
								<Typography
									variant="caption"
									color="error.main"
									fontWeight="bold"
								>
									Flagged on{" "}
									{new Date(post.timestamp).toLocaleString()}
								</Typography>
							</Box>
							<Typography
								variant="h6"
								fontWeight="bold"
								sx={{ mb: 1 }}
							>
								{post.title}
							</Typography>
							<Typography
								variant="body2"
								sx={{
									mb: 3,
									whiteSpace: "pre-wrap",
									p: 2,
									backgroundColor: "white",
									borderRadius: 2,
									border: "1px dashed #ffcccc",
								}}
							>
								{post.content}
							</Typography>
							<Box sx={{ display: "flex", gap: 2 }}>
								<Button
									variant="contained"
									color="error"
									onClick={() =>
										handleDeleteFlagged(post._id)
									}
									sx={{ fontWeight: "bold" }}
								>
									Delete Spam
								</Button>
								<Button
									variant="outlined"
									color="success"
									onClick={() => handleApprovePost(post._id)}
									sx={{
										fontWeight: "bold",
										bgcolor: "white",
									}}
								>
									Approve (Not Spam)
								</Button>
							</Box>
						</Paper>
					))}
				</Box>
			)}

			{/* ========================================== */}
			{/* USERS TABLE */}
			{/* ========================================== */}
			<Typography
				variant="h5"
				color="primary"
				fontWeight="bold"
				sx={{ mb: 2, ml: 1 }}
			>
				Manage Users ({users.length})
			</Typography>

			<TableContainer
				component={Paper}
				elevation={0}
				sx={{
					mb: 6,
					border: "1px solid #e0e0e0",
					borderRadius: 3,
					width: "100%",
					overflowX: "auto",
				}}
			>
				<Table sx={{ minWidth: 500 }}>
					<TableHead sx={{ backgroundColor: "#f4f6f8" }}>
						<TableRow>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Name
							</TableCell>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Email
							</TableCell>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Role
							</TableCell>
							<TableCell
								align="right"
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{users.map((u) => (
							<TableRow key={u._id}>
								<TableCell sx={{ whiteSpace: "nowrap" }}>
									{u.name}
								</TableCell>
								<TableCell sx={{ whiteSpace: "nowrap" }}>
									{u.email}
								</TableCell>
								<TableCell sx={{ whiteSpace: "nowrap" }}>
									<Chip
										label={u.role.toUpperCase()}
										color={
											u.role === "admin"
												? "error"
												: "default"
										}
										size="small"
										sx={{ fontWeight: "bold" }}
									/>
								</TableCell>
								<TableCell
									align="right"
									sx={{ whiteSpace: "nowrap" }}
								>
									<Button
										variant="outlined"
										color="error"
										size="small"
										onClick={() => handleDeleteUser(u._id)}
										disabled={u.role === "admin"}
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			{/* ========================================== */}
			{/* POSTS TABLE */}
			{/* ========================================== */}
			<Typography
				variant="h5"
				color="primary"
				fontWeight="bold"
				sx={{ mb: 2, ml: 1 }}
			>
				Manage Posts ({posts.length})
			</Typography>

			<TableContainer
				component={Paper}
				elevation={0}
				sx={{
					border: "1px solid #e0e0e0",
					borderRadius: 3,
					width: "100%",
					overflowX: "auto",
				}}
			>
				<Table sx={{ minWidth: 600 }}>
					<TableHead sx={{ backgroundColor: "#f4f6f8" }}>
						<TableRow>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Title
							</TableCell>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Author
							</TableCell>
							<TableCell
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Date Target
							</TableCell>
							<TableCell
								align="right"
								sx={{
									fontWeight: "bold",
									whiteSpace: "nowrap",
								}}
							>
								Actions
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{posts.map((p) => (
							<TableRow key={p._id}>
								<TableCell
									sx={{
										maxWidth: { xs: 150, sm: 250 },
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{p.title}
								</TableCell>
								<TableCell sx={{ whiteSpace: "nowrap" }}>
									{p.authorName}
								</TableCell>
								<TableCell sx={{ whiteSpace: "nowrap" }}>
									{p.targetDate}
								</TableCell>
								<TableCell
									align="right"
									sx={{ whiteSpace: "nowrap" }}
								>
									<Button
										variant="outlined"
										color="error"
										size="small"
										onClick={() => handleDeletePost(p._id)}
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Container>
	);
}
