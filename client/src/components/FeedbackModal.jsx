// client/src/components/FeedbackModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
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
	Paper,
	Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import BugReportIcon from "@mui/icons-material/BugReport";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FeedbackIcon from "@mui/icons-material/Feedback";
import SendIcon from "@mui/icons-material/Send";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import LinkIcon from "@mui/icons-material/Link";
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
	const {
		isOpen,
		isMinimized,
		draft,
		initialData,
		closeFeedbackModal,
		minimizeFeedbackModal,
		maximizeFeedbackModal,
		saveDraft,
		clearDraft,
	} = useFeedback();
	const { user } = useAuth();

	const [type, setType] = useState("bug");
	const [severity, setSeverity] = useState("medium");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [pageUrl, setPageUrl] = useState("");
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [images, setImages] = useState([]);
	const [uploadingImage, setUploadingImage] = useState(false);
	const [showUrlInput, setShowUrlInput] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

	// Initialize from draft or initialData when opened
	useEffect(() => {
		if (isOpen) {
			if (draft && (draft.title || draft.description || (draft.images && draft.images.length > 0))) {
				setType(draft.type || "bug");
				setSeverity(draft.severity || "medium");
				setTitle(draft.title || "");
				setDescription(draft.description || "");
				setPageUrl(draft.pageUrl || (typeof window !== "undefined" ? window.location.pathname : "/"));
				setGuestName(draft.guestName || "");
				setGuestEmail(draft.guestEmail || "");
				setImages(draft.images || []);
				setHasRestoredDraft(true);
			} else {
				setType(initialData?.type || "bug");
				setSeverity(initialData?.severity || "medium");
				setTitle("");
				setDescription("");
				setPageUrl(initialData?.pageUrl || (typeof window !== "undefined" ? window.location.pathname : "/"));
				setGuestName("");
				setGuestEmail("");
				setImages([]);
				setHasRestoredDraft(false);
			}
			setShowUrlInput(false);
			setUrlInput("");
			setErrorMessage("");
		}
	}, [isOpen, initialData]); // deliberate: only sync when open state triggers

	// Auto-persist draft to context/sessionStorage whenever relevant fields change
	useEffect(() => {
		if (!isOpen) return;
		const hasContent = Boolean(
			title.trim() ||
			description.trim() ||
			images.length > 0 ||
			guestName.trim() ||
			guestEmail.trim()
		);

		if (hasContent) {
			saveDraft({
				type,
				severity,
				title,
				description,
				pageUrl,
				guestName,
				guestEmail,
				images,
			});
		}
	}, [isOpen, type, severity, title, description, pageUrl, guestName, guestEmail, images, saveDraft]);

	const handleFileUpload = useCallback(async (files) => {
		if (!files || files.length === 0) return;

		setImages((currentImages) => {
			const remainingSlots = 4 - currentImages.length;
			if (remainingSlots <= 0) {
				setErrorMessage("You can attach a maximum of 4 pictures.");
				return currentImages;
			}
			return currentImages;
		});

		const remainingSlots = 4 - images.length;
		if (remainingSlots <= 0) {
			setErrorMessage("You can attach a maximum of 4 pictures.");
			return;
		}

		const filesToUpload = Array.from(files).slice(0, remainingSlots);
		setUploadingImage(true);
		setErrorMessage("");

		for (const file of filesToUpload) {
			if (!file.type.startsWith("image/")) {
				setErrorMessage("Only image files (PNG, JPG, WEBP, GIF) are allowed.");
				continue;
			}
			if (file.size > 5 * 1024 * 1024) {
				setErrorMessage(`Image "${file.name}" exceeds the 5MB size limit.`);
				continue;
			}

			try {
				const formData = new FormData();
				formData.append("image", file);

				const res = await apiFetch("/api/feedback/upload", {
					method: "POST",
					body: formData,
				});

				if (res.ok) {
					const data = await res.json();
					if (data.imageUrl) {
						setImages((prev) => [...prev, data.imageUrl].slice(0, 4));
						continue;
					}
				}

				// Fallback to local Data URL
				const reader = new FileReader();
				reader.onload = (e) => {
					if (e.target.result) {
						setImages((prev) => [...prev, e.target.result].slice(0, 4));
					}
				};
				reader.readAsDataURL(file);
			} catch (err) {
				console.warn("Upload error, using local data URL fallback", err);
				const reader = new FileReader();
				reader.onload = (e) => {
					if (e.target.result) {
						setImages((prev) => [...prev, e.target.result].slice(0, 4));
					}
				};
				reader.readAsDataURL(file);
			}
		}
		setUploadingImage(false);
	}, [images.length]);

	// Global clipboard paste listener: active whenever modal is open or minimized
	useEffect(() => {
		if (!isOpen) return;

		const handleGlobalPaste = (e) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const imageFiles = [];
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					const file = items[i].getAsFile();
					if (file) imageFiles.push(file);
				}
			}

			if (imageFiles.length > 0) {
				e.preventDefault();
				handleFileUpload(imageFiles);
				toast.success(
					isMinimized
						? "Screenshot attached to minimized draft!"
						: "Pasted screenshot attached!"
				);
			}
		};

		window.addEventListener("paste", handleGlobalPaste);
		return () => window.removeEventListener("paste", handleGlobalPaste);
	}, [isOpen, isMinimized, handleFileUpload]);

	const handleAddImageUrl = () => {
		if (!urlInput.trim()) return;
		if (images.length >= 4) {
			setErrorMessage("You can attach a maximum of 4 pictures.");
			return;
		}
		setImages((prev) => [...prev, urlInput.trim()].slice(0, 4));
		setUrlInput("");
		setShowUrlInput(false);
	};

	const handleRemoveImage = (indexToRemove) => {
		setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
	};

	const handleClearDraft = () => {
		clearDraft();
		setTitle("");
		setDescription("");
		setImages([]);
		setHasRestoredDraft(false);
		toast.success("Draft cleared.");
	};

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
				images,
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
			clearDraft();
			closeFeedbackModal();
		} catch (err) {
			setErrorMessage(err.message || "Could not submit report. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	if (!isOpen) return null;

	const activeCat = CATEGORIES.find((c) => c.id === type) || CATEGORIES[0];
	const ActiveCatIcon = activeCat.icon;

	// Minimized Floating Pill Mode
	if (isMinimized) {
		return (
			<Paper
				elevation={8}
				onClick={maximizeFeedbackModal}
				role="button"
				aria-label="Expand bug report draft"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						maximizeFeedbackModal();
					}
				}}
				sx={{
					position: "fixed",
					bottom: { xs: 80, sm: 96 },
					right: { xs: 16, sm: 28 },
					zIndex: 1350,
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					gap: 1.5,
					py: 1,
					px: 2,
					borderRadius: 9999,
					bgcolor: "background.paper",
					border: "2px solid",
					borderColor: activeCat.color,
					boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
					transition: "transform 0.2s ease, box-shadow 0.2s ease",
					"&:hover": {
						transform: "translateY(-3px)",
						boxShadow: "0 12px 28px rgba(0,0,0,0.3)",
					},
					"&:focus-visible": {
						outline: "3px solid #FFCC33",
						outlineOffset: "2px",
					},
				}}
			>
				<ActiveCatIcon style={{ color: activeCat.color, fontSize: 20 }} />
				<Box sx={{ maxWidth: { xs: 160, sm: 240 }, overflow: "hidden" }}>
					<Typography
						variant="body2"
						sx={{
							fontWeight: 700,
							fontSize: "0.85rem",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{title.trim() ? title.trim() : `${activeCat.label} (Draft)`}
					</Typography>
					<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
						{images.length > 0
							? `📷 ${images.length} pic${images.length > 1 ? "s" : ""} • Click to resume`
							: "Click to resume draft"}
					</Typography>
				</Box>
				<Tooltip title="Expand form" arrow>
					<IconButton
						size="small"
						aria-label="Expand form"
						onClick={(e) => {
							e.stopPropagation();
							maximizeFeedbackModal();
						}}
						sx={{ p: 0.5, color: "text.secondary" }}
					>
						<OpenInFullIcon sx={{ fontSize: 16 }} />
					</IconButton>
				</Tooltip>
				<Tooltip title="Close draft" arrow>
					<IconButton
						size="small"
						aria-label="Close draft"
						onClick={(e) => {
							e.stopPropagation();
							closeFeedbackModal();
						}}
						sx={{ p: 0.5, color: "text.secondary", "&:hover": { color: "error.main" } }}
					>
						<CloseIcon sx={{ fontSize: 16 }} />
					</IconButton>
				</Tooltip>
			</Paper>
		);
	}

	// Expanded Docked Card / Dialog Mode (Non-blocking backdrop)
	return (
		<Dialog
			open={isOpen}
			onClose={closeFeedbackModal}
			hideBackdrop={true}
			disableScrollLock={true}
			disableEnforceFocus={true}
			maxWidth="sm"
			fullWidth
			aria-labelledby="feedback-dialog-title"
			slotProps={{
				paper: {
					sx: {
						position: "fixed",
						bottom: { xs: 8, sm: 24 },
						right: { xs: 8, sm: 24 },
						m: 0,
						width: { xs: "calc(100vw - 16px)", sm: 540 },
						maxHeight: { xs: "90vh", sm: "82vh" },
						boxShadow: "0 24px 48px rgba(0, 0, 0, 0.28)",
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 3,
						p: { xs: 1, sm: 2 },
						bgcolor: "background.paper",
						backgroundImage: "none",
						zIndex: 1400,
						overflowY: "auto",
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
					<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<Typography variant="h6" fontWeight="bold" color="text.primary">
							Feedback & Issue Reporting
						</Typography>
						{hasRestoredDraft && (
							<Chip
								size="small"
								label="Draft Restored"
								color="warning"
								variant="outlined"
								sx={{ height: 20, fontSize: "0.7rem", fontWeight: "bold" }}
							/>
						)}
					</Box>
					<Typography variant="body2" color="text.secondary">
						Help us improve the GMU Badminton platform. We review every submission!
					</Typography>
				</Box>
				<Stack direction="row" spacing={0.5}>
					<Tooltip title="Minimize to floating pill (lets you inspect screen & take screenshots)" arrow>
						<IconButton
							onClick={minimizeFeedbackModal}
							size="small"
							aria-label="Minimize report form"
							sx={{ color: "text.secondary" }}
						>
							<RemoveIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title="Close dialog" arrow>
						<IconButton
							onClick={closeFeedbackModal}
							size="small"
							aria-label="Close feedback dialog"
							sx={{ color: "text.secondary" }}
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			</DialogTitle>

			<DialogContent dividers sx={{ pt: 2, pb: 2 }}>
				{/* Non-blocking UX Tip */}
				<Box
					sx={{
						mb: 2,
						p: 1.25,
						bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 102, 51, 0.06)"),
						border: "1px solid",
						borderColor: "divider",
						borderRadius: 2,
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 1,
					}}
				>
					<Typography variant="caption" color="text.secondary">
						💡 <strong>Non-blocking helper:</strong> Click <strong>Minimize (—)</strong> to navigate or inspect errors. Press <strong>Ctrl+V</strong> anywhere to attach screenshots!
					</Typography>
					{(title || description || images.length > 0) && (
						<Button
							size="small"
							color="inherit"
							onClick={handleClearDraft}
							sx={{ fontSize: "0.7rem", textTransform: "none", py: 0, px: 0.8, minWidth: "auto" }}
						>
							Clear draft
						</Button>
					)}
				</Box>

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

				{/* Attach Pictures / Screenshots */}
				<Box sx={{ mb: 2.5 }}>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
						<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase" }}>
							📷 Pictures & Screenshots ({images.length}/4)
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Tip: Paste screenshot with Ctrl+V
						</Typography>
					</Box>

					<Stack direction="row" spacing={1} alignItems="center">
						<input
							type="file"
							accept="image/*"
							multiple
							id="feedback-image-upload"
							style={{ display: "none" }}
							onChange={(e) => {
								handleFileUpload(e.target.files);
								e.target.value = "";
							}}
						/>
						<label htmlFor="feedback-image-upload">
							<Button
								variant="outlined"
								component="span"
								size="small"
								disabled={uploadingImage || images.length >= 4}
								startIcon={uploadingImage ? <CircularProgress size={16} /> : <AddPhotoAlternateIcon />}
								sx={{ textTransform: "none", fontWeight: "bold" }}
							>
								{uploadingImage ? "Uploading..." : "Upload Picture"}
							</Button>
						</label>

						<Button
							variant="text"
							size="small"
							onClick={() => setShowUrlInput(!showUrlInput)}
							disabled={images.length >= 4}
							startIcon={<LinkIcon />}
							sx={{ textTransform: "none", fontWeight: "bold" }}
						>
							Add via URL
						</Button>
					</Stack>

					{showUrlInput && (
						<Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
							<TextField
								size="small"
								fullWidth
								placeholder="https://example.com/screenshot.png"
								value={urlInput}
								onChange={(e) => setUrlInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddImageUrl();
									}
								}}
							/>
							<Button variant="contained" size="small" onClick={handleAddImageUrl} sx={{ textTransform: "none" }}>
								Add
							</Button>
						</Box>
					)}

					{images.length > 0 && (
						<Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
							{images.map((imgUrl, idx) => (
								<Box
									key={idx}
									sx={{
										position: "relative",
										width: 76,
										height: 76,
										borderRadius: 2,
										overflow: "hidden",
										border: "2px solid",
										borderColor: "divider",
										bgcolor: "background.default",
									}}
								>
									<Box
										component="img"
										src={imgUrl}
										alt={`Attachment ${idx + 1}`}
										sx={{ width: "100%", height: "100%", objectFit: "cover" }}
									/>
									<IconButton
										size="small"
										onClick={() => handleRemoveImage(idx)}
										aria-label={`Remove picture ${idx + 1}`}
										sx={{
											position: "absolute",
											top: 2,
											right: 2,
											bgcolor: "rgba(0,0,0,0.65)",
											color: "#ffffff",
											p: 0.3,
											"&:hover": { bgcolor: "rgba(229, 62, 62, 0.9)" },
										}}
									>
										<CloseIcon sx={{ fontSize: 14 }} />
									</IconButton>
								</Box>
							))}
						</Stack>
					)}
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
