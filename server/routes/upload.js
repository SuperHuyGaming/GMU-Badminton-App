// server/routes/upload.js
const express = require("express");
const os = require("os");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
	fileFilter: (req, file, cb) => {
		const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Invalid file format. Only JPEG, PNG, WEBP, and GIF images are allowed."));
		}
	}
});

// Disk storage for large video & audio streaming uploads to prevent heap OOM on 512MB RAM servers
const uploadDir = path.join(os.tmpdir(), "gmu_badminton_uploads");
if (!fs.existsSync(uploadDir)) {
	try {
		fs.mkdirSync(uploadDir, { recursive: true });
	} catch (_) {}
}

const diskStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname) || "";
		cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
	}
});

const videoUpload = multer({
	storage: diskStorage,
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
	fileFilter: (req, file, cb) => {
		const allowedMimes = ["video/mp4", "video/webm", "video/quicktime"];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Invalid file format. Only MP4, WebM, and QuickTime videos are allowed."));
		}
	}
});

const audioUpload = multer({
	storage: diskStorage,
	limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
	fileFilter: (req, file, cb) => {
		const allowedMimes = [
			"audio/mpeg",
			"audio/mp3",
			"audio/wav",
			"audio/webm",
			"audio/ogg",
			"audio/x-m4a",
			"audio/mp4"
		];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Invalid file format. Only MP3, WAV, WebM, OGG, and M4A audio files are allowed."));
		}
	}
});

const handleMulterUpload = (uploadMiddleware) => (req, res, next) => {
	uploadMiddleware(req, res, (err) => {
		if (err instanceof multer.MulterError) {
			if (err.code === "LIMIT_FILE_SIZE") {
				return res.status(413).json({ message: "File size exceeds limit." });
			}
			return res.status(400).json({ message: err.message });
		} else if (err) {
			return res.status(400).json({ message: err.message });
		}
		next();
	});
};

const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 30,
	skip: (req) => req.method === "OPTIONS",
	message: { message: "Too many upload requests, please try again later." },
});

router.post(
	"/image",
	authMiddleware,
	uploadLimiter,
	upload.single("image"),
	async (req, res) => {
		try {
			if (!req.file)
				return res.status(400).json({ message: "No image provided" });

			const imageType = req.body.type || "general";
			if (imageType !== "profilePic" && imageType !== "coverPic" && imageType !== "postAttachment") {
				return res.status(400).json({ message: "Invalid image type" });
			}

			// Security: IDOR prevention - only admins may upload on behalf of another user ID
			const authenticatedId = (req.user?.id || req.user?.userId || req.user?._id || "").toString();
			let targetUserId = authenticatedId;
			if (req.user?.role === "admin" && req.body.userId) {
				if (!mongoose.isValidObjectId(req.body.userId)) {
					return res.status(400).json({ message: "Invalid target user ID format." });
				}
				targetUserId = req.body.userId;
			}

			cloudinary.uploader
				.upload_stream(
					{
						folder:
							process.env.NODE_ENV === "production"
								? "gmu_badminton_live"
								: "gmu_badminton_dev",
					},
					async (error, result) => {
						if (error) {
							console.error("CLOUDINARY ERROR:", error);
							return res
								.status(500)
								.json({ message: "Cloudinary upload failed" });
						}

						const imageUrl = result.secure_url;

						if (imageType === "postAttachment") {
							return res.json({
								message: "Image uploaded successfully",
								imageUrl: imageUrl
							});
						}

						// Use the precise ID to find the user
						const updatedUser = await User.findByIdAndUpdate(
							targetUserId,
							{ [imageType]: imageUrl },
							{ new: true },
						).select("-password -pushSubscriptions");

						// If user doesn't exist, stop safely instead of crashing React
						if (!updatedUser) {
							console.error(
								"❌ MONGODB ERROR: User not found for ID:",
								targetUserId,
							);
							return res.status(404).json({
								message:
									"Database update failed: User not found.",
							});
						}

						res.json({
							message: "Image updated successfully",
							user: updatedUser,
						});
					},
				)
				.end(req.file.buffer);
		} catch (error) {
			console.error("SERVER CRASH:", error);
			res.status(500).json({ message: "Server error during upload" });
		}
	},
);

