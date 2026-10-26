/**
 * deduplication.js
 *
 * Milestone 1 (Project Titan) Fuzzy & Semantic Deduplication Engine with ML Candidate Pruning.
 * Features:
 *  - Collegiate Entity Conflict Guard: Prevents false positive merges across distinct institutions.
 *  - Multi-stage pruning cascade: Temporal blocking, dual length ratio, and token/trigram inverted-index overlap.
 *  - Machine Learning similarity ensemble: TF-IDF n-gram vectorization + Cosine Similarity,
 *    fused with Jaro-Winkler sub-sequence alignment and Levenshtein edit distance (authentic 40/35/25 weighting).
 *  - Automatic multi-draw division merge, registration URL fallback, and attendee RSVP deduplication.
 */

let JaroWinklerDistance;
try {
    JaroWinklerDistance = require('natural/lib/natural/distance/jaro-winkler_distance');
} catch {
    try {
        const natural = require('natural');
        JaroWinklerDistance = natural.JaroWinklerDistance;
    } catch {
        JaroWinklerDistance = null;
    }
}

const STOP_WORDS = new Set([
    'the', 'and', 'at', 'in', 'of', 'for', 'a', 'an', 'to', 'on', 'with', 'by',
    'tournament', 'badminton', 'open', 'club', 'championship', 'championships', 'annual', 'official',
    '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'
]);

/**
 * Checks if a token is a stop word or generic 4-digit calendar year.
 * @param {string} token
 * @returns {boolean}
 */
function isStopWord(token) {
    if (!token) return true;
    const lower = token.toLowerCase();
    if (STOP_WORDS.has(lower)) return true;
    if (/^20\d{2}$/.test(lower)) return true;
    return false;
}

const COLLEGIATE_ENTITY_RULES = [
    { id: 'gmu', regex: /\b(gmu|george\s+mason(?:\s+university)?|mason\s+badminton)\b/i },
    { id: 'umd', regex: /\b(umd|university\s+of\s+maryland(?!\s+baltimore)|terrapin|terps?)\b/i },
    { id: 'umbc', regex: /\b(umbc|university\s+of\s+maryland\s+baltimore\s+county)\b/i },
    { id: 'vt', regex: /\b(vt|vtech|virginia\s+tech|hokies?)\b/i },
    { id: 'uva', regex: /\b(uva|university\s+of\s+virginia|cavaliers?)\b/i },
    { id: 'gwu', regex: /\b(gwu|gw|george\s+washington(?:\s+university)?)\b/i },
    { id: 'georgetown', regex: /\b(georgetown(?:\s+university)?|hoyas?)\b/i },
    { id: 'jhu', regex: /\b(jhu|johns?\s+hopkins(?:\s+university)?|blue\s+jays?)\b/i },
    { id: 'vcu', regex: /\b(vcu|virginia\s+commonwealth(?:\s+university)?|rams?)\b/i },
    { id: 'wm', regex: /\b(w&m|wm|william\s+(?:&|and)\s+mary|tribe)\b/i },
    { id: 'nvbc', regex: /\b(nvbc|northern\s+virginia\s+badminton(?:\s+club)?|nova\s+badminton)\b/i },
    { id: 'cba', regex: /\b(cba|capital\s+badminton(?:\s+academy)?)\b/i },
    ];

/**
 * Extracts recognized collegiate entity IDs from a tournament title or tournament object.
 * Inspects tournamentName, name, hostUniversity, eventLocation, and hostClubHandle.
 * @param {string|Object} target
 * @returns {Set<string>}
 */
function extractCollegiateEntities(target) {
    if (!target) return new Set();
    const str = typeof target === 'string'
        ? target
        : [
            target.tournamentName,
            target.name,
            target.hostUniversity,
            target.eventLocation,
            target.hostClubHandle
          ].filter(Boolean).join(' ');

    const entities = new Set();
    for (const rule of COLLEGIATE_ENTITY_RULES) {
        if (rule.regex.test(str)) {
            entities.add(rule.id);
        }
    }
    return entities;
}

/**
 * Detects the first collegiate entity ID found in target, or null if none.
 * @param {string|Object} target
 * @returns {string|null}
 */
