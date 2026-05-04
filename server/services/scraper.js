// server/services/scraper.js
const axios = require("axios");
const cheerio = require("cheerio");

// 1. The Live Scraper
async function getRacStatus() {
	try {
		const response = await axios.get(
			"https://recreation.gmu.edu/facilities-hours/",
			{ timeout: 5000 },
		);
		const $ = cheerio.load(response.data);

		// Check for alerts
		const alertText = $(".alert, .notification").text().toLowerCase();
		if (alertText.includes("closed") || alertText.includes("level 2")) {
			return "FACILITY CLOSED: University Alert Active";
		}

		// Check for specific Badminton text
		let activeCourts = [];
		$("li").each((index, element) => {
			const text = $(element).text();
			if (text.includes("Linn Gym") && text.includes("Badminton")) {
				activeCourts.push(text.trim());
			}
		});

		if (activeCourts.length > 0) {
			return `Badminton Active: ${activeCourts.join(" & ")}`;
		}

		// Static Fallback Logic
		const now = new Date();
		const isDedicatedTime =
			(now.getDay() === 2 || now.getDay() === 3) &&
			now.getHours() >= 15 &&
			now.getHours() <= 19;

		if (isDedicatedTime) {
			return "Badminton: Dedicated Play Active (Linn Gym Court B)";
		}

		return "Badminton: Open Rec (Check Linn Gym Court A/B availability)";
	} catch (error) {
		console.error("Scraping failed:", error.message);
		return "Live status unavailable. Please check the Mason Rec website.";
	}
}

// 2. The Weekly Forecast
function getWeeklySchedule() {
	const schedule = [];
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	const now = new Date();

	for (let i = 0; i < 7; i++) {
		const futureDate = new Date();
		futureDate.setDate(now.getDate() + i);
		const dayName = days[futureDate.getDay()];

		let status = "Open Play (Subject to Availability)";
		let location = "Linn Gym Court A/B";

		if (dayName === "Tuesday" || dayName === "Wednesday") {
			status = "Dedicated Play: 3:30 PM – 7:30 PM";
			location = "Linn Gym Court B";
		}

		schedule.push({
			date: futureDate.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
			day: dayName,
			status: status,
			location: location,
		});
	}
	return schedule;
}

module.exports = { getRacStatus, getWeeklySchedule };
