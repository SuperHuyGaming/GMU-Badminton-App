export const createImage = (url) =>
	new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", (error) => reject(error));
		image.setAttribute("crossOrigin", "anonymous");
		image.src = url;
	});

export function getRadianAngle(degreeValue) {
	return (degreeValue * Math.PI) / 180;
}

export default async function getCroppedImg(
	imageSrc,
	pixelCrop,
	rotation = 0,
	flip = { horizontal: false, vertical: false }
) {
	const image = await createImage(imageSrc);
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return null;
	}

	const rotRad = getRadianAngle(rotation);

	const bBoxWidth = Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height);
	const bBoxHeight = Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height);

	canvas.width = bBoxWidth;
	canvas.height = bBoxHeight;

	ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
	ctx.rotate(rotRad);
	ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
	ctx.translate(-image.width / 2, -image.height / 2);

	ctx.drawImage(image, 0, 0);

	const data = ctx.getImageData(
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height
	);

	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;

	ctx.putImageData(data, 0, 0);

	return new Promise((resolve, reject) => {
		canvas.toBlob((file) => {
			if (file) {
				file.name = "cropped.jpeg";
				resolve(file);
			} else {
				reject(new Error("Canvas is empty"));
			}
		}, "image/jpeg", 0.95);
	});
}
