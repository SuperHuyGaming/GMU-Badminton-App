# Phase 4 Investigation Report: Backend Endpoints & Client API Integration Conventions

**Investigator**: Explorer 2 (`teamwork_preview_explorer_m4_2`)  
**Project**: DMV Tournament Aggregation & Admin Approval System (Phase 4: Admin Dashboard UI)  
**Date**: 2026-10-03  
**Status**: Complete  

---

## Executive Summary

This report delivers the complete technical specifications and integration contracts for developing the **Phase 4 Admin Dashboard UI** (`TournamentApprovals.jsx`). It covers:
1. Exact endpoint signatures, HTTP methods, route paths, payload structures, status codes, and Mongoose schema definitions in `server/routes/adminTournaments.js` and `server/models/ProposedTournament.js`.
2. Client-side HTTP architecture in `client/src/utils/api.js` (`apiFetch`), token storage, automatic JWT injection, 401 token refresh mechanics, and error-handling behavior.
3. Client-side notification conventions via `react-hot-toast` (`<Toaster />`), toast dispatch methods, and standard styling.
4. Recommendations and architectural nuances (e.g., handling low confidence scoring `< 80`, split-screen payload mapping, and manual entry options).

---

## 1. Backend Route & Endpoint Specifications

All tournament admin routes are defined in `server/routes/adminTournaments.js` and mounted in `server/server.js` at base path:
```javascript
app.use("/api/admin/tournaments", adminTournamentsRoutes);
```

### Route Protection Middleware (Enforced on all routes)
Before any route handler executes, the router enforces two sequential middlewares:
1. `authMiddleware` (`server/middleware/auth.js`):
   - Reads `Authorization` header: `Bearer <jwt_token>`.
   - Verifies JWT against `JWT_SECRET`.
   - Sets `req.user = { id, userId, role, name, ... }`.
   - **401 Unauthorized**: `{ message: "No token, authorization denied" }` or `{ message: "Token is not valid" }`.
2. `adminMiddleware` (`server/middleware/auth.js`):
   - Verifies `req.user && req.user.role === "admin"`.
   - **403 Forbidden**: `{ message: "Access denied. Admins only." }`.

---

### Endpoint 1: Retrieve Pending Proposals
- **Route**: `GET /api/admin/tournaments/proposed`
- **Controller Action**: `ProposedTournament.find({ status: "pending" }).sort({ confidenceScore: -1 })`
- **URL Parameters**: None
- **Query Parameters**: None
- **Request Body**: None (GET)
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **Response Status Codes**:
  - `200 OK`: Query successful.
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: Authenticated user is not an admin.
  - `500 Internal Server Error`: Database query error.
- **Success Response Payload (`200 OK`)**:
  Array of `ProposedTournament` JSON documents sorted by `confidenceScore` descending:
  ```json
  [
    {
      "_id": "650000000000000000000010",
      "tournamentName": "GMU Fall Open 2026",
      "date": "2026-11-20T10:00:00.000Z",
      "location": "RAC Court 3",
      "entryFee": "$35",
      "registrationLink": "https://tournamentsoftware.com/gmu2026",
      "skillLevels": ["Open", "A", "B"],
      "registrationDeadline": "2026-11-15T23:59:59.000Z",
      "sourceUrl": "https://instagram.com/p/samplepost",
      "rawCaption": "Annual GMU Fall Open Championship! Register online...",
      "scrapedImageUrls": [
        "https://cdn.example.com/flyer1.png"
      ],
      "sourceLinks": [
        "https://linktr.ee/gmu_badminton"
      ],
      "confidenceScore": 88,
      "status": "pending",
      "createdAt": "2026-10-02T12:00:00.000Z",
      "updatedAt": "2026-10-02T12:00:00.000Z",
      "aiStructuredData": {
        "tournamentName": "GMU Fall Open 2026",
        "date": "2026-11-20T10:00:00.000Z",
        "location": "RAC Court 3",
        "entryFee": "$35",
        "registrationLink": "https://tournamentsoftware.com/gmu2026",
        "skillLevels": ["Open", "A", "B"],
        "registrationDeadline": "2026-11-15T23:59:59.000Z"
      },
      "rawScrapedData": {
        "rawCaption": "Annual GMU Fall Open Championship! Register online...",
        "scrapedImageUrls": ["https://cdn.example.com/flyer1.png"],
        "sourceLinks": ["https://linktr.ee/gmu_badminton"]
      },
      "id": "650000000000000000000010"
    }
  ]
  ```

