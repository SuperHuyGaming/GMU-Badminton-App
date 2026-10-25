/**
 * dateRange.js - Date Range Management Engine for Community Posts & Activity Feed
 */

const parseDateRange = (query = {}) => {
	const { dateRange, startDate, endDate, from, to } = query;
	let start = null;
	let end = null;
	const now = new Date();

	if (dateRange && typeof dateRange === "string") {
		const range = dateRange.toLowerCase().trim();
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

	const customStart = startDate || from;
	const customEnd = endDate || to;

	if (customStart && typeof customStart === "string") {
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
	if (customEnd && typeof customEnd === "string") {
		const trimmed = customEnd.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			const [y, m, d] = trimmed.split("-").map(Number);
			const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
			if (!isNaN(dt.getTime())) end = dt;
		} else {
			const parsedEnd = new Date(trimmed);
			if (!isNaN(parsedEnd.getTime())) {
				end = parsedEnd;
			}
		}
	}

	return { start, end };
};

module.exports = { parseDateRange };
