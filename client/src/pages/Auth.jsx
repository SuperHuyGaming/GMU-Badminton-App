// client/src/pages/Auth.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	Container,
	Paper,
	Typography,
	TextField,
	Button,
	Box,
	MenuItem,
	Alert,
	Tabs,
	Tab,
} from "@mui/material";

import { useAuth } from "../context/AuthContext";

function Auth() {
	const [isLogin, setIsLogin] = useState(true);
	const navigate = useNavigate();
	const { login } = useAuth();
	const [error, setError] = useState(null);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		skillLevel: "D Level",
	});

	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (isSubmitting) return;
		setError(null);
		setIsSubmitting(true);

		const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

		try {
			const response = await fetch(
				`${import.meta.env.VITE_API_URL}${endpoint}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(formData),
				},
			);

			const data = await response.json();
			if (!response.ok)
				throw new Error(data.message || "Something went wrong.");

			// INSTANT UI UPDATES using the central login method
			const welcomeMsg = isLogin ? `Welcome back, ${data.user.name}!` : `Welcome to the courts, ${data.user.name}!`;
			login(data.user, data.accessToken, data.refreshToken, welcomeMsg);

			navigate("/");
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		// NEW: mt: 8 becomes mt: { xs: 4, md: 8 }
		<Container
			maxWidth="sm"
			sx={{ mt: { xs: 4, md: 8 }, px: { xs: 2, sm: 3 } }}
		>
			{/* NEW: p: 5 becomes p: { xs: 3, md: 5 } */}
			<Paper
				elevation={3}
				sx={{
					p: { xs: 3, md: 5 },
					borderRadius: 4,
					textAlign: "center",
				}}
			>
				<Typography
					variant="h4"
					color="primary"
					sx={{
						fontWeight: "bold",
						mb: 1,
						fontSize: { xs: "1.75rem", sm: "2.125rem" },
					}}
				>
					{isLogin ? "Welcome Back" : "Join the Community"}
				</Typography>
				<Typography
					variant="body1"
					color="text.secondary"
					sx={{ mb: 3 }}
				>
					{isLogin
						? "Log in to view the schedule and forum."
						: "Create an account to start playing."}
				</Typography>

				{/* NEW: Safe, clear Tabs at the top to prevent accidental clicks */}
				<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
					<Tabs
						value={isLogin ? 0 : 1}
						onChange={(e, newValue) => {
							setIsLogin(newValue === 0);
							setError(null);
						}}
						variant="fullWidth"
						textColor="primary"
						indicatorColor="primary"
					>
						<Tab
							label="Login"
							sx={{ fontWeight: "bold", fontSize: "1rem" }}
						/>
						<Tab
							label="Sign Up"
							sx={{ fontWeight: "bold", fontSize: "1rem" }}
						/>
					</Tabs>
				</Box>

				{error && (
					<Alert severity="error" sx={{ mb: 3 }}>
						{error}
					</Alert>
				)}

				<form onSubmit={handleSubmit}>
					{!isLogin && (
						<TextField
							fullWidth
							label="Full Name or Nickname"
							name="name"
							value={formData.name}
							onChange={handleChange}
							margin="normal"
							required
						/>
					)}

					<TextField
						fullWidth
						label="Email Address"
						type="email"
						autoComplete="username"
						name="email"
						value={formData.email}
						onChange={handleChange}
						margin="normal"
						required
					/>

					<TextField
						fullWidth
						label="Password"
						type="password"
						autoComplete="current-password"
						name="password"
						value={formData.password}
						onChange={handleChange}
						margin="normal"
						required
					/>

					{!isLogin && (
						<TextField
							select
							fullWidth
							label="Your Skill Level"
							name="skillLevel"
							value={formData.skillLevel}
							onChange={handleChange}
							margin="normal"
							required
						>
							<MenuItem value="D Level">
								D Level (Beginner)
							</MenuItem>
							<MenuItem value="C Level">
								C Level (Intermediate)
							</MenuItem>
							<MenuItem value="B Level">
								B Level (Advanced)
							</MenuItem>
						</TextField>
					)}

					<Button
						type="submit"
						fullWidth
						variant="contained"
						color="primary"
						size="large"
						disabled={isSubmitting}
						sx={{ mt: 4, mb: 2, fontWeight: "bold", py: 1.5 }}
					>
						{isSubmitting ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
					</Button>
				</form>
			</Paper>
		</Container>
	);
}

export default Auth;