---

### Endpoint 2: Approve Proposed Tournament
- **Route**: `POST /api/admin/tournaments/approve/:id`
- **URL Parameters**:
  - `id` (string, required): 24-character hexadecimal MongoDB ObjectId of the `ProposedTournament`.
- **Request Body**: None required
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **Internal Behavior & Critical Invariants**:
  1. Validates `id` format using `mongoose.isValidObjectId(id)`.
  2. Verifies proposal exists in DB and is not already approved (`status !== "approved"`).
  3. Creates and saves a new document in the `tournaments` collection (`Tournament` model) with:
     - `isOpenTournament: true` (**Strict Invariant**: Must be `true` for public feed & calendar rendering).
     - `tournamentName`: `proposed.tournamentName`
     - `eventLocation`: `proposed.location || "TBD"`
     - `hostUniversity`: `"Local Club"`
     - `startDate`: `proposed.date`
     - `endDate`: `proposed.date`
     - `registrationDeadline`: `proposed.registrationDeadline || proposed.date`
     - `registrationUrl`: `proposed.registrationLink || proposed.sourceLinks[0] || proposed.sourceUrl`
     - `flyerImageUrl`: `proposed.scrapedImageUrls[0] || ""`
     - `skillLevels`: `proposed.skillLevels || []`
     - `originalCaption`: `proposed.rawCaption || ""`
     - `rsvpCount`: `0`
     - `hasSentDeadlineWarning`: `false`
     - `createdAt`: `new Date()`
  4. Transitions `ProposedTournament`:
     - `status = "approved"`
     - `approvedAt = new Date()`
     - `approvedBy = req.user.id || req.user.userId`
     - `createdTournamentId = tournament._id`
  5. Emits real-time WebSocket event via Socket.IO: `io.emit("tournamentApproved", tournament)`.
- **Response Status Codes**:
  - `200 OK`: Proposal approved and tournament created.
  - `400 Bad Request`: Invalid ObjectId format OR proposal is already approved.
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal does not exist.
  - `500 Internal Server Error`: Error saving models or server fault.
- **Success Response Payload (`200 OK`)**:
  ```json
  {
    "message": "Tournament approved and published successfully",
    "tournament": {
      "_id": "650000000000000000000099",
      "tournamentName": "GMU Fall Open 2026",
      "eventLocation": "RAC Court 3",
      "hostUniversity": "Local Club",
      "startDate": "2026-11-20T10:00:00.000Z",
      "endDate": "2026-11-20T10:00:00.000Z",
      "registrationDeadline": "2026-11-15T23:59:59.000Z",
      "registrationUrl": "https://tournamentsoftware.com/gmu2026",
      "sourceUrl": "https://instagram.com/p/samplepost",
      "flyerImageUrl": "https://cdn.example.com/flyer1.png",
      "skillLevels": ["Open", "A", "B"],
      "originalCaption": "Annual GMU Fall Open Championship!",
      "isOpenTournament": true,
      "rsvpCount": 0,
      "hasSentDeadlineWarning": false,
      "createdAt": "2026-10-03T00:00:00.000Z"
    },
    "proposedTournament": {
      "_id": "650000000000000000000010",
      "status": "approved",
      "approvedAt": "2026-10-03T00:00:00.000Z",
      "approvedBy": "650000000000000000000001",
      "createdTournamentId": "650000000000000000000099"
    }
  }
  ```

---

### Endpoint 3: Reject Proposed Tournament
- **Route**: `POST /api/admin/tournaments/reject/:id`
- **URL Parameters**:
  - `id` (string, required): 24-character hexadecimal MongoDB ObjectId.
- **Request Body (Optional)**:
  ```json
  {
    "reason": "Duplicate tournament posting from last week"
  }
  ```
  *(Note: If `reason` is omitted or empty, server defaults to `"Rejected by admin"`. Provided strings are sanitized with `xss()` and sliced to 500 characters).*
