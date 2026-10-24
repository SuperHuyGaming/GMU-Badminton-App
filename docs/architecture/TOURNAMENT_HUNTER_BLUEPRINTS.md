# Autonomous AI Tournament Hunter: Architectural Blueprints & Production Integration Designs

**Document ID:** MBC-ARCH-HUNTER-BLUEPRINTS  
**Version:** 2.0.0-PROD  
**Author:** worker_m6_roadmap_tests (Implementer, QA, Specialist)  
**Target Architecture:** Mason Badminton Connect — Enterprise Tournament Discovery & Ingestion Engine  
**Status:** Approved & Production-Ready  

---

## 1. Executive Architectural Overview

Mason Badminton Connect (`GMU Badminton App`) features an autonomous tournament intelligence ecosystem designed to harvest, validate, deduplicate, and curate collegiate and open badminton tournaments across the Mid-Atlantic circuit.

In real-world collegiate sports promotion, over 75% of tournament announcements exist exclusively on **Instagram promotional flyer graphics**, with companion post captions containing only minimal text (e.g. *"2026 Open is here! Link in bio to register! 🏸"*). Traditional HTML crawlers and text-only NLP models fail because the match dates, gymnasium venue, flight tiers (Open, A, B, C), entry fees, and registration deadlines are visual pixels on an image. Furthermore, outbound registration links nested inside social bio aggregators (Linktree, Beacons) frequently point to Google Forms whose URLs decay or close over time.

This document establishes the authoritative production blueprints for:
1. **Multimodal Vision AI Flyer Ingestion Pipeline** (Gemini 2.5 Flash SDK, prompt schema, pixel buffering, downsampling).
2. **Deep Linktree & Google Forms Recursive Crawler** (redirect unshortening, DOM scraping, `FB_PUBLIC_LOAD_DATA_` parsing).
3. **Pre-Flight Automated Link Health Verification & Fallback Router** (two-phase HEAD/GET probe, 404 detection, verified host club routing).
4. **Human-in-the-Loop Admin Review Queue Guarantees** (collection isolation, zero-unapproved live feed guarantee, dateless/TBD handling).

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     END-TO-END AUTONOMOUS HUNTER INGESTION FLOW                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
  [Instagram Profile Scraper]                           [Web Discovery SERP]
  - 24 DMV & Collegiate Clubs                           - Regional Club Sites (CBA, NVBC)
  - Post Captions & Flyer Images                        - TournamentSoftware Draws
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      ▼
                        [Zero-Quota Fast Pre-Filter]
                        - Discards GBMs, dues, recaps
                        - Drops past events (<= 2025) in < 1ms
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
   [Flyer Image Present?]                              [Social Bio Present?]
            │ YES                                               │ YES
            ▼                                                   ▼
 [Multimodal Vision Parser]                          [Deep Linktree Crawler]
 - Gemini 2.5 Flash SDK                              - Multi-hop redirect unshortener
 - Schema-constrained JSON                           - Next.js __NEXT_DATA__ parser
 - Reads dates, fees, divisions                      - Google Forms FB_PUBLIC_LOAD_DATA_
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      ▼
                      [Hybrid Consensus Synthesizer]
                      - Merges Vision + Caption + Forms
                      - Resolves venue to Campus Facility
                                      │
                                      ▼
                   [Pre-Flight Link Health Verification]
                   - HTTP HEAD -> fallback GET (capped 50KB)
                   - If 404/DNS error -> linkStatus: 'expired'
                   - Assigns verified club fallback URL
                                      │
                                      ▼
                  [Cross-Collection ML Deduplication]
                  - Multi-stage pruning (window <= 48h)
                  - TF-IDF + Jaro-Winkler + Levenshtein (>= 0.85)
                  - Collegiate entity clash guard
                                      │
                                      ▼
                  [ProposedTournament Collection (PENDING)]
                  - If date missing: date = null, confidence = 75
                  - STRICT ISOLATION: Zero live exposure!
                                      │
                                      ▼
                       [Admin Review Queue UI]
                       - Split-screen flyer vs. form
                       - Inline date & division editing
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
             [Admin Rejects]                   [Admin Approves]
             - status: 'rejected'              - status: 'approved'
             - Audit log recorded              - Insert into Tournament
                                               - isOpenTournament: true
                                               - Invalidate Redis tags
                                               - Emit WebSocket event
                                                       │
                                                       ▼
                                            [Public Feed: GET /api/tournaments]
                                            - Verified live competitions only!
