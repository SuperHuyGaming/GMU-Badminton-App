// client/src/pages/Dashboard.jsx
import { DashboardSkeleton } from '../components/Skeletons';
import { useState, useEffect, useRef, useCallback } from "react";
import {
	Typography,
	Box,
	Paper,
	Button,
	Grid,
	Avatar,
	CircularProgress,
	Chip,
	Divider,
	TextField,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions as MuiDialogActions,
	Skeleton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import apiFetch from "../utils/api";
import { getOptimizedAvatar } from "../utils/image";
import { io } from "socket.io-client";

const socket = io(`${import.meta.env.VITE_API_URL}`);

// Sleek SVG Icons
const ActivityIcon = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
	</svg>
);
const MegaphoneIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
		<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
	</svg>
);
const ClockIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<circle cx="12" cy="12" r="10"></circle>
		<polyline points="12 6 12 12 16 14"></polyline>
	</svg>
);
const PinIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
		<circle cx="12" cy="10" r="3"></circle>
	</svg>
);
const TrashIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="3 6 5 6 21 6"></polyline>
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
	</svg>
);
const TrashIconLarge = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="3 6 5 6 21 6"></polyline>
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
	</svg>
);

export default function Dashboard() {
		const currentUser = JSON.parse(localStorage.getItem("user"));

	const [status, setStatus] = useState(null);
	const [schedule, setSchedule] = useState(null);
	const [announcements, setAnnouncements] = useState([]);
		const [loading, setLoading] = useState(true);
	
	// Infinite Scroll State
	


	const [newUpdateText, setNewUpdateText] = useState("");
	const [isPosting, setIsPosting] = useState(false);
	const [deleteUpdateId, setDeleteUpdateId] = useState(null);

	// Load Initial Dashboard Data
	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [statusRes, announcementsRes] = await Promise.all([
					apiFetch(`/api/status`),
					apiFetch(`/api/announcements`)
				]);

				if (statusRes.ok) setStatus((await statusRes.json()).message);
				if (announcementsRes.ok) setAnnouncements(await announcementsRes.json());

				// Fetch Java Court Schedule
				let apiUrl = import.meta.env.VITE_TOURNAMENT_API_URL;
				const isLocalNetwork = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');
				
				if (!apiUrl) {
					apiUrl = isLocalNetwork ? `http://${window.location.hostname}:8081` : null;
				} else if (!apiUrl.startsWith("http")) {
					apiUrl = "https://" + apiUrl;
				}

				if (apiUrl) {
					try {
						const courtRes = await fetch(`${apiUrl}/api/v1/courts/status`);
						if (courtRes.ok) {
							setSchedule(await courtRes.json());
							return;
						}
					} catch (e) {
						console.error("Failed to fetch RAC schedule", e);
						console.log("Java backend unreachable, using fallback...");
					}
				}

				// FALLBACK: Mock Weekly Schedule based on User's Screenshot
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
				// Sort chronologically
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
	}, []);


	const handlePostUpdate = async () => {
		if (!newUpdateText.trim() || currentUser?.role !== "admin") return;
		setIsPosting(true);
		try {
			await apiFetch(`/api/announcements`, {
				method: "POST",
				body: JSON.stringify({
					content: newUpdateText,
					authorName: currentUser.name,
					authorId: currentUser.id,
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
				{
					method: "DELETE",
				}
			);
		} catch (err) {
			console.error("Failed to delete update", err);
		}
		setDeleteUpdateId(null);
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

	return (
		<Box sx={{ pb: 10 }}>
			<style>
				{`
					@keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); } }
					@keyframes pulseGreen { 0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(0, 230, 118, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); } }
					@keyframes pulseYellow { 0% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(255, 204, 51, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0); } }
					
					.live-indicator-red { width: 12px; height: 12px; background-color: #FF4444; border-radius: 50%; display: inline-block; animation: pulseRed 2s infinite; }
					.live-indicator-green { width: 12px; height: 12px; background-color: #00E676; border-radius: 50%; display: inline-block; animation: pulseGreen 2s infinite; }
					.live-indicator-yellow { width: 12px; height: 12px; background-color: #FFCC33; border-radius: 50%; display: inline-block; animation: pulseYellow 2s infinite; }
					
					.custom-scrollbar::-webkit-scrollbar { width: 6px; }
					.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
					.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
				`}
			</style>

			<Paper
				elevation={0}
				sx={{
					mb: 4,
					borderRadius: 4,
					background:
						"linear-gradient(135deg, #006633 0%, #004d26 100%)",
					color: "white",
					position: "relative",
					overflow: "hidden",
					display: "flex",
					flexDirection: { xs: "column", md: "row" },
					justifyContent: "space-between",
					alignItems: { xs: "flex-start", md: "center" },
					p: { xs: 3, md: 4 },
					gap: 3,
					boxShadow: "0 10px 30px rgba(0, 102, 51, 0.2)",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 2,
						zIndex: 1,
					}}
				>
					{currentUser && (
						<Avatar
							src={getOptimizedAvatar(currentUser.profilePic, 60)}
							sx={{
								width: 60,
								height: 60,
								border: "2px solid #FFCC33",
							}}
						>
							{!currentUser.profilePic &&
								currentUser.name?.charAt(0).toUpperCase()}
						</Avatar>
					)}
					<Box>
						<Typography
							variant="h4"
							fontWeight="900"
							sx={{ letterSpacing: "-0.5px", color: "white" }}
						>
							{currentUser
								? `Ready to play, ${currentUser.name.split(" ")[0]}?`
								: "Welcome to GMU Badminton."}
						</Typography>
						<Typography
							variant="body2"
							sx={{ color: "rgba(255,255,255,0.8)", mt: 0.5 }}
						>
							Your command center for matches, schedules, and club
							updates.
						</Typography>
					</Box>
				</Box>

				<Box
					sx={{
						backgroundColor: "rgba(0,0,0,0.3)",
						borderRadius: 4,
						p: 3,
						minWidth: { xs: "100%", md: "380px" },
						zIndex: 1,
						border: "1px solid rgba(255,255,255,0.1)",
						backdropFilter: "blur(10px)",
						boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
					}}
				>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							<div className={status?.includes('CLOSED') ? 'live-indicator-red' : status?.includes('Active') ? 'live-indicator-yellow' : 'live-indicator-green'}></div>
							<Typography variant="caption" fontWeight="bold" sx={{ color: "rgba(255,255,255,0.9)", letterSpacing: "1px", textTransform: "uppercase" }}>
								Live RAC Status
							</Typography>
						</Box>
						<Chip 
							size="small" 
							label={status?.includes('CLOSED') ? "CLOSED" : status?.includes('Active') ? "HIGH TRAFFIC" : "OPEN PLAY"} 
							sx={{ 
								bgcolor: status?.includes('CLOSED') ? 'rgba(255,68,68,0.2)' : status?.includes('Active') ? 'rgba(255,204,51,0.2)' : 'rgba(0,230,118,0.2)', 
								color: status?.includes('CLOSED') ? '#FF4444' : status?.includes('Active') ? '#FFCC33' : '#00E676', 
								fontWeight: 'bold' 
							}} 
						/>
					</Box>
					
					<Typography variant="h5" fontWeight="900" sx={{ mb: 1, lineHeight: 1.3, color: 'white' }}>
						{loading ? <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} /> : (status || "Status unavailable")}
					</Typography>
					
					<Box sx={{ mt: 3, mb: 2 }}>
						<Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
							<Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Estimated Capacity</Typography>
							<Typography variant="caption" fontWeight="bold" sx={{ color: 'white' }}>{status?.includes('CLOSED') ? '0%' : status?.includes('Active') ? '85%' : '40%'}</Typography>
						</Box>
						<Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
							<Box sx={{ 
								width: status?.includes('CLOSED') ? '0%' : status?.includes('Active') ? '85%' : '40%', 
								height: '100%', 
								bgcolor: status?.includes('CLOSED') ? '#FF4444' : status?.includes('Active') ? '#FFCC33' : '#00E676', 
								borderRadius: 3, 
								transition: 'width 1.5s cubic-bezier(0.16, 1, 0.3, 1)' 
							}} />
						</Box>
					</Box>

					<Button
						fullWidth
						variant="contained"
						color="secondary"
						href="https://connect.recreation.gmu.edu/Facility/GetSchedule?facilityId=4434ce67-8efc-4c48-90e1-7add7f48ad24"
						target="_blank"
						sx={{ fontWeight: "bold", borderRadius: 3, color: "#006633", py: 1, textTransform: 'none' }}
					>
						Check Official Connect Portal ➦
					</Button>
				</Box>
			</Paper>

			<Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
				<Grid size={{'xs': 12, 'md': 4}}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1,
							mb: 2,
						}}
					>
						<Box
							sx={{
								color: "secondary.main",
								display: "flex",
								alignItems: "center",
							}}
						>
							<MegaphoneIcon />
						</Box>
						<Typography
							variant="h5"
							fontWeight="900"
							color="primary"
						>
							Official Updates
						</Typography>
					</Box>

					{currentUser?.role === "admin" && (
						<Paper
							elevation={0}
							sx={{
								p: 2,
								mb: 2,
								borderRadius: 3,
								border: "1px solid #006633",
								backgroundColor: "rgba(0,102,51,0.02)",
							}}
						>
							<Typography
								variant="caption"
								fontWeight="bold"
								color="primary"
								sx={{ mb: 1, display: "block" }}
							>
								👑 Admin Broadcast
							</Typography>
							<TextField
								fullWidth
								multiline
								maxRows={4}
								placeholder="Share news, cancellations, or updates..."
								value={newUpdateText}
								onChange={(e) =>
									setNewUpdateText(e.target.value)
								}
								size="small"
								sx={{
									mb: 1.5,
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										backgroundColor: "background.paper",
									},
								}}
							/>
							<Button
								variant="contained"
								color="primary"
								fullWidth
								disabled={!newUpdateText.trim() || isPosting}
								onClick={handlePostUpdate}
								sx={{
									fontWeight: "bold",
									borderRadius: 2,
									textTransform: "none",
								}}
							>
								{isPosting
									? "Broadcasting..."
									: "Post Official Update"}
							</Button>
						</Paper>
					)}

					<Paper
						elevation={0}
						className="custom-scrollbar"
						sx={{
							border: "1px solid", borderColor: "divider",
							borderRadius: 4,
							maxHeight: { xs: "350px", md: "600px" },
							overflowY: "auto",
							overflowX: "hidden",
							backgroundColor: "background.paper",
							display: "flex",
							flexDirection: "column",
							width: "100%", // Force 100% width on the container
						}}
					>
						{loading ? (
							<Box
								sx={{
									display: "flex",
									justifyContent: "center",
									p: 4,
								}}
							>
								<CircularProgress />
							</Box>
						) : announcements.length === 0 ? (
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									p: 4,
									textAlign: "center",
									opacity: 0.5,
									width: "100%",
								}}
							>
								<style>
									{`
										@keyframes floatMsg { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
										.floating-msg { animation: floatMsg 3s ease-in-out infinite; color: #006633; }
									`}
								</style>
								<div className="floating-msg">
									<MegaphoneIcon
										style={{
											width: 60,
											height: 60,
											marginBottom: 16,
											opacity: 0.7,
										}}
									/>
								</div>
								<Typography variant="h6" fontWeight="bold" sx={{ color: 'text.primary' }}>
									No New Updates
								</Typography>
								<Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 250, mx: 'auto' }}>
									The court is clear. Check back later for
									official club announcements!
								</Typography>
							</Box>
						) : (
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									width: "100%",
								}}
							>
								{announcements.map((announcement, index) => (
									<Box
										key={announcement._id}
										sx={{
											width: "100%", // Guarantee children fill the space
											transition: "all 0.2s",
											"&:hover": {
												backgroundColor: "action.hover",
											},
										}}
									>
										<Box
											sx={{
												p: 3,
												width: "100%",
												boxSizing: "border-box",
											}}
										>
											<Box
												sx={{
													display: "flex",
													justifyContent:
														"space-between",
													alignItems: "flex-start",
													mb: 2,
													width: "100%", // Force header flexbox to take full width
												}}
											>
												<Box
													sx={{
														display: "flex",
														gap: 1.5,
														flexGrow: 1,
													}}
												>
													{" "}
													{/* flexGrow: 1 pushes right side out */}
													<Avatar
														sx={{
															width: 38,
															height: 38,
															bgcolor:
																"primary.main",
															fontWeight: "bold",
														}}
													>
														{announcement.authorName
															.charAt(0)
															.toUpperCase()}
													</Avatar>
													<Box>
														<Box
															sx={{
																display: "flex",
																alignItems:
																	"center",
																gap: 1,
																flexWrap:
																	"wrap",
															}}
														>
															<Typography
																variant="subtitle2"
																fontWeight="bold"
																color="text.primary"
															>
																{
																	announcement.authorName
																}
															</Typography>
															<Chip
																label="Admin"
																size="small"
																color="error"
																variant="outlined"
																sx={{
																	height: 20,
																	fontSize:
																		"0.7rem",
																	fontWeight:
																		"bold",
																}}
															/>
														</Box>
														<Typography
															variant="caption"
															color="text.secondary"
															sx={{
																display:
																	"block",
																mt: 0.2,
															}}
														>
															{formatTime(
																announcement.timestamp,
															)}
														</Typography>
													</Box>
												</Box>

												{/* Delete Button (Only for Admins) */}
												{currentUser?.role ===
													"admin" && (
													<IconButton
														size="small"
														color="error"
														onClick={() =>
															setDeleteUpdateId(
																announcement._id,
															)
														}
														sx={{
															mt: -0.5,
															mr: -0.5,
															flexShrink: 0,
															"&:hover": {
																backgroundColor:
																	"rgba(211, 47, 47, 0.1)",
															},
														}}
													>
														<TrashIcon />
													</IconButton>
												)}
											</Box>

											<Typography
												variant="body1"
												sx={{
													whiteSpace: "pre-wrap",
													wordBreak: "break-word",
													overflowWrap: "anywhere",
													lineHeight: 1.6,
													color: "text.primary",
													width: "100%",
													display: "block",
												}}
											>
												{announcement.content}
											</Typography>
										</Box>
										{index < announcements.length - 1 && (
											<Divider />
										)}
									</Box>
								))}
							</Box>
						)}
					</Paper>
				</Grid>

				<Grid size={{'xs': 12, 'md': 8}}>
					<Typography
						variant="h5"
						fontWeight="900"
						color="primary"
						sx={{ mb: 2 }}
					>
						Live RAC Court Status
					</Typography>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: 2.5,
						}}
					>
						{loading ? (
							[1, 2, 3].map((n) => (
								<Paper
									key={n}
									elevation={0}
									sx={{
										p: 3,
										borderRadius: 3,
										border: "1px solid", borderColor: "divider",
										display: 'flex',
										gap: 2
									}}
								>
									<Skeleton variant="rounded" width={80} height={80} />
									<Box sx={{ flexGrow: 1 }}>
										<Skeleton variant="text" sx={{ fontSize: '1.5rem' }} width="40%" />
										<Skeleton variant="text" sx={{ fontSize: '1rem' }} width="20%" />
									</Box>
								</Paper>
							))
						) : schedule?.timeSlots?.length > 0 ? (
							schedule.timeSlots.map((slot, index) => {
								const getStatusColor = (status) => {
									switch(status) {
										case 'DEDICATED': return 'success.main';
										case 'CLUB_ONLY': return 'info.main';
										case 'OPEN_REQ': return 'warning.main';
										case 'UNAVAILABLE': return 'error.main';
										default: return 'text.secondary';
									}
								};
								
								const getStatusLabel = (status) => {
									switch(status) {
										case 'DEDICATED': return '🟢 Dedicated Drop-in';
										case 'CLUB_ONLY': return '🔵 Club Members Only';
										case 'OPEN_REQ': return '🟡 Open Rec (Ask for Nets)';
										case 'UNAVAILABLE': return '🔴 Unavailable';
										default: return status;
									}
								};

								const startTimeObj = new Date(slot.startTime);
								const startTime = startTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
								const endTime = new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
								const dayName = startTimeObj.toLocaleDateString('en-US', { weekday: 'short' });

								return (
									<Paper
										key={index}
										elevation={0}
										sx={{
											display: "flex",
											borderRadius: 4,
											overflow: "hidden",
											border: "1px solid", borderColor: "divider",
											transition: "all 0.2s",
											"&:hover": {
												borderColor: "primary.main",
												boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
											},
										}}
									>
										<Box
											sx={{
												bgcolor: getStatusColor(slot.status),
												color: "white",
												minWidth: { xs: 80, sm: 100 },
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												alignItems: "center",
												p: 2,
												textAlign: "center"
											}}
										>
											<Typography variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: '1px', mb: 0.5, opacity: 0.9 }}>
												{dayName}
											</Typography>
											<Typography variant="body2" fontWeight="bold">
												{startTime}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												to
											</Typography>
											<Typography variant="body2" fontWeight="bold">
												{endTime}
											</Typography>
										</Box>
										<Box
											sx={{
												p: { xs: 2, sm: 3 },
												flexGrow: 1,
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
											}}
										>
											<Box
												sx={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "flex-start",
													mb: 1,
												}}
											>
												<Typography variant="h6" fontWeight="bold">
													{slot.eventName}
												</Typography>
												<Chip
													label={getStatusLabel(slot.status)}
													size="small"
													sx={{
														fontWeight: "bold",
														borderRadius: 2,
														bgcolor: `${getStatusColor(slot.status)}22`,
														color: getStatusColor(slot.status),
														border: `1px solid ${getStatusColor(slot.status)}`
													}}
												/>
											</Box>
											<Box
												sx={{
													display: "flex",
													flexWrap: "wrap",
													gap: { xs: 1.5, sm: 3 },
													color: "text.secondary",
													mt: 0.5,
												}}
											>
												<Typography
													variant="body2"
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 0.5,
														color: "text.secondary",
													}}
												>
													<PinIcon /> {schedule.facilityName}
												</Typography>
											</Box>
										</Box>
									</Paper>
								);
							})
						) : (
							<Paper
								elevation={0}
								sx={{
									p: 4,
									borderRadius: 3,
									border: "1px solid", borderColor: "divider",
									textAlign: "center",
								}}
							>
								<Typography color="text.secondary">
									No live court schedule available right now.
								</Typography>
							</Paper>
						)}
					</Box>
				</Grid>
			</Grid>

			

			<Dialog
				open={!!deleteUpdateId}
				onClose={() => setDeleteUpdateId(null)}
				PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
			>
				<DialogTitle
					sx={{
						fontWeight: "bold",
						display: "flex",
						alignItems: "center",
						gap: 1,
						color: "error.main",
					}}
				>
					<TrashIconLarge /> Confirm Deletion
				</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to permanently delete this
						official announcement? This action cannot be undone.
					</Typography>
				</DialogContent>
				<MuiDialogActions sx={{ px: 3, pb: 2 }}>
					<Button
						onClick={() => setDeleteUpdateId(null)}
						color="inherit"
						sx={{ fontWeight: "bold", textTransform: "none" }}
					>
						Cancel
					</Button>
					<Button
						onClick={confirmDeleteUpdate}
						variant="contained"
						color="error"
						sx={{
							fontWeight: "bold",
							textTransform: "none",
							borderRadius: 2,
						}}
					>
						Delete
					</Button>
				</MuiDialogActions>
			</Dialog>
		</Box>
	);
}
