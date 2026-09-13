// client/src/components/profile/ProfileEditForm.jsx
import { useState } from "react";
import {
	Paper,
	Typography,
	TextField,
	MenuItem,
	Button,
	Box,
	Divider,
	Alert,
	List,
	ListItemButton,
	ListItemText,
} from "@mui/material";

export default function ProfileEditForm({
	formData,
	handleChange,
	handleSubmit,
	isSaving,
	error,
}) {
	const [activeSection, setActiveSection] = useState("general");

	return (
		<Paper
			elevation={1}
			sx={{
				borderRadius: 3,
				display: "flex",
				flexDirection: { xs: "column", md: "row" },
				overflow: "hidden",
				border: "1px solid #e0e0e0",
				width: "100%",
				minHeight: "450px",
			}}
		>
			{/* --- LEFT SIDEBAR NAVIGATION --- */}
			<Box
				sx={{
					width: { xs: "100%", md: "280px" },
					borderRight: { xs: "none", md: "1px solid #e0e0e0" },
					borderBottom: { xs: "1px solid #e0e0e0", md: "none" },
					background: "linear-gradient(to bottom, #f8fafc, #f1f5f9)",
					p: { xs: 0, md: 3 },
				}}
			>
				<Typography
					variant="h6"
					fontWeight="800"
					color="primary"
					sx={{
						mb: 2,
						px: 2,
						pt: { xs: 2, md: 0 },
						display: { xs: "none", md: "flex" },
						alignItems: "center",
						gap: 1
					}}
				>
					⚙️ Settings
				</Typography>
				<Divider sx={{ mb: 2, display: { xs: "none", md: "block" } }} />
				<List
					component="nav"
					sx={{
						display: "flex",
						flexDirection: { xs: "row", md: "column" },
						overflowX: { xs: "auto", md: "visible" },
						p: { xs: 1, md: 0 },
						gap: 1,
					}}
				>
					<ListItemButton
						selected={activeSection === "general"}
						onClick={() => setActiveSection("general")}
						sx={{
							borderRadius: 2,
							mb: { xs: 0, md: 1 },
							whiteSpace: "nowrap",
							justifyContent: "center",
							transition: "all 0.2s",
							bgcolor: activeSection === "general" ? "rgba(0, 102, 51, 0.1) !important" : "transparent",
							color: activeSection === "general" ? "primary.main" : "text.secondary",
							"&:hover": {
								bgcolor: "rgba(0, 102, 51, 0.05)",
							}
						}}
					>
						<ListItemText
							primary="👤 General Info"
							primaryTypographyProps={{
								fontWeight: activeSection === "general" ? "bold" : "medium",
							}}
						/>
					</ListItemButton>
					<ListItemButton
						selected={activeSection === "badminton"}
						onClick={() => setActiveSection("badminton")}
						sx={{
							borderRadius: 2,
							mb: { xs: 0, md: 1 },
							whiteSpace: "nowrap",
							justifyContent: "center",
							transition: "all 0.2s",
							bgcolor: activeSection === "badminton" ? "rgba(0, 102, 51, 0.1) !important" : "transparent",
							color: activeSection === "badminton" ? "primary.main" : "text.secondary",
							"&:hover": {
								bgcolor: "rgba(0, 102, 51, 0.05)",
							}
						}}
					>
						<ListItemText
							primary="🏸 Player Profile"
							primaryTypographyProps={{
								fontWeight: activeSection === "badminton" ? "bold" : "medium",
							}}
						/>
					</ListItemButton>
				</List>
			</Box>

			{/* --- RIGHT CONTENT PANE --- */}
			<Box
				sx={{
					flexGrow: 1,
					p: { xs: 3, md: 5 },
					backgroundColor: "#fff",
				}}
			>
				{error && (
					<Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
						{error}
					</Alert>
				)}

				<form
					onSubmit={handleSubmit}
					style={{
						height: "100%",
						display: "flex",
						flexDirection: "column",
					}}
				>
					{/* SECTION 1: GENERAL INFO */}
					{activeSection === "general" && (
						<Box sx={{ flexGrow: 1 }}>
							<Typography variant="h5" fontWeight="800" mb={1}>
								General Information
							</Typography>
							<Typography variant="body2" color="text.secondary" mb={4}>
								Update your personal details and how they appear to the community.
							</Typography>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: 4,
								}}
							>
								<TextField
									fullWidth
									label="Display Name"
									name="name"
									value={formData.name}
									onChange={handleChange}
									required
									variant="outlined"
									InputProps={{
										sx: { borderRadius: 2 }
									}}
								/>
								<TextField
									fullWidth
									multiline
									rows={5}
									label="Bio"
									name="bio"
									placeholder="Tell the community about yourself..."
									value={formData.bio}
									onChange={handleChange}
									variant="outlined"
									InputProps={{
										sx: { borderRadius: 2 }
									}}
								/>
							</Box>
						</Box>
					)}

					{/* SECTION 2: BADMINTON PROFILE */}
					{activeSection === "badminton" && (
						<Box sx={{ flexGrow: 1 }}>
							<Typography variant="h5" fontWeight="800" mb={1}>
								Player Profile
							</Typography>
							<Typography variant="body2" color="text.secondary" mb={4}>
								Let others know your play style to find the best match-ups!
							</Typography>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: 4,
								}}
							>
								<Box
									sx={{
										display: "flex",
										gap: 3,
										flexDirection: {
											xs: "column",
											sm: "row",
										},
									}}
								>
									<TextField
										select
										fullWidth
										label="Skill Level"
										name="skillLevel"
										value={formData.skillLevel}
										onChange={handleChange}
										InputProps={{ sx: { borderRadius: 2 } }}
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
									<TextField
										select
										fullWidth
										label="Preferred Play"
										name="preferredPlay"
										value={formData.preferredPlay}
										onChange={handleChange}
										InputProps={{ sx: { borderRadius: 2 } }}
									>
										<MenuItem value="Any">Any Format</MenuItem>
										<MenuItem value="Singles">
											Singles
										</MenuItem>
										<MenuItem value="Doubles">
											Doubles
										</MenuItem>
										<MenuItem value="Mixed">Mixed Doubles</MenuItem>
									</TextField>
								</Box>
								<TextField
									fullWidth
									label="Weapon of Choice (Racket)"
									name="racket"
									placeholder="e.g. Yonex Astrox 100zz"
									value={formData.racket}
									onChange={handleChange}
									variant="outlined"
									InputProps={{ sx: { borderRadius: 2 } }}
								/>
							</Box>
						</Box>
					)}

					{/* ALWAYS VISIBLE SAVE BUTTON */}
					<Divider sx={{ mt: 4, mb: 3 }} />
					<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
						<Button
							type="submit"
							variant="contained"
							color="primary"
							size="large"
							disableElevation
							sx={{
								fontWeight: "bold",
								px: 4,
								py: 1.2,
								borderRadius: 2,
							}}
							disabled={isSaving}
						>
							{isSaving ? "Saving..." : "Save Changes"}
						</Button>
					</Box>
				</form>
			</Box>
		</Paper>
	);
}
