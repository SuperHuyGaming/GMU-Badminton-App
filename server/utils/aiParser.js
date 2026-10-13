const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash_on_import" });

// Configurable primary model via GEMINI_MODEL.
// Defaults to 'gemini-3.5-flash-lite' (high throughput, ~500-1000 requests/day on free tier)
// with fallback cascade to 'gemini-3.8-flash'.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const CANDIDATE_MODELS = Array.from(new Set([
    PRIMARY_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash"
])).filter(Boolean);

let quotaCooldownUntil = 0;

async function generateWithGemini({ contents, config }) {
    // Zero-Quota Circuit Breaker: if all models are currently quota-exhausted, immediately bypass to heuristic parser
    if (Date.now() < quotaCooldownUntil) {
        return null;
    }

    for (const modelName of CANDIDATE_MODELS) {
        let attempts = 2;
        while (attempts > 0) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents,
                    config
                });
                if (response && response.text) {
                    return response.text;
                }
                return null;
            } catch (err) {
                attempts--;
                const errMsg = err?.message || '';
                const isRateLimited = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
                const isHighDemand = errMsg.includes("503");

                if (isHighDemand && attempts > 0) {
                    console.warn(`[AIParser] Gemini ${modelName} high demand (503). Retrying in 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                if (isRateLimited) {
                    console.warn(`[AIParser] Gemini ${modelName} quota exceeded (429).`);
                    break; // Move to next candidate model
                }

                console.warn(`[AIParser] Gemini ${modelName} unavailable: ${errMsg.substring(0, 100)}`);
                break; // Try next model or fallback
            }
        }
    }

    // All models quota-exhausted: activate circuit breaker cooldown for 5 minutes
    quotaCooldownUntil = Date.now() + 5 * 60 * 1000;
    console.warn("[AIParser] All Gemini models quota exhausted. Switching to zero-quota heuristic parser for 5m.");
    return null;
}

const schema = {
    type: Type.OBJECT,
    properties: {
        isTournamentPost: {
            type: Type.BOOLEAN,
            description: "True if this post is advertising or announcing a badminton tournament."
        },
        tournamentName: {
            type: Type.STRING,
            description: "The official name of the tournament, if mentioned."
        },
        startDate: {
            type: Type.STRING,
            description: "The starting date of the tournament (ISO 8601 YYYY-MM-DD), if found."
        },
        endDate: {
            type: Type.STRING,
            description: "The ending date of the tournament (ISO 8601 YYYY-MM-DD), if found."
        },
        registrationDeadline: {
            type: Type.STRING,
            description: "The deadline to register for the tournament (ISO 8601 YYYY-MM-DD), if found."
        },
        skillLevels: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The skill levels mentioned, such as 'A', 'B', 'C', 'D', 'Open', 'Collegiate'."
        }
    },
    required: ["isTournamentPost", "skillLevels"]
};

function sanitizeParsedDate(dateStr, defaultWeeksAhead = 3) {
    if (!dateStr) return new Date(Date.now() + defaultWeeksAhead * 7 * 86400000).toISOString().split('T')[0];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return new Date(Date.now() + defaultWeeksAhead * 7 * 86400000).toISOString().split('T')[0];
    }
    const year = d.getFullYear();
    // Guard against historical club founding years (e.g. 2001) or far future anomalies (> 2028)
    if (year < 2026 || year > 2028) {
        d.setFullYear(2026);
    }
    return d.toISOString().split('T')[0];
}

/**
 * Uses Gemini Flash to parse messy Instagram captions and extract structured tournament data
 * @param {string} caption - The raw text from the Instagram post
 */
async function parseInstagramPost(caption) {
    if (!caption || typeof caption !== "string" || caption.trim() === '') return null;

    try {
        const safeCaption = caption.substring(0, 5000);
        const text = await generateWithGemini({
            contents: `You are a sports data extraction assistant. Read the following Instagram post from a collegiate badminton club. Determine if it is a tournament announcement. If it is, extract the tournament name, dates, deadlines, and skill levels.
CRITICAL RULES:
1. Extract the EVENT DATE when matches will actually be played, NOT when the Instagram post was created.
2. NEVER use club founding or establishment dates (e.g. 'Est. 2001' or 'Since 2005').
3. Active tournaments must be upcoming in 2026 or 2027. If year is missing (e.g. 'Nov 14'), assume 2026.
4. If the tournament already took place in past years (2025, 2024, etc.) or past months of 2026, set isTournamentPost to false.
5. If the tournament name explicitly contains a past year (e.g. '2025 Open'), set isTournamentPost to false.

Post Caption:\n${safeCaption}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1
            }
        });

        if (text) {
            const data = JSON.parse(text);
            if (data && data.isTournamentPost) {
                // Reject past year in tournament name
                if (/\b(201\d|202[0-5])\b/.test(data.tournamentName || '')) {
                    return null;
                }
                // Reject if event already ended in the past
                if (data.startDate) {
                    const eD = data.endDate ? new Date(data.endDate) : new Date(data.startDate);
                    if (!isNaN(eD.getTime()) && eD.getTime() < Date.now()) {
                        return null;
                    }
                }
                if (data.startDate) data.startDate = sanitizeParsedDate(data.startDate, 3);
                if (data.endDate) data.endDate = sanitizeParsedDate(data.endDate, 3);
                if (data.registrationDeadline) data.registrationDeadline = sanitizeParsedDate(data.registrationDeadline, 2);
            }
            return data;
        }
        return fallbackRegexParser(caption);
    } catch (e) {
        console.warn("[AIParser] Fallback to regex parser:", e.message);
        return fallbackRegexParser(caption);
    }
}

