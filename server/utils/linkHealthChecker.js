/**
 * linkHealthChecker.js
 *
 * Milestone 1 (Project Titan) Autonomous Link Healthcheck Crawler.
 * Routinely tests external registration links via HEAD/GET requests.
 * Flags broken or 404 links with linkStatus: 'expired' and falls back to verified host club homepages.
 */

const axios = require('axios');
const Tournament = require('../models/Tournament');
const redis = require('./redis');

const HEALTHCHECK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

/**
 * Resolves a verified host club homepage fallback based on tournament metadata.
 * @param {Object} tournament
 * @returns {string} Fallback URL
 */
function resolveHostClubFallback(tournament = {}) {
    const t = tournament || {};
    const handle = (t.hostClubHandle || '').replace('@', '').toLowerCase();
    if (handle === 'gmu_badminton' || handle === 'gmubadminton') {
        return 'https://linktr.ee/gmubadminton';
    }
    if (handle === 'umd_badminton' || handle === 'umdclubbadminton') {
        return 'https://linktr.ee/umd_badminton';
    }
    if (handle === 'cba_badminton' || handle === 'capitalbadminton') {
        return 'https://www.capitalbadminton.com';
    }
    if (handle === 'nvbadminton' || handle === 'novabadminton') {
        return 'https://novabadmintonacademy.com';
    }
    if (handle === 'wm.badminton.official' || handle === 'wmbadminton') {
        return 'https://www.instagram.com/wm.badminton.official/';
    }
    if (handle === 'dukeclubbadminton' || handle === 'dukebadminton') {
        return 'https://recreation.duke.edu';
    }
    if (handle === 'uncbadminton') {
        return 'https://carolinabadminton.unc.edu';
    }
    if (handle === 'ncsubadminton') {
        return 'https://getinvolved.ncsu.edu';
    }
    if (handle === 'trianglebadminton') {
        return 'https://trianglebadmintonclub.com';
    }
    if (handle) {
        return `https://linktr.ee/${handle}`;
    }

    const text = [
        t.hostUniversity || '',
        t.hostClubHandle || '',
        t.eventLocation || '',
        t.tournamentName || '',
        t.sourceUrl || ''
    ].join(' ').toLowerCase();

    if (text.includes('george mason') || text.includes('gmu') || text.includes('rac gym') || text.includes('fairfax')) {
        return 'https://linktr.ee/gmubadminton';
    }
    if (text.includes('capital badminton') || text.includes('columbia') || /\bcba\b/.test(text)) {
        return 'https://www.capitalbadminton.com';
    }
    if (text.includes('northern virginia') || text.includes('nvbc') || text.includes('ashburn')) {
        return 'https://novabadmintonacademy.com';
    }
    if (text.includes('duke') || text.includes('durham') || text.includes('card gym') || text.includes('wilson recreation')) {
        return 'https://recreation.duke.edu';
    }
    if (text.includes('unc') || text.includes('chapel hill') || text.includes('carolina badminton') || text.includes('fetzer')) {
        return 'https://carolinabadminton.unc.edu';
    }
    if (text.includes('triangle badminton') || text.includes('morrisville')) {
        return 'https://trianglebadmintonclub.com';
    }
    if (text.includes('william & mary') || text.includes('william and mary') || text.includes('w&m') || text.includes('williamsburg')) {
        return 'https://www.instagram.com/wm.badminton.official/';
    }
    if (text.includes('maryland') || text.includes('umd') || text.includes('terrapin') || text.includes('college park')) {
        return 'https://linktr.ee/umd_badminton';
    }

    return t.sourceUrl || 'https://linktr.ee/gmubadminton';
}

/**
 * Verifies external URL health using HEAD with fallback to lightweight GET.
 * @param {string} url
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<{ linkStatus: 'valid'|'expired', isAlive: boolean, statusCode: number, error?: string }>}
 */
