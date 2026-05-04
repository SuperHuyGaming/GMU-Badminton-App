// client/src/App.jsx
import { useState, useEffect } from "react";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard"; // NEW Import
import Forum from "./pages/Forum"; // NEW Import
import {
	BrowserRouter,
	Routes,
	Route,
	Link as RouterLink,
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
} from "@mui/material";

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

function App() {
	const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
	const [toastMessage, setToastMessage] = useState("");

	const [anchorEl, setAnchorEl] = useState(null);
	const open = Boolean(anchorEl);

	useEffect(() => {
		if (localStorage.getItem("justLoggedOut")) {
			setToastMessage("You have been successfully logged out.");
			localStorage.removeItem("justLoggedOut");
		}
	}, []);

	const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
	const handleMenuClose = () => setAnchorEl(null);

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
								gap: { xs: 2, md: 4 },
							}}
						>
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
							<Box sx={{ display: "flex", gap: 1 }}>
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
							</Box>
						</Box>

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

				<Container maxWidth="lg" sx={{ mt: 4 }}>
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
					</Routes>
				</Container>
			</BrowserRouter>
		</ThemeProvider>
	);
}

export default App;
