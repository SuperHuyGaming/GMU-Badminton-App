// client/src/App.jsx
import React, { useEffect, createContext, useMemo, useState, Suspense } from "react";
import { Toaster } from 'react-hot-toast';
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
const Auth = React.lazy(() => import("./pages/Auth"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Forum = React.lazy(() => import("./pages/Forum"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Leaderboard = React.lazy(() => import("./pages/Leaderboard"));
const Landing = React.lazy(() => import("./pages/Landing"));
const Tournaments = React.lazy(() => import("./pages/Tournaments"));
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import socket from "./utils/socket";
import posthog from 'posthog-js';

// Initialize PostHog Analytics
posthog.init('mock-posthog-api-key', {
    api_host: 'https://app.posthog.com',
    autocapture: true, // Automatically captures clicks, pageviews, etc.
    loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug(false);
    }
});

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
	GlobalStyles,
	CircularProgress,
	Box,
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
			<Suspense fallback={
				<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
					<CircularProgress color="primary" />
				</Box>
			}>
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
								<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
									<Landing />
								</motion.div>
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
								<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
									<Admin />
								</motion.div>
							</AdminRoute>
						}
					/>
					<Route
						path="/tournaments"
						element={
							<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
								<Tournaments />
							</motion.div>
						}
					/>
					{/* Catch all */}
					<Route path="*" element={<Navigate to="/" />} />
				</Routes>
			</Suspense>
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

	useEffect(() => {
		if (user) {
			posthog.identify(user.id || user._id, {
				name: user.name,
				skillLevel: user.skillLevel
			});
		} else {
			posthog.reset();
		}
	}, [user]);

	const theme = useMemo(() => createTheme({
		palette: {
			mode,
			primary: { main: "#006633", dark: "#004d26", light: "#33855c" },
			secondary: { main: "#FFCC33" },
			background: { 
				default: mode === "light" ? "#f4f6f8" : "#02120a", // Ultra deep forest green
				paper: mode === "light" ? "rgba(255, 255, 255, 0.75)" : "rgba(8, 33, 20, 0.75)", // Translucent for glassmorphism
			},
		},
		shape: { borderRadius: 16 }, // Rounder for glass UI
		typography: {
			fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
			h3: { fontWeight: 800, letterSpacing: "-0.03em" },
			h5: { fontWeight: 600 },
		},
		components: {
			MuiPaper: {
				styleOverrides: {
					root: {
						backgroundImage: "none",
						backdropFilter: "blur(20px)",
						WebkitBackdropFilter: "blur(20px)",
						boxShadow: mode === "light" 
							? "0 8px 32px 0 rgba(0, 102, 51, 0.05)" 
							: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
						border: `1px solid ${mode === "light" ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.05)"}`,
					}
				}
			},
			MuiAppBar: {
				styleOverrides: {
					root: {
						backdropFilter: "blur(20px)",
						WebkitBackdropFilter: "blur(20px)",
						backgroundColor: mode === "light" ? "rgba(0, 102, 51, 0.85)" : "rgba(2, 18, 10, 0.85)",
						backgroundImage: "none",
					}
				}
			}
		}
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
				<GlobalStyles styles={{
					'@keyframes gradientShift': {
						'0%': { backgroundPosition: '0% 50%' },
						'50%': { backgroundPosition: '100% 50%' },
						'100%': { backgroundPosition: '0% 50%' }
					},
					body: {
						background: mode === 'light' 
							? 'linear-gradient(-45deg, #f4f6f8, #e6f0eb, #fbf7e9, #f4f6f8)' 
							: 'linear-gradient(-45deg, #02120a, #032b17, #1a1705, #02120a)',
						backgroundSize: '400% 400%',
						animation: 'gradientShift 15s ease infinite',
						backgroundAttachment: 'fixed',
					}
				}} />
				<BrowserRouter>
					<Navbar />

					<Toaster position="top-center" reverseOrder={false} />

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
