const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const ProposedTournament = require('../models/ProposedTournament');
const { ApifyClient } = require('apify-client');
const { parseInstagramPost } = require('./aiParser');
const { deduplicateTournament, mergeTournamentData } = require('./deduplication');
const { resolveBioLinkRegistration } = require('./campusGroupsBypass');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN || 'placeholder_token',
});

// Target DMV collegiate clubs with their approximate coordinates
const TARGET_CLUBS = [
    // Primary DMV Collegiate Badminton Clubs
    { handle: "gmu_badminton", name: "George Mason University", location: "Fairfax, VA", coordinates: [-77.3075, 38.8315] },
    { handle: "umd_badminton", name: "University of Maryland", location: "College Park, MD", coordinates: [-76.9425, 38.9869] },
    { handle: "gwbadminton", name: "George Washington University", location: "Washington, DC", coordinates: [-77.0469, 38.8997] },
    { handle: "georgetownbadminton", name: "Georgetown University", location: "Washington, DC", coordinates: [-77.0722, 38.9076] },
    { handle: "jhubadminton", name: "Johns Hopkins University", location: "Baltimore, MD", coordinates: [-76.6200, 39.3299] },
    { handle: "umbcbadminton", name: "UMBC", location: "Catonsville, MD", coordinates: [-76.7139, 39.2556] },
    { handle: "uvabadminton", name: "University of Virginia", location: "Charlottesville, VA", coordinates: [-78.5079, 38.0335] },
    { handle: "vtechbadminton", name: "Virginia Tech", location: "Blacksburg, VA", coordinates: [-80.4139, 37.2284] },
    { handle: "vcu.badminton", name: "Virginia Commonwealth University", location: "Richmond, VA", coordinates: [-77.4526, 37.5482] },
    { handle: "wm.badminton.official", name: "William & Mary", location: "Williamsburg, VA", coordinates: [-76.7144, 37.2709] },
    { handle: "jmubadminton", name: "James Madison University", location: "Harrisonburg, VA", coordinates: [-78.8697, 38.4350] },
    { handle: "towsonbadminton", name: "Towson University", location: "Towson, MD", coordinates: [-76.6042, 39.3934] },
    // Regional DMV Tournament & Training Hubs
    { handle: "cba_badminton", name: "Capital Badminton Academy", location: "Columbia, MD", coordinates: [-76.8289, 39.2037] },
    { handle: "nvbadminton", name: "Northern Virginia Badminton Club", location: "Ashburn, VA", coordinates: [-77.4875, 39.0438] },
    // Mid-Atlantic Circuit Competitors
    { handle: "dukebadminton", name: "Duke University", location: "Durham, NC", coordinates: [-78.9382, 35.9940] },
    { handle: "psubadminton", name: "Penn State University", location: "State College, PA", coordinates: [-77.8600, 40.7982] },
    { handle: "rutgersbadminton", name: "Rutgers University", location: "New Brunswick, NJ", coordinates: [-74.4518, 40.4862] },
    { handle: "ncsubadminton", name: "NC State University", location: "Raleigh, NC", coordinates: [-78.6750, 35.7846] },
    { handle: "uncbadminton", name: "UNC Chapel Hill", location: "Chapel Hill, NC", coordinates: [-79.0469, 35.9049] },
    { handle: "upennbadminton", name: "University of Pennsylvania", location: "Philadelphia, PA", coordinates: [-75.1932, 39.9522] },
    { handle: "cmubadminton", name: "Carnegie Mellon University", location: "Pittsburgh, PA", coordinates: [-79.9425, 40.4424] },
    { handle: "udbadminton", name: "University of Delaware", location: "Newark, DE", coordinates: [-75.7496, 39.6780] },
    { handle: "templebadminton", name: "Temple University", location: "Philadelphia, PA", coordinates: [-75.1531, 39.9806] },
    { handle: "pittbadminton", name: "University of Pittsburgh", location: "Pittsburgh, PA", coordinates: [-79.9608, 40.4443] }
];

/**
 * Main entry point for the Instagram Scraper
 */