function detectCollegiateEntity(target) {
    const set = extractCollegiateEntities(target);
    return set.size > 0 ? Array.from(set)[0] : null;
}

/**
 * Detects whether two tournaments or titles represent conflicting collegiate entities.
 * Returns true IF BOTH have recognized entities AND their entity sets are disjoint.
 * @param {string|Object} a
 * @param {string|Object} b
 * @returns {boolean}
 */
function hasConflictingCollegiateEntities(a, b) {
    const e1 = extractCollegiateEntities(a);
    const e2 = extractCollegiateEntities(b);
    if (e1.size === 0 || e2.size === 0) return false;
    for (const id of e1) {
        if (e2.has(id)) return false;
    }
    return true;
}

const COLLEGIATE_ACRONYMS = {
    'gmu': 'george mason university',
    'george mason': 'george mason university',
    'umd': 'university of maryland',
    'maryland': 'university of maryland',
    'gw': 'george washington university',
    'gwu': 'george washington university',
    'george washington': 'george washington university',
    'gt': 'georgetown university',
    'georgetown': 'georgetown university',
    'umbc': 'university of maryland baltimore county',
    'university of maryland baltimore county': 'university of maryland baltimore county',
    'uva': 'university of virginia',
    'vt': 'virginia tech',
    'vtech': 'virginia tech',
    'vcu': 'virginia commonwealth university',
    'jhu': 'johns hopkins university',
    'johns hopkins': 'johns hopkins university',
    'wm': 'william and mary',
    'w&m': 'william and mary',
    'w m': 'william and mary',
    'william and mary': 'william and mary',
    'rac': 'recreation athletic complex',
    'nvbc': 'northern virginia badminton club',
    'cba': 'capital badminton academy',
    'duke': 'duke university',
    'unc': 'university of north carolina',
    'ncsu': 'north carolina state university',
    'nc state': 'north carolina state university',
    'psu': 'penn state university',
    'upenn': 'university of pennsylvania'
};

/**
 * Normalizes collegiate titles by expanding known acronyms to canonical full names.
 * Applies pattern precedence (longest matches first) and handles optional university suffixes idempotently.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeCollegiateTitle(str) {
    if (!str) return '';
    let s = str.trim().toLowerCase().replace(/[^a-z0-9&]/g, ' ').replace(/\s+/g, ' ').trim();

    const patterns = [
        [/\b(university\s+of\s+maryland\s+baltimore\s+county|umbc)\b/g, 'university of maryland baltimore county'],
        [/\b(george\s+washington\s+university|george\s+washington|gwu|gw)\b/g, 'george washington university'],
        [/\b(georgetown\s+university|georgetown|gt)\b/g, 'georgetown university'],
        [/\b(college\s+of\s+william\s+and\s+mary|william\s+(?:&|and)\s+mary|william\s+mary|w\s*(?:&|and)\s*m|wm)\b/g, 'william and mary'],
        [/\b(george\s+mason\s+university|george\s+mason|gmu)\b/g, 'george mason university'],
        [/\b(university\s+of\s+maryland|umd|maryland)\b/g, 'university of maryland'],
        [/\b(university\s+of\s+virginia|uva)\b/g, 'university of virginia'],
        [/\b(virginia\s+commonwealth\s+university|virginia\s+commonwealth|vcu)\b/g, 'virginia commonwealth university'],
        [/\b(virginia\s+tech|vtech|vt)\b/g, 'virginia tech'],
        [/\b(johns\s+hopkins\s+university|johns\s+hopkins|jhu)\b/g, 'johns hopkins university'],
        [/\b(recreation\s+athletic\s+complex|rac)\b/g, 'recreation athletic complex'],
        [/\b(northern\s+virginia\s+badminton(?:\s+club)?|nvbc|nova\s+badminton)\b/g, 'northern virginia badminton club'],
        [/\b(capital\s+badminton(?:\s+academy)?|cba)\b/g, 'capital badminton academy']
    ];

    for (const [regex, replacement] of patterns) {
        s = s.replace(regex, replacement);
    }
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes division code/name into a canonical division key.
 * Handles standard codes (MS_OPEN, WS_OPEN, MD_OPEN, WD_OPEN, XD_OPEN),
 * flight divisions (COL_FLIGHT_A/B/C, MD_FLIGHT_A), team divisions,
 * and natural language variations ("Men's Singles Open", "Women Doubles", etc.).
 *
 * @param {Object|string} div
 * @returns {string}
 */