- **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```
- **Internal Behavior**:
  1. Validates `id` format using `mongoose.isValidObjectId(id)`.
  2. Finds `ProposedTournament` by `id`.
  3. Updates `status = "rejected"`, `rejectedAt = new Date()`, `rejectionReason = reason`.
  4. Saves proposal document.
- **Response Status Codes**:
  - `200 OK`: Proposal rejected successfully.
  - `400 Bad Request`: Invalid ObjectId format.
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal does not exist.
  - `500 Internal Server Error`: Server error during rejection.
- **Success Response Payload (`200 OK`)**:
  ```json
  {
    "message": "Tournament proposal rejected",
    "proposedTournament": {
      "_id": "650000000000000000000010",
      "status": "rejected",
      "rejectedAt": "2026-10-03T00:00:00.000Z",
      "rejectionReason": "Duplicate tournament posting from last week"
    }
  }
  ```

---

### Endpoint 4: Edit AI Structured Data Before Approval
- **Route**: `PUT /api/admin/tournaments/:id`
- **URL Parameters**:
  - `id` (string, required): 24-character hexadecimal MongoDB ObjectId.
- **Request Body Schema**:
  The route supports either a **flat payload** or a payload containing a nested **`aiStructuredData`** object (it merges both).
  ```json
  {
    "tournamentName": "DMV Mid-Atlantic Open 2026",
    "date": "2026-12-05T09:00:00.000Z",
    "location": "EagleBank Arena, Fairfax VA",
    "entryFee": "$40",
    "registrationLink": "https://forms.gle/tournament-entry",
    "skillLevels": ["Open", "A", "B", "C"],
    "registrationDeadline": "2026-11-28T23:59:59.000Z",
    "confidenceScore": 95
  }
  ```
  *Or alternatively:*
  ```json
  {
    "aiStructuredData": {
      "tournamentName": "DMV Mid-Atlantic Open 2026",
      "date": "2026-12-05T09:00:00.000Z",
      "location": "EagleBank Arena, Fairfax VA",
      "entryFee": "$40",
      "registrationLink": "https://forms.gle/tournament-entry",
      "skillLevels": ["Open", "A", "B", "C"],
      "registrationDeadline": "2026-11-28T23:59:59.000Z"
    },
    "confidenceScore": 95
  }
  ```
- **Validation Rules & Field Sanitization**:
  - `tournamentName`: Must be a non-empty string. Stripped and XSS-sanitized. If empty, returns `400` (`"Tournament name cannot be empty."`).
  - `location`: Max 200 chars, defaults to `"TBD"` if empty. XSS-sanitized.
  - `entryFee`: Max 100 chars. XSS-sanitized.
  - `registrationLink`: String URL. XSS-sanitized.
  - `skillLevels`: Array of strings. Each element trimmed and XSS-sanitized.
  - `date`: Converted to `new Date(date)` (or `undefined` if empty).
  - `registrationDeadline`: Converted to `new Date(registrationDeadline)` (or `undefined` if empty).
  - `confidenceScore`: Must be a number between `0` and `100`. Returns `400` (`"Confidence score must be a number between 0 and 100."`) if out of bounds.
- **Response Status Codes**:
  - `200 OK`: Proposal updated successfully.
  - `400 Bad Request`: Validation failure (empty name, invalid ID, out-of-bounds confidenceScore, or Mongoose schema error).
  - `401 Unauthorized`: Missing or invalid JWT.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: Proposal does not exist.
  - `500 Internal Server Error`: Server error during save.
- **Success Response Payload (`200 OK`)**:
  ```json
  {
    "message": "Tournament proposal updated successfully",
    "proposedTournament": {
      "_id": "650000000000000000000010",
      "tournamentName": "DMV Mid-Atlantic Open 2026",
      "location": "EagleBank Arena, Fairfax VA",
      "entryFee": "$40",
      "registrationLink": "https://forms.gle/tournament-entry",
      "skillLevels": ["Open", "A", "B", "C"],
      "date": "2026-12-05T09:00:00.000Z",
      "registrationDeadline": "2026-11-28T23:59:59.000Z",
      "confidenceScore": 95,
      "status": "pending",
      "rawCaption": "...",
      "scrapedImageUrls": ["..."],
      "sourceLinks": ["..."],
      "sourceUrl": "...",
      "updatedAt": "2026-10-03T00:05:00.000Z"
    }
  }
  ```

---

## 2. `ProposedTournament` Schema Architecture

Defined in `server/models/ProposedTournament.js`.

### Field Specification Table

| Category | Field Name | Type | Constraints / Defaults | Description |
|:---|:---|:---|:---|:---|
| **Raw Scraped Data** | `rawCaption` | `String` | `default: ""` | Original OCR or caption text scraped from post/flyer |
| | `scrapedImageUrls` | `[String]` | `default: []` | Array of URLs pointing to flyer image assets |
| | `sourceLinks` | `[String]` | `default: []` | External URLs extracted from flyer or linktree |
| **AI Structured Data** | `tournamentName` | `String` | `required: true, trim: true` | AI extracted / verified tournament title |
| | `date` | `Date` | Optional | Start/event date of tournament |
| | `location` | `String` | `default: "TBD"` | Facility, venue, or address |
| | `entryFee` | `String` | `default: ""` | Cost/pricing string (e.g., "$35/entry") |
| | `registrationLink` | `String` | `default: ""` | Direct sign-up URL |
| | `skillLevels` | `[String]` | `default: []` | Divisions (e.g. `["Open", "A", "B"]`) |
| | `registrationDeadline` | `Date` | Optional | Registration deadline date |
| **Metadata** | `sourceUrl` | `String` | `required: true` | Origin link (e.g., Instagram post URL) |
| | `confidenceScore` | `Number` | `min: 0, max: 100, default: 0` | Gemini extraction confidence score (0-100) |
| | `status` | `String` | `enum: ["pending", "approved", "rejected"]`, `default: "pending"`, indexed | Review workflow status |
| **Lifecycle & Audit** | `approvedAt` | `Date` | Optional | Timestamp when approved |
| | `approvedBy` | `ObjectId` | `ref: "User"` | Admin user ID who approved |
| | `rejectedAt` | `Date` | Optional | Timestamp when rejected |
| | `rejectionReason` | `String` | Optional | Audit explanation for rejection |
| | `createdTournamentId` | `ObjectId` | `ref: "Tournament"` | Linked published `Tournament` document ID |
| **Timestamps** | `createdAt` | `Date` | Automatic (`timestamps: true`) | Creation date |
| | `updatedAt` | `Date` | Automatic (`timestamps: true`) | Last modification date |

### Schema Virtuals
The model defines two virtual properties with getters and setters:
1. `aiStructuredData`: Groups `tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, and `registrationDeadline`.
2. `rawScrapedData`: Groups `rawCaption`, `scrapedImageUrls`, and `sourceLinks`.
Because `toJSON: { virtuals: true }` and `toObject: { virtuals: true }` are enabled, both virtual sub-objects appear directly in JSON responses alongside the top-level schema fields.

