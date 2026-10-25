# Handoff Report: Phase 3 Core Backend — Server Routes, Middleware, & Admin Auth

## 1. Observation

### 1.1 Server Routing & Middleware Architecture
- **File**: `server/server.js`
  - **Lines 28–49**: Express application initializes global security layers: `helmet()` (line 28), `mongoSanitize()` (line 31), and `apiLimiter` rate limiting on `/api/` (lines 37–49, 500 requests per 15 min).
  - **Lines 108–111**: Socket.io instance attached to each incoming request via `req.io = io`.
  - **Lines 114–116**: CORS headers applied via `cors(corsOptions)`, followed by JSON parser (`express.json({ limit: "1mb" })`) and URL-encoded parser (`express.urlencoded({ limit: "1mb", extended: true })`).
  - **Lines 118–140**: Routes mounted sequentially under `/api/`:
    ```javascript
    124: const adminRoutes = require("./routes/admin");
    125: app.use("/api/admin", adminRoutes);
    ```
  - **Lines 222–223**: Global error-handling middleware mounted at end of pipeline:
    ```javascript
    // Global error handler must be defined after all other routes and middleware
    app.use(errorHandler);
    ```
- **File**: `server/middleware/errorHandler.js`
  - Lines 9–17: Maps CORS rejections to 403, and Mongoose `ValidationError`, `CastError`, and `MulterError` to 400.
  - Lines 19–28: Suppresses internal error messages to `"An unexpected server error occurred."` when `NODE_ENV === "production"`.

### 1.2 Authentication & Role Verification Implementation
- **File**: `server/middleware/auth.js`
  - Lines 8–28: `authMiddleware` extracts `req.header("Authorization")`. If missing, returns `401` (`{ message: "No token, authorization denied" }`). Verifies JWT with `jwt.verify(token, JWT_SECRET)`. If invalid, returns `401` (`{ message: "Token is not valid" }`). Decodes payload to `req.user`, normalizing `req.user.id` and `req.user.userId`.
  - Lines 30–37: `adminMiddleware` is already implemented and exported:
    ```javascript
    const adminMiddleware = (req, res, next) => {
        // Check the "role" we just added to the JWT
        if (req.user && req.user.role === "admin") {
            next(); // User is an admin, let them through!
        } else {
            res.status(403).json({ message: "Access denied. Admins only." });
        }
    };

    module.exports = { authMiddleware, adminMiddleware };
    ```
- **File**: `server/models/User.js`
  - Lines 12–16: User schema enforces role enum:
    ```javascript
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    ```
- **File**: `server/routes/auth.js`
  - Lines 21–32: JWT generation embeds `user.role`:
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
- **File**: `server/routes/admin.js`
  - Lines 11–12: Precedent for router-level security:
    ```javascript
    router.use(authMiddleware);
    router.use(adminMiddleware);
    ```

### 1.3 Target Tournament Schemas & Integration Points
- **File**: `server/models/Tournament.js`
  - Lines 3–26: Defines production tournament collection:
    ```javascript
    const tournamentSchema = new mongoose.Schema({
        tournamentName: String,
        hostUniversity: String,
        eventLocation: String,
        registrationDeadline: Date,
        rideFormDeadline: Date,
        isOpenTournament: Boolean,
        registrationUrl: String,
        sourceUrl: String,
        flyerImageUrl: String,
        rsvpCount: Number,
        skillLevels: [String],
        startDate: Date,
        endDate: Date,
        scraperLastRun: Date,
        instagramPostUrl: String,
        hostClubHandle: String,
        linktreeUrl: String,
        originalCaption: String,
        hasSentDeadlineWarning: { type: Boolean, default: false },
        createdAt: Date
    }, { collection: "tournaments" });
    ```
