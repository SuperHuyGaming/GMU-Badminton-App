// server/routes/profile.js
const express = require("express");
const User = require("../models/User");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();
// GET: Fetch the logged-in user's profile
router.get("/", authMiddleware, async (req, res) => {
	try {
		// Find user but exclude the password and push subscriptions from the data sent to React!
		const user = await User.findById(req.user.userId).select("-password -pushSubscriptions");
		if (!user) return res.status(401).json({ message: "Session invalid or user deleted" });
		res.json(user);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching profile" });
	}
});

// GET: Export all user data (GDPR Compliance - Task 10)
router.get("/export", authMiddleware, async (req, res, next) => {
    try {
        const { ZipArchive } = require("archiver");
        const Match = require("../models/Match");
        const Post = require("../models/Post");
        
        const userId = req.user.userId || req.user.id;
        
        // 1. Gather all user data
        const userProfile = await User.findById(userId).select("-password").lean();
        if (!userProfile) return res.status(404).json({ message: "User not found" });

        const userMatches = await Match.find({
            $or: [{ team1: userId }, { team2: userId }]
        }).lean();

        const userPosts = await Post.find({ authorId: userId.toString() }).lean();

        // 2. Set headers for file download
        const safeName = (userProfile.name || "user").replace(/\s+/g, '_');
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename=GMU_Badminton_Export_${safeName}.zip`);

        // 3. Create zip archive stream (archiver v8 uses named class exports)
        const archive = new ZipArchive({
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
		// Exclude password, email, and pushSubscriptions to protect user privacy
		const user = await User.findById(req.params.id).select("-password -email -pushSubscriptions");
		if (!user) return res.status(404).json({ message: "User not found" });
		res.json(user);
	} catch (err) {
		res.status(500).json({ message: "Server error fetching profile" });
	}
});

const xss = require("xss");
const rateLimit = require("express-rate-limit");

const profileLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	message: { message: "Too many profile updates, please try again later." },
});

// PUT: Update the user's profile
router.put("/", authMiddleware, profileLimiter, async (req, res) => {
	try {
		// NEW: Destructure profilePic and coverPic from the incoming request
		const {
			name,
			firstName,
			lastName,
			skillLevel,
			bio,
			preferredPlay,
			racket,
			profilePic,
			coverPic,
			homeUniversity,
			searchRadius,
			hideFromSearch,
		} = req.body;

		if (firstName !== undefined && (typeof firstName !== "string" || firstName.trim() === "")) {
			return res.status(400).json({ message: "First name cannot be empty or just whitespace." });
		}

		if (lastName !== undefined && (typeof lastName !== "string" || lastName.trim() === "")) {
			return res.status(400).json({ message: "Last name cannot be empty or just whitespace." });
		}

		if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
			return res.status(400).json({ message: "Display name cannot be empty or just whitespace." });
		}

		if (bio !== undefined && typeof bio !== "string") {
			return res.status(400).json({ message: "Bio must be a string." });
		}

		if (racket !== undefined && typeof racket !== "string") {
			return res.status(400).json({ message: "Racket must be a string." });
		}

		if (homeUniversity !== undefined && typeof homeUniversity !== "string") {
			return res.status(400).json({ message: "Home university must be a string." });
		}

		if (profilePic !== undefined && typeof profilePic !== "string") {
			return res.status(400).json({ message: "Profile picture must be a valid URL string." });
		}

		if (coverPic !== undefined && typeof coverPic !== "string") {
			return res.status(400).json({ message: "Cover picture must be a valid URL string." });
		}

		if (skillLevel !== undefined && !["D Level", "C Level", "B Level"].includes(skillLevel)) {
			return res.status(400).json({ message: "Invalid skill level. Allowed values: D Level, C Level, B Level." });
		}

		if (preferredPlay !== undefined && !["Singles", "Doubles", "Mixed", "Any"].includes(preferredPlay)) {
			return res.status(400).json({ message: "Invalid preferred play. Allowed values: Singles, Doubles, Mixed, Any." });
		}

		if (searchRadius !== undefined) {
			const parsedRadius = Number(searchRadius);
			if (isNaN(parsedRadius) || parsedRadius < 0 || parsedRadius > 500) {
				return res.status(400).json({ message: "Search radius must be a number between 0 and 500." });
			}
		}

		const cleanName = (typeof name === "string") ? xss(name.trim().slice(0, 100)) : undefined;
		const cleanFirstName = (typeof firstName === "string") ? xss(firstName.trim().slice(0, 50)) : undefined;
		const cleanLastName = (typeof lastName === "string") ? xss(lastName.trim().slice(0, 50)) : undefined;
		const cleanBio = (typeof bio === "string") ? xss(bio.trim().slice(0, 500)) : undefined;
		const cleanPreferredPlay = preferredPlay;
		const cleanRacket = (typeof racket === "string") ? xss(racket.trim().slice(0, 100)) : undefined;
		const cleanHomeUniversity = (typeof homeUniversity === "string") ? xss(homeUniversity.trim().slice(0, 100)) : undefined;

		const currentUserId = req.user.id || req.user.userId;

		const updatedUser = await User.findByIdAndUpdate(
			currentUserId,
			// Tell MongoDB to update the sanitized fields
			{
				name: cleanName,
				firstName: cleanFirstName,
				lastName: cleanLastName,
				skillLevel,
				bio: cleanBio,
				preferredPlay: cleanPreferredPlay,
				racket: cleanRacket,
				profilePic,
				coverPic,
				homeUniversity: cleanHomeUniversity,
				searchRadius,
				hideFromSearch,
			},
			{ new: true, runValidators: true },
		).select("-password -pushSubscriptions");

		if (!updatedUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const io = req.io || req.app?.get("io");
		if (io) {
			// Strip sensitive fields (email, push subscriptions, password) before broadcasting
			const publicUser = typeof updatedUser.toObject === "function" ? updatedUser.toObject() : { ...updatedUser };
			delete publicUser.password;
			delete publicUser.pushSubscriptions;
			delete publicUser.email;
			io.emit("profileUpdated", publicUser);
		}

		res.json(updatedUser);
	} catch (err) {
		console.error("Error saving profile:", err);
		res.status(500).json({ message: "Server error updating profile" });
	}
});

module.exports = { router, authMiddleware, adminMiddleware };
