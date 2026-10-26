// client/src/components/FeedbackFAB.jsx
import { Fab, Tooltip, Box, Badge } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useFeedback } from "../context/FeedbackContext";

export default function FeedbackFAB() {
	const { isOpen, isMinimized, draft, openFeedbackModal, maximizeFeedbackModal } = useFeedback();

	// When modal is open and expanded, hide FAB so it doesn't overlap the form
	if (isOpen && !isMinimized) {
		return null;
	}

	const handleClick = () => {
		if (isOpen && isMinimized) {
			maximizeFeedbackModal();
		} else {
			openFeedbackModal({ type: "bug" });
		}
	};

	const hasDraft = Boolean(draft && (draft.title || draft.description || (draft.images && draft.images.length > 0)));

	return (
		<Box
			sx={{
				position: "fixed",
				bottom: { xs: 20, sm: 28 },
				right: { xs: 16, sm: 28 },
				zIndex: 1050,
			}}
		>
			<Tooltip title={hasDraft ? "Resume Bug Report Draft" : "Feedback & Bug Report"} placement="left" arrow>
				<Badge
					color="secondary"
					variant="dot"
					invisible={!hasDraft}
					sx={{
						"& .MuiBadge-badge": {
							backgroundColor: "#e53e3e",
							width: 12,
							height: 12,
							borderRadius: "50%",
							border: "2px solid #ffffff",
						},
					}}
				>
					<Fab
						color="primary"
						aria-label={hasDraft ? "Resume Bug Report Draft" : "Submit Feedback or Report Bug"}
						onClick={handleClick}
						sx={{
							width: { xs: 48, sm: 56 },
							height: { xs: 48, sm: 56 },
							backgroundColor: "#FFCC33",
							color: "#1a202c",
							boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)",
							"&:hover": {
								backgroundColor: "#e6b800",
								transform: "scale(1.08)",
							},
							"&:focus-visible": {
								outline: "3px solid #006633",
								outlineOffset: "2px",
							},
						}}
					>
						<BugReportIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
					</Fab>
				</Badge>
			</Tooltip>
		</Box>
	);
}
