# Original User Request

## 2026-09-29T18:34:04Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Standard full team

Implement working "Add Friend" buttons with proper UI feedback, fix the styling mismatch on the Matchmaking search bar, and remove the redundant "Players" tab from the navigation bar. The implementation must follow our standard PR workflow (feature branch → pull request → QA validation → merge).

Working directory: ~/teamwork_projects/matchmaking_ui_polish
Integrity mode: development

## Verification Resources
- PR Workflow rules: `.agents/rules/pr_workflow.md`

## Requirements

### R1. Implement "Add Friend" Functionality
Integrate the "Add Friend" buttons on the Matchmaking player cards with the existing backend friend API. When clicked, the button must display a loading spinner, then transition to a disabled "Request Sent" state upon success.

### R2. Refine Search Bar Styling
Update the search bar in the Matchmaking view so its background is slightly lighter and translucent, ensuring it looks like a distinct input box against the dark theme background.

### R3. Remove "Players" Tab
Remove the "Players" navigation link from the top header Navbar, as the global search bar renders it redundant.

### R4. Execute PR Workflow
Follow the project's standard PR workflow by creating a feature branch, committing all changes, pushing, and invoking the QA Engineer subagent for autonomous testing.

## Acceptance Criteria

### Automated Verification
- [ ] `npm run lint` passes with 0 errors in the `client/` directory.
- [ ] `npm test` passes in the `client/` directory without breaking existing Navbar or Search tests.

### Agent-as-Judge Verification
- [ ] The "Add Friend" button successfully triggers an API request and visually updates to "Request Sent" (disabled).
- [ ] The Matchmaking search bar has a distinct translucent background fill.
- [ ] The "Players" tab is completely removed from the header navigation.
- [ ] A feature branch was created, and the QA Engineer subagent was invoked to review it.

## 2026-09-30T01:04:29Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Standard full team

Implement a complete, Facebook-style friend request system. This includes dynamic frontend button states, optimistic UI rendering, real-time socket notifications, exclusion of pending/existing friends from the discovery feed, and backend accept/decline handlers. The implementation must follow our standard PR workflow (feature branch → pull request → QA validation → merge).

Working directory: ~/teamwork_projects/friend_system_overhaul
Integrity mode: development

## Verification Resources
- PR Workflow rules: `.agents/rules/pr_workflow.md`

## Requirements

### R1. Backend Hydration & Exclusion
Update the `/api/matchmaking/discover` endpoint to calculate and return a `friendshipStatus` ("none", "pending", "friends") for each player. Modify the MongoDB query to completely exclude players who are already friends or have a pending request.

### R2. Dynamic FriendActionButton Component
Create a reusable `<FriendActionButton>` component used in `Matchmaking.jsx` and `Profile.jsx` that conditionally renders "Add Friend", "Request Sent", or "Friends" based on the `friendshipStatus`. It must use optimistic UI rendering (change state instantly before the API resolves).

### R3. Accept/Decline Handlers & Socket Notifications
Implement `/api/friends/accept` and `/api/friends/decline` backend routes to safely mutate the `friends` and `friendRequests` arrays. Ensure that when a request is sent or accepted, a Socket.io event is emitted to update the recipient's UI in real-time.

### R4. Execute PR Workflow
Follow the project's standard PR workflow by creating a feature branch, committing all changes, pushing, and invoking the QA Engineer subagent for autonomous testing.

## Acceptance Criteria

### Automated Verification
- [ ] `npm test` passes in both the `client/` and `server/` directories, including the newly added matchmaking tests.
- [ ] `npm run lint` passes with 0 errors.

### Agent-as-Judge Verification
- [ ] When User A sends a request to User B, User B is immediately filtered out of User A's discovery feed upon refresh.
- [ ] User B receives a real-time socket notification when the request is sent.
- [ ] The reusable `<FriendActionButton>` correctly handles optimistic state updates and error rollbacks.
- [ ] A feature branch was created, and the QA Engineer subagent was invoked to review it.

## 2026-10-02T23:38:06Z

# Teamwork Project Prompt

> Goal: Implement Phase 3 (Core Backend) of the DMV Tournament Aggregation & Admin Approval System
> Requested team: Backend / API Specialists

Implement the backend foundation for the Tournament Approval system. We need to store scraped tournament data, provide an admin queue for review, and expose endpoints to approve/reject them.

Working directory: `server/`
Integrity mode: development

## Requirements

### R1. ProposedTournament Model
Create `server/models/ProposedTournament.js` using Mongoose. It should include:
- Raw Scraped Data (`rawCaption`, `scrapedImageUrls`, `sourceLinks`)
- AI Structured Data (`tournamentName`, `date`, `location`, `entryFee`, `registrationLink`, `skillLevels`, `registrationDeadline`)
- Metadata (`sourceUrl`, `confidenceScore` 0-100, `status` enum: ['pending', 'approved', 'rejected'])

### R2. Admin API Routes
Create `server/routes/adminTournaments.js` and mount it in `server/server.js` at `/api/admin/tournaments`.
- `GET /proposed`: Returns all 'pending' ProposedTournaments, sorted by confidenceScore (descending).
- `POST /approve/:id`: Finds a ProposedTournament, creates a new entry in `Tournament.js` (existing model), and marks the proposal as 'approved'.
- `POST /reject/:id`: Marks the ProposedTournament as 'rejected'.
- `PUT /:id`: Allows an admin to manually edit the AI Structured Data before approval.

### R3. Authentication & Security
Ensure all `/api/admin/tournaments` routes use `authMiddleware` AND verify that `req.user.role === 'admin'`.

### R4. Kafka Consumer (Optional/Stub)
In `server/utils/kafkaConsumer.js` (if it exists), add a stub case for the `tournament-scraping` topic that inserts a message into the `ProposedTournament` collection. If it doesn't exist, just document where the consumer should be added.

## Acceptance Criteria
- [ ] The `ProposedTournament` model is created and matches the schema requirements.
- [ ] The `/api/admin/tournaments` routes are fully implemented and protected.
- [ ] A feature branch was already created (`feature/tournament-admin-approval`), so just commit your work to it.
- [ ] Run `npm run lint` and `npm test` in the `server/` directory to ensure no regressions.

