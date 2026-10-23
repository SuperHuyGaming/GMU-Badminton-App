const axios = require('axios');
const cheerio = require('cheerio');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const { sanitizeScrapedTitle } = require('./sanitizeScrapedTitle');

const TS_BASE_URL = 'https://www.tournamentsoftware.com';

const TS_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Cookie': 'st=l=1033&c=1&cp=23; sport=2;'
};

const DMV_GEO_PATTERNS = [
    /\b(virginia|maryland|pennsylvania|north\s*carolina)\b/i,
    /\b(washington\s*d\.?c\.?|district\s*of\s*columbia)\b/i,
    /(?:,\s*|\b)(?:VA|MD|DC|NC|PA)\b/i,
    /\b(columbia|fairfax|ashburn|college\s*park|gaithersburg|rockville|richmond|baltimore|charlottesville|blacksburg)\b/i,
    /\b2[0-4]\d{3}\b/ // Mid-Atlantic ZIP code prefix range (DC, MD, VA, NC, PA)
];

/**
 * Checks if a location text matches DMV / Mid-Atlantic region.
 */

function parseCandidateDate(datesStr) {
    if (!datesStr || typeof datesStr !== 'string') return null;
    let toParse = datesStr.trim();
    if (toParse.includes('-')) {
        const yearMatch = toParse.match(/\b(20\d{2})\b/);
        const monthMatch = toParse.match(/[A-Za-z]{3,9}/);
        const dayMatch = toParse.match(/\b\d{1,2}\b/);
        if (yearMatch && monthMatch && dayMatch) {
            toParse = `${monthMatch[0]} ${dayMatch[0]}, ${yearMatch[1]}`;
        }
    }
    const d = new Date(toParse);
    return isNaN(d.getTime()) ? null : d;
}

function isDmvRegion(locationText) {
    if (!locationText || typeof locationText !== 'string') return false;
    return DMV_GEO_PATTERNS.some(pattern => pattern.test(locationText));
}

/**
 * Parses TournamentSoftware HTML content into structured event candidates.
 * Handles both tournament listing pages and individual tournament detail pages.
 * @param {string} html Raw HTML response
 * @param {string} baseUrl Optional base URL
 * @returns {Array<Object>} List of parsed tournament candidates
 */
