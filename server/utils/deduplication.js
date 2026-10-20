/**
 * deduplication.js
 *
 * Milestone 1 (Project Titan) Fuzzy & Semantic Deduplication Engine with ML Candidate Pruning.
 * Features:
 *  - Multi-stage pruning cascade: Temporal blocking, length ratio, and token inverted-index overlap.
 *  - Machine Learning similarity ensemble: TF-IDF n-gram vectorization + Cosine Similarity,
 *    fused with Jaro-Winkler sub-sequence alignment and Levenshtein edit distance.
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
    'tournament', 'badminton', 'open', 'club', 'championship', 'championships', 'annual', 'official'
]);

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
 * Drops non-matching tournament pairs in O(1) via temporal window, length ratio, and token inverted index pruning.
 * @param {string} candTitle
 * @param {Date|string} candDate
 * @param {string} existTitle
 * @param {Date|string} existDate
 * @param {number} windowHours
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
        hours = windowHours;
    }

    // 1. Temporal Pruning (Hard Constraint)
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

    // 2. Length Ratio Pruning
    const len1 = (candTitle || '').length;
    const len2 = (existTitle || '').length;
    if (len1 > 0 && len2 > 0) {
        const ratio = Math.max(len1, len2) / Math.min(len1, len2);
        const t1 = candTitle.toLowerCase();
        const t2 = existTitle.toLowerCase();
        if (ratio > 3.5 && !t1.includes(t2) && !t2.includes(t1)) {
            return { prune: true, reason: 'length_ratio_exceeded' };
        }
    }

    // 3. Token Inverted Index / Informative Overlap Pruning
    const tokens1 = new Set(tokenize(candTitle).filter(t => !STOP_WORDS.has(t)));
    const tokens2 = new Set(tokenize(existTitle).filter(t => !STOP_WORDS.has(t)));
    let shared = 0;
    for (const t of tokens1) {
        if (tokens2.has(t)) shared++;
    }
    if (shared === 0 && tokens1.size > 0 && tokens2.size > 0) {
        const c1 = candTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const c2 = existTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!c1.includes(c2) && !c2.includes(c1)) {
            return { prune: true, reason: 'zero_informative_tokens' };
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

const COLLEGIATE_ACRONYMS = {
    'gmu': 'george mason university',
    'george mason': 'george mason university',
    'umd': 'university of maryland',
    'maryland': 'university of maryland',
    'uva': 'university of virginia',
    'vt': 'virginia tech',
    'vtech': 'virginia tech',
    'vcu': 'virginia commonwealth university',
    'jhu': 'johns hopkins university',
    'rac': 'recreation athletic complex',
    'nvbc': 'northern virginia badminton club',
    'cba': 'capital badminton academy'
};

function normalizeCollegiateTitle(str) {
    if (!str) return '';
    let s = str.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    Object.entries(COLLEGIATE_ACRONYMS).forEach(([acronym, full]) => {
        const regex = new RegExp(`\\b${acronym}\\b`, 'g');
        s = s.replace(regex, full);
    });
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Computes hybrid title similarity ensembling TF-IDF Cosine Similarity, Jaro-Winkler, and Levenshtein.
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
    const ensembleScore = (cosScore * 0.40) + (Math.max(jaroScore, expJaro) * 0.35) + (Math.max(levScore, expLev) * 0.25);
    return Math.max(jaroScore, levScore, ensembleScore, expJaro, expLev);
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
 * @param {Object} canonical
 * @param {Object} incoming
 * @returns {Object}
 */
function mergeTournamentData(canonical, incoming) {
    if (!canonical) return incoming ? { ...incoming } : {};
    if (!incoming) return { ...canonical };

    const merged = { ...(canonical.toObject ? canonical.toObject() : canonical) };
    const inc = incoming.toObject ? incoming.toObject() : incoming;

    // 1. Merge divisions by division code/name without duplicates
    const existingDivisions = Array.isArray(merged.divisions) ? [...merged.divisions] : [];
    const incomingDivisions = Array.isArray(inc.divisions) ? inc.divisions : [];
    const divMap = new Map();

    for (const div of existingDivisions) {
        const code = (div.code || div.name || '').trim().toUpperCase();
        if (code) divMap.set(code, { ...div });
    }

    for (const div of incomingDivisions) {
        const code = (div.code || div.name || '').trim().toUpperCase();
        if (!code) continue;
        if (divMap.has(code)) {
            const current = divMap.get(code);
            divMap.set(code, {
                ...current,
                maxDraw: Math.max(current.maxDraw || 32, div.maxDraw || 32),
                fee: div.fee || current.fee,
                feeAmount: div.feeAmount || current.feeAmount || 25
            });
        } else {
            divMap.set(code, { ...div });
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
        const existingTitle = existing.tournamentName || existing.name || '';
        const existingDate = existing.startDate || existing.date;

        // ML Pruning Gate: Temporal, Length Ratio, and Token Inverted Index Filter
        const pruneCheck = shouldPruneCandidate(candidateTitle, candidateDate, existingTitle, existingDate, windowHours);
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
    tokenize,
    computeTfIdfVector,
    cosineSimilarity,
    shouldPruneCandidate,
    levenshteinDistance,
    stringSimilarity,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament
};
