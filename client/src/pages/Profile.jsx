// client/src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
	Container,
	Grid,
	Paper,
	Typography,
	TextField,
	Button,
	Avatar,
	MenuItem,
	Box,
	Alert,
	Chip,
} from "@mui/material";

function Profile({ user, setUser, setToastMessage }) {
	const { id } = useParams();
	const [profileData, setProfileData] = useState(null);
	const [error, setError] = useState(null);
	const [isSaving, setIsSaving] = useState(false);
	const [notFound, setNotFound] = useState(false);

	const isOwnProfile = user && user.id === id;

	const [formData, setFormData] = useState({
		name: "",
		skillLevel: "",
		bio: "",
		preferredPlay: "",
		racket: "",
	});

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const endpoint = isOwnProfile
					? `${import.meta.env.VITE_API_URL}/api/profile`
					: `${import.meta.env.VITE_API_URL}/api/profile/${id}`;

				const headers = isOwnProfile
					? {
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						}
					: {};

				const res = await fetch(endpoint, { headers });
				const data = await res.json();

				if (res.ok) {
					setProfileData(data);
					if (isOwnProfile) {
						setFormData({
							name: data.name || "",
							skillLevel: data.skillLevel || "D Level",
							bio: data.bio || "",
							preferredPlay: data.preferredPlay || "Any",
							racket: data.racket || "",
						});
					}
				} else {
					setNotFound(true);
				}
			} catch (err) {
				console.error("Failed to load profile", err);
				setNotFound(true);
			}
		};
		fetchProfile();
	}, [id, isOwnProfile]);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!isOwnProfile) return;

		setIsSaving(true);
		try {
			const res = await fetch(
				`${import.meta.env.VITE_API_URL}/api/profile`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify(formData),
				},
			);
			const updatedUser = await res.json();

			if (res.ok) {
				setProfileData(updatedUser);
				const newLocalUser = {
					...user,
					name: updatedUser.name,
					skillLevel: updatedUser.skillLevel,
				};
				localStorage.setItem("user", JSON.stringify(newLocalUser));
				setUser(newLocalUser);
				setToastMessage("Profile updated successfully!");
			} else {
				setError(updatedUser.message);
			}
		} catch (err) {
			setError("Failed to update profile.");
		}
		setIsSaving(false);
	};

	if (notFound)
		return (
			<Typography textAlign="center" mt={5} variant="h5">
				Player not found.
			</Typography>
		);
	if (!profileData)
		return (
			<Typography textAlign="center" mt={5}>
				Loading profile...
			</Typography>
		);

	return (
		<Container
			maxWidth={isOwnProfile ? "md" : "sm"}
			sx={{ mt: { xs: 2, md: 5 }, pb: { xs: 5, md: 10 } }}
		>
			<Typography
				variant="h4"
				color="primary"
				fontWeight="bold"
				gutterBottom
				textAlign={isOwnProfile ? "left" : "center"}
				sx={{
					fontSize: { xs: "1.8rem", md: "2.125rem" },
					mb: { xs: 3, md: 2 },
				}}
			>
				{isOwnProfile
					? "Your Profile"
					: `${profileData.name}'s Profile`}
			</Typography>

			<Grid container spacing={{ xs: 2, md: 4 }} justifyContent="center">
				<Grid item xs={12} md={isOwnProfile ? 4 : 12}>
					<Paper
						elevation={0}
						sx={{
							p: { xs: 3, md: 4 },
							borderRadius: 3,
							border: "1px solid #e0e0e0",
							textAlign: "center",
							boxShadow: isOwnProfile
								? "none"
								: "0 10px 30px rgba(0,0,0,0.05)",
						}}
					>
						<Avatar
							sx={{
								width: 100,
								height: 100,
								margin: "0 auto",
								mb: 2,
								bgcolor: "secondary.main",
								color: "primary.main",
								fontSize: "3rem",
								fontWeight: "bold",
							}}
						>
							{profileData.name.charAt(0).toUpperCase()}
						</Avatar>
						<Typography
							variant="h5"
							fontWeight="bold"
							color="primary"
						>
							{profileData.name}
						</Typography>
						<Chip
							label={profileData.skillLevel || "D Level"}
							color="primary"
							sx={{ mt: 1, mb: 2, fontWeight: "bold" }}
						/>

						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ mt: 2, mb: 1, fontStyle: "italic" }}
						>
							"{profileData.bio || "I'm ready to play!"}"
						</Typography>

						<Box
							sx={{
								mt: 3,
								textAlign: "left",
								maxWidth: "250px",
								mx: "auto",
							}}
						>
							<Typography
								variant="caption"
								color="text.secondary"
								fontWeight="bold"
							>
								PREFERRED PLAY
							</Typography>
							<Typography variant="body1" mb={2}>
								{profileData.preferredPlay || "Any"}
							</Typography>

							<Typography
								variant="caption"
								color="text.secondary"
								fontWeight="bold"
							>
								WEAPON OF CHOICE
							</Typography>
							<Typography variant="body1">
								{profileData.racket || "None specified"}
							</Typography>
						</Box>
					</Paper>
				</Grid>

				{isOwnProfile && (
					<Grid item xs={12} md={8}>
						<Paper
							elevation={0}
							sx={{
								p: { xs: 3, md: 4 },
								borderRadius: 3,
								border: "1px solid #e0e0e0",
							}}
						>
							<Typography variant="h6" fontWeight="bold" mb={3}>
								Edit Details
							</Typography>
							{error && (
								<Alert severity="error" sx={{ mb: 2 }}>
									{error}
								</Alert>
							)}

							<form onSubmit={handleSubmit}>
								<Grid container spacing={2}>
									<Grid item xs={12} sm={6}>
										<TextField
											fullWidth
											label="Display Name"
											name="name"
											value={formData.name}
											onChange={handleChange}
											required
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											select
											fullWidth
											label="Skill Level"
											name="skillLevel"
											value={formData.skillLevel}
											onChange={handleChange}
										>
											<MenuItem value="D Level">
												D Level
											</MenuItem>
											<MenuItem value="C Level">
												C Level
											</MenuItem>
											<MenuItem value="B Level">
												B Level
											</MenuItem>
										</TextField>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											select
											fullWidth
											label="Preferred Play"
											name="preferredPlay"
											value={formData.preferredPlay}
											onChange={handleChange}
										>
											<MenuItem value="Any">Any</MenuItem>
											<MenuItem value="Singles">
												Singles
											</MenuItem>
											<MenuItem value="Doubles">
												Doubles
											</MenuItem>
											<MenuItem value="Mixed">
												Mixed
											</MenuItem>
										</TextField>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											fullWidth
											label="Racket"
											name="racket"
											placeholder="e.g. Astrox 100zz"
											value={formData.racket}
											onChange={handleChange}
										/>
									</Grid>
									<Grid item xs={12}>
										<TextField
											fullWidth
											multiline
											rows={3}
											label="Bio"
											name="bio"
											placeholder="Tell the community about your playstyle..."
											value={formData.bio}
											onChange={handleChange}
										/>
									</Grid>
									<Grid item xs={12}>
										<Button
											type="submit"
											variant="contained"
											color="primary"
											size="large"
											fullWidth
											sx={{ mt: 2, fontWeight: "bold" }}
											disabled={isSaving}
										>
											{isSaving
												? "Saving..."
												: "Save Changes"}
										</Button>
									</Grid>
								</Grid>
							</form>
						</Paper>
					</Grid>
				)}
			</Grid>
		</Container>
	);
}

export default Profile;
