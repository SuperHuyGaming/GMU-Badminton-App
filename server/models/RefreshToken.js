const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
	token: { type: String, required: true, unique: true },
	user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	expiryDate: { type: Date, required: true },
});

refreshTokenSchema.statics.createToken = async function (user) {
	let expiredAt = new Date();
	expiredAt.setSeconds(
		expiredAt.getSeconds() + 7 * 24 * 60 * 60, // 7 days
	);

	let _token = require("crypto").randomBytes(40).toString("hex");

	let _object = new this({
		token: _token,
		user: user._id,
		expiryDate: expiredAt.getTime(),
	});

	let refreshToken = await _object.save();

	return refreshToken.token;
};

refreshTokenSchema.statics.verifyExpiration = (token) => {
	return token.expiryDate.getTime() < new Date().getTime();
};

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
