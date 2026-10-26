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
	Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { CloseIcon } from "./Icons";

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

				const emoji = r.emoji || "💥";
				let type = r.reactionType;
				if (!type) {
					if (emoji === "💥") type = "smash";
					else if (emoji === "🧊") type = "ice_drop";
					else if (emoji === "⚡") type = "clutch";
					else type = "custom";
				}

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

	// Tally counts
	const counts = useMemo(() => {
		const res = { all: allItems.length, smash: 0, ice_drop: 0, clutch: 0 };
		allItems.forEach((item) => {
			if (item.type === "smash" || item.emoji === "💥") res.smash += 1;
			else if (item.type === "ice_drop" || item.emoji === "🧊") res.ice_drop += 1;
			else if (item.type === "clutch" || item.emoji === "⚡") res.clutch += 1;
		});
		return res;
	}, [allItems]);

	// Filtered list based on active tab
	const filteredList = useMemo(() => {
		if (activeTab === "all") return allItems;
		return allItems.filter((item) => {
			if (activeTab === "smash") return item.type === "smash" || item.emoji === "💥";
			if (activeTab === "ice_drop") return item.type === "ice_drop" || item.emoji === "🧊";
			if (activeTab === "clutch") return item.type === "clutch" || item.emoji === "⚡";
			return true;
		});
	}, [allItems, activeTab]);

	const hasSpecificReactions = counts.smash > 0 || counts.ice_drop > 0 || counts.clutch > 0;

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

			{/* REACTION TABS (All, Smash, Ice Drop, Clutch) */}
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
						{counts.smash > 0 && (
							<Tab
								label={`💥 ${counts.smash}`}
								value="smash"
								data-testid="likes-modal-tab-smash"
							/>
						)}
						{counts.ice_drop > 0 && (
							<Tab
								label={`🧊 ${counts.ice_drop}`}
								value="ice_drop"
								data-testid="likes-modal-tab-ice_drop"
							/>
						)}
						{counts.clutch > 0 && (
							<Tab
								label={`⚡ ${counts.clutch}`}
								value="clutch"
								data-testid="likes-modal-tab-clutch"
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
							<Chip
								label={u.emoji}
								size="small"
								variant="outlined"
								sx={{ fontSize: "1rem", height: 26, minWidth: 32 }}
							/>
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
