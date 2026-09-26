// client/src/components/EmptyState.jsx
import { Box, Typography, Button } from "@mui/material";
import { motion } from "framer-motion";

const illustrations = {
	posts: { emoji: "📝", title: "No Posts Yet", subtitle: "Be the first to share something with the community!" },
	friends: { emoji: "👥", title: "No Friends Yet", subtitle: "Challenge someone to a match to make your first friend!" },
	messages: { emoji: "💬", title: "No Messages", subtitle: "Start a conversation with a fellow player." },
	matches: { emoji: "🏸", title: "No Matches Played", subtitle: "Find an opponent and hit the courts!" },
	tournaments: { emoji: "🏆", title: "No Tournaments Found", subtitle: "Check back soon for upcoming events in your area." },
	marketplace: { emoji: "🛒", title: "Nothing For Sale", subtitle: "List your old gear or check back later for deals." },
	search: { emoji: "🔍", title: "No Results Found", subtitle: "Try adjusting your search or filters." },
	default: { emoji: "🏸", title: "Nothing Here Yet", subtitle: "Check back soon!" },
};

export default function EmptyState({ type = "default", actionLabel, onAction }) {
	const config = illustrations[type] || illustrations.default;

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
		>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					py: 8,
					px: 3,
					textAlign: "center",
				}}
			>
				<motion.div
					animate={{ y: [0, -10, 0] }}
					transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
				>
					<Typography sx={{ fontSize: "4rem", mb: 2 }}>{config.emoji}</Typography>
				</motion.div>
				<Typography variant="h5" fontWeight="bold" gutterBottom>
					{config.title}
				</Typography>
				<Typography
					variant="body1"
					color="text.secondary"
					sx={{ maxWidth: 360, mb: actionLabel ? 3 : 0, lineHeight: 1.6 }}
				>
					{config.subtitle}
				</Typography>
				{actionLabel && onAction && (
					<Button
						variant="contained"
						onClick={onAction}
						sx={{
							borderRadius: 3,
							px: 4,
							py: 1.2,
							fontWeight: "bold",
							bgcolor: "#006633",
							"&:hover": { bgcolor: "#005528" },
						}}
					>
						{actionLabel}
					</Button>
				)}
			</Box>
		</motion.div>
	);
}
