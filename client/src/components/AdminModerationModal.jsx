import { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	Typography,
	IconButton,
	Box,
	Paper,
	Chip,
	Button,
	CircularProgress,
	Avatar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import ShieldIcon from "@mui/icons-material/Shield";
import apiFetch from "../utils/api";
import { toast } from "react-hot-toast";

export default function AdminModerationModal({ open, onClose, onPostResolved }) {
	const [reports, setReports] = useState([]);
	const [loading, setLoading] = useState(false);
	const [resolvingId, setResolvingId] = useState(null);

	const fetchReports = async () => {
		setLoading(true);
		try {
			const res = await apiFetch("/api/forum/reports");
			if (res && res.ok) {
				const data = await res.json();
				setReports(Array.isArray(data) ? data : []);
			}
		} catch (err) {
			console.error("Failed to load moderation reports:", err);
			toast.error("Failed to load moderation reports");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (open) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			fetchReports();
		}
	}, [open]);

	const handleResolve = async (postId, action) => {
		setResolvingId(postId);
		try {
			const res = await apiFetch(`/api/forum/reports/${postId}/resolve`, {
				method: "PUT",
				body: JSON.stringify({ action }),
			});
			const data = await res.json();
			if (res && res.ok) {
				toast.success(data.message || `Post resolved (${action})`);
				setReports((prev) => prev.filter((p) => String(p._id) !== String(postId)));
				if (onPostResolved) onPostResolved(postId, action);
			} else {
				toast.error(data.message || "Failed to resolve post");
			}
		} catch (err) {
			console.error("Resolution error:", err);
			toast.error("Network error resolving post");
		} finally {
			setResolvingId(null);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						borderRadius: 3.5,
						p: 1,
						backgroundImage: "none",
					},
				},
			}}
		>
			<DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
					<ShieldIcon color="error" sx={{ fontSize: 28 }} />
					<Box>
						<Typography variant="h6" fontWeight="bold">
							Community Moderation Queue
						</Typography>
						<Typography variant="caption" color="text.secondary">
							Review flagged content and community violation reports
						</Typography>
					</Box>
				</Box>
				<IconButton onClick={onClose} size="small" aria-label="Close moderation modal">
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers sx={{ minHeight: 300, py: 2 }}>
				{loading ? (
					<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 250 }}>
						<CircularProgress color="error" />
					</Box>
				) : reports.length === 0 ? (
					<Box sx={{ textAlign: "center", py: 8 }}>
						<Typography variant="h4" sx={{ mb: 1.5 }}>
							🛡️
						</Typography>
						<Typography variant="h6" fontWeight="bold" color="text.primary">
							Community is Safe & Clean!
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: "auto" }}>
							There are currently no flagged posts or community violation reports requiring administrative review.
						</Typography>
					</Box>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						{reports.map((post) => (
							<Paper
								key={post._id}
								variant="outlined"
								sx={{
									p: 2.5,
									borderRadius: 2.5,
									borderColor: post.status === "quarantined" ? "error.main" : "divider",
									backgroundColor: (theme) =>
										theme.palette.mode === "dark"
											? post.status === "quarantined"
												? "rgba(239, 83, 80, 0.08)"
												: "background.paper"
											: post.status === "quarantined"
											? "#fff5f5"
											: "background.paper",
								}}
							>
								{/* Card Header: Author info & status chip */}
								<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
										<Avatar src={post.authorPic || ""} alt={post.authorName || "Author"} sx={{ width: 40, height: 40 }}>
											{(post.authorName || "U")[0]}
										</Avatar>
										<Box>
											<Typography variant="subtitle2" fontWeight="bold">
												{post.authorName || "Unknown Author"}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Category: {post.category || "General"}
											</Typography>
										</Box>
									</Box>
									<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
										{post.reports?.length > 0 && (
											<Chip
												label={`${post.reports.length} report${post.reports.length > 1 ? "s" : ""}`}
												color="error"
												size="small"
												sx={{ fontWeight: "bold" }}
											/>
										)}
										<Chip
											label={post.status === "quarantined" ? "Quarantined" : post.isFlagged ? "Flagged" : "Active"}
											color={post.status === "quarantined" ? "error" : "warning"}
											variant="outlined"
											size="small"
											sx={{ fontWeight: "bold" }}
										/>
									</Box>
								</Box>

								{/* Post Content preview */}
								<Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
									{post.title}
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-line" }}>
									{post.content?.length > 250 ? `${post.content.slice(0, 250)}...` : post.content}
								</Typography>

								{/* Reports summary */}
								{post.reports?.length > 0 && (
									<Box sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: "action.hover" }}>
										<Typography variant="caption" fontWeight="bold" color="text.primary" sx={{ display: "block", mb: 0.5 }}>
											Report Reasons:
										</Typography>
										<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
											{post.reports.map((r, idx) => (
												<Chip
													key={idx}
													label={`${r.reportedBy?.name || "Player"}: "${r.reason || "Spam/Inappropriate"}"`}
													size="small"
													sx={{ fontSize: "0.75rem" }}
												/>
											))}
										</Box>
									</Box>
								)}

								{/* Action buttons */}
								<Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
									<Button
										size="small"
										variant="contained"
										color="success"
										startIcon={<CheckCircleIcon />}
										disabled={resolvingId === post._id}
										onClick={() => handleResolve(post._id, "approve")}
										sx={{ textTransform: "none", fontWeight: "bold", borderRadius: 2 }}
									>
										Approve & Clear
									</Button>
									{post.status !== "quarantined" && (
										<Button
											size="small"
											variant="outlined"
											color="warning"
											startIcon={<BlockIcon />}
											disabled={resolvingId === post._id}
											onClick={() => handleResolve(post._id, "quarantine")}
											sx={{ textTransform: "none", fontWeight: "bold", borderRadius: 2 }}
										>
											Quarantine
										</Button>
									)}
									<Button
										size="small"
										variant="outlined"
										color="error"
										startIcon={<DeleteIcon />}
										disabled={resolvingId === post._id}
										onClick={() => handleResolve(post._id, "delete")}
										sx={{ textTransform: "none", fontWeight: "bold", borderRadius: 2 }}
									>
										Delete
									</Button>
								</Box>
							</Paper>
						))}
					</Box>
				)}
			</DialogContent>
		</Dialog>
	);
}