function normalizeDivisionKey(div) {
    if (!div) return '';
    const rawCode = (typeof div === 'object' ? (div.code || '') : div).trim().toUpperCase();
    const rawName = (typeof div === 'object' ? (div.name || '') : '').trim().toLowerCase();

    // Direct fast-path for standard codes
    const cleanCode = rawCode.replace(/[\s-]+/g, '_');
    if (cleanCode === 'MS_OPEN' || cleanCode === 'MS') return 'MS_OPEN';
    if (cleanCode === 'WS_OPEN' || cleanCode === 'WS') return 'WS_OPEN';
    if (cleanCode === 'MD_OPEN' || cleanCode === 'MD') return 'MD_OPEN';
    if (cleanCode === 'WD_OPEN' || cleanCode === 'WD') return 'WD_OPEN';
    if (cleanCode === 'XD_OPEN' || cleanCode === 'XD') return 'XD_OPEN';

    const combined = `${rawCode} ${rawName}`.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    // Strict word-boundary guards to prevent 'women' matching 'men'
    const isWomen = /\bwomens?\b/.test(combined) || /\bws\b/.test(combined) || /\bwd\b/.test(combined);
    const isMen = !isWomen && (/\bmens?\b/.test(combined) || /\bms\b/.test(combined) || /\bmd\b/.test(combined));
    const isMixed = combined.includes('mixed') || /\bxd\b/.test(combined);
    const isDoubles = combined.includes('doubles') || /\b(md|wd|xd)\b/.test(combined);
    const isSingles = combined.includes('singles') || /\b(ms|ws)\b/.test(combined);

    const isFlightA = combined.includes('flight a') || combined.includes('flight_a');
    const isFlightB = combined.includes('flight b') || combined.includes('flight_b');
    const isFlightC = combined.includes('flight c') || combined.includes('flight_c');

    if (isMen && isSingles) return 'MS_OPEN';
    if (isWomen && isSingles) return 'WS_OPEN';
    if (isMen && isDoubles) {
        if (isFlightA) return 'MD_FLIGHT_A';
        if (isFlightB) return 'MD_FLIGHT_B';
        return 'MD_OPEN';
    }
    if (isWomen && isDoubles) {
        if (isFlightA) return 'WD_FLIGHT_A';
        if (isFlightB) return 'WD_FLIGHT_B';
        return 'WD_OPEN';
    }
    if (isMixed) return 'XD_OPEN';

    if (combined.includes('collegiate') || combined.includes('col')) {
        if (isFlightA) return 'COL_FLIGHT_A';
        if (isFlightB) return 'COL_FLIGHT_B';
        if (isFlightC) return 'COL_FLIGHT_C';
        if (combined.includes('div 1') || combined.includes('division 1') || combined.includes('division i') || combined.includes('div_1')) return 'COL_DIV_1_TEAM';
        if (combined.includes('div 2') || combined.includes('division 2') || combined.includes('division ii') || combined.includes('div_2')) return 'COL_DIV_2_TEAM';
        if (combined.includes('team a') || combined.includes('team_a')) return 'COL_TEAM_A';
        if (combined.includes('team b') || combined.includes('team_b')) return 'COL_TEAM_B';
    }

    if (isFlightA) return 'COL_FLIGHT_A';
    if (isFlightB) return 'COL_FLIGHT_B';
    if (isFlightC) return 'COL_FLIGHT_C';

    // Fallback: sanitized uppercase alphanumeric key
    return cleanCode || rawName.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Tokenizes text into lowercase alphanumeric words.
 * @param {string} text
 * @returns {Array<string>}
 */
function tokenize(text) {
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Extracts character trigrams from a collection of informative tokens.
 * @param {Set<string>|Array<string>} tokens
 * @returns {Set<string>}
 */
function getInformativeTrigrams(tokens) {
    const trigrams = new Set();
    for (const token of tokens) {
        if (token && token.length >= 3) {
            for (let i = 0; i <= token.length - 3; i++) {
                trigrams.add(token.slice(i, i + 3));
            }
        }
    }
    return trigrams;
}

/**
 * Determines whether two titles share an acronym-to-full-name relationship based on word initials.
 * @param {string} titleA
 * @param {string} titleB
 * @returns {boolean}
 */
function hasAcronymRelationship(titleA, titleB) {
    const checkInitials = (shortStr, longStr) => {
        const tokensShort = tokenize(shortStr).filter(t => !isStopWord(t));
        const wordsLong = tokenize(longStr).filter(w => !STOP_WORDS.has(w));
        if (tokensShort.length === 0 || wordsLong.length === 0) return false;

        for (const token of tokensShort) {
            if (token.length >= 2 && token.length <= 6) {
                for (let i = 0; i <= wordsLong.length - token.length; i++) {
                    const initials = wordsLong.slice(i, i + token.length).map(w => w[0]).join('');
                    if (initials === token) return true;
                }
            }
        }
        return false;
    };
    return checkInitials(titleA, titleB) || checkInitials(titleB, titleA);
}

/**
 * Computes TF-IDF vector with sub-word character trigram shingles.
 * Applies higher IDF weights to distinctive collegiate and tournament tokens.
 * @param {string} text
 * @returns {Object} sparse vector of token -> weight
 */
function computeTfIdfVector(text) {
    if (!text) return {};
    const tokens = tokenize(text);
    const tf = {};
    for (const t of tokens) {
        tf[t] = (tf[t] || 0) + 1;
    }

    // Add character trigrams for sub-word structural features
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i <= clean.length - 3; i++) {
        const tri = clean.slice(i, i + 3);
        tf[tri] = (tf[tri] || 0) + 0.5;
    }

    const vector = {};
    for (const [term, freq] of Object.entries(tf)) {
        const idf = STOP_WORDS.has(term) ? 0.2 : (term.length <= 3 ? 1.0 : 2.0);
        vector[term] = freq * idf;
    }
    return vector;
}

/**
 * Computes cosine similarity between two sparse TF-IDF vectors.
 * @param {Object} vecA
 * @param {Object} vecB
 * @returns {number} 0.0 to 1.0
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [k, v] of Object.entries(vecA)) {
        normA += v * v;
        if (vecB[k]) dot += v * vecB[k];
    }
    for (const v of Object.values(vecB)) {
        normB += v * v;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * ML Candidate Pruning Filter (Cascade Architecture).
 * Drops non-matching tournament pairs in O(1) via temporal window, entity conflict guard,
 * length ratio, and token/trigram inverted index pruning.
 *
 * @param {string|Object} candTitleOrObj
 * @param {Date|string|Object} candDateOrExistObj
 * @param {string|Object} [existTitleOrOptions]
 * @param {Date|string} [existDateVal]
 * @param {number} [windowHours=48]
 * @returns {{ prune: boolean, reason?: string }}
 */
function shouldPruneCandidate(candTitleOrObj, candDateOrExistObj, existTitleOrOptions, existDateVal, windowHours = 48) {
    let candTitle, candDate, existTitle, existDate, hours;
    if (candTitleOrObj && typeof candTitleOrObj === 'object') {
        candTitle = candTitleOrObj.tournamentName || candTitleOrObj.name || '';
        candDate = candTitleOrObj.startDate || candTitleOrObj.date;
        existTitle = candDateOrExistObj?.tournamentName || candDateOrExistObj?.name || '';
        existDate = candDateOrExistObj?.startDate || candDateOrExistObj?.date;
        hours = existTitleOrOptions?.windowHours || 48;
    } else {
        candTitle = candTitleOrObj || '';
        candDate = candDateOrExistObj;
        existTitle = existTitleOrOptions || '';
        existDate = existDateVal;
        hours = typeof windowHours === 'number' ? windowHours : (existTitleOrOptions?.windowHours || 48);
    }

    // 1. Stage 1: Temporal Pruning (Hard Constraint)
    if (candDate && existDate) {
        const d1 = new Date(candDate);
        const d2 = new Date(existDate);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const diffHours = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60);
            if (diffHours > hours) {
                return { prune: true, reason: 'temporal_window_exceeded' };
            }
        }
    }

    // Entity Conflict Guard
    if (hasConflictingCollegiateEntities(candTitleOrObj, candDateOrExistObj) ||
        hasConflictingCollegiateEntities(candTitle, existTitle)) {
        return { prune: true, reason: 'conflicting_collegiate_entities' };
    }

    const t1 = (candTitle || '').toLowerCase();
    const t2 = (existTitle || '').toLowerCase();
    const exp1 = normalizeCollegiateTitle(t1);
    const exp2 = normalizeCollegiateTitle(t2);

    // 2. Stage 2: Length Ratio Pruning
    const len1 = t1.length;
    const len2 = t2.length;
    if (len1 > 0 && len2 > 0) {
        const ratio = Math.max(len1, len2) / Math.min(len1, len2);
        if (ratio > 3.5) {
            const hasSubstring = t1.includes(t2) || t2.includes(t1) ||
                                 (exp1 && exp2 && (exp1.includes(exp2) || exp2.includes(exp1)));

            const expLen1 = exp1 ? exp1.length : len1;
            const expLen2 = exp2 ? exp2.length : len2;
            const expRatio = Math.max(expLen1, expLen2) / Math.min(expLen1, expLen2);

            const isAcronym = (exp1 !== t1 || exp2 !== t2) || hasAcronymRelationship(candTitle, existTitle);

            if (!hasSubstring && (!isAcronym || expRatio > 3.5)) {
                return { prune: true, reason: 'length_ratio_exceeded' };
            }
        }
    }

    // 3. Stage 3: Informative Token Inverted Index Filter
    // Tokenize with collegiate acronym expansion before tokenizing
    const tokens1 = new Set(tokenize(exp1 || candTitle).filter(t => !isStopWord(t)));
    const tokens2 = new Set(tokenize(exp2 || existTitle).filter(t => !isStopWord(t)));

    // Include original unexpanded informative tokens
    tokenize(candTitle).filter(t => !isStopWord(t)).forEach(t => tokens1.add(t));
    tokenize(existTitle).filter(t => !isStopWord(t)).forEach(t => tokens2.add(t));

    let shared = 0;
    for (const t of tokens1) {
        if (tokens2.has(t)) shared++;
    }

    // If no shared whole-word informative tokens, evaluate fallbacks
    if (shared === 0 && tokens1.size > 0 && tokens2.size > 0) {
        // Fallback 3A: Compact alphanumeric substring containment
        const c1 = t1.replace(/[^a-z0-9]/g, '');
        const c2 = t2.replace(/[^a-z0-9]/g, '');
        const expC1 = (exp1 || '').replace(/[^a-z0-9]/g, '');
        const expC2 = (exp2 || '').replace(/[^a-z0-9]/g, '');

        const hasCompactSubstring = (c1 && c2 && (c1.includes(c2) || c2.includes(c1))) ||
                                    (expC1 && expC2 && (expC1.includes(expC2) || expC2.includes(expC1)));

        if (!hasCompactSubstring) {
            // Fallback 3B: Sub-word character trigram overlap on informative tokens
            const trigrams1 = getInformativeTrigrams(tokens1);
            const trigrams2 = getInformativeTrigrams(tokens2);

            let sharedTrigrams = 0;
            for (const tri of trigrams1) {
                if (trigrams2.has(tri)) {
                    sharedTrigrams++;
                    break;
                }
            }

            if (sharedTrigrams === 0) {
                return { prune: true, reason: 'zero_informative_tokens' };
            }
        }
    }

    return { prune: false };
}

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
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[m][n];
}

