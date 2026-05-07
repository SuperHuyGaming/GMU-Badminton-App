// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const JWT_SECRET =
	process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// POST: Register a new user
router.post("/register", async (req, res) => {
	try {
		const { name, email, password } = req.body;

		let user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({
				message: "An account with this email already exists.",
			});
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		user = new User({
			name,
			email,
			password: hashedPassword,
		});
		await user.save();

		// THE FIX: We keep the token ultra-lightweight!
		const token = jwt.sign(
			{
				userId: user._id,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "7d" },
		);

		res.status(201).json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				skillLevel: user.skillLevel,
				role: user.role,
				profilePic: user.profilePic, // This is completely safe in the response body!
			},
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({ message: "Server error during registration." });
	}
});

// POST: Login an existing user
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		const user = await User.findOne({ email });
		if (!user) {
			return res
				.status(400)
				.json({ message: "Invalid email or password." });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res
				.status(400)
				.json({ message: "Invalid email or password." });
		}

		// THE FIX: We keep the token ultra-lightweight!
		const token = jwt.sign(
			{
				userId: user._id,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "7d" },
		);

		res.json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				skillLevel: user.skillLevel,
				role: user.role,
				profilePic: user.profilePic, // Safe in the body!
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Server error during login." });
	}
});

module.exports = router;
