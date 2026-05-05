// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// A secure secret key for signing tokens (Fallbacks to a string if not in .env)
const JWT_SECRET =
	process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// POST: Register a new user
router.post("/register", async (req, res) => {
	try {
		const { name, email, password } = req.body;

		// 1. Check if a user with this email already exists
		let user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({
				message: "An account with this email already exists.",
			});
		}

		// 2. Security: Scramble (hash) the password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// 3. Save the new user to MongoDB
		user = new User({
			name,
			email,
			password: hashedPassword,
		});
		await user.save();

		// 4. Create the "Digital Wristband" (JWT Token)
		const token = jwt.sign(
			{
				userId: user._id,
				name: user.name,
				skillLevel: user.skillLevel,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "7d" }, // Token expires in 7 days
		);

		// 5. Send the token and user data back to React
		res.status(201).json({
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				skillLevel: user.skillLevel,
				role: user.role,
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

		// 1. Find the user by email
		const user = await User.findOne({ email });
		if (!user) {
			return res
				.status(400)
				.json({ message: "Invalid email or password." });
		}

		// 2. Check if the typed password matches the scrambled password in the database
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res
				.status(400)
				.json({ message: "Invalid email or password." });
		}

		// 3. Issue the Token
		const token = jwt.sign(
			{
				userId: user._id,
				name: user.name,
				skillLevel: user.skillLevel,
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
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ message: "Server error during login." });
	}
});

module.exports = router;