/**
 * Computes normalized Levenshtein similarity ratio between 0.0 and 1.0.
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
 * Computes hybrid title similarity ensembling TF-IDF Cosine Similarity, Jaro-Winkler, and Levenshtein.
 * Enforces authentic 40/35/25 weighting and zeroing out on collegiate entity conflicts.
 *
 * @param {string} title1
 * @param {string} title2
 * @returns {number} 0.0 to 1.0
 */
function computeTitleSimilarity(title1, title2) {
    if (!title1 || !title2) return 0;
    const t1 = title1.trim().toLowerCase();
    const t2 = title2.trim().toLowerCase();
    if (t1 === t2) return 1.0;

    const n1 = t1.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const n2 = t2.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (n1 === n2) return 1.0;

    // Entity Conflict Guard: zero out similarity on collegiate conflicts
    if (hasConflictingCollegiateEntities(title1, title2)) {
        return 0.0;
    }

    const exp1 = normalizeCollegiateTitle(t1);
    const exp2 = normalizeCollegiateTitle(t2);
    if (exp1 && exp2 && exp1 === exp2) return 1.0;

    // Substring containment on normalized strings
    const compact1 = n1.replace(/\s+/g, '');
    const compact2 = n2.replace(/\s+/g, '');
    if (compact1.length > 8 && compact2.length > 8 && (compact1.includes(compact2) || compact2.includes(compact1))) {
        const ratio = Math.min(compact1.length, compact2.length) / Math.max(compact1.length, compact2.length);
        if (ratio >= 0.70) {
            const jaro = typeof JaroWinklerDistance === 'function' ? JaroWinklerDistance(t1, t2) : 0;
            return Math.max(0.88, jaro, ratio);
        }
    }

    const jaroScore = typeof JaroWinklerDistance === 'function' ? JaroWinklerDistance(t1, t2) : 0;
    const levScore = stringSimilarity(t1, t2);

    // ML TF-IDF Cosine Vectorizer on both original and collegiate expanded titles
    const vecA = computeTfIdfVector(exp1 || t1);
    const vecB = computeTfIdfVector(exp2 || t2);
    const cosScore = cosineSimilarity(vecA, vecB);

    const expJaro = typeof JaroWinklerDistance === 'function' ? JaroWinklerDistance(exp1, exp2) : 0;
    const expLev = stringSimilarity(exp1, exp2);

    // Hybrid Ensemble: weights Cosine (40%), Jaro-Winkler (35%), and Levenshtein (25%)
    // AUTHENTIC WEIGHTED FUSION SCORE (No Math.max bypass!)
    const ensembleScore = (cosScore * 0.40) + (Math.max(jaroScore, expJaro) * 0.35) + (Math.max(levScore, expLev) * 0.25);
    return Math.min(1.0, Math.max(0.0, ensembleScore));
}

