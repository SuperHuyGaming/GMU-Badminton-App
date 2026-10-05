/**
 * Kafka Consumer Stub: Tournament Scraping Event Consumer
 * ========================================================
 * Architecture & Data Flow:
 * 1. An external scraping worker (e.g., Python / Playwright / Cheerio / LLM extractor) crawls
 *    regional tournament feeds (Instagram posts, Linktrees, Club websites).
 * 2. Scraped artifacts and AI-extracted fields are serialized as JSON and published
 *    to the Kafka topic: `tournament-scraping`.
 * 3. This consumer service (`gmu-tournament-scraping-group`) receives messages, parses
 *    and validates the payload, and instantiates a `ProposedTournament` document in MongoDB
 *    under `status: 'pending'`.
 * 4. Club administrators triage proposals via the `/api/admin/tournaments` UI queue.
 *
 * Expected Message Schema:
 * {
 *   "sourceUrl": "https://instagram.com/p/example",
 *   "confidenceScore": 85,
 *   "rawCaption": "GMU Fall Open 2026...",
 *   "scrapedImageUrls": ["https://cdn.example.com/flyer.jpg"],
 *   "sourceLinks": ["https://linktr.ee/example"],
 *   "tournamentName": "GMU Open 2026",
 *   "date": "2026-11-15T09:00:00Z",
 *   "location": "RAC Fairfax",
 *   "entryFee": "$25",
 *   "registrationLink": "https://tournamentsoftware.com/...",
 *   "skillLevels": ["A", "B", "C"],
 *   "registrationDeadline": "2026-11-10T23:59:59Z"
 * }
 */

const { Kafka } = require("kafkajs");
const ProposedTournament = require("../models/ProposedTournament");
const Tournament = require('../models/Tournament');
const redis = require('./redis');
const { sendPushToAllUsers } = require('./pushNotifications');
const promClient = require('prom-client');
const xss = require('xss');

const scraperFailures = new promClient.Counter({
  name: 'scraper_failures_total',
  help: 'Total number of scraper failures'
});
const llmMalformedJson = new promClient.Counter({
  name: 'llm_malformed_json_total',
  help: 'Total number of malformed JSON responses from LLM'
});

const brokers = process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(",").map((b) => b.trim())
    : ["localhost:9092"];

const CLIENT_ID = process.env.KAFKA_CLIENT_ID || "gmu-badminton-tournament-consumer";
const GROUP_ID = process.env.KAFKA_GROUP_ID || "gmu-tournament-scraping-group";
const TOPIC = process.env.KAFKA_SCRAPING_TOPIC || "tournament-scraping";

const kafka = new Kafka({
    clientId: CLIENT_ID,
    brokers
});

const consumer = kafka.consumer({
    groupId: GROUP_ID
});

/**
 * Normalizes and extracts fields from raw message payloads.
 * Supports both flattened and nested (aiStructuredData / rawScrapedData) structures.
 *
 * @param {Object|string} rawPayload - Raw message value from Kafka or caller
 * @returns {Object} Validated document fields for ProposedTournament
 */
const parseScrapedTournamentMessage = (rawPayload) => {
    let data = rawPayload;
    if (typeof data === "string") {
        data = JSON.parse(data);
    }

    if (!data || typeof data !== "object") {
        throw new Error("Invalid message payload: expected JSON object");
    }

    // Support nested or top-level properties
    const aiData = data.aiStructuredData || {};
    const rawData = data.rawScrapedData || {};

    const tournamentName = (data.tournamentName || aiData.tournamentName || "").trim();
    if (!tournamentName) {
        llmMalformedJson.inc();
        throw new Error("Missing required field: tournamentName");
    }

    const sourceUrl = (data.sourceUrl || data.sourceLink || "").trim();
    if (!sourceUrl) {
        throw new Error("Missing required field: sourceUrl");
    }

    const rawCaption = data.rawCaption || rawData.rawCaption || "";
    const scrapedImageUrls = Array.isArray(data.scrapedImageUrls)
        ? data.scrapedImageUrls
        : (Array.isArray(rawData.scrapedImageUrls) ? rawData.scrapedImageUrls : []);
    const sourceLinks = Array.isArray(data.sourceLinks)
        ? data.sourceLinks
        : (Array.isArray(rawData.sourceLinks) ? rawData.sourceLinks : [sourceUrl]);

    const dateStr = data.date || aiData.date;
    const parsedDate = dateStr ? new Date(dateStr) : undefined;
    const date = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    const deadlineStr = data.registrationDeadline || aiData.registrationDeadline;
    const parsedDeadline = deadlineStr ? new Date(deadlineStr) : undefined;
    const registrationDeadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline : undefined;

    const location = (data.location || aiData.location || "TBD").trim();
    const entryFee = (data.entryFee || aiData.entryFee || "").trim();
    const registrationLink = (data.registrationLink || aiData.registrationLink || "").trim();
    const skillLevels = Array.isArray(data.skillLevels)
        ? data.skillLevels
        : (Array.isArray(aiData.skillLevels) ? aiData.skillLevels : []);

    let confidenceScore = Number(data.confidenceScore !== undefined ? data.confidenceScore : aiData.confidenceScore);
    if (isNaN(confidenceScore) || confidenceScore < 0) {
        confidenceScore = 0;
    } else if (confidenceScore > 100) {
        confidenceScore = 100;
    }

    let eventStatus = data.status || aiData.status || "active";
    const validStatuses = ["active", "sold_out", "canceled", "archived"];
    if (!validStatuses.includes(eventStatus)) {
        eventStatus = "active";
    }

    return {
        rawCaption: xss(rawCaption),
        scrapedImageUrls: scrapedImageUrls.map(u => xss(u)),
        sourceLinks: sourceLinks.map(l => xss(l)),
        tournamentName: xss(tournamentName),
        date,
        location: xss(location),
        entryFee: xss(entryFee),
        registrationLink: xss(registrationLink),
        skillLevels: skillLevels.map(s => xss(s)),
        registrationDeadline,
        sourceUrl: xss(sourceUrl),
        confidenceScore,
        status: "pending", // Status of the proposal
        eventStatus: xss(eventStatus) // Status of the actual tournament (active, sold_out, canceled)
    };
};

