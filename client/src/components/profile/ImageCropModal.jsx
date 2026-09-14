import React, { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Box,
} from "@mui/material";
import getCroppedImg from "../../utils/cropImage";

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
	return centerCrop(
		makeAspectCrop(
			{
				unit: "%",
				width: 90,
			},
			aspect,
			mediaWidth,
			mediaHeight
		),
		mediaWidth,
		mediaHeight
	);
}

export default function ImageCropModal({
	open,
	imageSrc,
	onClose,
	onCropComplete,
	aspectRatio = 1,
}) {
	const [crop, setCrop] = useState();
	const [completedCrop, setCompletedCrop] = useState(null);
	const imgRef = useRef(null);

	const onImageLoad = (e) => {
		const { width, height } = e.currentTarget;
		setCrop(centerAspectCrop(width, height, aspectRatio));
	};

	const handleSave = async () => {
		if (!completedCrop || !imgRef.current) return;

		const image = imgRef.current;
		const scaleX = image.naturalWidth / image.width;
		const scaleY = image.naturalHeight / image.height;

		const pixelCrop = {
			x: completedCrop.x * scaleX,
			y: completedCrop.y * scaleY,
			width: completedCrop.width * scaleX,
			height: completedCrop.height * scaleY,
		};

		try {
			const croppedImageBlob = await getCroppedImg(imageSrc, pixelCrop);
			onCropComplete(croppedImageBlob);
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ fontWeight: "bold" }}>Crop Image</DialogTitle>
			<DialogContent dividers sx={{ display: "flex", justifyContent: "center", alignItems: "center", bgcolor: "#333", minHeight: 400 }}>
				{imageSrc && (
					<ReactCrop
						crop={crop}
						onChange={(_, percentCrop) => setCrop(percentCrop)}
						onComplete={(c) => setCompletedCrop(c)}
						aspect={aspectRatio}
						ruleOfThirds
					>
						<img
							ref={imgRef}
							src={imageSrc}
							onLoad={onImageLoad}
							style={{ maxHeight: "60vh", maxWidth: "100%", display: "block" }}
							alt="Crop"
						/>
					</ReactCrop>
				)}
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: "none" }}>
					Cancel
				</Button>
				<Button 
					onClick={handleSave} 
					variant="contained" 
					color="primary" 
					sx={{ borderRadius: 2, textTransform: "none", fontWeight: "bold" }}
					disabled={!completedCrop?.width || !completedCrop?.height}
				>
					Save Changes
				</Button>
			</DialogActions>
		</Dialog>
	);
}
