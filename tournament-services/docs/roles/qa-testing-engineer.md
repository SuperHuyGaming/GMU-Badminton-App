# Software Testing & QA Engineer: Role Guide

## Mission Overview
As a **Software Testing & QA Engineer** on Badminton Tournament Finder, you ensure that our polyglot microservices platform is rock-solid, resilient under network volatility, and free of regressions. You design and automate tests across every tier—from individual unit functions to end-to-end multi-service flows.

---

## Primary Tech Stack
- **Unit & Integration**: Pytest, JUnit 5, Mockito, Spring Boot Test, Testcontainers (MongoDB, Kafka, Redis).
- **End-to-End (E2E)**: Playwright, Cypress.
- **Performance & Load Testing**: k6, Locust.
- **Frontend Testing**: Vitest, React Testing Library.

---

## Core Responsibilities

### 1. Integration Testing with Testcontainers
- Maintain realistic integration tests in `services/core-service/src/test/java/`:
  - Spin up real MongoDB replica set containers to verify Change Stream oplog tailing.
  - Spin up real Apache Kafka containers to test Outbox Event publishing and at-least-once delivery.

### 2. End-to-End (E2E) Browser Automation
- Automate complete user journeys using Playwright:
  1. Athlete lands on the Discovery Dashboard.
  2. A new tournament is ingested into the backend.
  3. The browser receives the live WebSocket STOMP frame and pops a notification toast.
  4. The athlete clicks "RSVP" and verifies the optimistic UI update.

### 3. Load & Stress Testing with k6
- Validate that the Spring Cloud Gateway and WebSocket STOMP broker can handle 10,000+ concurrent connected clients.
- Verify that Bucket4j correctly returns HTTP 429 when rate thresholds are exceeded.

---

## Good First Issues for QA Contributors
1. **Mock Scraper Fixtures**: Create a suite of 20 realistic mock Instagram post payloads to stress-test the Pydantic validation parser.
2. **Playwright Visual Regression Tests**: Add screenshot comparison tests for the Tournament Card across light and dark themes.
3. **Chaos Monkey Test**: Write a script simulating network disconnection between Spring Boot and MongoDB during a transaction to verify that outbox events never duplicate.

