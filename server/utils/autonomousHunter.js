const { ApifyClient } = require('apify-client');
const DiscoveryQueue = require('../models/DiscoveryQueue');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || 'placeholder_token',
});

// Keywords to hunt for
const SEARCH_QUERIES = [
    "upcoming badminton tournament virginia 2026",
    "maryland open badminton registration",
    "dc badminton tournament open",
    "site:tournamentsoftware.com badminton virginia OR maryland OR washington"
];

async function huntGoogleForTournaments() {
    console.log("🕵️‍♂️ [Hunter] Starting autonomous Google Search hunt...");
    
    // If no real token, we gracefully exit or mock
    if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN === 'placeholder_token') {
        console.log("⚠️ [Hunter] No Apify Token. Skipping real Google Search. Injecting mock discovery.");
        
        // Mock discovery for testing
        await DiscoveryQueue.updateOne(
            { sourceUrl: "https://www.tournamentsoftware.com/sport/tournament.aspx?id=mock-123" },
            { 
                $setOnInsert: {
                    sourceUrl: "https://www.tournamentsoftware.com/sport/tournament.aspx?id=mock-123",
                    sourceType: 'TOURNAMENT_SOFTWARE',
                    rawSnippet: "Registration is open for the Maryland State Badminton Championships 2026...",
                    status: 'PENDING_AI_REVIEW'
                }
            },
            { upsert: true }
        );
        return;
    }

    try {
        const input = {
            queries: SEARCH_QUERIES.join('\n'),
            resultsPerPage: 10,
            countryCode: "us",
        };

        const run = await client.actor("apify/google-search-scraper").call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        let newDiscoveries = 0;

        for (const item of items) {
            if (item.organicResults) {
                for (const result of item.organicResults) {
                    const url = result.url;
                    
                    // Basic sanity check to avoid massive generic sites unless it's a specific event
                    if (url.includes('wikipedia.org') || url.includes('amazon.')) continue;

                    let sourceType = 'GOOGLE_SEARCH';
                    if (url.includes('tournamentsoftware.com')) sourceType = 'TOURNAMENT_SOFTWARE';
                    if (url.includes('facebook.com')) sourceType = 'FACEBOOK';

                    const exists = await DiscoveryQueue.findOne({ sourceUrl: url });
                    if (!exists) {
                        await DiscoveryQueue.create({
                            sourceUrl: url,
                            sourceType: sourceType,
                            rawSnippet: result.description || result.title,
                            status: 'PENDING_AI_REVIEW'
                        });
                        newDiscoveries++;
                    }
                }
            }
        }

        console.log(`🕵️‍♂️ [Hunter] Hunt complete. Added ${newDiscoveries} new potential URLs to the Discovery Queue.`);
    } catch (err) {
        console.error("❌ [Hunter] Google Search scrape failed:", err.message);
    }
}

module.exports = {
    huntGoogleForTournaments
};