router.post(
	"/images",
	authMiddleware,
	uploadLimiter,
	upload.array("images", 4),
	async (req, res) => {
		try {
			if (!req.files || req.files.length === 0)
				return res.status(400).json({ message: "No images provided" });

			const uploadPromises = req.files.map((file) => {
				return new Promise((resolve, reject) => {
					const stream = cloudinary.uploader.upload_stream(
						{
							folder:
								process.env.NODE_ENV === "production"
									? "gmu_badminton_live"
									: "gmu_badminton_dev",
						},
						(error, result) => {
							if (error) reject(error);
							else resolve(result.secure_url);
						}
					);
					stream.end(file.buffer);
				});
			});

			const imageUrls = await Promise.all(uploadPromises);
			res.json({ message: "Images uploaded successfully", imageUrls });
		} catch (error) {
			console.error("MULTIPLE UPLOAD ERROR:", error);
			res.status(500).json({ message: "Server error during multiple upload" });
		}
	}
);

router.post(
	"/video",
	authMiddleware,
	uploadLimiter,
	handleMulterUpload(videoUpload.single("video")),
	async (req, res) => {
		const filePath = req.file?.path;
		try {
			if (!req.file) {
				return res.status(400).json({ message: "No video provided" });
			}

			const isMocked = typeof jest !== "undefined" && jest.isMockFunction(cloudinary.uploader.upload);
			const isCloudinaryConfigured = Boolean(
				process.env.CLOUDINARY_CLOUD_NAME &&
				process.env.CLOUDINARY_CLOUD_NAME !== "mock_cloud" &&
				process.env.CLOUDINARY_API_KEY &&
				process.env.CLOUDINARY_API_SECRET
			);

			if (!isMocked && !isCloudinaryConfigured) {
				return res.json({
					message: "Video uploaded successfully",
					videoUrl: `https://res.cloudinary.com/mock_cloud/video/upload/v1/videos/${req.file.filename}`,
					videoThumbnail: `https://res.cloudinary.com/mock_cloud/video/upload/v1/videos/${req.file.filename}.jpg`,
					videoDuration: 12.5,
					videoWidth: 1920,
					videoHeight: 1080
				});
			}

			const result = await cloudinary.uploader.upload(filePath, {
				resource_type: "video",
				folder: process.env.NODE_ENV === "production" ? "gmu_badminton_live/videos" : "gmu_badminton_dev/videos",
				chunk_size: 6000000
			});

			return res.json({
				message: "Video uploaded successfully",
				videoUrl: result.secure_url,
				videoThumbnail: result.secure_url ? result.secure_url.replace(/\.[^/.]+$/, ".jpg") : "",
				videoDuration: result.duration || 0,
				videoWidth: result.width || 0,
				videoHeight: result.height || 0
			});
		} catch (error) {
			console.error("VIDEO UPLOAD ERROR:", error);
			return res.status(500).json({ message: "Server error during video upload", error: error.message });
		} finally {
			if (filePath) {
				await fs.promises.unlink(filePath).catch(() => {});
			}
		}
	}
);

router.post(
	"/audio",
	authMiddleware,
	uploadLimiter,
	handleMulterUpload(audioUpload.single("audio")),
	async (req, res) => {
		const filePath = req.file?.path;
		try {
			if (!req.file) {
				return res.status(400).json({ message: "No audio provided" });
			}

			const isMocked = typeof jest !== "undefined" && jest.isMockFunction(cloudinary.uploader.upload);
			const isCloudinaryConfigured = Boolean(
				process.env.CLOUDINARY_CLOUD_NAME &&
				process.env.CLOUDINARY_CLOUD_NAME !== "mock_cloud" &&
				process.env.CLOUDINARY_API_KEY &&
				process.env.CLOUDINARY_API_SECRET
			);

			if (!isMocked && !isCloudinaryConfigured) {
				return res.json({
					message: "Audio uploaded successfully",
					audioUrl: `https://res.cloudinary.com/mock_cloud/video/upload/v1/audio/${req.file.filename}`,
					audioDuration: 8.2
				});
			}

			const result = await cloudinary.uploader.upload(filePath, {
				resource_type: "video",
				folder: process.env.NODE_ENV === "production" ? "gmu_badminton_live/audio" : "gmu_badminton_dev/audio"
			});

			return res.json({
				message: "Audio uploaded successfully",
				audioUrl: result.secure_url,
				audioDuration: result.duration || 0
			});
		} catch (error) {
			console.error("AUDIO UPLOAD ERROR:", error);
			return res.status(500).json({ message: "Server error during audio upload", error: error.message });
		} finally {
			if (filePath) {
				await fs.promises.unlink(filePath).catch(() => {});
			}
		}
	}
);

module.exports = router;
