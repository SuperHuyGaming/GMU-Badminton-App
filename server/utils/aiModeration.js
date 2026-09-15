const Sentiment = require('sentiment');
const natural = require('natural');
const { google } = require('googleapis');

const sentimentAnalyzer = new Sentiment();

// Initialize and train a Naive Bayes Classifier for Spam detection
const classifier = new natural.BayesClassifier();

// Perspective API Setup
const API_KEY = process.env.GOOGLE_PERSPECTIVE_API_KEY;
const DISCOVERY_URL =
  'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

let perspectiveClient = null;
if (API_KEY && API_KEY !== 'mock_google_perspective_api_key_for_now') {
    google.discoverAPI(DISCOVERY_URL)
        .then(client => {
            perspectiveClient = client;
            console.log("✅ Google Perspective API Initialized.");
        })
        .catch(err => console.error("Failed to init Perspective API:", err));
}

// Provide some initial training data for the ML model
const trainingData = [
    // SPAM
    { text: "click here for free money", label: "spam" },
    { text: "buy cheap crypto now", label: "spam" },
    { text: "venmo me sugar daddy", label: "spam" },
    { text: "earn cash fast link in bio", label: "spam" },
    { text: "win a free iphone click here", label: "spam" },
    { text: "hot girls waiting for you", label: "spam" },
    
    // HAM (Legit badminton stuff)
    { text: "anyone want to play singles today at the rac?", label: "ham" },
    { text: "what string tension do you recommend for astrox 99?", label: "ham" },
    { text: "i am looking for a doubles partner for the tournament", label: "ham" },
    { text: "nice smash!", label: "ham" },
    { text: "the gym is closed tomorrow", label: "ham" },
    { text: "can someone lend me a racket?", label: "ham" },
    { text: "my backhand clear needs work", label: "ham" }
];

trainingData.forEach(item => {
    classifier.addDocument(item.text, item.label);
});
classifier.train();

/**
 * AI-Powered Moderation Function
 * Uses Sentiment Analysis for Toxicity and Naive Bayes for Spam
 */
const analyzeContent = async (text) => {
    if (!text || typeof text !== 'string') return { isFlagged: false, reason: "" };

    // Prevent DOS attacks by limiting analysis to the first 1000 characters
    const safeText = text.substring(0, 1000);

    let baseScore = 0;
    try {
        // 0. Google Perspective API (Enterprise Toxicity Detection)
        if (perspectiveClient) {
            const analyzeRequest = {
                comment: { text: safeText },
                requestedAttributes: { TOXICITY: {} }
            };
            
            const response = await perspectiveClient.comments.analyze({
                key: API_KEY,
                resource: analyzeRequest
            });
            
            const toxicityProb = response.data.attributeScores.TOXICITY.summaryScore.value;
            // A toxicity probability above 0.70 is heavily toxic
            if (toxicityProb > 0.70) {
                return {
                    isFlagged: true,
                    reason: `AI Moderation (Perspective): Highly toxic content detected (Prob: ${(toxicityProb*100).toFixed(1)}%).`,
                    score: -(toxicityProb * 10) // Map 0->1 to 0->-10
                };
            }
        }

        // 1. Fallback Toxicity / Sentiment Analysis
        const sentimentResult = sentimentAnalyzer.analyze(safeText);
        baseScore = sentimentResult.score;

        // Score < -4 usually indicates heavy toxicity or aggression
        if (sentimentResult.score < -4) {
            return {
                isFlagged: true,
                reason: `AI Moderation: Highly negative sentiment detected (Score: ${sentimentResult.score}).`,
                score: sentimentResult.score
            };
        }

        // 2. ML Spam Classification
        if (safeText.split(' ').length > 2) {
            const classification = classifier.classify(safeText);
            if (classification === 'spam') {
                return {
                    isFlagged: true,
                    reason: "AI Moderation: Classified as SPAM by ML algorithm.",
                    score: sentimentResult.score
                };
            }
        }
    } catch (error) {
        console.error("AI Moderation Error:", error);
    }

    // 3. Fallback Hardcoded Filter for severe slurs (which bypass sentiment sometimes)
    const slurs = ["nigger", "faggot", "retard", "cunt", "whore"];
    const lowerText = safeText.toLowerCase();
    if (slurs.some(slur => lowerText.includes(slur))) {
        return {
            isFlagged: true,
            reason: "AI Moderation: Restricted language detected.",
            score: baseScore
        };
    }

    // 4. Repeated character DOS protection
    if (/(.)\1{20,}/.test(lowerText)) {
        return {
            isFlagged: true,
            reason: "AI Moderation: Spam pattern (repeated characters) detected.",
            score: baseScore
        };
    }

    return { isFlagged: false, reason: "", score: baseScore };
};

module.exports = { analyzeContent, classifier };
