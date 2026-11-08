require('dotenv').config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

jest.mock("../models/User");
const User = require("../models/User");
const pushRoutes = require("../routes/push");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const testUserId = "660000000000000000000001";
const validToken = jwt.sign(
    { id: testUserId, userId: testUserId, role: "user", name: "Push Tester" },
    JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/push", pushRoutes);

describe("Push Notification Routes (/api/push)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /api/push/vapid-public-key", () => {
        it("returns the public VAPID key without authentication", async () => {
            const res = await request(app).get("/api/push/vapid-public-key");
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("publicKey");
        });
    });

    describe("GET /api/push/status", () => {
        it("rejects unauthenticated requests", async () => {
            const res = await request(app).get("/api/push/status");
            expect(res.status).toBe(401);
        });

        it("returns isSubscribed false when user has no subscriptions", async () => {
            User.findById.mockResolvedValue({
                _id: testUserId,
                pushSubscriptions: []
            });

            const res = await request(app)
                .get("/api/push/status")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.isSubscribed).toBe(false);
            expect(res.body.subscriptionCount).toBe(0);
        });

        it("returns isSubscribed true when user has active subscriptions", async () => {
            User.findById.mockResolvedValue({
                _id: testUserId,
                pushSubscriptions: [
                    { endpoint: "https://fcm.googleapis.com/fcm/send/sub1", keys: { auth: "a1", p256dh: "k1" } }
                ]
            });

            const res = await request(app)
                .get("/api/push/status")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.status).toBe(200);
            expect(res.body.isSubscribed).toBe(true);
            expect(res.body.subscriptionCount).toBe(1);
        });

        it("returns 404 if user not found", async () => {
            User.findById.mockResolvedValue(null);

            const res = await request(app)
                .get("/api/push/status")
                .set("Authorization", `Bearer ${validToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe("POST /api/push/subscribe", () => {
        it("rejects unauthenticated requests", async () => {
            const res = await request(app)
                .post("/api/push/subscribe")
                .send({ endpoint: "https://fcm.googleapis.com/test" });
            expect(res.status).toBe(401);
        });

        it("rejects malformed subscription payloads", async () => {
            const res = await request(app)
                .post("/api/push/subscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ endpoint: "http://insecure.endpoint" });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Invalid subscription object/i);
        });

        it("rejects missing keys or non-https endpoint", async () => {
            const res = await request(app)
                .post("/api/push/subscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send({
                    endpoint: "https://fcm.googleapis.com/test",
                    keys: { auth: 123 }
                });

            expect(res.status).toBe(400);
        });

        it("subscribes user successfully and saves new subscription", async () => {
            const mockUser = {
                _id: testUserId,
                pushSubscriptions: [],
                save: jest.fn().mockResolvedValue(true)
            };
            User.findById.mockResolvedValue(mockUser);

            const validSub = {
                endpoint: "https://fcm.googleapis.com/fcm/send/abc12345",
                keys: {
                    auth: "authSecretTest",
                    p256dh: "p256dhKeyTest"
                }
            };

            const res = await request(app)
                .post("/api/push/subscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send(validSub);

            expect(res.status).toBe(201);
            expect(res.body.message).toMatch(/Subscribed successfully/i);
            expect(mockUser.pushSubscriptions).toHaveLength(1);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it("does not duplicate already existing subscription endpoints", async () => {
            const existingSub = {
                endpoint: "https://fcm.googleapis.com/fcm/send/abc12345",
                keys: {
                    auth: "authSecretTest",
                    p256dh: "p256dhKeyTest"
                }
            };
            const mockUser = {
                _id: testUserId,
                pushSubscriptions: [existingSub],
                save: jest.fn().mockResolvedValue(true)
            };
            User.findById.mockResolvedValue(mockUser);

            const res = await request(app)
                .post("/api/push/subscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send(existingSub);

            expect(res.status).toBe(201);
            expect(mockUser.pushSubscriptions).toHaveLength(1);
            expect(mockUser.save).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/push/unsubscribe", () => {
        it("rejects missing endpoint parameter", async () => {
            const res = await request(app)
                .post("/api/push/unsubscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Invalid endpoint/i);
        });

        it("unsubscribes matching endpoint from user subscriptions", async () => {
            const targetEndpoint = "https://fcm.googleapis.com/fcm/send/target";
            const mockUser = {
                _id: testUserId,
                pushSubscriptions: [
                    { endpoint: targetEndpoint },
                    { endpoint: "https://fcm.googleapis.com/fcm/send/other" }
                ],
                save: jest.fn().mockResolvedValue(true)
            };
            User.findById.mockResolvedValue(mockUser);

            const res = await request(app)
                .post("/api/push/unsubscribe")
                .set("Authorization", `Bearer ${validToken}`)
                .send({ endpoint: targetEndpoint });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/Unsubscribed successfully/i);
            expect(mockUser.pushSubscriptions).toHaveLength(1);
            expect(mockUser.pushSubscriptions[0].endpoint).toBe("https://fcm.googleapis.com/fcm/send/other");
            expect(mockUser.save).toHaveBeenCalled();
        });
    });
});
