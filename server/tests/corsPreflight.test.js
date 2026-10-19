jest.mock('natural', () => ({
    BayesClassifier: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        train: jest.fn(),
        classify: jest.fn(() => 'ham')
    }))
}));

jest.mock('mongoose', () => {
    const original = jest.requireActual('mongoose');
    return {
        ...original,
        connect: jest.fn().mockResolvedValue(true)
    };
});

const request = require("supertest");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { isOriginAllowed, corsOptions, onlineUsers } = require("../server");

describe("CORS Pipeline & Origin Whitelist Validation", () => {
    it("should allow verified local development origins", () => {
        expect(isOriginAllowed("http://localhost:5173")).toBe(true);
        expect(isOriginAllowed("http://localhost:3000")).toBe(true);
        expect(isOriginAllowed("http://localhost:4173")).toBe(true);
        expect(isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
        expect(isOriginAllowed("http://127.0.0.1:4173")).toBe(true);
        expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true);
    });

    it("should allow staging, preview, and production Render deployments", () => {
        expect(isOriginAllowed("https://gmu-frontend-staging.onrender.com")).toBe(true);
        expect(isOriginAllowed("https://gmu-badminton-app.onrender.com")).toBe(true);
        expect(isOriginAllowed("https://gmu-badminton-openplayschedule.onrender.com")).toBe(true);
        expect(isOriginAllowed("https://gmu-badminton.onrender.com")).toBe(true);
        expect(isOriginAllowed("https://pr-12-gmu-badminton.onrender.com")).toBe(true);
        expect(isOriginAllowed("https://preview-gmu-tournament.onrender.com")).toBe(true);
    });

    it("should allow non-browser agents (curl, mobile apps) with null/undefined origin", () => {
        expect(isOriginAllowed(null)).toBe(true);
        expect(isOriginAllowed(undefined)).toBe(true);
        expect(isOriginAllowed("")).toBe(true);
    });

    it("should reject malicious or unapproved third-party domains", () => {
        expect(isOriginAllowed("https://malicious-attacker.com")).toBe(false);
        expect(isOriginAllowed("http://phishing-site.org")).toBe(false);
        expect(isOriginAllowed("https://evil-badminton.com")).toBe(false);
        expect(isOriginAllowed("https://evil-attacker.onrender.com")).toBe(false);
        expect(isOriginAllowed("https://unrelated-app.onrender.com")).toBe(false);
        expect(isOriginAllowed("https://random-tenant.onrender.com")).toBe(false);
    });
});

describe("CORS Preflight (OPTIONS) Integration & Headers", () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(cors(corsOptions));
        app.options("*", cors(corsOptions));

        app.get("/api/test-endpoint", (req, res) => {
            res.json({ success: true });
        });

        app.post("/api/test-endpoint", (req, res) => {
            res.json({ created: true });
        });
    });

    it("should respond 204 to preflight OPTIONS from staging domain with correct CORS headers", async () => {
        const res = await request(app)
            .options("/api/test-endpoint")
            .set("Origin", "https://gmu-frontend-staging.onrender.com")
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "Content-Type, Authorization");

        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe("https://gmu-frontend-staging.onrender.com");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
        expect(res.headers["access-control-allow-methods"]).toBeDefined();
        expect(res.headers["access-control-max-age"]).toBe("86400");
    });

    it("should respond 204 to preflight OPTIONS from production domain", async () => {
        const res = await request(app)
            .options("/api/test-endpoint")
            .set("Origin", "https://gmu-badminton-app.onrender.com")
            .set("Access-Control-Request-Method", "GET");

        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe("https://gmu-badminton-app.onrender.com");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should not return Access-Control-Allow-Origin for unauthorized origin on preflight", async () => {
        const res = await request(app)
            .options("/api/test-endpoint")
            .set("Origin", "https://malicious-site.com")
            .set("Access-Control-Request-Method", "POST");

        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should not return Access-Control-Allow-Origin for untrusted Render domains on preflight", async () => {
        const res = await request(app)
            .options("/api/test-endpoint")
            .set("Origin", "https://evil-attacker.onrender.com")
            .set("Access-Control-Request-Method", "POST");

        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("should attach CORS headers on standard GET request from allowed origin", async () => {
        const res = await request(app)
            .get("/api/test-endpoint")
            .set("Origin", "https://gmu-frontend-staging.onrender.com");

        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe("https://gmu-frontend-staging.onrender.com");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });
});

