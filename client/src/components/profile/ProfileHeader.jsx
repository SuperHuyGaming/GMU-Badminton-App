// client/src/components/profile/ProfileHeader.jsx
import { useState, useRef } from "react";
import {
	Box,
	Paper,
	Button,
	Avatar,
	Typography,
	Divider,
	Menu,
	MenuItem,
	Dialog,
	IconButton,
} from "@mui/material";

// Clean Icons
const CameraIcon = () => (
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
		<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
		<circle cx="12" cy="13" r="4"></circle>
	</svg>
);
const CloseIcon = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<line x1="18" y1="6" x2="6" y2="18"></line>
		<line x1="6" y1="6" x2="18" y2="18"></line>
	</svg>
);

export default function ProfileHeader({
	profileData,
	isOwnProfile,
	displayProfilePic,
	displayCoverPic,
	handleImageUpload,
	activeTab,
	setActiveTab,
	friendStatus,
	handleFriendAction,
}) {
	const [avatarMenuAnchor, setAvatarMenuAnchor] = useState(null);
	const [viewerImage, setViewerImage] = useState(null);

	// Two separate refs for our hidden file inputs
	const profileInputRef = useRef(null);
	const coverInputRef = useRef(null);

	const handleAvatarClick = (e) => {
		if (isOwnProfile) {
			setAvatarMenuAnchor(e.currentTarget);
		} else if (displayProfilePic) {
			setViewerImage(displayProfilePic);
		}
	};

	// NEW: Dynamic Cover Click Logic
	const handleCoverClick = () => {
		if (isOwnProfile) {
			if (coverInputRef.current) coverInputRef.current.click();
		} else if (displayCoverPic) {
			setViewerImage(displayCoverPic);
		}
	};

	const handleCloseAvatarMenu = () => setAvatarMenuAnchor(null);

	const handleViewPicture = () => {
		setViewerImage(displayProfilePic);
		handleCloseAvatarMenu();
	};

	const handleChoosePicture = () => {
		if (profileInputRef.current) profileInputRef.current.click();
		handleCloseAvatarMenu();
	};

	return (
		<Paper
			elevation={2}
			sx={{ borderRadius: { xs: 0, md: 3 }, overflow: "hidden", mb: 3 }}
		>
			{/* --- COVER PHOTO --- */}
			<Box
				onClick={handleCoverClick}
				sx={{
					height: { xs: 200, sm: 300, md: 350 },
					backgroundColor: displayCoverPic
						? "transparent"
						: "#cfd8dc",
					backgroundImage: displayCoverPic
						? `url(${displayCoverPic})`
						: "none",
					backgroundSize: "cover",
					backgroundPosition: "center",
					position: "relative",
					cursor:
						displayCoverPic || isOwnProfile ? "pointer" : "default",
					transition: "opacity 0.2s ease-in-out",
					"&:hover": {
						opacity: displayCoverPic || isOwnProfile ? 0.9 : 1,
					},
				}}
			>
				{/* HIDDEN INPUT - NO BUTTON REQUIRED */}
				{isOwnProfile && (
					<input
						accept="image/*"
						type="file"
						ref={coverInputRef}
						style={{ display: "none" }}
						onChange={(e) => handleImageUpload(e, "coverPic")}
					/>
				)}
			</Box>

			{/* --- PROFILE BAR --- */}
			<Box
				sx={{
					px: { xs: 2, md: 5 },
					pb: 2,
					display: "flex",
					flexDirection: { xs: "column", sm: "row" },
					alignItems: { xs: "center", sm: "flex-end" },
					mt: { xs: -8, sm: -4 },
					position: "relative",
				}}
			>
				<Box
					sx={{
						position: "relative",
						mr: { sm: 3 },
						mb: { xs: 2, sm: 0 },
						width: 168,
						height: 168,
						flexShrink: 0,
					}}
				>
					<Avatar
						src={displayProfilePic}
						onClick={handleAvatarClick}
						sx={{
							width: "100%",
							height: "100%",
							border: "4px solid white",
							bgcolor: "secondary.main",
							color: "primary.main",
							fontSize: "4rem",
							fontWeight: "bold",
							boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
							cursor:
								displayProfilePic || isOwnProfile
									? "pointer"
									: "default",
						}}
					>
						{!displayProfilePic &&
							profileData.name.charAt(0).toUpperCase()}
					</Avatar>

					{isOwnProfile && (
						<>
							<input
								type="file"
								accept="image/*"
								style={{ display: "none" }}
								ref={profileInputRef}
								onChange={(e) =>
									handleImageUpload(e, "profilePic")
								}
							/>
							<Menu
								anchorEl={avatarMenuAnchor}
								open={Boolean(avatarMenuAnchor)}
								onClose={handleCloseAvatarMenu}
								slotProps={{
									paper: {
										sx: {
											borderRadius: 2,
											mt: 1,
											minWidth: 200,
										},
									},
								}}
							>
								<MenuItem
									onClick={handleViewPicture}
									sx={{ py: 1.5, fontWeight: "bold" }}
								>
									See profile picture
								</MenuItem>
								<MenuItem
									onClick={handleChoosePicture}
									sx={{ py: 1.5, fontWeight: "bold" }}
								>
									Choose profile picture
								</MenuItem>
							</Menu>
						</>
					)}
				</Box>

				<Box
					sx={{
						flexGrow: 1,
						textAlign: { xs: "center", sm: "left" },
						pb: { sm: 2 },
					}}
				>
					<Typography
						variant="h3"
						fontWeight="bold"
						sx={{
							fontSize: { xs: "2rem", sm: "2.5rem" },
							letterSpacing: "-1px",
						}}
					>
						{profileData.name}
					</Typography>
					<Typography
						variant="body1"
						color="text.secondary"
						sx={{
							mt: 0.5,
							fontStyle: "italic",
							fontSize: "1.1rem",
						}}
					>
						{profileData.bio
							? `"${profileData.bio}"`
							: "No bio added yet."}
					</Typography>
					<Typography
						variant="subtitle1"
						color="primary"
						sx={{ fontWeight: 800, mt: 0.5 }}
					>
						{profileData.skillLevel || "D Level"}
					</Typography>
				</Box>

				<Box sx={{ pb: { sm: 2 }, pt: { xs: 2, sm: 0 }, display: 'flex', gap: 1 }}>
					{isOwnProfile ? (
						<Button
							variant="contained"
							onClick={() => setActiveTab("about")}
							sx={{
								backgroundColor: "#e4e6eb",
								color: "#050505",
								fontWeight: "bold",
								textTransform: "none",
								borderRadius: 2,
								px: 2,
								py: 1,
								"&:hover": { backgroundColor: "#d8dadf" },
							}}
						>
							Edit profile
						</Button>
					) : (
						<>
							<Button
								variant="contained"
								color={friendStatus === "friends" ? "error" : "primary"}
								onClick={handleFriendAction}
								sx={{ fontWeight: "bold", borderRadius: 2, textTransform: "none" }}
							>
								{friendStatus === "friends" ? "Remove Friend" :
								 friendStatus === "request_sent" ? "Cancel Request" :
								 friendStatus === "request_received" ? "Accept Request" :
								 "Add Friend"}
							</Button>
							{friendStatus === "friends" && (
								<Button
									variant="contained"
									sx={{ bgcolor: '#e4e6eb', color: 'black', fontWeight: "bold", borderRadius: 2, textTransform: "none", "&:hover": { bgcolor: '#d8dadf' } }}
									onClick={() => window.location.href = '/messages'}
								>
									Message
								</Button>
							)}
						</>
					)}
				</Box>
			</Box>

			<Divider sx={{ mx: 2 }} />

			<Box sx={{ px: { xs: 2, md: 4 }, py: 1, display: "flex", gap: 3 }}>
				{["posts", "about"].map((tab) => (
					<Typography
						key={tab}
						onClick={() => setActiveTab(tab)}
						fontWeight="bold"
						color={activeTab === tab ? "primary" : "text.secondary"}
						sx={{
							borderBottom:
								activeTab === tab
									? "3px solid"
									: "3px solid transparent",
							pb: 1,
							px: 1,
							cursor: "pointer",
							transition: "all 0.2s",
							textTransform: "capitalize",
							"&:hover": {
								backgroundColor:
									activeTab === tab
										? "transparent"
										: "#f0f2f5",
							},
						}}
					>
						{tab}
					</Typography>
				))}
			</Box>

			{/* --- FULL SCREEN IMAGE VIEWER --- */}
			<Dialog
				open={!!viewerImage}
				onClose={() => setViewerImage(null)}
				maxWidth="lg"
				PaperProps={{
					sx: {
						bgcolor: "transparent",
						boxShadow: "none",
						overflow: "visible",
					},
				}}
			>
				<Box sx={{ position: "relative" }}>
					<IconButton
						onClick={() => setViewerImage(null)}
						sx={{
							position: "absolute",
							top: -40,
							right: -40,
							color: "white",
						}}
					>
						<CloseIcon />
					</IconButton>
					<img
						src={viewerImage}
						alt="Full View"
						style={{
							maxWidth: "100%",
							maxHeight: "85vh",
							borderRadius: "8px",
							objectFit: "contain",
						}}
					/>
				</Box>
			</Dialog>
		</Paper>
	);
}