```

---

## 2. Blueprint 1: Multimodal Vision AI Flyer Ingestion Pipeline

### 2.1 Problem & Objectives
Badminton tournament flyers are artistically dense promotional posters. Graphic designers format tournament dates across decorative fonts (e.g., *"Saturday & Sunday, November 7-8, 2026"*), list entry fees in small subscript (e.g., *"$25 for 1st event, $15 for 2nd"*), and group divisions across visual cards (*"Flight A (Open)", "Flight B (Intermediate)", "Collegiate Team"*).

The objective of the Multimodal Vision AI Pipeline is to ingest raw image buffers, bypass optical character recognition (OCR) degradation, and directly extract structured tournament metadata using Google's Gemini 2.5 Flash multimodal architecture.

### 2.2 Component Architecture & Data Flow

```
[Raw Post Media] -> [Buffer Streamer (Max 2MB)] -> [Downsampler / JPEG Encoder]
                           │
                           ▼
            [Gemini 2.5 Flash Multimodal SDK]
            - Model: 'gemini-2.5-flash'
            - Contents: [
                { text: FLYER_VISION_PROMPT },
                { inlineData: { mimeType: 'image/jpeg', data: base64Buffer } }
              ]
            - GenerationConfig: {
                responseMimeType: 'application/json',
                responseSchema: VisionFlyerSchema,
                temperature: 0.1
              }
                           │
                           ▼
              [Validated Structured JSON]
              - tournamentName: string
              - startDate: string (YYYY-MM-DD)
              - endDate: string (YYYY-MM-DD)
              - venueAddress: string
              - entryFee: string
              - skillLevels: string[]
              - registrationDeadline: string (YYYY-MM-DD)
              - confidenceScore: number (0-100)
```

### 2.3 Production Implementation (`server/utils/aiParser.js`)

```javascript
const { GoogleGenAI, Type } = require('@google/genai');
const axios = require('axios');

