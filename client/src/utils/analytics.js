// Lazy PostHog wrapper.
//
// posthog-js is ~280 kB minified. Importing it directly put it in the main
// bundle, so every visitor downloaded it before the first paint. This wrapper
// keeps the same capture/identify/reset calls, queues them, and loads
// posthog-js in the background once the browser is idle. Without a real
// VITE_POSTHOG_KEY it is never downloaded at all.

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const ENABLED = Boolean(POSTHOG_KEY) && POSTHOG_KEY !== 'mock-posthog-api-key';

let client = null;      // the posthog instance once loaded
let loading = null;     // in-flight import promise
const queue = [];       // calls made before posthog finished loading

function load() {
	if (!ENABLED || loading) return loading;
	loading = import('posthog-js')
		.then(({ default: posthog }) => {
			posthog.init(POSTHOG_KEY, {
				api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
				autocapture: true,
				capture_pageview: false, // SPA page views are captured manually
				session_recording: {
					maskAllInputs: false,
					maskTextSelector: 'password',
				},
			});
			client = posthog;
			while (queue.length) {
				const [method, args] = queue.shift();
				client[method](...args);
			}
			return client;
		})
		.catch((err) => {
			// Analytics must never break the app (e.g. blocked by an ad blocker).
			console.warn('[analytics] PostHog failed to load:', err);
			queue.length = 0;
		});
	return loading;
}

function call(method, args) {
	if (!ENABLED) return;
	if (client) {
		client[method](...args);
		return;
	}
	if (queue.length < 100) queue.push([method, args]);
	load();
}

/** Start loading PostHog once the page is idle (no-op without a key). */
export function initAnalytics() {
	if (!ENABLED || typeof window === 'undefined') return;
	const start = () => load();
	if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 5000 });
	else setTimeout(start, 2000);
}

const analytics = {
	enabled: ENABLED,
	capture: (...args) => call('capture', args),
	identify: (...args) => call('identify', args),
	reset: (...args) => call('reset', args),
};

export default analytics;
