// server/routes/upload.js
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { authMiddleware } = require("./profile");

const router = express.Router();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
	"/image",
	authMiddleware,
	upload.single("image"),
	async (req, res) => {
		try {
			if (!req.file)
				return res.status(400).json({ message: "No image provided" });

			const imageType = req.body.type;
			if (imageType !== "profilePic" && imageType !== "coverPic") {
				return res.status(400).json({ message: "Invalid image type" });
			}

			// Explicitly grab the ID sent from the frontend!
			const targetUserId =
				req.body.userId || req.user?.id || req.user?._id;

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

						// Use the precise ID to find the user
						const updatedUser = await User.findByIdAndUpdate(
							targetUserId,
							{ [imageType]: imageUrl },
							{ new: true },
						).select("-password");

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

module.exports = router;