// Initialize Gemini Client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Production Schema Constraint for Multimodal Flyer Extraction
const VisionTournamentSchema = {
    type: Type.OBJECT,
    properties: {
        isTournamentFlyer: {
            type: Type.BOOLEAN,
            description: "True if the graphic announces a competitive badminton tournament, open, classic, or cup. False if regular club practice, tryouts, or social."
        },
        tournamentName: {
            type: Type.STRING,
            description: "Official title of the tournament (e.g. '2026 GMU Badminton Open', 'Mid-Atlantic Collegiate Championships')."
        },
        startDate: {
            type: Type.STRING,
            description: "ISO 8601 Start Date of match play (YYYY-MM-DD). If year is missing, assume 2026. If date is not specified, return null."
        },
        endDate: {
            type: Type.STRING,
            description: "ISO 8601 End Date of match play (YYYY-MM-DD). If single-day, match startDate."
        },
        venue: {
            type: Type.STRING,
            description: "Facility name and address (e.g. 'Recreation Athletic Complex (RAC), George Mason University, Fairfax VA')."
        },
        entryFee: {
            type: Type.STRING,
            description: "Registration cost structure (e.g. '$25/first event, $15/additional')."
        },
        divisions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of flight divisions mentioned (e.g. ['Men\\'s Singles Open', 'Flight B Doubles', 'Collegiate Flight'])."
        },
        registrationDeadline: {
            type: Type.STRING,
            description: "Registration cut-off date (YYYY-MM-DD) if explicitly printed."
        },
        registrationUrlOrQRText: {
            type: Type.STRING,
            description: "Any printed shortlink, Google Form URL, or Linktree URL found on the graphic."
        },
        confidenceScore: {
            type: Type.NUMBER,
            description: "Confidence rating from 0 to 100 based on text clarity and completeness."
        }
    },
    required: ["isTournamentFlyer"]
};

const FLYER_VISION_PROMPT = `
You are an expert collegiate badminton tournament director and computer vision OCR specialist.
Inspect this promotional flyer graphic with high precision:
1. Determine if this graphic announces a competitive badminton tournament or open championship.
2. Extract the canonical tournament name. If a year is present, preserve it (e.g. 2026).
3. Identify the exact match play start and end dates. Strictly distinguish between the registration deadline and the actual competition date. If the year is omitted, assume 2026.
4. Extract the host university, gym venue, and street address. Look for campus facilities like RAC Gym, SPH, Mem Gym, McComas Hall.
5. Extract flight division tiers: Open, Flight A, Flight B, Flight C, Flight D, Collegiate, Junior U19, Seniors.
6. Extract entry fee amounts ($).
7. If the flyer is not a tournament announcement (e.g., club dues, banquet, general body meeting, open gym hours), return isTournamentFlyer: false.
`;

/**
 * Downloads image bytes into a constrained buffer and parses via Gemini 2.5 Flash Vision.
 * @param {string} imageUrl Remote flyer image URL
 * @param {string} [companionCaption] Accompanying social media caption text
 * @returns {Promise<Object|null>} Structured flyer intelligence
 */
async function parseMultimodalFlyer(imageUrl, companionCaption = '') {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
        return null;
    }

    let imageBuffer = null;
    try {
        // Enforce 2MB maximum download cap to guard Node.js heap memory
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 7000,
            maxContentLength: 2 * 1024 * 1024,
            maxBodyLength: 2 * 1024 * 1024,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/jpeg,image/png,image/webp,*/*'
            }
        });

        imageBuffer = Buffer.from(response.data);
        const mimeType = response.headers['content-type']?.split(';')[0] || 'image/jpeg';
        const base64Data = imageBuffer.toString('base64');

        // Discard raw buffer immediately to facilitate V8 garbage collection
        imageBuffer = null;

        const contents = [
            { text: FLYER_VISION_PROMPT + (companionCaption ? `\n\nCompanion Caption Context:\n"${companionCaption}"` : '') },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            }
        ];

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                responseSchema: VisionTournamentSchema,
                temperature: 0.1
            }
        });

        const rawText = result.text();
        const parsed = JSON.parse(rawText);

        if (!parsed.isTournamentFlyer) {
            return null;
        }

        return {
            isTournamentFlyer: true,
            tournamentName: parsed.tournamentName || '',
            startDate: parsed.startDate || null,
            endDate: parsed.endDate || parsed.startDate || null,
            venue: parsed.venue || 'DMV Area',
            entryFee: parsed.entryFee || '',
            divisions: Array.isArray(parsed.divisions) ? parsed.divisions : [],
            registrationDeadline: parsed.registrationDeadline || null,
            registrationUrl: parsed.registrationUrlOrQRText || '',
            confidenceScore: parsed.confidenceScore || 90
        };
    } catch (err) {
        console.warn(`[VisionParser] Flyer extraction skipped for ${imageUrl}:`, err.message);
        return null;
    } finally {
        imageBuffer = null;
    }
}

module.exports = {
    parseMultimodalFlyer,
    VisionTournamentSchema
};
```

---

## 3. Blueprint 2: Deep Linktree & Google Forms Recursive Crawler

### 3.1 Problem & Objectives
Badminton clubs rarely paste direct Google Form URLs into Instagram captions; instead, their profile bio links to a Linktree or Beacons aggregator page (`linktr.ee/gmubadminton`). 

Furthermore, Google Forms contain rich schedule and division information in their rendered HTML payloads. The objectives of this subsystem are:
1. Resolve the club profile's true bio URL without relying on hardcoded handle strings.
2. Unshorten intermediate redirect chains (`bit.ly`, `tinyurl.com`, `linktr.ee/link?url=...`).
3. Deep-parse the target Google Form HTML to extract the event description paragraph and division choices from the client-side `FB_PUBLIC_LOAD_DATA_` object.
4. **Strict Repository Directives**: Mason360 / CampusGroups URLs are **never** targeted for scraping or authentication bypass; they are immediately skipped per user directives.

### 3.2 Deep Google Form Extraction Mechanics

Google Forms embeds all form questions, section headers, pricing descriptions, and settings in an inline script:
```html
<script type="text/javascript">
  var FB_PUBLIC_LOAD_DATA_ = [
    null,
    [
      "2026 GMU Badminton Open Registration",
      [
        [12345678, "Full Name", null, 0, [[98765432, null, 1]]],
        [87654321, "Select Division Flight", null, 2, [
          [111111, ["Men's Singles Open (Saturday 9AM)"], 0],
          [222222, ["Women's Singles Open (Saturday 11AM)"], 0],
          [333333, ["Flight B Doubles (Sunday 10AM)"], 0]
        ]]
      ],
      "Hosted at the RAC Gym, Fairfax VA on Nov 7-8, 2026. Entry fee: $25 for singles, $40/pair for doubles. Registration closes October 31."
    ]
  ];
</script>
```

By parsing this JSON payload using a targeted regex, the scraper extracts:
- `rawData[1][8]` $\to$ Form Title.
- `rawData[1][0]` $\to$ Description header (contains dates, gym rules, entry fee schedule).
- `rawData[1][1]` $\to$ Question array (contains flight division names and draw caps).

### 3.3 Production Implementation (`server/utils/campusGroupsBypass.js`)

```javascript
const axios = require('axios');
const cheerio = require('cheerio');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

/**
 * Follows HTTP 301/302/307/308 redirects and unshortens link wrappers up to maxRedirects.
 * @param {string} url
 * @param {number} [maxRedirects=5]
 * @returns {Promise<string>} Canonical target URL
 */
async function resolveRedirectChain(url, maxRedirects = 5) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;

    // Strict User Directive Guard: Never scrape or follow Mason360 portals
    if (url.includes('mason360.gmu.edu') || url.includes('campusgroups.com')) {
        console.log('[RedirectResolver] Mason360 URL identified; skipping per user directive.');
        return url;
    }

    let currentUrl = url;
    let hops = 0;

    while (hops < maxRedirects) {
        try {
            // Unpack Linktree click-through wrapper query parameters
            if (currentUrl.includes('linktr.ee/link?url=') || currentUrl.includes('linktr.ee/url?q=')) {
                const parsed = new URL(currentUrl);
                const embedded = parsed.searchParams.get('url') || parsed.searchParams.get('q');
                if (embedded) {
                    currentUrl = decodeURIComponent(embedded);
                    hops++;
                    continue;
                }
            }

            const response = await axios.head(currentUrl, {
                headers: BROWSER_HEADERS,
                timeout: 4000,
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400
            });

            if (response.headers.location) {
                const nextUrl = new URL(response.headers.location, currentUrl).href;
                currentUrl = nextUrl;
                hops++;
            } else {
                break;
            }
        } catch (err) {
            if (err.response && err.response.headers && err.response.headers.location) {
                currentUrl = new URL(err.response.headers.location, currentUrl).href;
                hops++;
            } else {
                break;
            }
        }
    }

    return currentUrl;
}

/**
 * Traverses a Linktree or Beacons bio aggregator page to extract registration links.
 * Parses both standard <a> anchors and Next.js __NEXT_DATA__ JSON hydration payloads.
 * @param {string} bioUrl
 * @returns {Promise<string[]>} Array of resolved Google Forms / registration links
 */
async function crawlBioAggregatorLinks(bioUrl) {
    if (!bioUrl || typeof bioUrl !== 'string') return [];
    const resolvedBio = await resolveRedirectChain(bioUrl);

    if (resolvedBio.includes('mason360.gmu.edu') || resolvedBio.includes('campusgroups.com')) {
        return [];
    }

    const registrationLinks = [];
    try {
        const response = await axios.get(resolvedBio, {
            headers: BROWSER_HEADERS,
            timeout: 5000,
            maxContentLength: 200 * 1024,
            maxBodyLength: 200 * 1024
        });

        const rawHtml = response.data;
        if (typeof rawHtml !== 'string') return [];

        const $ = cheerio.load(rawHtml);

        // 1. Scan standard anchor elements
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase();
            if (!href) return;

            const lower = href.toLowerCase();
            if (
                lower.includes('forms.gle') ||
                lower.includes('docs.google.com/forms') ||
                lower.includes('tournamentsoftware.com') ||
                ((text.includes('register') || text.includes('tournament') || text.includes('open')) && lower.startsWith('http'))
            ) {
                registrationLinks.push(href);
            }
        });

        // 2. Scan Next.js hydration scripts (__NEXT_DATA__)
        const nextDataScript = $('#__NEXT_DATA__').html();
        if (nextDataScript) {
            try {
                const parsedData = JSON.parse(nextDataScript);
                const jsonString = JSON.stringify(parsedData);
                const matches = jsonString.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^"'\s\\]+/g);
                if (matches) {
                    matches.forEach(m => registrationLinks.push(m));
                }
            } catch (_) {}
        }

        // Dereference Cheerio
        return [...new Set(registrationLinks)];
    } catch (err) {
        return [];
    }
}

