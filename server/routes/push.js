const express = require("express");
const router = express.Router();
const webpush = require("web-push");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

// Setup web-push keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

// Only configure web-push if keys are available
if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        "mailto:test@test.com",
        publicVapidKey,
        privateVapidKey
    );
}

// POST: Subscribe to push notifications
router.post("/subscribe", authMiddleware, async (req, res, next) => {
    try {
        const subscription = req.body;
        
        // Security: Basic NoSQL injection prevention / validation
        if (
            !subscription || 
            typeof subscription.endpoint !== 'string' || 
            !subscription.endpoint.startsWith('https://') ||
            !subscription.keys ||
            typeof subscription.keys.auth !== 'string' ||
            typeof subscription.keys.p256dh !== 'string'
        ) {
            return res.status(400).json({ message: "Invalid subscription object" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Add subscription if it doesn't already exist
        const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
        if (!exists) {
            user.pushSubscriptions.push(subscription);
            await user.save();
        }

        res.status(201).json({ message: "Subscribed successfully." });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
