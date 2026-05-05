// client/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
	Box,
	Paper,
	Typography,
	Button,
	CircularProgress,
	Fade,
} from "@mui/material";

function Dashboard() {
	const [apiMessage, setApiMessage] = useState(null);
	const [weeklySchedule, setWeeklySchedule] = useState([]);

	useEffect(() => {
		fetch("http://localhost:5001/api/status")
			.then((res) => res.json())
			.then((data) => setApiMessage(data.message))
			.catch(() => setApiMessage("Unable to reach the server."));

		fetch("http://localhost:5001/api/schedule/weekly")
			.then((res) => res.json())
			.then((data) => setWeeklySchedule(data))
			.catch((err) => console.error(err));
	}, []);

	return (
		<Box sx={{ mt: { xs: 2, md: 4 }, pb: 8, px: { xs: 1, sm: 0 } }}>
			<Paper
				elevation={0}
				sx={{
					p: { xs: 3, md: 6 },
					borderRadius: 4,
					backgroundColor: "#006633",
					color: "white",
					textAlign: "center",
					backgroundImage:
						"linear-gradient(135deg, #006633 0%, #004d26 100%)",
				}}
			>
				<Typography
					variant="h3"
					gutterBottom
					sx={{
						color: "#FFCC33",
						fontSize: { xs: "2rem", md: "3rem" },
					}}
				>
					Live RAC Status
				</Typography>
				{!apiMessage ? (
					<CircularProgress color="secondary" sx={{ mt: 3 }} />
				) : (
					<Fade in={true} timeout={1000}>
						<Typography
							variant="h5"
							sx={{
								mt: 2,
								mb: 4,
								fontWeight: 400,
								opacity: 0.9,
								fontSize: { xs: "1.2rem", md: "1.5rem" },
							}}
						>
							{apiMessage}
						</Typography>
					</Fade>
				)}
				<Button
					variant="outlined"
					color="inherit"
					href="https://recreation.gmu.edu/facilities-hours/"
					target="_blank"
					sx={{ borderColor: "#FFCC33", color: "#FFCC33" }}
				>
					View Official Mason Rec Schedule ↗
				</Button>
			</Paper>

			<Box
				sx={{
					my: { xs: 4, md: 6 },
					p: { xs: 3, md: 5 },
					border: "2px dashed #d9d9d9",
					borderRadius: 4,
					textAlign: "center",
				}}
			>
				<Typography variant="h6" color="text.secondary">
					GMU Badminton Forum
				</Typography>
				<Typography
					variant="body2"
					color="text.disabled"
					sx={{ mb: 2 }}
				>
					Organize matches and connect with players!
				</Typography>
				<Button
					variant="contained"
					color="secondary"
					component={RouterLink}
					to="/forum"
					sx={{ fontWeight: "bold" }}
				>
					Explore the Community Feed
				</Button>
			</Box>

			<Typography
				variant="h4"
				color="primary"
				sx={{
					mb: { xs: 2, md: 4 },
					fontWeight: "bold",
					fontSize: { xs: "1.8rem", md: "2.125rem" },
				}}
			>
				Weekly Schedule
			</Typography>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				{weeklySchedule.map((item, index) => {
					const dateParts = item.date.split(" ");
					const isDedicated = item.status.includes("Dedicated");
					return (
						<Paper
							key={index}
							component={RouterLink}
							to={`/forum?date=${encodeURIComponent(item.date)}&day=${item.day}`}
							elevation={0}
							sx={{
								display: "flex",
								alignItems: "center",
								p: { xs: 1.5, sm: 2 },
								borderRadius: 3,
								border: "1px solid #e0e0e0",
								textDecoration: "none",
								cursor: "pointer",
								"&:hover": { borderColor: "primary.main" },
							}}
						>
							<Box
								sx={{
									minWidth: { xs: 55, sm: 70 },
									height: { xs: 55, sm: 70 },
									borderRadius: 2,
									overflow: "hidden",
									display: "flex",
									flexDirection: "column",
									mr: { xs: 1.5, sm: 3 },
								}}
							>
								<Box
									sx={{
										backgroundColor: "primary.main",
										color: "white",
										textAlign: "center",
										py: 0.5,
										fontSize: {
											xs: "0.65rem",
											sm: "0.75rem",
										},
										fontWeight: "bold",
									}}
								>
									{dateParts[0]}
								</Box>
								<Box
									sx={{
										flex: 1,
										backgroundColor: "#f9f9f9",
										color: "text.primary",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: {
											xs: "1.2rem",
											sm: "1.5rem",
										},
										fontWeight: "bold",
									}}
								>
									{dateParts[1]}
								</Box>
							</Box>
							<Box sx={{ flex: 1 }}>
								<Typography
									variant="h6"
									fontWeight="bold"
									color="text.primary"
									sx={{
										fontSize: {
											xs: "1.1rem",
											sm: "1.25rem",
										},
										lineHeight: 1.2,
									}}
								>
									{index === 0 ? "Today" : item.day}
								</Typography>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{
										fontSize: {
											xs: "0.8rem",
											sm: "0.875rem",
										},
									}}
								>
									📍 {item.location}
								</Typography>
							</Box>
							<Box
								sx={{
									textAlign: "right",
									pr: { xs: 0, sm: 2 },
								}}
							>
								<Typography
									variant="body1"
									fontWeight="600"
									color="text.primary"
									sx={{
										fontSize: { xs: "0.9rem", sm: "1rem" },
									}}
								>
									{isDedicated
										? "Dedicated Play"
										: "Open Play"}
								</Typography>
							</Box>
						</Paper>
					);
				})}
			</Box>
		</Box>
	);
}

export default Dashboard;
