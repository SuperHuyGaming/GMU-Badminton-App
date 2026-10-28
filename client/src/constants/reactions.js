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
		emoji: "😂",
		type: "haha",
		label: "Haha",
		tooltip: "Haha",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
	},
	{
		emoji: "😮",
		type: "wow",
		label: "Wow",
		tooltip: "Wow",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
	},
	{
		emoji: "😢",
		type: "sad",
		label: "Sad",
		tooltip: "Sad",
		color: "#F7B125",
		bgGradient: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
	},
	{
		emoji: "😡",
		type: "angry",
		label: "Angry",
		tooltip: "Angry",
		color: "#E41E3F",
		bgGradient: "linear-gradient(135deg, #FF5252 0%, #E41E3F 100%)",
	},
];

/**
 * Normalizes any legacy or custom reaction emoji to a canonical Facebook reaction
 */
export const normalizeReactionEmoji = (emoji) => {
	switch (emoji) {
		case "💥":
		case "🧊":
		case "⚡":
		case "🏸":
		case "🔥":
		case "💯":
		case "👏":
			return "👍";
		case "👍":
		case "❤️":
		case "😂":
		case "😮":
		case "😢":
		case "😡":
			return emoji;
		default:
			return emoji || "👍";
	}
};

/**
 * Normalizes reaction types
 */
export const normalizeReactionType = (type, emoji) => {
	if (type === "smash" || type === "ice_drop" || type === "clutch") {
		return "like";
	}
	if (type && ["like", "love", "haha", "wow", "sad", "angry"].includes(type)) {
		return type;
	}
	const normEmoji = normalizeReactionEmoji(emoji);
	const match = FACEBOOK_REACTIONS.find((r) => r.emoji === normEmoji);
	return match ? match.type : "like";
};

/**
 * All allowed reactions combined - strictly authentic Facebook reactions
 */
export const ALL_REACTIONS = FACEBOOK_REACTIONS;

/**
 * Helper to find metadata for an emoji (normalizes legacy emojis so Smash/IceDrop never leaks)
 */
export const getReactionMeta = (emoji) => {
	if (!emoji) return null;
	const normalized = normalizeReactionEmoji(emoji);
	const match = FACEBOOK_REACTIONS.find((r) => r.emoji === normalized);
	if (match) return match;
	return {
		emoji: "👍",
		type: "like",
		label: "Like",
		tooltip: "Like",
		color: "#1877F2",
		bgGradient: "linear-gradient(135deg, #1877F2 0%, #0084FF 100%)",
	};
};
