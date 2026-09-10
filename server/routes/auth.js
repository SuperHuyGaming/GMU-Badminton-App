const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { validateRegistration, validateLogin } = require("../middleware/validator");

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { message: "Too many attempts from this IP, please try again after 15 minutes." },
});

const JWT_SECRET =
	process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// Helper to generate access token
const generateAccessToken = (user) => {
	return jwt.sign(
		{
			userId: user._id,
			role: user.role,
		},
		JWT_SECRET,
		{ expiresIn: "15m" },
	);
};

// POST: Register a new user
router.post("/register", authLimiter, validateRegistration, async (req, res, next) => {
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

		const accessToken = generateAccessToken(user);
		const refreshToken = await RefreshToken.createToken(user);

		res.status(201).json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				skillLevel: user.skillLevel,
				role: user.role,
				profilePic: user.profilePic,
			},
		});
	} catch (error) {
		next(error);
	}
});

// POST: Login an existing user
router.post("/login", authLimiter, validateLogin, async (req, res, next) => {
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

		const accessToken = generateAccessToken(user);
		const refreshToken = await RefreshToken.createToken(user);

		res.json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				skillLevel: user.skillLevel,
				role: user.role,
				profilePic: user.profilePic,
			},
		});
	} catch (error) {
		next(error);
	}
});

// POST: Refresh Access Token
router.post("/refreshtoken", async (req, res, next) => {
	const { refreshToken: requestToken } = req.body;

	if (requestToken == null) {
		return res.status(403).json({ message: "Refresh Token is required!" });
	}

	try {
		let refreshToken = await RefreshToken.findOne({ token: requestToken });

		if (!refreshToken) {
			return res
				.status(403)
				.json({ message: "Refresh token is not in database!" });
		}

		if (RefreshToken.verifyExpiration(refreshToken)) {
			await RefreshToken.findByIdAndDelete(refreshToken._id);
			return res.status(403).json({
				message:
					"Refresh token was expired. Please make a new signin request",
			});
		}

		let user = await User.findById(refreshToken.user);
		let newAccessToken = generateAccessToken(user);

		return res.status(200).json({
			accessToken: newAccessToken,
			refreshToken: refreshToken.token,
		});
	} catch (err) {
		next(err);
	}
});

// POST: Logout
router.post("/logout", async (req, res, next) => {
	try {
		const { refreshToken: requestToken } = req.body;
		if (requestToken) {
			await RefreshToken.findOneAndDelete({ token: requestToken });
		}
		res.status(204).send();
	} catch (error) {
		next(error);
	}
});

module.exports = router;
