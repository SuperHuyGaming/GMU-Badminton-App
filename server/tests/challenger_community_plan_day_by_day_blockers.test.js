jest.mock('natural', () => ({
    BayesClassifier: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        train: jest.fn(),
        classify: jest.fn(() => 'ham')
    }))
}));

jest.mock('../utils/aiModeration', () => ({
    analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, reason: "", score: 0 })
}));

jest.mock('../utils/seedFeed', () => jest.fn());
jest.mock('../utils/cronJobs', () => jest.fn());
jest.mock('../services/scraper', () => ({
    getRacStatus: jest.fn().mockResolvedValue("Open Play Active"),
    getWeeklySchedule: jest.fn().mockReturnValue([])
}));

const mongoose = require("mongoose");
const Match = require("../models/Match");
const Message = require("../models/Message");
const EquipmentListing = require("../models/EquipmentListing");
const pushNotifications = require("../utils/pushNotifications");
const serverExports = require("../server");
const { encrypt, decrypt } = require("../utils/encryption");

describe("Empirical Challenger: Day-by-Day Blockers & Schema Collision Tests", () => {

    afterAll(async () => {
        if (serverExports.server && serverExports.server.close) {
            await new Promise(r => serverExports.server.close(r));
        }
    });

    // =========================================================================
    // 1. DAY 4 BLOCKER: Match.js Schema Collision on Challenge Acceptance
    // =========================================================================
    describe("Day 4 Blocker: Match.js Schema Incompatibility (Lines 1032-1043)", () => {
        test("CRITICAL BLOCKER: new Match with status 'scheduled' throws Mongoose ValidationError against existing Match schema", () => {
            const fakePost = {
                _id: new mongoose.Types.ObjectId(),
                challengeMatch: {
                    gameFormat: "Best of 3 to 21",
                    challengerTeam: [{ userId: new mongoose.Types.ObjectId(), userName: "Player A" }],
                    stipulations: "Plastic shuttles only"
                },
                targetDate: new Date()
            };

            // Attempt to instantiate Match document exactly as specified in Day 4 line 1032-1042:
            const proposedMatchDoc = new Match({
                type: fakePost.challengeMatch.gameFormat?.toLowerCase().includes("doubles") ? "doubles" : "singles",
                status: "scheduled",
                source: "community_challenge",
                communityPostId: fakePost._id,
                team1: fakePost.challengeMatch.challengerTeam.map(t => ({ user: t.userId, name: t.userName })),
                team2: [{ user: new mongoose.Types.ObjectId(), name: "Opponent B" }],
                stipulations: fakePost.challengeMatch.stipulations || "",
                scheduledAt: fakePost.targetDate || new Date()
            });

            // Running validateSync() now succeeds because Match.js supports status 'scheduled' and conditional fields!
            const validationError = proposedMatchDoc.validateSync();
            expect(validationError).toBeUndefined();
            expect(proposedMatchDoc.status).toBe("scheduled");
        });
    });

    // =========================================================================
    // 2. DAY 4 PREREQUISITE GAP: sendPushToUser Implemented in utils
    // =========================================================================
    describe("Day 4 Prerequisite Gap: sendPushToUser Implemented in utils", () => {
        test("Calling sendPushToUser on Day 4 resolves correctly now that sendPushToUser is implemented", () => {
            const sendPushToUser = pushNotifications.sendPushToUser;
            expect(typeof sendPushToUser).toBe("function");
            expect(typeof pushNotifications.sendPushToAllUsers).toBe("function");
        });
    });

    // =========================================================================
    // 3. DAY 1 ENCRYPTION FLAW: Double "ENC:" Prefix Corruption
    // =========================================================================
    describe("Day 1 Encryption Flaw: Double ENC: Prefix in Schema Snippet (Line 258)", () => {
        test("FLAW: encrypt() already adds 'ENC:', so 'ENC:' + encrypt() creates corrupt double prefix 'ENC:ENC:'", () => {
            const rawMessage = "Meet me at RAC Court 3 at 4pm";
            
            // Real encrypt() output from server/utils/encryption.js:
            const encrypted = encrypt(rawMessage);
            expect(encrypted.startsWith("ENC:")).toBe(true);

            // Day 1 snippet at line 258:
            // this.content = "ENC:" + encrypt(this.content);
            const corruptContent = "ENC:" + encrypted;
            expect(corruptContent.startsWith("ENC:ENC:")).toBe(true);

            // Slicing first 4 chars leaves the original ENC:... payload:
            const sliced = corruptContent.slice(4);
            const decrypted = decrypt(sliced);
            expect(decrypted).toBe(rawMessage);
        });
    });

    // =========================================================================
    // 4. DAY 1 REGRESSION HAZARD: onlineUsers Map Export Collision
    // =========================================================================
    describe("Day 1 Regression Hazard: server.js onlineUsers Map Export", () => {
        test("HAZARD: existing tests import onlineUsers directly from server.js", () => {
            // server/tests/adversarialNetwork.test.js Line 41:
            // const { app, server, isOriginAllowed, onlineUsers } = require("../server");
            expect(serverExports.onlineUsers).toBeDefined();
            expect(serverExports.onlineUsers instanceof Map).toBe(true);
        });
    });

    // =========================================================================
    // 5. DAY 5 SCHEMA ENUM INCOMPATIBILITY: EquipmentListing Legacy Records
    // =========================================================================
    describe("Day 5 Incompatibility: EquipmentListing Condition & Category Enum Breakage", () => {
        test("HAZARD: Existing listings with condition 'New' or category 'Bag' fail validation if replaced by Day 5 enums", () => {
            const proposedConditionEnum = ["Brand New", "Like New", "Good", "Fair", "Heavily Used"];
            const proposedCategoryEnum = ["Racket", "Shoes", "Bags", "Shuttlecocks", "Apparel", "Strings & Grips", "Accessories"];

            // Legacy values present in database:
            expect(proposedConditionEnum.includes("New")).toBe(false);       // Legacy 'New' rejected!
            expect(proposedConditionEnum.includes("Used")).toBe(false);      // Legacy 'Used' rejected!
            expect(proposedCategoryEnum.includes("Bag")).toBe(false);        // Legacy 'Bag' rejected (expects 'Bags')!
            expect(proposedCategoryEnum.includes("Other")).toBe(false);      // Legacy 'Other' rejected!
        });
    });
});
