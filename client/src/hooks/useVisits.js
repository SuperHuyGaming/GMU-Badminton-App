import { useEffect, useState } from "react";

// Visitor counter shared with bentruong.dev (a Cloudflare Worker at /api/visits).
// A random visitor ID in localStorage counts toward the total once; a random session ID
// in sessionStorage sends a heartbeat every 30s while the tab is visible, which is what
// "online now" counts. Nothing personal is sent or stored. Only runs on the production
// hostname, so local dev, tests and staging never add to the numbers.
const API = "https://bentruong.dev/api/visits";

function storedId(storage, key) {
	try {
		let v = storage.getItem(key);
		if (!v) {
			v = crypto.randomUUID();
			storage.setItem(key, v);
		}
		return v;
	} catch {
		return crypto.randomUUID();
	}
}

export function useVisits(site, productionHost) {
	const [counts, setCounts] = useState(null);
	useEffect(() => {
		if (typeof window === "undefined" || window.location.hostname !== productionHost) return undefined;
		const visitor = storedId(window.localStorage, "bt-visitor");
		const session = storedId(window.sessionStorage, "bt-session");
		let stopped = false;
		const ping = () =>
			fetch(API, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ site, visitor, session }),
			})
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => d && !stopped && setCounts(d))
				.catch(() => {});
		const onVisible = () => document.visibilityState === "visible" && ping();
		ping();
		const timer = setInterval(onVisible, 30000);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			stopped = true;
			clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [site, productionHost]);
	return counts;
}
