// client/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import {
	Typography,
	Box,
	Paper,
	Button,
	Grid,
	Avatar,
	CircularProgress,
	Chip,
	TextField,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions as MuiDialogActions,
	LinearProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import apiFetch from "../utils/api";
import { getOptimizedAvatar } from "../utils/image";
import socket from "../utils/socket";
import { useAuth } from "../context/AuthContext";
import ReportMatchModal from "../components/ReportMatchModal";

// --- SVG Icons ---
const TrophyIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
		<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
		<path d="M4 22h16"></path>
		<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
		<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
		<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
	</svg>
);

const ShuttlecockIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="12" cy="19" r="2"></circle>
		<path d="M8.5 17.5 5 11l7-6 7 6-3.5 6.5"></path>
		<path d="m8 14 8-3"></path>
		<path d="m9 11 6-2"></path>
	</svg>
);

const CalendarIcon = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
		<line x1="16" y1="2" x2="16" y2="6"></line>
		<line x1="8" y1="2" x2="8" y2="6"></line>
		<line x1="3" y1="10" x2="21" y2="10"></line>
	</svg>
);

const ClockIcon = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="12" cy="12" r="10"></circle>
		<polyline points="12 6 12 12 16 14"></polyline>
	</svg>
);

const MegaphoneIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
		<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
	</svg>
);

const PinIcon = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
		<circle cx="12" cy="10" r="3"></circle>
	</svg>
);

const TrashIcon = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<polyline points="3 6 5 6 21 6"></polyline>
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
	</svg>
);

// Rank Tier Helper
const getEloTier = (elo = 1200) => {
	if (elo >= 1700) return { label: "Grandmaster", color: "#FFD700", bg: "rgba(255, 215, 0, 0.15)" };
	if (elo >= 1500) return { label: "Diamond", color: "#00E5FF", bg: "rgba(0, 229, 255, 0.15)" };
	if (elo >= 1300) return { label: "Gold", color: "#FFB300", bg: "rgba(255, 179, 0, 0.15)" };
	if (elo >= 1100) return { label: "Silver", color: "#E0E0E0", bg: "rgba(224, 224, 224, 0.15)" };
	return { label: "Bronze", color: "#CD7F32", bg: "rgba(205, 127, 50, 0.15)" };
};