function fallbackRegexParser(caption) {
    // Strip historical establishment phrases (e.g. "est. 2001", "since 1998") before matching tournament dates
    const cleaned = caption.replace(/\b(?:est\.?|established|since|founded|history|copyright|©)\s*(?:in\s*)?(?:19\d{2}|20[0-2][0-5])\b/gi, '');
    const lower = cleaned.toLowerCase();
    const isTournament = /tournament|open|invitational|championship/i.test(lower);
    if (!isTournament) return null;

    let tournamentName = "Collegiate Badminton Tournament";
    const nameMatch = cleaned.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Open|Invitational|Tournament))/);
    if (nameMatch) tournamentName = nameMatch[1];

    // Reject past year in tournament name or caption
    if (/\b(201\d|202[0-5])\b/.test(tournamentName) || /\b(201\d|202[0-5])\b/.test(cleaned)) return null;

    let skillLevels = [];
    if (/flight/i.test(lower)) {
        if (/\ba\b/i.test(lower)) skillLevels.push("A");
        if (/\bb\b/i.test(lower)) skillLevels.push("B");
        if (/\bc\b/i.test(lower)) skillLevels.push("C");
        if (/\bd\b/i.test(lower)) skillLevels.push("D");
    }
    if (skillLevels.length === 0) skillLevels = ["Open"];

    let startDate = null;
    let endDate = null;
    const rangeMatch = cleaned.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,\s*(\d{4})/i);
    if (rangeMatch) {
        const sD = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[4]}`);
        const eD = new Date(`${rangeMatch[1]} ${rangeMatch[3] || rangeMatch[2]}, ${rangeMatch[4]}`);
        if (!isNaN(sD.getTime())) startDate = sD.toISOString().split('T')[0];
        if (!isNaN(eD.getTime())) endDate = eD.toISOString().split('T')[0];
    } else {
        const dateMatch = cleaned.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}/i);
        if (dateMatch) {
            const d = new Date(`${dateMatch[0]} 2026`);
            if (!isNaN(d.getTime())) {
                startDate = d.toISOString().split('T')[0];
                endDate = startDate;
            }
        }
    }

    // Reject if tournament has already ended in the past
    if (startDate) {
        const checkEnd = endDate ? new Date(endDate) : new Date(startDate);
        if (!isNaN(checkEnd.getTime()) && checkEnd.getTime() < Date.now()) {
            return null;
        }
    }

    console.log("[AIParser] Regex fallback successfully extracted sanitized 2026 data.");
    return { isTournamentPost: true, tournamentName, skillLevels, startDate, endDate: endDate || startDate, registrationDeadline: null };
}


const discoverySchema = {
    type: Type.OBJECT,
    properties: {
        isValidDmvTournament: {
            type: Type.BOOLEAN,
            description: "True if this webpage announces a badminton tournament located in DC, MD, VA, PA, or NC."
        },
        tournamentName: {
            type: Type.STRING,
            description: "The official name of the tournament."
        },
        hostLocation: {
            type: Type.STRING,
            description: "The city, state, or venue where it takes place."
        },
        startDate: {
            type: Type.STRING,
            description: "Starting date (YYYY-MM-DD)."
        },
        endDate: {
            type: Type.STRING,
            description: "Ending date (YYYY-MM-DD)."
        },
        registrationDeadline: {
            type: Type.STRING,
            description: "Registration deadline (YYYY-MM-DD)."
        }
    },
    required: ["isValidDmvTournament"]
};

async function parseDiscoveredWebpage(rawText, url) {
    if (!rawText) return null;
    try {
        const text = await generateWithGemini({
            contents: `You are an autonomous tournament discovery AI. Read the text from this webpage (${url}) and determine if it describes a badminton tournament happening in the DMV area (DC, Maryland, Virginia) or nearby (PA, NC). If yes, extract details.