- **File**: `server/models/ProposedTournament.js`
  - Currently does not exist; being investigated by Explorer 1 for R1.
  - Specified in `ORIGINAL_REQUEST.md`: Raw Scraped Data (`rawCaption`, `scrapedImageUrls`, `sourceLinks`), AI Structured Data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`), and Metadata (`sourceUrl`, `confidenceScore` 0-100, `status` enum: `['pending', 'approved', 'rejected']`).

### 1.4 Test Suite Execution
- Running `npm test` in `server/`:
  - Result: `Test Suites: 9 passed, 9 total. Tests: 8 skipped, 115 passed, 123 total. Time: 2.533 s`.
- Running `npm run lint` in `server/`:
  - Result: Clean exit code 0, 0 errors.

---

## 2. Logic Chain

1. *Observation 1.1*: Express routes are loaded in `server/server.js` using `app.use("/api/...", router)`. Line 125 mounts `/api/admin` with `admin.js`.
2. *Observation 1.1*: In Express, routing precedence is top-down. If a request is sent to `/api/admin/tournaments/proposed`, mounting `/api/admin/tournaments` directly before `/api/admin` guarantees that all tournament routes resolve to `adminTournaments.js` cleanly and directly without passing into `admin.js`.
3. *Observation 1.2*: `server/middleware/auth.js` already exports `authMiddleware` and `adminMiddleware`. `authMiddleware` verifies the JWT signature and populates `req.user.role`, and `adminMiddleware` validates `req.user.role === 'admin'`, returning `403` with `{ message: "Access denied. Admins only." }` if not admin.
4. *Observation 1.2*: In `server/routes/admin.js` (lines 11–12), applying `router.use(authMiddleware)` followed by `router.use(adminMiddleware)` at the router root guarantees that all endpoints on that router require valid admin credentials without needing repetitive per-route middleware definitions.
5. *Observation 1.3*: In `server/models/Tournament.js`, the schema accepts `tournamentName`, `eventLocation`, `registrationDeadline`, `registrationUrl`, `sourceUrl`, `flyerImageUrl`, `skillLevels`, `startDate`, `originalCaption`, `isOpenTournament`, `rsvpCount`, and `createdAt`. When `POST /approve/:id` is called, mapping `ProposedTournament` fields into this schema and setting `isOpenTournament: true` perfectly integrates approved tournaments into the live GMU Badminton calendar (`server/routes/calendar.js`) and feeds.
6. *Observation 1.4*: Existing test suites (`tests/securityValidation.test.js`) verify that non-admin tokens receive 401/403 for protected routes, confirming that any new test suite using `adminToken` vs `userToken` will behave consistently and pass seamlessly.

---

## 3. Caveats

- **ProposedTournament Model Dependency**: `server/models/ProposedTournament.js` must be created (Task R1) before `server/routes/adminTournaments.js` can be executed against live database collections. However, route definitions can be written and mocked independently.
- **Idempotency Guard**: An admin may double-click the "Approve" button or two admins may review simultaneously. The endpoint must check `if (proposed.status === "approved")` to prevent duplicate Tournament entries.
- **Input Sanitization**: While admins are trusted roles, XSS sanitization via `xss()` should still be applied on all editable text fields in `PUT /:id` and `POST /approve/:id` to adhere to security best practices.

---

## 4. Conclusion

1. **Mount Point in `server/server.js`**:
   Mount `adminTournaments.js` at `/api/admin/tournaments` immediately before line 124 (`/api/admin`):
   ```javascript
   const adminTournamentsRoutes = require("./routes/adminTournaments");
   app.use("/api/admin/tournaments", adminTournamentsRoutes);
   const adminRoutes = require("./routes/admin");
   app.use("/api/admin", adminRoutes);
   ```
2. **Auth & Role Verification**:
   Enforce security at the top of `server/routes/adminTournaments.js`:
   ```javascript
   const { authMiddleware, adminMiddleware } = require("../middleware/auth");
   router.use(authMiddleware);
   router.use(adminMiddleware);
   ```
   This satisfies R3 with zero privilege escalation risk.
3. **Endpoints Contract**:
   - `GET /proposed`: Returns all `status: 'pending'` proposals sorted by `{ confidenceScore: -1 }`.
   - `POST /approve/:id`: Validates ID, checks proposal exists and is not already approved, instantiates `Tournament` with `isOpenTournament: true`, saves to DB, sets `proposed.status = 'approved'`, emits `tournamentApproved` over Socket.io, returns 200.
   - `POST /reject/:id`: Validates ID, marks `proposed.status = 'rejected'`, returns 200.
   - `PUT /:id`: Validates ID, updates AI structured fields (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`) with XSS sanitization, returns 200.

---

## 5. Verification Method

1. **Unit & Integration Tests**:
   Create a dedicated test file `server/tests/adminTournaments.test.js` using `supertest`:
   - Verify unauthenticated requests to `/api/admin/tournaments/proposed` return `401`.
   - Verify non-admin requests (`userToken`) to `/api/admin/tournaments/proposed`, `approve/:id`, `reject/:id`, and `PUT /:id` return `403`.
   - Verify admin requests (`adminToken`) to `/api/admin/tournaments/proposed` return `200` with sorted pending proposals.
   - Verify `POST /api/admin/tournaments/approve/:id` creates a `Tournament` and updates proposal status to `approved`.
   - Verify `POST /api/admin/tournaments/reject/:id` updates proposal status to `rejected`.
   - Verify `PUT /api/admin/tournaments/:id` updates AI structured fields.
2. **Command Line Verification**:
   ```bash
   cd "D:\GMU Fall 2026\GMU-Badminton-App\server"
   npm test
   npm run lint
   ```
   *Expected outcome*: 0 test failures, 0 lint warnings/errors.
3. **Invalidation Conditions**:
   - Non-admin users are able to access any `/api/admin/tournaments` endpoint.
   - Approving an already-approved proposal creates duplicate `Tournament` documents.
   - Unauthenticated requests return anything other than 401.
   - `GET /proposed` returns non-pending proposals or unsorted results.
