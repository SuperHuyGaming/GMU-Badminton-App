const { ApifyClient } = require('apify-client');
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const DiscoveryQueue = require('../models/DiscoveryQueue');
const ProposedTournament = require('../models/ProposedTournament');
const Tournament = require('../models/Tournament');
const { parseDiscoveredWebpage } = require('./aiParser');
const { huntTournamentSoftwareAndEnqueue } = require('./tournamentSoftwareCrawler');
const { sanitizeScrapedTitle } = require('./sanitizeScrapedTitle');

// Memory Threshold Constants
const DEFAULT_SOFT_HEAP_MB = 200;
const DEFAULT_HARD_HEAP_MB = 250;
const HEAP_PRESSURE_LIMIT_BYTES = (parseInt(process.env.HUNTER_HEAP_LIMIT_MB, 10) || DEFAULT_SOFT_HEAP_MB) * 1024 * 1024; // 200 MB
const MAX_HTML_PARSE_LENGTH = 200 * 1024;            // 200 KB
const AXIOS_BODY_CAP_BYTES = 500 * 1024;             // 500 KB

/**
 * Returns the effective soft heap limit threshold in bytes, respecting runtime HUNTER_HEAP_LIMIT_MB overrides.
 * @returns {number}
 */
function getHeapPressureLimitBytes() {
    return Math.max(1, parseInt(process.env.HUNTER_HEAP_LIMIT_MB, 10) || DEFAULT_SOFT_HEAP_MB) * 1024 * 1024;
}

/**
 * Returns the effective hard heap pause threshold in bytes (default 250MB or 1.25x soft limit).
 * @returns {number}
 */
function getHardHeapPressureLimitBytes() {
    const softLimit = getHeapPressureLimitBytes();
    const configuredHardMB = parseInt(process.env.HUNTER_HARD_HEAP_LIMIT_MB, 10);
    if (!isNaN(configuredHardMB) && configuredHardMB > 0) {
        return configuredHardMB * 1024 * 1024;
    }
    return Math.max(softLimit * 1.25, DEFAULT_HARD_HEAP_MB * 1024 * 1024);
}

/**
 * Checks current V8 heap pressure against two-tier soft ceiling (200MB) and hard pause (250MB).
 * Returns { isHigh, isPressureHigh, heapUsed, heapUsedBytes, heapUsedMB, heapLimit, softLimitBytes, hardLimitBytes, action: 'continue' | 'throttle' | 'pause' }
 */
function checkHeapPressure(customSoftLimit, customHardLimit) {
    const softLimitBytes = customSoftLimit || getHeapPressureLimitBytes();
    const hardLimitBytes = customHardLimit || getHardHeapPressureLimitBytes();
    const { heapUsed } = process.memoryUsage();

    let action = 'continue';
    if (heapUsed >= hardLimitBytes) {
        action = 'pause';
    } else if (heapUsed >= softLimitBytes) {
        action = 'throttle';
    }

    const isHigh = action !== 'continue';

    return {
        isHigh,
        isPressureHigh: isHigh, // backward compatibility with existing tests
        heapUsed,
        heapUsedBytes: heapUsed,
        heapUsedMB: (heapUsed / 1024 / 1024).toFixed(2),
        heapLimit: softLimitBytes,
        softLimitBytes,
        hardLimitBytes,
        action
    };
}

/**
 * Executes a multi-iteration setImmediate yield loop to cycle event loop phases
 * and allow V8 scavenge and concurrent mark phases to reclaim unreferenced memory.
 */
async function yieldGarbageCollectionLoop(iterations = 3) {
    for (let i = 0; i < iterations; i++) {
        await new Promise(resolve => setImmediate(resolve));
    }
}

/**
 * Yields execution to the Node event loop (check phase) to allow V8 GC reclamation.
 */
function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Pauses execution gracefully, invokes V8 GC if exposed, and runs multi-iteration event loop yield.
 * @param {number} [pauseMs] Duration in milliseconds (default 1000ms, or 50ms in test env)
 */
