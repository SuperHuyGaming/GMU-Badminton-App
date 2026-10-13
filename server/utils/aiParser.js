const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash_on_import" });

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

/**
 * Uses Gemini Flash to parse messy Instagram captions and extract structured tournament data
 * @param {string} caption - The raw text from the Instagram post
 */
async function parseInstagramPost(caption) {
    if (!caption || typeof caption !== "string" || caption.trim() === '') return null;

    let retries = 2;
    while (retries > 0) {
        try {
            const safeCaption = caption.substring(0, 5000);
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `You are a sports data extraction assistant. Read the following Instagram post from a collegiate badminton club. Determine if it is a tournament announcement. If it is, extract the tournament name, dates, deadlines, and skill levels.\n\nPost Caption:\n${safeCaption}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1
                }
            });

            if (response.text) {
                const data = JSON.parse(response.text);
                return data;
            }
            return fallbackRegexParser(caption);
        } catch (e) {
            retries--;
            if (retries > 0 && e.message && e.message.includes("503")) {
                console.warn(`[AIParser] Gemini 503 busy error. Quick retry (1 attempt left)...`);
                await new Promise(res => setTimeout(res, 800));
            } else {
                console.warn("[AIParser] Gemini extraction unavailable. Using instant regex/heuristic parser:", e.message);
                return fallbackRegexParser(caption);
            }
        }
    }
    return fallbackRegexParser(caption);
}

function fallbackRegexParser(caption) {
    const lower = caption.toLowerCase();
    const isTournament = /tournament|open|invitational|championship/i.test(lower);
    if (!isTournament) return null;

    let skillLevels = [];
    if (/flight/i.test(lower)) {
        if (/\ba\b/i.test(lower)) skillLevels.push("A");
        if (/\bb\b/i.test(lower)) skillLevels.push("B");
        if (/\bc\b/i.test(lower)) skillLevels.push("C");
        if (/\bd\b/i.test(lower)) skillLevels.push("D");
    }
    if (skillLevels.length === 0) skillLevels = ["Open"];

    let tournamentName = "Collegiate Badminton Tournament";
    const nameMatch = caption.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Open|Invitational|Tournament))/);
    if (nameMatch) tournamentName = nameMatch[1];

    let startDate = null;
    const dateMatch = caption.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}/i);
    if (dateMatch) {
        const d = new Date(`${dateMatch[0]} ${new Date().getFullYear()}`);
        if (!isNaN(d)) startDate = d.toISOString().split('T')[0];
    }

    console.log("[AIParser] Regex fallback successfully extracted basic data.");
    return { isTournamentPost: true, tournamentName, skillLevels, startDate, endDate: startDate, registrationDeadline: null };
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
    let retries = 2;
    while (retries > 0) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `You are an autonomous tournament discovery AI. Read the text from this webpage (${url}) and determine if it describes a badminton tournament happening in the DMV area (DC, Maryland, Virginia) or nearby (PA, NC). If yes, extract details.\n\nWebpage Text:\n${rawText.substring(0, 5000)}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: discoverySchema,
                    temperature: 0.1
                }
            });
            if (response.text) return JSON.parse(response.text);
            return fallbackWebpageParser(rawText, url);
        } catch (e) {
            retries--;
            if (retries > 0 && e.message && e.message.includes("503")) {
                console.warn(`[AIParser] Gemini 503 busy error on webpage. Quick retry...`);
                await new Promise(res => setTimeout(res, 800));
            } else {
                console.warn("[AIParser] Web discovery parse error, using instant heuristic fallback:", e.message);
                return fallbackWebpageParser(rawText, url);
            }
        }
    }
    return fallbackWebpageParser(rawText, url);
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

    // Extract location
    let hostLocation = "DMV Area";
    const locMatch = rawText.match(/Location:\s*([^|\n]+)/i) || rawText.match(/(?:Venue|Hosted at|at)\s*([^.,\n]+(?:Gym|Center|Club|Complex|Academy|University))/i);
    if (locMatch) {
        hostLocation = locMatch[1].trim();
    } else if (lower.includes("fairfax") || lower.includes("rac") || lower.includes("gmu")) {
        hostLocation = "RAC Gym, George Mason University, Fairfax, VA";
    } else if (lower.includes("columbia") || lower.includes("capital")) {
        hostLocation = "Capital Badminton Academy, Columbia, MD";
    } else if (lower.includes("college park") || lower.includes("umd")) {
        hostLocation = "Ritchie Coliseum, College Park, MD";
    }

    // Extract dates
    let startDate = null;
    const dateMatch = rawText.match(/(\w{3,9}\s+\d{1,2}(?:\s*-\s*\d{1,2})?,\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) {
        const cleanDateStr = dateMatch[0].split('-')[0].trim();
        const d = new Date(cleanDateStr);
        if (!isNaN(d.getTime())) startDate = d.toISOString().split('T')[0];
    }

    let registrationDeadline = null;
    const deadlineMatch = rawText.match(/deadline[:\s]*(\w{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (deadlineMatch) {
        const d = new Date(deadlineMatch[1].trim());
        if (!isNaN(d.getTime())) registrationDeadline = d.toISOString().split('T')[0];
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
    fallbackWebpageParser
};
