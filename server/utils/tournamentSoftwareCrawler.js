const axios = require('axios');
const cheerio = require('cheerio');
const DiscoveryQueue = require('../models/DiscoveryQueue');

const TS_BASE_URL = 'https://usabadminton.tournamentsoftware.com';

const DMV_GEO_PATTERNS = [
    /\b(va|virginia)\b/i,
    /\b(md|maryland)\b/i,
    /\b(dc|washington\s*d\.?c\.?)\b/i,
    /\b(pa|pennsylvania)\b/i,
    /\b(nc|north\s*carolina)\b/i,
    /\b2[0-4]\d{3}\b/ // Mid-Atlantic ZIP code prefix range (DC, MD, VA, NC, PA)
];

/**
 * Checks if a location text matches DMV / Mid-Atlantic region.
 */
function isDmvRegion(locationText) {
    if (!locationText || typeof locationText !== 'string') return false;
    return DMV_GEO_PATTERNS.some(pattern => pattern.test(locationText));
}

/**
 * Parses TournamentSoftware HTML content into structured event candidates.
 * @param {string} html Raw HTML response
 * @param {string} baseUrl Optional base URL
 * @returns {Array<Object>} List of parsed tournament candidates
 */
function parseTournamentSoftwareHtml(html, baseUrl = TS_BASE_URL) {
    if (!html || typeof html !== 'string') return [];

    const $ = cheerio.load(html);
    const results = [];

    // TournamentSoftware find/list views typically render items in .media, .tournament-item, table rows, or list-items
    $('.media, tr.tournament-row, .tournament-item, li.media').each((_, elem) => {
        const el = $(elem);

        // Extract title & link
        const linkElem = el.find('a[href*="/tournament/"], a[href*="/sport/"], h4.media-heading a, .title a').first();
        const title = (linkElem.text() || el.find('.media-heading, .title').text() || '').trim();
        const relativeHref = linkElem.attr('href') || '';
        if (!title || !relativeHref) return;

        let absoluteUrl = relativeHref;
        try {
            absoluteUrl = new URL(relativeHref, baseUrl).toString();
        } catch {
            absoluteUrl = `${baseUrl}${relativeHref.startsWith('/') ? '' : '/'}${relativeHref}`;
        }

        // Extract dates and location
        const textBlock = el.text().replace(/\s+/g, ' ').trim();
        const locationElem = el.find('.location, .venue, .media-body small, .address');
        const location = (locationElem.text() || '').trim();

        // Extract dates
        let dates = '';
        const dateMatch = textBlock.match(/(\w{3}\s+\d{1,2}(?:\s*-\s*\d{1,2})?,\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (dateMatch) {
            dates = dateMatch[0];
        }

        const isDmv = isDmvRegion(location) || isDmvRegion(textBlock) || isDmvRegion(title);

        results.push({
            tournamentName: title,
            sourceUrl: absoluteUrl,
            sourceType: 'TOURNAMENT_SOFTWARE',
            location: location || 'Mid-Atlantic / DMV Region',
            dates,
            rawSnippet: textBlock.slice(0, 500),
            isDmv
        });
    });

    return results;
}

/**
 * Crawls TournamentSoftware search for badminton tournaments in a given region query.
 * @param {string} query Search query term (e.g., 'Virginia', 'Maryland', 'Capital')
 * @returns {Promise<Array<Object>>} Filtered list of DMV tournaments
 */
async function crawlTournamentSoftware(query = 'Virginia') {
    try {
        const searchUrl = `${TS_BASE_URL}/find?q=${encodeURIComponent(`badminton ${query}`)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 10000
        });

        if (!response.data) return [];
        const parsed = parseTournamentSoftwareHtml(response.data, TS_BASE_URL);
        return parsed.filter(item => item.isDmv);
    } catch (err) {
        console.warn(`[TournamentSoftwareCrawler] Search for '${query}' encountered:`, err.message);
        return [];
    }
}

/**
 * Hunts TournamentSoftware for all DMV targets and enqueues new discoveries into DiscoveryQueue.
 * @returns {Promise<{ discovered: number, items: Array<Object> }>}
 */
async function huntTournamentSoftwareAndEnqueue() {
    console.log('🏸 [TS Crawler] Starting TournamentSoftware autonomous hunt...');
    const queries = ['Virginia', 'Maryland', 'DC', 'Capital', 'Mid-Atlantic'];
    const candidates = [];

    for (const q of queries) {
        const found = await crawlTournamentSoftware(q);
        for (const item of found) {
            if (!candidates.some(c => c.sourceUrl === item.sourceUrl)) {
                candidates.push(item);
            }
        }
    }

    let newlyEnqueued = 0;
    const enqueuedItems = [];

    for (const item of candidates) {
        try {
            const exists = await DiscoveryQueue.findOne({ sourceUrl: item.sourceUrl });
            if (!exists) {
                const doc = await DiscoveryQueue.create({
                    sourceUrl: item.sourceUrl,
                    sourceType: 'TOURNAMENT_SOFTWARE',
                    rawSnippet: `[${item.tournamentName}] Location: ${item.location} | Dates: ${item.dates} | Snippet: ${item.rawSnippet}`,
                    status: 'PENDING_AI_REVIEW',
                    discoveredAt: new Date()
                });
                newlyEnqueued++;
                enqueuedItems.push(doc);
            }
        } catch (err) {
            console.error(`[TS Crawler] Failed to enqueue ${item.sourceUrl}:`, err.message);
        }
    }

    console.log(`🏸 [TS Crawler] Complete. Enqueued ${newlyEnqueued} new tournament links.`);
    return { discovered: newlyEnqueued, items: enqueuedItems };
}

module.exports = {
    TS_BASE_URL,
    isDmvRegion,
    parseTournamentSoftwareHtml,
    crawlTournamentSoftware,
    huntTournamentSoftwareAndEnqueue
};
