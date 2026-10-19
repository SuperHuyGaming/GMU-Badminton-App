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

jest.mock('../models/User', () => ({
    findOne: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null)
}));

jest.mock('../utils/aiModeration', () => ({
    analyzeContent: jest.fn().mockResolvedValue({ isFlagged: false, reason: "", score: 0 })
}));

jest.mock('../utils/aiCoach', () => ({
    chat: jest.fn().mockResolvedValue({ response: "Coaching response", error: false }),
    initializeGemini: jest.fn().mockReturnValue(true)
}));

jest.mock('../utils/seedFeed', () => jest.fn());
jest.mock('../utils/cronJobs', () => jest.fn());
jest.mock('../services/scraper', () => ({
    getRacStatus: jest.fn().mockResolvedValue("Open Play Active"),
    getWeeklySchedule: jest.fn().mockReturnValue([])
}));

const request = require("supertest");
const ioClient = require("../../client/node_modules/socket.io-client");
const { app, server, isOriginAllowed, onlineUsers } = require("../server");

describe("ADVERSARIAL SUITE 1: Burst OPTIONS Preflight Across Real Server Routes", () => {
    const routesToTest = [
        { path: "/api/auth/login", method: "POST", name: "authLimiter" },
        { path: "/api/auth/refresh-token", method: "POST", name: "refreshLimiter" },
        { path: "/api/matchmaking/discover", method: "GET", name: "discoverLimiter" },
        { path: "/api/tournaments", method: "GET", name: "globalLimiter" },
        { path: "/api/admin/tournaments/proposed", method: "GET", name: "adminActionLimiter" },
        { path: "/api/scrape/rac", method: "GET", name: "scrapeLimiter (max 5)" },
        { path: "/api/upload", method: "POST", name: "uploadLimiter" },
        { path: "/api/messages", method: "GET", name: "messageLimiter" },
        { path: "/api/profile/me", method: "GET", name: "profileLimiter" },
        { path: "/api/search", method: "GET", name: "searchLimiter" },
        { path: "/api/coach/chat", method: "POST", name: "coachLimiter" },
        { path: "/api/calendar/events", method: "GET", name: "calendarLimiter" },
        { path: "/api/forum", method: "GET", name: "postLimiter" },
        { path: "/api/marketplace", method: "GET", name: "listingLimiter" }
    ];

    const allowedOrigin = "https://gmu-frontend-staging.onrender.com";

    it("should survive 280 high-concurrency burst OPTIONS preflights with zero 429 errors", async () => {
        // Send 20 burst OPTIONS requests to each of the 14 routes (280 total)
        for (const route of routesToTest) {
            const burstPromises = [];
            for (let i = 0; i < 20; i++) {
                burstPromises.push(
                    request(app)
                        .options(route.path)
                        .set("Origin", allowedOrigin)
                        .set("Access-Control-Request-Method", route.method)
                        .set("Access-Control-Request-Headers", "Content-Type, Authorization")
                );
            }
            const responses = await Promise.all(burstPromises);
            for (const res of responses) {
                expect(res.status).toBe(204);
                expect(res.headers["access-control-allow-origin"]).toBe(allowedOrigin);
                expect(res.headers["access-control-allow-credentials"]).toBe("true");
                expect(res.headers["access-control-max-age"]).toBe("86400");
                expect(res.status).not.toBe(429);
            }
        }
    });

    it("should still enforce rate limiting for standard (non-OPTIONS) requests", async () => {
        // authLimiter has max: 10 per 15 minutes
        let hit429 = false;
        let attempts = 0;
        for (let i = 0; i < 15; i++) {
            attempts++;
            const res = await request(app)
                .post("/api/auth/login")
                .send({ email: `burst_test_${i}@gmu.edu`, password: "password123" });
            if (res.status === 429) {
                hit429 = true;
                break;
            }
        }
        expect(hit429).toBe(true);
        expect(attempts).toBeLessThanOrEqual(12);
    });
});

