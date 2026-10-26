// client/src/components/MediaLightbox.jsx
import React, { useEffect, useCallback } from "react";
import {
	Dialog,
	Box,
	IconButton,
	Typography,
	Chip,
	Avatar,
} from "@mui/material";
import { CloseIcon } from "./Icons";

export default function MediaLightbox({
	open,
	onClose,
	images = [],
	initialIndex = 0,
	title = "",
	authorName = "",
	authorPic = "",
}) {
	const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCurrentIndex(initialIndex);
	}, [initialIndex, open]);

	const total = images.length;

	const handlePrev = useCallback(() => {
		setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
	}, [total]);

	const handleNext = useCallback(() => {
		setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
	}, [total]);

	// Keyboard arrow navigation
	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (e) => {
			if (e.key === "ArrowLeft") handlePrev();
			else if (e.key === "ArrowRight") handleNext();
			else if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, handlePrev, handleNext, onClose]);

	if (!images || images.length === 0) return null;

	const currentUrl = images[currentIndex] || "";

	return (
		<Dialog
			open={open}
			onClose={onClose}
			disableRestoreFocus
			maxWidth={false}
			fullScreen
			slotProps={{
				paper: {
					sx: {
						bgcolor: "rgba(10, 15, 12, 0.94)",
						backdropFilter: "blur(20px)",
						boxShadow: "none",
						color: "white",
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						overflow: "hidden",
					},
				},
			}}
		>
			{/* TOP BAR */}
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					px: { xs: 2, md: 4 },
					py: 2,
					zIndex: 10,
					background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
					{authorPic ? (
						<Avatar src={authorPic} alt={authorName} sx={{ width: 36, height: 36 }} />
					) : authorName ? (
						<Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
							{authorName.charAt(0).toUpperCase()}
						</Avatar>
					) : null}
					<Box>
						<Typography variant="subtitle2" fontWeight="bold" color="white">
							{authorName || "GMU Badminton"}
						</Typography>
						{title && (
							<Typography
								variant="caption"
								sx={{
									color: "rgba(255,255,255,0.7)",
									maxWidth: { xs: 200, sm: 400 },
									display: "block",
									textOverflow: "ellipsis",
									overflow: "hidden",
									whiteSpace: "nowrap",
								}}
							>
								{title}
							</Typography>
						)}
					</Box>
				</Box>

				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					{total > 1 && (
						<Chip
							label={`${currentIndex + 1} / ${total}`}
							size="small"
							sx={{
								bgcolor: "rgba(255, 255, 255, 0.15)",
								color: "white",
								fontWeight: "bold",
								backdropFilter: "blur(5px)",
							}}
						/>
					)}
					
					<IconButton
						aria-label="Download image"
						component="a"
						href={currentUrl}
						download={`badminton-photo-${currentIndex + 1}.jpg`}
						target="_blank"
						rel="noopener noreferrer"
						data-testid="download-photo-btn"
						sx={{
							color: "white",
							bgcolor: "rgba(255, 255, 255, 0.1)",
							"&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
						}}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="7 10 12 15 17 10"></polyline>
							<line x1="12" y1="15" x2="12" y2="3"></line>
						</svg>
					</IconButton>
					<IconButton
						aria-label="Close fullscreen gallery"
						onClick={onClose}
						sx={{
							color: "white",
							bgcolor: "rgba(255, 255, 255, 0.1)",
							"&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
						}}
					>
						<CloseIcon />
					</IconButton>
				</Box>
			</Box>

			{/* MAIN IMAGE DISPLAY WITH PREV/NEXT ARROWS */}
			<Box
				sx={{
					position: "relative",
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					px: { xs: 1, sm: 6 },
					overflow: "hidden",
				}}
			>
				{total > 1 && (
					<IconButton
						aria-label="Previous image"
						onClick={handlePrev}
						sx={{
							position: "absolute",
							left: { xs: 8, sm: 24 },
							zIndex: 10,
							color: "white",
							bgcolor: "rgba(0, 0, 0, 0.5)",
							p: 1.5,
							"&:hover": { bgcolor: "rgba(0, 102, 51, 0.8)", transform: "scale(1.1)" },
							transition: "all 0.2s ease",
						}}
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="15 18 9 12 15 6"></polyline>
						</svg>
					</IconButton>
				)}

				<Box
					component="img"
					src={currentUrl}
					alt={`Media attachment ${currentIndex + 1}`}
					sx={{
						maxHeight: { xs: "70vh", md: "78vh" },
						maxWidth: "92vw",
						objectFit: "contain",
						borderRadius: 2,
						boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
						animation: "fadeIn 0.25s ease-in-out",
						"@keyframes fadeIn": {
							from: { opacity: 0.3, transform: "scale(0.98)" },
							to: { opacity: 1, transform: "scale(1)" },
						},
					}}
				/>

				{total > 1 && (
					<IconButton
						aria-label="Next image"
						onClick={handleNext}
						sx={{
							position: "absolute",
							right: { xs: 8, sm: 24 },
							zIndex: 10,
							color: "white",
							bgcolor: "rgba(0, 0, 0, 0.5)",
							p: 1.5,
							"&:hover": { bgcolor: "rgba(0, 102, 51, 0.8)", transform: "scale(1.1)" },
							transition: "all 0.2s ease",
						}}
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
					</IconButton>
				)}
			</Box>

			{/* BOTTOM THUMBNAIL STRIP (for multiple images) */}
			{total > 1 && (
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						gap: 1.5,
						py: 2,
						px: 2,
						overflowX: "auto",
						background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
					}}
				>
					{images.map((url, idx) => (
						<Box
							key={idx}
							role="button"
							tabIndex={0}
							aria-label={`Jump to photo ${idx + 1}`}
							onClick={() => setCurrentIndex(idx)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setCurrentIndex(idx);
								}
							}}
							sx={{
								width: 56,
								height: 56,
								borderRadius: 2,
								overflow: "hidden",
								cursor: "pointer",
								border: idx === currentIndex ? "3px solid #00B359" : "2px solid rgba(255,255,255,0.2)",
								opacity: idx === currentIndex ? 1 : 0.5,
								transform: idx === currentIndex ? "scale(1.08)" : "scale(1)",
								transition: "all 0.2s ease",
								"&:hover": { opacity: 0.9 },
								flexShrink: 0,
							}}
						>
							<img
								src={url}
								alt={`Thumb ${idx + 1}`}
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						</Box>
					))}
				</Box>
			)}
		</Dialog>
	);
}
