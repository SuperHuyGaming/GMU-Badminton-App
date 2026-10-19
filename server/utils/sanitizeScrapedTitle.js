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
const STRIP_PREFIX_PATTERNS = [
    /^Skip\s+to\s+(main\s+)?content\s*/i,
    /^Navigation\s+Menu\s*/i,
    /^Menu\s*/i,
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
    /\bSign\s+up\s+now\s+CBA-/i,
    /\bTraining\s+Packages\s*CBA-/i,
    /\bDrop-In\s+Booking/i,
    /\bCourt\s+Rental\s+(Columbia|Gaithersburg|Rockville)\b/i,
    /\bComing\s+soon\b/i,
];

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

    // If the result still looks like a nav block, discard it
    for (const pattern of NAV_SEQUENCE_PATTERNS) {
        if (pattern.test(title)) {
            return null;
        }
    }

    // Discard if too long (likely a paragraph of scraped content)
    if (title.length > MAX_TITLE_LENGTH) {
        // Try to rescue just the first sentence/clause if it's short enough
        const firstClause = title.split(/[.;|–—]/)[0].trim();
        if (firstClause && firstClause.length <= MAX_TITLE_LENGTH) {
            title = firstClause;
        } else {
            return null;
        }
    }

    // Final guard: empty after cleaning
    if (!title) return null;

    return title;
}

module.exports = { sanitizeScrapedTitle };