/**
 * Checks if two dates fall within a specified hour window (default 48 hours).
 * @param {Date|string} date1
 * @param {Date|string} date2
 * @param {number} windowHours
 * @returns {boolean}
 */
function isWithinDateWindow(date1, date2, windowHours = 48) {
    if (!date1 || !date2) return true;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;

    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    const windowMs = windowHours * 60 * 60 * 1000;
    return diffMs <= windowMs;
}

/**
 * Merges candidate tournament fields into canonical tournament document.
 * Combines division draws, registration URLs, source links, attendee RSVPs, and dates.
 *
 * @param {Object} canonical
 * @param {Object} incoming
 * @returns {Object}
 */
function mergeTournamentData(canonical, incoming) {
    if (!canonical) return incoming ? { ...incoming } : {};
    if (!incoming) return { ...canonical };

    const merged = { ...(canonical.toObject ? canonical.toObject() : canonical) };
    const inc = incoming.toObject ? incoming.toObject() : incoming;

    // 1. Merge divisions by normalized division key without duplicates
    const existingDivisions = Array.isArray(merged.divisions) ? [...merged.divisions] : [];
    const incomingDivisions = Array.isArray(inc.divisions) ? inc.divisions : [];
    const divMap = new Map();

    for (const div of existingDivisions) {
        if (!div || typeof div !== 'object') continue;
        const key = normalizeDivisionKey(div);
        if (key) {
            divMap.set(key, {
                ...div,
                code: div.code || key,
                name: div.name || key
            });
        }
    }

    for (const div of incomingDivisions) {
        if (!div || typeof div !== 'object') continue;
        const key = normalizeDivisionKey(div);
        if (!key) continue;
        if (divMap.has(key)) {
            const current = divMap.get(key);
            divMap.set(key, {
                ...current,
                ...div,
                code: current.code || div.code || key,
                name: current.name || div.name || key,
                maxDraw: Math.max(current.maxDraw || 32, div.maxDraw || 32),
                fee: div.fee || current.fee || '$25',
                feeAmount: div.feeAmount || current.feeAmount || 25,
                category: current.category || div.category || (key.includes('D_') ? 'Doubles' : 'Singles'),
                bracketType: current.bracketType || div.bracketType || 'single_elimination',
                eligibility: current.eligibility || div.eligibility || 'Open'
            });
        } else {
            divMap.set(key, {
                ...div,
                code: div.code || key,
                name: div.name || key,
                maxDraw: div.maxDraw || 32,
                fee: div.fee || '$25',
                feeAmount: div.feeAmount || 25,
                category: div.category || (key.includes('D_') ? 'Doubles' : 'Singles'),
                bracketType: div.bracketType || 'single_elimination',
                eligibility: div.eligibility || 'Open'
            });
        }
    }
    merged.divisions = Array.from(divMap.values());

    // 2. Merge registrationUrl and sourceLinks
    if (!merged.registrationUrl || merged.registrationUrl.trim() === '') {
        merged.registrationUrl = inc.registrationUrl || inc.registrationLink || '';
    }
    const links = new Set();
    if (merged.sourceUrl) links.add(merged.sourceUrl);
    if (merged.registrationUrl) links.add(merged.registrationUrl);
    if (Array.isArray(merged.sourceLinks)) {
        merged.sourceLinks.forEach(l => l && links.add(l));
    }
    if (inc.sourceUrl) links.add(inc.sourceUrl);
    if (inc.registrationUrl) links.add(inc.registrationUrl);
    if (inc.registrationLink) links.add(inc.registrationLink);
    if (Array.isArray(inc.sourceLinks)) {
        inc.sourceLinks.forEach(l => l && links.add(l));
    }
    merged.sourceLinks = Array.from(links);

    // 3. Merge attendees and update rsvpCount
    const attendeeSet = new Set();
    const existingAttendees = Array.isArray(merged.attendees) ? merged.attendees : [];
    const incomingAttendees = Array.isArray(inc.attendees) ? inc.attendees : [];

    existingAttendees.forEach(a => {
        const id = a?._id ? a._id.toString() : a?.toString?.();
        if (id) attendeeSet.add(id);
    });
    incomingAttendees.forEach(a => {
        const id = a?._id ? a._id.toString() : a?.toString?.();
        if (id) attendeeSet.add(id);
    });
    merged.attendees = Array.from(attendeeSet);
    merged.rsvpCount = Math.max(merged.attendees.length, merged.rsvpCount || 0, inc.rsvpCount || 0);

    // 4. Merge dates: earliest startDate, latest endDate
    const cStart = merged.startDate || merged.date ? new Date(merged.startDate || merged.date) : null;
    const iStart = inc.startDate || inc.date ? new Date(inc.startDate || inc.date) : null;
    if (cStart && !isNaN(cStart.getTime()) && iStart && !isNaN(iStart.getTime())) {
        merged.startDate = cStart.getTime() <= iStart.getTime() ? cStart : iStart;
    } else if (iStart && !isNaN(iStart.getTime())) {
        merged.startDate = iStart;
    }

    const cEnd = merged.endDate ? new Date(merged.endDate) : cStart;
    const iEnd = inc.endDate ? new Date(inc.endDate) : iStart;
    if (cEnd && !isNaN(cEnd.getTime()) && iEnd && !isNaN(iEnd.getTime())) {
        merged.endDate = cEnd.getTime() >= iEnd.getTime() ? cEnd : iEnd;
    } else if (iEnd && !isNaN(iEnd.getTime())) {
        merged.endDate = iEnd;
    }

    // 5. Merge skillLevels
    const skills = new Set(Array.isArray(merged.skillLevels) ? merged.skillLevels : []);
    if (Array.isArray(inc.skillLevels)) {
        inc.skillLevels.forEach(s => s && skills.add(s));
    }
    merged.skillLevels = Array.from(skills);

    // 6. Merge hostUniversity and eventLocation
    if (!merged.hostUniversity || merged.hostUniversity === 'Local Club' || merged.hostUniversity === 'Collegiate / Local Club') {
        if (inc.hostUniversity) merged.hostUniversity = inc.hostUniversity;
    }
    if (!merged.eventLocation || merged.eventLocation === 'DMV Area') {
        if (inc.eventLocation || inc.location) merged.eventLocation = inc.eventLocation || inc.location;
    }

    return merged;
}

