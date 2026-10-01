// server/middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET =
	process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

// SECURITY MIDDLEWARE: Checks the "Digital Wristband"
const authMiddleware = (req, res, next) => {
	const authHeader = req.header("Authorization");
	if (!authHeader)
		return res
			.status(401)
			.json({ message: "No token, authorization denied" });

	try {
		const token = authHeader.split(" ")[1];
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded; // Attaches the user's ID to the request
		next();
	} catch (err) {
		res.status(401).json({ message: "Token is not valid" });
	}
};

const adminMiddleware = (req, res, next) => {
	// Check the "role" we just added to the JWT
	if (req.user && req.user.role === "admin") {
		next(); // User is an admin, let them through!
	} else {
		res.status(403).json({ message: "Access denied. Admins only." });
	}
};

module.exports = { authMiddleware, adminMiddleware };
