// server/tests/linkPreview.test.js
require("dotenv").config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const dns = require("dns");

jest.mock("../utils/aiModeration", () => ({
	analyzeContent: jest.fn().mockResolvedValue({ isAppropriate: true, toxicityScore: 0, reason: "" }),
}));

const forumRoutes = require("../routes/forum");
const {
	scrapeLinkPreview,
	validateUrl,
	isPrivateOrBlockedIp,
	verifyDnsResolution,
	ssrfSafeLookup,
	ssrfHttpAgent,
	ssrfHttpsAgent,
	previewCache,
} = require("../utils/linkPreviewScraper");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const testUserId = "650000000000000000000099";
const testUserToken = jwt.sign(
	{ id: testUserId, userId: testUserId, role: "user", username: "PreviewTester", email: "preview@gmu.edu" },
	JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/forum", forumRoutes);

describe("SSRF-Safe Link Preview Scraper Service & API", () => {
	beforeEach(() => {
		previewCache.clear();
		jest.clearAllMocks();
	});

	describe("Unit: validateUrl", () => {
		it("accepts valid HTTP and HTTPS URLs on standard ports", () => {
			const u1 = validateUrl("http://example.com/badminton");
			expect(u1.hostname).toBe("example.com");

			const u2 = validateUrl("https://badminton.gmu.edu/tournaments?id=123");
			expect(u2.hostname).toBe("badminton.gmu.edu");

			const u3 = validateUrl("https://example.com:443/page");
			expect(u3.hostname).toBe("example.com");
			expect(u3.protocol).toBe("https:");
		});

		it("rejects non-string or empty input", () => {
			expect(() => validateUrl("")).toThrow("Invalid URL");
			expect(() => validateUrl(null)).toThrow("Invalid URL");
			expect(() => validateUrl(undefined)).toThrow("Invalid URL");
			expect(() => validateUrl("not a valid url format")).toThrow("Invalid URL format");
		});

		it("rejects forbidden protocols (file:, ftp:, javascript:, gopher:)", () => {
			expect(() => validateUrl("file:///etc/passwd")).toThrow("Forbidden protocol: file:");
			expect(() => validateUrl("ftp://ftp.example.com/file")).toThrow("Forbidden protocol: ftp:");
			expect(() => validateUrl("javascript:alert(1)")).toThrow("Forbidden protocol: javascript:");
		});

		it("rejects forbidden non-standard ports (e.g. 8080, 5000, 22, 6379)", () => {
			expect(() => validateUrl("http://example.com:8080/admin")).toThrow("Forbidden destination port: 8080");
			expect(() => validateUrl("https://example.com:5000/api")).toThrow("Forbidden destination port: 5000");
			expect(() => validateUrl("http://example.com:22/ssh")).toThrow("Forbidden destination port: 22");
			expect(() => validateUrl("http://example.com:6379/redis")).toThrow("Forbidden destination port: 6379");
		});

		it("rejects local and internal domain names (localhost, *.local, *.internal)", () => {
			expect(() => validateUrl("http://localhost/status")).toThrow("Forbidden hostname");
			expect(() => validateUrl("http://myhost.local/")).toThrow("Forbidden hostname");
			expect(() => validateUrl("https://db.internal/admin")).toThrow("Forbidden hostname");
		});
	});

	describe("Unit: isPrivateOrBlockedIp (SSRF IP Range Verification)", () => {
		it("blocks loopback addresses (127.0.0.0/8 and ::1)", () => {
			expect(isPrivateOrBlockedIp("127.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("127.0.0.2")).toBe(true);
			expect(isPrivateOrBlockedIp("127.255.255.255")).toBe(true);
			expect(isPrivateOrBlockedIp("::1")).toBe(true);
		});

		it("blocks RFC 1918 private IPv4 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
			// 10.0.0.0/8
			expect(isPrivateOrBlockedIp("10.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("10.254.1.1")).toBe(true);

			// 172.16.0.0/12
			expect(isPrivateOrBlockedIp("172.16.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("172.24.1.1")).toBe(true);
			expect(isPrivateOrBlockedIp("172.31.255.255")).toBe(true);

			// 192.168.0.0/16
			expect(isPrivateOrBlockedIp("192.168.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("192.168.1.100")).toBe(true);
		});

		it("blocks cloud metadata address (169.254.169.254 / link-local 169.254.0.0/16)", () => {
			expect(isPrivateOrBlockedIp("169.254.169.254")).toBe(true);
			expect(isPrivateOrBlockedIp("169.254.0.1")).toBe(true);
		});

		it("blocks Carrier-Grade NAT (100.64.0.0/10)", () => {
			expect(isPrivateOrBlockedIp("100.64.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("100.100.5.20")).toBe(true);
			expect(isPrivateOrBlockedIp("100.127.255.255")).toBe(true);
		});

		it("blocks IPv4-mapped IPv6 representations of private addresses", () => {
			expect(isPrivateOrBlockedIp("::ffff:127.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("::ffff:10.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("::ffff:169.254.169.254")).toBe(true);
			expect(isPrivateOrBlockedIp("::ffff:192.168.1.1")).toBe(true);
		});

		it("allows valid public Internet addresses", () => {
			expect(isPrivateOrBlockedIp("8.8.8.8")).toBe(false);
			expect(isPrivateOrBlockedIp("1.1.1.1")).toBe(false);
			expect(isPrivateOrBlockedIp("129.174.1.1")).toBe(false); // GMU domain IP
			expect(isPrivateOrBlockedIp("::ffff:8.8.8.8")).toBe(false);
			expect(isPrivateOrBlockedIp("2606:4700:4700::1111")).toBe(false);
		});

		it("blocks IPv6 transition ranges that can tunnel to internal IPv4 (NAT64, 6to4, IPv4-compatible)", () => {
			expect(isPrivateOrBlockedIp("64:ff9b::7f00:1")).toBe(true);
			expect(isPrivateOrBlockedIp("64:ff9b::169.254.169.254")).toBe(true);
			expect(isPrivateOrBlockedIp("2002:7f00:1::1")).toBe(true);
			expect(isPrivateOrBlockedIp("::127.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("::ffff:7f00:1")).toBe(true);
		});

		it("blocks 192.0.0.0/24 and 198.18.0.0/15 special-purpose IPv4 ranges", () => {
			expect(isPrivateOrBlockedIp("192.0.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("198.18.0.1")).toBe(true);
			expect(isPrivateOrBlockedIp("198.19.255.254")).toBe(true);
			expect(isPrivateOrBlockedIp("198.20.0.1")).toBe(false);
		});
	});

	describe("Unit: ssrfSafeLookup (connect-time DNS rebinding protection)", () => {
		it("rejects when the connect-time resolution returns a private IP", (done) => {
			jest.spyOn(dns, "lookup").mockImplementationOnce((host, opts, cb) =>
				cb(null, [{ address: "10.0.0.5", family: 4 }])
			);

			ssrfSafeLookup("rebind.example.com", {}, (err) => {
				expect(err).toBeTruthy();
				expect(err.message).toContain("SSRF Protection");
				done();
			});
		});

		it("rejects when ANY address in a multi-record answer is private", (done) => {
			jest.spyOn(dns, "lookup").mockImplementationOnce((host, opts, cb) =>
				cb(null, [
					{ address: "93.184.216.34", family: 4 },
					{ address: "::1", family: 6 },
				])
			);

			ssrfSafeLookup("dual.example.com", { all: true }, (err) => {
				expect(err.code).toBe("ESSRFBLOCKED");
				done();
			});
		});

		it("returns a single address or the full list (options.all) for public IPs", (done) => {
			const records = [{ address: "93.184.216.34", family: 4 }];
			jest.spyOn(dns, "lookup").mockImplementation((host, opts, cb) => cb(null, records));

			ssrfSafeLookup("example.com", {}, (err, address, family) => {
				expect(err).toBeNull();
				expect(address).toBe("93.184.216.34");
				expect(family).toBe(4);

				ssrfSafeLookup("example.com", { all: true }, (err2, list) => {
					expect(err2).toBeNull();
					expect(list).toEqual(records);
					dns.lookup.mockRestore();
					done();
				});
			});
		});

		it("is wired into the HTTP and HTTPS agents used by the scraper", () => {
			expect(ssrfHttpAgent.options.lookup).toBe(ssrfSafeLookup);
			expect(ssrfHttpsAgent.options.lookup).toBe(ssrfSafeLookup);
		});
	});

	describe("Unit: verifyDnsResolution", () => {
		it("throws SSRF error if DNS resolves to private loopback IP", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValueOnce([
				{ address: "127.0.0.1", family: 4 },
			]);

			await expect(verifyDnsResolution("malicious-subdomain.com")).rejects.toThrow(
				"SSRF Protection: Access to private or loopback network addresses is forbidden."
			);
		});

		it("throws SSRF error if any resolved IP in a multi-record answer is private", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValueOnce([
				{ address: "93.184.216.34", family: 4 },
				{ address: "10.0.0.1", family: 4 },
			]);

			await expect(verifyDnsResolution("dual-homed-target.com")).rejects.toThrow(
				"SSRF Protection"
			);
		});

		it("passes verification if all resolved IPs are public", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValueOnce([
				{ address: "93.184.216.34", family: 4 },
			]);

			await expect(verifyDnsResolution("example.com")).resolves.not.toThrow();
		});
	});

	describe("Unit: scrapeLinkPreview", () => {
		it("extracts OpenGraph title, description, image, and siteName from HTML", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);

			const mockHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<title>Standard Fallback Title</title>
						<meta property="og:title" content="2026 GMU Badminton Open Championships" />
						<meta property="og:description" content="Register now for the Mid-Atlantic premier collegiate tournament." />
						<meta property="og:image" content="https://badminton.gmu.edu/flyers/open2026.jpg" />
						<meta property="og:site_name" content="Mason Badminton Connect" />
					</head>
					<body>
						<h1>Tournament Details</h1>
					</body>
				</html>
			`;

			jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: mockHtml,
				headers: { "content-type": "text/html; charset=utf-8" },
			});

			const result = await scrapeLinkPreview("https://badminton.gmu.edu/tournaments/gmu-open-2026");

			expect(result.title).toBe("2026 GMU Badminton Open Championships");
			expect(result.description).toBe("Register now for the Mid-Atlantic premier collegiate tournament.");
			expect(result.image).toBe("https://badminton.gmu.edu/flyers/open2026.jpg");
			expect(result.siteName).toBe("Mason Badminton Connect");
			expect(result.domain).toBe("badminton.gmu.edu");
		});

		it("resolves relative image URLs against target URL", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);

			const mockHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta property="og:title" content="BWF Rules & Equipment" />
						<meta property="og:image" content="/assets/shuttle_banner.png" />
					</head>
				</html>
			`;

			jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: mockHtml,
				headers: { "content-type": "text/html" },
			});

			const result = await scrapeLinkPreview("https://badminton.org/rules");
			expect(result.image).toBe("https://badminton.org/assets/shuttle_banner.png");
		});

		it("falls back to standard title and meta description when OpenGraph tags are omitted", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);

			const mockHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<title>Equipment Discussion: Yonex Astrox 88D Pro</title>
						<meta name="description" content="Community review of string tension and balance." />
					</head>
				</html>
			`;

			jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: mockHtml,
				headers: { "content-type": "text/html" },
			});

			const result = await scrapeLinkPreview("https://badmintongear.com/rackets/astrox-88d");
			expect(result.title).toBe("Equipment Discussion: Yonex Astrox 88D Pro");
			expect(result.description).toBe("Community review of string tension and balance.");
		});

		it("caches preview responses and serves repeated requests without duplicate network calls", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);

			const mockHtml = `
				<html>
					<head>
						<title>Cached Title</title>
					</head>
				</html>
			`;

			const axiosSpy = jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: mockHtml,
				headers: { "content-type": "text/html" },
			});

			const first = await scrapeLinkPreview("https://example.com/cached-article");
			expect(first.title).toBe("Cached Title");
			expect(axiosSpy).toHaveBeenCalledTimes(1);

			// Second call should hit in-memory cache
			const second = await scrapeLinkPreview("https://example.com/cached-article");
			expect(second.title).toBe("Cached Title");
			expect(axiosSpy).toHaveBeenCalledTimes(1); // Not called again!
		});

		it("sends requests through the SSRF-safe agents with an overall abort signal", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);
			const axiosSpy = jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: "<html><head><title>Agent Check</title></head></html>",
				headers: { "content-type": "text/html" },
			});

			await scrapeLinkPreview("https://example.com/agent-check");
			const config = axiosSpy.mock.calls[0][1];
			expect(config.httpAgent).toBe(ssrfHttpAgent);
			expect(config.httpsAgent).toBe(ssrfHttpsAgent);
			expect(config.proxy).toBe(false);
			expect(config.signal).toBeInstanceOf(AbortSignal);
		});

		it("rejects non-HTML content types", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);
			jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: "{}",
				headers: { "content-type": "application/json" },
			});

			await expect(scrapeLinkPreview("https://example.com/api.json")).rejects.toThrow("Unsupported content type");
		});

		it("drops non-http(s) and oversized og:image URLs", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);
			jest.spyOn(axios, "get")
				.mockResolvedValueOnce({
					status: 200,
					data: '<html><head><meta property="og:title" content="X" /><meta property="og:image" content="javascript:alert(1)" /></head></html>',
					headers: { "content-type": "text/html" },
				})
				.mockResolvedValueOnce({
					status: 200,
					data: `<html><head><meta property="og:title" content="Y" /><meta property="og:image" content="https://cdn.example.com/${"a".repeat(2100)}.png" /></head></html>`,
					headers: { "content-type": "text/html" },
				});

			const jsImage = await scrapeLinkPreview("https://example.com/js-image");
			expect(jsImage.image).toBe("");
			expect(jsImage.imageUrl).toBe("");

			const longImage = await scrapeLinkPreview("https://example.com/long-image");
			expect(longImage.image).toBe("");
		});

		it("blocks attempts to scrape cloud metadata URL", async () => {
			await expect(scrapeLinkPreview("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
				"SSRF Protection"
			);
		});
	});

	describe("Integration: POST /api/forum/link-preview Endpoint", () => {
		it("returns 401 when no auth token is provided", async () => {
			const axiosSpy = jest.spyOn(axios, "get");
			const res = await request(app)
				.post("/api/forum/link-preview")
				.send({ url: "https://example.com/page" });

			expect(res.status).toBe(401);
			expect(axiosSpy).not.toHaveBeenCalled();
		});

		it("returns 400 if url is missing from request body", async () => {
			const res = await request(app).post("/api/forum/link-preview").set("Authorization", `Bearer ${testUserToken}`).send({});
			expect(res.status).toBe(400);
			expect(res.body.message).toContain("URL is required");
		});

		it("returns 400 if url violates SSRF security policy (loopback)", async () => {
			const res = await request(app)
				.post("/api/forum/link-preview")
				.set("Authorization", `Bearer ${testUserToken}`)
				.send({ url: "http://127.0.0.1:80/admin" });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("SSRF Protection");
		});

		it("returns 400 if url requests a forbidden port (e.g. 8080)", async () => {
			const res = await request(app)
				.post("/api/forum/link-preview")
				.set("Authorization", `Bearer ${testUserToken}`)
				.send({ url: "http://example.com:8080/page" });

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Forbidden destination port");
		});

		it("returns 200 with OpenGraph preview data for valid public URL", async () => {
			jest.spyOn(dns.promises, "lookup").mockResolvedValue([
				{ address: "93.184.216.34", family: 4 },
			]);

			const mockHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta property="og:title" content="NVBC Spring Tournament 2026" />
						<meta property="og:description" content="Singles and doubles flights in Ashburn, VA." />
						<meta property="og:image" content="https://nvbadminton.com/flyer.png" />
					</head>
				</html>
			`;

			jest.spyOn(axios, "get").mockResolvedValueOnce({
				status: 200,
				data: mockHtml,
				headers: { "content-type": "text/html" },
			});

			const res = await request(app)
				.post("/api/forum/link-preview")
				.set("Authorization", `Bearer ${testUserToken}`)
				.send({ url: "https://nvbadminton.com/tournaments/spring" });

			expect(res.status).toBe(200);
			expect(res.body.title).toBe("NVBC Spring Tournament 2026");
			expect(res.body.description).toBe("Singles and doubles flights in Ashburn, VA.");
			expect(res.body.image).toBe("https://nvbadminton.com/flyer.png");
			expect(res.body.domain).toBe("nvbadminton.com");
		});
	});
});