describe("ADVERSARIAL SUITE 2: Malicious & Disallowed Origin Injection", () => {
    const maliciousOrigins = [
        "http://malicious-attacker.com",
        "https://evil-phishing.org",
        "https://attacker-onrender.com.evil.com",
        "https://fake-gmu-badminton.com"
    ];

    it("should refuse CORS headers and never crash server when receiving untrusted origins", async () => {
        for (const origin of maliciousOrigins) {
            const resOptions = await request(app)
                .options("/api/matchmaking/discover")
                .set("Origin", origin)
                .set("Access-Control-Request-Method", "GET");

            // Express returns 200 (Allow: GET,HEAD) for preflight when CORS callback is (null, false),
            // and omits Access-Control-Allow-Origin header.
            expect([200, 204]).toContain(resOptions.status);
            expect(resOptions.headers["access-control-allow-origin"]).toBeUndefined();
            expect(resOptions.status).not.toBe(500);

            const resGet = await request(app)
                .get("/api/status")
                .set("Origin", origin);

            expect(resGet.headers["access-control-allow-origin"]).toBeUndefined();
            expect(resGet.status).not.toBe(500);
        }
    });

    it("should audit origin validation rejecting third-party *.onrender.com subdomains while permitting local dev", () => {
        // Line 67 in server.js: /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/
        // Allows ANY arbitrary local port (e.g. 8080, 9999), bypassing the staticAllowedOrigins whitelist
        expect(isOriginAllowed("http://localhost:8080")).toBe(true);
        expect(isOriginAllowed("http://127.0.0.1:9999")).toBe(true);

        // Third-party Render application (not GMU/badminton apps) must be rejected
        const thirdPartyRenderOrigin = "https://unrelated-third-party.onrender.com";
        const isAllowed = isOriginAllowed(thirdPartyRenderOrigin);
        // Empirically confirms that unrelated Render apps are rejected
        expect(isAllowed).toBe(false);
    });
});