export default function Dashboard() {
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const currentUser = authUser || JSON.parse(localStorage.getItem("user")) || {};

	const [schedule, setSchedule] = useState(null);
	const [announcements, setAnnouncements] = useState([]);
	const [userMatches, setUserMatches] = useState([]);
	const [pendingMatches, setPendingMatches] = useState([]);
	const [loading, setLoading] = useState(true);

	const [newUpdateText, setNewUpdateText] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [deleteUpdateId, setDeleteUpdateId] = useState(null);
	const [reportModalOpen, setReportModalOpen] = useState(false);

	// Load Initial Dashboard Data
	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [announcementsRes, pendingRes] = await Promise.all([
					apiFetch(`/api/announcements`),
					apiFetch(`/api/matches/pending`).catch(() => ({ ok: false }))
				]);

				if (announcementsRes.ok) {
					setAnnouncements(await announcementsRes.json());
				}

				if (pendingRes && pendingRes.ok) {
					const pendingList = await pendingRes.json();
					const currentId = currentUser.id || currentUser._id;
					const requiresConfirmation = (pendingList || []).filter(
						(m) => m.submittedBy?._id !== currentId && m.submittedBy !== currentId
					);
					setPendingMatches(requiresConfirmation);
				}

				// Fetch user recent match history
				const currentId = currentUser.id || currentUser._id;
				if (currentId) {
					try {
						const matchRes = await apiFetch(`/api/matches/user/${currentId}`);
						if (matchRes.ok) {
							setUserMatches(await matchRes.json());
						}
					} catch (e) {
						console.warn("Could not load user match history:", e.message);
					}
				}

				// Fetch Java Court Schedule or fallback
				let apiUrl = import.meta.env.VITE_TOURNAMENT_API_URL;
				const isLocalNetwork = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');
				
				if (!apiUrl) {
					apiUrl = isLocalNetwork ? `http://${window.location.hostname}:8081` : null;
				} else if (!apiUrl.startsWith("http")) {
					apiUrl = "https://" + apiUrl;
				}

				if (apiUrl && import.meta.env.MODE !== 'test') {
					try {
						const courtRes = await fetch(`${apiUrl}/api/v1/courts/status`);
						if (courtRes.ok) {
							setSchedule(await courtRes.json());
							return;
						}
					} catch (e) {
						console.error("Failed to fetch RAC schedule", e);
					}
				}

				// FALLBACK: Mock Weekly Schedule
				const now = new Date();
				const getNextDay = (dayOfWeek) => {
					const d = new Date(now);
					d.setDate(d.getDate() + ((dayOfWeek + 7 - d.getDay()) % 7));
					return d;
				};

				const fallbackSchedule = {
					facilityName: "RAC Linn Gym Court B",
					timeSlots: [
						{ startTime: getNextDay(1).setHours(17, 0, 0), endTime: getNextDay(1).setHours(19, 0, 0), status: 'CLUB_ONLY', eventName: 'Club Badminton Practice' },
						{ startTime: getNextDay(2).setHours(16, 30, 0), endTime: getNextDay(2).setHours(18, 30, 0), status: 'DEDICATED', eventName: 'Dedicated Drop In Badminton ct. B' },
						{ startTime: getNextDay(4).setHours(19, 0, 0), endTime: getNextDay(4).setHours(21, 0, 0), status: 'DEDICATED', eventName: 'Dedicated Drop in Badminton...' },
						{ startTime: getNextDay(6).setHours(18, 0, 0), endTime: getNextDay(6).setHours(20, 0, 0), status: 'CLUB_ONLY', eventName: 'Club Badminton Practice' }
					]
				};
				fallbackSchedule.timeSlots.sort((a, b) => a.startTime - b.startTime);
				setSchedule(fallbackSchedule);

			} catch (err) {
				console.error("Failed to load dashboard data", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();

		const handleNewAnnouncement = (newAnn) =>
			setAnnouncements((prev) => [newAnn, ...prev]);
		const handleDeletedAnnouncement = (deletedId) =>
			setAnnouncements((prev) => prev.filter((a) => a._id !== deletedId));

		socket.on("announcementCreated", handleNewAnnouncement);
		socket.on("announcementDeleted", handleDeletedAnnouncement);

		return () => {
			socket.off("announcementCreated", handleNewAnnouncement);
			socket.off("announcementDeleted", handleDeletedAnnouncement);
		};
	}, [currentUser.id, currentUser._id]);

	const handlePostUpdate = async () => {
		if (!newUpdateText.trim() || currentUser?.role !== "admin") return;
		setIsPosting(true);
		try {
			await apiFetch(`/api/announcements`, {
				method: "POST",
				body: JSON.stringify({
					content: newUpdateText,
					authorName: currentUser.name,
					authorId: currentUser.id || currentUser._id,
					role: currentUser.role,
				}),
			});
			setNewUpdateText("");
		} catch (err) {
			console.error("Failed to post update", err);
		} finally {
			setIsPosting(false);
		}
	};

	const confirmDeleteUpdate = async () => {
		if (!deleteUpdateId) return;
		try {
			await apiFetch(
				`/api/announcements/${deleteUpdateId}?role=${currentUser.role}`,
				{ method: "DELETE" }
			);
		} catch (err) {
			console.error("Failed to delete update", err);
		}
		setDeleteUpdateId(null);
	};

	const handleConfirmMatch = async (matchId) => {
		try {
			await apiFetch(`/api/matches/${matchId}/confirm`, { method: "PUT" });
			setPendingMatches(prev => prev.filter(m => m._id !== matchId));
		} catch (e) {
			console.error("Failed to confirm match:", e);
		}
	};

	const handleDisputeMatch = async (matchId) => {
		try {
			await apiFetch(`/api/matches/${matchId}/dispute`, { method: "PUT" });
			setPendingMatches(prev => prev.filter(m => m._id !== matchId));
		} catch (e) {
			console.error("Failed to dispute match:", e);
		}
	};

	const formatTime = (dateString) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	// Determine active court status
	const [currentTime] = useState(() => Date.now());
	const activeSlot = schedule?.timeSlots?.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
	const nextSlot = schedule?.timeSlots?.find(s => s.startTime > currentTime);

	const isCourtOpen = activeSlot?.status === "DEDICATED";
	const isClubPractice = activeSlot?.status === "CLUB_ONLY";
	
	const statusIndicatorClass = isCourtOpen 
		? "live-indicator-green" 
		: isClubPractice 
		? "live-indicator-yellow" 
		: "live-indicator-red";

	const currentCourtStatusText = isCourtOpen
		? "Dedicated Drop-In Badminton (Open Play)"
		: isClubPractice
		? "Club Practice in Session (Linn Gym ct. B)"
		: nextSlot
		? `Court Available for Open Rec (Next Session: ${new Date(nextSlot.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`
		: "Court Schedule Concluded for Today";

	// Player Stats
	const singlesElo = currentUser?.singlesElo || 1200;
	const doublesElo = currentUser?.doublesElo || 1200;
	const singlesTier = getEloTier(singlesElo);
	const wins = currentUser?.stats?.wins || 0;
	const losses = currentUser?.stats?.losses || 0;
	const totalMatches = currentUser?.stats?.totalMatches || (wins + losses);
	const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

	return (
		<Box sx={{ pb: 10, maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 } }}>
			<style>
				{`
					@keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); } }
					@keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(0, 230, 118, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); } }
					@keyframes pulseYellow { 0% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(255, 204, 51, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0); } }
					
					.live-indicator-red { width: 0.85rem; height: 0.85rem; background-color: #FF4444; border-radius: 50%; display: inline-block; animation: pulseRed 2s infinite; }
					.live-indicator-green { width: 0.85rem; height: 0.85rem; background-color: #00E676; border-radius: 50%; display: inline-block; animation: pulseGreen 2s infinite; }
					.live-indicator-yellow { width: 0.85rem; height: 0.85rem; background-color: #FFCC33; border-radius: 50%; display: inline-block; animation: pulseYellow 2s infinite; }
					
					.custom-scrollbar::-webkit-scrollbar { width: 0.375rem; }
					.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
					.custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(120, 120, 120, 0.4); border-radius: 10px; }
				`}
			</style>

			{/* ===================== HERO WELCOME & ACTION BAR ===================== */}
			<Box
				component={motion.div}
				initial={{ opacity: 0, y: 15 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
				sx={{
					mt: 3,
					mb: 4,
					p: { xs: 3, md: 4 },
					borderRadius: 4,
					background: "linear-gradient(135deg, rgba(0, 102, 51, 0.88) 0%, rgba(10, 40, 25, 0.95) 100%)",
					backdropFilter: "blur(16px)",
					border: "1px solid rgba(255, 255, 255, 0.12)",
					boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
					display: "flex",
					flexDirection: { xs: "column", md: "row" },
					alignItems: { xs: "flex-start", md: "center" },
					justifyContent: "space-between",
					gap: 3,
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
					<Avatar
						src={getOptimizedAvatar(currentUser?.profilePic)}
						alt={currentUser?.name || "Player"}
						sx={{
							width: { xs: 56, sm: 68 },
							height: { xs: 56, sm: 68 },
							border: "3px solid #FFCC33",
							boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
							fontSize: "1.5rem",
							fontWeight: "bold",
							bgcolor: "primary.main"
						}}
					>
						{(currentUser?.name || "P").charAt(0).toUpperCase()}
					</Avatar>
					<Box>
						<Typography variant="h5" fontWeight="900" sx={{ color: "#ffffff", letterSpacing: "-0.5px" }}>
							Welcome back, {currentUser?.name || "Player"}! 🏸
						</Typography>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
							<Chip
								label={currentUser?.skillLevel || "Intermediate"}
								size="small"
								sx={{
									bgcolor: "rgba(255, 204, 51, 0.2)",
									color: "#FFCC33",
									fontWeight: 700,
									border: "1px solid rgba(255, 204, 51, 0.4)",
								}}
							/>
							<Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
								{currentUser?.homeUniversity || "George Mason University"}
							</Typography>
						</Box>
					</Box>
				</Box>

				<Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", width: { xs: "100%", sm: "auto" } }}>
					<Button
						variant="contained"
						startIcon={<TrophyIcon />}
						onClick={() => setReportModalOpen(true)}
						sx={{
							bgcolor: "#FFCC33",
							color: "#0a2819",
							fontWeight: "bold",
							borderRadius: 3,
							px: 2.5,
							py: 1,
							"&:hover": { bgcolor: "#ffd659" }
						}}
					>
						Log Match
					</Button>
					<Button
						variant="outlined"
						startIcon={<ShuttlecockIcon />}
						onClick={() => navigate("/matchmaking")}
						sx={{
							color: "#ffffff",
							borderColor: "rgba(255,255,255,0.3)",
							borderRadius: 3,
							px: 2,
							"&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.08)" }
						}}
					>
						Find Players
					</Button>
					<Button
						variant="outlined"
						startIcon={<CalendarIcon />}
						onClick={() => navigate("/tournaments")}
						sx={{
							color: "#ffffff",
							borderColor: "rgba(255,255,255,0.3)",
							borderRadius: 3,
							px: 2,
							"&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.08)" }
						}}
					>
						Tournaments
					</Button>
				</Box>
			</Box>

			{/* ===================== RAC LIVE COURT HERO WIDGET ===================== */}
			<Paper
				component={motion.div}
				initial={{ opacity: 0, y: 15 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, delay: 0.1 }}
				elevation={0}
				sx={{
					mb: 4,
					p: { xs: 3, md: 4 },
					borderRadius: 4,
					background: "rgba(255, 255, 255, 0.03)",
					backdropFilter: "blur(12px)",
					border: "1px solid",
					borderColor: "divider",
					boxShadow: "0 6px 24px rgba(0, 0, 0, 0.12)",
				}}
			>
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
					<Box>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
							<span className={statusIndicatorClass} />
							<Typography variant="overline" fontWeight="bold" sx={{ color: "text.secondary", letterSpacing: 1.2 }}>
								REAL-TIME COURT STATUS
							</Typography>
						</Box>
						<Typography variant="h5" fontWeight="900" sx={{ color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
							<PinIcon /> {schedule?.facilityName || "RAC Linn Gym Court B"}
						</Typography>
						<Typography variant="body1" sx={{ color: isCourtOpen ? "success.main" : isClubPractice ? "warning.main" : "text.secondary", fontWeight: 600, mt: 0.5 }}>
							{currentCourtStatusText}
						</Typography>
					</Box>

					<Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
						<Chip
							label={isCourtOpen ? "OPEN FOR PLAY" : isClubPractice ? "PRACTICE IN SESSION" : "OPEN RECREATION"}
							color={isCourtOpen ? "success" : isClubPractice ? "warning" : "default"}
							variant="filled"
							sx={{ fontWeight: "bold", borderRadius: 2, px: 1 }}
						/>
						<Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
							Facility: Recreation Athletic Complex (RAC)
						</Typography>
					</Box>
				</Box>

				{/* Availability Bar */}
				<Box sx={{ mb: 3 }}>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
						<Typography variant="body2" fontWeight="600" color="text.secondary">
							Estimated Court Availability
						</Typography>
						<Typography variant="body2" fontWeight="bold" color={isCourtOpen ? "success.main" : "text.primary"}>
							{isCourtOpen ? "100% Dedicated" : isClubPractice ? "Club Reserved" : "Shared Rec"}
						</Typography>
					</Box>
					<LinearProgress
						variant="determinate"
						value={isCourtOpen ? 100 : isClubPractice ? 35 : 60}
						color={isCourtOpen ? "success" : isClubPractice ? "warning" : "primary"}
						sx={{ height: 10, borderRadius: 5 }}
					/>
				</Box>

				{/* Schedule Slots Carousel/Grid */}
				<Typography variant="subtitle2" fontWeight="bold" sx={{ color: "text.secondary", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
					<ClockIcon /> TODAY & THIS WEEK'S UPCOMING BADMINTON HOURS
				</Typography>

				<Grid container spacing={2}>
					{schedule?.timeSlots?.map((slot, index) => {
						const isSlotActive = currentTime >= slot.startTime && currentTime <= slot.endTime;
						return (
							<Grid xs={12} sm={6} md={3} key={index}>
								<Paper
									elevation={0}
									sx={{
										p: 2,
										borderRadius: 3,
										border: isSlotActive ? "2px solid #FFCC33" : "1px solid",
										borderColor: isSlotActive ? "#FFCC33" : "divider",
										background: isSlotActive ? "rgba(255, 204, 51, 0.08)" : "action.hover",
										transition: "transform 0.2s",
										"&:hover": { transform: "translateY(-2px)" }
									}}
								>
									<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
										<Typography variant="caption" fontWeight="bold" sx={{ color: isSlotActive ? "#FFCC33" : "text.secondary" }}>
											{new Date(slot.startTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
										</Typography>
										<Chip
											label={slot.status === "DEDICATED" ? "Open" : slot.status === "CLUB_ONLY" ? "Club" : "Rec"}
											size="small"
											color={slot.status === "DEDICATED" ? "success" : slot.status === "CLUB_ONLY" ? "warning" : "default"}
											sx={{ height: 20, fontSize: "0.7rem", fontWeight: "bold" }}
										/>
									</Box>
									<Typography variant="body2" fontWeight="bold" noWrap>
										{slot.eventName}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
										{new Date(slot.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(slot.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
									</Typography>
								</Paper>
							</Grid>
						);
					})}
				</Grid>
			</Paper>

			{/* ===================== PERSONAL UTILITIES & OVERVIEW ===================== */}
			<Grid container spacing={4}>
				{/* LEFT COLUMN: ELO PROGRESSION & MATCH HISTORY */}
				<Grid xs={12} md={7}>
					{/* PENDING MATCH CONFIRMATIONS BANNER */}
					{pendingMatches.length > 0 && (
						<Paper
							component={motion.div}
							initial={{ scale: 0.98 }}
							animate={{ scale: 1 }}
							elevation={0}
							sx={{
								p: 3,
								mb: 3,
								borderRadius: 4,
								border: "2px solid #FFCC33",
								background: "rgba(255, 204, 51, 0.08)",
							}}
						>
							<Typography variant="subtitle1" fontWeight="bold" sx={{ color: "#FFCC33", mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
								⚠️ Pending Match Verifications ({pendingMatches.length})
							</Typography>
							<Typography variant="body2" sx={{ color: "text.primary", mb: 2 }}>
								Your opponent recorded a match result that requires your confirmation before updating player ratings:
							</Typography>
							{pendingMatches.map((pm) => (
								<Box
									key={pm._id}
									sx={{
										p: 2,
										borderRadius: 2,
										bgcolor: "background.paper",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										mb: 1.5,
										border: "1px solid",
										borderColor: "divider"
									}}
								>
									<Box>
										<Typography variant="body2" fontWeight="bold">
											{pm.type === "singles" ? "Singles Match" : "Doubles Match"} • {pm.team1Score} - {pm.team2Score}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Reported by {pm.submittedBy?.name || "Opponent"}
										</Typography>
									</Box>
									<Box sx={{ display: "flex", gap: 1 }}>
										<Button
											size="small"
											variant="contained"
											color="success"
											onClick={() => handleConfirmMatch(pm._id)}
											sx={{ fontWeight: "bold", textTransform: "none", borderRadius: 2 }}
										>
											Confirm
										</Button>
										<Button
											size="small"
											variant="outlined"
											color="error"
											onClick={() => handleDisputeMatch(pm._id)}
											sx={{ fontWeight: "bold", textTransform: "none", borderRadius: 2 }}
										>
											Dispute
										</Button>
									</Box>
								</Box>
							))}
						</Paper>
					)}

					{/* ELO RANKING & STATS CARD */}
					<Paper
						elevation={0}
						sx={{
							p: 3.5,
							mb: 3,
							borderRadius: 4,
							background: "rgba(255, 255, 255, 0.03)",
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Typography variant="h6" fontWeight="bold" sx={{ mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
							<TrophyIcon /> Player Rating & Tier Progression
						</Typography>

						<Grid container spacing={2} sx={{ mb: 3 }}>
							{/* Singles Elo */}
							<Grid xs={12} sm={6}>
								<Box
									sx={{
										p: 2.5,
										borderRadius: 3,
										bgcolor: singlesTier.bg,
										border: `1px solid ${singlesTier.color}`,
									}}
								>
									<Typography variant="caption" fontWeight="bold" sx={{ color: singlesTier.color }}>
										SINGLES ELO • {singlesTier.label.toUpperCase()}
									</Typography>
									<Typography variant="h3" fontWeight="900" sx={{ color: "text.primary", mt: 0.5 }}>
										{singlesElo}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
										Competitive GMU Singles Ladder
									</Typography>
								</Box>
							</Grid>

							{/* Doubles Elo */}
							<Grid xs={12} sm={6}>
								<Box
									sx={{
										p: 2.5,
										borderRadius: 3,
										bgcolor: "action.hover",
										border: "1px solid",
										borderColor: "divider",
									}}
								>
									<Typography variant="caption" fontWeight="bold" color="text.secondary">
										DOUBLES ELO
									</Typography>
									<Typography variant="h3" fontWeight="900" sx={{ color: "text.primary", mt: 0.5 }}>
										{doublesElo}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
										Team & Pair Play Rating
									</Typography>
								</Box>
							</Grid>
						</Grid>

						{/* Win/Loss Record */}
						<Box sx={{ p: 2, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
							<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
								<Typography variant="body2" fontWeight="bold">
									Career Record: {wins}W - {losses}L ({totalMatches} matches)
								</Typography>
								<Typography variant="body2" fontWeight="bold" color="primary.main">
									{winRate}% Win Rate
								</Typography>
							</Box>
							<LinearProgress
								variant="determinate"
								value={winRate}
								sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(0,0,0,0.08)" }}
							/>
						</Box>
					</Paper>

					{/* RECENT MATCH HISTORY */}
					<Paper
						elevation={0}
						sx={{
							p: 3.5,
							borderRadius: 4,
							background: "rgba(255, 255, 255, 0.03)",
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
							<Typography variant="h6" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<ShuttlecockIcon /> Recent Matches
							</Typography>
							<Button
								size="small"
								onClick={() => navigate("/leaderboard")}
								sx={{ textTransform: "none", fontWeight: "bold" }}
							>
								View Leaderboard
							</Button>
						</Box>

						{userMatches.length === 0 ? (
							<Box sx={{ textAlign: "center", py: 4 }}>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
									No verified matches recorded yet. Ready to hit the courts?
								</Typography>
								<Button
									variant="outlined"
									startIcon={<TrophyIcon />}
									onClick={() => setReportModalOpen(true)}
									sx={{ borderRadius: 3, fontWeight: "bold", textTransform: "none" }}
								>
									Log Your First Match
								</Button>
							</Box>
						) : (
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
								{userMatches.slice(0, 5).map((m) => {
									const isTeam1 = (m.team1 || []).some(p => (p._id || p) === (currentUser.id || currentUser._id));
									const isWinner = (isTeam1 && m.winner === "team1") || (!isTeam1 && m.winner === "team2");
									const opponentTeam = isTeam1 ? m.team2 : m.team1;
									const opponentNames = (opponentTeam || []).map(p => p.name || "Opponent").join(" & ");

									return (
										<Box
											key={m._id}
											sx={{
												p: 2,
												borderRadius: 3,
												bgcolor: "background.paper",
												border: "1px solid",
												borderColor: "divider",
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center"
											}}
										>
											<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
												<Chip
													label={isWinner ? "VICTORY" : "DEFEAT"}
													size="small"
													color={isWinner ? "success" : "error"}
													sx={{ fontWeight: "bold", borderRadius: 1.5 }}
												/>
												<Box>
													<Typography variant="subtitle2" fontWeight="bold">
														vs {opponentNames}
													</Typography>
													<Typography variant="caption" color="text.secondary">
														{m.type === "singles" ? "Singles" : "Doubles"} • {formatTime(m.date)}
													</Typography>
												</Box>
											</Box>

											<Typography variant="h6" fontWeight="900" sx={{ color: isWinner ? "success.main" : "text.secondary" }}>
												{m.team1Score} - {m.team2Score}
											</Typography>
										</Box>
									);
								})}
							</Box>
						)}
					</Paper>
				</Grid>

				{/* RIGHT COLUMN: ANNOUNCEMENTS & OFFICIAL UPDATES */}
				<Grid xs={12} md={5}>
					<Paper
						elevation={0}
						sx={{
							p: 3.5,
							borderRadius: 4,
							background: "rgba(255, 255, 255, 0.03)",
							border: "1px solid",
							borderColor: "divider",
							position: "sticky",
							top: 24
						}}
					>
						<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
							<Typography variant="h6" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<MegaphoneIcon /> Official Club Updates
							</Typography>
							<Chip label={`${announcements.length} Posts`} size="small" sx={{ fontWeight: "bold" }} />
						</Box>

						{/* Admin Announcement Creator */}
						{currentUser?.role === "admin" && (
							<Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
								<Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
									Post Official Club Announcement
								</Typography>
								<TextField
									fullWidth
									multiline
									rows={2}
									placeholder="Share tournament notices, court closures, or club announcements..."
									value={newUpdateText}
									onChange={(e) => setNewUpdateText(e.target.value)}
									size="small"
									sx={{ mb: 1.5, bgcolor: "background.paper", borderRadius: 2 }}
								/>
								<Button
									variant="contained"
									size="small"
									onClick={handlePostUpdate}
									disabled={isPosting || !newUpdateText.trim()}
									sx={{ fontWeight: "bold", borderRadius: 2, textTransform: "none" }}
								>
									{isPosting ? "Posting..." : "Publish Announcement"}
								</Button>
							</Box>
						)}

						{/* Announcements Feed */}
						{loading ? (
							<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
								<CircularProgress size={28} />
							</Box>
						) : announcements.length === 0 ? (
							<Box sx={{ textAlign: "center", py: 5 }}>
								<Typography variant="body2" color="text.secondary">
									No announcements at this time. All courts are clear!
								</Typography>
							</Box>
						) : (
							<Box className="custom-scrollbar" sx={{ maxHeight: 520, overflowY: "auto", pr: 1, display: "flex", flexDirection: "column", gap: 2 }}>
								{announcements.map((a) => (
									<Paper
										key={a._id}
										elevation={0}
										sx={{
											p: 2.5,
											borderRadius: 3,
											bgcolor: "background.paper",
											border: "1px solid",
											borderColor: "divider",
											transition: "all 0.2s",
											"&:hover": { borderColor: "primary.main" }
										}}
									>
										<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
											<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
												<Avatar
													sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: "0.8rem", fontWeight: "bold" }}
												>
													{(a.authorName || "A").charAt(0).toUpperCase()}
												</Avatar>
												<Typography variant="subtitle2" fontWeight="bold">
													{a.authorName || "Club Officer"}
												</Typography>
											</Box>

											{currentUser?.role === "admin" && (
												<IconButton
													size="small"
													color="error"
													onClick={() => setDeleteUpdateId(a._id)}
													aria-label="Delete announcement"
												>
													<TrashIcon />
												</IconButton>
											)}
										</Box>

										<Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap", mb: 1 }}>
											{a.content}
										</Typography>

										<Typography variant="caption" sx={{ color: "text.secondary" }}>
											{formatTime(a.createdAt)}
										</Typography>
									</Paper>
								))}
							</Box>
						)}
					</Paper>
				</Grid>
			</Grid>

			{/* ===================== DIALOGS ===================== */}
			{/* Delete Announcement Confirmation */}
			<Dialog
				open={!!deleteUpdateId}
				onClose={() => setDeleteUpdateId(null)}
				PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
			>
				<DialogTitle sx={{ fontWeight: "bold", color: "error.main" }}>
					Delete Announcement?
				</DialogTitle>
				<DialogContent>
					<Typography variant="body2">
						Are you sure you want to delete this official update? This action cannot be undone.
					</Typography>
				</DialogContent>
				<MuiDialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setDeleteUpdateId(null)} color="inherit" sx={{ textTransform: "none", fontWeight: "bold" }}>
						Cancel
					</Button>
					<Button onClick={confirmDeleteUpdate} variant="contained" color="error" sx={{ textTransform: "none", fontWeight: "bold", borderRadius: 2 }}>
						Delete
					</Button>
				</MuiDialogActions>
			</Dialog>

			{/* Report Match Modal */}
			<ReportMatchModal
				open={reportModalOpen}
				onClose={() => setReportModalOpen(false)}
			/>
		</Box>
	);
}
