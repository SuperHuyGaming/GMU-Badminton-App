// server/utils/linkPreviewScraper.js
const dns = require("dns");
const net = require("net");
const http = require("http");
const https = require("https");
const axios = require("axios");
const cheerio = require("cheerio");

// In-memory cache for scraped link previews (24-hour TTL, max 200 entries)
const previewCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const MAX_URL_LENGTH = 2048;
const SCRAPE_TOTAL_TIMEOUT_MS = 5000;
const SSRF_ERROR_MESSAGE = "SSRF Protection: Access to private or loopback network addresses is forbidden.";

/**
 * Converts an IPv4 dotted-quad string into a 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number}
 */
function ipv4ToInt(ip) {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
		return null;
	}
	return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Expands an IPv6 string (including embedded IPv4 tails and zone ids) into 8 numeric hextets.
 * @param {string} ip
 * @returns {number[] | null}
 */
function expandIpv6(ip) {
	let addr = ip.split("%")[0];
	const lastColon = addr.lastIndexOf(":");
	const tail = addr.slice(lastColon + 1);
	if (tail.includes(".")) {
		const v4 = ipv4ToInt(tail);
		if (v4 === null) return null;
		addr = `${addr.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
	}

	const halves = addr.split("::");
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(":") : [];
	const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	let parts = head;
	if (halves.length === 2) {
		const fill = 8 - head.length - rest.length;
		if (fill < 0) return null;
		parts = [...head, ...new Array(fill).fill("0"), ...rest];
	}
	if (parts.length !== 8) return null;

	const hextets = parts.map((p) => parseInt(p, 16));
	if (hextets.some((h) => isNaN(h) || h < 0 || h > 0xffff)) return null;
	return hextets;
}

/**
 * Checks a 32-bit IPv4 integer against loopback, private, link-local, CGNAT, benchmark and reserved ranges.
 * @param {number} intVal
 * @returns {boolean}
 */
function isBlockedIpv4Int(intVal) {
	// 0.0.0.0/8 (Broadcast/Current network)
	if ((intVal >>> 24) === 0) return true;

	// 10.0.0.0/8 (Private network)
	if ((intVal >>> 24) === 10) return true;

	// 100.64.0.0/10 (Shared address space / Carrier-Grade NAT: 100.64.0.0 - 100.127.255.255)
	if ((intVal >>> 22) === 401) return true;

	// 127.0.0.0/8 (Loopback)
	if ((intVal >>> 24) === 127) return true;

	// 169.254.0.0/16 (Link-local / Cloud metadata: AWS, GCP, Azure 169.254.169.254)
	if ((intVal >>> 16) === ((169 << 8) | 254)) return true;

	// 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
	if ((intVal >>> 20) === ((172 << 4) | 1)) return true;

	// 192.0.0.0/24 (IETF protocol assignments)
	if ((intVal >>> 8) === (192 << 16)) return true;

	// 192.168.0.0/16 (Private network)
	if ((intVal >>> 16) === ((192 << 8) | 168)) return true;

	// 198.18.0.0/15 (Network benchmarking: 198.18.0.0 - 198.19.255.255)
	if ((intVal >>> 17) === ((198 << 7) | (18 >>> 1))) return true;

	// 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved / Broadcast)
	if ((intVal >>> 28) >= 14) return true;

	return false;
}

/**
 * Checks if an IP is loopback, link-local, private, carrier-grade NAT, metadata, or an
 * IPv6 transition range that can tunnel to an internal IPv4 address.
 * @param {string} rawIp
 * @returns {boolean} true if IP is private or blocked
 */
function isPrivateOrBlockedIp(rawIp) {
	if (!rawIp || typeof rawIp !== "string") return true;

	const ip = rawIp.trim().toLowerCase();

	// IPv4 checks
	if (net.isIPv4(ip)) {
		const intVal = ipv4ToInt(ip);
		if (intVal === null) return true;
		return isBlockedIpv4Int(intVal);
	}

	// IPv6 checks
	if (net.isIPv6(ip)) {
		const h = expandIpv6(ip);
		if (!h) return true;

		const firstFiveZero = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;

		// ::ffff:0:0/96 (IPv4-mapped, e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1) -> check embedded IPv4
		if (firstFiveZero && h[5] === 0xffff) {
			return isBlockedIpv4Int(((h[6] << 16) | h[7]) >>> 0);
		}

		// ::/96 (IPv4-compatible; also covers :: unspecified and ::1 loopback)
		if (firstFiveZero && h[5] === 0) return true;

		// 64:ff9b::/96 (NAT64 well-known prefix)
		if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) return true;

		// 2002::/16 (6to4)
		if (h[0] === 0x2002) return true;

		// fe80::/10 (Link-local)
		if ((h[0] & 0xffc0) === 0xfe80) return true;

		// fc00::/7 (Unique local address)
		if ((h[0] & 0xfe00) === 0xfc00) return true;

		// ff00::/8 (Multicast)
		if ((h[0] & 0xff00) === 0xff00) return true;

		return false;
	}

	return true;
}

/**
 * Returns the trimmed URL if it is an absolute http(s) URL within the length cap, else "".
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeHttpUrl(value) {
	if (!value || typeof value !== "string") return "";
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_URL_LENGTH) return "";
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
		return trimmed;
	} catch {
		return "";
	}
}

/**
 * dns.lookup-compatible resolver for the HTTP(S) agents, so the SSRF check is enforced at
 * socket connect time for every request/redirect hop (defeats DNS rebinding after the pre-check).
 * @param {string} hostname
 * @param {object|number|Function} options
 * @param {Function} [callback]
 */
function ssrfSafeLookup(hostname, options, callback) {
	if (typeof options === "function") {
		callback = options;
		options = {};
	}
	const opts = typeof options === "number" ? { family: options } : { ...(options || {}) };

	dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
		if (err) return callback(err);
		if (!Array.isArray(addresses) || addresses.length === 0) {
			const notFound = new Error(`No DNS records found for hostname "${hostname}".`);
			notFound.code = "ENOTFOUND";
			return callback(notFound);
		}
		if (addresses.some((record) => isPrivateOrBlockedIp(record.address))) {
			const blocked = new Error(SSRF_ERROR_MESSAGE);
			blocked.code = "ESSRFBLOCKED";
			return callback(blocked);
		}
		if (opts.all) return callback(null, addresses);
		return callback(null, addresses[0].address, addresses[0].family);
	});
}

const ssrfHttpAgent = new http.Agent({ lookup: ssrfSafeLookup });
const ssrfHttpsAgent = new https.Agent({ lookup: ssrfSafeLookup });

/**
 * Validates the URL structure, protocol, and port.
 * @param {string} urlString
 * @returns {URL}
 */
function validateUrl(urlString) {
	if (!urlString || typeof urlString !== "string") {
		throw new Error("Invalid URL: must be a non-empty string.");
	}

	let parsed;
	try {
		parsed = new URL(urlString.trim());
	} catch {
		throw new Error("Invalid URL format.");
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http: and https: are allowed.`);
	}

	// Restrict ports to standard HTTP (80) and HTTPS (443)
	const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "https:" ? 443 : 80);
	if (port !== 80 && port !== 443) {
		throw new Error(`Forbidden destination port: ${port}. Only ports 80 and 443 are allowed.`);
	}

	const hostname = parsed.hostname.toLowerCase();
	if (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname.endsWith(".local") ||
		hostname.endsWith(".internal") ||
		hostname.endsWith(".onion")
	) {
		throw new Error("Forbidden hostname: local or internal domain names are blocked.");
	}

	return parsed;
}

