# Backend / Distributed Systems Engineer: Role Guide

## Mission Overview
As a **Backend / Distributed Systems Engineer**, you are responsible for the core business logic, transactional data integrity, event streaming, and API resilience of Badminton Tournament Finder. You ensure that no tournament alert is lost, dual-writes are mathematically prevented, and geospatial proximity queries execute in sub-millisecond time.

---

## Primary Tech Stack
- **Languages & Frameworks**: Java 25 LTS, Spring Boot 3.3, Project Reactor (WebFlux).
- **Messaging & Streaming**: Apache Kafka (KRaft mode), Spring Cloud Stream / Spring Kafka.
- **Persistence**: MongoDB Atlas 7.0 (2dsphere geospatial indexing, Change Streams), Redis 7.2.
- **Gateway & Resilience**: Spring Cloud Gateway WebFlux, Resilience4j, Bucket4j Token Bucket.

---

## Core Responsibilities

### 1. Transactional Outbox Pattern & Change Streams
- Maintain atomic dual-write prevention using `@Transactional` over `tournaments` and `outbox_events` MongoDB collections.
- Manage MongoDB Change Streams (`ReactiveMongoTemplate`) to tail the MongoDB oplog in real-time.
- Persist and resume from MongoDB Change Stream **resume tokens** to guarantee zero event loss across server restarts.

### 2. Kafka Event Streaming Architecture
- Configure Kafka topics (`tournaments.events`) with partition key strategies ensuring order by host university or tournament ID.
- Ensure at-least-once delivery semantics: delete outbox records only upon receiving an explicit Kafka broker ACK.

### 3. Geospatial Indexing & Query Optimization
- Maintain `2dsphere` indexes on the `location` GeoJSON Point field.
- Optimize `$near` and `$geoWithin` spherical aggregation pipelines calculating distances in meters according to earth curvature.

### 4. API Gateway Resilience & Rate Limiting
- Maintain the non-blocking Netty-based Spring Cloud Gateway Server WebFlux.
- Configure Resilience4j Circuit Breakers to fail fast when upstream scrapers experience high latency.
- Enforce distributed rate limits (Bucket4j with Redis) to protect backend services against scraping attacks.

---

## Good First Issues for Backend Contributors
1. **Change Stream Dead-Letter Queue (DLQ)**: Route un-routable outbox events to a dedicated DLQ collection after 5 failed retries.
2. **Geocoding Fallback Service**: Integrate OpenStreetMap Nominatim API with in-memory Redis caching for unrecognized locations.
3. **Historical Event Replay Endpoint**: Add an admin REST endpoint to replay Kafka events for new downstream consumers.