function parseTournamentSoftwareHtml(html, baseUrl = TS_BASE_URL) {
    if (!html || typeof html !== 'string') return [];

    const truncatedHtml = html.slice(0, 200 * 1024);
    let $ = cheerio.load(truncatedHtml);
    const results = [];

    try {
        // Check if this is an individual tournament detail page
        const rawPageTitle = $('title').text().replace(/\|.*$/i, '').trim();
        const pageTitle = sanitizeScrapedTitle(rawPageTitle) || rawPageTitle;
        const isSingleTournamentPage = $('a[href*="/tournament/"], link[rel="canonical"]').length > 0 && pageTitle && !pageTitle.toLowerCase().includes('tournamentsoftware');

        if (isSingleTournamentPage && pageTitle) {
            const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
            const locationElem = $('.location, .venue, .media-body small, .address, .sub-title, p:contains("Club"), p:contains("Center")').first();
            const location = (locationElem.text() || 'Mid-Atlantic / DMV Region').trim();
            
            let dates = '';
            const dateMatch = bodyText.match(/(\w{3,9}\s+\d{1,2}(?:\s*-\s*\d{1,2})?,\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (dateMatch) {
                dates = dateMatch[0];
                const d = parseCandidateDate(dates);
                if (d && (d.getTime() < Date.now() || d.getFullYear() < 2026)) {
                    return results; // Past tournament -> skip
                }
            }

            const isDmv = isDmvRegion(location) || isDmvRegion(bodyText) || isDmvRegion(pageTitle);

            results.push({
                tournamentName: pageTitle,
                sourceUrl: baseUrl,
                sourceType: 'TOURNAMENT_SOFTWARE',
                location: location || 'Mid-Atlantic / DMV Region',
                dates,
                rawSnippet: bodyText.slice(0, 600),
                isDmv
            });
        }

        // TournamentSoftware find/list views typically render items in .media, .tournament-item, table rows, or list-items
        $('.media, tr.tournament-row, .tournament-item, li.media').each((_, elem) => {
            const el = $(elem);

            // Extract title & link
            const linkElem = el.find('a[href*="/tournament/"], a[href*="/sport/"], h4.media-heading a, .title a').first();
            const rawTitle = (linkElem.text() || el.find('.media-heading, .title').text() || '').trim();
            const title = sanitizeScrapedTitle(rawTitle) || rawTitle;
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
                const d = parseCandidateDate(dates);
                if (d && (d.getTime() < Date.now() || d.getFullYear() < 2026)) {
                    return; // Past tournament -> skip
                }
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
    } finally {
        $ = null;
    }

    return results;
}

/**
 * Crawls TournamentSoftware search or page for badminton tournaments.
 * @param {string} query Search query term (e.g., 'Virginia', 'Maryland', 'Capital')
 * @returns {Promise<Array<Object>>} Filtered list of DMV tournaments
 */
async function crawlTournamentSoftware(query = 'Virginia') {
    let response = null;
    let data = null;
    try {
        const searchUrl = `${TS_BASE_URL}/find?q=${encodeURIComponent(query)}&sport=2`;
        response = await axios.get(searchUrl, {
            headers: TS_HEADERS,
            timeout: 10000,
            maxContentLength: 500 * 1024,
            maxBodyLength: 500 * 1024
        });

        data = response.data;
        response = null;

        if (!data) return [];
        const parsed = parseTournamentSoftwareHtml(data, TS_BASE_URL);
        data = null;
        return parsed.filter(item => item.isDmv);
    } catch (err) {
        console.warn(`[TournamentSoftwareCrawler] Search for '${query}' encountered:`, err.message);
        return [];
    } finally {
        response = null;
        data = null;
    }
}

// Known direct Mid-Atlantic tournament candidate URLs on TournamentSoftware
const SEED_TS_TOURNAMENT_URLS = [
    {
        url: 'https://www.tournamentsoftware.com/tournament/29B5BFFA-ED41-49F5-8294-1E1F54A8D8A5',
        name: '2026 Mid-Atlantic Collegiate Team Badminton Championships (Fall Playoff)',
        location: 'Capital Badminton Academy, Columbia, MD 21045',
        dates: 'Oct 24 - 25, 2026'
    }
];

/**
 * Hunts TournamentSoftware for all DMV targets and enqueues new discoveries into DiscoveryQueue.
 * @returns {Promise<{ discovered: number, items: Array<Object> }>}
 */
async function huntTournamentSoftwareAndEnqueue() {
    console.log('🏸 [TS Crawler] Starting TournamentSoftware autonomous hunt...');
    const candidates = [];

    // 1. Process known direct Mid-Atlantic tournament candidates
    for (const seed of SEED_TS_TOURNAMENT_URLS) {
        candidates.push({
            tournamentName: seed.name,
            sourceUrl: seed.url,
            sourceType: 'TOURNAMENT_SOFTWARE',
            location: seed.location,
            dates: seed.dates,
            rawSnippet: `[${seed.name}] Hosted at ${seed.location}. Competition Dates: ${seed.dates}. Official registration and brackets on TournamentSoftware.`,
            isDmv: true
        });
    }

    // 2. Crawl active badminton listing
    const queries = ['Virginia', 'Maryland', 'Capital'];
    for (const q of queries) {
        const found = await crawlTournamentSoftware(q);
        for (const item of found) {
            if (!candidates.some(c => c.sourceUrl === item.sourceUrl)) {
                candidates.push(item);
            }
        }
        await new Promise(r => setImmediate(r));
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
        } finally {
            await new Promise(r => setImmediate(r));
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