async function verifyLinkHealth(url, timeoutMs = 5000) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return { linkStatus: 'expired', isAlive: false, statusCode: 0, error: 'Invalid URL format' };
    }

    try {
        // Attempt fast HEAD request first
        const headRes = await axios.head(url, {
            headers: HEALTHCHECK_HEADERS,
            timeout: timeoutMs,
            maxRedirects: 5,
            validateStatus: () => true
        });

        if (headRes.status >= 200 && headRes.status < 400) {
            return { linkStatus: 'valid', isAlive: true, statusCode: headRes.status };
        }

        // 405 Method Not Allowed is common for sites blocking HEAD; retry with lightweight GET
        if (headRes.status === 405) {
            const getRes = await axios.get(url, {
                headers: HEALTHCHECK_HEADERS,
                timeout: timeoutMs,
                maxRedirects: 5,
                maxContentLength: 50 * 1024,
                maxBodyLength: 50 * 1024,
                validateStatus: () => true
            });

            if (getRes.status >= 200 && getRes.status < 400) {
                return { linkStatus: 'valid', isAlive: true, statusCode: getRes.status };
            }
            return { linkStatus: 'expired', isAlive: false, statusCode: getRes.status };
        }

        // Status 400+ considered expired/broken
        return { linkStatus: 'expired', isAlive: false, statusCode: headRes.status };
    } catch (err) {
        const statusCode = err.response?.status || 0;
        return { linkStatus: 'expired', isAlive: false, statusCode, error: err.message };
    }
}

/**
 * Checks a single tournament document, updating linkStatus, linkLastChecked, and fallbackRegistrationUrl.
 * @param {Object} tournament Tournament document or plain object
 * @returns {Promise<Object>} Updated tournament fields
 */
async function checkAndUpdateTournamentLink(tournament) {
    if (!tournament.registrationUrl) {
        tournament.linkStatus = 'unchecked';
        tournament.linkLastChecked = new Date();
        tournament.fallbackRegistrationUrl = resolveHostClubFallback(tournament);
        if (typeof tournament.save === 'function') await tournament.save();
        return tournament;
    }

    const result = await verifyLinkHealth(tournament.registrationUrl);
    tournament.linkStatus = result.linkStatus;
    tournament.linkStatusCode = result.statusCode;
    tournament.linkLastChecked = new Date();

    if (result.linkStatus === 'expired') {
        tournament.fallbackRegistrationUrl = resolveHostClubFallback(tournament);
    } else {
        tournament.fallbackRegistrationUrl = tournament.fallbackRegistrationUrl || '';
    }

    if (typeof tournament.save === 'function') {
        await tournament.save();
    }

    return tournament;
}

/**
 * Routine crawler: queries active tournaments and checks external registration links.
 * Updates MongoDB documents and evicts Redis tournament cache keys.
 * @param {number} [batchSize=25]
 * @returns {Promise<{ checkedCount: number, validCount: number, expiredCount: number }>}
 */
async function runTournamentLinkHealthcheck(batchSize = 25) {
    try {
        console.log(`[LinkCrawler] Starting tournament link healthcheck (batchSize: ${batchSize})...`);
        const query = {
            status: { $ne: 'archived' },
            registrationUrl: { $exists: true, $ne: '' }
        };

        const tournaments = await Tournament.find(query).limit(batchSize);
        let checkedCount = 0;
        let validCount = 0;
        let expiredCount = 0;

        for (const tourney of tournaments) {
            checkedCount++;
            await checkAndUpdateTournamentLink(tourney);
            if (tourney.linkStatus === 'expired') {
                expiredCount++;
                console.log(`[LinkCrawler] ⚠️ Marked expired link: "${tourney.tournamentName}" -> Fallback: ${tourney.fallbackRegistrationUrl}`);
            } else {
                validCount++;
            }
        }

        // Invalidate Redis cache if changes were made
        if (checkedCount > 0) {
            try {
                const keys = await redis.keys('tournaments:*');
                if (keys && keys.length > 0) {
                    await Promise.all(keys.map(k => redis.del(k)));
                    console.log(`[LinkCrawler] Evicted ${keys.length} tournament cache keys following link healthcheck.`);
                }
            } catch (cacheErr) {
                console.warn('[LinkCrawler] Redis cache eviction skipped:', cacheErr.message);
            }
        }

        console.log(`[LinkCrawler] Finished: ${checkedCount} checked, ${validCount} valid, ${expiredCount} expired.`);
        return { checkedCount, validCount, expiredCount };
    } catch (err) {
        console.error('[LinkCrawler] Healthcheck error:', err.message);
        return { checkedCount: 0, validCount: 0, expiredCount: 0, error: err.message };
    }
}

module.exports = {
    resolveHostClubFallback,
    verifyLinkHealth,
    checkLinkHealth: verifyLinkHealth,
    checkAndUpdateTournamentLink,
    runTournamentLinkHealthcheck,
    runLinkHealthcheckCrawler: runTournamentLinkHealthcheck
};