---

## 3. Client-Side API Integration Conventions

### Primary Utility: `apiFetch` (`client/src/utils/api.js`)
The application does **NOT** use `axios`. All authenticated HTTP calls throughout the codebase use `apiFetch`.

```javascript
import apiFetch from "../utils/api";
```

### Key Behaviors of `apiFetch`

1. **Automatic Base URL Resolution**:
   - `let API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");`
   - In development, `API_URL` is typically empty string `""`, relying on Vite dev server proxying `/api` requests to backend port 5001.
   - If an absolute URL is specified without `http`, it prefixes `https://`.
2. **Automatic Authentication Header**:
   - Reads `localStorage.getItem("accessToken")`.
   - If present, injects `headers["Authorization"] = `Bearer ${token}``.
3. **Automatic Content-Type**:
   - Defaults `headers["Content-Type"] = "application/json"`.
   - If `options.body instanceof FormData`, automatically deletes `"Content-Type"` so the browser can calculate the boundary.
4. **401 Token Refresh Handling**:
   - If a request returns HTTP 401, `apiFetch` intercepts it and checks `localStorage.getItem("refreshToken")`.
   - Queues concurrent requests while calling `POST /api/auth/refreshtoken`.
   - On refresh success: Updates `accessToken` and `refreshToken` in `localStorage`, retries original request with new token.
   - On refresh failure: Clears storage (`accessToken`, `refreshToken`, `user`), redirects `window.location.href = "/auth"`, and throws `"Session expired, please log in again."`.
