// server/config/jwtSecret.js
// Single source of truth for the JWT signing secret.
// Production must set JWT_SECRET; the fallback exists only so local dev and the test suite
// run without a .env.
const DEV_FALLBACK_SECRET = "gmu_badminton_super_secret_key_2026";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
	throw new Error("[SECURITY] JWT_SECRET must be set in production. Refusing to start with the default secret.");
}

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

module.exports = { JWT_SECRET };