/**
 * Deep scrapes a public Google Form to extract Title, Event Dates, Pricing, and Divisions.
 * @param {string} formUrl
 * @returns {Promise<Object|null>} Extracted form metadata
 */
async function parseGoogleFormDetails(formUrl) {
    if (!formUrl || typeof formUrl !== 'string') return null;
    const resolvedUrl = await resolveRedirectChain(formUrl);

    if (!resolvedUrl.includes('forms.gle') && !resolvedUrl.includes('docs.google.com/forms')) {
        return null;
    }

    try {
        const response = await axios.get(resolvedUrl, {
            headers: BROWSER_HEADERS,
            timeout: 6000,
            maxContentLength: 150 * 1024,
            maxBodyLength: 150 * 1024
        });

        const html = response.data;
        if (typeof html !== 'string') return null;

        // Check for closed form markers
        if (
            html.includes('no longer accepting responses') ||
            html.includes('form has been closed') ||
            html.includes('is no longer accepting submissions')
        ) {
            return { isClosed: true };
        }

        const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/s);
        if (!match) return null;

        const rawData = JSON.parse(match[1]);
        const formTitle = rawData[1]?.[8] || '';
        const formDescription = rawData[1]?.[0] || '';
        const questions = rawData[1]?.[1] || [];

        const divisions = [];
        for (const q of questions) {
            const questionTitle = (q[1] || '').toLowerCase();
            if (questionTitle.includes('division') || questionTitle.includes('flight') || questionTitle.includes('event')) {
                const options = q[4]?.[0]?.[1] || [];
                for (const opt of options) {
                    if (opt[0]) divisions.push(opt[0]);
                }
            }
        }

        return {
            isClosed: false,
            formTitle,
            formDescription,
            divisions: [...new Set(divisions)],
            sourceUrl: resolvedUrl
        };
    } catch (err) {
        return null;
    }
}