5. **CRITICAL: Automatic Non-OK Error Throwing**:
   - Lines 113-117 in `client/src/utils/api.js`:
     ```javascript
     if (!response.ok && response.status !== 401) {
         const errorData = await response.json().catch(() => ({}));
         throw new Error(errorData.message || `Request failed with status ${response.status}`);
     }
     ```
   - **Important**: Any non-2xx status code (e.g. 400, 403, 404, 500) will cause `apiFetch` to **throw an `Error`**.
   - Therefore, developers must wrap API calls in `try / catch` blocks. In the `catch (err)` block, `err.message` will contain the backend's error message (e.g., `"Tournament name cannot be empty."`).
   - If no error is thrown, the response is guaranteed to have `response.ok === true`. Callers then do `const data = await response.json();`.

### Standard Implementation Examples for Phase 4

```javascript
// 1. Fetching pending proposals
const fetchProposals = async () => {
    try {
        setLoading(true);
        const res = await apiFetch("/api/admin/tournaments/proposed");
        const data = await res.json();
        setProposals(data);
    } catch (err) {
        toast.error(err.message || "Failed to load proposals");
    } finally {
        setLoading(false);
    }
};

// 2. Approving a proposal
const handleApprove = async (id) => {
    try {
        setSubmitting(true);
        const res = await apiFetch(`/api/admin/tournaments/approve/${id}`, {
            method: "POST"
        });
        const data = await res.json();
        toast.success(data.message || "Tournament approved and published!");
        setProposals(prev => prev.filter(p => p._id !== id));
        setSelectedProposal(null);
    } catch (err) {
        toast.error(err.message || "Failed to approve tournament");
    } finally {
        setSubmitting(false);
    }
};

// 3. Rejecting a proposal
const handleReject = async (id, reason) => {
    try {
        setSubmitting(true);
        const res = await apiFetch(`/api/admin/tournaments/reject/${id}`, {
            method: "POST",
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        toast.success(data.message || "Tournament rejected");
        setProposals(prev => prev.filter(p => p._id !== id));
        setSelectedProposal(null);
    } catch (err) {
        toast.error(err.message || "Failed to reject tournament");
    } finally {
        setSubmitting(false);
    }
};

// 4. Updating AI Structured Data before approval
const handleSaveEdits = async (id, formData) => {
    try {
        setSaving(true);
        const res = await apiFetch(`/api/admin/tournaments/${id}`, {
            method: "PUT",
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        toast.success(data.message || "Tournament edits saved!");
        setProposals(prev => prev.map(p => p._id === id ? data.proposedTournament : p));
    } catch (err) {
        toast.error(err.message || "Failed to save edits");
    } finally {
        setSaving(false);
    }
};
```

---

## 4. Toast Notification Conventions

### Library Specification
The client standardizes on **`react-hot-toast`** (`^2.6.0`).
- The `<Toaster position="top-center" reverseOrder={false} />` component is already mounted globally in `client/src/App.jsx` (line 492).
- There is **no need** to mount additional `<Toaster>` or MUI `<Snackbar>` containers in individual pages.

### Dispatch Convention
Any component or hook can dispatch notifications directly:

```javascript
import { toast } from "react-hot-toast";

// Success:
toast.success("Tournament approved and published successfully!");

// Error:
toast.error(err.message || "Failed to approve tournament.");

// Optional Async Promise Toast:
await toast.promise(
    apiFetch(`/api/admin/tournaments/approve/${id}`, { method: "POST" }),
    {
        loading: "Approving tournament...",
        success: "Tournament approved!",
        error: (err) => err.message || "Failed to approve tournament"
    }
);
```

---

## 5. UI Layout, Routing, and Access Control Architecture

