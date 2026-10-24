# Technical Analysis: Server Routes, Middleware, & Admin Auth for Tournament Approval

## Executive Summary
This investigation outlines the architectural design and implementation specifications for mounting `/api/admin/tournaments` in the Express backend (`server/server.js`), protecting it with existing authentication and role-checking middleware (`server/middleware/auth.js`), and implementing the required administrative lifecycle endpoints (`GET /proposed`, `POST /approve/:id`, `POST /reject/:id`, `PUT /:id`).

---

## 1. Route Mounting & Express Server Architecture (`server/server.js`)

### 1.1 Middleware Pipeline in `server.js`
The server middleware stack in `server/server.js` executes in the following sequence:
1. **Security & Sanitization Headers**:
   - `helmet()` (line 28): Sets standard secure HTTP headers.
   - `mongoSanitize()` (line 31): Strips prohibited characters (`$` and `.`) from request bodies/queries to prevent NoSQL injection.
2. **Global Rate Limiting**:
   - `apiLimiter` (lines 37–49): Applies rate limiting to `/api/` (500 requests per 15 minutes, backed by Redis if available).
3. **CORS Whitelisting**:
   - `cors(corsOptions)` (lines 70–79, 114): Whitelists localhost, Render deployment domains, and custom origins with credentials support.
4. **Body Parsing**:
   - `express.json({ limit: "1mb" })` (line 115) and `express.urlencoded({ limit: "1mb", extended: true })` (line 116).
5. **Context Augmentation**:
   - Attaches Socket.io instance to request via `req.io = io` (lines 108–111) and `app.set("io", io)` (line 142).
6. **Route Mounts**:
   - Handled via `app.use("/api/<route_prefix>", router)` across lines 118–140.
7. **Global Error Handling**:
   - `app.use(errorHandler)` (line 223) catches unhandled errors, formats JSON responses, maps `ValidationError` and `CastError` to HTTP 400, maps CORS to HTTP 403, and scrubs stack traces in production.

### 1.2 Mounting Strategy for `/api/admin/tournaments`
In `server/server.js`, line 124–125 currently mounts:
```javascript
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
```
To implement requirement R2 cleanly and avoid route ambiguity:
- Create `server/routes/adminTournaments.js`.
- Mount it **before** `app.use("/api/admin", adminRoutes)`:
```javascript
const adminTournamentsRoutes = require("./routes/adminTournaments");
app.use("/api/admin/tournaments", adminTournamentsRoutes);

const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
```
**Rationale**: In Express, route resolution proceeds top-down. Placing `/api/admin/tournaments` prior to `/api/admin` ensures all requests targeting `/api/admin/tournaments/*` are dispatched directly to `adminTournaments.js` without traversing the middleware stack in `admin.js`.

---

## 2. Authentication & Role Verification Architecture

### 2.1 Existing Auth Middleware (`server/middleware/auth.js`)
`server/middleware/auth.js` already provides the necessary authentication and authorization primitives:
```javascript
// server/middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";

const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader)
        return res.status(401).json({ message: "No token, authorization denied" });

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        if (req.user) {
            const normalizedId = (req.user.userId || req.user.id || "").toString();
            req.user.id = normalizedId;
            req.user.userId = normalizedId;
        }
        next();
    } catch (err) {
        res.status(401).json({ message: "Token is not valid" });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admins only." });
    }
};

module.exports = { authMiddleware, adminMiddleware };
```

### 2.2 Token Lifecycle & Role Population
1. **User Schema**: `server/models/User.js` (lines 12–16) defines:
   ```javascript
   role: {
       type: String,
       enum: ["user", "admin"],
       default: "user",
   }
   ```
2. **Token Generation**: In `server/routes/auth.js` (lines 21–32):
   ```javascript
   const generateAccessToken = (user) => {
       return jwt.sign(
           {
               id: user._id.toString(),
               userId: user._id.toString(),
               role: user.role,
               name: user.name,
           },
           JWT_SECRET,
           { expiresIn: "15m" },
       );
   };
   ```
3. **Decoded Request State**:
   When a client transmits `Authorization: Bearer <token>`, `authMiddleware` validates the cryptographic signature and attaches the payload directly to `req.user`.
   - `req.user.id`: User ObjectId string
   - `req.user.userId`: User ObjectId string (alias)
   - `req.user.role`: `"admin"` or `"user"`
   - `req.user.name`: String
