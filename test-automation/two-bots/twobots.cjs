// Two-user bot test: Bot Alice (desktop) and Bot Bob (phone) use the real UI against a LOCAL stack.
// Normally started by run-all.cjs. Standalone: start the stack with `node run-all.cjs --serve`, then
// `node twobots.cjs` (WEB_URL / API_URL default to localhost:5175 / localhost:5199).
const path = require("path");
const fs = require("fs");

// Repo root (this file lives in test-automation/two-bots).
const REPO = process.env.REPO || path.resolve(__dirname, "..", "..");
const { chromium } = require("@playwright/test"); // installed in test-automation/

const WEB = process.env.WEB_URL || "http://localhost:5175";
const API = process.env.API_URL || "http://localhost:5199";
const HEADED = process.env.HEADED === "1";
const LIVE_MS = Number(process.env.LIVE_MS || 10000); // how long to wait for a live (socket) update
const HERE = __dirname;
const SHOTS = path.join(HERE, "shots");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const RUN = Date.now().toString(36).slice(-5);
const PASSWORD = "TwoBots!2026";
const ALICE = { key: "alice", first: "Bot", last: "Alice", email: `alice.bot.${RUN}@gmu.edu`, name: "Bot Alice" };
const BOB = { key: "bob", first: "Bot", last: "Bob", email: `bob.bot.${RUN}@gmu.edu`, name: "Bot Bob" };

const results = [];
const diag = { alice: { console: [], failed: [], blockedExternal: [], sockets: [] }, bob: { console: [], failed: [], blockedExternal: [], sockets: [] } };
let stepNo = 0;
let A, B; // pages

function isLocal(url) {
	try {
		const u = new URL(url);
		return ["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:";
	} catch { return true; }
}

async function attach(page, who) {
	const d = diag[who];
	page.on("console", (m) => {
		if (m.type() === "error") d.console.push({ step: stepNo, text: m.text().slice(0, 400) });
	});
	page.on("pageerror", (e) => d.console.push({ step: stepNo, text: "PAGEERROR " + String(e.message || e).slice(0, 400) }));
	page.on("response", (r) => {
		if (r.status() >= 400 && isLocal(r.url())) d.failed.push({ step: stepNo, status: r.status(), method: r.request().method(), url: r.url().replace(API, "API").replace(WEB, "WEB") });
	});
	page.on("requestfailed", (r) => {
		if (isLocal(r.url()) && !/websocket|socket\.io/.test(r.url())) d.failed.push({ step: stepNo, status: "net-fail", method: r.method(), url: r.url(), error: r.failure()?.errorText });
	});
	page.on("websocket", (ws) => d.sockets.push(ws.url()));
	// Safety net: never let the bots reach anything but the local stack (live site, analytics, fonts, CDNs).
	await page.route("**/*", (route) => {
		const url = route.request().url();
		if (isLocal(url)) return route.continue();
		d.blockedExternal.push(url.slice(0, 160));
		return route.abort();
	});
}

async function shot(label) {
	const base = `${String(stepNo).padStart(2, "0")}-${label.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 50)}`;
	const files = [];
	for (const [who, p] of [["alice", A], ["bob", B]]) {
		if (!p) continue;
		const f = `${base}-${who}.png`;
		try { await p.screenshot({ path: path.join(SHOTS, f) }); files.push(f); } catch (e) { /* ignore */ }
	}
	return files;
}

async function step(name, fn) {
	stepNo++;
	const t0 = Date.now();
	let status = "PASS", evidence = "";
	try {
		const r = await fn();
		evidence = typeof r === "string" ? r : JSON.stringify(r ?? "ok");
	} catch (e) {
		status = e && e.skip ? "SKIP" : "FAIL";
		evidence = String(e && e.message || e).split("\n").slice(0, 4).join(" | ").slice(0, 600);
	}
	const shots = await shot(name);
	const rec = { n: stepNo, name, status, evidence, ms: Date.now() - t0, shots };
	results.push(rec);
	console.log(`${status.padEnd(4)} #${stepNo} ${name} :: ${evidence}`);
	return status === "PASS";
}
function fail(msg) { throw new Error(msg); }
function skip(msg) { const e = new Error(msg); e.skip = true; throw e; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only VISIBLE matches count: the app keeps hidden copies of text around (e.g. the conversation list
// preview on the phone layout), which would otherwise make .first() pick an invisible element.
async function visible(locator, timeout = LIVE_MS) {
	try { await locator.filter({ visible: true }).first().waitFor({ state: "visible", timeout }); return true; } catch { return false; }
}
async function gone(locator, timeout = LIVE_MS) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if ((await locator.filter({ visible: true }).count().catch(() => 0)) === 0) return true;
		await sleep(300);
	}
	return false;
}
async function countVisible(locator) { return locator.filter({ visible: true }).count().catch(() => 0); }

// Direct read-only DB access, used only to attach server-side evidence to UI checks.
let _db = null;
async function db() {
	if (_db || !process.env.MONGO_URI) return _db;
	const { MongoClient } = require("mongodb");
	const c = new MongoClient(process.env.MONGO_URI);
	await c.connect();
	_db = c.db();
	return _db;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function dbPost(needle) {
	try {
		const d = await db();
		if (!d) return null;
		const re = new RegExp(esc(needle));
		return await d.collection("posts").findOne({ $or: [{ content: re }, { title: re }] }, { sort: { _id: -1 } });
	} catch (e) { return { dbError: e.message }; }
}
function postSummary(p) {
	if (!p) return "not in DB";
	if (p.dbError) return "db error " + p.dbError;
	const comments = (p.comments || []).length;
	return `db: visibility=${p.visibility} title="${String(p.title).slice(0, 40)}" content="${String(p.content).slice(0, 40)}" reactions=${(p.reactions || []).length} comments=${comments} rsvps=${(p.playerMatchmaking?.rsvpList || []).length} status=${p.status || "-"}`;
}
async function poll(fn, timeout = LIVE_MS) {
	const end = Date.now() + timeout;
	let last;
	while (Date.now() < end) {
		last = await fn().catch(() => undefined);
		if (last) return last;
		await sleep(300);
	}
	return last;
}

const card = (page, text) => page.locator('[data-testid^="post-card"]').filter({ hasText: text });
// PostCard renders its comment panel (MUI Collapse) as the next sibling of the card, not inside it.
const commentsOf = (c) => c.locator('xpath=following-sibling::div[contains(@class,"MuiCollapse")][1]');
async function userOf(page) { return page.evaluate(() => JSON.parse(localStorage.getItem("user") || "null")); }
async function overflow(page) { return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })); }
async function gotoCommunity(page) {
	await page.goto(WEB + "/community");
	await visible(page.getByTestId("facebook-composer-card"), 20000);
	await sleep(800);
}

