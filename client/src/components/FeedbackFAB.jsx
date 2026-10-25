// client/src/components/FeedbackFAB.jsx
import { Fab, Tooltip, Box } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useFeedback } from "../context/FeedbackContext";

export default function FeedbackFAB() {
	const { openFeedbackModal } = useFeedback();

	return (
		<Box
			sx={{
				position: "fixed",
				bottom: { xs: 20, sm: 28 },
				right: { xs: 16, sm: 28 },
				zIndex: 1050,
			}}
		>
			<Tooltip title="Feedback & Bug Report" placement="left" arrow>
				<Fab
					color="primary"
					aria-label="Submit Feedback or Report Bug"
					onClick={() => openFeedbackModal({ type: "bug" })}
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
			</Tooltip>
		</Box>
	);
}
