/**
 * dateRange.js - Date Range Management Engine for Community Posts & Activity Feed
 */

const parseDateRange = (query = {}) => {
	const q = typeof query === "string" ? { dateRange: query } : (query || {});
	const dateRangeVal = Array.isArray(q.dateRange) ? q.dateRange[0] : q.dateRange;
	const customStart = Array.isArray(q.startDate || q.from) ? (q.startDate || q.from)[0] : (q.startDate || q.from);
	const customEnd = Array.isArray(q.endDate || q.to) ? (q.endDate || q.to)[0] : (q.endDate || q.to);
	const tzOffsetRaw = Array.isArray(q.tzOffset || q.timezoneOffset) ? (q.tzOffset || q.timezoneOffset)[0] : (q.tzOffset || q.timezoneOffset);

	let start = null;
	let end = null;
	const now = new Date();

	if (dateRangeVal && typeof dateRangeVal === "string") {
		const range = dateRangeVal.toLowerCase().trim();
		const tzOffset = tzOffsetRaw !== undefined && tzOffsetRaw !== null && tzOffsetRaw !== "" ? Number(tzOffsetRaw) : null;
		const hasValidTz = tzOffset !== null && !isNaN(tzOffset);

		if (hasValidTz) {
			// Client's timezone offset in minutes (e.g. +240 for EDT, -540 for JST)
			// Local time in ms: UTC time - (tzOffset * 60 * 1000)
			const localNowMs = now.getTime() - (tzOffset * 60 * 1000);
			const localNow = new Date(localNowMs);

			if (range === "today") {
				const localStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, 0, 0, 0));
				const localEnd = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 23, 59, 59, 999));
				start = new Date(localStart.getTime() + (tzOffset * 60 * 1000));
				end = new Date(localEnd.getTime() + (tzOffset * 60 * 1000));
			} else if (range === "week" || range === "this_week" || range === "thisweek") {
				const day = localNow.getUTCDay(); // 0 is Sunday
				const localStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - day, 0, 0, 0, 0));
				const localEnd = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + (6 - day), 23, 59, 59, 999));
				start = new Date(localStart.getTime() + (tzOffset * 60 * 1000));
				end = new Date(localEnd.getTime() + (tzOffset * 60 * 1000));
			} else if (range === "month" || range === "this_month" || range === "thismonth") {
				const localStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1, 0, 0, 0, 0));
				const localEnd = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth() + 1, 0, 23, 59, 59, 999));
				start = new Date(localStart.getTime() + (tzOffset * 60 * 1000));
				end = new Date(localEnd.getTime() + (tzOffset * 60 * 1000));
			}
		} else {
			if (range === "today") {
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
				end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
			} else if (range === "week" || range === "this_week" || range === "thisweek") {
				const day = now.getDay(); // 0 is Sunday
				start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
				end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day), 23, 59, 59, 999);
			} else if (range === "month" || range === "this_month" || range === "thismonth") {
				start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
			}
		}
	}

	if (customStart instanceof Date) {
		if (!isNaN(customStart.getTime())) start = new Date(customStart.getTime());
	} else if (typeof customStart === "number") {
		const dt = new Date(customStart);
		if (!isNaN(dt.getTime())) start = dt;
	} else if (customStart && typeof customStart === "string") {
		const trimmed = customStart.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			const [y, m, d] = trimmed.split("-").map(Number);
			const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
			if (!isNaN(dt.getTime())) start = dt;
		} else {
			const parsedStart = new Date(trimmed);
			if (!isNaN(parsedStart.getTime())) {
				start = parsedStart;
			}
		}
	}

	if (customEnd instanceof Date) {
		if (!isNaN(customEnd.getTime())) end = new Date(customEnd.getTime());
	} else if (typeof customEnd === "number") {
		const dt = new Date(customEnd);
		if (!isNaN(dt.getTime())) end = dt;
	} else if (customEnd && typeof customEnd === "string") {
		const trimmed = customEnd.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			const [y, m, d] = trimmed.split("-").map(Number);
			const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
			if (!isNaN(dt.getTime())) end = dt;
		} else {
			const parsedEnd = new Date(trimmed);
			if (!isNaN(parsedEnd.getTime())) {
				if (!trimmed.includes(":") && !trimmed.includes("T")) {
					parsedEnd.setHours(23, 59, 59, 999);
				}
				end = parsedEnd;
			}
		}
	}

	if (start && end && start.getTime() > end.getTime()) {
		const temp = start;
		start = end;
		end = temp;
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
	}

	return { start, end };
};

module.exports = { parseDateRange };
