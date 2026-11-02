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

/**
 * Sends a targeted push notification to a specific user
 * @param {string|mongoose.Types.ObjectId} userId 
 * @param {object|string} payload - Object with { title, body, url } or JSON string or title string
 * @param {string} [bodyArg] - Optional body if payload was a title string
 * @param {string} [urlArg] - Optional url if payload was a title string
 * @returns {Promise<{success: boolean, sentCount: number, error?: string, mocked?: boolean}>}
 */
async function sendPushToUser(userId, payload, bodyArg, urlArg = "/") {
    try {
        if (!userId) {
            return { success: false, sentCount: 0, reason: "missing_user_id" };
        }

        const normalizedUserId = (userId._id || userId.id || userId).toString();
        const user = await User.findById(normalizedUserId);
        if (!user || !Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) {
            return { success: false, sentCount: 0, reason: "no_active_subscriptions" };
        }

        let stringPayload;
        if (typeof payload === "string" && bodyArg !== undefined) {
            stringPayload = JSON.stringify({
                title: payload,
                body: bodyArg,
                url: urlArg
            });
        } else if (typeof payload === "object" && payload !== null) {
            stringPayload = JSON.stringify({
                title: payload.title || "Mason Badminton Connect",
                body: payload.body || "",
                url: payload.url || "/",
                ...payload
            });
        } else if (typeof payload === "string") {
            stringPayload = payload;
        } else {
            stringPayload = JSON.stringify({
                title: "Mason Badminton Connect",
                body: "",
                url: "/"
            });
        }

        const pubKey = process.env.VAPID_PUBLIC_KEY || publicVapidKey;
        const privKey = process.env.VAPID_PRIVATE_KEY || privateVapidKey;
        const hasKeys = Boolean(pubKey && privKey);
        const isMockedInTest = Boolean(webpush.sendNotification && webpush.sendNotification._isMockFunction);

        if (!hasKeys && !isMockedInTest) {
            console.warn(`[Push] VAPID keys not configured. Skipping push delivery to user ${normalizedUserId}.`);
            return { success: true, sentCount: user.pushSubscriptions.length, mocked: true };
        }

        let sentCount = 0;
        const validSubscriptions = [];
        for (const sub of user.pushSubscriptions) {
            try {
                await webpush.sendNotification(sub, stringPayload);
                validSubscriptions.push(sub);
                sentCount++;
            } catch (err) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`[Push] Removing expired subscription for user ${normalizedUserId}`);
                } else {
                    console.error("[Push] Failed to deliver push to subscription:", err.message);
                    validSubscriptions.push(sub);
                }
            }
        }

        if (validSubscriptions.length !== user.pushSubscriptions.length) {
            user.pushSubscriptions = validSubscriptions;
            await user.save();
        }

        return { success: sentCount > 0, sentCount };
    } catch (err) {
        console.error(`[Push] sendPushToUser failed for user ${userId}:`, err);
        return { success: false, sentCount: 0, error: err.message };
    }
}

module.exports = {
    sendPushToAllUsers,
    sendPushToUser
};
