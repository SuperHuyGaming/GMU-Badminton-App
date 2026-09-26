# Full Stack Engineer Master Plan


## Phase 1: Foundation & Setup
**1. **Matchmaking Discovery UI & API:** Build a list-based UI allowing users to find local players matching their exact `searchRadius`, `skillLevel`, and `preferredPlay`, backed by a new REST endpoint.**

**2. **Real-Time Forum Updates:** Connect `Forum.jsx` to the existing Spring Boot WebSocket broker to stream new posts and comments instantly without hard page refreshes.**

**3. **Match Score Verification Modal:** Create an interface where Player A can report a match score. Player B receives an in-app prompt to "Accept" or "Dispute" before the database saves it.**


## Phase 2: Core Implementation
**4. **User Badges & Gamification:** Implement backend logic to automatically award badges (e.g., "Early Bird", "5-Win Streak") and build the React UI to display these SVG icons on player profiles.**

**5. **In-App Direct Messaging:** Build a persistent chat window using React Context and STOMP over WebSockets for secure 1-on-1 player communication.**

**6. **Tournament Bracket Generator:** Create a recursive UI component that visually maps out a 16-player knockout bracket, alongside backend logic to shuffle seeds.**


## Phase 3: Refinement & Advanced Features
**7. **Notification Center:** Add a bell icon with a dropdown UI in the navigation bar, wired to a new `Notification` MongoDB collection.**

**8. **Friend / Follow System:** Implement a graph-like following system allowing users to subscribe to their friends' match activity and forum posts.**

**9. **Equipment Marketplace:** Build CRUD (Create, Read, Update, Delete) pages for users to list used rackets and shoes for sale to local players.**


## Phase 4: Optimization & Polish
**10. **Dynamic Activity Feed:** Create a unified homepage feed that chronologically interleaves forum posts, verified match results, and new marketplace listings.**

