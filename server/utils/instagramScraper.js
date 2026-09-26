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
    { handle: "wmbadminton", name: "William & Mary", location: "Williamsburg, VA", coordinates: [-76.7144, 37.2709] },
    { handle: "psubadminton", name: "Penn State University", location: "State College, PA", coordinates: [-77.8600, 40.7982] },
    { handle: "rutgersbadminton", name: "Rutgers University", location: "New Brunswick, NJ", coordinates: [-74.4518, 40.4862] },
    { handle: "jhubadminton", name: "Johns Hopkins University", location: "Baltimore, MD", coordinates: [-76.6200, 39.3299] },
    { handle: "gwbadminton", name: "George Washington University", location: "Washington, DC", coordinates: [-77.0469, 38.8997] },
    { handle: "georgetownbadminton", name: "Georgetown University", location: "Washington, DC", coordinates: [-77.0722, 38.9076] },
    { handle: "ncsubadminton", name: "NC State University", location: "Raleigh, NC", coordinates: [-78.6750, 35.7846] },
    { handle: "uncbadminton", name: "UNC Chapel Hill", location: "Chapel Hill, NC", coordinates: [-79.0469, 35.9049] },
    { handle: "upennbadminton", name: "University of Pennsylvania", location: "Philadelphia, PA", coordinates: [-75.1932, 39.9522] },
    { handle: "cmubadminton", name: "Carnegie Mellon University", location: "Pittsburgh, PA", coordinates: [-79.9425, 40.4424] },
    { handle: "udbadminton", name: "University of Delaware", location: "Newark, DE", coordinates: [-75.7496, 39.6780] },
    { handle: "templebadminton", name: "Temple University", location: "Philadelphia, PA", coordinates: [-75.1531, 39.9806] },
    { handle: "pittbadminton", name: "University of Pittsburgh", location: "Pittsburgh, PA", coordinates: [-79.9608, 40.4443] },
    { handle: "jmubadminton", name: "James Madison University", location: "Harrisonburg, VA", coordinates: [-78.8697, 38.4350] },
    { handle: "towsonbadminton", name: "Towson University", location: "Towson, MD", coordinates: [-76.6042, 39.3934] }
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