/**
 * Resolves all DNS records for a hostname and ensures none point to private/blocked IPs.
 * @param {string} hostname
 */
async function verifyDnsResolution(hostname) {
	// If hostname is directly an IP literal
	if (net.isIP(hostname)) {
		if (isPrivateOrBlockedIp(hostname)) {
			throw new Error(SSRF_ERROR_MESSAGE);
		}
		return;
	}

	let addresses;
	try {
		addresses = await dns.promises.lookup(hostname, { all: true });
	} catch (err) {
		throw new Error(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
	}

	if (!addresses || addresses.length === 0) {
		throw new Error(`No DNS records found for hostname "${hostname}".`);
	}

	for (const record of addresses) {
		if (isPrivateOrBlockedIp(record.address)) {
			throw new Error(SSRF_ERROR_MESSAGE);
		}
	}
}

/**
 * Scrapes OpenGraph and Twitter card metadata for a given URL with strict SSRF protections.
 * @param {string} urlString
 * @returns {Promise<{url: string, title: string, description: string, image: string, imageUrl: string, siteName: string, domain: string}>}
 */
async function scrapeLinkPreview(urlString) {
	const trimmedUrl = (urlString || "").trim();
	const parsedUrl = validateUrl(trimmedUrl);

	// Check cache
	const cached = previewCache.get(trimmedUrl);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.data;
	}

	// Perform DNS pre-check on target hostname
	await verifyDnsResolution(parsedUrl.hostname);

	// Follow redirects manually up to 3 hops, re-validating each hop against SSRF rules
	let currentUrl = trimmedUrl;
	let hops = 0;
	let responseHtml = null;
	// One overall deadline shared across every redirect hop
	const totalTimeoutSignal = AbortSignal.timeout(SCRAPE_TOTAL_TIMEOUT_MS);

	while (hops <= 3) {
		const currentParsed = validateUrl(currentUrl);
		await verifyDnsResolution(currentParsed.hostname);

		const response = await axios.get(currentUrl, {
			maxRedirects: 0,
			timeout: SCRAPE_TOTAL_TIMEOUT_MS,
			signal: totalTimeoutSignal,
			// Connect-time SSRF enforcement: every socket resolves through ssrfSafeLookup
			httpAgent: ssrfHttpAgent,
			httpsAgent: ssrfHttpsAgent,
			proxy: false,
			maxContentLength: 250 * 1024, // 250KB limit to protect heap memory
			maxBodyLength: 250 * 1024,
			headers: {
				"User-Agent": "MasonBadmintonBot/1.0 (+https://badminton.gmu.edu)",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			},
			validateStatus: (status) => (status >= 200 && status < 400),
			responseType: "text",
		});

		// Check for redirect status codes (301, 302, 303, 307, 308)
		if (response.status >= 300 && response.status < 400 && response.headers.location) {
			hops += 1;
			if (hops > 3) {
				throw new Error("Too many redirects (exceeded 3 hops limit).");
			}
			currentUrl = new URL(response.headers.location, currentUrl).href;
			continue;
		}

		const contentType = String((response.headers && response.headers["content-type"]) || "").toLowerCase();
		if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
			throw new Error(`Unsupported content type for link preview: ${contentType || "unknown"}.`);
		}

		responseHtml = response.data;
		break;
	}

	if (!responseHtml) {
		throw new Error("No HTML content received from URL.");
	}

	// Parse with Cheerio
	let $ = cheerio.load(responseHtml);

	const title =
		$('meta[property="og:title"]').attr("content") ||
		$('meta[name="twitter:title"]').attr("content") ||
		$("title").first().text() ||
		"";

	const description =
		$('meta[property="og:description"]').attr("content") ||
		$('meta[name="twitter:description"]').attr("content") ||
		$('meta[name="description"]').attr("content") ||
		"";

	let image =
		$('meta[property="og:image"]').attr("content") ||
		$('meta[property="og:image:url"]').attr("content") ||
		$('meta[name="twitter:image"]').attr("content") ||
		"";

	if (image && !image.startsWith("http://") && !image.startsWith("https://")) {
		try {
			image = new URL(image, currentUrl).href;
		} catch {
			image = "";
		}
	}
	// Only keep absolute http(s) image URLs within the length cap (drops javascript:, data:, etc.)
	image = sanitizeHttpUrl(image);

	const siteName =
		$('meta[property="og:site_name"]').attr("content") ||
		$('meta[name="application-name"]').attr("content") ||
		"";

	const finalParsed = new URL(currentUrl);
	const domain = finalParsed.hostname;

	// Dereference Cheerio DOM tree to immediately release memory
	$ = null;

	const result = {
		url: currentUrl,
		title: title.trim().slice(0, 300),
		description: description.trim().slice(0, 500),
		image,
		imageUrl: image,
		siteName: siteName.trim().slice(0, 100),
		domain,
	};

	// Save to in-memory cache
	if (previewCache.size >= MAX_CACHE_ENTRIES) {
		const firstKey = previewCache.keys().next().value;
		previewCache.delete(firstKey);
	}
	previewCache.set(trimmedUrl, { timestamp: Date.now(), data: result });

	return result;
}

module.exports = {
	scrapeLinkPreview,
	validateUrl,
	isPrivateOrBlockedIp,
	verifyDnsResolution,
	ssrfSafeLookup,
	sanitizeHttpUrl,
	ssrfHttpAgent,
	ssrfHttpsAgent,
	previewCache,
};
