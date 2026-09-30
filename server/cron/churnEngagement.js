const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Cron job to flag users inactive for > 14 days
 * and send a mock push notification.
 */
async function runChurnEngagement() {
    try {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // Find users who haven't been active in 14 days
        const inactiveUsers = await User.find({
            lastActive: { $lt: fourteenDaysAgo }
        });

        console.log(Found  inactive users.);

        for (const user of inactiveUsers) {
            console.log(Sending mock push notification to user  ()...);
            // Mock push notification logic
            // e.g., webPush.sendNotification(user.pushSubscriptions[0], payload);
        }

        console.log('Churn engagement job completed.');
    } catch (error) {
        console.error('Error in churn engagement job:', error);
    }
}

if (require.main === module) {
    // Run standalone
    require('dotenv').config({ path: '../.env' });
    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/badminton')
        .then(() => {
            console.log('Connected to DB');
            return runChurnEngagement();
        })
        .then(() => {
            mongoose.disconnect();
        });
}

module.exports = { runChurnEngagement };
