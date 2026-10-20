/**
 * campusGroupsBypass.js / Bio Link & Registration Resolver
 *
 * User Clarification Directives:
 * 1. Ingestion sources are Instagram (club handles, post captions, flyer media) and Linktree
 *    (or bio links leading to registration Google Forms), handled by instagramScraper.js and autonomousHunter.js.
 * 2. Mason360 is NOT an external ingestion source—do NOT build scraping/auth bypasses targeting Mason360.
 * 3. Resolves and extracts registration links from Linktree, Beacons, Google Forms, and TournamentSoftware.
 * 4. Provides RFC 5545 iCalendar stream parsing for structured event data.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { sanitizeScrapedTitle } = require('./sanitizeScrapedTitle');

const RESOLVER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

/**
 * Checks if a URL is a Mason360 / CampusGroups URL.
 * Per user directives, Mason360 is NOT an external ingestion source.
 * @param {string} url
 * @returns {boolean}
 */
function isCampusGroupsUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.includes('campusgroups.com') || lower.includes('mason360.gmu.edu');
}

/**
 * Checks if a URL is a social bio aggregator (Linktree, Beacons, Bio.link, etc.).
 * @param {string} url
 * @returns {boolean}
 */
function isBioLink(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.includes('linktr.ee') ||
           lower.includes('beacons.ai') ||
           lower.includes('bio.link') ||
           lower.includes('linkin.bio');
}

/**
 * Scrapes a Linktree or social bio page to extract external tournament registration links
 * (Google Forms, TournamentSoftware, event forms).
 * @param {string} bioUrl
 * @returns {Promise<Array<string>>} List of resolved registration form URLs
 */
async function resolveBioLinkRegistration(bioUrl) {
    if (!bioUrl || typeof bioUrl !== 'string') return [];
    
    let response = null;
    let $ = null;
    try {
        response = await axios.get(bioUrl, {
            headers: RESOLVER_HEADERS,
            timeout: 5000,
            maxContentLength: 500 * 1024,
            maxBodyLength: 500 * 1024
        });

        const rawHtml = typeof response.data === 'string' ? response.data.slice(0, 200 * 1024) : '';
        response = null;

        $ = cheerio.load(rawHtml);
        const registrationLinks = [];

        $('a').each((_, elem) => {
            const href = $(elem).attr('href');
            if (!href) return;
            const lower = href.toLowerCase();

            // Match Google Forms, TournamentSoftware, and tournament registration portals
            if (
                lower.includes('forms.gle') ||
                lower.includes('docs.google.com/forms') ||
                lower.includes('tournamentsoftware.com') ||
                (lower.includes('register') && (lower.includes('tournament') || lower.includes('badminton')))
            ) {
                if (!registrationLinks.includes(href)) {
                    registrationLinks.push(href);
                }
            }
        });

        return registrationLinks;
    } catch (err) {
        console.warn(`[BioLinkResolver] Failed to resolve bio link ${bioUrl}:`, err.message);
        return [];
    } finally {
        $ = null;
        response = null;
    }
}

/**
 * Parses RFC 5545 iCalendar (.ics) stream content into structured tournament event objects.
 * Supports line unfolding, standard VEVENT property extraction, and unescaping.
 * @param {string} icsContent
 * @param {string} [sourceUrl]
 * @returns {Array<Object>}
 */
