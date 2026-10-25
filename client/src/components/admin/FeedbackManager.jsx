// client/src/components/admin/FeedbackManager.jsx
import { useState, useEffect, useCallback } from "react";
import {
	Paper,
	Typography,
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Button,
	Chip,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Stack,
	IconButton,
	CircularProgress,
	Alert,
	Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BugReportIcon from "@mui/icons-material/BugReport";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FeedbackIcon from "@mui/icons-material/Feedback";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import toast from "react-hot-toast";
import apiFetch from "../../utils/api";
import socket from "../../utils/socket";

const TYPE_CONFIG = {
	bug: { label: "Bug", color: "error", icon: BugReportIcon },
	feature: { label: "Feature", color: "warning", icon: LightbulbIcon },
	feedback: { label: "Feedback", color: "info", icon: FeedbackIcon },
};

const SEVERITY_COLORS = {
	low: "#38a169",
	medium: "#3182ce",
	high: "#dd6b20",
	critical: "#e53e3e",
};

const STATUS_CONFIG = {
	pending: { label: "Pending", color: "warning" },
	in_progress: { label: "In Progress", color: "info" },
	resolved: { label: "Resolved", color: "success" },
	dismissed: { label: "Dismissed", color: "default" },
};

export default function FeedbackManager({ promptDelete }) {
	const [feedbackList, setFeedbackList] = useState([]);
	const [counts, setCounts] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, dismissed: 0 });
	const [loading, setLoading] = useState(false);
	const [statusFilter, setStatusFilter] = useState("all");
	const [typeFilter, setTypeFilter] = useState("all");

	// Detail Modal
	const [selectedReport, setSelectedReport] = useState(null);
	const [adminNotes, setAdminNotes] = useState("");
	const [savingNotes, setSavingNotes] = useState(false);

	const fetchFeedback = useCallback(async () => {
		setLoading(true);
		try {
			let url = `/api/feedback/admin?status=${statusFilter}&type=${typeFilter}`;
			const res = await apiFetch(url);
			if (res.ok) {
				const data = await res.json();
				setFeedbackList(data.feedback || []);
				if (data.counts) {
					setCounts(data.counts);
				}
			}
		} catch (err) {
			console.error("Failed to load feedback reports", err);
			toast.error("Failed to load feedback reports.");
		} finally {
			setLoading(false);
		}
	}, [statusFilter, typeFilter]);

	useEffect(() => {
		fetchFeedback();
	}, [fetchFeedback]);

	// Real-time socket updates
	useEffect(() => {
		const handleCreated = (item) => {
			setFeedbackList((prev) => [item, ...prev]);
			setCounts((prev) => ({
				...prev,
				total: prev.total + 1,
				pending: prev.pending + 1,
			}));
			toast("🔔 New user feedback/bug reported!", { icon: "💬" });
		};

		const handleUpdated = (item) => {
			setFeedbackList((prev) =>
				prev.map((f) => (f._id === item._id ? item : f))
			);
			if (selectedReport && selectedReport._id === item._id) {
				setSelectedReport(item);
			}
		};

		const handleDeleted = (deletedId) => {
			setFeedbackList((prev) => prev.filter((f) => f._id !== deletedId));
			if (selectedReport && selectedReport._id === deletedId) {
				setSelectedReport(null);
			}
		};

		socket.on("feedbackCreated", handleCreated);
		socket.on("feedbackUpdated", handleUpdated);
		socket.on("feedbackDeleted", handleDeleted);

		return () => {
			socket.off("feedbackCreated", handleCreated);
			socket.off("feedbackUpdated", handleUpdated);
			socket.off("feedbackDeleted", handleDeleted);
		};
	}, [selectedReport]);

	const handleStatusChange = async (id, newStatus) => {
		try {
			const res = await apiFetch(`/api/feedback/admin/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
			});
			if (!res.ok) throw new Error("Failed to update status");

			const data = await res.json();
			setFeedbackList((prev) =>
				prev.map((f) => (f._id === id ? { ...f, status: newStatus } : f))
			);
			if (selectedReport && selectedReport._id === id) {
				setSelectedReport({ ...selectedReport, status: newStatus });
			}
			toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
			fetchFeedback();
		} catch (err) {
			toast.error(err.message || "Could not update status.");
		}
	};

	const handleSaveNotes = async () => {
		if (!selectedReport) return;
		setSavingNotes(true);
		try {
			const res = await apiFetch(`/api/feedback/admin/${selectedReport._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ adminNotes }),
			});
			if (!res.ok) throw new Error("Failed to save admin notes");

			const data = await res.json();
			setSelectedReport(data.feedback);
			setFeedbackList((prev) =>
				prev.map((f) => (f._id === selectedReport._id ? data.feedback : f))
			);
			toast.success("Admin notes saved.");
		} catch (err) {
			toast.error(err.message || "Failed to save notes.");
		} finally {
			setSavingNotes(false);
		}
	};

	const openDetails = (report) => {
		setSelectedReport(report);
		setAdminNotes(report.adminNotes || "");
	};

	return (
		<Paper
			elevation={0}
			sx={{
				p: { xs: 2, sm: 3 },
				mb: 6,
				borderRadius: 3,
				border: "1px solid",
				borderColor: "divider",
				bgcolor: "background.paper",
			}}
		>
			{/* Header & KPI Summary */}
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					flexWrap: "wrap",
					gap: 2,
					mb: 3,
				}}
			>
				<Box>
					<Typography variant="h5" fontWeight="900" color="text.primary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						💬 User Feedback & Error Reports
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Review suggestions, bug reports, and UX feedback submitted by players and visitors.
					</Typography>
				</Box>

				<Stack direction="row" spacing={1} alignItems="center">
					<Chip
						label={`Pending: ${counts.pending}`}
						color="warning"
						variant={statusFilter === "pending" ? "filled" : "outlined"}
						onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
						sx={{ fontWeight: "bold" }}
					/>
					<Chip
						label={`In Progress: ${counts.inProgress}`}
						color="info"
						variant={statusFilter === "in_progress" ? "filled" : "outlined"}
						onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
						sx={{ fontWeight: "bold" }}
					/>
					<Chip
						label={`Resolved: ${counts.resolved}`}
						color="success"
						variant={statusFilter === "resolved" ? "filled" : "outlined"}
						onClick={() => setStatusFilter(statusFilter === "resolved" ? "all" : "resolved")}
						sx={{ fontWeight: "bold" }}
					/>
					<Tooltip title="Refresh submissions">
						<IconButton onClick={fetchFeedback} size="small" disabled={loading}>
							<RefreshIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			</Box>

			{/* Filters */}
			<Box
				sx={{
					display: "flex",
					gap: 2,
					flexWrap: "wrap",
					alignItems: "center",
					mb: 3,
					p: 1.5,
					borderRadius: 2,
					bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
				}}
			>
				<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
					<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase" }}>
						Type:
					</Typography>
					{["all", "bug", "feature", "feedback"].map((t) => (
						<Chip
							key={t}
							label={t === "all" ? "All Types" : TYPE_CONFIG[t]?.label || t}
							size="small"
							clickable
							onClick={() => setTypeFilter(t)}
							color={typeFilter === t ? "primary" : "default"}
							variant={typeFilter === t ? "filled" : "outlined"}
							sx={{ fontWeight: typeFilter === t ? 700 : 500 }}
						/>
					))}
				</Box>

				<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", ml: { sm: "auto" } }}>
					<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase" }}>
						Status:
					</Typography>
					{["all", "pending", "in_progress", "resolved", "dismissed"].map((s) => (
						<Chip
							key={s}
							label={s === "all" ? "All Status" : STATUS_CONFIG[s]?.label || s}
							size="small"
							clickable
							onClick={() => setStatusFilter(s)}
							color={statusFilter === s ? "primary" : "default"}
							variant={statusFilter === s ? "filled" : "outlined"}
							sx={{ fontWeight: statusFilter === s ? 700 : 500 }}
						/>
					))}
				</Box>
			</Box>

			{/* Submissions Table */}
			{loading && feedbackList.length === 0 ? (
				<Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
					<CircularProgress size={32} />
				</Box>
			) : feedbackList.length === 0 ? (
				<Box sx={{ textAlign: "center", py: 6 }}>
					<Typography variant="body1" color="text.secondary">
						No feedback or bug reports found matching the selected filters.
					</Typography>
				</Box>
			) : (
				<TableContainer sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
					<Table size="small">
						<TableHead sx={{ bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)") }}>
							<TableRow>
								<TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
								<TableCell sx={{ fontWeight: "bold" }}>Title</TableCell>
								<TableCell sx={{ fontWeight: "bold" }}>Reporter</TableCell>
								<TableCell sx={{ fontWeight: "bold" }}>Page Location</TableCell>
								<TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
								<TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
								<TableCell align="right" sx={{ fontWeight: "bold" }}>Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{feedbackList.map((item) => {
								const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.bug;
								const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
								const sevColor = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.medium;

								return (
									<TableRow key={item._id} hover>
										<TableCell>
											<Stack direction="row" spacing={0.5} alignItems="center">
												<Chip
													size="small"
													label={typeCfg.label}
													color={typeCfg.color}
													variant="filled"
													sx={{ fontWeight: "bold", fontSize: "0.75rem" }}
												/>
												{item.type === "bug" && (
													<Chip
														size="small"
														label={item.severity}
														sx={{
															bgcolor: sevColor,
															color: "#ffffff",
															fontWeight: "bold",
															fontSize: "0.7rem",
															height: 20,
														}}
													/>
												)}
											</Stack>
										</TableCell>
										<TableCell sx={{ maxWidth: 260 }}>
											<Typography variant="body2" fontWeight="bold" noWrap color="text.primary">
												{item.title}
											</Typography>
											<Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
												{item.description}
											</Typography>
										</TableCell>
										<TableCell>
											<Typography variant="body2" color="text.primary">
												{item.userName || "Anonymous"}
											</Typography>
											{item.userEmail && (
												<Typography variant="caption" color="text.secondary" display="block">
													{item.userEmail}
												</Typography>
											)}
										</TableCell>
										<TableCell>
											<Typography variant="caption" sx={{ fontFamily: "monospace", bgcolor: "action.hover", px: 0.8, py: 0.3, borderRadius: 1 }}>
												{item.pageUrl || "/"}
											</Typography>
										</TableCell>
										<TableCell>
											<FormControl size="small" variant="standard">
												<Select
													value={item.status}
													onChange={(e) => handleStatusChange(item._id, e.target.value)}
													disableUnderline
													sx={{
														fontSize: "0.8rem",
														fontWeight: "bold",
														color: `${statusCfg.color}.main`,
													}}
												>
													<MenuItem value="pending">Pending</MenuItem>
													<MenuItem value="in_progress">In Progress</MenuItem>
													<MenuItem value="resolved">Resolved</MenuItem>
													<MenuItem value="dismissed">Dismissed</MenuItem>
												</Select>
											</FormControl>
										</TableCell>
										<TableCell>
											<Typography variant="caption" color="text.secondary">
												{new Date(item.createdAt).toLocaleDateString()}
											</Typography>
										</TableCell>
										<TableCell align="right">
											<Stack direction="row" spacing={1} justifyContent="flex-end">
												<Tooltip title="View full details & notes">
													<IconButton size="small" color="primary" onClick={() => openDetails(item)} aria-label="View report details">
														<VisibilityIcon fontSize="small" />
													</IconButton>
												</Tooltip>
												<Tooltip title="Delete report">
													<IconButton
														size="small"
														color="error"
														onClick={() => (promptDelete ? promptDelete("feedback", item._id) : handleStatusChange(item._id, "dismissed"))}
														aria-label="Delete report"
													>
														<DeleteIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											</Stack>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{/* Detailed Inspection Dialog */}
			<Dialog
				open={Boolean(selectedReport)}
				onClose={() => setSelectedReport(null)}
				maxWidth="sm"
				fullWidth
				slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
			>
				{selectedReport && (
					<>
						<DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pb: 1 }}>
							<Box>
								<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
									<Chip
										size="small"
										label={TYPE_CONFIG[selectedReport.type]?.label || selectedReport.type}
										color={TYPE_CONFIG[selectedReport.type]?.color || "default"}
										sx={{ fontWeight: "bold" }}
									/>
									{selectedReport.type === "bug" && (
										<Chip
											size="small"
											label={`Severity: ${selectedReport.severity}`}
											sx={{
												bgcolor: SEVERITY_COLORS[selectedReport.severity] || SEVERITY_COLORS.medium,
												color: "#ffffff",
												fontWeight: "bold",
											}}
										/>
									)}
									<Chip
										size="small"
										label={STATUS_CONFIG[selectedReport.status]?.label || selectedReport.status}
										color={STATUS_CONFIG[selectedReport.status]?.color || "default"}
										variant="outlined"
										sx={{ fontWeight: "bold" }}
									/>
								</Stack>
								<Typography variant="h6" fontWeight="bold" color="text.primary">
									{selectedReport.title}
								</Typography>
							</Box>
							<IconButton size="small" onClick={() => setSelectedReport(null)} aria-label="Close details">
								<CloseIcon fontSize="small" />
							</IconButton>
						</DialogTitle>

						<DialogContent dividers sx={{ py: 2 }}>
							{/* Description */}
							<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase" }}>
								Detailed Report
							</Typography>
							<Paper
								elevation={0}
								sx={{
									p: 2,
									my: 1,
									borderRadius: 2,
									bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"),
									border: "1px solid",
									borderColor: "divider",
								}}
							>
								<Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.primary" }}>
									{selectedReport.description}
								</Typography>
							</Paper>

							{/* Metadata */}
							<Stack spacing={1} sx={{ mt: 2, mb: 3 }}>
								<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
									<Typography variant="body2" color="text.secondary">
										Reporter:
									</Typography>
									<Typography variant="body2" fontWeight="bold" color="text.primary">
										{selectedReport.userName} {selectedReport.userEmail ? `(${selectedReport.userEmail})` : "(Guest)"}
									</Typography>
								</Box>
								<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
									<Typography variant="body2" color="text.secondary">
										Page Location:
									</Typography>
									<Typography variant="body2" sx={{ fontFamily: "monospace" }} color="text.primary">
										{selectedReport.pageUrl || "/"}
									</Typography>
								</Box>
								<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
									<Typography variant="body2" color="text.secondary">
										Submitted:
									</Typography>
									<Typography variant="body2" color="text.primary">
										{new Date(selectedReport.createdAt).toLocaleString()}
									</Typography>
								</Box>
							</Stack>

							{/* Admin Internal Notes */}
							<Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 1 }}>
								Admin Internal Notes
							</Typography>
							<TextField
								fullWidth
								multiline
								rows={3}
								size="small"
								placeholder="Add internal debugging notes, Jira links, or resolution status here..."
								value={adminNotes}
								onChange={(e) => setAdminNotes(e.target.value)}
								slotProps={{ htmlInput: { maxLength: 1000 } }}
								helperText={`${adminNotes.length}/1000 characters`}
							/>
							<Button
								size="small"
								variant="outlined"
								onClick={handleSaveNotes}
								disabled={savingNotes}
								sx={{ mt: 1, textTransform: "none", fontWeight: "bold" }}
							>
								{savingNotes ? "Saving..." : "Save Admin Notes"}
							</Button>
						</DialogContent>

						<DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
							<FormControl size="small" sx={{ minWidth: 150 }}>
								<InputLabel id="dialog-status-label">Update Status</InputLabel>
								<Select
									labelId="dialog-status-label"
									label="Update Status"
									value={selectedReport.status}
									onChange={(e) => handleStatusChange(selectedReport._id, e.target.value)}
								>
									<MenuItem value="pending">Pending</MenuItem>
									<MenuItem value="in_progress">In Progress</MenuItem>
									<MenuItem value="resolved">Resolved</MenuItem>
									<MenuItem value="dismissed">Dismissed</MenuItem>
								</Select>
							</FormControl>

							<Button onClick={() => setSelectedReport(null)} color="primary" variant="contained" sx={{ fontWeight: "bold" }}>
								Done
							</Button>
						</DialogActions>
					</>
				)}
			</Dialog>
		</Paper>
	);
}
