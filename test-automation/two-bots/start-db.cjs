// Starts a single-node in-memory MongoDB replica set and stays alive.
// Prints a line "MONGO_URI=<uri>" once ready (run-all.cjs waits for it).
// Optional: MONGOMS_VERSION env picks a mongod version (default lets the lib choose).
const { MongoMemoryReplSet } = require("mongodb-memory-server");

(async () => {
	const replSet = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await replSet.waitUntilRunning();
	const uri = replSet.getUri("gmu_badminton_twobots");
	console.log("MONGO_URI=" + uri);

	const stop = async () => {
		try { await replSet.stop(); } catch (e) { /* ignore */ }
		process.exit(0);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	// run-all.cjs can also ask us to stop through stdin
	process.stdin.on("data", (d) => { if (String(d).includes("stop")) stop(); });
	process.stdin.on("end", stop);
	setInterval(() => {}, 1 << 30);
})().catch((e) => {
	console.error("DB start failed:", e);
	process.exit(1);
});