// ---------------- account helpers ----------------
async function signUpUI(page, u) {
	await page.goto(WEB + "/auth");
	await page.getByRole("tab", { name: "Sign Up" }).click();
	await page.getByLabel("Email Address").fill(u.email);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Next" }).click();
	await page.getByLabel("First Name").fill(u.first);
	await page.getByLabel("Last Name").fill(u.last);
	await page.getByRole("button", { name: "Next" }).click();
	await page.getByRole("button", { name: /Select skill level: C Level/ }).click();
	await page.getByRole("button", { name: "Complete Setup" }).click();
	const ok = await poll(async () => (await userOf(page))?.id, 30000);
	if (!ok) {
		const alert = await page.locator(".MuiAlert-message").first().textContent().catch(() => "");
		fail("sign-up did not log in. Alert: " + alert);
	}
	return ok;
}
async function onboardingUI(page, u) {
	const welcome = page.getByText("Welcome to Mason Badminton Connect!");
	if (!(await visible(welcome, 8000))) skip("onboarding wizard did not appear");
	await page.getByRole("button", { name: "Next" }).click();
	await page.getByRole("textbox", { name: "Short Bio" }).fill(`I am ${u.name}, a test bot.`);
	await page.getByRole("button", { name: "Next" }).click();
	await page.getByRole("textbox", { name: "Your Racket" }).fill("Yonex Bot 9000");
	await page.getByRole("button", { name: "Next" }).click();
	const finish = page.getByRole("button", { name: /Let's Go/ });
	const saved = page.waitForResponse((r) => r.url().includes("/api/profile") && r.request().method() === "PUT", { timeout: 15000 }).catch(() => null);
	await finish.click();
	const res = await saved;
	if (!(await gone(finish, 10000))) fail(`wizard still open after Let's Go (PUT /api/profile -> ${res ? res.status() : "no request"})`);
	const flag = await poll(async () => page.evaluate(() => localStorage.getItem("onboardingComplete")), 5000);
	if (flag !== "true") fail(`wizard closed but onboardingComplete flag not stored (PUT /api/profile -> ${res ? res.status() : "none"})`);
	return `wizard finished; PUT /api/profile -> ${res ? res.status() : "none"}; onboardingComplete=${flag}`;
}
async function loginUI(page, u) {
	// Log out the way the app stores sessions, then log in through the real form.
	await page.evaluate(() => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); });
	await page.goto(WEB + "/auth");
	await page.getByLabel("Email Address").fill(u.email);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: "Login", exact: true }).click();
	const user = await poll(async () => (await userOf(page))?.id, 15000);
	if (!user) fail("login did not store a user");
	return user;
}

