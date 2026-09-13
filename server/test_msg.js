const express = require('express');
const mongoose = require('mongoose');

async function test() {
    console.log("Connecting to mock DB...");
    await mongoose.connect("mongodb://localhost:27017/test");
    console.log("Connected.");
    
    const Message = require('./models/Message');
    const msg = new Message({
        sender: new mongoose.Types.ObjectId(),
        receiver: new mongoose.Types.ObjectId(),
        content: "test message",
    });
    
    console.log("Saving message...");
    try {
        await msg.save();
        console.log("Saved successfully!");
    } catch (err) {
        console.error("Error saving:", err.message);
    }
    
    console.log("Finding message...");
    try {
        const found = await Message.findById(msg._id);
        console.log("Found successfully!");
    } catch (err) {
        console.error("Error finding:", err.message);
    }
    
    process.exit(0);
}

test();
