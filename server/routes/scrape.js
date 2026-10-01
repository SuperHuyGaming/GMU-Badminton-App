const express = require("express");
const router = express.Router();
const { ApifyClient } = require("apify-client");
const { parseInstagramPost } = require("../utils/aiParser");
const { authMiddleware } = require("../middleware/auth");
const Tournament = require("../models/Tournament");

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || "placeholder_token",
});

// POST /api/scrape/instagram
// Takes a direct Instagram post URL, scrapes it, and returns Gemini parsed data
router.post("/instagram", authMiddleware, async (req, res, next) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes("instagram.com")) {
            return res.status(400).json({ message: "Valid Instagram URL required." });
        }

        console.log(`[Scraper API] User requested manual scrape of: ${url}`);

        const hasApifyToken = process.env.APIFY_API_TOKEN && process.env.APIFY_API_TOKEN !== "placeholder_token";
        
        if (!hasApifyToken) {
            console.log("[Scraper API] No Apify token found. Returning high-quality mock data for demonstration.");
            
            // Artificial delay to simulate AI processing
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return res.json({
                tournamentName: "GMU Fall Invitational 2026",
                startDate: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                endDate: new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000),
                registrationDeadline: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                skillLevels: ["A", "B", "C", "D"],
                flyerImageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1000&auto=format&fit=crop",
                originalCaption: "🏸 GMU Badminton is hosting our annual Fall Invitational! Registration is now live. Open to all collegiate and adult players. Events include MS, WS, MD, WD, and XD. Early bird pricing ends soon! Link in bio to register.",
                instagramPostUrl: url,
                registrationUrl: "https://forms.gle/gmu-fall-invitational"
            });
        }

        // We use Apify's instagram-post-scraper for direct post URLs
        const input = {
            directUrls: [url],
            resultsType: "details",
        };

        const run = await client.actor("apify/instagram-post-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
            return res.status(404).json({ message: "Could not scrape Instagram post. It may be private." });
        }

        const post = items[0];
        const caption = post.caption || "";
        const imageUrl = post.displayUrl || "";

        // Send to Gemini
        const parsedData = await parseInstagramPost(caption);
        if (!parsedData || !parsedData.isTournamentPost) {
            return res.status(400).json({ message: "AI could not detect tournament details in this post." });
        }

        return res.json({
            tournamentName: parsedData.tournamentName,
            startDate: parsedData.startDate,
            endDate: parsedData.endDate,
            registrationDeadline: parsedData.registrationDeadline,
            skillLevels: parsedData.skillLevels,
            flyerImageUrl: imageUrl,
            originalCaption: caption,
            instagramPostUrl: url
        });

    } catch (err) {
        console.error("[Scraper API] Error:", err.message);
        res.status(500).json({ message: "Internal server error during scraping." });
    }
});

// POST /api/scrape/submit-pending
// Saves the crowdsourced tournament to DB as pending
router.post("/submit-pending", authMiddleware, async (req, res, next) => {
    try {
        const data = req.body;
        
        const newTourney = new Tournament({
            ...data,
            isOpenTournament: false, // Set to false so it requires Admin approval to show on main feed
            createdAt: new Date()
        });

        await newTourney.save();
        res.status(201).json({ message: "Tournament submitted for admin approval!" });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