async function pauseForGarbageCollection(pauseMs) {
    const duration = pauseMs !== undefined ? pauseMs : (process.env.NODE_ENV === 'test' ? 50 : 1000);
    if (typeof global.gc === 'function') {
        try {
            global.gc();
        } catch (_) {}
    } else {
        try {
            const v8 = require('v8');
            const vm = require('vm');
            v8.setFlagsFromString('--expose_gc');
            const gc = vm.runInNewContext('gc');
            if (typeof gc === 'function') {
                gc();
            }
        } catch (_) {}
    }
    await yieldGarbageCollectionLoop(3);
    await new Promise(resolve => setTimeout(resolve, duration));
}

const {
    levenshteinDistance,
    stringSimilarity,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament
} = require('./deduplication');

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
 * Fast Zero-Quota Pre-Filter:
 * Evaluates sourceUrl and rawSnippet to instantly reject obvious non-candidates
 * (foreign websites, other sports, non-DMV global federations, explicit past years)
 * BEFORE spending network bandwidth or Gemini API quota.
 * @returns {string|null} Rejection reason string if rejected, or null if candidate should proceed
 */
function fastHeuristicPreFilter(sourceUrl = '', rawSnippet = '') {
    const url = (sourceUrl || '').toLowerCase();
    const snippet = (rawSnippet || '').toLowerCase();

    // 1. Non-badminton sports or organizations (FIBA basketball, golf, volleyball, soccer, pickleball)
    if (/fiba\.tournamentsoftware|golf|basketball|volleyball|soccer|football|pickleball/i.test(url) ||
        (/\b(fiba|golf|basketball|volleyball|soccer|football|pickleball)\b/i.test(snippet) && !snippet.includes('badminton'))) {
        return "Non-badminton sport (FIBA/basketball/golf/etc)";
    }

    // 2. Known international/continental bodies or foreign federations (non-DMV regional)
    if (/badmintoneurope\.com|corporate\.bwfbadminton\.com|badmintonitalia|badmintonengland|badmintonasia/i.test(url)) {
        return "International/overseas badminton federation (non-DMV)";
    }

    // 3. Foreign country top-level domains without explicit DMV mentions
    const foreignTldMatch = url.match(/\.(it|de|uk|eu|in|my|sg|jp|cn|fr|es|nl|dk|se|no|fi|au|nz|ru|br)\b/);
    const hasDmvMention = /\b(va|virginia|md|maryland|dc|washington\s*d\.?c\.?|fairfax|columbia|ashburn|rockville|college\s*park|richmond)\b/i.test(snippet);
    if (foreignTldMatch && !hasDmvMention) {
        return `Foreign domain (${foreignTldMatch[0]}) without DMV location`;
    }

    // 4. Explicit past tournament year in URL (e.g. 2025, 2024, etc.)
    if (/\b(201\d|202[0-5])\b/.test(url)) {
        return "Explicit past tournament year in URL";
    }

    return null;
}

/**
 * Processes pending items in DiscoveryQueue:
 * - Fetches webpage HTML using Axios/Cheerio
 * - Evaluates with Gemini AI (relevance & geo-filter gate)
 * - Checks for duplicate tournaments via Levenshtein matching
 * - Creates a ProposedTournament entry for Admin review queue
 */