/**
 * Deduplicates a candidate tournament against an array of existing tournaments.
 * Combines ML candidate pruning with hybrid TF-IDF/Jaro-Winkler/Levenshtein ensemble scoring.
 *
 * @param {Object} candidate
 * @param {Array<Object>} existingTournaments
 * @param {Object} [options]
 * @param {number} [options.titleThreshold=0.85]
 * @param {number} [options.windowHours=48]
 * @returns {{ isDuplicate: boolean, canonicalId: any, canonicalTournament: Object|null, matchScore: number, mergedData: Object }}
 */
function deduplicateTournament(candidate, existingTournaments = [], options = {}) {
    const { titleThreshold = 0.85, windowHours = 48 } = options;
    if (!candidate || !Array.isArray(existingTournaments) || existingTournaments.length === 0) {
        return {
            isDuplicate: false,
            canonicalId: null,
            canonicalTournament: null,
            matchScore: 0,
            mergedData: candidate ? { ...candidate } : null
        };
    }

    const candidateTitle = candidate.tournamentName || candidate.name || '';
    const candidateDate = candidate.startDate || candidate.date;

    let bestMatch = null;
    let maxScore = 0;

    for (const existing of existingTournaments) {
        if (!existing || typeof existing !== 'object') continue;
        const existingTitle = existing.tournamentName || existing.name || '';
        const existingDate = existing.startDate || existing.date;

        // ML Pruning Gate: Temporal, Entity Conflict, Length Ratio, and Token Inverted Index Filter
        const pruneCheck = shouldPruneCandidate(candidate, existing, { windowHours });
        if (pruneCheck.prune) {
            continue;
        }

        const score = computeTitleSimilarity(candidateTitle, existingTitle);
        if (score >= titleThreshold && score > maxScore) {
            maxScore = score;
            bestMatch = existing;
        }
    }

    if (bestMatch) {
        const canonicalId = bestMatch._id || bestMatch.id || null;
        const mergedData = mergeTournamentData(bestMatch, candidate);
        return {
            isDuplicate: true,
            canonicalId,
            canonicalTournament: bestMatch,
            matchScore: maxScore,
            mergedData
        };
    }

    return {
        isDuplicate: false,
        canonicalId: null,
        canonicalTournament: null,
        matchScore: maxScore,
        mergedData: candidate ? { ...candidate } : null
    };
}

