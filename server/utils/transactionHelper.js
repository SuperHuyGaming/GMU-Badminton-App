const mongoose = require("mongoose");

let isTransactionSupported = null; // null = untried, true = supported, false = unsupported

/**
 * Resets the cached transaction capability (useful for unit tests)
 */
function resetTransactionSupportCache() {
	isTransactionSupported = null;
}

/**
 * Checks if an error is due to MongoDB running in standalone mode without replica set
 */
function isStandaloneReplicaSetError(err) {
	if (!err) return false;
	if (err.code === 20 || err.codeName === "IllegalOperation") return true;
	const msg = String(err.message || "").toLowerCase();
	return (
		msg.includes("replica set member or mongos") ||
		msg.includes("transaction numbers are only allowed") ||
		msg.includes("does not support transactions") ||
		msg.includes("standalone")
	);
}

/**
 * Executes operations within a MongoDB session/transaction if available,
 * gracefully falling back to atomic queries with compensation if on standalone MongoDB.
 */
async function executeWithTransactionOrFallback({ transactionFn, fallbackFn }) {
	// 1. If disconnected or transaction known unsupported, use fallback directly
	if (mongoose.connection.readyState !== 1 || isTransactionSupported === false) {
		return await fallbackFn();
	}

	let session = null;
	try {
		if (typeof mongoose.startSession === "function") {
			session = await mongoose.startSession();
			session.startTransaction({
				readConcern: { level: "snapshot" },
				writeConcern: { w: "majority" }
			});
		}
	} catch (sessionErr) {
		if (isStandaloneReplicaSetError(sessionErr)) {
			isTransactionSupported = false;
			return await fallbackFn();
		}
		throw sessionErr;
	}

	if (!session) {
		return await fallbackFn();
	}

	try {
		const result = await transactionFn(session);
		await session.commitTransaction();
		isTransactionSupported = true;
		return result;
	} catch (err) {
		await session.abortTransaction().catch(() => {});
		if (isStandaloneReplicaSetError(err)) {
			isTransactionSupported = false;
			console.warn("⚠️ [TransactionHelper] MongoDB deployment does not support replica set transactions. Falling back to atomic Mongoose queries.");
			return await fallbackFn();
		}
		throw err;
	} finally {
		await session.endSession().catch(() => {});
	}
}

module.exports = {
	executeWithTransactionOrFallback,
	resetTransactionSupportCache,
	isStandaloneReplicaSetError
};
