// One-command runner: in-memory Mongo -> API (port 5199) -> Vite client (port 5175) -> twobots.cjs -> shutdown.
//
//   node run-all.cjs            start everything, run the bots, stop everything
//   node run-all.cjs --serve    start everything and keep it running (Ctrl+C stops it)
//
// Env overrides: REPO (worktree path), API_PORT, WEB_PORT, MONGOMS_VERSION, HEADED=1
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const HERE = __dirname;
// Repo root (this file lives in test-automation/two-bots).
const REPO = process.env.REPO || path.resolve(__dirname, "..", "..");
const API_PORT = Number(process.env.API_PORT || 5199);
const WEB_PORT = Number(process.env.WEB_PORT || 5175);
const SERVE_ONLY = process.argv.includes("--serve");
const LOG_DIR = path.join(HERE, "logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

const children = [];
function log(...a) { console.log("[run-all]", ...a); }

function start(name, cmd, args, opts) {
	const out = fs.createWriteStream(path.join(LOG_DIR, `${name}.log`));
	const child = spawn(cmd, args, { ...opts, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
	child.stdout.pipe(out);
	child.stderr.pipe(out);
	child.on("exit", (code) => log(`${name} exited (code ${code})`));
	children.push({ name, child });
	return child;
}

function waitForLine(child, re, timeoutMs, name) {
	return new Promise((resolve, reject) => {
		let buf = "";
		const t = setTimeout(() => reject(new Error(`${name}: timed out waiting for ${re}`)), timeoutMs);
		const onData = (d) => {
			buf += String(d);
			const m = buf.match(re);
			if (m) { clearTimeout(t); resolve(m); }
		};
		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		child.on("exit", (c) => { clearTimeout(t); reject(new Error(`${name} exited early (code ${c}); see logs/${name}.log`)); });
	});
}

function httpGet(url) {
	return new Promise((resolve) => {
		const req = http.get(url, (res) => {
			let body = "";
			res.on("data", (d) => (body += d));
			res.on("end", () => resolve({ status: res.statusCode, body }));
		});
		req.on("error", () => resolve({ status: 0, body: "" }));
		req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, body: "" }); });
	});
}

async function waitForHttp(url, okFn, timeoutMs, name) {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		const r = await httpGet(url);
		if (okFn(r)) return r;
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`${name}: ${url} not ready after ${timeoutMs}ms`);
}

function portInUse(port) {
	return new Promise((resolve) => {
		const s = require("net").createServer();
		s.once("error", () => resolve(true));
		s.once("listening", () => s.close(() => resolve(false)));
		s.listen(port, "127.0.0.1");
	});
}

let stopping = false;
async function stopAll() {
	if (stopping) return;
	stopping = true;
	for (const { name, child } of [...children].reverse()) {
		if (child.exitCode !== null) continue;
		log(`stopping ${name} (pid ${child.pid})`);
		try { if (name === "db") child.stdin.write("stop\n"); } catch (e) { /* ignore */ }
		await new Promise((r) => setTimeout(r, name === "db" ? 1500 : 200));
		if (child.exitCode === null) {
			try {
				if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
				else child.kill("SIGTERM");
			} catch (e) { /* already gone */ }
		}
	}
}

process.on("SIGINT", async () => { await stopAll(); process.exit(130); });

(async () => {
	for (const p of [API_PORT, WEB_PORT]) {
		if (await portInUse(p)) throw new Error(`Port ${p} is already in use - stop whatever is running there first.`);
	}

	// 1. DB
	log("starting in-memory MongoDB...");
	const db = start("db", process.execPath, [path.join(HERE, "start-db.cjs")], { cwd: HERE, env: process.env });
	const [, mongoUri] = await waitForLine(db, /MONGO_URI=(\S+)/, 300000, "db");
	log("MongoDB ready:", mongoUri);
	fs.writeFileSync(path.join(HERE, "mongo-uri.txt"), mongoUri);

	// 2. API
	log("starting API on", API_PORT);
	const apiEnv = {
		...process.env,
		MONGO_URI: mongoUri,
		PORT: String(API_PORT),
		NODE_ENV: "development",
		JWT_SECRET: "twobots-local-secret",
		FRONTEND_URL: `http://localhost:${WEB_PORT}`,
	};
	delete apiEnv.REDIS_URL;
	const apiArgs = process.env.REAL_KAFKA === "1" ? ["server.js"] : ["-r", path.join(HERE, "no-kafka.cjs"), "server.js"];
	if (process.env.REAL_KAFKA !== "1") log("Kafka stubbed (no broker here; set REAL_KAFKA=1 to disable)");
	const api = start("api", process.execPath, apiArgs, { cwd: path.join(REPO, "server"), env: apiEnv });
	await waitForLine(api, /Successfully connected to MongoDB!/, 90000, "api");
	await waitForHttp(`http://localhost:${API_PORT}/api/status`, (r) => r.status === 200, 60000, "api");
	log("API ready: /api/status 200, Mongo connected");

	// 3. Vite client
	log("starting Vite on", WEB_PORT);
	const viteBin = path.join(REPO, "client", "node_modules", "vite", "bin", "vite.js");
	const webEnv = { ...process.env, VITE_API_URL: `http://localhost:${API_PORT}`, BROWSER: "none" };
	const web = start("web", process.execPath, [viteBin, "--port", String(WEB_PORT), "--strictPort", "--host", "localhost"], { cwd: path.join(REPO, "client"), env: webEnv });
	await waitForLine(web, /Local:|ready in/i, 90000, "web");
	await waitForHttp(`http://localhost:${WEB_PORT}/`, (r) => r.status === 200, 60000, "web");
	log("Vite ready");

	if (SERVE_ONLY) {
		log(`Serving. App: http://localhost:${WEB_PORT}  API: http://localhost:${API_PORT}  (Ctrl+C to stop)`);
		return;
	}

	// 4. Bots
	log("running twobots.cjs ...");
	const code = await new Promise((resolve) => {
		const bots = spawn(process.execPath, [path.join(HERE, "twobots.cjs")], {
			cwd: HERE,
			stdio: "inherit",
			env: { ...process.env, WEB_URL: `http://localhost:${WEB_PORT}`, API_URL: `http://localhost:${API_PORT}`, MONGO_URI: mongoUri, REPO },
		});
		bots.on("exit", resolve);
	});
	log("twobots.cjs finished with code", code, "- results in results.json, screenshots in shots/");
	await stopAll();
	process.exit(code || 0);
})().catch(async (e) => {
	console.error("[run-all] FAILED:", e.message);
	await stopAll();
	process.exit(1);
});