function parseIcsContent(icsContent, sourceUrl = '') {
    if (!icsContent || typeof icsContent !== 'string') return [];

    // Line unfolding according to RFC 5545 (lines folded with CRLF + space or tab)
    const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    const events = [];
    let currentEvent = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent) {
                // Normalize dates
                let startDate = null;
                let endDate = null;

                if (currentEvent.DTSTART) {
                    const parsed = parseIcsDate(currentEvent.DTSTART);
                    if (parsed) startDate = parsed;
                }
                if (currentEvent.DTEND) {
                    const parsed = parseIcsDate(currentEvent.DTEND);
                    if (parsed) endDate = parsed;
                } else if (startDate) {
                    endDate = new Date(startDate.getTime() + (8 * 60 * 60 * 1000));
                }

                const rawSummary = currentEvent.SUMMARY || 'Collegiate Badminton Tournament';
                const tournamentName = sanitizeScrapedTitle(rawSummary) || rawSummary;

                events.push({
                    tournamentName,
                    startDate,
                    endDate,
                    eventLocation: currentEvent.LOCATION || 'Fairfax, VA',
                    registrationUrl: currentEvent.URL || sourceUrl,
                    sourceUrl: sourceUrl || currentEvent.URL || '',
                    rawCaption: currentEvent.DESCRIPTION || '',
                    sourceType: 'CALENDAR_ICS',
                    confidenceScore: 95,
                    isValidDmvTournament: true
                });
            }
            currentEvent = null;
        } else if (currentEvent) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const rawKey = line.slice(0, colonIndex);
                const key = rawKey.split(';')[0].toUpperCase().trim();
                const rawVal = line.slice(colonIndex + 1);
                // Unescape backslash sequences
                const val = rawVal.replace(/\\([,;nN\\])/g, (_, char) => {
                    if (char === 'n' || char === 'N') return '\n';
                    return char;
                }).trim();

                currentEvent[key] = val;
            }
        }
    }

    return events;
}

/**
 * Parses RFC 5545 date string into a Date object.
 * Supports: YYYYMMDDTHHMMSSZ, YYYYMMDDTHHMMSS, YYYYMMDD.
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseIcsDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();

    // UTC timestamp: 20261025T140000Z
    const utcMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (utcMatch) {
        const [, year, month, day, hour, min, sec] = utcMatch;
        return new Date(Date.UTC(+year, +month - 1, +day, +hour, +min, +sec));
    }

    // Local timestamp: 20261025T140000
    const localMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
    if (localMatch) {
        const [, year, month, day, hour, min, sec] = localMatch;
        return new Date(+year, +month - 1, +day, +hour, +min, +sec);
    }

    // Date only: 20261025
    const dateMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (dateMatch) {
        const [, year, month, day] = dateMatch;
        return new Date(+year, +month - 1, +day);
    }

    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Fallback bypass handler:
 * Respects user clarification that Mason360 is not an external ingestion source.
 * If given a Linktree/bio link, resolves Google Forms or registration links.
 * If given an .ics feed URL, parses calendar feed.
 * @param {string} sourceUrl
 * @param {string} [rawHtml]
 * @returns {Promise<Object|null>}
 */
async function bypassCampusGroupsSso(sourceUrl, rawHtml = '') {
    if (!sourceUrl || typeof sourceUrl !== 'string') return null;

    // Per user directive: Mason360 is not an ingestion source
    if (isCampusGroupsUrl(sourceUrl)) {
        console.log(`[Bypass] Mason360 URL detected (${sourceUrl}). Mason360 is not an external ingestion target (per user directive: use Instagram/Linktree).`);
        return {
            isIgnored: true,
            reason: "Mason360 is not an external ingestion source; use Instagram and Linktree instead."
        };
    }

    // If sourceUrl is a Linktree or social bio link, resolve registration forms
    if (isBioLink(sourceUrl)) {
        const forms = await resolveBioLinkRegistration(sourceUrl);
        if (forms.length > 0) {
            return {
                registrationUrl: forms[0],
                sourceUrl: sourceUrl,
                allRegistrationForms: forms
            };
        }
    }

    // If sourceUrl is an .ics feed or rawHtml contains iCalendar data
    if (sourceUrl.endsWith('.ics') || (rawHtml && rawHtml.includes('BEGIN:VCALENDAR'))) {
        try {
            let icsText = rawHtml;
            if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
                const res = await axios.get(sourceUrl, {
                    headers: RESOLVER_HEADERS,
                    timeout: 5000,
                    maxContentLength: 500 * 1024,
                    maxBodyLength: 500 * 1024
                });
                icsText = typeof res.data === 'string' ? res.data : '';
            }
            const parsedEvents = parseIcsContent(icsText, sourceUrl);
            if (parsedEvents.length > 0) {
                return parsedEvents[0];
            }
        } catch (err) {
            console.warn(`[Bypass] Failed to fetch .ics from ${sourceUrl}:`, err.message);
        }
    }

    return null;
}

module.exports = {
    isCampusGroupsUrl,
    isBioLink,
    resolveBioLinkRegistration,
    parseIcsContent,
    parseIcsDate,
    bypassCampusGroupsSso
};
