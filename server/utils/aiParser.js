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
    if (!caption || caption.trim() === '') return null;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a sports data extraction assistant. Read the following Instagram post from a collegiate badminton club. Determine if it is a tournament announcement. If it is, extract the tournament name, dates, deadlines, and skill levels.\n\nPost Caption:\n${caption}`,
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
        return null;
    } catch (e) {
        console.error("[AIParser] Error parsing Instagram post:", e.message);
        return null;
    }
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
        return null;
    } catch (e) {
        console.error("[AIParser] Web discovery parse failed:", e.message);
        return null;
    }
}

module.exports = {
    parseDiscoveredWebpage,
    parseInstagramPost
};