async function processDiscoveryQueue(batchSize = 5) {
    console.log("🧠 [Hunter] Starting AI Evaluation of Discovery Queue...");
    
    // Clamp batch size to 5–10 items per cycle
    const safeBatchSize = Math.min(Math.max(1, Number(batchSize) || 5), 10);

    // Heap Pressure Guard: Check before batch execution
    const initialHeap = checkHeapPressure();
    if (initialHeap.isPressureHigh) {
        const limitMB = (getHeapPressureLimitBytes() / 1024 / 1024).toFixed(0);
        console.warn(`⚠️ [Hunter Guard] High heap pressure before queue start: ${initialHeap.heapUsedMB} MB exceeds ${limitMB} MB limit (${initialHeap.action}). Pausing for GC...`);
        await pauseForGarbageCollection();
        const retryCheck = checkHeapPressure();
        if (retryCheck.isPressureHigh) {
            console.warn(`🛑 [Hunter Guard] Heap remains high (${retryCheck.heapUsedMB} MB, action: ${retryCheck.action}). Skipping Discovery Queue cycle to prevent OOM.`);
            return { processed: 0, approved: 0, rejected: 0, duplicates: 0, pausedDueToHeapPressure: true };
        }
    }

    const pendingItems = await DiscoveryQueue.find({ status: 'PENDING_AI_REVIEW' }).limit(safeBatchSize);
    if (pendingItems.length === 0) {
        console.log("🧠 [Hunter] Queue is empty. Nothing to process.");
        return { processed: 0, approved: 0, rejected: 0, duplicates: 0, pausedDueToHeapPressure: false };
    }

    // Load both live tournaments and existing proposals for comprehensive deduplication
    const [liveTournaments, proposedTournaments] = await Promise.all([
        Tournament.find({}, 'tournamentName startDate endDate divisions registrationUrl sourceUrl sourceLinks attendees rsvpCount skillLevels').lean(),
        ProposedTournament.find({}, 'tournamentName date divisions registrationLink sourceUrl sourceLinks skillLevels').lean()
    ]);
    const allExisting = [...liveTournaments, ...proposedTournaments];

    let approvedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    let pausedEarly = false;

    for (const item of pendingItems) {
        // Heap Pressure Guard: Two-tier check before each item
        const itemHeap = checkHeapPressure();
        if (itemHeap.action === 'pause') {
            console.warn(`🛑 [Hunter Guard] Hard heap limit reached (${itemHeap.heapUsedMB} MB >= ${(itemHeap.hardLimitBytes / 1024 / 1024).toFixed(0)} MB). Pausing batch immediately.`);
            await pauseForGarbageCollection();
            pausedEarly = true;
            break;
        } else if (itemHeap.action === 'throttle') {
            console.warn(`⚠️ [Hunter Guard] Soft heap pressure (${itemHeap.heapUsedMB} MB). Throttling and running GC...`);
            await pauseForGarbageCollection(process.env.NODE_ENV === 'test' ? 20 : 200);
            const retryItemHeap = checkHeapPressure();
            if (retryItemHeap.action === 'pause') {
                console.warn(`🛑 [Hunter Guard] Heap climbed to hard ceiling (${retryItemHeap.heapUsedMB} MB) after GC. Pausing batch.`);
                pausedEarly = true;
                break;
            }
        }

        try {
            // Fast Zero-Quota Pre-Filter: instantly reject foreign domains, other sports, non-DMV federations, or past years
            const preFilterReject = fastHeuristicPreFilter(item.sourceUrl, item.rawSnippet);
            if (preFilterReject) {
                console.log(`[Hunter] Zero-Quota Fast Reject (${preFilterReject}): ${item.sourceUrl}`);
                item.status = 'REJECTED_BY_AI';
                item.errorMessage = preFilterReject;
                await item.save();
                rejectedCount++;
                continue;
            }

            console.log(`[Hunter] Fetching URL: ${item.sourceUrl}`);
            let rawText = item.rawSnippet || '';
            
            if (item.sourceType !== 'FACEBOOK' && isSafeExternalUrl(item.sourceUrl)) {
                let data = null;
                let $ = null;
                try {
                    const reqHeaders = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                    };
                    if (item.sourceUrl.includes('tournamentsoftware.com')) {
                        reqHeaders['Cookie'] = 'st=l=1033&c=1&cp=23; sport=2;';
                    }

                    let response = await axios.get(item.sourceUrl, {
                        headers: reqHeaders,
                        timeout: 7000,
                        maxContentLength: AXIOS_BODY_CAP_BYTES,
                        maxBodyLength: AXIOS_BODY_CAP_BYTES
                    });
                    data = response.data;
                    response = null; // Release Axios response object immediately
                    const htmlToParse = typeof data === 'string' ? data.slice(0, MAX_HTML_PARSE_LENGTH) : '';
                    data = null; // Release full response string immediately before Cheerio loads DOM tree
                    $ = cheerio.load(htmlToParse);
                    $('script, style, noscript, nav, footer').remove();
                    const extractedText = $('body').text().replace(/\s+/g, ' ').trim();
                    const lowerExtracted = extractedText.toLowerCase();
                    const isErrorOrLoginPage = /404|not found|page can't be found|login|sign in|campusgroups|session expired/i.test(lowerExtracted) && !lowerExtracted.includes('tournament');
                    const hasBadminton = lowerExtracted.includes('badminton');

                    const hasTournamentSpecifics = /\b(tournament|open\s+badminton|championship|invitational|classic|badminton\s+cup|flights?\s+[a-d]|singles|doubles)\b/i.test(lowerExtracted);
                    if (extractedText.length > 50 && hasBadminton && hasTournamentSpecifics && !isErrorOrLoginPage) {
                        rawText = item.rawSnippet ? `${item.rawSnippet}\n\n[Webpage]: ${extractedText.slice(0, 3000)}` : extractedText;
                    } else if (item.rawSnippet) {
                        rawText = `${item.rawSnippet}\n\n[Context]: ${extractedText.slice(0, 400)}`;
                    } else if (extractedText.length > 50 && hasBadminton && !isErrorOrLoginPage) {
                        rawText = extractedText;
                    }
                } catch (e) {
                    console.log(`[Hunter] Axios fetch failed for ${item.sourceUrl}. Falling back to snippet:`, e.message);
                    if (item.rawSnippet) {
                        rawText = item.rawSnippet;
                    }
                } finally {
                    $ = null;
                    data = null;
                }
            }

            // Reject if no usable content was scraped or provided (< 50 chars)
            if (!rawText || rawText.trim().length < 50) {
                console.log(`[Hunter] AI Rejected (no usable page content): ${item.sourceUrl}`);
                item.status = 'REJECTED_BY_AI';
                item.errorMessage = 'no usable page content';
                await item.save();
                rejectedCount++;
                continue;
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

            // Sanitize tournament name: strip HTML nav boilerplate like "Skip to main content", etc.
            if (extracted.tournamentName) {
                const cleaned = sanitizeScrapedTitle(extracted.tournamentName);
                if (!cleaned) {
                    console.log(`[Hunter] AI Rejected (Garbage title after sanitization): "${extracted.tournamentName}" @ ${item.sourceUrl}`);
                    item.status = 'REJECTED_BY_AI';
                    await item.save();
                    rejectedCount++;
                    continue;
                }
                extracted.tournamentName = cleaned;
            }

            // Guard against past tournament year in title (e.g. 2025, 2024, etc.)

            const pastYearMatch = (extracted.tournamentName || '').match(/\b(201\d|202[0-5])\b/);
            if (pastYearMatch) {
                console.log(`[Hunter] AI Rejected (Past Tournament Year ${pastYearMatch[0]}): "${extracted.tournamentName}"`);
                item.status = 'REJECTED_BY_AI';
                await item.save();
                rejectedCount++;
                continue;
            }

            // Guard against expired past tournaments (ended before today)
            if (extracted.startDate) {
                const sDate = new Date(extracted.startDate);
                const eDate = extracted.endDate ? new Date(extracted.endDate) : sDate;
                if (!isNaN(eDate.getTime()) && eDate.getTime() < Date.now()) {
                    console.log(`[Hunter] AI Rejected (Event Ended ${extracted.endDate || extracted.startDate}): "${extracted.tournamentName}"`);
                    item.status = 'REJECTED_BY_AI';
                    await item.save();
                    rejectedCount++;
                    continue;
                }
            }

            // Fuzzy & Semantic Deduplication (Jaro-Winkler + 48h Date Window > 0.85 threshold)
            const dedupResult = deduplicateTournament(extracted, allExisting, { titleThreshold: 0.85, windowHours: 48 });
            if (dedupResult.isDuplicate) {
                console.log(`[Hunter] Duplicate detected via Jaro-Winkler match (${dedupResult.matchScore.toFixed(3)}): "${extracted.tournamentName}" matches canonical "${dedupResult.canonicalTournament?.tournamentName}"`);
                
                if (dedupResult.canonicalTournament && mongoose.connection?.readyState === 1) {
                    try {
                        const canonicalId = dedupResult.canonicalId;
                        let liveDoc = await Tournament.findById(canonicalId);
                        if (liveDoc) {
                            const updated = mergeTournamentData(liveDoc, extracted);
                            await Tournament.findByIdAndUpdate(canonicalId, {
                                $set: {
                                    divisions: updated.divisions,
                                    registrationUrl: updated.registrationUrl,
                                    attendees: updated.attendees,
                                    rsvpCount: updated.rsvpCount,
                                    sourceLinks: updated.sourceLinks,
                                    startDate: updated.startDate,
                                    endDate: updated.endDate,
                                    skillLevels: updated.skillLevels
                                }
                            });
                            console.log(`[Hunter] 🔀 Merged variant draws/links into live canonical tournament: ${canonicalId}`);
                        } else {
                            let proposedDoc = await ProposedTournament.findById(canonicalId);
                            if (proposedDoc) {
                                const updated = mergeTournamentData(proposedDoc, extracted);
                                await ProposedTournament.findByIdAndUpdate(canonicalId, {
                                    $set: {
                                        divisions: updated.divisions,
                                        registrationLink: updated.registrationUrl || proposedDoc.registrationLink,
                                        sourceLinks: updated.sourceLinks,
                                        date: updated.startDate || proposedDoc.date
                                    }
                                });
                                console.log(`[Hunter] 🔀 Merged variant draws/links into proposed canonical tournament: ${canonicalId}`);
                            }
                        }
                    } catch (mergeErr) {
                        console.warn("[Hunter] Error merging duplicate into canonical tournament:", mergeErr.message);
                    }
                }

                item.status = 'DUPLICATE_MERGED';
                await item.save();
                duplicateCount++;
                continue;
            }

            // Create ProposedTournament for Admin Review Queue
            console.log(`[Hunter] ✨ AI APPROVED: "${extracted.tournamentName}" -> Routing to Admin Review Queue.`);
            
            // Date handling: If date is found, verify it is upcoming; if date is NOT found, keep it in the queue with date = null for Admin Review
            let proposedDate = null;
            if (extracted.startDate) {
                const parsedDate = new Date(extracted.startDate);
                if (isNaN(parsedDate.getTime()) || parsedDate.getTime() < Date.now() || parsedDate.getFullYear() < 2026) {
                    console.log(`[Hunter] AI Rejected (Date in past or invalid: ${extracted.startDate}): "${extracted.tournamentName}" @ ${item.sourceUrl}`);
                    item.status = 'REJECTED_BY_AI';
                    item.errorMessage = `Past or invalid tournament date: ${extracted.startDate}`;
                    await item.save();
                    rejectedCount++;
                    continue;
                }
                proposedDate = parsedDate;
            } else {
                console.log(`[Hunter] ℹ️ Date not found for "${extracted.tournamentName}". Retaining in Admin Review Queue with date=null for admin inspection.`);
            }

            let proposedDeadline = null;
            if (extracted.registrationDeadline) {
                const pDead = new Date(extracted.registrationDeadline);
                if (!isNaN(pDead.getTime()) && pDead.getFullYear() >= 2026) {
                    proposedDeadline = pDead;
                }
            }

            // Verify link health before creating proposal
            let linkStatus = 'unchecked';
            let linkStatusCode = null;
            let fallbackRegistrationUrl = '';
            try {
                const { verifyLinkHealth, resolveHostClubFallback } = require('./linkHealthChecker');
                const targetUrl = extracted.registrationLink || extracted.registrationUrl || item.sourceUrl;
                const check = await verifyLinkHealth(targetUrl, 3000);
                linkStatus = check.linkStatus;
                linkStatusCode = check.statusCode;
                if (linkStatus === 'expired') {
                    fallbackRegistrationUrl = resolveHostClubFallback({
                        sourceUrl: targetUrl,
                        hostLocation: extracted.hostLocation,
                        tournamentName: extracted.tournamentName
                    });
                }
            } catch (_) {}

            await ProposedTournament.create({
                tournamentName: extracted.tournamentName,
                location: extracted.hostLocation || "DMV Area",
                date: proposedDate,
                registrationDeadline: proposedDeadline,
                registrationLink: extracted.registrationLink || extracted.registrationUrl || item.sourceUrl,
                sourceUrl: item.sourceUrl,
                rawCaption: rawText.substring(0, 600),
                sourceLinks: [item.sourceUrl],
                confidenceScore: proposedDate ? (extracted.confidenceScore || 92) : 75,
                linkStatus,
                linkStatusCode,
                fallbackRegistrationUrl,
                status: 'pending' // Admin Pending Queue!
            });

            // Strict Human-Admin Gate: All discovered tournaments route exclusively to ProposedTournament (pending).
            // Direct live auto-publishing is permanently disabled.

            // Keep local dedup cache warm
            allExisting.push({ tournamentName: extracted.tournamentName });

            item.status = 'APPROVED_BY_AI';
            await item.save();
            approvedCount++;

        } catch (err) {
            console.error(`[Hunter] Error evaluating ${item.sourceUrl}:`, err.message);
        } finally {
            // Microtask yielding between queue items
            await yieldToEventLoop();
        }
    }

    console.log(`🧠 [Hunter] Batch finished. Approved: ${approvedCount}, Rejected: ${rejectedCount}, Duplicates: ${duplicateCount}${pausedEarly ? ' (Paused early due to heap pressure)' : ''}`);
    return {
        processed: approvedCount + rejectedCount + duplicateCount,
        approved: approvedCount,
        rejected: rejectedCount,
        duplicates: duplicateCount,
        pausedDueToHeapPressure: pausedEarly
    };
}

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || 'placeholder_token',
});

