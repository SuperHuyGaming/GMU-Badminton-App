const express = require("express");
const router = express.Router();
const EquipmentListing = require("../models/EquipmentListing");
const { authMiddleware } = require("../middleware/auth");

// GET all available listings (optionally filter by category)
router.get("/", async (req, res, next) => {
    try {
        const query = { status: "available" };
        if (req.query.category && req.query.category !== "All") {
            query.category = req.query.category;
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
        const listing = await EquipmentListing.findById(req.params.id)
            .populate("sellerId", "name profilePic bio homeUniversity");
        if (!listing) return res.status(404).json({ message: "Listing not found" });
        res.json(listing);
    } catch (error) {
        next(error);
    }
});

// POST create a new listing
router.post("/", authMiddleware, async (req, res, next) => {
    try {
        const { title, description, price, condition, category, images } = req.body;
        
        const listing = new EquipmentListing({
            title,
            description,
            price,
            condition,
            category,
            images: images || [],
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
        const listing = await EquipmentListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        // Ensure user is the seller (or an admin)
        if (listing.sellerId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized to update this listing" });
        }

        const { title, description, price, condition, category, status } = req.body;
        
        if (title) listing.title = title;
        if (description) listing.description = description;
        if (price !== undefined) listing.price = price;
        if (condition) listing.condition = condition;
        if (category) listing.category = category;
        if (status) listing.status = status;

        await listing.save();
        res.json(listing);
    } catch (error) {
        next(error);
    }
});

// DELETE a listing
router.delete("/:id", authMiddleware, async (req, res, next) => {
    try {
        const listing = await EquipmentListing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        if (listing.sellerId.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized to delete this listing" });
        }

        await listing.deleteOne();
        res.json({ message: "Listing deleted" });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
