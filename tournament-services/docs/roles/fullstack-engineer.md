# Fullstack Engineer: Role Guide & Responsibilities

## Mission Overview
As a **Fullstack Engineer** on Badminton Tournament Finder, you are the adhesive that binds our distributed event-driven microservices to a fluid, responsive client experience. You understand how data flows end-to-end—from an Instagram scraping trigger to a React component rendering with optimistic updates.

---

## Primary Tech Stack
- **Frontend**: React 18, TypeScript, Material-UI (MUI v6), `@stomp/stompjs`, `sockjs-client`, `leaflet`.
- **Backend Core**: Java 25 LTS, Spring Boot 3.3, Spring Data MongoDB Reactive, Spring Cloud Gateway WebFlux.
- **Data Ingestion**: Python 3.12, FastAPI, Celery, Redis.
- **Orchestration**: Docker Compose, Taskfile.

---

## Core Responsibilities

### 1. End-to-End Real-Time Data Flow
- Ensure full-duplex communication over STOMP WebSockets between Spring Boot's `SimpMessagingTemplate` and the React frontend's `useTournamentWebSocket` hook.
- Implement SockJS fallback mechanisms for clients on networks restricting raw WebSocket connections.

### 2. Optimistic UI Mutations
- Implement and maintain optimistic UI workflows for time-critical actions (e.g., tournament RSVPs, carpool seat claims).
- Guarantee that when a server responds with an error (HTTP 400/409/500), the UI gracefully rolls back to its prior state with clear user feedback via MUI `Snackbar` / `Alert`.

### 3. API Contract Synchronization
- Collaborate with Backend and AI engineers to keep `packages/contracts/openapi/tournament-api.yaml` updated.
- Ensure that TypeScript models in `web/src/types/tournament.ts` strictly mirror the backend data transfer objects.

### 4. Developer Experience & Local Orchestration
- Maintain `docker-compose.yml` and `Taskfile.yml` so any developer can run `task dev:up` and have all 7 containers running smoothly.

---

## Good First Issues for Fullstack Contributors
1. **User Profile Preferences**: Allow users to save their home university and radius preferences in `localStorage` or backend profile.
2. **Calendar Export (.ics)**: Add an "Add to Google / Apple Calendar" button on the Tournament Card.
3. **Carpool Seat Reservation Dialog**: Expand the RSVP button into a modal allowing athletes to offer or request carpool rides.

