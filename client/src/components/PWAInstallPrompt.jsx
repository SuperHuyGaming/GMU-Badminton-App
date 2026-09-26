import { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	Box,
	useTheme
} from "@mui/material";

export default function PWAInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState(null);
	const [open, setOpen] = useState(false);
	const theme = useTheme();

	useEffect(() => {
		const handleBeforeInstallPrompt = (e) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Stash the event so it can be triggered later.
			setDeferredPrompt(e);
			// Update UI notify the user they can install the PWA
			// Check if already dismissed
			const isDismissed = localStorage.getItem("pwa_install_dismissed");
			if (!isDismissed) {
				setOpen(true);
			}
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		};
	}, []);

	const handleInstallClick = async () => {
		if (!deferredPrompt) return;
		setOpen(false);
		// Show the install prompt
		deferredPrompt.prompt();
		// Wait for the user to respond to the prompt
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			console.log('User accepted the install prompt');
		} else {
			console.log('User dismissed the install prompt');
		}
		// We've used the prompt, and can't use it again, throw it away
		setDeferredPrompt(null);
	};

	const handleDismiss = () => {
		localStorage.setItem("pwa_install_dismissed", "true");
		setOpen(false);
	};

	if (!open) return null;

	return (
		<Dialog
			open={open}
			onClose={handleDismiss}
			PaperProps={{
				sx: { borderRadius: 3, p: 1, maxWidth: 400 }
			}}
		>
			<DialogTitle sx={{ fontWeight: "bold", textAlign: "center" }}>
				Install Mason Badminton Connect
			</DialogTitle>
			<DialogContent sx={{ textAlign: "center", pb: 1 }}>
				<Box sx={{ my: 2 }}>
					<img src="/favicon.svg" alt="App Icon" style={{ width: 80, height: 80 }} />
				</Box>
				<Typography variant="body1" sx={{ mb: 2 }}>
					Add our app to your home screen for the best experience!
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					🏸 View profiles and forums offline in the RAC basement
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					⚡ Lightning fast load times
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					🔔 Instant push notifications
				</Typography>
			</DialogContent>
			<DialogActions sx={{ justifyContent: "center", pb: 2, flexDirection: 'column', gap: 1 }}>
				<Button
					variant="contained"
					color="primary"
					fullWidth
					sx={{ fontWeight: "bold", borderRadius: 2 }}
					onClick={handleInstallClick}
				>
					Add to Home Screen
				</Button>
				<Button
					variant="text"
					color="inherit"
					onClick={handleDismiss}
				>
					Not right now
				</Button>
			</DialogActions>
		</Dialog>
	);
}
