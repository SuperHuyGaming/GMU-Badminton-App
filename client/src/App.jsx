// client/src/App.jsx
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
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

const AdminRoute = ({ children }) => {
	const { user } = useAuth();
	if (!user || user.role !== "admin") return <Navigate to="/" replace />;
	return children;
};

function App() {
	const { toastMessage, setToastMessage } = useAuth();

	return () => socket.off("newNotification", handleNewNotification);
	}, [user]);

	const unreadCount = notifications.filter((n) => !n.read).length;

	const handleAvatarClick = (event) => setAnchorEl(event.currentTarget);
	const handleMenuClose = () => setAnchorEl(null);

	const handleNotifClick = (event) => {
		setNotifAnchorEl(event.currentTarget);
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

		apiFetch(`/api/forum/notifications/${user.id}/read`, {
			method: "PUT",
		}).catch(console.error);
	};

	const handleNotifClose = () => setNotifAnchorEl(null);

	const clearNotifications = () => {
		setNotifications([]);
		handleNotifClose();
	};

	const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

	const handleLogout = async () => {
		handleMenuClose();
		const refreshToken = localStorage.getItem("refreshToken");
		if (refreshToken) {
			await apiFetch("/api/auth/logout", {
				method: "POST",
				body: JSON.stringify({ refreshToken }),
			}).catch(console.error);
		}
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		localStorage.removeItem("user");
		setUser(null);
		localStorage.setItem("justLoggedOut", "true");
		window.location.href = "/";
	};

	return (
		<ThemeProvider theme={gmuTheme}>
			<CssBaseline />
			<BrowserRouter>
				<Navbar />

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
								<Forum />
							}
						/>
						<Route
							path="/auth"
							element={
								<Auth />
							}
						/>
						<Route
							path="/profile/:id"
							element={
								<Profile />
							}
						/>
						<Route
							path="/admin"
							element={
								<AdminRoute>
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
