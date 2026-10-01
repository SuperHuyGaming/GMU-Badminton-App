import { Paper, Typography, Box, IconButton } from "@mui/material";
// import RacketViewer from "./RacketViewer";

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
	onFriendsClick,
}) {
	return (
		<Paper
			elevation={2}
			sx={{ p: 3, borderRadius: 3, position: "sticky", top: 20 }}
		>
			<Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
				<Box 
					onClick={onFriendsClick}
					sx={{ 
						p: 2, 
						bgcolor: 'background.paper', 
						borderRadius: '12px', 
						textAlign: 'center', 
						border: '1px solid', 
						borderColor: 'divider', 
						borderTop: '6px solid', 
						borderTopColor: 'primary.main', 
						boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
						cursor: 'pointer',
						transition: 'all 0.2s ease',
						'&:hover': {
							transform: 'translateY(-2px)',
							boxShadow: '0 6px 16px rgba(0,0,0,0.1)'
						}
					}}
				>
					<Typography variant="h5" fontWeight="900" color="text.primary">{profileData.friends?.length || 0}</Typography>
					<Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Friends</Typography>
				</Box>
				<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: '12px', textAlign: 'center', border: '1px solid', borderColor: 'divider', borderTop: '6px solid', borderTopColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
					<Typography variant="h5" fontWeight="900" color="text.primary">{profileData.skillLevel || 'New'}</Typography>
					<Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Level</Typography>
				</Box>
				<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: '12px', textAlign: 'center', border: '1px solid', borderColor: 'divider', borderTop: '6px solid', borderTopColor: 'secondary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
					<Typography variant="h5" fontWeight="900" color="text.primary">{profileData.stats?.totalMatches || 0}</Typography>
					<Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Matches</Typography>
				</Box>
				<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: '12px', textAlign: 'center', border: '1px solid', borderColor: 'divider', borderTop: '6px solid', borderTopColor: 'secondary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
					<Typography variant="h5" fontWeight="900" color="error">{profileData.stats?.winStreak || 0} 🔥</Typography>
					<Typography variant="caption" color="text.primary" sx={{ textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>Win Streak</Typography>
				</Box>
			</Box>

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
							aria-label="Edit profile info"
							className="edit-btn"
							onClick={onEditClick}
							size="small"
							sx={{
								opacity: { xs: 1, sm: 0 }, // Always visible on mobile, hidden on desktop until hover
								backgroundColor: "action.hover",
								transition: "opacity 0.2s",
								"&:hover": { backgroundColor: "action.selected" },
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
							aria-label="Edit weapon info"
							className="edit-btn"
							onClick={onEditClick}
							size="small"
							sx={{
								opacity: { xs: 1, sm: 0 },
								backgroundColor: "action.hover",
								transition: "opacity 0.2s",
								"&:hover": { backgroundColor: "action.selected" },
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

			{/* 
			<Box sx={{ mt: 3 }}>
				<RacketViewer />
			</Box>
			*/}
		</Paper>
	);
}
