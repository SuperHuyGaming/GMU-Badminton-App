// client/src/components/FacebookReactionTokens.jsx
// eslint-disable-next-line no-unused-vars
import React from 'react';
import { Box } from '@mui/material';
import { normalizeReactionEmoji } from '../constants/reactions';

/**
 * Facebook Like Token Badge (Thumbs Up on Blue Circle)
 */
export const FacebookLikeToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "#1877F2",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} fill="#FFFFFF">
			<path d="M4 21h1V8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2zm17-12a2.82 2.82 0 0 0-2.4-2.8h-4.9l.7-3.4.1-.7a1.67 1.67 0 0 0-.5-1.2L13 0 7.6 5.4a2.91 2.91 0 0 0-.6 1.6v12a2 2 0 0 0 2 2h9a2.4 2.4 0 0 0 2.3-1.6l2.3-5.4a2.15 2.15 0 0 0 .4-.9V9z" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>👍</span>
	</Box>
);

/**
 * Facebook Love Token Badge (White Heart on Rose Red Circle)
 */
export const FacebookLoveToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "linear-gradient(135deg, #FF4B72 0%, #FA383E 100%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} fill="#FFFFFF">
			<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>❤️</span>
	</Box>
);

/**
 * Facebook Haha Token Badge (Laughing Face on Yellow Circle)
 */
export const FacebookHahaToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.85)} height={Math.round(size * 0.85)} fill="none">
			<path d="M6 9.5l3 2-3 2" stroke="#5B3E00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M18 9.5l-3 2 3 2" stroke="#5B3E00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M7 14c0 3 2.2 5 5 5s5-2 5-5H7z" fill="#5B3E00" />
			<path d="M8 14.2c.4 1.2 2 1.8 4 1.8s3.6-.6 4-1.8H8z" fill="#FFFFFF" />
			<path d="M10 17.5c.6.6 1.3.8 2 .8s1.4-.2 2-.8c-.6-.5-1.3-.7-2-.7s-1.4.2-2 .7z" fill="#FF5252" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>😂</span>
	</Box>
);

/**
 * Facebook Wow Token Badge (Open-mouth Face on Yellow Circle)
 */
export const FacebookWowToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.85)} height={Math.round(size * 0.85)} fill="none">
			<path d="M6 7c1-.8 2.5-.8 3.5 0" stroke="#5B3E00" strokeWidth="1.6" strokeLinecap="round" />
			<path d="M14.5 7c1-.8 2.5-.8 3.5 0" stroke="#5B3E00" strokeWidth="1.6" strokeLinecap="round" />
			<circle cx="8" cy="10.5" r="2" fill="#5B3E00" />
			<circle cx="16" cy="10.5" r="2" fill="#5B3E00" />
			<ellipse cx="12" cy="16.5" rx="3.2" ry="4" fill="#5B3E00" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>😮</span>
	</Box>
);

/**
 * Facebook Sad Token Badge (Tearful Face on Yellow Circle)
 */
export const FacebookSadToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "linear-gradient(135deg, #FFD23F 0%, #F7B125 100%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.85)} height={Math.round(size * 0.85)} fill="none">
			<path d="M6 8c1 .4 2.2 0 3-.6" stroke="#5B3E00" strokeWidth="1.6" strokeLinecap="round" />
			<path d="M18 8c-1 .4-2.2 0-3-.6" stroke="#5B3E00" strokeWidth="1.6" strokeLinecap="round" />
			<circle cx="8" cy="11.5" r="1.8" fill="#5B3E00" />
			<circle cx="16" cy="11.5" r="1.8" fill="#5B3E00" />
			<path d="M9 17.5c1-1 5-1 6 0" stroke="#5B3E00" strokeWidth="1.8" strokeLinecap="round" />
			<path d="M18 13.5c0 0-1.8 2-1.8 3.2 0 1 .8 1.8 1.8 1.8s1.8-.8 1.8-1.8c0-1.2-1.8-3.2-1.8-3.2z" fill="#00A3FF" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>😢</span>
	</Box>
);

/**
 * Facebook Angry Token Badge (Furious Face on Red Circle)
 */
export const FacebookAngryToken = ({ size = 18 }) => (
	<Box
		component="span"
		sx={{
			width: size,
			height: size,
			minWidth: size,
			borderRadius: "50%",
			background: "linear-gradient(135deg, #FF5252 0%, #E41E3F 100%)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
			position: "relative",
			boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		}}
	>
		<svg viewBox="0 0 24 24" width={Math.round(size * 0.85)} height={Math.round(size * 0.85)} fill="none">
			<path d="M6 7.5l4 2.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
			<path d="M18 7.5l-4 2.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
			<circle cx="8.5" cy="12" r="2.2" fill="#FFFFFF" />
			<circle cx="8.5" cy="12" r="1.1" fill="#1C1E21" />
			<circle cx="15.5" cy="12" r="2.2" fill="#FFFFFF" />
			<circle cx="15.5" cy="12" r="1.1" fill="#1C1E21" />
			<path d="M8 18c1.5-1.5 6.5-1.5 8 0" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
		</svg>
		<span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", opacity: 0 }}>😡</span>
	</Box>
);

/**
 * Universal Facebook Reaction Icon Token Component
 * Maps any reaction (including legacy badminton emojis) to authentic Facebook tokens.
 */
export const FacebookReactionIcon = ({ emoji, size = 18 }) => {
	const normalized = normalizeReactionEmoji(emoji);
	switch (normalized) {
		case "👍":
			return <FacebookLikeToken size={size} />;
		case "❤️":
			return <FacebookLoveToken size={size} />;
		case "😂":
			return <FacebookHahaToken size={size} />;
		case "😮":
			return <FacebookWowToken size={size} />;
		case "😢":
			return <FacebookSadToken size={size} />;
		case "😡":
			return <FacebookAngryToken size={size} />;
		default:
			return <FacebookLikeToken size={size} />;
	}
};

export default FacebookReactionIcon;
