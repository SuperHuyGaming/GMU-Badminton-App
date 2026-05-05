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
				`${import.meta.env.VITE_API_URL}/api/admin/posts`,,
				{ headers },
			);
			if (postRes.ok) setPosts(await postRes.json());
		} catch (err) {
			console.error("Failed to fetch admin data", err);
		}
	};

	useEffect(() => {
		fetchAdminData();
	}, []);

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
		// NEW: Reduced padding on mobile (xs) to maximize screen width for the tables
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
					sx={{ fontSize: { xs: "2.2rem", md: "3rem" } }} // NEW: Scaled font for mobile
				>
					Admin Tab
				</Typography>
				<Typography variant="h6" color="text.secondary">
					Platform Administration Hub
				</Typography>
			</Box>

			{/* USERS TABLE */}
			<Typography
				variant="h5"
				color="primary"
				fontWeight="bold"
				sx={{ mb: 2, ml: 1 }}
			>
				Manage Users ({users.length})
			</Typography>

			{/* NEW: overflowX: "auto" makes the table swipeable! */}
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
					{" "}
					{/* Forces minimum width so it doesn't squish */}
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
					{" "}
					{/* Forces minimum width */}
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
