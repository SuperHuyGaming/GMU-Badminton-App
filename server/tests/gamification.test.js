const { processMatchResults, BADGES } = require("../services/gamification");
const User = require("../models/User");

// Mock Mongoose User model
jest.mock("../models/User");

describe("Gamification Service", () => {
    let mockUser;
    let mockIo;
    let emitMock;

    beforeEach(() => {
        emitMock = jest.fn();
        mockIo = {
            to: jest.fn().mockReturnValue({ emit: emitMock })
        };

        mockUser = {
            _id: "testUserId123",
            stats: {
                totalMatches: 0,
                winStreak: 0,
                highestWinStreak: 0
            },
            badges: [],
            save: jest.fn().mockResolvedValue(true)
        };

        User.findById.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should increment totalMatches and winStreak for a winner", async () => {
        await processMatchResults(mockIo, ["testUserId123"], true);
        
        expect(mockUser.stats.totalMatches).toBe(1);
        expect(mockUser.stats.winStreak).toBe(1);
        expect(mockUser.stats.highestWinStreak).toBe(1);
        expect(mockUser.save).toHaveBeenCalled();
    });

    it("should reset winStreak but increment totalMatches for a loser", async () => {
        mockUser.stats.winStreak = 3; // They were on a streak
        mockUser.stats.highestWinStreak = 3;
        
        await processMatchResults(mockIo, ["testUserId123"], false);
        
        expect(mockUser.stats.totalMatches).toBe(1);
        expect(mockUser.stats.winStreak).toBe(0); // Reset
        expect(mockUser.stats.highestWinStreak).toBe(3); // Unchanged
    });

    it("should award FIRST_WIN badge on first win", async () => {
        await processMatchResults(mockIo, ["testUserId123"], true);
        
        expect(mockUser.badges).toContain(BADGES.FIRST_WIN.id);
        expect(mockIo.to).toHaveBeenCalledWith("testUserId123");
        expect(emitMock).toHaveBeenCalledWith("badgeUnlocked", BADGES.FIRST_WIN);
    });

    it("should award STREAK_3 badge when win streak hits 3", async () => {
        mockUser.stats.winStreak = 2; // About to win the 3rd
        
        await processMatchResults(mockIo, ["testUserId123"], true);
        
        expect(mockUser.stats.winStreak).toBe(3);
        expect(mockUser.badges).toContain(BADGES.STREAK_3.id);
        expect(emitMock).toHaveBeenCalledWith("badgeUnlocked", BADGES.STREAK_3);
    });

    it("should award MATCHES_10 badge on 10th match, win or lose", async () => {
        mockUser.stats.totalMatches = 9;
        
        await processMatchResults(mockIo, ["testUserId123"], false); // Loses 10th match
        
        expect(mockUser.stats.totalMatches).toBe(10);
        expect(mockUser.badges).toContain(BADGES.MATCHES_10.id);
        expect(emitMock).toHaveBeenCalledWith("badgeUnlocked", BADGES.MATCHES_10);
    });

    it("should not award the same badge twice", async () => {
        mockUser.badges = [BADGES.FIRST_WIN.id]; // Already has first win
        
        await processMatchResults(mockIo, ["testUserId123"], true); // Wins again
        
        // Should not emit since they already have it
        expect(emitMock).not.toHaveBeenCalledWith("badgeUnlocked", BADGES.FIRST_WIN);
        expect(mockUser.badges.length).toBe(1); // Still only 1 badge
    });
});
