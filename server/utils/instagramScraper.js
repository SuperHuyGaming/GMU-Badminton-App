const axios = require('axios');
const cheerio = require('cheerio');
const Tournament = require('../models/Tournament');

// Target DMV collegiate clubs with their approximate coordinates
const TARGET_CLUBS = [
    { handle: "uvabadminton", name: "University of Virginia", location: "Charlottesville, VA", coordinates: [-78.5079, 38.0335] },
    { handle: "vtechbadminton", name: "Virginia Tech", location: "Blacksburg, VA", coordinates: [-80.4139, 37.2284] },
    { handle: "umd_badminton", name: "University of Maryland", location: "College Park, MD", coordinates: [-76.9425, 38.9869] },
    { handle: "dukebadminton", name: "Duke University", location: "Durham, NC", coordinates: [-78.9382, 35.9940] },
    { handle: "vcu.badminton", name: "Virginia Commonwealth University", location: "Richmond, VA", coordinates: [-77.4526, 37.5482] },
    { handle: "wmbadminton", name: "William & Mary", location: "Williamsburg, VA", coordinates: [-76.7144, 37.2709] }
];

/**
 * Main entry point for the Instagram Scraper
 */
async function runInstagramScraper() {
    console.log("[InstagramScraper] Starting daily scrape for DMV tournaments...");
    for (const club of TARGET_CLUBS) {
        try {
            console.log(`[InstagramScraper] Scraping @${club.handle}...`);
            // Note: In production, we would use an Apify actor or official Graph API here.
            // For now, this is the architectural stub for the scraper.
            const profileData = await scrapeInstagramProfile(club.handle);
            
            if (profileData && profileData.linktreeUrl) {
                // If they have a linktree, we scrape that too
                const forms = await scrapeLinktree(profileData.linktreeUrl);
                console.log(`[InstagramScraper] Found ${forms.length} potential registration links in Linktree for @${club.handle}`);
            }

        } catch (error) {
            console.error(`[InstagramScraper] Error scraping @${club.handle}:`, error.message);
        }
    }
    console.log("[InstagramScraper] Finished daily scrape.");
}

/**
 * Placeholder for Instagram scraping logic
 */
async function scrapeInstagramProfile(handle) {
    // Implementing a reliable Instagram scraper in Node usually requires Apify
    // We will return a simulated structure for the architecture.
    return {
        handle: handle,
        linktreeUrl: `https://linktr.ee/${handle}`,
        recentPosts: []
    };
}

/**
 * Scrapes a Linktree or Beacons page to extract Google Forms
 */
async function scrapeLinktree(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const $ = cheerio.load(data);
        const formLinks = [];

        // Extract all ahrefs
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('forms.gle') || href.includes('docs.google.com/forms'))) {
                formLinks.push(href);
            }
        });
        return formLinks;
    } catch (e) {
        return [];
    }
}

module.exports = {
    runInstagramScraper,
    TARGET_CLUBS
};