const SEARCH_QUERIES = [
    "upcoming badminton tournament virginia 2026",
    "maryland open badminton registration",
    "dc badminton tournament open",
    "duke badminton tournament open 2026",
    "north carolina open badminton tournament 2026",
    "mid atlantic collegiate team badminton championships 2026",
    "collegiate badminton tournament open 2026 registration",
    "site:tournamentsoftware.com badminton virginia OR maryland OR washington OR 'north carolina' OR pennsylvania",
    "site:outrally.com badminton tournament 2026",
    "badminton tournament registration google form 2026 2027"
];

// Verified DMV and Mid-Atlantic badminton collegiate & club discovery seeds
const DISCOVERY_SOURCE_URLS = [
    'https://linktr.ee/gmubadminton',
    'https://www.tournamentsoftware.com/tournament/29B5BFFA-ED41-49F5-8294-1E1F54A8D8A5',
    'https://novabadmintonacademy.com/',
    'https://linktr.ee/wmbirdie23',
    'https://linktr.ee/umd_badminton',
    'https://linktr.ee/dukeclubbadminton',
    'https://linktr.ee/uncbadminton',
    'https://linktr.ee/ncsubadminton',
    'https://trianglebadmintonclub.com/',
    'https://smashbadmintonva.com/',
    'https://linktr.ee/uvabadminton',
    'https://linktr.ee/vtechbadminton',
    'https://linktr.ee/vcubadminton',
    'https://linktr.ee/jhubadminton',
    'https://linktr.ee/psubadminton',
    'https://linktr.ee/upennbadminton',
    'https://linktr.ee/cmubadminton'
];

