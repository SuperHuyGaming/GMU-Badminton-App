const Sentiment = require('sentiment');
const natural = require('natural');

const sentimentAnalyzer = new Sentiment();

// Initialize and train a Naive Bayes Classifier for Spam detection
const classifier = new natural.BayesClassifier();

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
const analyzeContent = (text) => {
    if (!text || typeof text !== 'string') return { isFlagged: false, reason: "" };

    // Prevent DOS attacks by limiting analysis to the first 1000 characters
    const safeText = text.substring(0, 1000);

    try {
        // 1. Toxicity / Sentiment Analysis
        const sentimentResult = sentimentAnalyzer.analyze(safeText);
        // Score < -4 usually indicates heavy toxicity or aggression
        if (sentimentResult.score < -4) {
            return {
                isFlagged: true,
                reason: `AI Moderation: Highly negative sentiment detected (Score: ${sentimentResult.score}).`
            };
        }

        // 2. ML Spam Classification
        // If the text is extremely short (under 3 words), the classifier often false-flags it as spam
        if (safeText.split(' ').length > 2) {
            const classification = classifier.classify(safeText);
            if (classification === 'spam') {
                return {
                    isFlagged: true,
                    reason: "AI Moderation: Classified as SPAM by ML algorithm."
                };
            }
        }
    } catch (error) {
        console.error("AI Moderation Error:", error);
        // Fail open if the ML model crashes
    }

    // 3. Fallback Hardcoded Filter for severe slurs (which bypass sentiment sometimes)
    const slurs = ["nigger", "faggot", "retard", "cunt", "whore"];
    const lowerText = safeText.toLowerCase();
    if (slurs.some(slur => lowerText.includes(slur))) {
        return {
            isFlagged: true,
            reason: "AI Moderation: Restricted language detected."
        };
    }

    // 4. Repeated character DOS protection
    if (/(.)\1{20,}/.test(lowerText)) {
        return {
            isFlagged: true,
            reason: "AI Moderation: Spam pattern (repeated characters) detected."
        };
    }

    return { isFlagged: false, reason: "" };
};

module.exports = { analyzeContent, classifier };