/**
 * Message handler executed for each incoming Kafka record.
 *
 * @param {Object} context - Kafka eachMessage context { topic, partition, message }
 * @returns {Promise<Object|null>} The saved ProposedTournament document or null on failure
 */
const handleMessage = async ({ topic, partition, message }) => {
    try {
        const rawValue = message && message.value ? message.value.toString() : "{}";
        const parsedDoc = parseScrapedTournamentMessage(rawValue);

        let savedDoc;
        const now = new Date();
        const hasMandatoryFields = parsedDoc.tournamentName && parsedDoc.date && parsedDoc.location && parsedDoc.registrationLink;
        const isFutureDate = parsedDoc.date && new Date(parsedDoc.date) > now;
        
        // Phase 4: Fraud & Anomaly Defense
        let isAnomaly = false;
        
        // Entry Fee Anomaly
        const feeStr = parsedDoc.entryFee || "";
        const feeMatch = feeStr.match(/\$(\d+)/);
        if (feeMatch && parseInt(feeMatch[1], 10) > 300) {
            console.log(`[Kafka Consumer][${topic} p:${partition}]: Anomaly detected - Exorbitant Entry Fee: ${feeStr}`);
            isAnomaly = true;
        }

        // Location Bounding Box (mock check for DMV keywords)
        const locLower = (parsedDoc.location || "").toLowerCase();
        const isDMV = locLower.includes('va') || locLower.includes('virginia') || locLower.includes('md') || locLower.includes('maryland') || locLower.includes('dc') || locLower.includes('district') || locLower.includes('fairfax') || locLower.includes('rac') || locLower.includes('umd') || locLower.includes('capital');
        if (!isDMV && locLower !== 'tbd') {
            console.log(`[Kafka Consumer][${topic} p:${partition}]: Anomaly detected - Location outside DMV: ${parsedDoc.location}`);
            isAnomaly = true;
        }

        if (parsedDoc.confidenceScore >= 95 && hasMandatoryFields && isFutureDate && !isAnomaly) {
            console.log(`[Kafka Consumer][${topic} p:${partition}]: High confidence (${parsedDoc.confidenceScore}%). Checking for existing tournament "${parsedDoc.tournamentName}"`);
            
            // Phase 5: Delta Detection & Auto-Updating
            const existingTournament = await Tournament.findOne({
                $or: [
                    { tournamentName: parsedDoc.tournamentName },
                    { sourceUrl: parsedDoc.sourceUrl }
                ]
            });

            if (existingTournament) {
                console.log(`[Kafka Consumer] Found existing tournament. Applying deltas...`);
                
                if (existingTournament.sourceUrl !== parsedDoc.sourceUrl) {
                    console.warn(`[Kafka Consumer] SECURITY WARNING: sourceUrl mismatch for tournament "${parsedDoc.tournamentName}". Preventing unauthorized auto-update.`);
                    console.log(`[Kafka Consumer][${topic} p:${partition}]: Ingesting as proposal for Admin review instead`);
                    const proposal = new ProposedTournament(parsedDoc);
                    return await proposal.save();
                }

                let hasChanges = false;
                
                if (parsedDoc.registrationDeadline && 
                    (!existingTournament.registrationDeadline || 
                     parsedDoc.registrationDeadline.getTime() !== existingTournament.registrationDeadline.getTime())) {
                    console.log(`[Kafka Consumer] Auto-Updating Deadline: ${existingTournament.registrationDeadline} -> ${parsedDoc.registrationDeadline}`);
                    existingTournament.registrationDeadline = parsedDoc.registrationDeadline;
                    hasChanges = true;
                    await sendPushToAllUsers(
                        "🚨 Tournament Update!",
                        `The registration deadline for ${existingTournament.tournamentName} has been updated to ${new Date(parsedDoc.registrationDeadline).toLocaleDateString()}.`,
                        "/tournaments"
                    ).catch(e => console.error(e));
                }

                if (parsedDoc.eventStatus && existingTournament.status !== parsedDoc.eventStatus) {
                    console.log(`[Kafka Consumer] Auto-Updating Status: ${existingTournament.status} -> ${parsedDoc.eventStatus}`);
                    existingTournament.status = parsedDoc.eventStatus;
                    
                    // Sold out / Canceled detection
                    if (parsedDoc.eventStatus === "sold_out") {
                        existingTournament.isOpenTournament = false;
                        await sendPushToAllUsers(
                            "🔥 Tournament Sold Out",
                            `Registration for ${existingTournament.tournamentName} is now fully booked!`,
                            "/tournaments"
                        ).catch(e => console.error(e));
                    } else if (parsedDoc.eventStatus === "canceled") {
                        existingTournament.isOpenTournament = false;
                        await sendPushToAllUsers(
                            "❌ Tournament Canceled",
                            `Unfortunately, ${existingTournament.tournamentName} has been canceled.`,
                            "/tournaments"
                        ).catch(e => console.error(e));
                    }
                    hasChanges = true;
                }

                if (hasChanges) {
                    existingTournament.scraperLastRun = now;
                    savedDoc = await existingTournament.save();
                    
                    // Invalidate cache
                    const keys = await redis.keys('tournaments:*');
                    if (keys.length > 0) await redis.del(keys);
                } else {
                    console.log(`[Kafka Consumer] No changes detected. Skipping update.`);
                    savedDoc = existingTournament;
                }

            } else {
                console.log(`[Kafka Consumer] Creating new Auto-published tournament.`);
                const tournament = new Tournament({
                    tournamentName: parsedDoc.tournamentName,
                    eventLocation: parsedDoc.location,
                    hostUniversity: "Local Club",
                    startDate: parsedDoc.date,
                    endDate: parsedDoc.date,
                    registrationDeadline: parsedDoc.registrationDeadline,
                    registrationUrl: parsedDoc.registrationLink,
                    sourceUrl: parsedDoc.sourceUrl,
                    flyerImageUrl: parsedDoc.scrapedImageUrls && parsedDoc.scrapedImageUrls.length > 0 ? parsedDoc.scrapedImageUrls[0] : "",
                    skillLevels: parsedDoc.skillLevels,
                    originalCaption: parsedDoc.rawCaption,
                    isOpenTournament: (parsedDoc.eventStatus === "sold_out" || parsedDoc.eventStatus === "canceled") ? false : true,
                    status: parsedDoc.eventStatus,
                    rsvpCount: 0,
                    scraperLastRun: now
                });
                savedDoc = await tournament.save();
                
                // Invalidate cache
                const keys = await redis.keys('tournaments:*');
                if (keys.length > 0) await redis.del(keys);
            }
        } else {
            console.log(`[Kafka Consumer][${topic} p:${partition}]: Ingesting proposal "${parsedDoc.tournamentName}" for Admin review`);
            const proposal = new ProposedTournament(parsedDoc);
            savedDoc = await proposal.save();
        }
        return savedDoc;
    } catch (error) {
        scraperFailures.inc();
        console.error(`[Kafka Consumer] Error processing message on topic ${topic}:`, error.message);
        return null;
    }
};

