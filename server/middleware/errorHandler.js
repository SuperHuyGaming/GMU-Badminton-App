// server/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
	console.error("❌ GLOBAL ERROR LOG:", err.stack || err.message || err);

	// Determine status code
	let statusCode = (res.statusCode && res.statusCode !== 200) ? res.statusCode : 500;

	if (err.status && typeof err.status === "number") {
		statusCode = err.status;
	} else if (err.statusCode && typeof err.statusCode === "number") {
		statusCode = err.statusCode;
	} else if (err.name === "ValidationError" || err.name === "CastError" || err.name === "MulterError") {
		statusCode = 400;
	}

	const isProduction = process.env.NODE_ENV === "production";
	const userMessage = (statusCode === 500 && isProduction)
		? "An unexpected server error occurred."
		: (err.message || "An unexpected server error occurred.");
	
	res.status(statusCode).json({
		message: userMessage,
		// Only show stack trace in development mode
		stack: isProduction ? null : err.stack,
	});
};

module.exports = errorHandler;
