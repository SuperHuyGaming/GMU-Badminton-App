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
    /^Tournament\s*Software\s*[-|:]?\s*/i,
    /^Home\s*[-|:]\s*/i,
];

/**
 * Navigation boilerplate and marketing slogans that should be stripped
 * from within the title string rather than discarding the entire tournament.
 */
const INLINE_DEBRIS_PATTERNS = [
    /\bSkip\s+to\s+(main\s+)?content\b/gi,
    /\bNavigation\s+Menu\b/gi,
    /\bMenu\s+Select(?:\s+Your\s+Sport)?\b/gi,
    /\bSelect\s+Your\s+Sport\b/gi,
    /\b(?:a\s+)?smashing\s+sport(?:\s+for\s+all\s+ages)?\b/gi,
    /\bHome\s+News(?:\s+Registration)?\b/gi,
    /\bRegistration\s+Payment\s+Location\b/gi,
    /\bSign\s+up\s+now\b/gi,
    /\bTraining\s+Packages\b/gi,
    /\bDrop-In\s+Booking\b/gi,
    /\bCourt\s+Rental\b/gi,
    /\bComing\s+soon\b/gi,
    /\bResults\s+pages\s+on\s+the\s+left\b/gi,
    /\bMascot\s+Competition\b/gi,
    /\bLog\s+In(?:\s+Menu)?\b/gi,
    /\bRecWell\s+Intramural\b/gi,
    /\brule\s+assumptions\b/gi,
    /\bDates\s+of\s+Play\b/gi,
    /\bTournament\s*Software\b/gi,
    /\bRegister\s+Now\b/gi,
    /\bPowered\s+by\s+[A-Za-z0-9_-]+\b/gi,
    /\bWelcome(?:\s+to(?:\s+the)?(?:\s+official)?(?:\s+tournament)?)?\b/gi,
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

    // Reject non-badminton sports if "badminton" is not explicitly mentioned in the title
    if (NON_BADMINTON_SPORTS.test(title) && !/badminton/i.test(title)) {
        return null;
    }

    // Strip known boilerplate prefixes iteratively
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

    // Strip inline debris patterns globally without discarding the whole tournament
    for (const pattern of INLINE_DEBRIS_PATTERNS) {
        title = title.replace(pattern, ' ');
    }

    // Clean orphaned delimiters and normalize whitespace, preserving intra-word slashes like A/B/C
    title = title
        .replace(/\s*[|•–—]+\s*/g, ' - ')
        .replace(/\s+\/\s+/g, ' - ')
        .replace(/(\s*-\s*){2,}/g, ' - ')
        .replace(/^[\s|:–—•/-]+|[\s|:–—•/-]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

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

    // Final guard: empty, too short, or lacks alphanumeric characters
    if (!title || title.length < 5 || !/[a-zA-Z0-9]/.test(title)) return null;

    // Discard pure navigation, menu, or facility UI boilerplate
    const PURE_UI_JUNK = /^(menu|home|login|log\\s*in|sign\\s*in|sign\\s*up(?:\\s*now)?|training(?:\\s*packages?)?|drop-in(?:\\s*booking)?|court\\s*rental|hours|schedule|about(?:\\s*us)?|contact(?:\\s*us)?|news|events?|badminton|court|rac|skip\\s*to\\s*content)$/i;
    if (PURE_UI_JUNK.test(title)) return null;

    return title;
}

module.exports = { sanitizeScrapedTitle };
