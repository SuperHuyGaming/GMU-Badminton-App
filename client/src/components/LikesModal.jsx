// client/src/components/LikesModal.jsx
import { useState, useMemo, useEffect } from 'react';
import {
	Dialog,
	DialogTitle,
	DialogContent,
	List,
	ListItemButton,
	Avatar,
	Typography,
	IconButton,
	Box,
	Tabs,
	Tab,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { CloseIcon } from "./Icons";
import { FacebookReactionIcon } from "./FacebookReactionTokens";
import { normalizeReactionType, normalizeReactionEmoji } from "../constants/reactions";

export default function LikesModal({
	open,
	title = "Post Reactions",
	list = [],
	reactions = [],
	initialTab = "all",
	onClose,
}) {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState(initialTab);

	useEffect(() => {
		if (open) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveTab(initialTab || "all");
		}
	}, [open, initialTab]);

	// Normalize all users from both reactions and list (likes)
	const allItems = useMemo(() => {
		const items = [];
		const seenIds = new Set();

		// Add reaction entries first
		if (Array.isArray(reactions)) {
			reactions.forEach((r) => {
				const id = String(r.userId || r._id || r.id || "");
				if (!id || seenIds.has(id)) return;
				seenIds.add(id);

				const rawEmoji = r.emoji || "👍";
				const emoji = normalizeReactionEmoji(rawEmoji);
				const type = normalizeReactionType(r.reactionType, emoji);

				items.push({
					id,
					name: r.userName || r.name || "Player",
					profilePic: r.profilePic || r.avatarUrl || "",
					emoji,
					type,
				});
			});
		}

		// Add legacy like entries if not already seen
		if (Array.isArray(list)) {
			list.forEach((u) => {
				const id = String(u.id || u._id || "");
				if (!id || seenIds.has(id)) return;
				seenIds.add(id);

				items.push({
					id,
					name: u.name || "Player",
					profilePic: u.profilePic || "",
					emoji: "👍",
					type: "like",
				});
			});
		}

		return items;
	}, [reactions, list]);

	// Tally counts across Facebook canonical reaction types
	const counts = useMemo(() => {
		const res = {
			all: allItems.length,
			like: 0,
			love: 0,
			haha: 0,
			wow: 0,
			sad: 0,
			angry: 0,
		};
		allItems.forEach((item) => {
			if (item.type === "like" || item.emoji === "👍") res.like += 1;
			else if (item.type === "love" || item.emoji === "❤️") res.love += 1;
			else if (item.type === "haha" || item.emoji === "😂") res.haha += 1;
			else if (item.type === "wow" || item.emoji === "😮") res.wow += 1;
			else if (item.type === "sad" || item.emoji === "😢") res.sad += 1;
			else if (item.type === "angry" || item.emoji === "😡") res.angry += 1;
			else res.like += 1;
		});
		return res;
	}, [allItems]);

	// Filtered list based on active tab
	const filteredList = useMemo(() => {
		if (activeTab === "all") return allItems;
		return allItems.filter((item) => {
			if (activeTab === "like") return item.type === "like" || item.emoji === "👍";
			if (activeTab === "love") return item.type === "love" || item.emoji === "❤️";
			if (activeTab === "haha") return item.type === "haha" || item.emoji === "😂";
			if (activeTab === "wow") return item.type === "wow" || item.emoji === "😮";
			if (activeTab === "sad") return item.type === "sad" || item.emoji === "😢";
			if (activeTab === "angry") return item.type === "angry" || item.emoji === "😡";
			return true;
		});
	}, [allItems, activeTab]);

	const hasSpecificReactions =
		counts.like > 0 ||
		counts.love > 0 ||
		counts.haha > 0 ||
		counts.wow > 0 ||
		counts.sad > 0 ||
		counts.angry > 0;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			disableRestoreFocus
			aria-labelledby="likes-modal-title"
			maxWidth="xs"
			fullWidth
			slotProps={{
				paper: {
					sx: { borderRadius: 3, overflow: "hidden" },
				},
			}}
			data-testid="likes-modal"
		>
			<DialogTitle
				id="likes-modal-title"
				sx={{
					fontWeight: "bold",
					borderBottom: "1px solid",
					borderColor: "divider",
					textAlign: "center",
					py: 2,
					position: "relative",
					fontSize: "1.1rem",
				}}
			>
				{title}
				<IconButton
					aria-label="Close"
					onClick={onClose}
					data-testid="likes-modal-close-btn"
					sx={{
						position: "absolute",
						right: 8,
						top: 8,
						transition: "all 0.2s",
						"&:active": { transform: "scale(0.9)" },
					}}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			{/* FACEBOOK REACTION TABS (All, Like, Love, Haha, Wow, Sad, Angry) */}
			{hasSpecificReactions && (
				<Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}>
					<Tabs
						value={activeTab}
						onChange={(e, val) => setActiveTab(val)}
						variant="scrollable"
						scrollButtons="auto"
						textColor="primary"
						indicatorColor="primary"
						aria-label="Reaction filter tabs"
						sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, py: 1, textTransform: "none", fontWeight: "bold", fontSize: "0.85rem" } }}
					>
						<Tab
							label={`All (${counts.all})`}
							value="all"
							data-testid="likes-modal-tab-all"
						/>
						{counts.like > 0 && (
							<Tab
								label={`👍 ${counts.like}`}
								value="like"
								data-testid="likes-modal-tab-like"
							/>
						)}
						{counts.love > 0 && (
							<Tab
								label={`❤️ ${counts.love}`}
								value="love"
								data-testid="likes-modal-tab-love"
							/>
						)}
						{counts.haha > 0 && (
							<Tab
								label={`😂 ${counts.haha}`}
								value="haha"
								data-testid="likes-modal-tab-haha"
							/>
						)}
						{counts.wow > 0 && (
							<Tab
								label={`😮 ${counts.wow}`}
								value="wow"
								data-testid="likes-modal-tab-wow"
							/>
						)}
						{counts.sad > 0 && (
							<Tab
								label={`😢 ${counts.sad}`}
								value="sad"
								data-testid="likes-modal-tab-sad"
							/>
						)}
						{counts.angry > 0 && (
							<Tab
								label={`😡 ${counts.angry}`}
								value="angry"
								data-testid="likes-modal-tab-angry"
							/>
						)}
					</Tabs>
				</Box>
			)}

			<DialogContent sx={{ p: 0, maxHeight: 420 }}>
				<List disablePadding>
					{filteredList.map((u) => (
						<ListItemButton
							key={u.id}
							onClick={() => {
								onClose();
								navigate(`/profile/${u.id}`);
							}}
							sx={{
								py: 1.5,
								px: 2.5,
								borderBottom: "1px solid",
								borderColor: "divider",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								"&:hover": { bgcolor: "action.hover" },
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
								<Avatar
									src={u.profilePic}
									alt={u.name || "User Avatar"}
									sx={{
										width: 40,
										height: 40,
										bgcolor: "primary.main",
										color: "white",
										fontWeight: "bold",
									}}
								>
									{!u.profilePic && u.name?.charAt(0).toUpperCase()}
								</Avatar>
								<Typography fontWeight="bold" fontSize="0.95rem">
									{u.name}
								</Typography>
							</Box>
							<Box sx={{ display: "inline-flex", alignItems: "center" }}>
								<FacebookReactionIcon emoji={u.emoji} size={22} />
							</Box>
						</ListItemButton>
					))}

					{filteredList.length === 0 && (
						<Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
							<Typography variant="body2">No reactions in this category.</Typography>
						</Box>
					)}
				</List>
			</DialogContent>
		</Dialog>
	);
}
