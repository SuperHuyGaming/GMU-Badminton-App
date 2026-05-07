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
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

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

const UsersIcon = () => (
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
		<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
		<circle cx="9" cy="7" r="4"></circle>
		<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
		<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
	</svg>
);

const ArrowRightIcon = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<line x1="5" y1="12" x2="19" y2="12"></line>
		<polyline points="12 5 19 12 12 19"></polyline>
	</svg>
);

export default function Dashboard() {
	const navigate = useNavigate();
	const currentUser = JSON.parse(localStorage.getItem("user"));

	const [status, setStatus] = useState(null);
	const [schedule, setSchedule] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const [statusRes, scheduleRes] = await Promise.all([
					fetch(`${import.meta.env.VITE_API_URL}/api/status`),
					fetch(
						`${import.meta.env.VITE_API_URL}/api/schedule/weekly`,
					),
				]);

				if (statusRes.ok) {
					const statusData = await statusRes.json();
					setStatus(statusData.message);
				}
				if (scheduleRes.ok) {
					const scheduleData = await scheduleRes.json();
					setSchedule(scheduleData);
				}
			} catch (err) {
				console.error("Failed to load dashboard data", err);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	// Creates a safe date string to pass to the Forum URL
	const handleDayClick = (dayName, dateStr) => {
		// Example: dateStr might be "6", dayName "Wednesday"
		// We'll let the user navigate to the forum and let the forum handle the default "Today" if needed
		navigate(`/forum`);
	};

	return (
		<Box sx={{ pb: 10 }}>
			{/* CSS for the Pulsing Live Dot */}
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
				`}
			</style>

			{/* Welcome Section */}
			<Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2 }}>
				{currentUser && (
					<Avatar
						src={currentUser.profilePic}
						sx={{
							width: 56,
							height: 56,
							border: "2px solid #006633",
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
						color="primary"
						sx={{ letterSpacing: "-0.5px" }}
					>
						{currentUser
							? `Ready to play, ${currentUser.name.split(" ")[0]}?`
							: "Welcome to GMU Badminton."}
					</Typography>
					<Typography variant="body1" color="text.secondary">
						Your central hub for schedules, matches, and community.
					</Typography>
				</Box>
			</Box>

			<Grid container spacing={3}>
				{/* LIVE RAC STATUS HERO CARD */}
				<Grid item xs={12}>
					<Paper
						elevation={0}
						sx={{
							p: { xs: 3, md: 5 },
							borderRadius: 4,
							background:
								"linear-gradient(135deg, #006633 0%, #004d26 100%)",
							color: "white",
							position: "relative",
							overflow: "hidden",
							boxShadow: "0 10px 30px rgba(0, 102, 51, 0.2)",
						}}
					>
						{/* Abstract background decoration */}
						<Box
							sx={{
								position: "absolute",
								right: -50,
								top: -50,
								opacity: 0.1,
								transform: "rotate(15deg)",
							}}
						>
							<ActivityIcon sx={{ width: 200, height: 200 }} />
						</Box>

						<Box sx={{ position: "relative", zIndex: 1 }}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 1.5,
									mb: 2,
								}}
							>
								<div className="live-indicator"></div>
								<Typography
									variant="h6"
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

							{loading ? (
								<CircularProgress
									sx={{ color: "#FFCC33", my: 2 }}
								/>
							) : (
								<Typography
									variant="h4"
									fontWeight="800"
									sx={{
										mb: 3,
										maxWidth: "800px",
										lineHeight: 1.3,
									}}
								>
									{status ||
										"Status currently unavailable. Check back soon."}
								</Typography>
							)}

							<Button
								variant="contained"
								color="secondary"
								href="https://recreation.gmu.edu/facilities/facility-hours/"
								target="_blank"
								sx={{
									fontWeight: "bold",
									borderRadius: 2,
									px: 3,
									py: 1.5,
									color: "#006633",
									"&:hover": { backgroundColor: "white" },
								}}
							>
								View Official Mason Rec Schedule
							</Button>
						</Box>
					</Paper>
				</Grid>

				{/* QUICK ACTIONS BENTO BOX */}
				<Grid item xs={12} md={6}>
					<Paper
						component={RouterLink}
						to="/forum"
						elevation={0}
						sx={{
							p: 4,
							borderRadius: 4,
							border: "1px solid #e0e0e0",
							textDecoration: "none",
							color: "inherit",
							display: "flex",
							flexDirection: "column",
							height: "100%",
							transition: "all 0.2s",
							"&:hover": {
								borderColor: "primary.main",
								transform: "translateY(-4px)",
								boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
							},
						}}
					>
						<Box
							sx={{
								p: 1.5,
								backgroundColor: "rgba(0,102,51,0.1)",
								borderRadius: 3,
								width: "fit-content",
								mb: 2,
								color: "primary.main",
							}}
						>
							<UsersIcon />
						</Box>
						<Typography variant="h5" fontWeight="bold" gutterBottom>
							Community Forum
						</Typography>
						<Typography
							color="text.secondary"
							sx={{ mb: 3, flexGrow: 1 }}
						>
							Organize matches, find doubles partners, and connect
							with other players on campus.
						</Typography>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1,
								color: "primary.main",
								fontWeight: "bold",
							}}
						>
							Explore Feed <ArrowRightIcon />
						</Box>
					</Paper>
				</Grid>

				<Grid item xs={12} md={6}>
					<Paper
						component={RouterLink}
						to={
							currentUser ? `/profile/${currentUser.id}` : "/auth"
						}
						elevation={0}
						sx={{
							p: 4,
							borderRadius: 4,
							border: "1px solid #e0e0e0",
							textDecoration: "none",
							color: "inherit",
							display: "flex",
							flexDirection: "column",
							height: "100%",
							transition: "all 0.2s",
							"&:hover": {
								borderColor: "secondary.main",
								transform: "translateY(-4px)",
								boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
							},
						}}
					>
						<Box
							sx={{
								p: 1.5,
								backgroundColor: "rgba(255,204,51,0.2)",
								borderRadius: 3,
								width: "fit-content",
								mb: 2,
								color: "#b38f00",
							}}
						>
							<ActivityIcon />
						</Box>
						<Typography variant="h5" fontWeight="bold" gutterBottom>
							{currentUser
								? "Your Player Profile"
								: "Join the Roster"}
						</Typography>
						<Typography
							color="text.secondary"
							sx={{ mb: 3, flexGrow: 1 }}
						>
							{currentUser
								? "Update your skill level, preferred play style, and track your recent activity."
								: "Create an account to post in the forum, comment, and build your player profile."}
						</Typography>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1,
								color: "#b38f00",
								fontWeight: "bold",
							}}
						>
							{currentUser ? "View Profile" : "Sign Up"}{" "}
							<ArrowRightIcon />
						</Box>
					</Paper>
				</Grid>

				{/* WEEKLY SCHEDULE */}
				<Grid item xs={12}>
					<Box sx={{ mt: 2, mb: 3 }}>
						<Typography
							variant="h4"
							fontWeight="900"
							color="primary"
						>
							Weekly Schedule
						</Typography>
					</Box>

					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: 2,
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
							schedule.map((item, index) => (
								<Paper
									key={index}
									elevation={0}
									onClick={() => navigate("/forum")}
									sx={{
										p: { xs: 2, sm: 3 },
										borderRadius: 3,
										border: "1px solid #e0e0e0",
										display: "flex",
										alignItems: "center",
										gap: { xs: 2, sm: 4 },
										transition: "all 0.2s",
										cursor: "pointer",
										position: "relative",
										overflow: "hidden",
										"&:hover": {
											borderColor: "primary.main",
											transform: "translateX(4px)",
											boxShadow:
												"0 4px 15px rgba(0,0,0,0.03)",
										},
									}}
								>
									{/* Colored left bar identifier */}
									<Box
										sx={{
											position: "absolute",
											left: 0,
											top: 0,
											bottom: 0,
											width: "6px",
											backgroundColor:
												item.playType?.includes(
													"Dedicated",
												)
													? "secondary.main"
													: "primary.main",
										}}
									/>

									{/* Date Badge */}
									<Box
										sx={{
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											justifyContent: "center",
											backgroundColor: "#f4f6f8",
											borderRadius: 2,
											minWidth: "70px",
											p: 1.5,
										}}
									>
										<Typography
											variant="caption"
											fontWeight="bold"
											color="text.secondary"
											sx={{ textTransform: "uppercase" }}
										>
											{item.date?.split(" ")[0] || "Day"}
										</Typography>
										<Typography
											variant="h5"
											fontWeight="900"
											color="primary"
										>
											{item.date?.split(" ")[1] || "-"}
										</Typography>
									</Box>

									{/* Details */}
									<Box sx={{ flexGrow: 1 }}>
										<Typography
											variant="h6"
											fontWeight="bold"
										>
											{item.day || "Loading Day"}
										</Typography>
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 0.5,
											}}
										>
											📍{" "}
											{item.location ||
												"Linn Gym Court A/B"}
										</Typography>
									</Box>

									{/* Play Type Badge */}
									<Box
										sx={{
											display: {
												xs: "none",
												sm: "block",
											},
										}}
									>
										<Chip
											label={item.playType || "Open Play"}
											color={
												item.playType?.includes(
													"Dedicated",
												)
													? "secondary"
													: "default"
											}
											variant={
												item.playType?.includes(
													"Dedicated",
												)
													? "filled"
													: "outlined"
											}
											sx={{
												fontWeight: "bold",
												borderRadius: 2,
											}}
										/>
									</Box>
								</Paper>
							))
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
