// client/src/utils/imageUtils.js

/**
 * Compresses an image file client-side to ensure it is under the target size (default < 1MB)
 * and within maximum dimensions (default 1600px) using HTML5 Canvas.
 *
 * @param {File} file - The raw input file from file picker or camera.
 * @param {Object|number} [options] - Options object or maxWidthOrHeight number for backward compatibility.
 * @param {number} [options.maxSizeMB=1.0] - Target size ceiling in MB (default 1.0).
 * @param {number} [options.maxWidthOrHeight=1600] - Max width or height in px (default 1600).
 * @param {number} [options.initialQuality=0.8] - Starting JPEG compression quality (0.1 to 1.0).
 * @returns {Promise<File>} - Resolves with the compressed File object.
 */
export const compressImage = (file, options = {}, positionalQuality = 0.8) => {
	// Support backward-compatible positional signature compressImage(file, maxWidth, quality)
	let config = {};
	if (typeof options === "number") {
		config = {
			maxWidthOrHeight: options,
			initialQuality: typeof positionalQuality === "number" ? positionalQuality : 0.8,
			maxSizeMB: 1.0
		};
	} else if (options && typeof options === "object") {
		config = options;
	}

	const {
		maxSizeMB = 1.0,
		maxWidthOrHeight = 1600,
		initialQuality = 0.8
	} = config;

	return new Promise((resolve) => {
		// Non-image or missing file guard
		if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
			return resolve(file);
		}

		const maxSizeBytes = maxSizeMB * 1024 * 1024;

		// Preserve animated GIFs if within ceiling
		if (file.type === "image/gif" && typeof file.size === "number" && file.size <= maxSizeBytes) {
			return resolve(file);
		}

		// Fallback for non-browser/SSR/JSDOM environments without full 2D canvas & toBlob
		if (typeof window === "undefined" || typeof document === "undefined") {
			return resolve(file);
		}

		const canvasTest = document.createElement("canvas");
		if (
			!canvasTest.getContext ||
			!canvasTest.getContext("2d") ||
			typeof canvasTest.toBlob !== "function" ||
			typeof window.URL === "undefined" ||
			typeof window.URL.createObjectURL !== "function"
		) {
			return resolve(file);
		}

		let objectUrl;
		try {
			objectUrl = URL.createObjectURL(file);
		} catch (err) {
			console.warn("Could not create object URL for compression fallback:", err);
			return resolve(file);
		}

		const img = new Image();

		img.onload = () => {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			try {
				let { width, height } = img;

				// Fast path: already under target size and within dimensions
				if (typeof file.size === "number" && file.size <= maxSizeBytes && width <= maxWidthOrHeight && height <= maxWidthOrHeight) {
					return resolve(file);
				}

				// Compute scale ratio maintaining aspect ratio
				if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
					if (width >= height) {
						height = Math.round((height * maxWidthOrHeight) / width);
						width = maxWidthOrHeight;
					} else {
						width = Math.round((width * maxWidthOrHeight) / height);
						height = maxWidthOrHeight;
					}
				}

				const canvas = document.createElement("canvas");
				canvas.width = Math.max(1, width);
				canvas.height = Math.max(1, height);
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					return resolve(file);
				}

				// High quality rendering
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(img, 0, 0, width, height);

				const exportBlob = (currentQuality) => {
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								return resolve(file); // graceful fallback
							}

							// If still above ceiling and quality can be reduced further, step down
							if (blob.size > maxSizeBytes && currentQuality > 0.4) {
								return exportBlob(Math.max(0.3, currentQuality - 0.15));
							}

							const originalName = (file && typeof file.name === "string" && file.name) ? file.name : "compressed-photo.jpg";
							const newFileName = originalName.replace(/\.[^/.]+$/, "") + ".jpg";

							const compressedFile = new File([blob], newFileName, {
								type: "image/jpeg",
								lastModified: Date.now()
							});

							resolve(compressedFile);
						},
						"image/jpeg",
						currentQuality
					);
				};

				exportBlob(initialQuality);
			} catch (err) {
				console.warn("Canvas compression failed, falling back to original file:", err);
				resolve(file);
			}
		};

		img.onerror = (err) => {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			console.warn("Image load error during compression:", err);
			resolve(file);
		};

		img.src = objectUrl;
	});
};
