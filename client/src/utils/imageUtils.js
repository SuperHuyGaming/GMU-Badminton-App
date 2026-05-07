// client/src/utils/imageUtils.js

/**
 * Reads an image file, resizes it if it's too wide, and compresses it to a lightweight JPEG Base64 string.
 * @param {File} file - The image file from the input picker.
 * @param {number} maxWidth - The maximum width in pixels (e.g., 1200 for covers, 400 for avatars).
 * @param {number} quality - JPEG compression quality (0.0 to 1.0).
 * @returns {Promise<string>} - The compressed Base64 string.
 */
export const compressImage = (file, maxWidth = 800, quality = 0.7) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		// 1. Read the file as a raw data URL
		reader.readAsDataURL(file);

		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target.result;

			img.onload = () => {
				// 2. Calculate the new dimensions keeping the aspect ratio
				let width = img.width;
				let height = img.height;

				if (width > maxWidth) {
					height = Math.round((height * maxWidth) / width);
					width = maxWidth;
				}

				// 3. Create a hidden canvas element
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");

				// 4. Draw the image onto the canvas at the new smaller size
				ctx.drawImage(img, 0, 0, width, height);

				// 5. Export the canvas as a compressed JPEG string
				const compressedBase64 = canvas.toDataURL(
					"image/jpeg",
					quality,
				);
				resolve(compressedBase64);
			};
			img.onerror = (err) => reject(err);
		};
		reader.onerror = (err) => reject(err);
	});
};
