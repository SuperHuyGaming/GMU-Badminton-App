// client/src/components/LinkPreviewCard.jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { Box, Paper, Typography, IconButton, Tooltip, Chip } from "@mui/material";

export default function LinkPreviewCard({
	preview,
	onDismiss,
	compact = false,
	sx,
}) {
	const [imageError, setImageError] = useState(false);

	if (!preview || (!preview.title && !preview.url)) {
		return null;
	}

	const url = preview.url || "";
	const title = preview.title || preview.domain || url;
	const description = preview.description || "";
	const image = preview.image || preview.imageUrl || "";
	const domain = preview.domain || (url ? (() => {
		try {
			return new URL(url).hostname;
		} catch {
			return "";
		}
	})() : "");
	const siteName = preview.siteName || domain;

	const handleCardClick = () => {
		if (url) {
			window.open(url, "_blank", "noopener,noreferrer");
		}
	};

	const handleKeyDown = (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleCardClick();
		}
	};

	return (
		<Paper
			variant="outlined"
			role="link"
			tabIndex={0}
			aria-label={`Link preview: ${title} (${domain})`}
			data-testid="link-preview-card"
			onClick={handleCardClick}
			onKeyDown={handleKeyDown}
			sx={{
				position: "relative",
				display: "flex",
				flexDirection: { xs: "column", sm: compact ? "column" : "row" },
				borderRadius: 2.5,
				overflow: "hidden",
				cursor: "pointer",
				bgcolor: "background.paper",
				border: "1px solid",
				borderColor: "divider",
				transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
				"&:hover": {
					transform: "translateY(-2px)",
					boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
					borderColor: "primary.main",
					"& .link-preview-title": {
						color: "primary.main",
					},
				},
				...sx,
			}}
		>
			{/* Preview Thumbnail or Domain Fallback */}
			{image && !imageError ? (
				<Box
					sx={{
						width: { xs: "100%", sm: compact ? "100%" : 160 },
						height: { xs: 140, sm: compact ? 120 : "auto" },
						minHeight: { sm: compact ? 120 : 120 },
						flexShrink: 0,
						bgcolor: "action.hover",
						overflow: "hidden",
						position: "relative",
					}}
				>
					<Box
						component="img"
						src={image}
						alt={title || "Link preview thumbnail"}
						data-testid="link-preview-image"
						onError={() => setImageError(true)}
						sx={{
							width: "100%",
							height: "100%",
							objectFit: "cover",
							display: "block",
							transition: "transform 0.3s ease",
							"&:hover": {
								transform: "scale(1.03)",
							},
						}}
					/>
				</Box>
			) : (
				<Box
					data-testid="link-preview-fallback-icon"
					sx={{
						width: { xs: "100%", sm: compact ? "100%" : 90 },
						height: { xs: 70, sm: compact ? 70 : "auto" },
						minHeight: { sm: 90 },
						flexShrink: 0,
						bgcolor: "action.hover",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "text.secondary",
					}}
				>
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<line x1="2" y1="12" x2="22" y2="12" />
						<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
					</svg>
				</Box>
			)}

			{/* Content Details */}
			<Box
				sx={{
					p: 1.75,
					flex: 1,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					minWidth: 0,
				}}
			>
				{/* Domain & Source badge */}
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
					{domain && (
						<Chip
							label={domain}
							size="small"
							data-testid="link-preview-domain"
							sx={{
								height: 20,
								fontSize: "0.7rem",
								fontWeight: 700,
								textTransform: "lowercase",
								bgcolor: "action.hover",
								color: "text.secondary",
							}}
						/>
					)}
					{siteName && siteName !== domain && (
						<Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
							{siteName}
						</Typography>
					)}
				</Box>

				{/* Title */}
				<Typography
					variant="subtitle2"
					className="link-preview-title"
					data-testid="link-preview-title"
					sx={{
						fontWeight: 700,
						fontSize: "0.92rem",
						lineHeight: 1.3,
						mb: 0.5,
						color: "text.primary",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
						transition: "color 0.2s ease",
					}}
				>
					{title}
				</Typography>

				{/* Description */}
				{description && (
					<Typography
						variant="body2"
						data-testid="link-preview-description"
						color="text.secondary"
						sx={{
							fontSize: "0.82rem",
							lineHeight: 1.4,
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					>
						{description}
					</Typography>
				)}
			</Box>

			{/* Dismiss Button (if editing/composing) */}
			{onDismiss && (
				<Tooltip title="Remove preview" arrow>
					<IconButton
						size="small"
						aria-label="Remove link preview"
						data-testid="link-preview-dismiss-btn"
						onClick={(e) => {
							e.stopPropagation();
							onDismiss();
						}}
						sx={{
							position: "absolute",
							top: 6,
							right: 6,
							bgcolor: "background.paper",
							boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
							"&:hover": { bgcolor: "action.hover" },
						}}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</IconButton>
				</Tooltip>
			)}
		</Paper>
	);
}

LinkPreviewCard.propTypes = {
	preview: PropTypes.shape({
		url: PropTypes.string,
		title: PropTypes.string,
		description: PropTypes.string,
		image: PropTypes.string,
		imageUrl: PropTypes.string,
		siteName: PropTypes.string,
		domain: PropTypes.string,
	}),
	onDismiss: PropTypes.func,
	compact: PropTypes.bool,
	sx: PropTypes.object,
};
