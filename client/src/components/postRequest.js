// client/src/components/postRequest.js
// Small helpers for the post card and its comments.
//
// apiFetch throws `new Error(serverMessage)` for most failed responses, but it
// can still resolve with `{ ok: false }` (offline, or a 401 that survived the
// token refresh). `ensureOk` turns both cases into a thrown Error carrying the
// server's message, so callers only need one `catch`.

export async function ensureOk(res, fallbackMessage) {
	if (res && res.ok) return res;
	let serverMessage;
	try {
		serverMessage = (await res?.json?.())?.message;
	} catch {
		// Body was not JSON; fall back to the generic message below.
	}
	throw new Error(serverMessage || fallbackMessage);
}

export function errorMessage(err, fallbackMessage) {
	return (err && err.message) || fallbackMessage;
}