/**
 * Hunts web search engines for badminton tournaments in the DMV area and enqueues to DiscoveryQueue.
 */
async function huntGoogleForTournaments() {
    console.log("🕵️‍♂️ [Hunter] Starting autonomous Google / Collegiate Club search hunt...");
    let newDiscoveries = 0;

    // 1. Enqueue verified DMV collegiate & club tournament seeds
    for (const url of DISCOVERY_SOURCE_URLS) {
        try {
            const exists = await DiscoveryQueue.findOne({ sourceUrl: url });
            if (!exists) {
                await DiscoveryQueue.create({
                    sourceUrl: url,
                    sourceType: url.includes('tournamentsoftware') ? 'TOURNAMENT_SOFTWARE' : 'GOOGLE_SEARCH',
                    status: 'PENDING_AI_REVIEW',
                    discoveredAt: new Date()
                });
                newDiscoveries++;
            }
        } catch (e) {
            console.error(`[Hunter] Failed to enqueue seed ${url}:`, e.message);
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
 * Direct scraper for local DMV regional badminton clubs (Capital Badminton Academy, Northern Virginia Badminton Club).
 * 100% Free, zero rate-limits, direct HTTP fetch via Axios & Cheerio.
 */
async function huntRegionalClubsAndEnqueue() {
    console.log("🏸 [Hunter] Direct scraping regional DMV badminton clubs (Free & Guaranteed)...");
    const targets = [
        {
            name: "Capital Badminton Academy",
            url: "https://capitalbadminton.com/",
            location: "Capital Badminton Academy, Columbia, MD"
        },
        {
            name: "Northern Virginia Badminton Club",
            url: "https://novabadmintonacademy.com/",
            location: "Northern Virginia Badminton Club, Ashburn, VA"
        },
        {
            name: "Triangle Badminton Club",
            url: "https://trianglebadmintonclub.com/",
            location: "Triangle Badminton Club, Morrisville, NC"
        },
        {
            name: "Smash Badminton Center",
            url: "https://smashbadmintonva.com/",
            location: "Smash Badminton Center, Herndon, VA"
        }
    ];

    let count = 0;
    for (const target of targets) {
        let data = null;
        let $ = null;
        try {
            const response = await axios.get(target.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 8000,
                maxContentLength: AXIOS_BODY_CAP_BYTES,
                maxBodyLength: AXIOS_BODY_CAP_BYTES
            });
            data = response.data;
            const htmlToParse = typeof data === 'string' ? data.slice(0, MAX_HTML_PARSE_LENGTH) : '';
            $ = cheerio.load(htmlToParse);
            $('script, style, noscript, nav, footer').remove();
            const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 1000);

            const exists = await DiscoveryQueue.findOne({ sourceUrl: target.url });
            if (!exists) {
                await DiscoveryQueue.create({
                    sourceUrl: target.url,
                    sourceType: 'GOOGLE_SEARCH',
                    rawSnippet: `[${target.name}] ${text.slice(0, 300)}`,
                    status: 'PENDING_AI_REVIEW',
                    discoveredAt: new Date()
                });
                count++;
            }
        } catch (e) {
            console.warn(`[Hunter] Regional club direct scrape skipped for ${target.name}:`, e.message);
        } finally {
            $ = null;
            data = null;
            await yieldToEventLoop();
        }
    }
    return { discovered: count };
}

/**
 * Runs the full end-to-end Autonomous Tournament Hunter cycle:
 * 1. Scrape regional DMV clubs directly (Axios + Cheerio)
 * 2. Crawl TournamentSoftware.com & enqueue
 * 3. Scrape Google SERP queries & enqueue
 * 4. Process DiscoveryQueue with AI evaluation, geo-gate, and Levenshtein deduplication
 */
async function runFullAutonomousHunt() {
    console.log("🚀 [Hunter] Launching full Autonomous Tournament Hunter cycle...");
    const regionalResult = await huntRegionalClubsAndEnqueue();
    await yieldToEventLoop();

    const tsResult = await huntTournamentSoftwareAndEnqueue();
    await yieldToEventLoop();

    const googleResult = await huntGoogleForTournaments();
    await yieldToEventLoop();

    const processResult = await processDiscoveryQueue(5);

    return {
        timestamp: new Date(),
        regionalClubs: regionalResult,
        tournamentSoftware: tsResult,
        googleSearch: googleResult,
        queueProcessing: processResult
    };
}

/**
 * Completely wipes discovery queues, proposed tournament approval queue,
 * purges invalid/past tournaments (including legacy 2001/pre-2026 entries),
 * and clears Redis cache.
 */
async function wipeAndRestartTournamentSystem() {
    const startTime = Date.now();
    try {
        if (mongoose.connection?.readyState !== 1) {
            return { success: false, message: "Database not connected", executionTimeMs: 0 };
        }

        console.log("🧹 [Hunter Wipe] Initiating atomic tournament queue wipe and restart...");

        // 1, 2, 3: Atomic parallel purge of discovery queue, proposals, and stale pre-2026/trash entries
        const [deletedQueue, deletedProposed, deletedTournaments] = await Promise.all([
            DiscoveryQueue.deleteMany({}),
            ProposedTournament.deleteMany({}),
            Tournament.deleteMany({
                $or: [
                    { startDate: { $lt: new Date('2026-01-01T00:00:00.000Z') } },
                    { endDate: { $lt: new Date('2026-01-01T00:00:00.000Z') } },
                    { tournamentName: /2001|2000|199d|198d/i },
                    { tournamentName: /(201d|202[0-5])/i },
                    { tournamentName: /capital\s+ne\s+open/i },
                    { tournamentName: /public\s+vcu\s+open/i },
                    { tournamentName: /results pages/i },
                    { tournamentName: /mascot competition/i },
                    { tournamentName: /training packages/i },
                    { tournamentName: /sign up now/i },
                    { tournamentName: /drop-in booking/i },
                    { tournamentName: /menu select/i },
                    { tournamentName: /log in menu/i },
                    { tournamentName: /recwell intramural/i },
                    { tournamentName: /hoses basketball|golf tournament/i },
                    { tournamentName: /skip to content navigation menu/i },
                    { tournamentName: /skip to main content/i },
                    { tournamentName: /loch raven.*smashing sport|home events upcoming/i },
                    { tournamentName: /race to the finals.*\(or/i },
                    { tournamentName: /a smashing sport/i },
                    { tournamentName: /depending on standard naming|per text details/i },
                    { originalCaption: /founded in 2001|est\. 2001/i }
                ]
            })
        ]);

        // 4. Atomic Redis cache invalidation
        try {
            const redis = require('./redis');
            const keys = await redis.keys('tournaments:*');
            if (keys && keys.length > 0) {
                await redis.del(keys);
            }
        } catch (redisErr) {
            console.warn("[Hunter Wipe] Redis cache clear skipped:", redisErr.message);
        }

        const executionTimeMs = Date.now() - startTime;
        console.log(`🧹 [Hunter Wipe] Complete in ${executionTimeMs}ms: Cleared ${deletedQueue.deletedCount || 0} DiscoveryQueue items, ${deletedProposed.deletedCount || 0} ProposedTournaments, purged ${deletedTournaments.deletedCount || 0} invalid/past tournaments.`);

        return {
            success: true,
            executionTimeMs,
            clearedDiscoveryQueue: deletedQueue.deletedCount || 0,
            clearedProposedTournaments: deletedProposed.deletedCount || 0,
            purgedTournaments: deletedTournaments.deletedCount || 0
        };
    } catch (err) {
        const executionTimeMs = Date.now() - startTime;
        console.error("❌ [Hunter Wipe] Error wiping tournament system:", err.message);
        return { success: false, error: err.message, executionTimeMs };
    }
}

module.exports = {
    DISCOVERY_SOURCE_URLS,
    levenshteinDistance,
    stringSimilarity,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament,
    isSafeExternalUrl,
    fastHeuristicPreFilter,
    processDiscoveryQueue,
    huntGoogleForTournaments,
    huntRegionalClubsAndEnqueue,
    runFullAutonomousHunt,
    wipeAndRestartTournamentSystem,
    checkHeapPressure,
    getHeapPressureLimitBytes,
    getHardHeapPressureLimitBytes,
    yieldToEventLoop,
    yieldGarbageCollectionLoop,
    pauseForGarbageCollection,
    DEFAULT_SOFT_HEAP_MB,
    DEFAULT_HARD_HEAP_MB,
    HEAP_PRESSURE_LIMIT_BYTES,
    MAX_HTML_PARSE_LENGTH,
    AXIOS_BODY_CAP_BYTES
};
