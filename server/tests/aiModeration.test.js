const { analyzeContent } = require('../utils/aiModeration');

describe('AI Moderation Engine', () => {
    
    test('should allow normal sentences', () => {
        const result = analyzeContent("Hey anyone want to play badminton?");
        expect(result.isFlagged).toBe(false);
    });

    test('should flag obvious spam', () => {
        const result = analyzeContent("click here for free money cashapp");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('SPAM');
    });

    test('should flag extreme toxicity based on sentiment', () => {
        const result = analyzeContent("you are a terrible horrible garbage player and i hate you");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Highly negative sentiment');
    });

    test('should flag restricted slurs', () => {
        const result = analyzeContent("what a retard");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Restricted language');
    });

    test('should prevent character repeating DOS attacks', () => {
        const result = analyzeContent("a".repeat(50));
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Spam pattern');
    });

    test('should handle empty or null values gracefully', () => {
        expect(analyzeContent(null).isFlagged).toBe(false);
        expect(analyzeContent(undefined).isFlagged).toBe(false);
        expect(analyzeContent("").isFlagged).toBe(false);
    });

});
