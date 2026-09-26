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
const Marketplace = React.lazy(() => import("./pages/Marketplace"));
const Matchmaking = React.lazy(() => import("./pages/Matchmaking"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import PendingMatchesPrompt from "./components/PendingMatchesPrompt";
import ReportMatchModal from "./components/ReportMatchModal";
import socket from "./utils/socket";
import posthog from 'posthog-js';

// Initialize PostHog Analytics only if a real key is provided
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'mock-posthog-api-key';
if (POSTHOG_KEY && POSTHOG_KEY !== 'mock-posthog-api-key') {
    posthog.init(POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        autocapture: true, // Automatically captures clicks, etc.
        capture_pageview: false, // We will manually capture SPA page views
        session_recording: {
            maskAllInputs: false,
            maskTextSelector: "password",
        },
        loaded: (ph) => {
            // eslint-disable-next-line no-undef
            if (process.env.NODE_ENV === 'development') ph.debug(false);
        }
    });
} else {
    // Stub PostHog methods to prevent 404/401 errors and crashes when called
    posthog.init = () => {};
    posthog.capture = () => {};
    posthog.identify = () => {};
    posthog.reset = () => {};
}

import {
	BrowserRouter,
	Routes,
	Route,
	// eslint-disable-next-line no-unused-vars
	Link as RouterLink,
	Navigate,
	useLocation,
} from "react-router-dom";
import {
	ThemeProvider,
	createTheme,
	CssBaseline,
	Container,
	// eslint-disable-next-line no-unused-vars
	Snackbar,
	// eslint-disable-next-line no-unused-vars
	Alert,
	GlobalStyles,
	CircularProgress,
	Box,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";

// eslint-disable-next-line react-refresh/only-export-components
export const ColorModeContext = createContext({ toggleColorMode: () => {} });

const AdminRoute = ({ children }) => {
	const { user } = useAuth();
	if (!user || user.role !== "admin") return <Navigate to="/" replace />;
	return children;
};

const AnimatedRoutes = () => {
	const location = useLocation();
	const { user } = useAuth();
	
    const searchParams = new URLSearchParams(location.search);
    const reportMatchId = searchParams.get("reportMatch");
    const [reportModalOpen, setReportModalOpen] = useState(!!reportMatchId);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReportModalOpen(!!reportMatchId);
    }, [reportMatchId]);

    const handleCloseReportModal = () => {
        setReportModalOpen(false);
        // remove from url
        const newUrl = window.location.pathname;
        window.history.pushState({}, '', newUrl);
    };

    useEffect(() => {
        // Track SPA pageviews for analytics and heatmaps
        posthog.capture('$pageview', {
            $current_url: window.location.href,
        });
    }, [location]);

	return (
		<AnimatePresence mode="wait">
			<Suspense fallback={
				<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
					<CircularProgress color="primary" />
				</Box>
			}>
                <ReportMatchModal 
                    open={reportModalOpen} 
                    onClose={handleCloseReportModal} 
                    opponentId={reportMatchId} 
                />
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
						path="/community"
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
						path="/post/:postId"
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
						path="/marketplace"
						element={
							<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
								<Marketplace />
							</motion.div>
						}
					/>
					<Route
						path="/matchmaking"
						element={
							user ? (
								<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
									<Matchmaking />
								</motion.div>
							) : (
								<Navigate to="/auth" />
							)
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
					<Route path="*" element={
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.2 }}>
                            <NotFound />
                        </motion.div>
                    } />
				</Routes>
			</Suspense>
		</AnimatePresence>
	);
};

function App() {
	// eslint-disable-next-line no-unused-vars
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
		shape: { borderRadius: 4 }, // Reset to standard 4px multiplier to prevent 48px jellybean shapes
		typography: {
			fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
			h3: { fontWeight: 800, letterSpacing: "-0.03em" },
			h5: { fontWeight: 600 },
		},
		transitions: {
			easing: {
				// Highly satisfying custom cubic-bezier curves for micro-interactions
				easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
				easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)', // Snappy out (spring-like)
				easeIn: 'cubic-bezier(0.87, 0, 0.13, 1)',
				sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
				bouncy: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)', // Playful over-shoot
			}
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
			},
			MuiButton: {
				styleOverrides: {
					root: {
						transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
						'&:active': {
							transform: 'scale(0.95)',
						}
					}
				}
			},
			MuiCard: {
				styleOverrides: {
					root: {
						transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1)',
						'&:hover': {
							transform: 'translateY(-4px)',
							boxShadow: mode === "light" 
								? "0 12px 40px 0 rgba(0, 102, 51, 0.12)" 
								: "0 12px 40px 0 rgba(0, 0, 0, 0.6)",
						}
					}
				}
			},
			MuiDialog: {
				styleOverrides: {
					paper: {
						animation: 'dialogPop 350ms cubic-bezier(0.16, 1, 0.3, 1)',
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
					'@keyframes dialogPop': {
						'0%': { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
						'100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
					},
					body: {
						backgroundColor: mode === 'light' ? '#f4f6f8' : '#02120a',
						minHeight: '100vh',
					}
				}} />
				<BrowserRouter>
					<Navbar />

					<Toaster position="top-center" reverseOrder={false} />

					<Container 
						maxWidth="lg" 
						sx={{ 
							mt: { xs: 2, sm: 3, md: 4 }, 
							mb: { xs: 4, sm: 6, md: 8 },
							px: { xs: 2, sm: 3, md: 4 }
						}}
					>
                        {user && <PendingMatchesPrompt />}
						<AnimatedRoutes />
						{user && <PushNotificationPrompt />}
					</Container>
				</BrowserRouter>
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export default App;
