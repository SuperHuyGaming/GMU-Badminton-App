import { Paper, Typography, Box, IconButton } from "@mui/material";

const PenIcon = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 20h9"></path>
		<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
	</svg>
);

export default function ProfileIntro({
	profileData,
	isOwnProfile,
	onEditClick,
}) {
	return (
		<Paper
			elevation={2}
			sx={{ p: 3, borderRadius: 3, position: "sticky", top: 20 }}
		>
			<Typography variant="h6" fontWeight="bold" mb={2}>
				Intro
			</Typography>

			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				{/* Plays Row - Pencil hides until hover! */}
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						p: 1,
						borderRadius: 2,
						ml: -1,
						mr: -1,
						transition: "background-color 0.2s",
						"&:hover": {
							backgroundColor: isOwnProfile
								? "rgba(0,0,0,0.03)"
								: "transparent",
						},
						"&:hover .edit-btn": { opacity: 1 }, // Reveals the pencil on hover
					}}
				>
					<Box
						sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
					>
						<Typography fontSize="1.2rem">🏸</Typography>
						<Typography>
							<strong>Plays:</strong>{" "}
							{profileData.preferredPlay || "Any"}
						</Typography>
					</Box>
					{isOwnProfile && (
						<IconButton
							className="edit-btn"
							onClick={onEditClick}
							size="small"
							sx={{
								opacity: { xs: 1, sm: 0 }, // Always visible on mobile, hidden on desktop until hover
								backgroundColor: "#e4e6eb",
								transition: "opacity 0.2s",
								"&:hover": { backgroundColor: "#d8dadf" },
							}}
						>
							<PenIcon />
						</IconButton>
					)}
				</Box>

				{/* Weapon Row - Pencil hides until hover! */}
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						p: 1,
						borderRadius: 2,
						ml: -1,
						mr: -1,
						transition: "background-color 0.2s",
						"&:hover": {
							backgroundColor: isOwnProfile
								? "rgba(0,0,0,0.03)"
								: "transparent",
						},
						"&:hover .edit-btn": { opacity: 1 },
					}}
				>
					<Box
						sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
					>
						<Typography fontSize="1.2rem">🎾</Typography>
						<Typography>
							<strong>Weapon:</strong>{" "}
							{profileData.racket || "Not specified"}
						</Typography>
					</Box>
					{isOwnProfile && (
						<IconButton
							className="edit-btn"
							onClick={onEditClick}
							size="small"
							sx={{
								opacity: { xs: 1, sm: 0 },
								backgroundColor: "#e4e6eb",
								transition: "opacity 0.2s",
								"&:hover": { backgroundColor: "#d8dadf" },
							}}
						>
							<PenIcon />
						</IconButton>
					)}
				</Box>

				{/* Joined Row */}
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						p: 1,
						ml: -1,
					}}
				>
					<Typography fontSize="1.2rem">📅</Typography>
					<Typography>Joined recently</Typography>
				</Box>
			</Box>
		</Paper>
	);
}