CRITICAL RULES:
1. Extract the actual EVENT DATE when tournament matches are played, NOT club founding dates, historical records, or webpage copyrights (e.g. 'Est. 2001' or 'Founded 1999').
2. Active tournaments must take place in upcoming dates of 2026 or 2027. If year is missing, assume 2026.
3. If the tournament already took place in past years (e.g. 2025, 2024, etc.) or past months of 2026, set isValidDmvTournament to false.
4. If the tournament title contains past years (e.g. '2025 Capital NE Open'), set isValidDmvTournament to false.

Webpage Text:\n${rawText.substring(0, 5000)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: discoverySchema,
                temperature: 0.1
            }
        });
        if (text) {
            const data = JSON.parse(text);
            if (data && data.isValidDmvTournament) {
                // Reject past year in tournament title
                if (/\b(201\d|202[0-5])\b/.test(data.tournamentName || '')) {
                    return { isValidDmvTournament: false };
                }
                // Reject if event already concluded in the past
                if (data.startDate) {
                    const eD = data.endDate ? new Date(data.endDate) : new Date(data.startDate);
                    if (!isNaN(eD.getTime()) && eD.getTime() < Date.now()) {
                        return { isValidDmvTournament: false };
                    }
                }
                if (data.startDate) data.startDate = sanitizeParsedDate(data.startDate, 3);
                if (data.endDate) data.endDate = sanitizeParsedDate(data.endDate, 3);
                if (data.registrationDeadline) data.registrationDeadline = sanitizeParsedDate(data.registrationDeadline, 2);
            }
            return data;
        }
        return fallbackWebpageParser(rawText, url);
    } catch (e) {
        console.warn("[AIParser] Fallback to webpage heuristic parser:", e.message);
        return fallbackWebpageParser(rawText, url);
    }
}

