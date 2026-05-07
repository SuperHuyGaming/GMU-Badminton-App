// client/src/App.jsx
import { useState, useEffect } from "react";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Forum from "./pages/Forum";
import Admin from "./pages/Admin";
import {
	BrowserRouter,
	Routes,
	Route,
	Link as RouterLink,
	Navigate,
} from "react-router-dom";
import {
	ThemeProvider,
	createTheme,
	CssBaseline,
	AppBar,
	Toolbar,
	Typography,
	Button,
	Container,
	Box,
	Divider,
	Avatar,
	Snackbar,
	Alert,
	Menu,
	MenuItem,
	IconButton,
	Drawer,
	List,
	ListItemButton,
	ListItemText,
	Badge,
} from "@mui/material";
import { io } from "socket.io-client";

const socket = io(`${import.meta.env.VITE_API_URL}`);

const HamburgerIcon = () => (
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
		<line x1="3" y1="12" x2="21" y2="12"></line>
		<line x1="3" y1="6" x2="21" y2="6"></line>
		<line x1="3" y1="18" x2="21" y2="18"></line>
	</svg>
);

const BellIcon = () => (
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
		<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
		<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
	</svg>
);

const gmuTheme = createTheme({
	palette: {
		primary: { main: "#006633" },
		secondary: { main: "#FFCC33" },
		background: { default: "#f4f6f8" },
	},
	typography: {
		fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
		h3: { fontWeight: 800, letterSpacing: "-0.03em" },
		h5: { fontWeight: 600 },
	},
});

const AdminRoute = ({ children, user }) => {
	if (!user || user.role !== "admin") return <Navigate to="/" replace />;
	return children;
};

