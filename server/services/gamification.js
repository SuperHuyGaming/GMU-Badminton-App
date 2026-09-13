const User = require("../models/User");

const BADGES = {
    FIRST_WIN: { id: "first_win", name: "First Blood", description: "Won your first match!" },
    STREAK_3: { id: "streak_3", name: "On Fire", description: "Won 3 matches in a row." },
    STREAK_5: { id: "streak_5", name: "Unstoppable", description: "Won 5 matches in a row!" },
    MATCHES_10: { id: "matches_10", name: "Regular", description: "Played 10 matches total." },
    MATCHES_50: { id: "matches_50", name: "Veteran", description: "Played 50 matches total." },
};

/**
 * Update user stats and check for newly unlocked badges.
 * @param {Object} io - Socket.io instance to emit unlocking events
 * @param {Array<string>} userIds - Users to update
 * @param {boolean} isWinner - Whether this team won
 */
async function processMatchResults(io, userIds, isWinner) {
    for (const userId of userIds) {
        const user = await User.findById(userId);
        if (!user) continue;

        let newBadges = [];

        // Update stats
        user.stats.totalMatches += 1;
        
        if (isWinner) {
            user.stats.winStreak += 1;
            if (user.stats.winStreak > user.stats.highestWinStreak) {
                user.stats.highestWinStreak = user.stats.winStreak;
            }
        } else {
            user.stats.winStreak = 0; // Reset streak on loss
        }

        // Check for Badges
        const checkBadge = (badgeObj, condition) => {
            if (condition && !user.badges.includes(badgeObj.id)) {
                user.badges.push(badgeObj.id);
                newBadges.push(badgeObj);
            }
        };

        checkBadge(BADGES.FIRST_WIN, isWinner);
        checkBadge(BADGES.STREAK_3, user.stats.winStreak >= 3);
        checkBadge(BADGES.STREAK_5, user.stats.winStreak >= 5);
        checkBadge(BADGES.MATCHES_10, user.stats.totalMatches >= 10);
        checkBadge(BADGES.MATCHES_50, user.stats.totalMatches >= 50);

        await user.save();

        // Emit socket events for real-time popups on the frontend
        for (const badge of newBadges) {
            if (io) {
                io.to(user._id.toString()).emit("badgeUnlocked", badge);
            }
        }
    }
}

module.exports = { processMatchResults, BADGES };
