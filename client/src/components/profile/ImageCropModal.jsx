// eslint-disable-next-line no-unused-vars
import React, { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	// eslint-disable-next-line no-unused-vars
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
	aspectRatio,
	title = "Crop Image"
}) {
	const [crop, setCrop] = useState();
	const [completedCrop, setCompletedCrop] = useState(null);
	const imgRef = useRef(null);

	const onImageLoad = (e) => {
		const { width, height } = e.currentTarget;
		if (aspectRatio) {
			setCrop(centerAspectCrop(width, height, aspectRatio));
		}
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
		<Dialog 
			open={open} 
			onClose={onClose} 
			maxWidth="md" 
			fullWidth
			PaperProps={{
				sx: {
					bgcolor: 'background.paper',
					borderRadius: 4,
					overflow: 'hidden'
				}
			}}
		>
			<DialogTitle sx={{ fontWeight: "900", textAlign: "center", py: 3 }}>
				{title}
			</DialogTitle>
			<DialogContent sx={{ 
				display: "flex", 
				justifyContent: "center", 
				alignItems: "center", 
				bgcolor: "background.default", 
				minHeight: 400,
				p: 0,
				position: "relative"
			}}>
				{imageSrc && (
					<ReactCrop
						crop={crop}
						onChange={(_, percentCrop) => setCrop(percentCrop)}
						onComplete={(c) => setCompletedCrop(c)}
						aspect={aspectRatio}
						ruleOfThirds
						style={{ maxWidth: '100%', maxHeight: '60vh' }}
					>
						<img
							ref={imgRef}
							src={imageSrc}
							onLoad={onImageLoad}
							style={{ maxHeight: "60vh", maxWidth: "100%", display: "block", objectFit: "contain" }}
							alt="Crop"
						/>
					</ReactCrop>
				)}
			</DialogContent>
			<DialogActions sx={{ p: 3, display: "flex", justifyContent: "space-between", bgcolor: "background.paper" }}>
				<Button 
					onClick={onClose} 
					sx={{ 
						borderRadius: 3, 
						textTransform: "none",
						fontWeight: "bold",
						color: "text.secondary",
						px: 3
					}}
				>
					Cancel
				</Button>
				<Button 
					onClick={handleSave} 
					variant="contained" 
					color="primary" 
					sx={{ 
						borderRadius: 3, 
						textTransform: "none", 
						fontWeight: "bold",
						px: 4,
						py: 1
					}}
					disabled={!completedCrop?.width || !completedCrop?.height}
				>
					Save Photo
				</Button>
			</DialogActions>
		</Dialog>
	);
}