4. **Security Enforcement Pattern**:
   By attaching `router.use(authMiddleware)` and `router.use(adminMiddleware)` at the router level in `server/routes/adminTournaments.js`, every sub-route is guaranteed to enforce:
   - Missing/invalid/expired token $\rightarrow$ `401 Unauthorized`
   - Authenticated user with `role !== "admin"` $\rightarrow$ `403 Forbidden` (`{ message: "Access denied. Admins only." }`)
   - Authenticated user with `role === "admin"` $\rightarrow$ Proceed to route handler

---

## 3. Detailed Endpoint Design for `/api/admin/tournaments`

### 3.1 Endpoint 1: `GET /proposed`
- **Full Path**: `GET /api/admin/tournaments/proposed`
- **Description**: Returns all proposed tournaments currently in the pending review queue, ordered by highest confidence score first.
- **Access Control**: Admin only (`authMiddleware`, `adminMiddleware`).
- **Database Query**:
  ```javascript
  const proposed = await ProposedTournament.find({ status: "pending" })
      .sort({ confidenceScore: -1 });
  ```
- **Responses**:
  - `200 OK`: Array of pending `ProposedTournament` objects.
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: User role is not admin.
  - `500 Internal Server Error`: Database query failure.

---

### 3.2 Endpoint 2: `POST /approve/:id`
- **Full Path**: `POST /api/admin/tournaments/approve/:id`
- **Description**: Finds the specified `ProposedTournament`, validates that it has not already been approved, creates a production tournament entry in the `Tournament` collection, and marks the proposal status as `'approved'`.
- **Access Control**: Admin only (`authMiddleware`, `adminMiddleware`).
- **Validation**:
  1. Validate ObjectId: `if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid tournament ID format." });`
  2. Existence Check: `const proposed = await ProposedTournament.findById(req.params.id);` $\rightarrow$ if not found, return `404` (`{ message: "Proposed tournament not found." }`).
  3. Idempotency Guard: `if (proposed.status === "approved") return res.status(400).json({ message: "Tournament has already been approved." });`
- **Mapping to `Tournament` Model**:
  ```javascript
  const newTournament = new Tournament({
      tournamentName: proposed.tournamentName,
      eventLocation: proposed.location || "DMV Area",
      registrationDeadline: proposed.registrationDeadline,
      registrationUrl: proposed.registrationLink || proposed.sourceUrl,
      sourceUrl: proposed.sourceUrl,
      flyerImageUrl: (proposed.scrapedImageUrls && proposed.scrapedImageUrls.length > 0) ? proposed.scrapedImageUrls[0] : "",
      skillLevels: proposed.skillLevels || [],
      startDate: proposed.date || undefined,
      originalCaption: proposed.rawCaption || "",
      isOpenTournament: true, // Marked true so it is published to active calendar and feed
      rsvpCount: 0,
      createdAt: new Date(),
  });
  await newTournament.save();

  proposed.status = "approved";
  await proposed.save();
  ```
- **Real-time Broadcast**:
  If Socket.io is active (`req.io`), broadcast event:
  `if (req.io) req.io.emit("tournamentApproved", newTournament);`
- **Responses**:
  - `200 OK` (or `201 Created`):
    ```json
    {
      "message": "Tournament approved successfully",
      "tournament": { ... },
      "proposed": { ... }
    }
    ```
  - `400 Bad Request`: Invalid ID or already approved.
  - `401 Unauthorized`: Missing/invalid token.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal with ID does not exist.

---

### 3.3 Endpoint 3: `POST /reject/:id`
- **Full Path**: `POST /api/admin/tournaments/reject/:id`
- **Description**: Marks the specified `ProposedTournament` as `'rejected'`.
- **Access Control**: Admin only (`authMiddleware`, `adminMiddleware`).
- **Validation**:
  1. Validate ObjectId: `if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid tournament ID format." });`
  2. Existence Check: `const proposed = await ProposedTournament.findById(req.params.id);` $\rightarrow$ if not found, return `404` (`{ message: "Proposed tournament not found." }`).
- **Status Transition**:
  ```javascript
  proposed.status = "rejected";
  await proposed.save();
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "Tournament proposal rejected",
      "proposed": { ... }
    }
    ```
  - `400 Bad Request`: Invalid ID format.
  - `401 Unauthorized`: Missing/invalid token.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal with ID does not exist.

---

