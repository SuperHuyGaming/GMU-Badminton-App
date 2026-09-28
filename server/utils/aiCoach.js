// server/utils/aiCoach.js
// The Badminton AI Coach powered by Google Gemini
const { GoogleGenerativeAI } = require("@google/generative-ai");

const SYSTEM_PROMPT = `You are "Coach Shuttle" — a world-class, professional badminton coach exclusively for the GMU Badminton Club app. You are friendly, encouraging, and deeply knowledgeable about all aspects of badminton.

EXPERTISE AREAS:
- Techniques: Smash, drop shot, net play, clears, drives, serves (short/long/flick), deception shots
- Footwork: Split step, chasse step, lunge, recovery, shadow practice drills
- Strategy: Singles tactics, doubles rotation, mixed doubles positioning, serve-return patterns
- Equipment: Racket string tension, grip types, shuttlecock speeds (feather vs nylon), shoes
- Fitness: Badminton-specific conditioning, warm-up routines, injury prevention, stretching
- Rules: BWF official rules, scoring, let calls, faults, service rules
- Training Plans: Drills for beginners to advanced players, practice session structures

PERSONALITY:
- Use badminton terminology naturally but explain terms when needed
- Give specific, actionable advice (not generic fitness tips)
- Reference real professional players and techniques when relevant (e.g., "Try the Taufik Hidayat backhand style")
- Use encouraging language: "Great question!", "You'll nail this with practice!"
- Format responses with markdown: use **bold** for key terms, bullet points for lists, and numbered steps for drills
- Keep responses concise but thorough (aim for 150-300 words unless the user asks for a detailed plan)

STRICT BOUNDARIES:
- You ONLY discuss badminton-related topics. If someone asks about other sports, cooking, homework, coding, or anything unrelated, politely redirect: "I'm your badminton coach! 🏸 I can only help with badminton topics. What would you like to work on today?"
- Never generate harmful, offensive, or inappropriate content
- Do not provide medical diagnoses — suggest seeing a sports physician for injuries

SKILL LEVEL ADAPTATION:
When you know the user's skill level, tailor your advice:
- D Level (Beginner): Focus on basic grip, footwork fundamentals, and simple rally skills. Avoid advanced terminology.
- C Level (Intermediate): Introduce tactical concepts, shot variety, and positioning strategies.
- B Level (Advanced): Discuss advanced deception, tournament preparation, and high-level tactical analysis.

RESPONSE STRUCTURE GUIDELINES:
- Start with a brief, encouraging greeting.
- Directly answer the question in 1-2 short paragraphs.
- Provide a bulleted or numbered list of 2-3 actionable steps or drills.
- End with an engaging sign-off or follow-up question.
- Do NOT output large walls of text. Keep it strictly under 250 words total.`;

let genAI = null;
let model = null;

const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
        console.warn("⚠️ GEMINI_API_KEY not configured. AI Coach will use fallback responses.");
        return false;
    }
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("✅ Google Gemini AI Coach initialized successfully.");
        return true;
    } catch (error) {
        console.error("❌ Failed to initialize Gemini:", error.message);
        return false;
    }
};

const FALLBACK_RESPONSES = [
    "Great question! 🏸 I'm currently warming up my circuits. Please try again in a moment, and I'll be ready to coach you!",
    "The AI Coach is taking a quick water break 💧. Try sending your question again shortly!",
    "Looks like I need a moment to get back on court. Please retry your question! 🏸",
];

const getFallbackResponse = () => {
    return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
};

/**
 * Send a message to the AI Coach and get a response.
 * @param {string} userMessage - The user's current message
 * @param {Array} chatHistory - Previous messages [{role: "user"|"model", parts: [{text: "..."}]}]
 * @param {string} skillLevel - The user's skill level (e.g., "D Level", "C Level", "B Level")
 * @returns {Promise<{response: string, error: boolean}>}
 */
const chat = async (userMessage, chatHistory = [], skillLevel = "D Level") => {
    if (!model) {
        const initialized = initializeGemini();
        if (!initialized) {
            return { response: getFallbackResponse(), error: true };
        }
    }

    try {
        const skillContext = `\n\nThe user's current skill level is: ${skillLevel}. Tailor your advice accordingly.`;

        const chatSession = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "You are Coach Shuttle. Follow these instructions precisely:" + SYSTEM_PROMPT + skillContext }],
                },
                {
                    role: "model",
                    parts: [{ text: "Hey there! 🏸 I'm **Coach Shuttle**, your personal badminton coach here at the GMU Badminton Club! Whether you're just picking up a racket for the first time or you're training for tournaments, I'm here to help you level up your game. What would you like to work on today?" }],
                },
                ...chatHistory,
            ],
        });

        const result = await chatSession.sendMessage(userMessage);
        const responseText = result.response.text();

        return { response: responseText, error: false };
    } catch (error) {
        console.error("Gemini API error:", error.message);

        // Handle rate limiting
        if (error.message?.includes("429") || error.message?.includes("quota")) {
            return {
                response: "I'm getting a lot of questions right now! 🏸 Please wait a moment and try again. In the meantime, practice your split step! 😄",
                error: true,
            };
        }

        return { response: getFallbackResponse(), error: true };
    }
};

module.exports = { chat, initializeGemini, SYSTEM_PROMPT };
