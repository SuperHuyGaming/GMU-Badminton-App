const webpush = require("web-push");
const User = require("../models/User");

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        "mailto:support@masonbadminton.com",
        publicVapidKey,
        privateVapidKey
    );
}

/**
 * Sends a push notification to all users who have active push subscriptions
 * @param {string} title 
 * @param {string} body 
 * @param {string} url 
 */
async function sendPushToAllUsers(title, body, url = "/") {
    try {
        if (!publicVapidKey || !privateVapidKey) {
            console.warn("[Push] VAPID keys not configured. Skipping push notification.");
            return;
        }

        const payload = JSON.stringify({ title, body, url });
        const users = await User.find({ "pushSubscriptions.0": { $exists: true } });

        let sendCount = 0;
        for (const user of users) {
            const validSubscriptions = [];
            for (const sub of user.pushSubscriptions) {
                try {
                    await webpush.sendNotification(sub, payload);
                    validSubscriptions.push(sub);
                    sendCount++;
                } catch (err) {
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        // Subscription has expired or is no longer valid
                        console.log(`[Push] Removing expired subscription for user ${user._id}`);
                    } else {
                        console.error("[Push] Failed to send to a subscription:", err.message);
                        validSubscriptions.push(sub); // Keep it if it wasn't a 404/410
                    }
                }
            }
            
            // Clean up invalid subscriptions
            if (validSubscriptions.length !== user.pushSubscriptions.length) {
                user.pushSubscriptions = validSubscriptions;
                await user.save();
            }
        }
        console.log(`[Push] Successfully sent ${sendCount} notifications to all users.`);
    } catch (err) {
        console.error("[Push] Global push failed:", err);
    }
}

module.exports = {
    sendPushToAllUsers
};
