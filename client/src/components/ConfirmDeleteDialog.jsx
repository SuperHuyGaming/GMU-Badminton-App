// client/src/components/ConfirmDeleteDialog.jsx
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
} from "@mui/material";
import { TrashIcon } from "./Icons";

export default function ConfirmDeleteDialog({
	open,
	onClose,
	onConfirm,
	itemName = "item",
}) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
		>
			<DialogTitle
				sx={{
					fontWeight: "bold",
					display: "flex",
					alignItems: "center",
					gap: 1,
					color: "error.main",
				}}
			>
				<TrashIcon /> Confirm Deletion
			</DialogTitle>
			<DialogContent>
				<Typography>
					Are you sure you want to permanently delete this {itemName}?
					This action cannot be undone.
				</Typography>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button
					onClick={onClose}
					color="inherit"
					sx={{ fontWeight: "bold", textTransform: "none" }}
				>
					Cancel
				</Button>
				<Button
					onClick={onConfirm}
					variant="contained"
					color="error"
					sx={{
						fontWeight: "bold",
						textTransform: "none",
						borderRadius: 2,
					}}
				>
					Delete
				</Button>
			</DialogActions>
		</Dialog>
	);
}
