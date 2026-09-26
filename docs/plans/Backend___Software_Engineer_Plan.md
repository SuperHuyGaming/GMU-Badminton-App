# Backend / Software Engineer Master Plan


## Phase 1: Foundation & Setup
**1. **ELO Rating Engine:** Implement a Kafka stream processor that listens to `match.verified` events and updates both players' ELO scores using mathematical rating algorithms.**

**2. **GMU RAC Court Scraper:** Write a scheduled Spring Boot service that scrapes the George Mason University recreation portal (or parses their API) for real-time open play court capacity.**

**3. **Push Notification Service:** Integrate Firebase Cloud Messaging (FCM) to dispatch native mobile push notifications when a user is challenged to a match.**


## Phase 2: Core Implementation
**4. **Geolocation Proximity API:** Leverage MongoDB `2dsphere` indexes to execute sub-millisecond `$near` queries for discovering players within a dynamic mile radius.**

**5. **Distributed Rate Limiting:** Prevent API abuse by implementing Bucket4j and Redis to enforce strict token-bucket rate limits on scraping endpoints.**

**6. **Change-Stream Dead Letter Queue (DLQ):** Build a fallback mechanism to catch, log, and retry MongoDB Change Stream events that fail to broadcast to Kafka.**


## Phase 3: Refinement & Advanced Features
**7. **Search Aggregation Pipelines:** Write advanced MongoDB aggregation queries to power complex, multi-variable filtering on the Leaderboard.**

**8. **Idempotent API Design:** Use Redis distributed locks (`SETNX`) to ensure that rapidly double-clicking the "Report Score" button doesn't log the match twice.**

**9. **External Calendar Sync API:** Build an endpoint that dynamically generates a live CalDAV/`.ics` feed of a user's RSVP'd tournaments for Apple Calendar syncing.**


## Phase 4: Optimization & Polish
**10. **GDPR Data Export:** Create a secure, asynchronous endpoint that compiles a user's entire history (posts, matches, locations) into a downloadable ZIP file.**

