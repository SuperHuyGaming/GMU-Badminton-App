const { analyzeContent } = require('../utils/aiModeration');

jest.mock('natural', () => {
    return {
        BayesClassifier: jest.fn().mockImplementation(() => {
            return {
                addDocument: jest.fn(),
                train: jest.fn(),
                classify: jest.fn((text) => {
                    if (text.includes('free money')) return 'spam';
                    return 'ham';
                })
            };
        })
    };
});

describe('AI Moderation Engine', () => {
    
    test('should allow normal sentences', async () => {
        const result = await analyzeContent("Hey anyone want to play badminton?");
        expect(result.isFlagged).toBe(false);
    });

    test('should flag obvious spam', async () => {
        const result = await analyzeContent("click here for free money cashapp");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('SPAM');
    });

    test('should flag extreme toxicity based on sentiment', async () => {
        const result = await analyzeContent("you are a terrible horrible garbage player and i hate you");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Highly negative sentiment');
    });

    test('should flag restricted slurs', async () => {
        const result = await analyzeContent("what a retard");
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Restricted language');
    });

    test('should prevent character repeating DOS attacks', async () => {
        const result = await analyzeContent("a".repeat(50));
        expect(result.isFlagged).toBe(true);
        expect(result.reason).toContain('Spam pattern');
    });

    test('should handle empty or null values gracefully', async () => {
        expect((await analyzeContent(null)).isFlagged).toBe(false);
        expect((await analyzeContent(undefined)).isFlagged).toBe(false);
        expect((await analyzeContent("")).isFlagged).toBe(false);
    });

});