### 3.4 Endpoint 4: `PUT /:id`
- **Full Path**: `PUT /api/admin/tournaments/:id`
- **Description**: Allows an admin to curate and edit the AI Structured Data fields of a `ProposedTournament` prior to approval (e.g. fixing typos, dates, or registration links).
- **Access Control**: Admin only (`authMiddleware`, `adminMiddleware`).
- **Validation & Sanitization**:
  1. Validate ObjectId: `if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid tournament ID format." });`
  2. Find document: `const proposed = await ProposedTournament.findById(req.params.id);` $\rightarrow$ return `404` if not found.
  3. Sanitize and update AI structured fields from `req.body`:
     - `tournamentName`: `xss(tournamentName.trim())`
     - `date`: `new Date(date)` (validate not NaN if provided)
     - `location`: `xss(location.trim())`
     - `entryFee`: `xss(String(entryFee).trim())`
     - `registrationLink`: URL format or trimmed string
     - `skillLevels`: sanitized array of strings
     - `registrationDeadline`: `new Date(registrationDeadline)` (validate not NaN if provided)
  4. Persist: `await proposed.save();`
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "Proposed tournament updated successfully",
      "proposed": { ... }
    }
    ```
  - `400 Bad Request`: Invalid ID format or date format.
  - `401 Unauthorized`: Missing/invalid token.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal with ID does not exist.

---

## 4. Recommended Route Implementation Structure

File: `server/routes/adminTournaments.js`
```javascript
const express = require("express");
const mongoose = require("mongoose");
const xss = require("xss");
const ProposedTournament = require("../models/ProposedTournament");
const Tournament = require("../models/Tournament");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();

// Router-level protection: Enforce auth and admin role on all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/tournaments/proposed
router.get("/proposed", async (req, res, next) => {
    try {
        const pendingTournaments = await ProposedTournament.find({ status: "pending" })
            .sort({ confidenceScore: -1 });
        res.json(pendingTournaments);
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/tournaments/approve/:id
router.post("/approve/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(req.params.id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        if (proposed.status === "approved") {
            return res.status(400).json({ message: "Tournament has already been approved." });
        }

        const newTournament = new Tournament({
            tournamentName: proposed.tournamentName,
            eventLocation: proposed.location || "DMV Area",
            registrationDeadline: proposed.registrationDeadline,
            registrationUrl: proposed.registrationLink || proposed.sourceUrl,
            sourceUrl: proposed.sourceUrl,
            flyerImageUrl: (proposed.scrapedImageUrls && proposed.scrapedImageUrls.length > 0)
                ? proposed.scrapedImageUrls[0]
                : "",
            skillLevels: proposed.skillLevels || [],
            startDate: proposed.date,
            originalCaption: proposed.rawCaption || "",
            isOpenTournament: true,
            rsvpCount: 0,
            createdAt: new Date(),
        });

        await newTournament.save();

        proposed.status = "approved";
        await proposed.save();

        if (req.io) {
            req.io.emit("tournamentApproved", newTournament);
        }

        res.status(200).json({
            message: "Tournament approved successfully",
            tournament: newTournament,
            proposed,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/tournaments/reject/:id
router.post("/reject/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(req.params.id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        proposed.status = "rejected";
        await proposed.save();

        res.status(200).json({
            message: "Tournament proposal rejected",
            proposed,
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/tournaments/:id
router.put("/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid tournament ID format." });
        }

        const proposed = await ProposedTournament.findById(req.params.id);
        if (!proposed) {
            return res.status(404).json({ message: "Proposed tournament not found." });
        }

        const {
            tournamentName,
            date,
            location,
            entryFee,
            registrationLink,
            skillLevels,
            registrationDeadline,
        } = req.body;

        if (tournamentName !== undefined) proposed.tournamentName = xss(String(tournamentName).trim());
        if (date !== undefined) proposed.date = date ? new Date(date) : undefined;
        if (location !== undefined) proposed.location = xss(String(location).trim());
        if (entryFee !== undefined) proposed.entryFee = xss(String(entryFee).trim());
        if (registrationLink !== undefined) proposed.registrationLink = String(registrationLink).trim();
        if (skillLevels !== undefined && Array.isArray(skillLevels)) {
            proposed.skillLevels = skillLevels.map(s => xss(String(s).trim()));
        }
        if (registrationDeadline !== undefined) {
            proposed.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : undefined;
        }

        await proposed.save();

        res.status(200).json({
            message: "Proposed tournament updated successfully",
            proposed,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
```

---

## 5. Summary of Recommended Edits in `server/server.js`

Add the import and mount directive around line 124:
```javascript
// Admin Tournament Review & Approval System (Phase 3)
const adminTournamentsRoutes = require("./routes/adminTournaments");
app.use("/api/admin/tournaments", adminTournamentsRoutes);
```
Directly preceding:
```javascript
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
```
