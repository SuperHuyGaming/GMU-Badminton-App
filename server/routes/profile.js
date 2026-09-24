// server/routes/profile.js
const express = require("express");
const User = require("../models/User");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();
// GET: Fetch the logged-in user's profile
router.get("/", authMiddleware, async (req, res) => {
	try {
		// Find user but exclude the password from the data sent to React!
		const user = await User.findById(req.user.userId).select("-password");
		if (!user) return res.status(401).json({ message: "Session invalid or user deleted" });
		res.json(user);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching profile" });
	}
});

// GET: Export all user data (GDPR Compliance - Task 10)
router.get("/export", authMiddleware, async (req, res, next) => {
    try {
        const archiver = require("archiver");
        const Match = require("../models/Match");
        const Post = require("../models/Post");
        
        const userId = req.user.userId || req.user.id;
        
        // 1. Gather all user data
        const userProfile = await User.findById(userId).select("-password").lean();
        if (!userProfile) return res.status(404).json({ message: "User not found" });

        const userMatches = await Match.find({
            $or: [{ team1: userId }, { team2: userId }]
        }).lean();

        const userPosts = await Post.find({ author: userId }).lean();

        // 2. Set headers for file download
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename=GMU_Badminton_Export_${userProfile.name.replace(/\s+/g, '_')}.zip`);

        // 3. Create zip archive stream
        const archive = archiver("zip", {
            zlib: { level: 9 } // Maximum compression
        });

        // Listen for errors
        archive.on("error", function (err) {
            console.error("Archive error:", err);
            res.status(500).send({ error: err.message });
        });

        // Pipe archive data to the response
        archive.pipe(res);

        // 4. Append files to the archive
        archive.append(JSON.stringify(userProfile, null, 2), { name: "profile.json" });
        archive.append(JSON.stringify(userMatches, null, 2), { name: "matches.json" });
        archive.append(JSON.stringify(userPosts, null, 2), { name: "forum_posts.json" });

        // 5. Finalize the archive (this will finish the stream and send the response)
        await archive.finalize();
    } catch (error) {
        next(error);
    }
});

// GET: Fetch a public profile by ID
router.get("/:id", authMiddleware, async (req, res) => {
	try {
		if (req.params.id === 'undefined' || req.params.id === 'null' || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
			return res.status(404).json({ message: "User not found" });
		}
		const user = await User.findById(req.params.id).select("-password -pushSubscriptions");
		if (!user) return res.status(404).json({ message: "User not found" });
		res.json(user);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching profile" });
	}
});

// PUT: Update the user's profile
router.put("/", authMiddleware, async (req, res) => {
	try {
		// NEW: Destructure profilePic and coverPic from the incoming request
		const {
			name,
			skillLevel,
			bio,
			preferredPlay,
			racket,
			profilePic,
			coverPic,
			homeUniversity,
			searchRadius,
		} = req.body;

		const updatedUser = await User.findByIdAndUpdate(
			req.user.userId,
			// NEW: Tell MongoDB to update the image fields
			{
				name,
				skillLevel,
				bio,
				preferredPlay,
				racket,
				profilePic,
				coverPic,
				homeUniversity,
				searchRadius,
			},
			{ new: true, runValidators: true },
		).select("-password");

		if (req.io) {
			req.io.emit("profileUpdated", updatedUser);
		}

		res.json(updatedUser);
	} catch (err) {
		console.error("Error saving profile:", err);
		res.status(500).json({ message: "Server error updating profile" });
	}
});

// GET: Fetch ANY user's profile by ID (Public/Read-Only view)
router.get("/:id", async (req, res) => {
	try {
		if (req.params.id === 'undefined' || req.params.id === 'null' || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
			return res.status(404).json({ message: "User not found" });
		}
		// We use .select("-password -email") to ensure we NEVER send
		// someone's private email or hashed password to the public forum!
		const user = await User.findById(req.params.id).select(
			"-password -email",
		);

		if (!user) return res.status(404).json({ message: "User not found" });
		res.json(user);
	} catch (err) {
		res.status(500).json({
			message: "Server error fetching public profile",
		});
	}
});

module.exports = { router, authMiddleware, adminMiddleware };