/**
 * Connects consumer, subscribes to tournament-scraping topic, and initiates processing loop.
 */
const runConsumer = async () => {
    try {
        await consumer.connect();
        console.log(`[Kafka Consumer] Connected to broker(s): ${brokers.join(", ")}`);

        await consumer.subscribe({
            topic: TOPIC,
            fromBeginning: false
        });
        console.log(`[Kafka Consumer] Subscribed to topic: ${TOPIC}`);

        await consumer.run({
            eachMessage: handleMessage
        });
    } catch (error) {
        console.error("[Kafka Consumer] Error running consumer:", error);
    }
};

/**
 * Gracefully disconnects consumer from broker.
 */
const disconnectConsumer = async () => {
    try {
        await consumer.disconnect();
        console.log("[Kafka Consumer] Successfully disconnected");
    } catch (error) {
        console.error("[Kafka Consumer] Error disconnecting consumer:", error);
    }
};

// Standalone execution entrypoint
if (require.main === module) {
    const mongoose = require("mongoose");
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/gmu_badminton";

    mongoose.connect(mongoUri)
        .then(() => {
            console.log("[Kafka Consumer] MongoDB connected for standalone consumer worker");
            return runConsumer();
        })
        .catch((err) => {
            console.error("[Kafka Consumer] Initialization error:", err);
            process.exit(1);
        });

    const handleShutdown = async (signal) => {
        console.log(`[Kafka Consumer] Received ${signal}, shutting down...`);
        await disconnectConsumer();
        await mongoose.connection.close();
        process.exit(0);
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
}

module.exports = {
    kafka,
    consumer,
    TOPIC,
    GROUP_ID,
    parseScrapedTournamentMessage,
    handleMessage,
    runConsumer,
    disconnectConsumer
};
