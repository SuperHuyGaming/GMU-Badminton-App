// server/utils/linkPreviewScraper.js
const dns = require("dns");
const net = require("net");
const axios = require("axios");
const cheerio = require("cheerio");

// In-memory cache for scraped link previews (24-hour TTL, max 200 entries)
const previewCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

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
 * Checks if an IP is loopback, link-local, private, carrier-grade NAT, or metadata.
 * @param {string} rawIp
 * @returns {boolean} true if IP is private or blocked
 */
function isPrivateOrBlockedIp(rawIp) {
	if (!rawIp || typeof rawIp !== "string") return true;

	let ip = rawIp.trim().toLowerCase();

	// Unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
	if (ip.startsWith("::ffff:")) {
		ip = ip.substring(7);
	}

	// IPv4 checks
	if (net.isIPv4(ip)) {
		const intVal = ipv4ToInt(ip);
		if (intVal === null) return true;

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

		// 192.168.0.0/16 (Private network)
		if ((intVal >>> 16) === ((192 << 8) | 168)) return true;

		// 224.0.0.0/4 (Multicast)
		if ((intVal >>> 28) >= 14) return true;

		return false;
	}

	// IPv6 checks
	if (net.isIPv6(ip)) {
		// ::1 (Loopback) or :: (Unspecified)
		if (ip === "::1" || ip === "::") return true;

		// fe80::/10 (Link-local)
		if (/^fe[89ab]/i.test(ip)) return true;

		// fc00::/7 (Unique local address)
		if (/^f[cd]/i.test(ip)) return true;

		return false;
	}

	return true;
}

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
			throw new Error("SSRF Protection: Access to private or loopback network addresses is forbidden.");
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
			throw new Error("SSRF Protection: Access to private or loopback network addresses is forbidden.");
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

	while (hops <= 3) {
		const currentParsed = validateUrl(currentUrl);
		await verifyDnsResolution(currentParsed.hostname);

		const response = await axios.get(currentUrl, {
			maxRedirects: 0,
			timeout: 5000,
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
		image: image.trim(),
		imageUrl: image.trim(),
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
	previewCache,
};
