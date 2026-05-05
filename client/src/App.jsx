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
	// NEW IMPORTS FOR MOBILE DRAWER:
	IconButton,
	Drawer,
	List,
	ListItemButton,
	ListItemText,
} from "@mui/material";

// A crash-proof SVG Hamburger Icon (No extra npm packages needed!)
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
	if (!user || user.role !== "admin") {
		return <Navigate to="/" replace />;
	}
	return children;
};

function App() {
	const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
	const [toastMessage, setToastMessage] = useState("");

	// Avatar Menu State
	const [anchorEl, setAnchorEl] = useState(null);
	const open = Boolean(anchorEl);

	// NEW: Mobile Drawer State
	const [mobileOpen, setMobileOpen] = useState(false);

	useEffect(() => {
		if (localStorage.getItem("justLoggedOut")) {
			setToastMessage("You have been successfully logged out.");
			localStorage.removeItem("justLoggedOut");
		}
	}, []);

	const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
	const handleMenuClose = () => setAnchorEl(null);

	// NEW: Toggle the mobile drawer
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
					position="static"
					color="primary"
					elevation={0}
					sx={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}
				>
					<Toolbar sx={{ justifyContent: "space-between" }}>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: { xs: 1, md: 4 }, // Smaller gap on mobile
							}}
						>
							{/* NEW: Mobile Hamburger Button (Hidden on Desktop) */}
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

							{/* DESKTOP LINKS: Hidden on Mobile (xs: "none"), Visible on Desktop (md: "flex") */}
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

						{/* RIGHT SIDE: Avatar and Login button stay the same */}
						<Box>
							{user ? (
								<>
									<Avatar
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
										{user.name.charAt(0).toUpperCase()}
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
										PaperProps={{
											elevation: 3,
											sx: {
												mt: 1.5,
												minWidth: 150,
												borderRadius: 2,
											},
										}}
									>
										<MenuItem
											component={RouterLink}
											to={`/profile/${user.id}`}
											onClick={handleMenuClose}
											sx={{ fontWeight: "bold" }}
										>
											View Profile
										</MenuItem>
										<Divider />
										<MenuItem
											onClick={handleLogout}
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

				{/* NEW: The Mobile Slide-out Drawer */}
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
						<Route path="/forum" element={<Forum />} />
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