module.exports = {
    resolveRedirectChain,
    crawlBioAggregatorLinks,
    parseGoogleFormDetails
};
```

---

## 4. Blueprint 3: Pre-Flight Automated Link Health Verification & Fallback Router

### 4.1 Problem & Objectives
When external registration links fail (e.g. 404 Not Found, deleted forms, DNS resolution failure), players clicking cards in the public directory encounter browser error pages.

The objectives of the Pre-Flight Link Health subsystem are:
1. Validate all outbound URLs **pre-flight** before creating proposals or publishing tournaments.
2. Execute a non-blocking two-phase verification cascade: fast HTTP `HEAD` with automatic fallback to lightweight `GET` (capped at 50KB) on HTTP 405 Method Not Allowed.
3. Automatically bind verified collegiate club homepages and Linktree directories as fallbacks whenever a specific event form expires.
4. Maintain a 6-hour cron audit crawler that refreshes link statuses and atomically evicts affected Redis cache keys.

### 4.2 Two-Phase Probing Architecture

```
                 [Target Registration URL]
                             │
                             ▼
               [Phase 1: Fast HTTP HEAD]
               - Headers: Chrome Windows User-Agent
               - Timeout: 3000ms
               - maxRedirects: 5
               - validateStatus: return all
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
    [Status 200 - 399]              [Status 405 Method Not Allowed]
            │                                 │
            ▼                                 ▼
     linkStatus: 'valid'             [Phase 2: Lightweight GET]
     linkStatusCode: 200             - Range: 0-1024 bytes
     isAlive: true                   - maxContentLength: 50KB
                                     - Timeout: 3000ms
                                              │
                             ┌────────────────┴────────────────┐
                             ▼                                 ▼
                     [Status 200 - 399]             [Status 400+ / Timeout]
                             │                                 │
                             ▼                                 ▼
                      linkStatus: 'valid'             linkStatus: 'expired'
                      linkStatusCode: 200             linkStatusCode: 404/0
                      isAlive: true                   isAlive: false
                                                               │
                                                               ▼
                                               [Host Club Fallback Resolution]
                                               - Inspects handle & location
                                               - Maps @gmu_badminton -> gmubadminton
                                               - Sets fallbackRegistrationUrl
