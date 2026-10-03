# Technical Analysis: Tournament Models, Schemas & Approval Mapping

## 1. Executive Summary
This report provides a comprehensive technical investigation of Mongoose models in `server/models/`, specifically `Tournament.js`, and formulates the schema specification and approval mapping for `ProposedTournament.js` for Phase 3 (Core Backend: DMV Tournament Aggregation & Admin Approval System).

The primary objectives achieved:
1. Audited existing `Tournament.js` (and its backing MongoDB collection `tournaments` shared with Spring Boot `Tournament.java`), identifying all fields, types, and invariants.
2. Designed a robust Mongoose schema specification for `server/models/ProposedTournament.js` covering Raw Scraped Data, AI Structured Data, and Metadata.
3. Formulated the exact, type-safe field mapping and lifecycle transitions for `POST /api/admin/tournaments/approve/:id`.
4. Identified crucial schema pitfalls, race conditions, indexing strategies, and cross-service constraints (notably the `isOpenTournament: true` visibility invariant).

---

## 2. Audit of Existing `Tournament.js` & MongoDB Ecosystem

### 2.1 File Location & Mongoose Definition
- **File**: `server/models/Tournament.js` (lines 1–28)
```javascript
const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
    // We only need a subset of fields for calendar generation
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
}, { collection: "tournaments" }); // Match the Java service collection

module.exports = mongoose.model("Tournament", tournamentSchema);
```

### 2.2 Cross-Service Compatibility: Java Spring Boot `Tournament.java`
- **File**: `tournament-services/core-service/src/main/java/com/badminton/core/domain/Tournament.java`
- The collection name is explicitly `"tournaments"`.
- Spring Boot fields:
  - `id`: String (maps to MongoDB `_id`)
  - `tournamentName`: String
  - `hostUniversity`: String
  - `eventLocation`: String
  - `location`: GeoJsonPoint (GeoSpatialIndexed `2dsphere`, `[longitude, latitude]`)
  - `registrationDeadline`: Instant (Date)
  - `rideFormDeadline`: Instant (Date)
  - `isOpenTournament`: Boolean
  - `registrationUrl`: String
  - `sourceUrl`: String
  - `flyerImageUrl`: String
  - `localizedDescriptions`: Map<String, String>
  - `rsvpCount`: Integer (default 0)
  - `createdAt`: Instant (Date)

### 2.3 Existing System Usages of `Tournament`
1. **Feed Querying** (`TournamentService.java` lines 86–136):
   - Queries `tournaments` where `registrationDeadline >= now`.
   - When `openOnly=true`, filters by `isOpenTournament: true`.
2. **ICS Calendar Export** (`server/routes/calendar.js` lines 40–83):
   - Reads `t.tournamentName`, `t.registrationDeadline`, `t.hostUniversity`, `t.eventLocation`, `t.registrationUrl`, `t.sourceUrl`.
3. **Deadline Notifications** (`server/utils/cronJobs.js` lines 93–120):
   - Queries `registrationDeadline: { $gte: now, $lte: in48Hours }`, `hasSentDeadlineWarning: { $ne: true }`.
   - Updates `hasSentDeadlineWarning: true`.
4. **Scraper / Hunter Pipelines** (`server/routes/scrape.js`, `server/utils/autonomousHunter.js`, `server/utils/instagramScraper.js`):
   - Sets `isOpenTournament: false` for crowdsourced or pending entries requiring admin approval.
   - Sets `isOpenTournament: true` for pre-verified club posts.

---

## 3. Proposed Schema Specification: `ProposedTournament.js`

### 3.1 Architectural Schema Design Analysis
Requirement R1 specifies:
- **Raw Scraped Data**: `rawCaption`, `scrapedImageUrls`, `sourceLinks`
- **AI Structured Data**: `tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`
- **Metadata**: `sourceUrl`, `confidenceScore` (0–100), `status` ('pending' | 'approved' | 'rejected')

Requirement R2 specifies:
- `GET /proposed`: Returns all 'pending' ProposedTournaments, sorted by `confidenceScore` (descending).
- `PUT /:id`: Allows an admin to manually edit the AI Structured Data before approval.

#### Design Pattern Selection: Hybrid Architecture (Top-Level Fields + Virtual Grouping)
In MongoDB/Mongoose:
- If fields are nested (e.g. `metadata.confidenceScore`), queries require `sort({ "metadata.confidenceScore": -1 })` and filters require `find({ "metadata.status": "pending" })`.
- If fields are top-level, queries are cleaner: `find({ status: "pending" }).sort({ confidenceScore: -1 })`.
- Furthermore, all other Mongoose models in `server/models/` (`Tournament.js`, `DiscoveryQueue.js`, `Post.js`, `User.js`, `EquipmentListing.js`) use top-level fields.
- **Optimal Solution**: Define top-level schema fields for direct database querying and indexing, while providing Mongoose virtual getters/setters for `aiStructuredData` and `rawScrapedData`. This provides 100% compatibility whether a caller or test sends/expects flat or nested objects!

