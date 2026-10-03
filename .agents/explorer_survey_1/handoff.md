# Handoff Report: Explorer 1 — Models, Schemas & Approval Mapping

## 1. Observation

### Existing Tournament Model & Usages
1. **`server/models/Tournament.js` (lines 1–28)**:
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

2. **Java Core Service Document Schema (`tournament-services/core-service/src/main/java/com/badminton/core/domain/Tournament.java`, lines 21–50)**:
   - Uses `@Document(collection = "tournaments")`.
   - Contains fields: `id`, `tournamentName`, `hostUniversity`, `eventLocation`, `location` (`GeoJsonPoint` indexed `2dsphere`), `registrationDeadline`, `rideFormDeadline`, `isOpenTournament`, `registrationUrl`, `sourceUrl`, `flyerImageUrl`, `localizedDescriptions`, `rsvpCount`, `createdAt`.

3. **Public Feed Visibility Filter (`tournament-services/core-service/src/main/java/com/badminton/core/service/TournamentService.java`, line 94)**:
   ```java
   Criteria criteria = Criteria.where("registrationDeadline").gte(now);
   if (openOnly) {
       criteria = criteria.and("isOpenTournament").is(true);
   }
   ```
   Public tournament feed requests require `isOpenTournament: true` to appear in results.

4. **Quarantine Pattern in Existing Scrapers (`server/routes/scrape.js`, line 159)**:
   ```javascript
   isOpenTournament: false, // Set to false so it requires Admin approval to show on main feed
   ```
   When user crowdsourced tournaments were submitted, `isOpenTournament` was explicitly set to `false`.

5. **Client Rendering Fields (`client/src/pages/Tournaments.jsx`, lines 162–215)**:
   - Frontend consumes: `tournamentName`, `eventLocation`, `startDate`, `endDate`, `flyerImageUrl`, `originalCaption`, `registrationUrl`.

6. **Current Test & Lint Status (`server/`)**:
   - `npm test`: 9 test suites passed, 115 tests passed, 8 skipped.
   - `npm run lint`: 0 errors.

---

## 2. Logic Chain

1. **Need for `ProposedTournament` Collection**:
   - *From Observation 1 and 4*: In `server/routes/scrape.js`, raw unapproved items were directly inserted into `Tournament` with `isOpenTournament: false`.
   - *Inference*: Per Requirement R1, separating unverified scraped data into a distinct `ProposedTournament` model prevents polluting the core `tournaments` collection shared with Spring Boot and avoids accidental public exposure.
