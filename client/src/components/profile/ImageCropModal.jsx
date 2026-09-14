import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Slider,
	Box,
	Typography,
} from "@mui/material";
import getCroppedImg from "../../utils/cropImage";

export default function ImageCropModal({
	open,
	imageSrc,
	onClose,
	onCropComplete,
	aspectRatio = 1,
}) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

	const onCropChange = (location) => {
		setCrop(location);
	};

	const onZoomChange = (zoom) => {
		setZoom(zoom);
	};

	const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
		setCroppedAreaPixels(croppedAreaPixels);
	}, []);

	const handleSave = async () => {
		try {
			const croppedImageBlob = await getCroppedImg(
				imageSrc,
				croppedAreaPixels
			);
			onCropComplete(croppedImageBlob);
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ fontWeight: "bold" }}>Crop Image</DialogTitle>
			<DialogContent dividers sx={{ height: 400, position: "relative" }}>
				<Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 80 }}>
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						aspect={aspectRatio}
						onCropChange={onCropChange}
						onCropComplete={handleCropComplete}
						onZoomChange={onZoomChange}
						showGrid={true}
					/>
				</Box>
				<Box sx={{ position: "absolute", bottom: 20, left: "10%", right: "10%", display: "flex", alignItems: "center", gap: 2 }}>
					<Typography variant="body2" fontWeight="bold">Zoom</Typography>
					<Slider
						value={zoom}
						min={1}
						max={3}
						step={0.1}
						aria-labelledby="Zoom"
						onChange={(e, zoom) => setZoom(zoom)}
					/>
				</Box>
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: "none" }}>
					Cancel
				</Button>
				<Button onClick={handleSave} variant="contained" color="primary" sx={{ borderRadius: 2, textTransform: "none", fontWeight: "bold" }}>
					Save Changes
				</Button>
			</DialogActions>
		</Dialog>
	);
}
