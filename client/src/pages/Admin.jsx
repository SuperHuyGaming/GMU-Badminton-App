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
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions as MuiDialogActions,
} from "@mui/material";

// Sleek Trash Icon
const TrashIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="3 6 5 6 21 6"></polyline>
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
	</svg>
);

export default function Admin() {
	const [users, setUsers] = useState([]);
	const [posts, setPosts] = useState([]);
	const [flaggedPosts, setFlaggedPosts] = useState([]);

	// NEW: Centralized Sleek Delete Confirmation State
	const [deleteConfirm, setDeleteConfirm] = useState({
		open: false,
		type: "",
		id: null,
	});

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
				setPosts([post, ...posts]);
			}
		} catch (err) {
			console.error(err);
		}
	};

	// NEW: Execution function that runs from the Modal
	const executeDelete = async () => {
		const { type, id } = deleteConfirm;
		if (!id) return;

		try {
			if (type === "user") {
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
			} else if (type === "post") {
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
			} else if (type === "spam") {
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
			}
		} catch (err) {
			console.error(err);
		}

		setDeleteConfirm({ open: false, type: "", id: null }); // Close modal
	};

	const promptDelete = (type, id) =>
		setDeleteConfirm({ open: true, type, id });

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

			{/* MODERATION QUEUE */}
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
										promptDelete("spam", post._id)
									}
									sx={{
										fontWeight: "bold",
										textTransform: "none",
									}}
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
										textTransform: "none",
									}}
								>
									Approve (Not Spam)
								</Button>
							</Box>
						</Paper>
					))}
				</Box>
			)}

			{/* USERS TABLE */}
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
										onClick={() =>
											promptDelete("user", u._id)
										}
										disabled={u.role === "admin"}
										sx={{
											textTransform: "none",
											fontWeight: "bold",
										}}
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			{/* POSTS TABLE */}
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
										onClick={() =>
											promptDelete("post", p._id)
										}
										sx={{
											textTransform: "none",
											fontWeight: "bold",
										}}
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			{/* SLEEK DELETE CONFIRMATION DIALOG */}
			<Dialog
				open={deleteConfirm.open}
				onClose={() =>
					setDeleteConfirm({ open: false, type: "", id: null })
				}
				PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
			>
				<DialogTitle
					sx={{
						fontWeight: "bold",
						display: "flex",
						alignItems: "center",
						gap: 1,
						color: "error.main",
					}}
				>
					<TrashIcon /> Confirm Deletion
				</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to permanently delete this{" "}
						{deleteConfirm.type === "user"
							? "user"
							: deleteConfirm.type === "spam"
								? "spam post"
								: "post"}
						? This action cannot be undone.
					</Typography>
				</DialogContent>
				<MuiDialogActions sx={{ px: 3, pb: 2 }}>
					<Button
						onClick={() =>
							setDeleteConfirm({
								open: false,
								type: "",
								id: null,
							})
						}
						color="inherit"
						sx={{ fontWeight: "bold", textTransform: "none" }}
					>
						Cancel
					</Button>
					<Button
						onClick={executeDelete}
						variant="contained"
						color="error"
						sx={{
							fontWeight: "bold",
							textTransform: "none",
							borderRadius: 2,
						}}
					>
						Delete
					</Button>
				</MuiDialogActions>
			</Dialog>
		</Container>
	);
}
