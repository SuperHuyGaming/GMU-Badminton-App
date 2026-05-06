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
	// NEW: State to track which menu item is clicked in the sidebar
	const [activeSection, setActiveSection] = useState("general");

	return (
		<Paper
			elevation={1}
			sx={{
				borderRadius: 3,
				display: "flex",
				flexDirection: { xs: "column", md: "row" },
				overflow: "hidden", // Keeps the sidebar flush with the rounded corners
				border: "1px solid #e0e0e0",
				width: "100%",
				minHeight: "450px", // Gives the dashboard a solid, substantial height
			}}
		>
			{/* --- LEFT SIDEBAR NAVIGATION --- */}
			<Box
				sx={{
					width: { xs: "100%", md: "280px" },
					borderRight: { xs: "none", md: "1px solid #e0e0e0" },
					borderBottom: { xs: "1px solid #e0e0e0", md: "none" },
					backgroundColor: "#fff",
					p: 2,
				}}
			>
				<Typography
					variant="h6"
					fontWeight="bold"
					sx={{ mb: 1, px: 2 }}
				>
					About
				</Typography>
				<List disablePadding>
					{/* GENERAL INFO TAB */}
					<ListItemButton
						onClick={() => setActiveSection("general")}
						sx={{
							borderRadius: 2,
							mb: 0.5,
							backgroundColor:
								activeSection === "general"
									? "rgba(0, 102, 51, 0.1)" // GMU Green with transparency
									: "transparent",
							color:
								activeSection === "general"
									? "primary.main"
									: "text.primary",
							"&:hover": {
								backgroundColor:
									activeSection === "general"
										? "rgba(0, 102, 51, 0.15)"
										: "#f0f2f5",
							},
						}}
					>
						<ListItemText
							primary="General Info"
							primaryTypographyProps={{
								fontWeight:
									activeSection === "general"
										? "bold"
										: "medium",
							}}
						/>
					</ListItemButton>

					{/* BADMINTON PROFILE TAB */}
					<ListItemButton
						onClick={() => setActiveSection("badminton")}
						sx={{
							borderRadius: 2,
							backgroundColor:
								activeSection === "badminton"
									? "rgba(0, 102, 51, 0.1)"
									: "transparent",
							color:
								activeSection === "badminton"
									? "primary.main"
									: "text.primary",
							"&:hover": {
								backgroundColor:
									activeSection === "badminton"
										? "rgba(0, 102, 51, 0.15)"
										: "#f0f2f5",
							},
						}}
					>
						<ListItemText
							primary="Player Profile"
							primaryTypographyProps={{
								fontWeight:
									activeSection === "badminton"
										? "bold"
										: "medium",
							}}
						/>
					</ListItemButton>
				</List>
			</Box>

			{/* --- RIGHT CONTENT PANE --- */}
			<Box
				sx={{
					flexGrow: 1,
					p: { xs: 3, md: 4 },
					backgroundColor: "#fff",
				}}
			>
				{error && (
					<Alert severity="error" sx={{ mb: 3 }}>
						{error}
					</Alert>
				)}

				{/* The form wraps both sections so the Save button always works */}
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
							<Typography variant="h6" fontWeight="bold" mb={3}>
								General Information
							</Typography>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: 3,
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
								/>
								<TextField
									fullWidth
									multiline
									rows={4}
									label="Bio"
									name="bio"
									placeholder="Tell the community about yourself..."
									value={formData.bio}
									onChange={handleChange}
									variant="outlined"
								/>
							</Box>
						</Box>
					)}

					{/* SECTION 2: BADMINTON PROFILE */}
					{activeSection === "badminton" && (
						<Box sx={{ flexGrow: 1 }}>
							<Typography variant="h6" fontWeight="bold" mb={3}>
								Player Profile
							</Typography>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: 3,
								}}
							>
								<Box
									sx={{
										display: "flex",
										gap: 2,
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
										<MenuItem value="Mixed">Mixed</MenuItem>
									</TextField>
								</Box>
								<TextField
									fullWidth
									label="Weapon of Choice (Racket)"
									name="racket"
									placeholder="e.g. Astrox 100zz"
									value={formData.racket}
									onChange={handleChange}
									variant="outlined"
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
								transition: "all 0.15s ease",
								"&:active": { transform: "scale(0.96)" }, // Tactile feedback on save!
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
