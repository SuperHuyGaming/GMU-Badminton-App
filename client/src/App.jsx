// client/src/App.jsx
import React, { useEffect, createContext, useMemo, useState } from "react";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Forum from "./pages/Forum";
import Admin from "./pages/Admin";
import Messages from "./pages/Messages";
import Leaderboard from "./pages/Leaderboard";
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import socket from "./utils/socket";
import {
	BrowserRouter,
	Routes,
	Route,
	Link as RouterLink,
	Navigate,
	useLocation,
} from "react-router-dom";
import {
	ThemeProvider,
	createTheme,
	CssBaseline,
	Container,
	Snackbar,
	Alert,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";

export const ColorModeContext = createContext({ toggleColorMode: () => {} });

const AdminRoute = ({ children }) => {
	const { user } = useAuth();
	if (!user || user.role !== "admin") return <Navigate to="/" replace />;
	return children;
};

const AnimatedRoutes = () => {
	const location = useLocation();
	const { user } = useAuth();
	
	return (
		<AnimatePresence mode="wait">
			<Routes key={location.pathname}>
				<Route path="/auth" element={!user ? <Auth /> : <Navigate to="/" />} />
				<Route
					path="/leaderboard"
					element={
						user ? (
							<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
								<Leaderboard />
							</motion.div>
						) : (
							<Navigate to="/auth" />
						)
					}
				/>
				<Route
					path="/"
					element={
						user ? (
							<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
								<Dashboard />
							</motion.div>
						) : (
							<Navigate to="/auth" />
						)
					}
				/>
				<Route
					path="/forum"
					element={
						user ? (
							<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
								<Forum />
							</motion.div>
						) : (
							<Navigate to="/auth" />
						)
					}
				/>
				<Route
					path="/profile/:id?"
					element={
						user ? (
							<motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.2 }}>
								<Profile />
							</motion.div>
						) : (
							<Navigate to="/auth" />
						)
					}
				/>
				<Route
					path="/messages"
					element={
						user ? (
							<motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
								<Messages />
							</motion.div>
						) : (
							<Navigate to="/auth" />
						)
					}
				/>
				<Route
					path="/admin"
					element={
						<AdminRoute>
							<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
								<Admin />
							</motion.div>
						</AdminRoute>
					}
				/>
			</Routes>
		</AnimatePresence>
	);
};

function App() {
	const { user, toastMessage, setToastMessage } = useAuth();
	const [mode, setMode] = useState(localStorage.getItem("themeMode") || "light");

	const colorMode = useMemo(() => ({
		toggleColorMode: () => {
			setMode((prevMode) => {
				const nextMode = prevMode === "light" ? "dark" : "light";
				localStorage.setItem("themeMode", nextMode);
				return nextMode;
			});
		},
	}), []);

	const theme = useMemo(() => createTheme({
		palette: {
			mode,
			primary: { main: "#006633", dark: "#004d26", light: "#33855c" },
			secondary: { main: "#FFCC33" },
			background: { 
				default: mode === "light" ? "#f4f6f8" : "#02120a", // Ultra deep forest green
				paper: mode === "light" ? "#ffffff" : "#082114", // Slightly lighter forest green
			},
		},
		shape: { borderRadius: 12 },
		typography: {
			fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
			h3: { fontWeight: 800, letterSpacing: "-0.03em" },
			h5: { fontWeight: 600 },
		},
	}), [mode]);

	useEffect(() => {
		const handleOffline = () => setToastMessage("You are offline. Check your network.");
		window.addEventListener("offline", handleOffline);
		
		const handleBadgeUnlocked = (badge) => {
			setToastMessage(`🏆 Achievement Unlocked: ${badge.name}!`);
		};
		socket.on("badgeUnlocked", handleBadgeUnlocked);

		return () => {
			window.removeEventListener("offline", handleOffline);
			socket.off("badgeUnlocked", handleBadgeUnlocked);
		};
	}, [setToastMessage]);

	return (
		<ColorModeContext.Provider value={colorMode}>
			<ThemeProvider theme={theme}>
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
						<AnimatedRoutes />
						{user && <PushNotificationPrompt />}
					</Container>
				</BrowserRouter>
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export default App;