### 3.2 Complete Schema Code for `server/models/ProposedTournament.js`

```javascript
const mongoose = require("mongoose");

const proposedTournamentSchema = new mongoose.Schema({
    // ==========================================
    // 1. Raw Scraped Data
    // ==========================================
    rawCaption: {
        type: String,
        default: ""
    },
    scrapedImageUrls: {
        type: [String],
        default: []
    },
    sourceLinks: {
        type: [String],
        default: []
    },

    // ==========================================
    // 2. AI Structured Data
    // ==========================================
    tournamentName: {
        type: String,
        required: [true, "Tournament name is required."],
        trim: true,
        maxlength: [200, "Tournament name cannot exceed 200 characters."]
    },
    date: {
        type: Date,
        default: null
    },
    location: {
        type: String,
        trim: true,
        default: "TBD"
    },
    entryFee: {
        type: String,
        trim: true,
        default: ""
    },
    registrationLink: {
        type: String,
        trim: true,
        default: ""
    },
    skillLevels: {
        type: [String],
        default: []
    },
    registrationDeadline: {
        type: Date,
        default: null
    },

    // ==========================================
    // 3. Metadata
    // ==========================================
    sourceUrl: {
        type: String,
        required: [true, "Source URL is required."],
        trim: true
    },
    confidenceScore: {
        type: Number,
        min: [0, "Confidence score cannot be less than 0."],
        max: [100, "Confidence score cannot exceed 100."],
        default: 0
    },
    status: {
        type: String,
        enum: {
            values: ["pending", "approved", "rejected"],
            message: "Status must be either 'pending', 'approved', or 'rejected'."
        },
        default: "pending",
        index: true
    },

    // ==========================================
    // 4. Audit & Lifecycle Tracking
    // ==========================================
    approvedAt: {
        type: Date
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: ""
    },
    createdTournamentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tournament"
    }
}, {
    timestamps: true,
    collection: "proposed_tournaments",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound Index: Essential for GET /proposed (pending items sorted by confidenceScore DESC)
proposedTournamentSchema.index({ status: 1, confidenceScore: -1 });

// Index for sourceUrl lookup / deduplication
proposedTournamentSchema.index({ sourceUrl: 1 });

// ==========================================
// Virtuals for Structured Grouping
// ==========================================
proposedTournamentSchema.virtual("aiStructuredData").get(function() {
    return {
        tournamentName: this.tournamentName,
        date: this.date,
        location: this.location,
        entryFee: this.entryFee,
        registrationLink: this.registrationLink,
        skillLevels: this.skillLevels,
        registrationDeadline: this.registrationDeadline
    };
}).set(function(data) {
    if (!data || typeof data !== "object") return;
    if (data.tournamentName !== undefined) this.tournamentName = data.tournamentName;
    if (data.date !== undefined) this.date = data.date;
    if (data.location !== undefined) this.location = data.location;
    if (data.entryFee !== undefined) this.entryFee = data.entryFee;
    if (data.registrationLink !== undefined) this.registrationLink = data.registrationLink;
    if (data.skillLevels !== undefined) this.skillLevels = data.skillLevels;
    if (data.registrationDeadline !== undefined) this.registrationDeadline = data.registrationDeadline;
});

proposedTournamentSchema.virtual("rawScrapedData").get(function() {
    return {
        rawCaption: this.rawCaption,
        scrapedImageUrls: this.scrapedImageUrls,
        sourceLinks: this.sourceLinks
    };
});

module.exports = mongoose.model("ProposedTournament", proposedTournamentSchema);
```

---

## 4. Field Mapping Specification for `POST /approve/:id`

### 4.1 Detailed Mapping Table

| `Tournament.js` Target Field | Source from `ProposedTournament` | Data Type | Default / Fallback Logic |
|---|---|---|---|
| `tournamentName` | `proposed.tournamentName` | `String` | Required; sanitized; trimmed. |
| `eventLocation` | `proposed.location` | `String` | Fallback: `"TBD"` or `"DMV Area"`. |
| `hostUniversity` | Inferred or default | `String` | If not extracted from caption/url, default `"Local Club"`. |
| `startDate` | `proposed.date` | `Date` | If null, fallback to `proposed.registrationDeadline` or `null`. |
| `endDate` | `proposed.date` | `Date` | If single date provided, `endDate = startDate`. |
| `registrationDeadline` | `proposed.registrationDeadline` | `Date` | If missing, fallback to `proposed.date` or `null`. |
| `registrationUrl` | `proposed.registrationLink` | `String` | Fallback to `proposed.sourceLinks[0]` or `proposed.sourceUrl`. |
| `sourceUrl` | `proposed.sourceUrl` | `String` | Direct assignment. |
| `instagramPostUrl` | `proposed.sourceUrl` | `String` | Set if `sourceUrl` contains `"instagram.com"`, else `""`. |
| `flyerImageUrl` | `proposed.scrapedImageUrls[0]` | `String` | First scraped image URL, or `""`. |
| `skillLevels` | `proposed.skillLevels` | `[String]` | Array of strings (e.g. `["A", "B", "C", "D"]`). |
| `originalCaption` | `proposed.rawCaption` | `String` | Full raw caption. |
| `isOpenTournament` | `true` | `Boolean` | **INVARIANT: MUST BE TRUE**. Enables public visibility on frontend & Java core service. |
| `rsvpCount` | `0` | `Number` | Initial RSVP count = 0. |
| `hasSentDeadlineWarning`| `false` | `Boolean` | Initial false so reminder cron can evaluate it. |
| `createdAt` | `new Date()` | `Date` | Current timestamp. |

