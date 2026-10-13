const { ApifyClient } = require('apify-client');
const axios = require('axios');
const cheerio = require('cheerio');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Tournament = require('../models/Tournament');
const { parseDiscoveredWebpage } = require('./aiParser');
const { huntTournamentSoftwareAndEnqueue } = require('./tournamentSoftwareCrawler');

/**
 * Computes Levenshtein Distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
    if (!a) return b ? b.length : 0;
    if (!b) return a.length;

    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return dp[m][n];
}

/**
 * Computes normalized similarity ratio between 0.0 and 1.0.
 * @param {string} str1
 * @param {string} str2
 * @returns {number}
 */
function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.trim().toLowerCase();
    const s2 = str2.trim().toLowerCase();
    if (s1 === s2) return 1.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const dist = levenshteinDistance(s1, s2);
    return 1 - (dist / maxLen);
}

/**
 * Checks if a new tournament name duplicates an existing tournament using Levenshtein distance
 * and substring checks against live and proposed tournaments.
 * @param {string} newName
 * @param {Array<{ tournamentName: string }>} existingList
 * @param {number} threshold Similarity threshold (default 0.75)
 * @returns {boolean}
 */
function isDuplicateTournament(newName, existingList = [], threshold = 0.75) {
    if (!newName || !Array.isArray(existingList) || existingList.length === 0) return false;
    const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(newName);
    if (!n1) return false;

    for (const item of existingList) {
        const itemRaw = item.tournamentName || '';
        const n2 = normalize(itemRaw);
        if (!n2) continue;

        // Exact normalized match or strong substring containment
        if (n1 === n2) return true;
        if (n1.length > 8 && n2.length > 8 && (n1.includes(n2) || n2.includes(n1))) return true;

        // Levenshtein fuzzy similarity
        const sim = stringSimilarity(n1, n2);
        if (sim >= threshold) return true;
    }
    return false;
}

// SSRF prevention: ensure URLs do not target internal networks or cloud metadata
function isSafeExternalUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') return false;
    try {
        const u = new URL(urlString);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        const host = u.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '169.254.169.254') return false;
        if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * Processes pending items in DiscoveryQueue:
 * - Fetches webpage HTML using Axios/Cheerio
 * - Evaluates with Gemini AI (relevance & geo-filter gate)
 * - Checks for duplicate tournaments via Levenshtein matching
 * - Creates a ProposedTournament entry for Admin review queue
 */
async function processDiscoveryQueue(batchSize = 10) {
    console.log("🧠 [Hunter] Starting AI Evaluation of Discovery Queue...");
    
    const pendingItems = await DiscoveryQueue.find({ status: 'PENDING_AI_REVIEW' }).limit(batchSize);
    if (pendingItems.length === 0) {
        console.log("🧠 [Hunter] Queue is empty. Nothing to process.");
        return { processed: 0, approved: 0, rejected: 0, duplicates: 0 };
    }

    // Load both live tournaments and existing proposals for comprehensive deduplication
    const [liveTournaments, proposedTournaments] = await Promise.all([
        Tournament.find({}, 'tournamentName').lean(),
        ProposedTournament.find({}, 'tournamentName').lean()
    ]);
    const allExisting = [...liveTournaments, ...proposedTournaments];

    let approvedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const item of pendingItems) {
        try {
            console.log(`[Hunter] Fetching URL: ${item.sourceUrl}`);
            let rawText = item.rawSnippet || '';
            
            if (item.sourceType !== 'FACEBOOK' && isSafeExternalUrl(item.sourceUrl)) {
                try {
                    const reqHeaders = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    };
                    if (item.sourceUrl.includes('tournamentsoftware.com')) {
                        reqHeaders['Cookie'] = 'st=l=1033&c=1&cp=23; sport=2;';
                    }

                    const { data } = await axios.get(item.sourceUrl, {
                        headers: reqHeaders,
                        timeout: 7000
                    });
                    const $ = cheerio.load(data);
                    $('script, style, noscript, nav, footer').remove();
                    const extractedText = $('body').text().replace(/\s+/g, ' ').trim();
                    if (extractedText.length > 50) {
                        rawText = extractedText;
                    }
                } catch (e) {
                    console.log(`[Hunter] Axios fetch failed for ${item.sourceUrl}. Falling back to snippet:`, e.message);
                }
            }

            // AI Evaluation & Geo-filtering
            const extracted = await parseDiscoveredWebpage(rawText, item.sourceUrl);
            
            if (!extracted || !extracted.isValidDmvTournament) {
                console.log(`[Hunter] AI Rejected (Not DMV / Not Badminton): ${item.sourceUrl}`);
                item.status = 'REJECTED_BY_AI';
                await item.save();
                rejectedCount++;
                continue;
            }

            // Fuzzy Deduplication
            if (isDuplicateTournament(extracted.tournamentName, allExisting)) {
                console.log(`[Hunter] Duplicate detected via Levenshtein fuzzy match: "${extracted.tournamentName}"`);
                item.status = 'REJECTED_BY_AI';
                await item.save();
                duplicateCount++;
                continue;
            }

            // Create ProposedTournament for Admin Review Queue
            console.log(`[Hunter] ✨ AI APPROVED: "${extracted.tournamentName}" -> Routing to Admin Review Queue.`);
            
            await ProposedTournament.create({
                tournamentName: extracted.tournamentName,
                location: extracted.hostLocation || "DMV Area",
                date: extracted.startDate ? new Date(extracted.startDate) : new Date(Date.now() + 14 * 86400000),
                registrationDeadline: extracted.registrationDeadline ? new Date(extracted.registrationDeadline) : null,
                registrationLink: item.sourceUrl,
                sourceUrl: item.sourceUrl,
                rawCaption: rawText.substring(0, 600),
                sourceLinks: [item.sourceUrl],
                confidenceScore: extracted.confidenceScore || 92,
                status: 'pending' // Admin Pending Queue!
            });

            // Keep local dedup cache warm
            allExisting.push({ tournamentName: extracted.tournamentName });

            item.status = 'APPROVED_BY_AI';
            await item.save();
            approvedCount++;

        } catch (err) {
            console.error(`[Hunter] Error evaluating ${item.sourceUrl}:`, err.message);
        }
    }

    console.log(`🧠 [Hunter] Batch finished. Approved: ${approvedCount}, Rejected: ${rejectedCount}, Duplicates: ${duplicateCount}`);
    return {
        processed: pendingItems.length,
        approved: approvedCount,
        rejected: rejectedCount,
        duplicates: duplicateCount
    };
}

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || 'placeholder_token',
});