function App() {
	const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
	const [toastMessage, setToastMessage] = useState("");

	const [anchorEl, setAnchorEl] = useState(null);
	const open = Boolean(anchorEl);

	const [notifAnchorEl, setNotifAnchorEl] = useState(null);
	const notifOpen = Boolean(notifAnchorEl);

	const [notifications, setNotifications] = useState([]);
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		if (localStorage.getItem("justLoggedOut")) {
			setToastMessage("You have been successfully logged out.");
			localStorage.removeItem("justLoggedOut");
		}
	}, []);

	useEffect(() => {
		if (!user) return;

		fetch(
			`${import.meta.env.VITE_API_URL}/api/forum/notifications/${user.id}`,
		)
			.then((res) => res.json())
			.then((data) => setNotifications(data))
			.catch(console.error);

		const handleNewNotification = (notification) => {
			if (notification.targetUserId === user.id) {
				setNotifications((prev) => [notification, ...prev]);
				setToastMessage(notification.message);
			}
		};

		socket.on("newNotification", handleNewNotification);
		return () => socket.off("newNotification", handleNewNotification);
	}, [user]);

	const unreadCount = notifications.filter((n) => !n.read).length;

	const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
	const handleMenuClose = () => setAnchorEl(null);

	const handleNotifClick = (event) => {
		setNotifAnchorEl(event.currentTarget);
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

		fetch(
			`${import.meta.env.VITE_API_URL}/api/forum/notifications/${user.id}/read`,
			{
				method: "PUT",
			},
		).catch(console.error);
	};

	const handleNotifClose = () => setNotifAnchorEl(null);

	const clearNotifications = () => {
		setNotifications([]);
		handleNotifClose();
	};

	const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

	const handleLogout = () => {
		handleMenuClose();
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		setUser(null);
		localStorage.setItem("justLoggedOut", "true");
		window.location.href = "/";
	};

	return (
		<ThemeProvider theme={gmuTheme}>
			<CssBaseline />
			<BrowserRouter>
				<AppBar
					position="sticky"
					color="primary"
					elevation={0}
					sx={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
				>
					<Toolbar sx={{ justifyContent: "space-between" }}>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: { xs: 1, md: 4 },
							}}
						>
							<IconButton
								color="inherit"
								edge="start"
								onClick={handleDrawerToggle}
								sx={{ display: { md: "none" } }}
							>
								<HamburgerIcon />
							</IconButton>

							<Typography
								variant="h6"
								component={RouterLink}
								to="/"
								sx={{
									textDecoration: "none",
									color: "secondary.main",
									fontWeight: 900,
									fontSize: "1.1rem",
									letterSpacing: "-0.5px",
								}}
							>
								GMU Badminton
							</Typography>

							<Box
								sx={{
									display: { xs: "none", md: "flex" },
									gap: 1,
								}}
							>
								<Button
									color="inherit"
									component={RouterLink}
									to="/"
									sx={{
										textTransform: "none",
										fontWeight: 600,
									}}
								>
									Dashboard
								</Button>
								<Button
									color="inherit"
									component={RouterLink}
									to="/forum"
									sx={{
										textTransform: "none",
										fontWeight: 600,
									}}
								>
									Forum
								</Button>
								{user && user.role === "admin" && (
									<Button
										color="warning"
										variant="contained"
										component={RouterLink}
										to="/admin"
										sx={{
											textTransform: "none",
											fontWeight: "bold",
											ml: 2,
											boxShadow: "none",
										}}
									>
										Admin Panel
									</Button>
								)}
							</Box>
						</Box>

						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 2,
							}}
						>
							{user ? (
								<>
									<IconButton
										color="inherit"
										onClick={handleNotifClick}
										sx={{
											transition: "all 0.2s",
											"&:hover": {
												color: "secondary.main",
											},
										}}
									>
										<Badge
											badgeContent={unreadCount}
											color="error"
										>
											<BellIcon />
										</Badge>
									</IconButton>

									<Menu
										anchorEl={notifAnchorEl}
										open={notifOpen}
										onClose={handleNotifClose}
										transformOrigin={{
											horizontal: "right",
											vertical: "top",
										}}
										anchorOrigin={{
											horizontal: "right",
											vertical: "bottom",
										}}
										slotProps={{
											paper: {
												elevation: 3,
												sx: {
													mt: 1.5,
													width: 320,
													borderRadius: 3,
													maxHeight: 400,
												},
											},
										}}
									>
										<Box
											sx={{
												px: 2,
												py: 1.5,
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												borderBottom: "1px solid #eee",
											}}
										>
											<Typography fontWeight="bold">
												Notifications
											</Typography>
											{notifications.length > 0 && (
												<Typography
													variant="caption"
													color="primary"
													sx={{
														cursor: "pointer",
														fontWeight: "bold",
														"&:hover": {
															textDecoration:
																"underline",
														},
													}}
													onClick={clearNotifications}
												>
													Clear All
												</Typography>
											)}
										</Box>

										{notifications.length === 0 ? (
											<MenuItem
												sx={{
													py: 3,
													justifyContent: "center",
													color: "text.secondary",
												}}
												disableRipple
											>
												No new notifications
											</MenuItem>
										) : (
											notifications.map((notif) => (
												<MenuItem
													key={notif._id || notif.id}
													component={RouterLink}
													to={notif.link}
													onClick={handleNotifClose}
													sx={{
														whiteSpace: "normal",
														py: 1.5,
														borderBottom:
															"1px solid #f5f5f5",
														"&:active": {
															transform:
																"scale(0.98)",
														},
													}}
												>
													<Box>
														<Typography
															variant="body2"
															sx={{
																lineHeight: 1.3,
															}}
														>
															{notif.message}
														</Typography>
														<Typography
															variant="caption"
															color="text.secondary"
															sx={{
																mt: 0.5,
																display:
																	"block",
															}}
														>
															{new Date(
																notif.time,
															).toLocaleTimeString(
																[],
																{
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
														</Typography>
													</Box>
												</MenuItem>
											))
										)}
									</Menu>

									<Avatar
										src={user.profilePic}
										onClick={handleAvatarClick}
										sx={{
											width: 38,
											height: 38,
											bgcolor: "secondary.main",
											color: "primary.main",
											fontWeight: "bold",
											border: "2px solid #FFCC33",
											cursor: "pointer",
											"&:hover": { opacity: 0.8 },
										}}
									>
										{!user.profilePic &&
											user.name.charAt(0).toUpperCase()}
									</Avatar>

									<Menu
										anchorEl={anchorEl}
										open={open}
										onClose={handleMenuClose}
										transformOrigin={{
											horizontal: "right",
											vertical: "top",
										}}
										anchorOrigin={{
											horizontal: "right",
											vertical: "bottom",
										}}
										slotProps={{
											paper: {
												elevation: 3,
												sx: {
													mt: 1.5,
													minWidth: 150,
													borderRadius: 2,
												},
											},
										}}
									>
										<MenuItem
											component={RouterLink}
											to={`/profile/${user.id}`}
											onClick={(e) => {
												if (e.currentTarget)
													e.currentTarget.blur();
												handleMenuClose();
											}}
											sx={{ fontWeight: "bold" }}
										>
											View Profile
										</MenuItem>
										<Divider />
										<MenuItem
											onClick={(e) => {
												if (e.currentTarget)
													e.currentTarget.blur();
												handleLogout();
											}}
											sx={{
												color: "error.main",
												fontWeight: "bold",
											}}
										>
											Log Out
										</MenuItem>
									</Menu>
								</>
							) : (
								<Button
									color="inherit"
									variant="outlined"
									component={RouterLink}
									to="/auth"
									sx={{
										borderColor: "rgba(255,255,255,0.4)",
										textTransform: "none",
										fontWeight: "bold",
									}}
								>
									Login
								</Button>
							)}
						</Box>
					</Toolbar>
				</AppBar>

				<Drawer
					anchor="left"
					open={mobileOpen}
					onClose={handleDrawerToggle}
					sx={{
						display: { xs: "block", md: "none" },
						"& .MuiDrawer-paper": {
							boxSizing: "border-box",
							width: 250,
							backgroundColor: "#006633",
							color: "white",
						},
					}}
				>
					<Box
						onClick={handleDrawerToggle}
						sx={{ textAlign: "center", py: 3 }}
					>
						<Typography
							variant="h6"
							sx={{ fontWeight: 900, color: "#FFCC33" }}
						>
							GMU Badminton
						</Typography>
						<Divider
							sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }}
						/>
						<List>
							<ListItemButton
								component={RouterLink}
								to="/"
								sx={{ textAlign: "center" }}
							>
								<ListItemText
									primaryTypographyProps={{
										fontWeight: "bold",
									}}
									primary="Dashboard"
								/>
							</ListItemButton>
							<ListItemButton
								component={RouterLink}
								to="/forum"
								sx={{ textAlign: "center" }}
							>
								<ListItemText
									primaryTypographyProps={{
										fontWeight: "bold",
									}}
									primary="Forum"
								/>
							</ListItemButton>
							{user && user.role === "admin" && (
								<ListItemButton
									component={RouterLink}
									to="/admin"
									sx={{
										textAlign: "center",
										backgroundColor: "rgba(255,204,51,0.1)",
									}}
								>
									<ListItemText
										primaryTypographyProps={{
											fontWeight: "bold",
											color: "#FFCC33",
										}}
										primary="Admin Panel"
									/>
								</ListItemButton>
							)}
						</List>
					</Box>
				</Drawer>

				<Snackbar
					open={!!toastMessage}
					autoHideDuration={4000}
					onClose={() => setToastMessage("")}
					anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
				>
					<Alert
						onClose={() => setToastMessage("")}
						severity="success"
						variant="filled"
						sx={{ width: "100%" }}
					>
						{toastMessage}
					</Alert>
				</Snackbar>

				<Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 } }}>
					<Routes>
						<Route path="/" element={<Dashboard />} />
						{/* FIXED: The duplicate Forum route is removed! */}
						<Route
							path="/forum"
							element={
								<Forum setToastMessage={setToastMessage} />
							}
						/>
						<Route
							path="/auth"
							element={
								<Auth
									setUser={setUser}
									setToastMessage={setToastMessage}
								/>
							}
						/>
						<Route
							path="/profile/:id"
							element={
								<Profile
									user={user}
									setUser={setUser}
									setToastMessage={setToastMessage}
								/>
							}
						/>
						<Route
							path="/admin"
							element={
								<AdminRoute user={user}>
									<Admin />
								</AdminRoute>
							}
						/>
					</Routes>
				</Container>
			</BrowserRouter>
		</ThemeProvider>
	);
}

export default App;