### 4.2 Lifecycle Transition Logic (Approval Execution)
```javascript
// Step 1: Atomic state check to prevent race conditions
const proposed = await ProposedTournament.findById(id);
if (!proposed) {
    return res.status(404).json({ message: "Proposed tournament not found." });
}
if (proposed.status === "approved") {
    return res.status(400).json({ message: "Proposed tournament has already been approved." });
}

// Step 2: Construct and save Tournament in 'tournaments' collection
const tournamentData = {
    tournamentName: proposed.tournamentName,
    eventLocation: proposed.location || "TBD",
    hostUniversity: "Local Club",
    startDate: proposed.date || null,
    endDate: proposed.date || null,
    registrationDeadline: proposed.registrationDeadline || proposed.date || null,
    registrationUrl: proposed.registrationLink || (proposed.sourceLinks && proposed.sourceLinks[0]) || proposed.sourceUrl,
    sourceUrl: proposed.sourceUrl,
    instagramPostUrl: proposed.sourceUrl.includes("instagram.com") ? proposed.sourceUrl : "",
    flyerImageUrl: (proposed.scrapedImageUrls && proposed.scrapedImageUrls.length > 0) ? proposed.scrapedImageUrls[0] : "",
    skillLevels: proposed.skillLevels || [],
    originalCaption: proposed.rawCaption || "",
    isOpenTournament: true, // CRITICAL: publishes to feed
    rsvpCount: 0,
    hasSentDeadlineWarning: false,
    createdAt: new Date()
};

const newTournament = new Tournament(tournamentData);
await newTournament.save();

// Step 3: Transition ProposedTournament status to 'approved' and link created tournament
proposed.status = "approved";
proposed.approvedAt = new Date();
proposed.approvedBy = req.user.id;
proposed.createdTournamentId = newTournament._id;
await proposed.save();
```

---

## 5. Potential Pitfalls, Validations & Indexing Considerations

### 5.1 The `isOpenTournament` Public Visibility Invariant
- **Observation**: In `tournament-services/core-service/src/main/java/com/badminton/core/service/TournamentService.java` line 94, public feed queries apply `Criteria.where("isOpenTournament").is(true)`. In `server/routes/scrape.js` line 159, pending user submissions are quarantined with `isOpenTournament: false`.
- **Pitfall**: If the approval handler omits `isOpenTournament: true` or defaults to false, the newly created tournament will be invisible to users in the frontend tournaments list (`Tournaments.jsx`).
- **Mitigation**: Explicitly assert `isOpenTournament: true` upon approval.

### 5.2 Concurrency & Idempotent Approvals
- **Pitfall**: Multiple admin clicks or concurrent API calls could generate duplicate documents in `tournaments`.
- **Mitigation**:
  1. Check `if (proposed.status === 'approved') return res.status(400)`.
  2. Maintain `createdTournamentId` on `ProposedTournament` for traceability and deduplication.

### 5.3 Entry Fee Data Type Flexibility
- **Observation**: Scraped flyers express entry fees in diverse formats (`"$25"`, `"$35/singles, $50/doubles"`, `"Free"`, `"TBD"`).
- **Pitfall**: Using a strict `Number` type would cause Mongoose casting errors on non-numeric strings or strip fee nuances.
- **Mitigation**: Store `entryFee` as `String` with trimming.

### 5.4 Database Indexing
- The admin dashboard queue repeatedly calls:
  `GET /api/admin/tournaments/proposed` -> `ProposedTournament.find({ status: "pending" }).sort({ confidenceScore: -1 })`.
- **Required Index**: Compound index `{ status: 1, confidenceScore: -1 }`. Without this index, large queues would require in-memory sorting.

### 5.5 Input Sanitization & Admin Edits (`PUT /:id`)
- Admins can edit fields before approval.
- All strings must be sanitized using `xss()` and trimmed.
- `confidenceScore` must be bounded by `[0, 100]`.
- Date inputs should be validated against `isNaN(new Date(val).getTime())`.
