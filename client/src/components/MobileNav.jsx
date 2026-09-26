// client/src/components/MobileNav.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Paper,
	BottomNavigation,
	BottomNavigationAction,
	Box,
} from "@mui/material";

// Sleek Icons
const HomeIcon = () => (
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
		<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
		<polyline points="9 22 9 12 15 12 15 22"></polyline>
	</svg>
);
const ForumIcon = () => (
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
		<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
	</svg>
);
const ProfileIcon = () => (
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
		<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
		<circle cx="12" cy="7" r="4"></circle>
	</svg>
);

export default function MobileNav() {
	const navigate = useNavigate();
	const location = useLocation();
	const [value, setValue] = useState(0);

	const currentUser = JSON.parse(localStorage.getItem("user"));

	// Sync the active tab with the current URL
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (location.pathname === "/") setValue(0);
		else if (location.pathname.startsWith("/forum")) setValue(1);
		else if (location.pathname.startsWith("/profile")) setValue(2);
	}, [location.pathname]);

	if (!currentUser) return null; // Don't show nav if not logged in

	return (
		<Paper
			elevation={8}
			sx={{
				position: "fixed",
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 1000,
				display: { xs: "block", md: "none" }, // HIDDEN ON LAPTOPS!
				borderTop: "1px solid #e0e0e0",
				pb: "env(safe-area-inset-bottom)", // Fixes overlapping on iPhones with the home bar
			}}
		>
			<BottomNavigation
				showLabels
				value={value}
				onChange={(event, newValue) => {
					setValue(newValue);
					if (newValue === 0) navigate("/");
					if (newValue === 1) navigate("/forum");
					if (newValue === 2) navigate(`/profile/${currentUser.id}`);
				}}
				sx={{
					height: 65,
					"& .MuiBottomNavigationAction-root": {
						color: "text.secondary",
						minWidth: 0,
					},
					"& .Mui-selected": {
						color: "primary.main",
						fontWeight: "bold",
					},
				}}
			>
				<BottomNavigationAction
					label="Dashboard"
					icon={
						<Box sx={{ mb: 0.5 }}>
							<HomeIcon />
						</Box>
					}
				/>
				<BottomNavigationAction
					label="Forum"
					icon={
						<Box sx={{ mb: 0.5 }}>
							<ForumIcon />
						</Box>
					}
				/>
				<BottomNavigationAction
					label="Profile"
					icon={
						<Box sx={{ mb: 0.5 }}>
							<ProfileIcon />
						</Box>
					}
				/>
			</BottomNavigation>
		</Paper>
	);
}