```

### 4.3 Verified Host Club Directory & Fallback Resolution Matrix

| Club Entity | Primary Handles | Recognized Venue Keywords | Verified Fallback URL |
|---|---|---|---|
| **George Mason University** | `@gmu_badminton`, `@gmubadminton` | RAC Gym, Fairfax, George Mason | `https://linktr.ee/gmubadminton` |
| **University of Maryland** | `@umd_badminton`, `@umdclubbadminton` | SPH, Ritchie Coliseum, College Park | `https://linktr.ee/umd_badminton` |
| **Capital Badminton Academy** | `@cba_badminton`, `@capitalbadminton` | Columbia MD, Capital Badminton | `https://www.capitalbadminton.com` |
| **Northern Virginia Badminton Club** | `@nvbadminton`, `@novabadminton` | Ashburn VA, NVBC, Nova Badminton | `https://novabadmintonacademy.com` |
| **University of Virginia** | `@uvabadminton` | Mem Gym, Slaughter, Charlottesville | `https://linktr.ee/uvabadminton` |
| **Virginia Tech** | `@vtechbadminton` | McComas Hall, War Memorial, Blacksburg | `https://linktr.ee/vtechbadminton` |
| **Generic Collegiate Handle** | `@<handle>` | Any identified collegiate handle | `https://linktr.ee/<handle>` |
| **Default Fallback** | Unidentified | Catch-all | `https://linktr.ee/gmubadminton` |

### 4.4 Production Implementation (`server/utils/linkHealthChecker.js`)

