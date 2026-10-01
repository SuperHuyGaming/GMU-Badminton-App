const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const EquipmentListing = require("../models/EquipmentListing");
const { authMiddleware } = require("../middleware/auth");
const xss = require("xss");
const rateLimit = require("express-rate-limit");

const ALLOWED_CONDITIONS = ["New", "Like New", "Good", "Fair", "Used"];
const ALLOWED_CATEGORIES = ["Racket", "Shoes", "Bag", "Shuttlecocks", "Other"];

// GET all available listings (optionally filter by category)
router.get("/", async (req, res, next) => {
    try {
        const query = { status: "available" };
        if (req.query.category && req.query.category !== "All") {
            if (ALLOWED_CATEGORIES.includes(req.query.category)) {
                query.category = req.query.category;
            }
        }

        const listings = await EquipmentListing.find(query)
            .sort({ date: -1 })
            .populate("sellerId", "name profilePic homeUniversity")
            .limit(50);
            
        res.json(listings);
    } catch (error) {
        next(error);
    }
});

// GET single listing
router.get("/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid listing ID format." });
        }

        const listing = await EquipmentListing.findById(req.params.id)
            .populate("sellerId", "name profilePic bio homeUniversity");
        if (!listing) return res.status(404).json({ message: "Listing not found" });
        res.json(listing);
    } catch (error) {
        next(error);
    }
});

const listingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many listings created, please try again later." }
});

// POST create a new listing
router.post("/", authMiddleware, listingLimiter, async (req, res, next) => {
    try {
        const { title, description, price, condition, category, images } = req.body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return res.status(400).json({ message: "Listing title is required." });
        }
        if (title.trim().length > 200) {
            return res.status(400).json({ message: "Listing title cannot exceed 200 characters." });
        }

        if (!description || typeof description !== "string" || !description.trim()) {
            return res.status(400).json({ message: "Listing description is required." });
        }
        if (description.trim().length > 1000) {
            return res.status(400).json({ message: "Listing description cannot exceed 1000 characters." });
        }

        const parsedPrice = Number(price);
        if (price === undefined || isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: "A valid non-negative price is required." });
        }

        if (!condition || !ALLOWED_CONDITIONS.includes(condition)) {
            return res.status(400).json({
                message: `Invalid condition. Allowed values: ${ALLOWED_CONDITIONS.join(", ")}.`
            });
        }

        if (!category || !ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({
                message: `Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(", ")}.`
            });
        }

        const cleanTitle = xss(title.trim());
        const cleanDescription = xss(description.trim());
        const validImages = Array.isArray(images)
            ? images.filter(img => typeof img === "string" && img.startsWith("http")).slice(0, 5)
            : [];

        const listing = new EquipmentListing({
            title: cleanTitle,
            description: cleanDescription,
            price: parsedPrice,
            condition,
            category,
            images: validImages,
            sellerId: req.user.id
        });
        
        await listing.save();
        
        // Populate seller info before returning so frontend can display immediately
        await listing.populate("sellerId", "name profilePic");
        
        if (req.io) {
            req.io.emit("newListing", listing); // for dynamic feed later
        }

        res.status(201).json(listing);
    } catch (error) {
        next(error);
    }
});

// PUT update a listing (or mark as sold)
router.put("/:id", authMiddleware, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid listing ID format." });
        }

        const listing = await EquipmentListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        // Ensure user is the seller (or an admin)
        const currentUserId = (req.user.id || req.user.userId).toString();
        if (listing.sellerId.toString() !== currentUserId && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized to update this listing" });
        }

        const { title, description, price, condition, category, status } = req.body;
        
        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({ message: "Listing title cannot be empty." });
            }
            if (title.trim().length > 200) {
                return res.status(400).json({ message: "Listing title cannot exceed 200 characters." });
            }
            listing.title = xss(title.trim());
        }

        if (description !== undefined) {
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({ message: "Listing description cannot be empty." });
            }
            if (description.trim().length > 1000) {
                return res.status(400).json({ message: "Listing description cannot exceed 1000 characters." });
            }
            listing.description = xss(description.trim());
        }

        if (price !== undefined) {
            const parsedPrice = Number(price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ message: "Price must be a non-negative number." });
            }
            listing.price = parsedPrice;
        }

        if (condition !== undefined) {
            if (!ALLOWED_CONDITIONS.includes(condition)) {
                return res.status(400).json({
                    message: `Invalid condition. Allowed values: ${ALLOWED_CONDITIONS.join(", ")}.`
                });
            }
            listing.condition = condition;
        }

        if (category !== undefined) {
            if (!ALLOWED_CATEGORIES.includes(category)) {
                return res.status(400).json({
                    message: `Invalid category. Allowed values: ${ALLOWED_CATEGORIES.join(", ")}.`
                });
            }
            listing.category = category;
        }

        if (status !== undefined) {
            if (status !== "available" && status !== "sold") {
                return res.status(400).json({ message: "Status must be either 'available' or 'sold'." });
            }
            listing.status = status;
        }

        await listing.save();
        res.json(listing);
    } catch (error) {
        next(error);
    }
});

// DELETE a listing
router.delete("/:id", authMiddleware, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid listing ID format." });
        }

        const listing = await EquipmentListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        const currentUserId = (req.user.id || req.user.userId).toString();
        if (listing.sellerId.toString() !== currentUserId && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized to delete this listing" });
        }

        await listing.deleteOne();
        res.json({ message: "Listing deleted" });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
