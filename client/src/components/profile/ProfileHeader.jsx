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
	DialogContent,
} from "@mui/material";

export default function ProfileHeader({
	profileData,
	isOwnProfile,
	displayProfilePic,
	displayCoverPic,
	handleImageUpload,
	activeTab,
	setActiveTab,
}) {
	const [avatarMenuAnchor, setAvatarMenuAnchor] = useState(null);
	const isAvatarMenuOpen = Boolean(avatarMenuAnchor);
	const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
	const fileInputRef = useRef(null);

	const handleAvatarClick = (e) => {
		if (isOwnProfile) setAvatarMenuAnchor(e.currentTarget);
		else if (displayProfilePic) setIsImageViewerOpen(true);
	};

	const handleCloseAvatarMenu = () => setAvatarMenuAnchor(null);
	const handleViewPicture = () => {
		setIsImageViewerOpen(true);
		handleCloseAvatarMenu();
	};
	const handleChoosePicture = () => {
		if (fileInputRef.current) fileInputRef.current.click();
		handleCloseAvatarMenu();
	};

	return (
		<Paper
			elevation={2}
			sx={{ borderRadius: { xs: 0, md: 3 }, overflow: "hidden", mb: 3 }}
		>
			<Box
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
				}}
			>
				{isOwnProfile && (
					<>
						<input
							accept="image/*"
							id="cover-upload"
							type="file"
							style={{ display: "none" }}
							onChange={(e) => handleImageUpload(e, "coverPic")}
						/>
						<label htmlFor="cover-upload">
							<Button
								variant="contained"
								component="span"
								sx={{
									position: "absolute",
									bottom: 16,
									right: 16,
									backgroundColor: "white",
									color: "black",
									fontWeight: "bold",
									textTransform: "none",
									borderRadius: 2,
									boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
									transition: "all 0.15s ease", // Smooth hover
									"&:hover": { backgroundColor: "#f0f2f5" },
									"&:active": { transform: "scale(0.96)" }, // TACTILE CLICK FEEDBACK!
								}}
							>
								<Box
									component="span"
									sx={{ mr: 1, fontSize: "1.1rem" }}
								>
									📷
								</Box>{" "}
								Edit cover photo
							</Button>
						</label>
					</>
				)}
			</Box>

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
						onClick={!isOwnProfile ? handleAvatarClick : undefined}
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
								!isOwnProfile && displayProfilePic
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
								ref={fileInputRef}
								onChange={(e) =>
									handleImageUpload(e, "profilePic")
								}
							/>
							<Box
								onClick={handleAvatarClick}
								sx={{
									position: "absolute",
									top: 4,
									left: 4,
									right: 4,
									bottom: 4,
									borderRadius: "50%",
									backgroundColor: "rgba(0,0,0,0.4)",
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									opacity: 0,
									transition: "opacity 0.2s ease-in-out",
									cursor: "pointer",
									"&:hover": { opacity: 1 },
								}}
							>
								<Typography
									color="white"
									sx={{ fontSize: "2rem" }}
								>
									📷
								</Typography>
							</Box>
							<Menu
								anchorEl={avatarMenuAnchor}
								open={isAvatarMenuOpen}
								onClose={handleCloseAvatarMenu}
								PaperProps={{
									sx: {
										borderRadius: 2,
										mt: 1,
										minWidth: 200,
										boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
									},
								}}
							>
								<MenuItem
									onClick={handleViewPicture}
									sx={{ py: 1.5, fontWeight: "bold" }}
								>
									👤 See profile picture
								</MenuItem>
								<MenuItem
									onClick={handleChoosePicture}
									sx={{ py: 1.5, fontWeight: "bold" }}
								>
									🖼️ Choose profile picture
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

				{isOwnProfile && (
					<Box sx={{ pb: { sm: 2 }, pt: { xs: 2, sm: 0 } }}>
						<Button
							variant="contained"
							onClick={() => setActiveTab("about")}
							disableElevation
							sx={{
								backgroundColor: "#e4e6eb",
								color: "#050505",
								fontWeight: "bold",
								textTransform: "none",
								borderRadius: 2,
								px: 2,
								py: 1,
								transition: "all 0.15s ease",
								"&:hover": { backgroundColor: "#d8dadf" },
								"&:active": { transform: "scale(0.96)" }, // TACTILE CLICK FEEDBACK!
							}}
						>
							<Box component="span" sx={{ mr: 1 }}>
								✏️
							</Box>{" "}
							Edit profile
						</Button>
					</Box>
				)}
			</Box>

			<Divider sx={{ mx: 2 }} />

			<Box
				sx={{
					px: { xs: 2, md: 4 },
					py: 1,
					display: "flex",
					gap: 3,
					overflowX: "auto",
				}}
			>
				<Typography
					onClick={() => setActiveTab("posts")}
					fontWeight="bold"
					color={activeTab === "posts" ? "primary" : "text.secondary"}
					sx={{
						borderBottom:
							activeTab === "posts"
								? "3px solid"
								: "3px solid transparent",
						pb: 1,
						px: 1,
						cursor: "pointer",
						borderRadius: "4px 4px 0 0",
						transition: "all 0.2s",
						"&:hover": {
							backgroundColor:
								activeTab === "posts"
									? "transparent"
									: "#f0f2f5",
						},
					}}
				>
					Posts
				</Typography>
				<Typography
					onClick={() => setActiveTab("about")}
					fontWeight="bold"
					color={activeTab === "about" ? "primary" : "text.secondary"}
					sx={{
						borderBottom:
							activeTab === "about"
								? "3px solid"
								: "3px solid transparent",
						pb: 1,
						px: 1,
						cursor: "pointer",
						borderRadius: "4px 4px 0 0",
						transition: "all 0.2s",
						"&:hover": {
							backgroundColor:
								activeTab === "about"
									? "transparent"
									: "#f0f2f5",
						},
					}}
				>
					About
				</Typography>
			</Box>

			<Dialog
				open={isImageViewerOpen}
				onClose={() => setIsImageViewerOpen(false)}
				maxWidth="md"
				fullWidth
			>
				<DialogContent
					sx={{
						p: 0,
						backgroundColor: "black",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: "50vh",
					}}
				>
					{displayProfilePic ? (
						<img
							src={displayProfilePic}
							alt="Profile"
							style={{
								maxWidth: "100%",
								maxHeight: "85vh",
								objectFit: "contain",
							}}
						/>
					) : (
						<Typography color="white" p={5}>
							No profile picture uploaded.
						</Typography>
					)}
				</DialogContent>
			</Dialog>
		</Paper>
	);
}