describe("Rate Limiter Preflight (OPTIONS) Bypassing", () => {
    let rateLimitedApp;

    beforeAll(() => {
        rateLimitedApp = express();
        const testLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 3, // Very low limit to verify bypass
            skip: (req) => req.method === "OPTIONS",
            message: { error: "Too many requests" }
        });

        rateLimitedApp.use(cors(corsOptions));
        rateLimitedApp.options("*", cors(corsOptions));
        rateLimitedApp.use("/api/", testLimiter);

        rateLimitedApp.get("/api/data", (req, res) => res.json({ ok: true }));
    });

    it("should allow rapid burst OPTIONS requests without triggering HTTP 429", async () => {
        // Send 10 consecutive preflight OPTIONS requests (limit is 3)
        for (let i = 0; i < 10; i++) {
            const res = await request(rateLimitedApp)
                .options("/api/data")
                .set("Origin", "https://gmu-frontend-staging.onrender.com")
                .set("Access-Control-Request-Method", "GET");
            expect(res.status).toBe(204);
        }
    });

    it("should still rate limit standard requests once limit is exceeded", async () => {
        // First 3 requests should pass
        for (let i = 0; i < 3; i++) {
            const res = await request(rateLimitedApp).get("/api/data");
            expect(res.status).toBe(200);
        }
        // 4th request must be throttled
        const throttledRes = await request(rateLimitedApp).get("/api/data");
        expect(throttledRes.status).toBe(429);
    });
});

describe("Socket.io Multi-Tab Connection Tracking", () => {
    beforeEach(() => {
        onlineUsers.clear();
    });

    it("should correctly handle multiple tabs for a single user without premature disconnection", () => {
        const userId = "user123";
        const socketTab1 = "socket_tab_1";
        const socketTab2 = "socket_tab_2";

        // Tab 1 joins
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socketTab1);

        expect(onlineUsers.has(userId)).toBe(true);
        expect(onlineUsers.get(userId).size).toBe(1);
        expect(Array.from(onlineUsers.keys())).toContain(userId);

        // Tab 2 joins
        onlineUsers.get(userId).add(socketTab2);
        expect(onlineUsers.get(userId).size).toBe(2);
        // Keys should still only have 1 entry for this user
        expect(Array.from(onlineUsers.keys())).toEqual([userId]);

        // Tab 1 closes (disconnects)
        const userSockets = onlineUsers.get(userId);
        userSockets.delete(socketTab1);
        if (userSockets.size === 0) {
            onlineUsers.delete(userId);
        }

        // Tab 2 is still active: user must REMAIN online
        expect(onlineUsers.has(userId)).toBe(true);
        expect(onlineUsers.get(userId).size).toBe(1);
        expect(onlineUsers.get(userId).has(socketTab2)).toBe(true);
        expect(Array.from(onlineUsers.keys())).toContain(userId);

        // Tab 2 closes (final disconnect)
        userSockets.delete(socketTab2);
        if (userSockets.size === 0) {
            onlineUsers.delete(userId);
        }

        // Now user is officially offline
        expect(onlineUsers.has(userId)).toBe(false);
        expect(Array.from(onlineUsers.keys())).not.toContain(userId);
    });

    it("should reject invalid, null, or empty string userIds and clean up prior socket associations on userId switch", () => {
        const simulateJoin = (socket, userId) => {
            if (!userId || typeof userId !== "string" || !userId.trim()) {
                return;
            }
            userId = userId.trim();

            if (socket.userId && socket.userId !== userId && onlineUsers.has(socket.userId)) {
                onlineUsers.get(socket.userId).delete(socket.id);
                if (onlineUsers.get(socket.userId).size === 0) {
                    onlineUsers.delete(socket.userId);
                }
            }

            socket.userId = userId;
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            onlineUsers.get(userId).add(socket.id);
        };

        const mockSocket = { id: "socket_test_1", userId: null };

        // Test invalid/empty inputs
        simulateJoin(mockSocket, null);
        simulateJoin(mockSocket, undefined);
        simulateJoin(mockSocket, "");
        simulateJoin(mockSocket, "   ");
        simulateJoin(mockSocket, 12345);
        simulateJoin(mockSocket, {});

        expect(onlineUsers.size).toBe(0);
        expect(mockSocket.userId).toBeNull();

        // Valid join
        simulateJoin(mockSocket, "userA");
        expect(onlineUsers.has("userA")).toBe(true);
        expect(mockSocket.userId).toBe("userA");

        // Switch to different user
        simulateJoin(mockSocket, "userB");
        expect(onlineUsers.has("userA")).toBe(false);
        expect(onlineUsers.has("userB")).toBe(true);
        expect(mockSocket.userId).toBe("userB");
    });
});
