/**
 * sanitizeScrapedTitle.js
 *
 * Cleans boilerplate HTML navigation text that the scraper sometimes captures
 * when a tournament page lacks a clearly scoped <h1> or og:title tag.
 *
 * Usage:
 *   const { sanitizeScrapedTitle } = require('./sanitizeScrapedTitle');
 *   const name = sanitizeScrapedTitle(rawTitle);
 */

/**
 * Ordered list of regex patterns to strip from the beginning of a scraped title.
 * These are fired left-to-right so broad patterns come first.
 */
/**
 * Ordered list of regex patterns to strip from the beginning of a scraped title.
 * These are fired left-to-right so broad patterns come first.
 */
const STRIP_PREFIX_PATTERNS = [
    /^Skip\s+to\s+(main\s+)?content\s*/i,
    /^Navigation\s+Menu\s*/i,
    /^Menu\s*(Select\s+Your\s+Sport\s+)?/i,
    /^Home\s+News\s+/i,
];

/**
 * Patterns of typical nav-link sequences that indicate the captured "title" is
 * actually a block of navigation text rather than a proper tournament name.
 * If the cleaned string still contains these sequences it is likely garbage.
 */
const NAV_SEQUENCE_PATTERNS = [
    /\bHome\s+News\s+Registration\b/i,
    /\bRegistration\s+Payment\s+Location\b/i,
    /\bSign\s+up\s+now\b/i,
    /\bTraining\s+Packages\b/i,
    /\bDrop-In\s+Booking/i,
    /\bCourt\s+Rental\b/i,
    /\bComing\s+soon\b/i,
    /\bResults\s+pages\s+on\s+the\s+left\b/i,
    /\bMascot\s+Competition\b/i,
    /\bSelect\s+Your\s+Sport\b/i,
    /\ba\s+smashing\s+sport\s+for\s+all\s+ages\b/i,
    /\bLog\s+In\b/i,
    /\bRecWell\s+Intramural\b/i,
    /\brule\s+assumptions\b/i,
    /\bDates\s+of\s+Play\b/i,
];

/**
 * Other sports keywords. If present and "badminton" is not explicitly mentioned,
 * the item is rejected as non-badminton spam.
 */
const NON_BADMINTON_SPORTS = /\b(golf|basketball|baseball|soccer|football|pickleball|swimming|running)\b/i;

/**
 * Maximum character length for a tournament name. Strings beyond this
 * are almost certainly a scraped paragraph rather than a title.
 */
const MAX_TITLE_LENGTH = 120;

/**
 * Sanitizes a raw scraped string into a clean tournament name.
 *
 * @param {string} raw - Raw string captured by the scraper.
 * @returns {string|null} - Cleaned tournament name, or null if the string
 *                          cannot be salvaged (caller should skip or flag it).
 */
function sanitizeScrapedTitle(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let title = raw.trim();

    // If the title contains known nav/UI sequences or error text, discard it
    for (const pattern of NAV_SEQUENCE_PATTERNS) {
        if (pattern.test(title)) {
            return null;
        }
    }

    // Reject non-badminton sports if "badminton" is not explicitly mentioned in the title
    if (NON_BADMINTON_SPORTS.test(title) && !/badminton/i.test(title)) {
        return null;
    }

    // Strip known boilerplate prefixes iteratively until none match
    let changed = true;
    while (changed) {
        changed = false;
        for (const pattern of STRIP_PREFIX_PATTERNS) {
            const stripped = title.replace(pattern, '').trim();
            if (stripped !== title) {
                title = stripped;
                changed = true;
                break;
            }
        }
    }

    // Discard if too long (likely a paragraph of scraped content)
    if (title.length > MAX_TITLE_LENGTH) {
        // Try to rescue just the first sentence/clause if it's clean and bounded
        const firstClause = title.split(/[.;|–—]/)[0].trim();
        if (firstClause && firstClause.length <= MAX_TITLE_LENGTH && firstClause.length >= 8) {
            title = firstClause;
        } else {
            return null;
        }
    }

    // Final guard: empty or too short after cleaning
    if (!title || title.length < 3) return null;

    return title;
}

module.exports = { sanitizeScrapedTitle };