async function runInstagramScraper() {
    console.log("[InstagramScraper] Starting daily scrape for DMV tournaments...");
    for (const club of TARGET_CLUBS) {
        try {
            console.log(`[InstagramScraper] Scraping @${club.handle}...`);
            const profileData = await scrapeInstagramProfile(club.handle);
            
            let registrationUrl = "";
            if (profileData && profileData.linktreeUrl) {
                const bioForms = await resolveBioLinkRegistration(profileData.linktreeUrl);
                if (bioForms && bioForms.length > 0) {
                    registrationUrl = bioForms[0];
                } else {
                    const forms = await scrapeLinktree(profileData.linktreeUrl);
                    if (forms.length > 0) {
                        registrationUrl = forms[0];
                    }
                }
            }

            if (profileData && profileData.recentPosts) {
                for (const post of profileData.recentPosts) {
                    // Stale post filter: skip posts published more than 45 days ago
                    if (post.timestamp) {
                        const postDate = new Date(post.timestamp);
                        const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
                        if (!isNaN(postDate.getTime()) && (Date.now() - postDate.getTime()) > maxAgeMs) {
                            console.log(`[InstagramScraper] Skipping stale post from ${postDate.toISOString()} on @${club.handle}`);
                            continue;
                        }
                    }

                    const caption = post.caption || '';
                    const lower = caption.toLowerCase();

                    // Negative filter: Reject post-tournament recaps, congratulations, results, podium
                    if (/\b(congratulat\w*|congrats|shoutout|shout\s*out|recap|photo\s*dump|last\s*weekend|placed\s*(?:1st|2nd|3rd|[0-9]+th)|won\s*gold|won\s*silver|won\s*bronze|thanks\s*for\s*coming|results:|podium|final\s*scores?|memories\s*from)\b/i.test(lower)) {
                        console.log(`[InstagramScraper] Skipping past tournament recap on @${club.handle}`);
                        continue;
                    }

                    // Negative filter: Reject regular club sessions without explicit registration call
                    if (/\b(open\s*gym|open\s*play|general\s*body\s*meeting|\bgbm\b|tryouts?|practice\s*schedule|dues|exec\s*board|e-board|merchandise|merch\s*drop|apparel|fundraiser|bake\s*sale|social\s*night|banquet|welcome\s*back)\b/i.test(lower) &&
                        !/\b(register\s*(?:now|here|at|via)|registration\s*(?:link|open|form|deadline)|sign\s*up\s*(?:link|deadline|here|now)|entry\s*fee|deadline\s*to\s*register)\b/i.test(lower)) {
                        console.log(`[InstagramScraper] Skipping regular club session/update on @${club.handle}`);
                        continue;
                    }

                    const isCandidate = /\b(tournament|open\s*(?:badminton|championship|invitational|classic)|invitational|championship|classic|badminton\s*cup)\b/i.test(lower);
                    if (!isCandidate) {
                        continue; // Skip non-tournament club updates to preserve Gemini API quota
                    }

                    // Phase 3: Task 5 - LLM Integration
                    const parsedData = await parseInstagramPost(caption);
                    
                    if (parsedData && parsedData.isTournamentPost) {
                        let confirmedDate = null;
                        if (parsedData.startDate) {
                            const sDate = new Date(parsedData.startDate);
                            if (isNaN(sDate.getTime()) || sDate.getTime() < Date.now() || sDate.getFullYear() < 2026) {
                                console.log(`[InstagramScraper] Rejected: date in past or invalid (${parsedData.startDate}) for @${club.handle}`);
                                continue;
                            }
                            confirmedDate = sDate;
                        } else {
                            console.log(`[InstagramScraper] ℹ️ Date not found for post from @${club.handle}. Retaining in Admin Review Queue with date=null for admin inspection.`);
                        }
                        console.log(`[InstagramScraper] Valid tournament found from @${club.handle}: ${parsedData.tournamentName || 'Unknown Name'}`);

                        const candidateTourney = {
                            tournamentName: parsedData.tournamentName || `${club.name} Open Tournament`,
                            hostUniversity: club.name,
                            eventLocation: club.location, // Static Geo-Tagging
                            registrationDeadline: parsedData.registrationDeadline ? new Date(parsedData.registrationDeadline) : null,
                            isOpenTournament: true,
                            registrationUrl: registrationUrl,
                            instagramPostUrl: post.postUrl,
                            flyerImageUrl: post.imageUrl,
                            hostClubHandle: club.handle,
                            originalCaption: post.caption,
                            skillLevels: parsedData.skillLevels || [],
                            startDate: confirmedDate,
                            endDate: confirmedDate,
                            scraperLastRun: new Date()
                        };

                        let existingTournament = null;
                        if (mongoose.connection?.readyState === 1) {
                            const activeTournaments = await Tournament.find({ status: { $ne: 'archived' } }).lean();
                            const dedup = deduplicateTournament(candidateTourney, activeTournaments, {
                                titleThreshold: 0.85,
                                windowHours: 48
                            });
                            if (dedup.isDuplicate && dedup.canonicalId) {
                                existingTournament = await Tournament.findById(dedup.canonicalId);
                            }
                            if (!existingTournament) {
                                existingTournament = await Tournament.findOne({
                                    $or: [
                                        { instagramPostUrl: post.postUrl },
                                        { hostClubHandle: club.handle, startDate: parsedData.startDate ? new Date(parsedData.startDate) : { $exists: true } }
                                    ]
                                });
                            }
                        }

                        if (!existingTournament) {
                            const existsInProposed = await ProposedTournament.findOne({
                                $or: [
                                    { sourceUrl: post.postUrl },
                                    { tournamentName: candidateTourney.tournamentName, date: candidateTourney.startDate }
                                ]
                            });
                            if (!existsInProposed) {
                                let linkStatus = 'unchecked';
                                let linkStatusCode = null;
                                let fallbackRegistrationUrl = '';
                                try {
                                    const { verifyLinkHealth, resolveHostClubFallback } = require('./linkHealthChecker');
                                    const check = await verifyLinkHealth(candidateTourney.registrationUrl || candidateTourney.instagramPostUrl, 3000);
                                    linkStatus = check.linkStatus;
                                    linkStatusCode = check.statusCode;
                                    if (linkStatus === 'expired') {
                                        fallbackRegistrationUrl = resolveHostClubFallback(candidateTourney);
                                    }
                                } catch (_) {}

                                await ProposedTournament.create({
                                    tournamentName: candidateTourney.tournamentName,
                                    location: candidateTourney.eventLocation || `${club.name}, ${club.location}`,
                                    date: candidateTourney.startDate,
                                    registrationDeadline: candidateTourney.registrationDeadline,
                                    registrationLink: candidateTourney.registrationUrl || candidateTourney.instagramPostUrl,
                                    sourceUrl: candidateTourney.instagramPostUrl,
                                    sourceType: 'INSTAGRAM',
                                    rawCaption: (post.caption || '').substring(0, 600),
                                    flyerImageUrl: candidateTourney.flyerImageUrl,
                                    sourceLinks: [candidateTourney.instagramPostUrl],
                                    confidenceScore: confirmedDate ? 88 : 75,
                                    linkStatus,
                                    linkStatusCode,
                                    fallbackRegistrationUrl,
                                    status: 'pending' // Route to Admin Review Queue!
                                });
                                console.log(`[InstagramScraper] Enqueued proposed tournament for Admin Review: ${candidateTourney.tournamentName}`);
                            }
                        } else {
                            console.log(`[InstagramScraper] Duplicate found, merging tournament data.`);
                            const merged = mergeTournamentData(existingTournament, candidateTourney);
                            existingTournament.scraperLastRun = new Date();
                            if (merged.divisions && merged.divisions.length > 0) existingTournament.divisions = merged.divisions;
                            if (merged.registrationUrl) existingTournament.registrationUrl = merged.registrationUrl;
                            if (merged.sourceLinks && merged.sourceLinks.length > 0) existingTournament.sourceLinks = merged.sourceLinks;
                            if (merged.skillLevels && merged.skillLevels.length > 0) existingTournament.skillLevels = merged.skillLevels;
                            if (merged.startDate) existingTournament.startDate = merged.startDate;
                            if (merged.endDate) existingTournament.endDate = merged.endDate;
                            if (parsedData.registrationDeadline) existingTournament.registrationDeadline = new Date(parsedData.registrationDeadline);
                            if (!existingTournament.instagramPostUrl && post.postUrl) existingTournament.instagramPostUrl = post.postUrl;
                            if (!existingTournament.flyerImageUrl && post.imageUrl) existingTournament.flyerImageUrl = post.imageUrl;
                            await existingTournament.save();
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`[InstagramScraper] Error scraping @${club.handle}:`, error.message);
        }
    }
    console.log("[InstagramScraper] Finished daily scrape.");
}



/**
 * Scrapes an Instagram profile using Apify's instagram-profile-scraper Actor
 */
async function scrapeInstagramProfile(handle) {
    try {
        console.log(`[Apify] Calling Apify Instagram Scraper for @${handle}...`);
        
        // Prepare Actor input
        const input = {
            search: handle,
            searchType: "user",
            resultsType: "posts",
            resultsLimit: 3,
            proxyConfiguration: {
                useApifyProxy: true
            }
        };

        // Run the Actor: apify/instagram-scraper
        const run = await client.actor("apify/instagram-scraper").call(input);

        // Fetch and print Actor results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            console.log(`[Apify] No data returned for @${handle}.`);
            return null;
        }

        // apify/instagram-scraper returns an array of post objects directly
        const recentPosts = items.map(post => ({
            caption: post.caption,
            imageUrl: post.displayUrl || post.videoUrl,
            postUrl: post.url,
            timestamp: post.timestamp
        }));

        console.log(`[Apify] Successfully scraped @${handle}. Found ${recentPosts.length} recent posts.`);

        return {
            handle: handle,
            linktreeUrl: `https://linktr.ee/${handle}`, // Fallback for registration links
            recentPosts: recentPosts
        };
    } catch (e) {
        console.error(`[Apify] Failed to scrape @${handle}:`, e.message);
        return null;
    }
}

/**
 * Scrapes a Linktree or Beacons page to extract Google Forms
 */
async function scrapeLinktree(url) {
    let response = null;
    let rawHtml = null;
    let $ = null;
    try {
        if (!url || typeof url !== 'string') return [];
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];

        response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxContentLength: 500 * 1024,
            maxBodyLength: 500 * 1024
        });
        rawHtml = typeof response.data === 'string' ? response.data.slice(0, 200 * 1024) : '';
        response = null;

        $ = cheerio.load(rawHtml);
        rawHtml = null;

        const formLinks = [];

        try {
            // Extract all ahrefs
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('forms.gle') || href.includes('docs.google.com/forms'))) {
                    formLinks.push(href);
                }
            });
        } finally {
            $ = null;
        }
        return formLinks;
    } catch (e) {
        return [];
    } finally {
        $ = null;
        response = null;
        rawHtml = null;
    }
}

module.exports = {
    runInstagramScraper,
    TARGET_CLUBS
};