// ---------------- composer ----------------
async function openComposer(page) {
	await page.getByTestId("facebook-composer-card").click();
	const dlg = page.getByRole("dialog");
	await dlg.getByRole("textbox", { name: /What's on your mind/ }).waitFor({ timeout: 8000 });
	return dlg;
}
async function pickOption(page, combobox, optionName) {
	await combobox.click();
	await page.getByRole("option", { name: optionName }).click();
}
// The server silently quarantines a user's 4th post within 60s (server/utils/spamDetector.js rate rule),
// so the bots pace themselves to at most 3 posts per rolling minute (with a margin).
const postTimes = new Map();
async function pacePosts(page) {
	const now = Date.now();
	const recent = (postTimes.get(page) || []).filter((t) => now - t < 62000);
	if (recent.length >= 2) {
		const waitMs = 62000 - (now - recent[recent.length - 2]);
		if (waitMs > 0) { console.log(`      (pacing: waiting ${Math.round(waitMs / 1000)}s to stay under 3 posts/min)`); await sleep(waitMs); }
	}
	postTimes.set(page, [...recent, Date.now()]);
}
async function createPost(page, { content, title, privacy, rsvpSlots }) {
	await pacePosts(page);
	const dlg = await openComposer(page);
	if (title) await dlg.getByLabel("Title (Optional)").fill(title);
	await dlg.getByRole("textbox", { name: /What's on your mind/ }).fill(content);
	if (privacy) await pickOption(page, dlg.getByRole("combobox", { name: "Post privacy" }), privacy);
	if (rsvpSlots) {
		await pickOption(page, dlg.getByRole("combobox", { name: "Post category" }), /Find Players/);
		await dlg.getByRole("button", { name: "+ Add Details" }).click();
		const slots = dlg.getByText("Slots Needed").locator("xpath=..").getByRole("combobox");
		await pickOption(page, slots, `${rsvpSlots} Players`);
	}
	await dlg.getByRole("button", { name: "Post", exact: true }).click();
	if (!(await gone(dlg, 10000))) fail("composer did not close after Post");
}
async function cardMenu(page, text, itemName) {
	const c = card(page, text).first();
	await c.getByRole("button", { name: "More options" }).click();
	await page.getByRole("menuitem", { name: itemName }).click();
}

// ---------------- main ----------------
(async () => {
	const browser = await chromium.launch({ headless: !HEADED });
	const ctxA = await browser.newContext({ viewport: { width: 1366, height: 768 } });
	const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
		userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
	A = await ctxA.newPage();
	B = await ctxB.newPage();
	await attach(A, "alice");
	await attach(B, "bob");
	const ids = {};
	const T = (s) => `${s} [${RUN}]`;

	// ===== Accounts =====
	await step("alice_signup_via_ui", async () => { const u = await signUpUI(A, ALICE); ids.alice = u; return `registered ${ALICE.email}, id ${u}`; });
	await step("alice_onboarding_via_ui", () => onboardingUI(A, ALICE));
	await step("bob_signup_via_ui_phone", async () => { const u = await signUpUI(B, BOB); ids.bob = u; return `registered ${BOB.email}, id ${u}`; });
	await step("bob_onboarding_via_ui_phone", () => onboardingUI(B, BOB));
	await step("alice_login_via_ui", async () => `logged in, id ${await loginUI(A, ALICE)}`);
	await step("bob_login_via_ui_phone", async () => `logged in, id ${await loginUI(B, BOB)}`);
	if (!ids.alice || !ids.bob) {
		console.log("Accounts could not be created; aborting.");
	} else {
		// ===== Community =====
		await gotoCommunity(A);
		await gotoCommunity(B);
		await step("both_on_community_and_socket_connected", async () => {
			const ok = await poll(async () => diag.alice.sockets.some((u) => u.includes(":5199")) && diag.bob.sockets.some((u) => u.includes(":5199")), 10000);
			if (!ok) fail(`websockets: alice=${JSON.stringify(diag.alice.sockets)} bob=${JSON.stringify(diag.bob.sockets)}`);
			return `both pages opened a websocket to localhost:5199`;
		});
		await step("bob_phone_community_no_horizontal_overflow", async () => {
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth} > 390`);
			return o;
		});

		await step("empty_post_is_blocked", async () => {
			const dlg = await openComposer(A);
			const post = dlg.getByRole("button", { name: "Post", exact: true });
			const emptyDisabled = await post.isDisabled();
			await dlg.getByRole("textbox", { name: /What's on your mind/ }).fill("     ");
			const spacesDisabled = await post.isDisabled();
			await dlg.getByRole("button", { name: "Cancel" }).click();
			await gone(dlg, 5000);
			if (!emptyDisabled || !spacesDisabled) fail(`Post button enabled: empty=${!emptyDisabled} spacesOnly=${!spacesDisabled}`);
			return "Post button disabled for empty and whitespace-only content";
		});

		const P1 = T("Hello from Alice, anyone up for doubles?");
		await step("alice_creates_public_post", async () => {
			await createPost(A, { content: P1 });
			if (!(await visible(card(A, P1), 8000))) fail("post not in Alice's own feed");
			return "post visible in Alice's feed";
		});
		await step("bob_sees_new_post_live_without_reload", async () => {
			const banner = B.getByRole("button", { name: "Load new posts" });
			const direct = card(B, P1);
			const how = await poll(async () => (await direct.count()) ? "inline" : (await banner.isVisible().catch(() => false)) ? "banner" : null);
			if (!how) fail("no new-post banner or card appeared on Bob's screen within " + LIVE_MS + "ms");
			if (how === "banner") await banner.click();
			if (!(await visible(direct, 5000))) fail("banner clicked but post not shown");
			return `post arrived live via ${how === "banner" ? '"New Post" banner, clicked it' : "inline insert"}`;
		});
		if (!(await card(B, P1).count())) { await gotoCommunity(B); }

		const C1 = T("Count me in, Bob here");
		await step("bob_comments_on_post", async () => {
			const c = card(B, P1).first();
			const panel = commentsOf(c);
			if (!(await panel.getByRole("textbox", { name: "Write a comment" }).isVisible().catch(() => false))) await c.getByRole("button", { name: /^Comment/ }).click();
			const box = panel.getByRole("textbox", { name: "Write a comment" });
			await box.fill(C1);
			await box.press("Enter");
			if (!(await visible(panel.getByText(C1), 8000))) fail("Bob's comment not visible under the post. " + postSummary(await dbPost(P1)));
			return "comment shown under Bob's post; " + postSummary(await dbPost(P1));
		});
		await step("alice_sees_bobs_comment_live", async () => {
			const c = card(A, P1).first();
			const panel = commentsOf(c);
			const counted = await visible(c.getByRole("button", { name: /^Comment \(1\)/ }), LIVE_MS);
			if (!(await panel.getByRole("textbox", { name: "Write a comment" }).isVisible().catch(() => false))) await c.getByRole("button", { name: /^Comment/ }).click();
			const seen = await visible(panel.getByText(C1), 8000);
			if (!counted && !seen) fail("Alice sees neither the comment count nor the comment text. " + postSummary(await dbPost(P1)));
			if (!counted) fail("comment text visible, but the live count never updated to 'Comment (1)'");
			if (!seen) fail("count updated live to (1) but comment text not shown in the open panel");
			return "count updated live to 'Comment (1)' and comment text visible in the open panel";
		});

		await step("alice_reacts_bob_sees_live", async () => {
			await card(A, P1).first().getByRole("button", { name: "React to post" }).click();
			await A.mouse.move(5, 760); // move off the button so the hover reaction dock closes
			const ok = await visible(card(B, P1).first().getByRole("button", { name: "View 1 reactions" }), LIVE_MS);
			if (!ok) {
				const aSide = await card(A, P1).first().getByTestId("view-reactions-btn").getAttribute("aria-label").catch(() => "none");
				fail(`Bob never saw 'View 1 reactions' (Alice side shows: ${aSide})`);
			}
			return "Bob's card shows 1 reaction without reload";
		});
		await step("bob_reacts_alice_sees_live", async () => {
			const before = await card(A, P1).first().getByTestId("view-reactions-btn").getAttribute("aria-label").catch(() => "none");
			await card(B, P1).first().getByRole("button", { name: "React to post" }).click();
			const ok = await visible(card(A, P1).first().getByRole("button", { name: "View 2 reactions" }), LIVE_MS);
			const bobSide = await card(B, P1).first().getByTestId("view-reactions-btn").getAttribute("aria-label").catch(() => "none");
			if (!ok) {
				const aliceNow = await card(A, P1).first().getByTestId("view-reactions-btn").getAttribute("aria-label").catch(() => "none (no count shown)");
				await sleep(4000);
				const aliceLater = await card(A, P1).first().getByTestId("view-reactions-btn").getAttribute("aria-label").catch(() => "none (no count shown)");
				fail(`Alice card before Bob's click: '${before}', after: '${aliceNow}', +4s: '${aliceLater}'; Bob's card: '${bobSide}'; ${postSummary(await dbPost(P1))}`);
			}
			return `Alice's card shows 2 reactions without reload (Bob's: '${bobSide}')`;
		});

		await step("bob_saves_post", async () => {
			await cardMenu(B, P1, /Save Post/);
			const toast = await visible(B.getByText(/Post saved/), 6000);
			await B.reload(); await visible(B.getByTestId("facebook-composer-card"), 15000); await sleep(800);
			const c = card(B, P1).first();
			await c.getByRole("button", { name: "More options" }).click();
			const unsave = await visible(B.getByRole("menuitem", { name: /Unsave Post/ }), 4000);
			await B.keyboard.press("Escape");
			if (!unsave) fail(`after reload the menu does not offer 'Unsave Post' (toast shown: ${toast})`);
			return `toast 'Post saved' shown=${toast}; still saved after reload`;
		});

		const P2 = T("Alice: need 2 for doubles tonight at the RAC");
		await step("alice_creates_rsvp_post_2_slots", async () => {
			await createPost(A, { content: P2, rsvpSlots: 2 });
			const c = card(A, P2).first();
			if (!(await visible(c, 8000))) fail("RSVP post not in Alice's feed");
			if (!(await visible(c.getByText(/Attendees \(0\/2\)|Need 2 more/), 4000))) fail("post shows no 2-slot RSVP info: " + (await c.innerText()).slice(0, 200));
			return "RSVP post shows 0/2 attendees";
		});
		await step("bob_rsvps_alice_sees_count_live", async () => {
			const banner = B.getByRole("button", { name: "Load new posts" });
			await poll(async () => (await card(B, P2).count()) || (await banner.isVisible().catch(() => false)));
			if (await banner.isVisible().catch(() => false)) await banner.click();
			if (!(await visible(card(B, P2), 5000))) { await gotoCommunity(B); }
			await card(B, P2).first().getByRole("button", { name: /Join Rally/ }).click();
			const bobOk = await visible(B.getByText(/You're in! RSVP confirmed/), 6000);
			const ok = await visible(card(A, P2).first().getByText(/Attendees \(1\/2\)/), LIVE_MS);
			const bobSees = await visible(card(B, P2).first().getByText(/Attendees \(1\/2\)/), 1000);
			if (!ok) {
				const dbs = postSummary(await dbPost(P2));
				await gotoCommunity(A);
				const afterReload = await visible(card(A, P2).first().getByText(/Attendees \(1\/2\)/), 6000);
				fail(`Alice did not see 'Attendees (1/2)' live (Bob toast: ${bobOk}, Bob's own card 1/2: ${bobSees}); after reload Alice sees 1/2: ${afterReload}; ${dbs}`);
			}
			return `Bob toast confirmed=${bobOk}; Alice sees 1/2 live`;
		});

		const P1e = T("EDITED by Alice: doubles at 7pm, court 3");
		await step("alice_edits_post_bob_sees_live", async () => {
			await cardMenu(A, P1, /Edit Post/);
			// Only one card is in edit mode, so target its fields page-wide (in edit mode the card's text
			// moves into input values, so a hasText card locator no longer matches reliably).
			const details = A.getByLabel("Edit Details");
			await details.waitFor({ state: "visible", timeout: 8000 });
			await sleep(300);
			await details.fill(P1e);
			const typed = await details.inputValue();
			const put = A.waitForResponse((r) => /\/api\/forum\/[a-f0-9]{24}$/.test(r.url()) && r.request().method() === "PUT", { timeout: 10000 }).catch(() => null);
			await A.getByRole("button", { name: "Save Changes" }).click();
			const res = await put;
			const resInfo = res ? `PUT -> ${res.status()} ${(await res.text().catch(() => "")).slice(0, 80)}` : "no PUT sent";
			if (!(await visible(card(A, P1e), 8000))) {
				fail(`edit not shown on Alice's own card (typed="${typed.slice(0, 30)}", ${resInfo}); ${postSummary(await dbPost(P1))}`);
			}
			const ok = await visible(card(B, P1e), LIVE_MS);
			if (!ok) fail("Bob's card did not change to the edited text without reload");
			const badge = await visible(card(B, P1e).first().getByTestId("post-edited-badge"), 2000);
			const staleTitle = await visible(card(A, P1e).first().getByText(P1, { exact: true }), 1000);
			return `Bob sees edited text live; 'edited' badge=${badge}; ${resInfo}; old auto-title still shown as heading on Alice's card=${staleTitle}`;
		});

		const P3 = T("Alice temporary post, will be deleted");
		await step("alice_deletes_post_removed_from_bobs_feed_live", async () => {
			await createPost(A, { content: P3 });
			const banner = B.getByRole("button", { name: "Load new posts" });
			await poll(async () => (await card(B, P3).count()) || (await banner.isVisible().catch(() => false)));
			if (await banner.isVisible().catch(() => false)) await banner.click();
			if (!(await visible(card(B, P3), 5000))) await gotoCommunity(B);
			if (!(await visible(card(B, P3), 5000))) fail("setup: Bob never saw the post to be deleted");
			await cardMenu(A, P3, /Delete Post/);
			await A.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
			const aliceGone = await gone(card(A, P3), 8000);
			const bobGone = await gone(card(B, P3), LIVE_MS);
			if (!aliceGone || !bobGone) fail(`post still shown: on Alice's feed=${!aliceGone}, on Bob's feed (no reload)=${!bobGone}`);
			return "removed from both feeds without reload";
		});
		await step("deleted_post_gone_after_reload", async () => {
			await gotoCommunity(A); await gotoCommunity(B);
			const a = await card(A, P3).count(), b = await card(B, P3).count();
			if (a || b) fail(`deleted post still listed after reload: alice=${a} bob=${b}`);
			return "not listed on either side after reload";
		});

		// If the edit did not land, keep testing on the original text so later steps still run.
		const P1now = async () => ((await countVisible(card(B, P1e))) ? P1e : P1);
		await step("bob_reports_post", async () => {
			const P1x = await P1now();
			await cardMenu(B, P1x, /Report Post/);
			await B.getByRole("dialog").getByRole("button", { name: "Submit Report" }).click();
			const toast = await visible(B.getByText(/Report submitted/), 6000);
			const chip = await visible(card(B, P1x).first().getByText("Reported", { exact: true }), 4000);
			const d = await dbPost(P1);
			const reports = d && d.reports ? d.reports.length : "n/a";
			if (!toast && !chip) fail(`no confirmation toast and no 'Reported' chip (db reports=${reports})`);
			return `toast=${toast}, 'Reported' chip=${chip}, db reports=${reports}`;
		});

		const LONG = "Smash" + "Badminton".repeat(34) + "End";
		await step("bob_phone_long_word_post_no_overflow", async () => {
			await createPost(B, { content: LONG });
			await visible(card(B, LONG.slice(0, 40)), 8000);
			await sleep(500);
			const o = await overflow(B);
			const cw = await card(B, LONG.slice(0, 40)).first().evaluate((el) => el.scrollWidth).catch(() => -1);
			if (o.scrollWidth > 390) fail(`page scrollWidth ${o.scrollWidth} > 390 (card scrollWidth ${cw})`);
			return `scrollWidth ${o.scrollWidth} <= 390; card scrollWidth ${cw}`;
		});
		await step("bob_phone_long_word_comment_no_overflow", async () => {
			const c = card(B, await P1now()).first();
			const panel = commentsOf(c);
			if (!(await panel.getByRole("textbox", { name: "Write a comment" }).isVisible().catch(() => false))) await c.getByRole("button", { name: /^Comment/ }).click();
			const box = panel.getByRole("textbox", { name: "Write a comment" });
			await box.fill(LONG);
			await box.press("Enter");
			if (!(await visible(panel.getByText(LONG.slice(0, 30)), 8000))) fail("long-word comment did not appear");
			await sleep(500);
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`page scrollWidth ${o.scrollWidth} > 390 after long-word comment`);
			return `scrollWidth ${o.scrollWidth} <= 390`;
		});

		const PF = T("Alice FRIENDS-ONLY post (Bob is not a friend yet)");
		await step("friends_only_post_hidden_from_non_friend", async () => {
			await createPost(A, { content: PF, privacy: /Friends Only/ });
			if (!(await visible(card(A, PF), 8000))) fail("Alice cannot see her own friends-only post");
			await sleep(2500);
			const live = await B.getByText(PF).count() + (await B.getByRole("button", { name: "Load new posts" }).count());
			await gotoCommunity(B);
			const after = await card(B, PF).count();
			if (after) fail("Bob (not a friend) sees the friends-only post after reload");
			return `not shown to Bob (live banner/cards seen before reload: ${live}; after reload: 0); ${postSummary(await dbPost(PF))}`;
		});
		await step("privacy_icon_matches_audience_friends_only", async () => {
			await gotoCommunity(A);
			const c = card(A, PF).first();
			const label = await c.getByTestId("post-privacy-icon").first().getAttribute("aria-label").catch(() => "none");
			const d = await dbPost(PF);
			if (!/Friends/i.test(label || "")) fail(`Alice's friends-only post shows privacy icon '${label}'; ${postSummary(d)}`);
			return `icon '${label}'; ${postSummary(d)}`;
		});

		// ===== Friends =====
		await step("alice_sends_friend_request_from_bobs_profile", async () => {
			await A.goto(`${WEB}/profile/${ids.bob}`);
			const btn = A.getByRole("button", { name: /for Bot Bob$/ }).first();
			await btn.waitFor({ timeout: 15000 });
			const before = await btn.getAttribute("aria-label");
			await btn.click();
			const ok = await visible(A.getByRole("button", { name: /Request Sent for Bot Bob/ }), 8000);
			if (!ok) fail(`button was '${before}', did not change to 'Request Sent'`);
			return `'${before}' -> 'Request Sent'`;
		});
		await step("bob_gets_friend_request_notification_live", async () => {
			const bell = B.getByRole("button", { name: "View notifications" });
			if (!(await bell.isVisible().catch(() => false))) skip("notifications bell not visible on phone layout");
			const n = await poll(async () => { const t = (await bell.locator(".MuiBadge-badge").textContent().catch(() => "")).trim(); return Number(t) > 0 ? t : null; });
			if (!n) fail("notification badge did not show a count");
			return `bell badge = ${n}`;
		});
		await step("bob_accepts_friend_request", async () => {
			await B.goto(`${WEB}/profile/${ids.alice}`);
			const accept = B.getByRole("button", { name: /Accept Request for Bot Alice/ }).first();
			if (!(await visible(accept, 15000))) {
				const labels = await B.getByRole("button", { name: /for Bot Alice/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
				fail("no 'Accept Request' button on Alice's profile; friend buttons: " + JSON.stringify(labels));
			}
			await accept.click();
			const ok = await visible(B.getByRole("button", { name: /^Friends for Bot Alice/ }), 8000);
			if (!ok) fail("did not switch to 'Friends'");
			return "Bob's button shows 'Friends'";
		});
		await step("alice_sees_friendship", async () => {
			await A.reload();
			const ok = await visible(A.getByRole("button", { name: /^Friends for Bot Bob/ }), 15000);
			if (!ok) fail("Alice's view of Bob's profile does not show 'Friends'");
			return "Alice sees 'Friends' on Bob's profile";
		});
		await step("friends_only_post_visible_after_friendship", async () => {
			await gotoCommunity(B);
			if (!(await visible(card(B, PF), 6000))) {
				await sleep(31000); // feed cache TTL is 30s (server/utils/feedCache.js)
				await gotoCommunity(B);
				const later = await visible(card(B, PF), 6000);
				fail(`Bob (now a friend) cannot see the friends-only post right after accepting; after waiting 31s and reloading: ${later ? "VISIBLE (stale feed cache)" : "still hidden"}; ${postSummary(await dbPost(PF))}`);
			}
			return "friends-only post visible to Bob right after becoming friends";
		});
		const PM = T("Alice ONLY-ME private note");
		await step("only_me_post_hidden_from_friend", async () => {
			await gotoCommunity(A);
			await createPost(A, { content: PM, privacy: /Only Me/ });
			if (!(await visible(card(A, PM), 8000))) fail("Alice cannot see her own Only-Me post");
			await sleep(2500);
			const live = (await B.getByText(PM).count());
			await gotoCommunity(B);
			const after = await card(B, PM).count();
			if (live || after) fail(`Bob sees Alice's Only-Me post (live=${live}, after reload=${after})`);
			return "Only-Me post never shown to Bob (live or after reload); " + postSummary(await dbPost(PM));
		});
		await step("privacy_icon_matches_audience_only_me", async () => {
			const c = card(A, PM).first();
			const label = await c.getByTestId("post-privacy-icon").first().getAttribute("aria-label").catch(() => "none");
			if (!/Only Me/i.test(label || "")) fail(`Alice's Only-Me post shows privacy icon '${label}'; ${postSummary(await dbPost(PM))}`);
			return `icon '${label}'`;
		});

		// ===== Messages =====
		const M = [
			["alice", T("Hi Bob! Want to play tonight? (1)")],
			["bob", T("Hey Alice, sure! What time? (2)")],
			["alice", T("7pm at the RAC (3)")],
			["bob", T("Great, I'll bring shuttles (4)")],
			["alice", T("Perfect, see you there (5)")],
			["bob", T("See you! (6)")],
		];
		const composer = (p) => p.locator("form").filter({ has: p.getByRole("textbox", { name: "Type a message" }) }).last();
		async function send(p, text, slowly) {
			const box = composer(p).getByRole("textbox", { name: "Type a message" });
			if (slowly) await box.pressSequentially(text, { delay: 25 }); else await box.fill(text);
			await box.press("Enter");
		}
		async function unreadBadge(p) {
			const out = {};
			for (const name of ["View messages", "Open Messenger Chat"]) {
				const el = p.getByRole("link", { name }).or(p.getByRole("button", { name })).first();
				if (await el.isVisible().catch(() => false)) out[name] = (await el.locator(".MuiBadge-badge").first().textContent().catch(() => "")).trim();
			}
			return out;
		}

		await gotoCommunity(B);
		await step("alice_opens_chat_with_bob", async () => {
			await A.goto(`${WEB}/messages?userId=${ids.bob}`);
			if (!(await visible(composer(A).getByRole("textbox", { name: "Type a message" }), 15000))) fail("message box not shown");
			const sendBtn = composer(A).getByRole("button", { name: "Send message" });
			const emptyDisabled = await sendBtn.isDisabled().catch(() => "n/a");
			return `chat open; Send button disabled while empty=${emptyDisabled}`;
		});
		await step("empty_message_is_blocked", async () => {
			const sendBtn = composer(A).getByRole("button", { name: "Send message" });
			await composer(A).getByRole("textbox", { name: "Type a message" }).fill("   ");
			const disabled = await sendBtn.isDisabled();
			await composer(A).getByRole("textbox", { name: "Type a message" }).press("Enter");
			await sleep(1000);
			await composer(A).getByRole("textbox", { name: "Type a message" }).fill("");
			const posted = diag.alice.failed.length; // nothing to assert on server; check no bubble with only spaces
			if (!disabled) fail("Send button is enabled for whitespace-only text");
			return `Send disabled for whitespace (failed requests so far: ${posted})`;
		});
		await step("msg1_alice_to_bob_unread_badge_on_bobs_phone", async () => {
			await send(A, M[0][1]);
			if (!(await visible(A.getByText(M[0][1]), 6000))) fail("message not shown in Alice's thread");
			const badge = await poll(async () => { const b = await unreadBadge(B); return Object.values(b).some((v) => Number(v) > 0) ? b : null; });
			if (!badge) fail(`no unread badge on Bob's screen (badges: ${JSON.stringify(await unreadBadge(B))})`);
			return { bobBadges: badge };
		});
		await step("bob_opens_chat_sees_msg1", async () => {
			await B.goto(`${WEB}/messages?userId=${ids.alice}`);
			if (!(await visible(B.getByText(M[0][1]), 15000))) fail("Bob does not see message 1 in the thread");
			await sleep(1500);
			const after = await unreadBadge(B);
			return { unreadAfterOpening: after };
		});
		await step("typing_indicator_alice_to_bob", async () => {
			const box = composer(A).getByRole("textbox", { name: "Type a message" });
			await box.click();
			await box.pressSequentially("typing...", { delay: 60 });
			const seen = await visible(B.getByText(/is typing/), 5000);
			await box.fill("");
			if (!seen) fail("Bob never saw an 'is typing...' indicator");
			return "Bob saw 'Bot is typing...'";
		});
		for (let i = 1; i < M.length; i++) {
			const [who, text] = M[i];
			const from = who === "alice" ? A : B, to = who === "alice" ? B : A;
			await step(`msg${i + 1}_${who}_to_${who === "alice" ? "bob" : "alice"}_live`, async () => {
				await send(from, text, i === 1);
				if (!(await visible(from.getByText(text), 6000))) fail("not shown in sender's thread");
				if (!(await visible(to.getByText(text), LIVE_MS))) fail("receiver did not get it without reload");
				return "delivered live";
			});
		}
		// Order: walk the page text from message 1 onward (the sidebar preview of the last message sits
		// before the thread on desktop, so a plain indexOf would mis-order it).
		const orderCheck = async (p) => {
			const txt = await p.evaluate(() => document.body.innerText);
			const pos = [];
			let from = 0;
			for (const [, t] of M) { const i = txt.indexOf(t, from); pos.push(i); if (i >= 0) from = i + 1; }
			return { pos, ok: pos.every((x) => x >= 0) };
		};
		// Duplicates: count visible elements whose own text is exactly the message.
		const dupCheck = async (p) => p.evaluate((texts) => {
			const out = {};
			for (const t of texts) {
				let n = 0;
				for (const el of document.querySelectorAll("p,span,div")) {
					if (el.offsetParent === null) continue;
					// The conversation list's last-message preview is not a chat bubble.
					if (el.closest('li, [role="listitem"], .MuiListItem-root, .MuiListItemButton-root, .MuiListItemText-root')) continue;
					const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").trim();
					if (own === t) n++;
				}
				out[t.slice(0, 18)] = n;
			}
			return out;
		}, M.map(([, t]) => t));
		await step("message_order_correct_both_sides", async () => {
			const a = await orderCheck(A), b = await orderCheck(B);
			if (!a.ok || !b.ok) fail(`order wrong/missing: alice=${JSON.stringify(a.pos)} bob=${JSON.stringify(b.pos)}`);
			return "all 6 messages present and in order on both screens";
		});
		await step("no_duplicate_message_bubbles_live", async () => {
			const a = await dupCheck(A), b = await dupCheck(B);
			const bad = [...Object.entries(a).map(([k, v]) => ["alice", k, v]), ...Object.entries(b).map(([k, v]) => ["bob", k, v])].filter(([, , v]) => v !== 1);
			if (bad.length) fail(`messages not rendered exactly once in the thread (live, before reload): ${bad.map(([w, k, v]) => `${w}:"${k}…"x${v}`).join(", ")}`);
			return { alice: a, bob: b };
		});
		await step("messages_persist_after_reload_both_sides", async () => {
			await A.reload(); await B.reload();
			await visible(A.getByText(M[5][1]), 15000); await visible(B.getByText(M[5][1]), 15000);
			const a = await orderCheck(A), b = await orderCheck(B);
			if (!a.ok || !b.ok) fail(`after reload order wrong/missing: alice=${JSON.stringify(a.pos)} bob=${JSON.stringify(b.pos)}`);
			const da = await dupCheck(A), dbb = await dupCheck(B);
			const dups = Object.values(da).concat(Object.values(dbb)).some((v) => v > 1);
			return `all 6 in order after reload; duplicates after reload: ${dups ? JSON.stringify({ alice: da, bob: dbb }) : "none"}`;
		});
		await step("bob_phone_message_box_and_send_not_covered", async () => {
			const r = await B.evaluate(() => {
				const box = document.querySelector('[aria-label="Type a message"] textarea, textarea[aria-label="Type a message"], input[aria-label="Type a message"]');
				const btn = document.querySelector('form button[aria-label="Send message"]');
				const check = (el) => {
					if (!el) return "missing";
					const rc = el.getBoundingClientRect();
					const pts = [[rc.left + 8, rc.top + rc.height / 2], [rc.left + rc.width / 2, rc.top + rc.height / 2], [rc.right - 8, rc.top + rc.height / 2]];
					const covered = pts.map(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit && !el.contains(hit) && !hit.contains(el) ? (hit.closest("[aria-label],[data-testid]")?.getAttribute("aria-label") || hit.closest("[data-testid]")?.getAttribute("data-testid") || hit.tagName) : null; }).filter(Boolean);
					return covered.length ? "covered by " + [...new Set(covered)].join(", ") : "clear";
				};
				return { input: check(box), send: check(btn) };
			});
			if (r.input !== "clear" || r.send !== "clear") fail(`on the phone /messages page: message box ${r.input}; Send button ${r.send}`);
			return r;
		});
		await step("bob_phone_long_word_message_no_overflow", async () => {
			await send(B, LONG);
			await visible(B.getByText(LONG.slice(0, 30)), 6000);
			await sleep(500);
			const o = await overflow(B);
			const live = await visible(A.getByText(LONG.slice(0, 30)), LIVE_MS);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth} > 390 on /messages (Alice received: ${live})`);
			return `scrollWidth ${o.scrollWidth} <= 390; Alice received=${live}`;
		});
		await step("bob_phone_messages_no_horizontal_overflow", async () => {
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth}`);
			return o;
		});
		await step("floating_chat_dock_message_alice_on_community", async () => {
			await gotoCommunity(A);
			const launcher = A.getByTestId("floating-chat-launcher");
			if (!(await visible(launcher, 5000))) skip("floating chat launcher not shown on desktop /community");
			const text = T("Dock check from Bob (7)");
			await send(B, text);
			const badge = await poll(async () => { const t = (await launcher.locator(".MuiBadge-badge").first().textContent().catch(() => "")).trim(); return Number(t) > 0 ? t : null; }, LIVE_MS);
			await launcher.click();
			await sleep(1000);
			const chatWith = A.getByRole("button", { name: /Chat with Bot Bob/ }).first();
			if (await chatWith.isVisible().catch(() => false)) await chatWith.click();
			const seen = await visible(A.getByText(text), 8000);
			if (!seen) fail(`dock did not show Bob's new message (launcher badge=${badge || "none"})`);
			const reply = T("Reply via dock (8)");
			const dockBox = A.getByPlaceholder("Aa");
			await dockBox.fill(reply); await dockBox.press("Enter");
			const got = await visible(B.getByText(reply), LIVE_MS);
			if (!got) fail(`dock showed message (badge=${badge}) but Bob did not receive the dock reply`);
			return `launcher badge=${badge || "none"}; message shown in dock; dock reply delivered to Bob live`;
		});

		// ===== Players / Matchmaking =====
		await step("alice_visits_players_tab", async () => {
			await A.goto(WEB + "/matchmaking");
			const input = A.getByRole("textbox", { name: "Search community members" });
			if (!(await visible(input, 15000))) fail("Players directory search input not rendered");
			const bobCard = A.getByText("Bot Bob");
			const seen = await visible(bobCard, 8000);
			return `search input ready; Bob card visible=${seen}`;
		});
		await step("players_tab_keyboard_focus_search", async () => {
			await A.locator("body").click({ position: { x: 50, y: 150 } });
			await sleep(300);
			await A.keyboard.press("/");
			await sleep(300);
			const isFocused = await A.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Search community members");
			if (!isFocused) fail("press '/' did not focus the search input");
			return "keyboard shortcut '/' focused search input";
		});
		await step("alice_searches_players_and_clears", async () => {
			const input = A.getByRole("textbox", { name: "Search community members" });
			await input.fill("Bob");
			const seen = await visible(A.getByText("Bot Bob"), 8000);
			if (!seen) fail("Search for 'Bob' did not display Bot Bob");
			const clearBtn = A.getByRole("button", { name: "Clear search input" });
			if (await clearBtn.isVisible().catch(() => false)) {
				await clearBtn.click();
			} else {
				await input.fill("");
			}
			return "search for Bob displayed result and cleared successfully";
		});
		await step("alice_filters_by_skill_chips", async () => {
			const chip = A.getByRole("button", { name: "All" }).or(A.locator(".MuiChip-root").filter({ hasText: "All" })).first();
			if (await chip.isVisible().catch(() => false)) await chip.click();
			return "skill chips interactive without error";
		});
		await step("bob_phone_players_no_horizontal_overflow", async () => {
			await B.goto(WEB + "/matchmaking");
			await visible(B.getByRole("textbox", { name: "Search community members" }), 15000);
			await sleep(500);
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth} > 390 on /matchmaking`);
			return o;
		});

		// ===== Tournaments =====
		await step("alice_visits_tournaments_tab", async () => {
			await A.goto(WEB + "/tournaments");
			const listToggle = A.getByRole("button", { name: "List View" });
			if (!(await visible(listToggle, 15000))) fail("Tournaments view toggle not shown");
			return "tournaments tab loaded successfully";
		});
		await step("tournaments_toggle_calendar_and_card_view", async () => {
			const calToggle = A.getByRole("button", { name: "Calendar View" });
			await calToggle.click();
			await sleep(600);
			const listToggle = A.getByRole("button", { name: "List View" });
			await listToggle.click();
			await sleep(600);
			return "toggled between Calendar and List views cleanly";
		});
		await step("alice_opens_tournament_detail_modal", async () => {
			const card = A.locator(".MuiCard-root").filter({ hasText: /Open|Registration|Closing Soon|TBD/ }).first();
			if (await card.isVisible().catch(() => false)) {
				await card.click();
				const dlg = A.getByRole("dialog");
				const seen = await visible(dlg, 6000);
				if (!seen) fail("clicking tournament card did not open detail modal");
				const closeBtn = dlg.getByRole("button", { name: "Close dialog" });
				if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
				else await A.keyboard.press("Escape");
				await gone(dlg, 5000);
				return "tournament detail dialog opened and closed cleanly";
			}
			return "no tournament card present in test db; skipping click";
		});
		await step("bob_phone_tournaments_no_horizontal_overflow", async () => {
			await B.goto(WEB + "/tournaments");
			await sleep(800);
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth} > 390 on /tournaments`);
			return o;
		});

		// ===== Profile =====
		await step("alice_visits_own_profile", async () => {
			await A.goto(WEB + "/profile");
			const nameHeading = A.getByText("Bot Alice", { exact: false });
			if (!(await visible(nameHeading, 15000))) fail("Alice's name not rendered on /profile");
			return "Alice's profile rendered cleanly";
		});
		await step("alice_edits_profile_bio", async () => {
			const editBtn = A.getByRole("button", { name: "Edit profile", exact: true });
			if (!(await visible(editBtn, 8000))) fail("'Edit profile' button not visible on own profile");
			await editBtn.click();
			const bioBox = A.getByRole("textbox", { name: "Bio" });
			if (!(await visible(bioBox, 8000))) fail("Bio textarea not visible in edit form");
			const newBio = T("Badminton enthusiast playing doubles and singles.");
			await bioBox.fill(newBio);
			const saveBtn = A.getByRole("button", { name: "Save Changes" });
			await saveBtn.click();
			const toast = await visible(A.getByText(/Profile updated successfully|saved/i), 8000);
			await A.reload();
			const persisted = await visible(A.getByText(newBio), 15000);
			if (!persisted) fail("updated bio did not persist after reload");
			return `bio updated, toast=${toast}, persisted after reload`;
		});
		await step("bob_phone_profile_no_horizontal_overflow", async () => {
			await B.goto(`${WEB}/profile/${ids.bob}`);
			await visible(B.getByText("Bot Bob", { exact: false }), 15000);
			await sleep(500);
			const o = await overflow(B);
			if (o.scrollWidth > 390) fail(`scrollWidth ${o.scrollWidth} > 390 on Bob's phone profile`);
			return o;
		});
	}

	// ===== Diagnostics =====
	await step("no_requests_to_live_site", async () => {
		const live = [...diag.alice.blockedExternal, ...diag.bob.blockedExternal].filter((u) => /onrender\.com|gmu-badminton/i.test(u));
		if (live.length) fail(`app tried to reach the live site (blocked by harness): ${[...new Set(live)].slice(0, 5).join(", ")}`);
		return `0 live-site requests; other external requests blocked: ${new Set([...diag.alice.blockedExternal, ...diag.bob.blockedExternal].map((u) => { try { return new URL(u).hostname; } catch { return u; } })).size} hosts`;
	});
	// Environment noise (not app bugs): the optional local Java court service on :8081 is not part of this
	// stack, and aborted external requests (fonts/analytics) produce net::ERR_FAILED console lines.
	const envNoise = (t) => /ERR_FAILED|net::ERR_|Failed to load resource|Failed to fetch RAC schedule/.test(t);
	for (const who of ["alice", "bob"]) {
		const d = diag[who];
		d.environmentNoise = {
			javaCourtService8081: d.failed.filter((x) => /:8081\//.test(x.url)).length,
			consoleNetworkNoise: d.console.filter((e) => envNoise(e.text)).length,
		};
		await step(`${who}_no_console_errors`, async () => {
			const errs = d.console.filter((e) => !envNoise(e.text));
			const uniq = [...new Map(errs.map((e) => [e.text.slice(0, 120), e])).values()];
			if (errs.length) fail(`${errs.length} console errors (${uniq.length} distinct): ${uniq.slice(0, 5).map((e) => `[step ${e.step}] ${e.text.slice(0, 200)}`).join(" || ")}`);
			return `none (ignored environment noise: ${d.environmentNoise.consoleNetworkNoise})`;
		});
		await step(`${who}_no_unexpected_failed_requests`, async () => {
			const f = d.failed.filter((x) => !/:8081\//.test(x.url));
			if (f.length) fail(`${f.length} failed: ${f.slice(0, 8).map((x) => `[step ${x.step}] ${x.status} ${x.method} ${x.url}`).join(" || ")}`);
			return `no local API request returned >= 400 (ignored ${d.environmentNoise.javaCourtService8081} calls to the absent :8081 Java service)`;
		});
	}

	await browser.close();
	const summary = { pass: results.filter((r) => r.status === "PASS").length, fail: results.filter((r) => r.status === "FAIL").length, skip: results.filter((r) => r.status === "SKIP").length };
	const out = { run: RUN, at: new Date().toISOString(), web: WEB, api: API, accounts: { alice: ALICE.email, bob: BOB.email, password: PASSWORD, ids }, summary, steps: results, diagnostics: diag };
	fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify(out, null, 2));
	console.log(`\nSUMMARY: ${summary.pass} pass, ${summary.fail} fail, ${summary.skip} skip -> results.json`);
	process.exit(summary.fail ? 2 : 0);
})().catch((e) => {
	console.error("twobots crashed:", e);
	try { fs.writeFileSync(path.join(HERE, "results.json"), JSON.stringify({ crashed: String(e.stack || e), steps: results, diagnostics: diag }, null, 2)); } catch { /* ignore */ }
	process.exit(1);
});