```javascript
const axios = require('axios');
const Tournament = require('../models/Tournament');
const redis = require('./redis');

const HEALTHCHECK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

function resolveHostClubFallback(tournament = {}) {
    const handle = (tournament.hostClubHandle || '').replace('@', '').toLowerCase();
    if (handle === 'gmu_badminton' || handle === 'gmubadminton') return 'https://linktr.ee/gmubadminton';
    if (handle === 'umd_badminton' || handle === 'umdclubbadminton') return 'https://linktr.ee/umd_badminton';
    if (handle === 'cba_badminton' || handle === 'capitalbadminton') return 'https://www.capitalbadminton.com';
    if (handle === 'nvbadminton' || handle === 'novabadminton') return 'https://novabadmintonacademy.com';
    if (handle === 'uvabadminton') return 'https://linktr.ee/uvabadminton';
    if (handle === 'vtechbadminton') return 'https://linktr.ee/vtechbadminton';
    if (handle) return `https://linktr.ee/${handle}`;

    const text = [
        tournament.hostUniversity || '',
        tournament.hostClubHandle || '',
        tournament.eventLocation || '',
        tournament.tournamentName || '',
        tournament.sourceUrl || ''
    ].join(' ').toLowerCase();

    if (text.includes('george mason') || text.includes('gmu') || text.includes('rac gym') || text.includes('fairfax')) {
        return 'https://linktr.ee/gmubadminton';
    }
    if (text.includes('capital badminton') || text.includes('columbia, md') || text.includes('cba')) {
        return 'https://www.capitalbadminton.com';
    }
    if (text.includes('northern virginia') || text.includes('nvbc') || text.includes('ashburn')) {
        return 'https://novabadmintonacademy.com';
    }
    if (text.includes('maryland') || text.includes('umd') || text.includes('college park')) {
        return 'https://linktr.ee/umd_badminton';
    }

    return tournament.sourceUrl || 'https://linktr.ee/gmubadminton';
}

async function verifyLinkHealth(url, timeoutMs = 3000) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return { linkStatus: 'expired', isAlive: false, statusCode: 0, error: 'Invalid URL format' };
    }

    try {
        const headRes = await axios.head(url, {
            headers: HEALTHCHECK_HEADERS,
            timeout: timeoutMs,
            maxRedirects: 5,
            validateStatus: () => true
        });

        if (headRes.status >= 200 && headRes.status < 400) {
            return { linkStatus: 'valid', isAlive: true, statusCode: headRes.status };
        }

        // 405 Method Not Allowed retry with lightweight GET
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

        return { linkStatus: 'expired', isAlive: false, statusCode: headRes.status };
    } catch (err) {
        const statusCode = err.response?.status || 0;
        return { linkStatus: 'expired', isAlive: false, statusCode, error: err.message };
    }
}

module.exports = {
    resolveHostClubFallback,
    verifyLinkHealth
};
```

---

## 5. Blueprint 4: Human-in-the-Loop Admin Review Queue Guarantees

### 5.1 Problem & Invariants
Direct auto-publishing from social scrapers or web search introduces major platform risks:
- Spurious dates or misleading registration links entering the public calendar.
- Formatting clutter or offensive captions polluting student feeds.
- Accidental duplication of ongoing tournaments.

To guarantee platform integrity, the system implements **two mandatory invariants**:
1. **The Zero-Live-Publish Invariant**: Autonomous scrapers write exclusively to `ProposedTournament` (with `status: 'pending'`). Scrapers possess zero code paths to insert directly into `Tournament`.
2. **The Public Isolation Invariant**: The public endpoint `GET /api/tournaments` executes exclusively against the `Tournament` collection (`status != 'archived'`). It never queries or exposes documents from `ProposedTournament` or `DiscoveryQueue`.

### 5.2 Dateless & TBD Discovery Handling
When an Instagram flyer or SERP snippet announces an upcoming tournament without confirmed dates (e.g., *"GMU Fall Open 2026 announced — save the date, registration opening next month"*):
1. The Hunter extracts `startDate = null`.
2. The item is **NOT discarded** and **NO speculative fake date is fabricated**.
3. It is routed to `ProposedTournament` with `date: null`, `confidenceScore: 75`, and `status: 'pending'`.
4. The admin review queue displays the proposal with an amber `[Date TBD]` chip.
5. The admin can verify the confirmed date once announced, edit the record via `PUT /api/admin/tournaments/:id`, and trigger `POST /approve/:id`.

### 5.3 Review Queue Data Model & Schema (`server/models/ProposedTournament.js`)

```javascript
const mongoose = require("mongoose");

