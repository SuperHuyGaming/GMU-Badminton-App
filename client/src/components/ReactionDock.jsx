// client/src/components/ReactionDock.jsx
import { useState, useMemo, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { Box, Paper, IconButton, Tooltip, Typography } from "@mui/material";
import { motion } from "framer-motion";

const DEFAULT_REACTIONS = [
	{ emoji: "👍", label: "Like", tooltip: "Like" },
	{ emoji: "❤️", label: "Love", tooltip: "Love" },
	{ emoji: "🔥", label: "Fire", tooltip: "Fire" },
	{ emoji: "🎉", label: "Celebrate", tooltip: "Celebrate" },
	{ emoji: "👏", label: "Clap", tooltip: "Clap" },
	{ emoji: "🏸", label: "Shuttle", tooltip: "Shuttle" },
];

export default function ReactionDock({
	reactions = [],
	userReaction = null,
	onReact,
	showCounts = true,
	compact = false,
	items = DEFAULT_REACTIONS,
	className,
	sx,
	"data-testid": testId = "reaction-dock",
	...rest
}) {
	const [activeEmoji, setActiveEmoji] = useState(null);
	const activeTimerRef = useRef(null);

	// Clear any pending pop-animation reset when the dock unmounts
	useEffect(() => () => clearTimeout(activeTimerRef.current), []);

	// Calculate counts per emoji
	const counts = useMemo(() => {
		const map = {};
		items.forEach((item) => {
			map[item.emoji] = 0;
		});

		if (Array.isArray(reactions)) {
			reactions.forEach((r) => {
				const emoji = typeof r === "string" ? r : r?.emoji;
				if (emoji && map[emoji] !== undefined) {
					map[emoji] += 1;
				} else if (emoji) {
					map[emoji] = (map[emoji] || 0) + 1;
				}
			});
		} else if (reactions && typeof reactions === "object") {
			Object.entries(reactions).forEach(([emoji, count]) => {
				map[emoji] = Number(count) || 0;
			});
		}

		return map;
	}, [reactions, items]);

	const handleEmojiClick = (emoji) => {
		setActiveEmoji(emoji);
		clearTimeout(activeTimerRef.current);
		activeTimerRef.current = setTimeout(() => setActiveEmoji(null), 300);
		if (onReact) {
			onReact(emoji);
		}
	};

	return (
		<Paper
			elevation={3}
			role="toolbar"
			aria-label="Reactions"
			data-testid={testId}
			className={className}
			{...rest}
			sx={{
				display: "inline-flex",
				alignItems: "center",
				gap: compact ? 0.5 : 1,
				p: compact ? "4px 8px" : "6px 12px",
				borderRadius: 6,
				bgcolor: (theme) =>
					theme.palette.mode === "dark"
						? "rgba(30, 30, 30, 0.95)"
						: "rgba(255, 255, 255, 0.95)",
				backdropFilter: "blur(8px)",
				border: "1px solid",
				borderColor: "divider",
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				...sx,
			}}
		>
			{items.map((item) => {
				const isSelected = userReaction === item.emoji;
				const count = counts[item.emoji] || 0;
				const isBouncing = activeEmoji === item.emoji;

				return (
					<Tooltip key={item.emoji} title={item.tooltip || item.label} arrow placement="top">
						<motion.div
							whileHover={{ scale: 1.25, y: -4, transition: { type: "spring", stiffness: 450 } }}
							whileTap={{ scale: 0.88 }}
							animate={isBouncing ? { scale: [1, 1.4, 1] } : {}}
							transition={{ duration: 0.3 }}
							style={{ display: "inline-flex" }}
						>
							<IconButton
								aria-label={`React with ${item.label}`}
								aria-pressed={isSelected}
								data-testid={`reaction-btn-${item.label.toLowerCase()}`}
								onClick={(e) => {
									e.stopPropagation();
									handleEmojiClick(item.emoji);
								}}
								sx={{
									display: "inline-flex",
									alignItems: "center",
									gap: 0.5,
									p: compact ? "4px 6px" : "6px 8px",
									borderRadius: 4,
									bgcolor: isSelected
										? (theme) =>
												theme.palette.mode === "dark"
													? "rgba(25, 118, 210, 0.25)"
													: "rgba(25, 118, 210, 0.12)"
										: "transparent",
									border: isSelected ? "1px solid" : "1px solid transparent",
									borderColor: isSelected ? "primary.main" : "transparent",
									"&:hover": {
										bgcolor: (theme) =>
											theme.palette.mode === "dark"
												? "rgba(255, 255, 255, 0.1)"
												: "rgba(0, 0, 0, 0.05)",
									},
								}}
							>
								<Box
									component="span"
									sx={{
										fontSize: compact ? "1.15rem" : "1.35rem",
										lineHeight: 1,
										display: "inline-block",
										userSelect: "none",
									}}
								>
									{item.emoji}
								</Box>
								{showCounts && count > 0 && (
									<Typography
										variant="caption"
										data-testid={`reaction-count-${item.label.toLowerCase()}`}
										sx={{
											fontSize: "0.75rem",
											fontWeight: 700,
											color: isSelected ? "primary.main" : "text.secondary",
											lineHeight: 1,
											minWidth: 10,
										}}
									>
										{count}
									</Typography>
								)}
							</IconButton>
						</motion.div>
					</Tooltip>
				);
			})}
		</Paper>
	);
}

ReactionDock.propTypes = {
	reactions: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
	userReaction: PropTypes.string,
	onReact: PropTypes.func,
	showCounts: PropTypes.bool,
	compact: PropTypes.bool,
	items: PropTypes.arrayOf(
		PropTypes.shape({
			emoji: PropTypes.string.isRequired,
			label: PropTypes.string.isRequired,
			tooltip: PropTypes.string,
		})
	),
	className: PropTypes.string,
	sx: PropTypes.object,
};