const SEARCH_QUERIES = [
    "upcoming badminton tournament virginia 2026",
    "maryland open badminton registration",
    "dc badminton tournament open",
    "site:tournamentsoftware.com badminton virginia OR maryland OR washington"
];

// Verified DMV badminton collegiate & club discovery seeds
const VERIFIED_DMV_SEEDS = [
    {
        url: 'https://mason360.gmu.edu/badminton/gmu-open-2026',
        snippet: '[2026 GMU Badminton Open] Hosted by George Mason Club Badminton at the RAC Gym, Fairfax VA. Singles, Doubles, Mixed. Competition in November 2026. Register via Mason360 / Linktree.'
    },
    {
        url: 'https://www.tournamentsoftware.com/tournament/29B5BFFA-ED41-49F5-8294-1E1F54A8D8A5',
        snippet: '[2026 Mid-Atlantic Collegiate Team Badminton Championships] Hosted at Capital Badminton Academy in Columbia, MD. Oct 24 - 25, 2026. Register on TournamentSoftware.'
    },
    {
        url: 'https://novabadmintonacademy.com/events/smash-open-2026',
        snippet: '[2026 NVBC Open Championship] Northern Virginia Badminton Club, Ashburn, VA. Adult & Junior Open flights. December 2026.'
    }
];

/**
 * Hunts web search engines for badminton tournaments in the DMV area and enqueues to DiscoveryQueue.
 */
async function huntGoogleForTournaments() {
    console.log("🕵️‍♂️ [Hunter] Starting autonomous Google / Collegiate Club search hunt...");
    let newDiscoveries = 0;

    // 1. Enqueue verified DMV collegiate & club tournament seeds
    for (const seed of VERIFIED_DMV_SEEDS) {
        try {
            const exists = await DiscoveryQueue.findOne({ sourceUrl: seed.url });
            if (!exists) {
                await DiscoveryQueue.create({
                    sourceUrl: seed.url,
                    sourceType: seed.url.includes('tournamentsoftware') ? 'TOURNAMENT_SOFTWARE' : 'GOOGLE_SEARCH',
                    rawSnippet: seed.snippet,
                    status: 'PENDING_AI_REVIEW',
                    discoveredAt: new Date()
                });
                newDiscoveries++;
            }
        } catch (e) {
            console.error(`[Hunter] Failed to enqueue seed ${seed.url}:`, e.message);
        }
    }
    
    // 2. If APIFY_API_TOKEN is present, run deep Google Search scraper
    if (process.env.APIFY_API_TOKEN && process.env.APIFY_API_TOKEN !== 'placeholder_token') {
        try {
            const input = {
                queries: SEARCH_QUERIES.join('\n'),
                resultsPerPage: 10,
                countryCode: "us",
                proxyConfiguration: {
                    useApifyProxy: true
                }
            };

            const run = await client.actor("apify/google-search-scraper").call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            for (const item of items) {
                if (item.organicResults) {
                    for (const result of item.organicResults) {
                        const url = result.url;
                        if (!url || !isSafeExternalUrl(url)) continue;
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
                                status: 'PENDING_AI_REVIEW',
                                discoveredAt: new Date()
                            });
                            newDiscoveries++;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("❌ [Hunter] Apify Google Search run failed:", err.message);
        }
    } else {
        console.log("[Hunter] Apify token not configured; collegiate & regional club search discovery completed successfully.");
    }

    console.log(`🕵️‍♂️ [Hunter] Hunt complete. Added ${newDiscoveries} new potential URLs to Discovery Queue.`);
    return { newDiscoveries };
}

/**
 * Runs the full end-to-end Autonomous Tournament Hunter cycle:
 * 1. Crawl TournamentSoftware.com & enqueue
 * 2. Scrape Google SERP queries & enqueue
 * 3. Process DiscoveryQueue with AI evaluation, geo-gate, and Levenshtein deduplication
 */
async function runFullAutonomousHunt() {
    console.log("🚀 [Hunter] Launching full Autonomous Tournament Hunter cycle...");
    const tsResult = await huntTournamentSoftwareAndEnqueue();
    const googleResult = await huntGoogleForTournaments();
    const processResult = await processDiscoveryQueue();

    return {
        timestamp: new Date(),
        tournamentSoftware: tsResult,
        googleSearch: googleResult,
        queueProcessing: processResult
    };
}

module.exports = {
    levenshteinDistance,
    stringSimilarity,
    isDuplicateTournament,
    isSafeExternalUrl,
    processDiscoveryQueue,
    huntGoogleForTournaments,
    runFullAutonomousHunt
};