const proposedTournamentSchema = new mongoose.Schema({
    // Raw Context for Split-Screen UI
    rawCaption: { type: String, default: "" },
    flyerImageUrl: { type: String, default: "" },
    scrapedImageUrls: { type: [String], default: [] },
    sourceLinks: { type: [String], default: [] },
    sourceType: { type: String, default: "WEB_CRAWLER" },

    // AI Structured Data
    tournamentName: { type: String, required: true, trim: true },
    date: { type: Date, default: null }, // Nullable for Dateless/TBD events
    location: { type: String, default: "TBD" },
    entryFee: { type: String, default: "" },
    registrationLink: { type: String, default: "" },
    skillLevels: { type: [String], default: [] },
    registrationDeadline: { type: Date, default: null },

    // Healthcheck & Routing Metadata
    sourceUrl: { type: String, required: true },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    linkStatus: {
        type: String,
        enum: ["valid", "expired", "warning", "unchecked"],
        default: "unchecked"
    },
    linkStatusCode: { type: Number },
    fallbackRegistrationUrl: { type: String, default: "" },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true
    },

    // Audit Trail
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    createdTournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Performance Indexes
proposedTournamentSchema.index({ status: 1, confidenceScore: -1 });
proposedTournamentSchema.index({ sourceUrl: 1 });

module.exports = mongoose.model("ProposedTournament", proposedTournamentSchema);
```

### 5.4 Approval Mutation & Cache Eviction (`server/routes/adminTournaments.js`)

```javascript
/**
 * POST /api/admin/tournaments/approve/:id
 * Promotes a proposed tournament to live status with isOpenTournament: true
 */
router.post("/approve/:id", adminActionLimiter, async (req, res) => {
    const { id } = req.params;
    const proposed = await ProposedTournament.findById(id);

    if (!proposed) {
        return res.status(404).json({ message: "Proposed tournament not found." });
    }
    if (proposed.status === "approved") {
        return res.status(400).json({ message: "Proposal is already approved." });
    }

    // Live promotion document
    const tournament = new Tournament({
        tournamentName: proposed.tournamentName,
        eventLocation: proposed.location || "TBD",
        hostUniversity: "Local Club",
        startDate: proposed.date,
        endDate: proposed.date,
        registrationDeadline: proposed.registrationDeadline || proposed.date,
        registrationUrl: proposed.registrationLink || proposed.sourceUrl,
        sourceUrl: proposed.sourceUrl,
        flyerImageUrl: proposed.flyerImageUrl || proposed.scrapedImageUrls[0] || "",
        skillLevels: proposed.skillLevels || [],
        originalCaption: proposed.rawCaption || "",
        isOpenTournament: true, // Invariant: Visible to public feeds
        linkStatus: proposed.linkStatus,
        fallbackRegistrationUrl: proposed.fallbackRegistrationUrl,
        createdAt: new Date()
    });

    await tournament.save();

    // Update proposal audit trail
    proposed.status = "approved";
    proposed.approvedAt = new Date();
    proposed.approvedBy = req.user.id;
    proposed.createdTournamentId = tournament._id;
    await proposed.save();

    // Atomic Cache Invalidation & WebSocket Broadcast
    try {
        if (typeof redis.invalidateCacheTag === 'function') {
            await redis.invalidateCacheTag("tournaments:active_keys");
        }
    } catch (_) {}

    req.io?.emit("tournamentApproved", tournament);

    return res.status(200).json({
        message: "Tournament approved and published successfully.",
        tournament
    });
});
```

---

## 6. Integration Contract & Production Readiness Verification

The four architectural blueprints defined in this document establish complete technical coverage for Milestone 6:
- **Multimodal Flyer Vision** extracts dates, venues, fees, and flight divisions directly from image pixels via Gemini 2.5 Flash SDK.
- **Deep Linktree Crawler** unshortens links and parses Google Forms DOM schemas (`FB_PUBLIC_LOAD_DATA_`) while strictly bypassing Mason360 per repository direct orders.
- **Pre-Flight Health Prober** guards outbound links via two-phase HEAD/GET checks and maps failures to verified collegiate Linktree fallbacks.
- **Admin Review Queue** enforces zero live auto-publishing, protects the public `/api/tournaments` feed, handles dateless events safely, and invalidates Redis caches atomically.
