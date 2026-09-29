
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "server/routes/matchmaking.js");
let content = fs.readFileSync(file, "utf-8");

content = content.replace(
`router.get("/discover", authMiddleware, async (req, res) => {
    try {
        const { search, skill } = req.query;`,
`// GET /api/matchmaking/presence - Task 7
router.get("/presence", authMiddleware, async (req, res) => {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUsers = await User.find({ lastActive: { $gte: fiveMinsAgo } })
            .select("name _id")
            .lean();
        res.json({ onlineUsers: activeUsers });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/matchmaking/queue/join - Task 9
router.post("/queue/join", authMiddleware, async (req, res) => {
    try {
        const { checkInLocation, preferredTimeOfDay } = req.body;
        await User.findByIdAndUpdate(req.user.userId, { 
            inQueue: true, 
            queueJoinedAt: new Date(),
            ...(checkInLocation && { checkInLocation }),
            ...(preferredTimeOfDay && { preferredTimeOfDay })
        });
        res.json({ message: "Joined queue successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error joining queue" });
    }
});

// POST /api/matchmaking/queue/leave - Task 9
router.post("/queue/leave", authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.userId, { inQueue: false });
        res.json({ message: "Left queue successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error leaving queue" });
    }
});

router.get("/discover", authMiddleware, async (req, res) => {
    try {
        const { search, skill, cursor, checkInLocation, timeOfDay } = req.query;`
);

content = content.replace(
`        // Build base query (exclude self)
        const query = {
            _id: { $ne: req.user.userId },
        };`,
`        // Build base query (exclude self)
        const query = {
            _id: { $ne: req.user.userId },
        };

        // Task 10: Cursor-Based Pagination
        if (cursor) {
            query._id = { $lt: cursor };
        }

        // Task 8: Geospatial Court Check-in Search
        if (checkInLocation && checkInLocation !== "All") {
            query.checkInLocation = checkInLocation;
        }

        // Task 11: Recommendation Engine V2
        if (timeOfDay && timeOfDay !== "Any") {
            query.$or = [
                ...(query.$or || []),
                { preferredTimeOfDay: timeOfDay },
                { preferredTimeOfDay: "Any" }
            ];
        }`
);

content = content.replace(
`        // Fetch up to 50 users, sorted by most recently active
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location")
            .sort({ lastActive: -1 })
            .limit(50)
            .lean();`,
`        // Fetch up to 50 users
        const potentialMatches = await User.find(query)
            .select("name bio skillLevel preferredPlay racket profilePic homeUniversity lastActive location checkInLocation preferredTimeOfDay inQueue")
            .sort({ _id: -1 }) // Cursor pagination usually relies on stable sorting like _id
            .limit(50)
            .lean();`
);

fs.writeFileSync(file, content);
console.log("Updated matchmaking.js");