2. **Schema Design for `ProposedTournament.js`**:
   - *From Requirement R1*: Fields must include Raw Scraped Data (`rawCaption`, `scrapedImageUrls`, `sourceLinks`), AI Structured Data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`), and Metadata (`sourceUrl`, `confidenceScore` 0–100, `status` enum: `['pending', 'approved', 'rejected']`).
   - *From Observation 1 & Existing Models*: Models in `server/models/` (`Tournament.js`, `DiscoveryQueue.js`, `User.js`) use top-level fields for fast MongoDB indexing and querying.
   - *Inference*: A hybrid Mongoose schema having top-level fields plus virtual getters/setters (`aiStructuredData` and `rawScrapedData`) provides optimal database indexing (e.g., compound index `{ status: 1, confidenceScore: -1 }`) while allowing APIs and tests to interact with either flat or nested structures transparently.
3. **Data Type Selection**:
   - `confidenceScore`: Must enforce Mongoose validation `min: 0, max: 100` and default to `0`.
   - `status`: Must enforce `enum: ['pending', 'approved', 'rejected']` with default `'pending'`.
   - `entryFee`: Must be `String` because flyers contain non-numeric fee descriptions (`"$25"`, `"Free"`, `"$35/singles"`).
   - `skillLevels`: Must be `[String]`.
4. **Approval Mapping Invariant (`POST /approve/:id`)**:
   - *From Observation 3*: Java's `TournamentService.java` explicitly queries `isOpenTournament: true` for the public feed.
   - *Inference*: When converting a `ProposedTournament` into `Tournament`, `isOpenTournament` **must be set to `true`**. Setting it to `false` or omitting it will prevent the tournament from displaying on `Tournaments.jsx`.
   - *From Observation 1 and Client Needs*: `startDate` and `endDate` in `Tournament` map to `proposed.date`. `registrationUrl` maps to `proposed.registrationLink` (fallback `proposed.sourceLinks[0]`). `flyerImageUrl` maps to `proposed.scrapedImageUrls[0]`. `originalCaption` maps to `proposed.rawCaption`.
5. **Concurrency & State Transition**:
   - Approving must transition `proposed.status = 'approved'`, record `approvedAt` and `approvedBy`, and store `createdTournamentId = newTournament._id`.
   - Re-approving an already approved proposal must be rejected with HTTP 400.

---

## 3. Caveats

- **No Caveats** regarding the schema analysis or approval mapping.
- *Assumption*: If `ProposedTournament.date` contains a single date, both `startDate` and `endDate` in `Tournament.js` receive this date.
- *External Dependency*: Spring Boot `Tournament.java` has a `location` field (`GeoJsonPoint`). Spring Boot's `GeocodingService` generates coordinates when ingesting via Java, but Node's existing `Tournament.js` does not require `location` coordinates for calendar or display. If geospatial proximity queries are needed later, geocoding coordinates can be added.

---

## 4. Conclusion

1. **`server/models/ProposedTournament.js` Schema Specification**:
   Implement the model with:
   - Raw Scraped Data: `rawCaption: String`, `scrapedImageUrls: [String]`, `sourceLinks: [String]`.
   - AI Structured Data: `tournamentName: { type: String, required: true, trim: true }`, `date: Date`, `location: { type: String, default: "TBD" }`, `entryFee: String`, `registrationLink: String`, `skillLevels: [String]`, `registrationDeadline: Date`.
   - Metadata: `sourceUrl: { type: String, required: true }`, `confidenceScore: { type: Number, min: 0, max: 100, default: 0 }`, `status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }`.
   - Audit / Tracking: `approvedAt: Date`, `approvedBy: ObjectId`, `rejectedAt: Date`, `rejectionReason: String`, `createdTournamentId: ObjectId`.
   - Compound index: `{ status: 1, confidenceScore: -1 }`.
   - Virtuals: `aiStructuredData` and `rawScrapedData` for structured access and mutation.
2. **Approval Field Mapping**:
   When `POST /api/admin/tournaments/approve/:id` executes:
   - `tournamentName` ← `proposed.tournamentName`
   - `eventLocation` ← `proposed.location || "TBD"`
   - `hostUniversity` ← `"Local Club"`
   - `startDate` ← `proposed.date`
   - `endDate` ← `proposed.date`
   - `registrationDeadline` ← `proposed.registrationDeadline || proposed.date`
   - `registrationUrl` ← `proposed.registrationLink || proposed.sourceLinks[0] || proposed.sourceUrl`
   - `sourceUrl` ← `proposed.sourceUrl`
   - `flyerImageUrl` ← `proposed.scrapedImageUrls[0] || ""`
   - `skillLevels` ← `proposed.skillLevels || []`
   - `originalCaption` ← `proposed.rawCaption || ""`
   - `isOpenTournament` ← **`true`** (Mandatory invariant)
   - `rsvpCount` ← `0`
   - `hasSentDeadlineWarning` ← `false`
   - `createdAt` ← `new Date()`
   - `proposed.status = "approved"`
   - `proposed.createdTournamentId = newTournament._id`

---

## 5. Verification Method

### How to Independently Verify

1. **Verify Existing Models & Dependencies**:
   - Inspect `server/models/Tournament.js`:
     ```powershell
     cat "server/models/Tournament.js"
     ```
   - Inspect Java backend query in `tournament-services/core-service/src/main/java/com/badminton/core/service/TournamentService.java`:
     ```powershell
     cat "tournament-services/core-service/src/main/java/com/badminton/core/service/TournamentService.java"
     ```
   - Verify existing test suite baseline:
     ```powershell
     cd server; npm test
     ```
   - Verify existing lint baseline:
     ```powershell
     cd server; npm run lint
     ```

2. **Validation Commands for Implementation Phase**:
   - Once `ProposedTournament.js` is written, run:
     ```powershell
     cd server; node -e "const M = require('./models/ProposedTournament'); console.log('Loaded:', M.modelName);"
     ```
   - Test validation errors (e.g. invalid status or confidenceScore > 100):
     ```powershell
     cd server; node -e "const M = require('./models/ProposedTournament'); const doc = new M({ confidenceScore: 105, status: 'invalid' }); doc.validate().catch(e => console.log('Validation caught:', e.message));"
     ```

3. **Invalidation Conditions**:
   - If `isOpenTournament` is set to `false` upon approval, `Tournaments.jsx` and `TournamentService.java` will fail to return approved tournaments.
   - If `confidenceScore` allows values outside 0–100, sorting and reliability scoring are compromised.
   - If `ProposedTournament` lacks the compound index `{ status: 1, confidenceScore: -1 }`, the `/proposed` endpoint will perform unindexed in-memory sorts on large datasets.
