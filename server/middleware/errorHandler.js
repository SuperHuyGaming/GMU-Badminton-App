// server/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
	console.error("❌ GLOBAL ERROR LOG:", err.stack || err.message || err);

	// Determine status code (default to 500)
	const statusCode = res.statusCode === 200 ? 500 : res.statusCode || 500;
	
	res.status(statusCode).json({
		message: err.message || "An unexpected server error occurred.",
		// Only show stack trace in development mode
		stack: process.env.NODE_ENV === "production" ? null : err.stack,
	});
};

module.exports = errorHandler;
