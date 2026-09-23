const mongoose = require("mongoose");

const equipmentListingSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    condition: { 
        type: String, 
        enum: ["New", "Like New", "Good", "Fair", "Used"], 
        required: true 
    },
    category: {
        type: String,
        enum: ["Racket", "Shoes", "Bag", "Shuttlecocks", "Other"],
        required: true
    },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    images: [{ type: String }], // Array of Cloudinary image URLs
    status: { type: String, enum: ["available", "sold"], default: "available" },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EquipmentListing", equipmentListingSchema);
