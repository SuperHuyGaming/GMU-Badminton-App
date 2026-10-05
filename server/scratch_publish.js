require('dotenv').config();
const mongoose = require('mongoose');
const { handleMessage } = require('./utils/kafkaConsumer');

async function trigger() {
    await mongoose.connect('mongodb://127.0.0.1:27017/gmu_social_db?replicaSet=rs0');
    
    // High-confidence payload for Zero-Touch Auto-Publish
    const payload1 = {
        value: JSON.stringify({
            "sourceUrl": "https://instagram.com/p/AutoPub1",
            "confidenceScore": 98,
            "rawCaption": "GMU Fall Open 2026. Register now!",
            "scrapedImageUrls": ["https://example.com/flyer1.png"],
            "sourceLinks": [],
            "tournamentName": "GMU Fall Open 2026",
            "date": "2026-11-15T00:00:00Z",
            "location": "George Mason University RAC",
            "entryFee": "",
            "registrationLink": "https://forms.gle/xyz",
            "skillLevels": ["A", "B", "C"],
            "registrationDeadline": "2026-11-01T00:00:00Z",
            "status": "active"
        })
    };

    // Low-confidence payload for Admin Approval Queue
    const payload2 = {
        value: JSON.stringify({
            "sourceUrl": "https://instagram.com/p/AdminReview2",
            "confidenceScore": 60,
            "rawCaption": "Not sure if tournament or practice.",
            "scrapedImageUrls": ["https://example.com/flyer2.png"],
            "sourceLinks": [],
            "tournamentName": "UMD Spring Invitational",
            "date": "2027-04-10T00:00:00Z",
            "location": "UMD Eppley",
            "entryFee": "",
            "registrationLink": "https://linktr.ee/umd",
            "skillLevels": ["B", "C", "D"],
            "registrationDeadline": "2027-04-01T00:00:00Z",
            "status": "active"
        })
    };

    console.log("Mocking Kafka messages...");
    await handleMessage({ topic: "tournament-scraping", partition: 0, message: payload1 });
    await handleMessage({ topic: "tournament-scraping", partition: 0, message: payload2 });
    
    console.log("Done.");
    process.exit(0);
}

trigger();
