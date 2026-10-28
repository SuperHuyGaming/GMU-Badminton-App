// client/src/constants/reactions.js

/**
 * 6 Canonical Facebook Reactions for Community Hub
 */
export const FACEBOOK_REACTIONS = [
	{
		emoji: "👍",
		type: "like",
		label: "Like",
		tooltip: "Like",
		color: "#1877F2",
		bgGradient: "linear-gradient(135deg, #1877F2 0%, #0084FF 100%)",
	},
	{
		emoji: "❤️",
		type: "love",
		label: "Love",
		tooltip: "Love",
		color: "#FA383E",
		bgGradient: "linear-gradient(135deg, #FF4B72 0%, #FA383E 100%)",
	},
	{
		emoji: "🏸",
		type: "smash",
		label: "Smash",
		tooltip: "Smash",
		color: "#FFB300",
		bgGradient: "linear-gradient(135deg, #FFA000 0%, #FFB300 100%)",
	},
	{
		emoji: "😮",
		type: "wow",
		label: "Wow",
		tooltip: "Wow",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #F7B125 0%, #FFC107 100%)",
	},
	{
		emoji: "😂",
		type: "haha",
		label: "Haha",
		tooltip: "Haha",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #F7B125 0%, #FFC107 100%)",
	},
	{
		emoji: "😢",
		type: "sad",
		label: "Sad",
		tooltip: "Sad",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #F7B125 0%, #FFC107 100%)",
	},
];

/**
 * Legacy Badminton reactions preserved for backward compatibility
 */
export const LEGACY_REACTIONS = [
	{
		emoji: "💥",
		type: "smash",
		label: "Smash",
		tooltip: "Smash (Like/Hype)",
		color: "#FF4B72",
		bgGradient: "linear-gradient(135deg, #FF4B72 0%, #FA383E 100%)",
	},
	{
		emoji: "🧊",
		type: "ice_drop",
		label: "Ice Drop",
		tooltip: "Ice Drop (IDK/Cold)",
		color: "#1877F2",
		bgGradient: "linear-gradient(135deg, #1877F2 0%, #0084FF 100%)",
	},
	{
		emoji: "⚡",
		type: "clutch",
		label: "Clutch",
		tooltip: "Clutch (Game-Winner)",
		color: "#FFD700",
		bgGradient: "linear-gradient(135deg, #FFD93B 0%, #F7B125 100%)",
	},
];

/**
 * All allowed reactions combined
 */
export const ALL_REACTIONS = [
	...FACEBOOK_REACTIONS,
	...LEGACY_REACTIONS,
];

/**
 * Helper to find metadata for an emoji
 */
export const getReactionMeta = (emoji) => {
	if (!emoji) return null;
	const match = ALL_REACTIONS.find((r) => r.emoji === emoji);
	if (match) return match;
	return {
		emoji,
		type: "custom",
		label: "Reacted",
		tooltip: "Reacted",
		color: "#1877F2",
		bgGradient: "linear-gradient(135deg, #1877F2 0%, #0084FF 100%)",
	};
};
