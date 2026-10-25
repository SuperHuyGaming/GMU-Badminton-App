// client/src/components/FeedbackModal.jsx
import { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Typography,
	Box,
	Button,
	TextField,
	Chip,
	IconButton,
	Alert,
	CircularProgress,
	Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BugReportIcon from "@mui/icons-material/BugReport";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FeedbackIcon from "@mui/icons-material/Feedback";
import SendIcon from "@mui/icons-material/Send";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import apiFetch from "../utils/api";

const CATEGORIES = [
	{ id: "bug", label: "Bug Report", icon: BugReportIcon, color: "#e53e3e" },
	{ id: "feature", label: "Feature Request", icon: LightbulbIcon, color: "#d69e2e" },
	{ id: "feedback", label: "General Feedback", icon: FeedbackIcon, color: "#3182ce" },
];

const SEVERITIES = [
	{ id: "low", label: "Low", color: "#38a169", desc: "Cosmetic or minor" },
	{ id: "medium", label: "Medium", color: "#3182ce", desc: "Normal usability" },
	{ id: "high", label: "High", color: "#dd6b20", desc: "Feature impaired" },
	{ id: "critical", label: "Critical", color: "#e53e3e", desc: "App broken / crash" },
];

export default function FeedbackModal() {
	const { isOpen, initialData, closeFeedbackModal } = useFeedback();
	const { user } = useAuth();

	const [type, setType] = useState("bug");
	const [severity, setSeverity] = useState("medium");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [pageUrl, setPageUrl] = useState("");
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	useEffect(() => {
		if (isOpen) {
			setType(initialData?.type || "bug");
			setSeverity(initialData?.severity || "medium");
			setTitle("");
			setDescription("");
			setPageUrl(initialData?.pageUrl || (typeof window !== "undefined" ? window.location.pathname : "/"));
			setGuestName("");
			setGuestEmail("");
			setErrorMessage("");
		}
	}, [isOpen, initialData]);

	const handleSubmit = async (e) => {
		if (e) e.preventDefault();
		setErrorMessage("");

		if (!title.trim() || title.trim().length < 3) {
			setErrorMessage("Please enter a title (at least 3 characters).");
			return;
		}

		if (!description.trim() || description.trim().length < 5) {
			setErrorMessage("Please enter a description (at least 5 characters).");
			return;
		}

		if (!user && guestEmail.trim()) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(guestEmail.trim())) {
				setErrorMessage("Please enter a valid email address.");
				return;
			}
		}

		setSubmitting(true);
		try {
			const payload = {
				type,
				title: title.trim(),
				description: description.trim(),
				severity: type === "bug" ? severity : "medium",
				pageUrl: pageUrl.trim(),
				userName: user ? (user.username || user.name) : guestName.trim() || "Anonymous Guest",
				userEmail: user ? (user.email || "") : guestEmail.trim() || "",
			};

			const res = await apiFetch("/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.message || "Failed to submit feedback.");
			}

			toast.success("Thank you! Your feedback has been sent to our admin team.");
			closeFeedbackModal();
		} catch (err) {
			setErrorMessage(err.message || "Could not submit report. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog
			open={isOpen}
			onClose={closeFeedbackModal}
			maxWidth="sm"
			fullWidth
			aria-labelledby="feedback-dialog-title"
			slotProps={{
				paper: {
					sx: {
						borderRadius: 3,
						p: { xs: 1, sm: 2 },
						bgcolor: "background.paper",
						backgroundImage: "none",
					},
				},
			}}
		>
			<DialogTitle
				id="feedback-dialog-title"
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					pb: 1,
				}}
			>
				<Box>
					<Typography variant="h6" fontWeight="bold" color="text.primary">
						Feedback & Issue Reporting
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Help us improve the GMU Badminton platform. We review every submission!
					</Typography>
				</Box>
				<IconButton
					onClick={closeFeedbackModal}
					size="small"
					aria-label="Close feedback dialog"
					sx={{ color: "text.secondary" }}
				>
					<CloseIcon fontSize="small" />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers sx={{ pt: 2, pb: 2 }}>
				{errorMessage && (
					<Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
						{errorMessage}
					</Alert>
				)}

				{/* Category Selector */}
				<Box sx={{ mb: 3 }}>
					<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 1 }}>
						Submission Category
					</Typography>
					<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
						{CATEGORIES.map((cat) => {
							const Icon = cat.icon;
							const isSelected = type === cat.id;
							return (
								<Chip
									key={cat.id}
									icon={<Icon style={{ color: isSelected ? "#ffffff" : cat.color }} />}
									label={cat.label}
									clickable
									onClick={() => setType(cat.id)}
									variant={isSelected ? "filled" : "outlined"}
									sx={{
										fontWeight: isSelected ? 700 : 500,
										borderColor: isSelected ? "transparent" : "divider",
										bgcolor: isSelected ? "primary.main" : "transparent",
										color: isSelected ? "#ffffff" : "text.primary",
										"&:hover": {
											bgcolor: isSelected ? "primary.dark" : "action.hover",
										},
									}}
								/>
							);
						})}
					</Stack>
				</Box>

				{/* Severity Selector (Shown for Bug Reports) */}
				{type === "bug" && (
					<Box sx={{ mb: 3 }}>
						<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 1 }}>
							Severity Level
						</Typography>
						<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
							{SEVERITIES.map((sev) => {
								const isSelected = severity === sev.id;
								return (
									<Chip
										key={sev.id}
										label={`${sev.label} (${sev.desc})`}
										clickable
										onClick={() => setSeverity(sev.id)}
										size="small"
										variant={isSelected ? "filled" : "outlined"}
										sx={{
											fontWeight: isSelected ? 700 : 500,
											borderColor: isSelected ? sev.color : "divider",
											bgcolor: isSelected ? sev.color : "transparent",
											color: isSelected ? "#ffffff" : "text.secondary",
											"&:hover": {
												bgcolor: isSelected ? sev.color : "action.hover",
											},
										}}
									/>
								);
							})}
						</Stack>
					</Box>
				)}

				{/* Title / Subject Input */}
				<Box sx={{ mb: 2.5 }}>
					<TextField
						fullWidth
						required
						label="Subject / Title"
						placeholder={
							type === "bug"
								? "e.g., Tournament registration button gives a 404 error"
								: type === "feature"
								? "e.g., Add doubles round-robin bracket view"
								: "e.g., Suggestion for court queue clarity"
						}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						slotProps={{ htmlInput: { maxLength: 150 } }}
						helperText={`${title.length}/150 characters`}
					/>
				</Box>

				{/* Description Input */}
				<Box sx={{ mb: 2.5 }}>
					<TextField
						fullWidth
						required
						multiline
						rows={4}
						label="Detailed Description"
						placeholder={
							type === "bug"
								? "What happened? What were you doing right before the bug occurred?"
								: "Describe the suggestion, idea, or feedback in detail..."
						}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						slotProps={{ htmlInput: { maxLength: 3000 } }}
						helperText={`${description.length}/3000 characters`}
					/>
				</Box>

				{/* Auto-Captured Page Context */}
				<Box
					sx={{
						mb: 2.5,
						p: 1.5,
						borderRadius: 2,
						bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)"),
						border: "1px solid",
						borderColor: "divider",
						display: "flex",
						alignItems: "center",
						gap: 1.5,
					}}
				>
					<Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
						📍 <strong>Detected Location:</strong> {pageUrl || "/"} (auto-attached to help our devs quickly diagnose)
					</Typography>
				</Box>

				{/* Submitter Info */}
				<Box>
					{user ? (
						<Box
							sx={{
								p: 1.5,
								borderRadius: 2,
								border: "1px solid",
								borderColor: "divider",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<Typography variant="body2" color="text.secondary">
								Submitting as: <strong>{user.username || user.name || "Member"}</strong> ({user.email})
							</Typography>
							<Chip size="small" label="Authenticated" color="success" variant="outlined" />
						</Box>
					) : (
						<Stack spacing={1.5}>
							<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase" }}>
								Your Contact Details (Optional)
							</Typography>
							<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
								<TextField
									fullWidth
									size="small"
									label="Your Name (Optional)"
									placeholder="e.g. Patriot Shuttler"
									value={guestName}
									onChange={(e) => setGuestName(e.target.value)}
								/>
								<TextField
									fullWidth
									size="small"
									label="Email (Optional, for reply)"
									placeholder="e.g. you@gmu.edu"
									value={guestEmail}
									onChange={(e) => setGuestEmail(e.target.value)}
								/>
							</Stack>
						</Stack>
					)}
				</Box>
			</DialogContent>

			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={closeFeedbackModal} color="inherit" disabled={submitting}>
					Cancel
				</Button>
				<Button
					onClick={handleSubmit}
					variant="contained"
					color="primary"
					disabled={submitting}
					startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
					sx={{ fontWeight: "bold", textTransform: "none", px: 3 }}
				>
					{submitting ? "Sending..." : "Submit Report"}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
