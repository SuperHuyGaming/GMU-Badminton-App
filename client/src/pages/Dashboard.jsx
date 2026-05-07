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
	Divider,
	TextField,
	IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
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

export default function Dashboard() {
	const navigate = useNavigate();
	const currentUser = JSON.parse(localStorage.getItem("user"));

	const [status, setStatus] = useState(null);
	const [schedule, setSchedule] = useState([]);
	const [announcements, setAnnouncements] = useState([]);
	const [loading, setLoading] = useState(true);

	// Admin state
	const [newUpdateText, setNewUpdateText] = useState("");
	const [isPosting, setIsPosting] = useState(false);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [statusRes, scheduleRes, announcementsRes] =
					await Promise.all([
						fetch(`${import.meta.env.VITE_API_URL}/api/status`),
						fetch(
							`${import.meta.env.VITE_API_URL}/api/schedule/weekly`,
						),
						fetch(
							`${import.meta.env.VITE_API_URL}/api/announcements`,
						),
					]);

				if (statusRes.ok) setStatus((await statusRes.json()).message);
				if (scheduleRes.ok) setSchedule(await scheduleRes.json());
				if (announcementsRes.ok)
					setAnnouncements(await announcementsRes.json());
			} catch (err) {
				console.error("Failed to load dashboard data", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();

		const handleNewAnnouncement = (newAnn) => {
			setAnnouncements((prev) => [newAnn, ...prev]);
		};
		const handleDeletedAnnouncement = (deletedId) => {
			setAnnouncements((prev) => prev.filter((a) => a._id !== deletedId));
		};

		socket.on("announcementCreated", handleNewAnnouncement);
		socket.on("announcementDeleted", handleDeletedAnnouncement);

		return () => {
			socket.off("announcementCreated", handleNewAnnouncement);
			socket.off("announcementDeleted", handleDeletedAnnouncement);
		};
	}, []);

	// Admin Actions
	const handlePostUpdate = async () => {
		if (!newUpdateText.trim() || currentUser?.role !== "admin") return;
		setIsPosting(true);
		try {
			await fetch(`${import.meta.env.VITE_API_URL}/api/announcements`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
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

	const handleDeleteUpdate = async (id) => {
		if (
			currentUser?.role !== "admin" ||
			!window.confirm("Delete this official update?")
		)
			return;
		try {
			await fetch(
				`${import.meta.env.VITE_API_URL}/api/announcements/${id}?role=${currentUser.role}`,
				{
					method: "DELETE",
				},
			);
		} catch (err) {
			console.error("Failed to delete update", err);
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

	return (
		<Box sx={{ pb: 10 }}>
			<style>
				{`
					@keyframes pulse {
						0% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0.7); }
						70% { box-shadow: 0 0 0 10px rgba(255, 204, 51, 0); }
						100% { box-shadow: 0 0 0 0 rgba(255, 204, 51, 0); }
					}
					.live-indicator {
						width: 12px;
						height: 12px;
						background-color: #FFCC33;
						border-radius: 50%;
						display: inline-block;
						animation: pulse 2s infinite;
					}
					.custom-scrollbar::-webkit-scrollbar { width: 6px; }
					.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
					.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }
				`}
			</style>

			{/* 1. THE UNIFIED HERO BAR */}
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
							src={currentUser.profilePic}
							sx={{
								width: 60,
								height: 60,
								border: "2px solid #FFCC33",
							}}
						>
							{!currentUser.profilePic &&
								currentUser.name.charAt(0).toUpperCase()}
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
						backgroundColor: "rgba(0,0,0,0.2)",
						borderRadius: 3,
						p: 2.5,
						minWidth: { xs: "100%", md: "350px" },
						zIndex: 1,
						border: "1px solid rgba(255,255,255,0.1)",
					}}
				>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							mb: 1,
						}}
					>
						<div className="live-indicator"></div>
						<Typography
							variant="caption"
							fontWeight="bold"
							sx={{
								color: "#FFCC33",
								letterSpacing: "1px",
								textTransform: "uppercase",
							}}
						>
							Live RAC Status
						</Typography>
					</Box>
					<Typography
						variant="h6"
						fontWeight="bold"
						sx={{ mb: 2, lineHeight: 1.2 }}
					>
						{loading ? (
							<CircularProgress
								size={20}
								sx={{ color: "#FFCC33" }}
							/>
						) : (
							status || "Status currently unavailable."
						)}
					</Typography>
					{/* LINK UPDATED HERE */}
					<Button
						size="small"
						variant="contained"
						color="secondary"
						href="https://connect.recreation.gmu.edu/Facility/GetSchedule?facilityId=4434ce67-8efc-4c48-90e1-7add7f48ad24"
						target="_blank"
						sx={{
							fontWeight: "bold",
							borderRadius: 2,
							color: "#006633",
							textTransform: "none",
							"&:hover": { backgroundColor: "white" },
						}}
					>
						Check Official Capacity ➦
					</Button>
				</Box>
			</Paper>

			<Grid container spacing={4}>
				{/* LEFT COLUMN: OFFICIAL UPDATES (40% width) */}
				<Grid item xs={12} md={4}>
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

					{/* ADMIN POST BOX */}
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
										backgroundColor: "white",
									},
								}}
							/>
							<Button
								variant="contained"
								color="primary"
								fullWidth
								disabled={!newUpdateText.trim() || isPosting}
								onClick={handlePostUpdate}
								sx={{ fontWeight: "bold", borderRadius: 2 }}
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
							border: "1px solid #e0e0e0",
							borderRadius: 4,
							height: "600px",
							overflowY: "auto",
							backgroundColor: "white",
							display: "flex",
							flexDirection: "column",
						}}
					>
						{loading ? (
							<Box
								sx={{
									m: "auto",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 2,
								}}
							>
								<CircularProgress />
							</Box>
						) : announcements.length === 0 ? (
							<Box
								sx={{
									m: "auto",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									p: 4,
									textAlign: "center",
									opacity: 0.5,
								}}
							>
								<MegaphoneIcon
									style={{
										width: 40,
										height: 40,
										marginBottom: 8,
									}}
								/>
								<Typography variant="h6" fontWeight="bold">
									No New Updates
								</Typography>
								<Typography variant="body2">
									The court is clear. Check back later for
									official club announcements!
								</Typography>
							</Box>
						) : (
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
								}}
							>
								{announcements.map((announcement, index) => (
									<Box
										key={announcement._id}
										sx={{
											transition: "all 0.2s",
											"&:hover": {
												backgroundColor: "#f9fafb",
											},
										}}
									>
										<Box sx={{ p: 3 }}>
											<Box
												sx={{
													display: "flex",
													justifyContent:
														"space-between",
													alignItems: "flex-start",
													mb: 1.5,
												}}
											>
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 1,
													}}
												>
													<Avatar
														sx={{
															width: 24,
															height: 24,
															bgcolor:
																"primary.main",
															fontSize: "0.7rem",
															fontWeight: "bold",
														}}
													>
														{announcement.authorName.charAt(
															0,
														)}
													</Avatar>
													<Typography
														variant="subtitle2"
														fontWeight="bold"
														color="primary"
													>
														{
															announcement.authorName
														}{" "}
														<span
															style={{
																color: "#888",
																fontWeight:
																	"normal",
															}}
														>
															• Admin
														</span>
													</Typography>
												</Box>

												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 1,
													}}
												>
													<Typography
														variant="caption"
														color="text.disabled"
														sx={{
															fontWeight: "bold",
														}}
													>
														{formatTime(
															announcement.timestamp,
														)}
													</Typography>
													{/* ADMIN DELETE BUTTON */}
													{currentUser?.role ===
														"admin" && (
														<IconButton
															size="small"
															color="error"
															onClick={() =>
																handleDeleteUpdate(
																	announcement._id,
																)
															}
															sx={{
																p: 0.5,
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
											</Box>
											<Typography
												variant="body2"
												sx={{
													whiteSpace: "pre-wrap",
													lineHeight: 1.6,
													color: "text.primary",
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

				{/* RIGHT COLUMN: WEEKLY SCHEDULE (66% width) */}
				<Grid item xs={12} md={8}>
					<Typography
						variant="h5"
						fontWeight="900"
						color="primary"
						sx={{ mb: 2 }}
					>
						Weekly Schedule
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
										border: "1px solid #e0e0e0",
										
									}}
								>
									<CircularProgress size={20} />
								</Paper>
							))
						) : schedule.length > 0 ? (
							schedule.map((item, index) => {
								const isDedicated =
									item.playType?.includes("Dedicated");
								const displayTime =
									item.time ||
									(isDedicated
										? "8:00 PM - 10:45 PM"
										: "6:00 AM - 11:00 PM");

								return (
									<Paper
										key={index}
										elevation={0}
										onClick={() => navigate("/forum")}
										sx={{
											display: "flex",
											borderRadius: 4,
											overflow: "hidden",
											border: "1px solid #e0e0e0",
											transition: "all 0.2s",
											cursor: "pointer",
											"&:hover": {
												borderColor: "primary.main",
												transform: "translateY(-4px)",
												boxShadow:
													"0 8px 25px rgba(0,0,0,0.05)",
											},
										}}
									>
										<Box
											sx={{
												bgcolor: isDedicated
													? "secondary.main"
													: "primary.main",
												color: isDedicated
													? "black"
													: "white",
												minWidth: { xs: 80, sm: 100 },
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												alignItems: "center",
												p: 2,
											}}
										>
											<Typography
												variant="caption"
												fontWeight="bold"
												sx={{
													textTransform: "uppercase",
													letterSpacing: "1px",
												}}
											>
												{item.date?.split(" ")[0] ||
													"Day"}
											</Typography>
											<Typography
												variant="h4"
												fontWeight="900"
											>
												{item.date?.split(" ")[1] ||
													"-"}
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
													justifyContent:
														"space-between",
													alignItems: "flex-start",
													mb: 1,
												}}
											>
												<Typography
													variant="h6"
													fontWeight="bold"
												>
													{item.day || "Loading Day"}
												</Typography>
												<Chip
													label={
														item.playType ||
														"Open Play"
													}
													color={
														isDedicated
															? "secondary"
															: "default"
													}
													variant={
														isDedicated
															? "filled"
															: "outlined"
													}
													size="small"
													sx={{
														fontWeight: "bold",
														borderRadius: 2,
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
													fontWeight="bold"
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 0.5,
														color: isDedicated
															? "primary.main"
															: "text.secondary",
													}}
												>
													<ClockIcon /> {displayTime}
												</Typography>
												<Typography
													variant="body2"
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 0.5,
													}}
												>
													<PinIcon />{" "}
													{item.location ||
														"Linn Gym Court A/B"}
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
									border: "1px solid #e0e0e0",
									textAlign: "center",
								}}
							>
								<Typography color="text.secondary">
									No schedule data available right now.
								</Typography>
							</Paper>
						)}
					</Box>
				</Grid>
			</Grid>
		</Box>
	);
}