function fallbackWebpageParser(rawText, url) {
    if (!rawText) return null;
    const lower = rawText.toLowerCase();

    // Check if it's a badminton tournament
    const hasBadminton = lower.includes("badminton") || (url && url.toLowerCase().includes("badminton"));
    const hasTournamentKeyword = /tournament|open|championship|invitational|classic|cup|playoff/i.test(lower);
    if (!hasBadminton || !hasTournamentKeyword) {
        return { isValidDmvTournament: false };
    }

    // Check if located in DMV / Mid-Atlantic
    const isDmv = /\b(va|virginia|md|maryland|dc|washington\s*d\.?c\.?|pa|pennsylvania|nc|north\s*carolina|columbia|fairfax|ashburn|college\s*park|gaithersburg|rockville)\b/i.test(lower)
        || /\b2[0-4]\d{3}\b/.test(lower)
        || (url && /gmu|umd|capitalbadminton|novabadminton/i.test(url));

    if (!isDmv) {
        return { isValidDmvTournament: false };
    }

    // Extract tournament title
    let tournamentName = "DMV Badminton Tournament";
    const bracketMatch = rawText.match(/\[([^\]]+)\]/);
    if (bracketMatch && bracketMatch[1].length > 5) {
        tournamentName = bracketMatch[1].trim();
    } else {
        const titleMatch = rawText.match(/([A-Z0-9][A-Za-z0-9\s&'-]+(?:Open|Championships?|Invitational|Classic|Playoff|Tournament))/);
        if (titleMatch) tournamentName = titleMatch[1].trim();
    }

    // Reject if tournament title contains an explicit past year (e.g. 2025, 2024, etc.)
    if (/\b(201\d|202[0-5])\b/.test(tournamentName)) {
        return { isValidDmvTournament: false, reason: "Past tournament year in title" };
    }

    // Extract location (clean boundary before registration or deadline metadata)
    let hostLocation = "DMV Area";
    const locMatch = rawText.match(/Location:\s*([^|\n]+?)(?=\s*(?:Registration|Deadline|Ends|Date|Fee|Skill|Cost|$))/i)
        || rawText.match(/(?:Venue|Hosted at|at)\s*([^.,\n]+?(?:Gym|Center|Club|Complex|Academy|University))/i);
    if (locMatch) {
        hostLocation = locMatch[1].trim();
    } else if (lower.includes("fairfax") || lower.includes("rac") || lower.includes("gmu")) {
        hostLocation = "RAC Gym, George Mason University, Fairfax, VA";
    } else if (lower.includes("columbia") || lower.includes("capital")) {
        hostLocation = "Capital Badminton Academy, Columbia, MD";
    } else if (lower.includes("college park") || lower.includes("umd")) {
        hostLocation = "Ritchie Coliseum, College Park, MD";
    }

    // Extract dates, stripping historical establishment phrases first
    const cleanedText = rawText.replace(/\b(?:est\.?|established|since|founded|history|copyright|©)\s*(?:in\s*)?(?:19\d{2}|20[0-2][0-5])\b/gi, '');
    let startDate = null;
    let endDate = null;

    // Pattern 1: Month Day(-Day)?, Year (e.g. "April 19-20, 2026" or "Nov 14, 2026")
    const rangeMatch = cleanedText.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,\s*(\d{4})/i);
    if (rangeMatch) {
        const month = rangeMatch[1];
        const startDay = rangeMatch[2];
        const endDay = rangeMatch[3] || startDay;
        const year = rangeMatch[4];
        const sD = new Date(`${month} ${startDay}, ${year}`);
        const eD = new Date(`${month} ${endDay}, ${year}`);
        if (!isNaN(sD.getTime())) startDate = sD.toISOString().split('T')[0];
        if (!isNaN(eD.getTime())) endDate = eD.toISOString().split('T')[0];
    } else {
        // Pattern 2: MM/DD/YYYY
        const slashMatch = cleanedText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (slashMatch) {
            const sD = new Date(`${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`);
            if (!isNaN(sD.getTime())) {
                startDate = sD.toISOString().split('T')[0];
                endDate = startDate;
            }
        } else {
            // Pattern 3: Month Day (no year, assume 2026)
            const monthDayMatch = cleanedText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?/i);
            if (monthDayMatch) {
                const sD = new Date(`${monthDayMatch[0].split('-')[0].trim()} 2026`);
                if (!isNaN(sD.getTime())) {
                    startDate = sD.toISOString().split('T')[0];
                    endDate = startDate;
                }
            }
        }
    }

    // Critical: If the tournament's dates already concluded in the past (< today), reject it!
    if (startDate) {
        const checkEnd = endDate ? new Date(endDate) : new Date(startDate);
        if (!isNaN(checkEnd.getTime()) && checkEnd.getTime() < Date.now()) {
            return { isValidDmvTournament: false, reason: `Tournament already ended on ${endDate || startDate}` };
        }
    }

    let registrationDeadline = null;
    const deadlineMatch = cleanedText.match(/(?:registration\s*(?:ends|deadline|closes)|deadline)[:\s]*([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (deadlineMatch) {
        const dStr = deadlineMatch[1].trim();
        const dD = new Date(dStr.includes(',') || dStr.includes('/') ? dStr : `${dStr}, 2026`);
        if (!isNaN(dD.getTime())) {
            registrationDeadline = dD.toISOString().split('T')[0];
        }
    }

    let skillLevels = ["Open"];
    if (/flight/i.test(lower)) {
        if (/\ba\b/i.test(lower)) skillLevels.push("A");
        if (/\bb\b/i.test(lower)) skillLevels.push("B");
        if (/\bc\b/i.test(lower)) skillLevels.push("C");
        if (/\bd\b/i.test(lower)) skillLevels.push("D");
    }
    if (/collegiate/i.test(lower)) skillLevels.push("Collegiate");
    if (/intermediate/i.test(lower)) skillLevels.push("Intermediate");

    return {
        isValidDmvTournament: true,
        tournamentName,
        hostLocation,
        startDate: startDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        endDate: startDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        registrationDeadline,
        skillLevels: [...new Set(skillLevels)],
        confidenceScore: 90
    };
}

module.exports = {
    parseDiscoveredWebpage,
    parseInstagramPost,
    fallbackRegexParser,
    fallbackWebpageParser,
    sanitizeParsedDate,
    PRIMARY_MODEL,
    CANDIDATE_MODELS,
    generateWithGemini
};
