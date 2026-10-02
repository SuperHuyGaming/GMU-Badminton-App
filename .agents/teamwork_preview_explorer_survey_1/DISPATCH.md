# DISPATCH — Explorer Survey 1 (Backend)

## Objective
Investigate backend architecture, models, routes, and socket setup relevant to the Facebook-style friend request system.

## Working Directory
`D:\GMU Fall 2026\GMU-Badminton-App\.agents\teamwork_preview_explorer_survey_1`

## Inputs
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md`
- `server/` directory: check `server/models/`, `server/routes/`, `server/controllers/`, `server/server.js`, `server/socket/`, etc.

## Tasks
1. Read `ORIGINAL_REQUEST.md` section 2026-09-30T01:04:29Z.
2. Investigate MongoDB models (User, Friendship, etc.) - inspect schema definition for `friends`, `friendRequests`, and how friendships are modeled.
3. Investigate `/api/matchmaking/discover` route & controller: how is discovery query currently implemented? How should it be modified to exclude existing friends and pending requests? How should `friendshipStatus` ("none", "pending", "friends") be computed?
4. Investigate `/api/friends/` routes: what endpoints currently exist (e.g. `/request`, `/accept`, `/decline`, `/list`)? How are friendRequests stored (user IDs, objects with status, timestamps)?
5. Investigate Socket.io server implementation: how are sockets connected, how are user-to-socket mappings tracked (e.g., user room, socket map), and what events are currently emitted/listened to?
6. Identify required changes and edge cases (e.g., mutual requests, race conditions, self-addition, duplicate requests).
7. Output a structured report to `analysis.md` and `handoff.md` in your working directory.