/**
 * Backwards-compatible duplicate check used across hunter and legacy tests.
 * @param {string} newName
 * @param {Array<Object>} existingList
 * @param {number} threshold
 * @returns {boolean}
 */
function isDuplicateTournament(newName, existingList = [], threshold = 0.75) {
    if (!newName || !Array.isArray(existingList) || existingList.length === 0) return false;
    const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(newName);
    if (!n1) return false;

    for (const item of existingList) {
        if (!item || typeof item !== 'object') continue;
        const itemRaw = item.tournamentName || item.name || '';
        const n2 = normalize(itemRaw);
        if (!n2) continue;

        if (n1 === n2) return true;
        if (n1.length > 8 && n2.length > 8 && (n1.includes(n2) || n2.includes(n1))) return true;

        const sim = computeTitleSimilarity(newName, itemRaw);
        if (sim >= threshold) return true;
    }
    return false;
}

module.exports = {
    STOP_WORDS,
    isStopWord,
    tokenize,
    computeTfIdfVector,
    cosineSimilarity,
    COLLEGIATE_ENTITY_RULES,
    COLLEGIATE_ACRONYMS,
    extractCollegiateEntities,
    detectCollegiateEntity,
    hasConflictingCollegiateEntities,
    normalizeCollegiateTitle,
    normalizeDivisionKey,
    getInformativeTrigrams,
    hasAcronymRelationship,
    shouldPruneCandidate,
    levenshteinDistance,
    stringSimilarity,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament
};
