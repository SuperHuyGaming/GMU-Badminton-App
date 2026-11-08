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

// GET: Retrieve public VAPID key
router.get("/vapid-public-key", (req, res) => {
    res.json({
        publicKey: process.env.VAPID_PUBLIC_KEY || publicVapidKey || null
    });
});

// GET: Check push subscription status for current user
router.get("/status", authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const subs = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions : [];
        res.json({
            isSubscribed: subs.length > 0,
            subscriptionCount: subs.length
        });
    } catch (error) {
        next(error);
    }
});

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

        if (!Array.isArray(user.pushSubscriptions)) {
            user.pushSubscriptions = [];
        }

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

// POST: Unsubscribe from push notifications
router.post("/unsubscribe", authMiddleware, async (req, res, next) => {
    try {
        const { endpoint } = req.body || {};
        if (!endpoint || typeof endpoint !== 'string') {
            return res.status(400).json({ message: "Invalid endpoint" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (Array.isArray(user.pushSubscriptions)) {
            user.pushSubscriptions = user.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);
            await user.save();
        }

        res.json({ message: "Unsubscribed successfully." });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