### Admin Route Guard
In `client/src/App.jsx`:
```javascript
const AdminRoute = ({ children }) => {
    const { user } = useAuth();
    if (!user || user.role !== "admin") return <Navigate to="/" replace />;
    return children;
};
```
- To register the new Admin Tournament Approvals page, add the route inside `<AnimatedRoutes>`:
  ```jsx
  <Route
      path="/admin/tournaments"
      element={
          <AdminRoute>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
                  <TournamentApprovals />
              </motion.div>
          </AdminRoute>
      }
  />
  ```

### Navigation Links
1. **Desktop Navbar** (`client/src/components/Navbar.jsx`, line 399):
   - Currently renders an `Admin Panel` button leading to `/admin` when `user && user.role === "admin"`.
   - A dropdown or separate button for `/admin/tournaments` (or a dedicated tab inside `/admin`) can link directly to the queue.
2. **Admin Hub** (`client/src/pages/Admin.jsx`):
   - An Admin navigation sub-header / tabs can be added linking `/admin` (Users & Spam) and `/admin/tournaments` (Tournament Approvals Queue).

---

## 6. Recommendations for Phase 4 UI Features

### 1. Confidence Score Highlighting (Requirement R2)
- Field: `proposal.confidenceScore` (0-100).
- Suggestion: Use MUI `<Chip>`:
  - `>= 80`: Green / `color="success"` (High confidence).
  - `60 - 79`: Amber / `color="warning"` (Moderate confidence; verify fields).
  - `< 60`: Red / `color="error"` (Low confidence; requires careful inspection).
- In the Split-Screen form, visually highlight any input field where the data was uncertain or fallback default was used (e.g., location defaulting to `"TBD"`).

### 2. Split-Screen Reviewer Layout (Requirement R3)
- Use a full-screen or `maxWidth="lg"` MUI `<Dialog>` (or 50/50 split container):
  - **Left Column (Raw Scraped Context)**:
    - Display flyer image (`scrapedImageUrls[0]`) with zoom / full-size preview.
    - Display `rawCaption` in a scrollable, styled `<Paper>` with monospace or clean text formatting.
    - Display source links (`sourceLinks` and `sourceUrl`) as clickable external chips/links.
  - **Right Column (Editable Form)**:
    - Form fields corresponding to `aiStructuredData`:
      - `tournamentName` (required TextField)
      - `date` (DateField / TextField type="date")
      - `location` (TextField)
      - `entryFee` (TextField)
      - `registrationLink` (TextField with "Test Link" button)
      - `skillLevels` (MUI Chip Autocomplete or comma-separated text)
      - `registrationDeadline` (DateField / TextField type="date")
      - `confidenceScore` (Slider or Number field 0-100)

### 3. Manual Tournament Creation (Requirement R4)
- Requirement R4 asks for: *"Provide a 'Manual Entry' button to open a blank form to create a tournament manually (without scraping)."*
- Backend note:
  - `server/routes/scrape.js` already provides `POST /api/scrape/submit-pending` (creates `Tournament` with `isOpenTournament: false`).
  - Alternatively, if manual entry should go into the admin approval queue first, a blank `ProposedTournament` could be submitted, OR a direct endpoint `POST /api/admin/tournaments/manual` can create a `Tournament` with `isOpenTournament: true` directly.
  - Recommendation for implementers: Create a "Manual Entry" modal dialog pre-filled with empty values that allows the admin to either publish directly or queue for review.

---

## Summary Checklist for Implementers

- [x] Base API route: `/api/admin/tournaments`
- [x] Fetch queue: `GET /api/admin/tournaments/proposed`
- [x] Approve: `POST /api/admin/tournaments/approve/:id`
- [x] Reject: `POST /api/admin/tournaments/reject/:id` with optional body `{ reason: "..." }`
- [x] Save Edits: `PUT /api/admin/tournaments/:id` with edited fields
- [x] Auth utility: Use `import apiFetch from "../../utils/api"` (handles JWT + refresh automatically)
- [x] Error handling: Catch thrown errors and display `err.message`
- [x] Toast notifications: Use `import { toast } from "react-hot-toast"` (`toast.success(...)`, `toast.error(...)`)
- [x] Route guard: Wrap in `<AdminRoute>` in `App.jsx`
