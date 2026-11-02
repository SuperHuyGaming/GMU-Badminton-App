// server/config/jwtSecret.js
// Single source of truth for the JWT signing secret.
// The fallback exists only so local dev and the test suite run without a .env.
// Once JWT_SECRET is confirmed on Render, production should refuse to start without it.
const DEV_FALLBACK_SECRET = "gmu_badminton_super_secret_key_2026";

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
	console.error(
		"[SECURITY] JWT_SECRET is not set in production; falling back to the public default secret. " +
		"Set JWT_SECRET in the deployment environment immediately."
	);
}

module.exports = { JWT_SECRET };
