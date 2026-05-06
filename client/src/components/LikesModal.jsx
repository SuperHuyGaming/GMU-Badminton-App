import {
	Dialog,
	DialogTitle,
	DialogContent,
	List,
	ListItemButton,
	Avatar,
	Typography,
	IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function LikesModal({ open, title, list, onClose }) {
	const navigate = useNavigate();

	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
			<DialogTitle
				sx={{
					fontWeight: "bold",
					borderBottom: "1px solid #eee",
					textAlign: "center",
					py: 2,
					position: "relative",
				}}
			>
				{title}
				<IconButton
					onClick={onClose}
					sx={{
						position: "absolute",
						right: 8,
						top: 8,
						transition: "all 0.2s",
						"&:active": { transform: "scale(0.9)" },
					}}
				>
					✕
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ p: 0, maxHeight: 400 }}>
				<List disablePadding>
					{list.map((u) => (
						<ListItemButton
							key={u.id}
							onClick={() => {
								onClose();
								navigate(`/profile/${u.id}`);
							}}
							sx={{ py: 1.5, borderBottom: "1px solid #f5f5f5" }}
						>
							<Avatar
								src={u.profilePic}
								sx={{
									width: 40,
									height: 40,
									mr: 2,
									bgcolor: "secondary.main",
									color: "primary.main",
								}}
							>
								{!u.profilePic &&
									u.name.charAt(0).toUpperCase()}
							</Avatar>
							<Typography fontWeight="bold">{u.name}</Typography>
						</ListItemButton>
					))}
					{list.length === 0 && (
						<Typography
							sx={{
								p: 4,
								textAlign: "center",
								color: "text.secondary",
							}}
						>
							No likes yet.
						</Typography>
					)}
				</List>
			</DialogContent>
		</Dialog>
	);
}