describe("ADVERSARIAL SUITE 3: Real Socket.io Multi-Tab Lifecycle & State Retention", () => {
    let testServer;
    let serverUrl;

    beforeAll((done) => {
        testServer = server.listen(0, () => {
            const port = testServer.address().port;
            serverUrl = `http://localhost:${port}`;
            done();
        });
    });

    afterAll((done) => {
        testServer.close(done);
    });

    beforeEach(() => {
        onlineUsers.clear();
    });

    it("should retain user online presence when one tab closes while another remains connected", async () => {
        const userId = "adversarial_user_multi_tab_42";

        // Tab 1 connects
        const socket1 = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });
        await new Promise((resolve) => socket1.on("connect", resolve));
        socket1.emit("joinUserRoom", userId);
        await new Promise((r) => setTimeout(r, 80));

        expect(onlineUsers.has(userId)).toBe(true);
        expect(onlineUsers.get(userId).size).toBe(1);
        expect(onlineUsers.get(userId).has(socket1.id)).toBe(true);

        // Tab 2 connects
        const socket2 = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });
        await new Promise((resolve) => socket2.on("connect", resolve));
        socket2.emit("joinUserRoom", userId);
        await new Promise((r) => setTimeout(r, 80));

        expect(onlineUsers.has(userId)).toBe(true);
        expect(onlineUsers.get(userId).size).toBe(2);
        expect(onlineUsers.get(userId).has(socket2.id)).toBe(true);

        // Disconnect Tab 1: user MUST remain in onlineUsers
        socket1.disconnect();
        await new Promise((r) => setTimeout(r, 80));

        expect(onlineUsers.has(userId)).toBe(true);
        expect(onlineUsers.get(userId).size).toBe(1);
        expect(onlineUsers.get(userId).has(socket2.id)).toBe(true);

        // Disconnect Tab 2: user is now officially offline
        socket2.disconnect();
        await new Promise((r) => setTimeout(r, 80));

        expect(onlineUsers.has(userId)).toBe(false);
    });

    it("verifies socket rejects invalid/falsy userId and cleans up prior association on userId change", async () => {
        const socketAnon = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });
        await new Promise((resolve) => socketAnon.on("connect", resolve));

        try {
            // When a client sends falsy userId (null), it must NOT be stored in onlineUsers
            socketAnon.emit("joinUserRoom", null);
            await new Promise((r) => setTimeout(r, 50));
            expect(onlineUsers.has(null)).toBe(false);

            // When a client sends whitespace or non-string, it must NOT be stored
            socketAnon.emit("joinUserRoom", "");
            socketAnon.emit("joinUserRoom", "   ");
            socketAnon.emit("joinUserRoom", { id: "invalid" });
            await new Promise((r) => setTimeout(r, 50));
            expect(onlineUsers.size).toBe(0);

            // When a client sends a valid userId, it is accepted
            socketAnon.emit("joinUserRoom", "user_first");
            await new Promise((r) => setTimeout(r, 50));
            expect(onlineUsers.has("user_first")).toBe(true);
            expect(onlineUsers.get("user_first").has(socketAnon.id)).toBe(true);

            // When socket joins under a different userId, clean up previous association
            socketAnon.emit("joinUserRoom", "user_second");
            await new Promise((r) => setTimeout(r, 50));
            expect(onlineUsers.has("user_first")).toBe(false);
            expect(onlineUsers.has("user_second")).toBe(true);
            expect(onlineUsers.get("user_second").has(socketAnon.id)).toBe(true);
        } finally {
            socketAnon.disconnect();
            await new Promise((r) => setTimeout(r, 50));
        }

        expect(onlineUsers.has("user_second")).toBe(false);
        expect(onlineUsers.size).toBe(0);
    });

    it("exhaustively fuzzer-tests joinUserRoom with malformed payloads and confirms onlineUsersUpdate broadcast isolation", async () => {
        const observerSocket = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });
        const attackerSocket = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });

        await Promise.all([
            new Promise((resolve) => observerSocket.on("connect", resolve)),
            new Promise((resolve) => attackerSocket.on("connect", resolve))
        ]);

        const receivedBroadcasts = [];
        observerSocket.on("onlineUsersUpdate", (payload) => {
            receivedBroadcasts.push(payload);
        });

        const maliciousPayloads = [
            null,
            undefined,
            "",
            "   ",
            "\t\n\r",
            12345,
            0,
            true,
            false,
            NaN,
            {},
            { id: "admin", $ne: null },
            ["injected_user_id"],
            () => "evil"
        ];

        try {
            // Send all malicious payloads in rapid succession
            for (const payload of maliciousPayloads) {
                attackerSocket.emit("joinUserRoom", payload);
            }
            await new Promise((r) => setTimeout(r, 100));

            // Verify onlineUsers was never touched
            expect(onlineUsers.size).toBe(0);

            // Verify observer NEVER received any onlineUsersUpdate broadcast during malicious spam
            expect(receivedBroadcasts.length).toBe(0);

            // Now send a legitimate join event
            attackerSocket.emit("joinUserRoom", "legitimate_fuzzer_verified_user");
            await new Promise((r) => setTimeout(r, 60));

            // Verify observer received exactly one broadcast with legitimate user
            expect(receivedBroadcasts.length).toBe(1);
            expect(receivedBroadcasts[0]).toEqual(["legitimate_fuzzer_verified_user"]);
            expect(onlineUsers.has("legitimate_fuzzer_verified_user")).toBe(true);
        } finally {
            observerSocket.disconnect();
            attackerSocket.disconnect();
            await new Promise((r) => setTimeout(r, 50));
        }

        expect(onlineUsers.size).toBe(0);
    });

    it("properly isolates multi-tab re-association when a user has multiple sockets and one switches identity", async () => {
        const socketTabA1 = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });
        const socketTabA2 = ioClient(serverUrl, {
            transports: ["websocket", "polling"],
            forceNew: true,
            reconnection: false
        });

        await Promise.all([
            new Promise((resolve) => socketTabA1.on("connect", resolve)),
            new Promise((resolve) => socketTabA2.on("connect", resolve))
        ]);

        try {
            // Both tabs join user_shared
            socketTabA1.emit("joinUserRoom", "user_shared");
            socketTabA2.emit("joinUserRoom", "user_shared");
            await new Promise((r) => setTimeout(r, 60));

            expect(onlineUsers.get("user_shared").size).toBe(2);
            expect(onlineUsers.get("user_shared").has(socketTabA1.id)).toBe(true);
            expect(onlineUsers.get("user_shared").has(socketTabA2.id)).toBe(true);

            // Now Tab A1 switches to user_separate
            socketTabA1.emit("joinUserRoom", "user_separate");
            await new Promise((r) => setTimeout(r, 60));

            // user_shared must still exist with Tab A2 only
            expect(onlineUsers.has("user_shared")).toBe(true);
            expect(onlineUsers.get("user_shared").size).toBe(1);
            expect(onlineUsers.get("user_shared").has(socketTabA2.id)).toBe(true);
            expect(onlineUsers.get("user_shared").has(socketTabA1.id)).toBe(false);

            // user_separate must exist with Tab A1
            expect(onlineUsers.has("user_separate")).toBe(true);
            expect(onlineUsers.get("user_separate").size).toBe(1);
            expect(onlineUsers.get("user_separate").has(socketTabA1.id)).toBe(true);

            // Tab A2 disconnects
            socketTabA2.disconnect();
            await new Promise((r) => setTimeout(r, 60));

            // user_shared must now be offline
            expect(onlineUsers.has("user_shared")).toBe(false);
            // user_separate remains online
            expect(onlineUsers.has("user_separate")).toBe(true);
        } finally {
            socketTabA1.disconnect();
            socketTabA2.disconnect();
            await new Promise((r) => setTimeout(r, 60));
        }

        expect(onlineUsers.size).toBe(0);
    });
});

