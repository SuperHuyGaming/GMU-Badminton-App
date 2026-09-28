// server/middleware/validator.js

const validateRegistration = (req, res, next) => {
	const { name, firstName, lastName, email, password } = req.body;

	const hasValidName = (name && typeof name === "string" && name.trim().length >= 2);
	const hasValidFirstLast = (firstName && typeof firstName === "string" && firstName.trim().length >= 1) && 
							  (lastName && typeof lastName === "string" && lastName.trim().length >= 1);

	if (!hasValidName && !hasValidFirstLast) {
		return res.status(400).json({
			message: "Name is required and must be at least 2 characters long.",
		});
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!email || !emailRegex.test(email)) {
		return res.status(400).json({
			message: "A valid email address is required.",
		});
	}

	if (!password || typeof password !== "string" || password.length < 6) {
		return res.status(400).json({
			message: "Password is required and must be at least 6 characters long.",
		});
	}

	next();
};

const validateLogin = (req, res, next) => {
	const { email, password } = req.body;

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!email || !emailRegex.test(email)) {
		return res.status(400).json({
			message: "A valid email address is required.",
		});
	}

	if (!password || typeof password !== "string" || password.length < 1) {
		return res.status(400).json({
			message: "Password is required.",
		});
	}

	next();
};

module.exports = {
	validateRegistration,
	validateLogin,
};
