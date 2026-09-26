const { ApifyClient } = require('apify-client');
const DiscoveryQueue = require('../models/DiscoveryQueue');

const axios = require('axios');
const cheerio = require('cheerio');
const Tournament = require('../models/Tournament');
const { parseDiscoveredWebpage } = require('./aiParser');

// Utility for basic string similarity (Levenshtein distance simplified for titles)
function isDuplicateTournament(newName, existingTournaments) {
    if (!newName) return false;
    const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(newName);
    
    for (const t of existingTournaments) {
        const n2 = normalize(t.tournamentName);
        if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    }
    return false;
}

async function processDiscoveryQueue() {
    console.log("🧠 [Hunter] Starting AI Evaluation of Discovery Queue...");
    
    const pendingItems = await DiscoveryQueue.find({ status: 'PENDING_AI_REVIEW' }).limit(5);
    if (pendingItems.length === 0) {
        console.log("🧠 [Hunter] Queue is empty. Nothing to process.");
        return;
    }

    const existingTournaments = await Tournament.find({}, 'tournamentName');

    for (const item of pendingItems) {
        try {
            // 1. Fetch Webpage Content
            console.log(`[Hunter] Fetching URL: ${item.sourceUrl}`);
            let rawText = item.rawSnippet;
            
            // Only try to scrape if it's not facebook (which blocks axios)
            if (item.sourceType !== 'FACEBOOK') {
                try {
                    const { data } = await axios.get(item.sourceUrl, { timeout: 5000 });
                    const $ = cheerio.load(data);
                    rawText = $('body').text().replace(/\s+/g, ' ').trim();
                } catch (e) {
                    console.log(`[Hunter] Axios failed for ${item.sourceUrl}. Falling back to search snippet.`);
                }
            }

            // 2. AI Evaluation
            const extracted = await parseDiscoveredWebpage(rawText, item.sourceUrl);
            
            if (!extracted || !extracted.isValidDmvTournament) {
                console.log(`[Hunter] AI Rejected: ${item.sourceUrl}`);
                item.status = 'REJECTED_BY_AI';
                await item.save();
                continue;
            }

            // 3. Deduplication (Fuzzy Match)
            if (isDuplicateTournament(extracted.tournamentName, existingTournaments)) {
                console.log(`[Hunter] Duplicate found, skipping: ${extracted.tournamentName}`);
                item.status = 'REJECTED_BY_AI'; // Or DUPLICATE
                await item.save();
                continue;
            }

            // 4. Send to Admin Quarantine (isOpenTournament = false)
            console.log(`[Hunter] ✨ AI APPROVED: ${extracted.tournamentName}! Sending to Admin Queue.`);
            
            await Tournament.create({
                tournamentName: extracted.tournamentName,
                eventLocation: extracted.hostLocation || "DMV Area",
                startDate: extracted.startDate ? new Date(extracted.startDate) : null,
                endDate: extracted.endDate ? new Date(extracted.endDate) : null,
                registrationDeadline: extracted.registrationDeadline ? new Date(extracted.registrationDeadline) : null,
                registrationUrl: item.sourceUrl,
                sourceUrl: item.sourceUrl,
                originalCaption: rawText.substring(0, 500), // Snippet for admin review
                isOpenTournament: false, // Requires Admin Approval!
                createdAt: new Date()
            });

            item.status = 'PROCESSED';
            await item.save();

        } catch (err) {
            console.error(`[Hunter] Failed to process ${item.sourceUrl}:`, err.message);
        }
    }
}


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
    processDiscoveryQueue,
    huntGoogleForTournaments
};
