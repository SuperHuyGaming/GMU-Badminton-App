const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

module.exports = {
    parseInstagramPost
};
