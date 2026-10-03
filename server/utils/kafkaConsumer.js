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

    const date = data.date || aiData.date ? new Date(data.date || aiData.date) : undefined;
    const registrationDeadline = data.registrationDeadline || aiData.registrationDeadline
        ? new Date(data.registrationDeadline || aiData.registrationDeadline)
        : undefined;

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
        status: "pending"
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

        console.log(`[Kafka Consumer][${topic} p:${partition}]: Ingesting proposal "${parsedDoc.tournamentName}"`);
        const proposal = new ProposedTournament(parsedDoc);
        const savedDoc = await proposal.save();
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
